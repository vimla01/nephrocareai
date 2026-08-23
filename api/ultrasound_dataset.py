import os
import numpy as np
import cv2
import torch
from torch.utils.data import Dataset
import torchvision.transforms as T

def generate_synthetic_ultrasound(label, seed=None):
    """
    Generates a realistic simulated kidney ultrasound image.
    Pathology labels:
      0: Normal
      1: Cyst (Anechoic circular fluid with posterior enhancement)
      2: Stone (Hyperechoic spot with posterior acoustic shadow)
      3: Hydronephrosis (Fluid backing up in the sinus / dilated pelvis)
      4: Other abnormality (Irregular cortical mass with heterogeneous texture)
    """
    # no real labeled ultrasound dataset available, so we render synthetic scans procedurally instead
    if seed is not None:
        np.random.seed(seed)

    h, w = 256, 256
    img = np.zeros((h, w), dtype=np.float32)

    # 1. Sector Mask (Curvilinear probe geometry)
    # apex sits above the frame (negative y) so the fan-out cone widens downward like a real curvilinear probe
    center_y = -40
    center_x = 128
    radius_inner = 80
    radius_outer = 270

    mask = np.zeros((h, w), dtype=np.float32)
    for y in range(h):
        for x in range(w):
            dx = x - center_x
            dy = y - center_y
            dist = np.sqrt(dx*dx + dy*dy)
            # angle in degrees (-180 to 180)
            angle = np.degrees(np.arctan2(dy, dx))
            # 55-125 deg is the probe's field of view cone, everything outside stays black
            if radius_inner <= dist <= radius_outer and 55 <= angle <= 125:
                mask[y, x] = 1.0

    # 2. Base Tissue Speckle Background
    tissue_bg = np.random.uniform(8, 24, (h, w)).astype(np.float32)
    img = img + tissue_bg
    
    # Randomize kidney size/rotation slightly
    kd_angle = 15 + np.random.uniform(-10, 10)
    kd_center = (128 + int(np.random.uniform(-5, 5)), 120 + int(np.random.uniform(-5, 5)))
    kd_axes = (65 + int(np.random.uniform(-5, 5)), 45 + int(np.random.uniform(-3, 3)))
    
    # 3. Kidney Cortex (Darker gray parenchyma)
    kidney_mask = np.zeros((h, w), dtype=np.float32)
    cv2.ellipse(kidney_mask, kd_center, kd_axes, kd_angle, 0, 360, 1.0, -1)
    img[kidney_mask > 0] = np.random.uniform(38, 48)
    
    # 4. Kidney Sinus (Central fibrous, hyperechoic structure)
    sinus_mask = np.zeros((h, w), dtype=np.float32)
    sinus_axes = (kd_axes[0] - 28, kd_axes[1] - 25)
    cv2.ellipse(sinus_mask, kd_center, sinus_axes, kd_angle, 0, 360, 1.0, -1)
    img[sinus_mask > 0] = np.random.uniform(95, 115)
    
    # 5. Pathologies setup - each branch below draws the visual signature for one class label
    shadow_mask = np.ones((h, w), dtype=np.float32)
    enhance_mask = np.zeros((h, w), dtype=np.float32)
    
    if label == 0:
        # Normal kidney: sinus and cortex are intact
        pass
    elif label == 1:
        # Cyst: Anechoic circular fluid (value ~12) with posterior enhancement (bright strip below)
        # Position cyst randomly in the cortex
        cyst_x = kd_center[0] - int(kd_axes[0] * 0.4)
        cyst_y = kd_center[1] - int(kd_axes[1] * 0.3)
        cyst_r = int(np.random.uniform(10, 14))
        
        cv2.circle(img, (cyst_x, cyst_y), cyst_r, 12, -1)
        # Posterior enhancement below
        for y in range(cyst_y + cyst_r, h):
            half_w = int(cyst_r * (1.0 + (y - cyst_y) * 0.008))
            enhance_mask[y, max(0, cyst_x - half_w): min(w, cyst_x + half_w)] = np.random.uniform(40, 55)
            
    elif label == 2:
        # Stone: Hyperechoic small spot (value ~240) with posterior shadowing (dark strip below)
        stone_x = kd_center[0] + int(kd_axes[0] * 0.25)
        stone_y = kd_center[1] - int(kd_axes[1] * 0.2)
        stone_r = int(np.random.uniform(4, 6))
        
        cv2.circle(img, (stone_x, stone_y), stone_r, 245, -1)
        # Posterior shadowing
        for y in range(stone_y + stone_r, h):
            half_w = int(stone_r * (1.0 + (y - stone_y) * 0.004))
            shadow_mask[y, max(0, stone_x - half_w): min(w, stone_x + half_w)] = 0.20
            
    elif label == 3:
        # Hydronephrosis: dilated, anechoic urine pools backing up in central sinus pelvis
        # Draw multiple overlapping anechoic/dark patches inside the sinus
        cv2.ellipse(img, kd_center, (sinus_axes[0] - 8, sinus_axes[1] - 4), kd_angle, 0, 360, 16.0, -1)
        # Branching calyces dilation
        cv2.circle(img, (kd_center[0] - 18, kd_center[1] - 12), 12, 14, -1)
        cv2.circle(img, (kd_center[0] + 18, kd_center[1] + 12), 11, 14, -1)
        cv2.circle(img, (kd_center[0] - 5, kd_center[1] + 15), 10, 14, -1)
        
    elif label == 4:
        # Other: heterogeneous cortex mass (tumor or complex lesion) with irregular boundary
        mass_x = kd_center[0] + int(kd_axes[0] * 0.35)
        mass_y = kd_center[1] + int(kd_axes[1] * 0.25)
        mass_r = int(np.random.uniform(13, 17))
        
        # Build irregular polygon
        points = []
        for i in range(12):
            ang = i * np.pi / 6
            r = mass_r + np.random.uniform(-4, 4)
            px = int(mass_x + r * np.cos(ang))
            py = int(mass_y + r * np.sin(ang))
            points.append([px, py])
        
        pts = np.array(points, dtype=np.int32)
        cv2.fillPoly(img, [pts], np.random.uniform(170, 190))
        # Add internal heterogeneous calcifications/cysts
        cv2.circle(img, (mass_x - 3, mass_y - 2), 3, 60, -1)
        cv2.circle(img, (mass_x + 4, mass_y + 3), 4, 85, -1)
        cv2.circle(img, (mass_x + 1, mass_y - 6), 2, 230, -1)  # tiny hyperechoic calcification

    # Apply masks and enhancements
    img = img * shadow_mask + enhance_mask
    img = img * mask
    
    # 6. Noise Modelling - real ultrasound has grainy speckle texture, plain shapes would be too easy to classify
    # Multiplicative speckle noise (Gaussian)
    speckle_noise = np.random.normal(1.0, 0.14, (h, w)).astype(np.float32)
    img = img * speckle_noise

    # Additive electrical/thermal noise
    thermal_noise = np.random.normal(0, 4.0, (h, w)).astype(np.float32)
    img = img + thermal_noise
    
    # Clip and mask boundary tissue
    img = img * mask
    img = np.clip(img, 0, 255).astype(np.uint8)
    
    # 7. Post-processing (Ultrasound beam blurring)
    img = cv2.GaussianBlur(img, (3, 3), 0.8)
    img_resized = cv2.resize(img, (224, 224), interpolation=cv2.INTER_AREA)
    
    return img_resized

class KidneyUltrasoundDataset(Dataset):
    """
    Kidney Ultrasound PyTorch Dataset.
    Supports either:
      1. Real image paths loaded from disk.
      2. Programmatic generation of realistic synthetic ultrasound images.
    """
    def __init__(self, file_paths=None, labels=None, transform=None, num_samples=3000, seed=42):
        self.file_paths = file_paths
        self.labels = labels
        self.transform = transform
        self.num_samples = num_samples
        self.seed = seed
        self.is_synthetic = file_paths is None  # no paths given means "generate images on the fly"

        if self.is_synthetic:
            # random, not balanced per class - just a uniform draw over the 5 labels
            np.random.seed(seed)
            self.synthetic_labels = np.random.randint(0, 5, size=(num_samples,))
        else:
            assert len(file_paths) == len(labels), "File paths and labels must be of equal length."
            self.synthetic_labels = None

    def __len__(self):
        if self.is_synthetic:
            return self.num_samples
        return len(self.file_paths)

    def __getitem__(self, idx):
        if self.is_synthetic:
            label = self.synthetic_labels[idx]
            # Use deterministic seed for sample idx to keep dataset constant across epochs
            # Add seed offset to differentiate splits (train/val/test)
            img_seed = self.seed + idx
            img_gray = generate_synthetic_ultrasound(label, seed=img_seed)
        else:
            img_path = self.file_paths[idx]
            label = self.labels[idx]
            img_gray = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            if img_gray is None:
                raise FileNotFoundError(f"Could not load image at: {img_path}")
            img_gray = cv2.resize(img_gray, (224, 224), interpolation=cv2.INTER_AREA)
        
        # Convert grayscale to 3-channel RGB (required by EfficientNet)
        img_rgb = cv2.cvtColor(img_gray, cv2.COLOR_GRAY2RGB)

        if self.transform:
            img_tensor = self.transform(img_rgb)
        else:
            # Fallback simple transform
            img_tensor = T.ToTensor()(img_rgb)

        return img_tensor, torch.tensor(label, dtype=torch.long)  # CrossEntropyLoss expects long, not int/float labels

def get_transforms():
    """
    Returns standard train and validation image transformation pipelines.
    """
    # ImageNet standard values for normalization - has to match what the pretrained backbone was trained with
    mean = [0.485, 0.456, 0.406]
    std = [0.229, 0.224, 0.225]

    train_transform = T.Compose([
        T.ToPILImage(),
        T.RandomRotation(degrees=15),  # small angle only, a real scan won't be rotated much more than this
        T.RandomHorizontalFlip(p=0.5),  # safe since kidneys are roughly left/right mirror symmetric
        T.ColorJitter(brightness=0.15, contrast=0.15),
        T.ToTensor(),
        T.Normalize(mean=mean, std=std)
    ])

    # validation/test images skip the augmentation so metrics reflect the real image, not a jittered one
    val_transform = T.Compose([
        T.ToPILImage(),
        T.ToTensor(),
        T.Normalize(mean=mean, std=std)
    ])

    return train_transform, val_transform

if __name__ == "__main__":
    # Test generator and dataset loading
    import matplotlib.pyplot as plt
    
    print("Testing synthetic image generation...")
    img = generate_synthetic_ultrasound(label=1, seed=42)
    print("Generated image size:", img.shape)
    
    train_tr, val_tr = get_transforms()
    ds = KidneyUltrasoundDataset(num_samples=10, transform=train_tr, seed=42)
    loader = torch.utils.data.DataLoader(ds, batch_size=4, shuffle=True)
    
    batch_x, batch_y = next(iter(loader))
    print("Batch shape x:", batch_x.shape)
    print("Batch shape y:", batch_y.shape)
    print("Successfully built the dataset pipeline!")
