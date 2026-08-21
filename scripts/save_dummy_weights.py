import sys
import torch
from pathlib import Path

# Add api directory to path
sys.path.append(str(Path(__file__).resolve().parent))

try:
    from api.ultrasound_model import KidneyUltrasoundCNN
except ImportError:
    from ultrasound_model import KidneyUltrasoundCNN

def main():
    print("Generating dummy weights...")
    model = KidneyUltrasoundCNN(num_classes=5, pretrained=False)
    output_path = Path(__file__).resolve().parent / "models" / "kidney_ultrasound_model.pth"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), output_path)
    print(f"Dummy weights saved successfully to {output_path}")

if __name__ == "__main__":
    main()
