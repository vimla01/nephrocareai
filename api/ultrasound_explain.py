import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import cv2

class GradCAM:
    """
    Grad-CAM (Gradient-weighted Class Activation Mapping) for extracting heatmaps
    explaining where the CNN model focuses to make its prediction.
    """
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        
        # Register forward and backward hooks to access activations and gradients
        self.forward_hook = self.target_layer.register_forward_hook(self._save_activation)
        self.backward_hook = self.target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, input, output):
        self.activations = output

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0]

    def remove_hooks(self):
        """Must call this to clean up hooks when finished."""
        self.forward_hook.remove()
        self.backward_hook.remove()

    def generate(self, input_image, class_idx=None):
        """
        Generates the raw 2D Grad-CAM heatmap.
        """
        # Ensure model is in eval mode for Grad-CAM
        self.model.eval()
        
        # Reset cached values
        self.gradients = None
        self.activations = None
        
        # Forward pass
        logits = self.model(input_image)
        
        if class_idx is None:
            class_idx = torch.argmax(logits, dim=1).item()
            
        # Backward pass
        self.model.zero_grad()
        score = logits[0, class_idx]
        score.backward()
        
        if self.gradients is None or self.activations is None:
            raise RuntimeError("Grad-CAM hooks failed to capture gradients/activations. Verify target layer.")
            
        # Process gradients and activations
        gradients = self.gradients.cpu().data.numpy()[0]
        activations = self.activations.cpu().data.numpy()[0]
        
        # Channel-wise global average pooling of gradients
        weights = np.mean(gradients, axis=(1, 2))
        
        # Weighted sum of activation maps
        cam = np.zeros(activations.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            cam += w * activations[i]
            
        # ReLU to keep only positive contribution features
        cam = np.maximum(cam, 0)
        
        # Resize to match input image spatial size (224x224)
        h_in, w_in = input_image.shape[2], input_image.shape[3]
        cam = cv2.resize(cam, (w_in, h_in))
        
        # Normalize between [0, 1]
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max - cam_min > 1e-8:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = np.zeros_like(cam)
            
        return cam, class_idx

def overlay_heatmap(image_np, heatmap, alpha=0.45):
    """
    Overlays the JET colormap heatmap on top of the original grayscale/RGB image.
    image_np: original image, numpy shape (H, W, 3) or (H, W), values in range [0, 255] or [0, 1]
    heatmap: 2D array, values [0, 1]
    """
    # Scale image to [0, 255] uint8 if necessary
    if image_np.max() <= 1.0:
        image_np = (image_np * 255).astype(np.uint8)
    else:
        image_np = image_np.astype(np.uint8)
        
    # Convert image to RGB if grayscale
    if len(image_np.shape) == 2:
        image_rgb = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
    elif image_np.shape[2] == 1:
        image_rgb = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
    else:
        image_rgb = image_np.copy()
        
    # Apply JET color map to the heatmap
    heatmap_uint8 = (heatmap * 255).astype(np.uint8)
    heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    heatmap_color = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2RGB)
    
    # Blending
    blended = cv2.addWeighted(image_rgb, 1.0 - alpha, heatmap_color, alpha, 0)
    return blended

def get_attention_map(model, input_image):
    """
    Extracts the spatial attention map cached in the model's CBAM block.
    """
    model.eval()
    with torch.no_grad():
        _ = model(input_image)
        
    if model.last_spatial_attention is None:
        raise ValueError("Model has not cached spatial attention maps. Run forward pass first.")
        
    # Extract map (shape: 1, 1, H, W)
    attn = model.last_spatial_attention[0, 0].cpu().numpy()
    
    # Resize to input resolution
    h_in, w_in = input_image.shape[2], input_image.shape[3]
    attn_resized = cv2.resize(attn, (w_in, h_in))
    
    # Normalize [0, 1]
    attn_min, attn_max = attn_resized.min(), attn_resized.max()
    if attn_max - attn_min > 1e-8:
        attn_resized = (attn_resized - attn_min) / (attn_max - attn_min)
    else:
        attn_resized = np.zeros_like(attn_resized)
        
    return attn_resized

def mc_dropout_inference(model, input_image, num_passes=12):
    """
    Performs Monte Carlo Dropout inference by forcing dropout modules to remain active
    during evaluation. Computes predictive distributions, standard deviation, and Shannon entropy.
    """
    model.eval()
    
    # Force dropout layers to remain active
    dropout_count = 0
    for m in model.modules():
        if m.__class__.__name__.startswith('Dropout'):
            m.train()
            dropout_count += 1
            
    # Fallback if no dropout layers are active (though our head has two)
    if dropout_count == 0:
        print("Warning: No dropout layers detected in model module list.")
        
    probabilities = []
    
    with torch.no_grad():
        for _ in range(num_passes):
            logits = model(input_image)
            probs = F.softmax(logits, dim=1)
            probabilities.append(probs.cpu().numpy()[0])
            
    probabilities = np.array(probabilities)  # Shape: (num_passes, num_classes)
    
    # Metrics calculation
    mean_probs = np.mean(probabilities, axis=0)
    std_probs = np.std(probabilities, axis=0)
    
    # Shannon Entropy H = - sum(p * log2(p + eps))
    eps = 1e-12
    entropy = -np.sum(mean_probs * np.log2(mean_probs + eps))
    
    # Max possible entropy for 5 classes is log2(5) ~ 2.322
    normalized_entropy = entropy / np.log2(5.0)
    
    predicted_class = np.argmax(mean_probs)
    
    return {
        "mean_probabilities": mean_probs,
        "std_probabilities": std_probs,
        "entropy": entropy,
        "normalized_entropy": normalized_entropy,
        "predicted_class": predicted_class,
        "all_passes": probabilities
    }

if __name__ == "__main__":
    try:
        from ultrasound_model import KidneyUltrasoundCNN
    except ImportError:
        from api.ultrasound_model import KidneyUltrasoundCNN
    
    print("Testing Explainability Module...")
    model = KidneyUltrasoundCNN(num_classes=5, pretrained=False)
    dummy_input = torch.randn(1, 3, 224, 224, requires_grad=True)
    
    # Test Attention extraction
    try:
        attn = get_attention_map(model, dummy_input)
        print("Attention map extracted. Shape:", attn.shape)
    except Exception as e:
        print("Attention extraction failed:", e)
        
    # Test Grad-CAM
    try:
        # EfficientNet last features block is model.features[-1] or features[8]
        gcam = GradCAM(model, model.features[8])
        cam, pred_class = gcam.generate(dummy_input)
        gcam.remove_hooks()
        print(f"Grad-CAM generated successfully for class {pred_class}. Shape: {cam.shape}")
        
        # Test overlay
        dummy_img_np = np.random.uniform(0, 255, (224, 224, 3)).astype(np.uint8)
        overlay = overlay_heatmap(dummy_img_np, cam)
        print("Overlay shape:", overlay.shape)
    except Exception as e:
        print("Grad-CAM test failed:", e)
        
    # Test MC Dropout
    try:
        res = mc_dropout_inference(model, dummy_input, num_passes=5)
        print("MC Dropout successful:")
        print(" - Mean probabilities:", res["mean_probabilities"])
        print(" - Std deviations:", res["std_probabilities"])
        print(" - Entropy:", res["entropy"])
        print(" - Normalized Entropy:", res["normalized_entropy"])
    except Exception as e:
        print("MC Dropout test failed:", e)
