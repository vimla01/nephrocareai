import os
import io
import base64
from pathlib import Path
import torch
import cv2
import numpy as np
from PIL import Image

try:
    # bare imports work when this module is run standalone (e.g. from scripts/), package-relative when imported via api.*
    from ultrasound_model import KidneyUltrasoundCNN
    from ultrasound_dataset import get_transforms
    from ultrasound_explain import GradCAM, get_attention_map, mc_dropout_inference, overlay_heatmap
except ImportError:
    from api.ultrasound_model import KidneyUltrasoundCNN
    from api.ultrasound_dataset import get_transforms
    from api.ultrasound_explain import GradCAM, get_attention_map, mc_dropout_inference, overlay_heatmap

def run_cnn_ultrasound_analysis(image_path_str: str) -> dict:
    """
    Executes deep learning CNN analysis on a kidney ultrasound scan.
    Returns predicted class, probabilities, uncertainty metrics, and base64-encoded visual overlays.
    """
    import random
    # fixed seed so mc dropout gives the same result on repeated scans of the same image
    random.seed(42)
    np.random.seed(42)
    torch.manual_seed(42)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(42)

    ROOT = Path(__file__).resolve().parents[1]
    weights_path = ROOT / "models" / "kidney_ultrasound_model.pth"

    # 1. Load image and preprocess - always treated as grayscale even if the upload is a color jpeg/png
    img_gray = cv2.imread(image_path_str, cv2.IMREAD_GRAYSCALE)
    if img_gray is None:
        raise FileNotFoundError(f"Could not load image at path: {image_path_str}")

    img_resized = cv2.resize(img_gray, (224, 224), interpolation=cv2.INTER_AREA)
    img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_GRAY2RGB)  # model wants 3 channels even though the source is grayscale

    # Convert to PyTorch tensor - use val transform (no augmentation) since this is inference, not training
    _, val_transform = get_transforms()
    input_tensor = val_transform(img_rgb).unsqueeze(0)  # add batch dim of 1

    # 2. Instantiate model and load checkpoint
    model = KidneyUltrasoundCNN(num_classes=5, pretrained=False)
    if weights_path.exists():
        model.load_state_dict(torch.load(weights_path, map_location="cpu"))
    else:
        # no trained weights yet - still runs so the endpoint doesn't 500, predictions just won't be meaningful
        print(f"Warning: Model weights file not found at {weights_path}. Running with uninitialized parameters.")
    model.eval()

    # 3. MC Dropout Inference (12 passes) - runs the same input through the model multiple times with
    # dropout still active to see how much the prediction wobbles, which doubles as a confidence signal
    mc_results = mc_dropout_inference(model, input_tensor, num_passes=12)
    pred_idx = mc_results["predicted_class"]
    class_names = ["Normal", "Cyst", "Stone", "Hydronephrosis", "Other abnormality"]
    pred_class = class_names[pred_idx]
    mean_probs = mc_results["mean_probabilities"]
    std_probs = mc_results["std_probabilities"]
    entropy = mc_results["entropy"]
    norm_entropy = mc_results["normalized_entropy"]
    
    # 4. Grad-CAM Overlay
    gcam = GradCAM(model, model.features[8])  # last conv block before the attention head, best localization
    cam, _ = gcam.generate(input_tensor, class_idx=pred_idx)
    gcam.remove_hooks()
    gcam_overlay = overlay_heatmap(img_rgb, cam, alpha=0.45)
    
    # 5. Attention Map Overlay (CBAM) - separate from grad-cam, this shows what the model's own
    # attention block focused on rather than a gradient-based explanation
    attn_map = get_attention_map(model, input_tensor)
    attn_colored = cv2.applyColorMap((attn_map * 255).astype(np.uint8), cv2.COLORMAP_VIRIDIS)
    attn_colored = cv2.cvtColor(attn_colored, cv2.COLOR_BGR2RGB)  # opencv gives bgr, everything else here expects rgb
    attn_overlay = cv2.addWeighted(img_rgb, 0.5, attn_colored, 0.5, 0)

    # Helper to convert RGB array to base64 jpeg string for embedding straight in the json response
    def to_base64(img_arr):
        pil_img = Image.fromarray(img_arr)
        buffered = io.BytesIO()
        pil_img.save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode("utf-8")
        
    gcam_base64 = to_base64(gcam_overlay)
    attn_base64 = to_base64(attn_overlay)
    
    return {
        "cnn_predicted_class": pred_class,
        "cnn_confidence": float(mean_probs[pred_idx]),
        "cnn_confidence_std": float(std_probs[pred_idx]),
        "cnn_probabilities": mean_probs.tolist(),
        "cnn_std_deviations": std_probs.tolist(),
        "cnn_entropy": float(entropy),
        "cnn_normalized_entropy": float(norm_entropy),
        "cnn_warning": bool(entropy > 1.0),  # high entropy across mc passes means the model isn't confident
        "gcam_img_base64": gcam_base64,
        "attention_img_base64": attn_base64
    }
