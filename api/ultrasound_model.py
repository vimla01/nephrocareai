import torch
import torch.nn as nn
import torch.nn.functional as F

class ChannelAttention(nn.Module):
    """
    Channel Attention Module: Aggregates spatial information via average and max pooling,
    then processes through a shared MLP (using 1x1 convolutions) to learn channel-wise scale factors.
    """
    def __init__(self, in_planes, ratio=16):
        super(ChannelAttention, self).__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)

        # ratio=16 squeezes then expands channels, same bottleneck trick as squeeze-and-excite nets
        self.shared_mlp = nn.Sequential(
            nn.Conv2d(in_planes, in_planes // ratio, 1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(in_planes // ratio, in_planes, 1, bias=False)
        )
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        # same mlp weights applied to both pooled views, then combined - this is standard cbam
        avg_out = self.shared_mlp(self.avg_pool(x))
        max_out = self.shared_mlp(self.max_pool(x))
        out = avg_out + max_out
        return self.sigmoid(out)

class SpatialAttention(nn.Module):
    """
    Spatial Attention Module: Aggregates channel information via channel-wise average and max pooling,
    concatenates the pooled maps, and applies a 7x7 convolution to generate spatial attention maps.
    """
    def __init__(self, kernel_size=7):
        super(SpatialAttention, self).__init__()
        assert kernel_size in (3, 7), 'Kernel size must be 3 or 7'
        padding = 3 if kernel_size == 7 else 1
        self.conv1 = nn.Conv2d(2, 1, kernel_size, padding=padding, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        # pool across channels (not spatial dims) to get a 2-channel map, then let the conv learn where to look
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        concat = torch.cat([avg_out, max_out], dim=1)
        out = self.conv1(concat)
        return self.sigmoid(out)

class CBAMBlock(nn.Module):
    """
    Convolutional Block Attention Module (CBAM) combining Channel and Spatial Attention.
    """
    def __init__(self, channels, reduction_ratio=16, spatial_kernel=7):
        super(CBAMBlock, self).__init__()
        self.ca = ChannelAttention(channels, ratio=reduction_ratio)
        self.sa = SpatialAttention(kernel_size=spatial_kernel)

    def forward(self, x):
        # channel attention runs first, spatial attention is applied to its output - order matters in cbam
        ca_weight = self.ca(x)
        out = x * ca_weight

        # Spatial Attention
        sa_weight = self.sa(out)
        out = out * sa_weight

        # weights returned too since explain.py/pipeline.py cache them for the heatmap overlays
        return out, ca_weight, sa_weight

class KidneyUltrasoundCNN(nn.Module):
    """
    Kidney Ultrasound CNN Classifier:
    - EfficientNet-B0 backbone (with transfer learning weights)
    - Custom Spatial-Channel Attention Block (CBAM)
    - Custom Classification Head with LayerNorm and Dropout
    Outputs 5 classes: Normal, Cyst, Stone, Hydronephrosis, Other abnormality.
    """
    def __init__(self, num_classes=5, pretrained=True):
        super(KidneyUltrasoundCNN, self).__init__()
        
        # Load EfficientNetB0 backbone
        try:
            from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
            if pretrained:
                # imagenet weights give the model a head start since we only have a small ultrasound dataset
                weights = EfficientNet_B0_Weights.DEFAULT
                self.backbone = efficientnet_b0(weights=weights)
            else:
                self.backbone = efficientnet_b0()
        except ImportError:
            # older torchvision used a pretrained=bool flag instead of the weights enum
            from torchvision.models import efficientnet_b0
            self.backbone = efficientnet_b0(pretrained=pretrained)

        # Feature extractor
        self.features = self.backbone.features  # drop efficientnet's own classifier head, we bolt on our own below
        self.feature_channels = 1280  # EfficientNet-B0 final feature channels

        # Attention block (CBAM)
        self.attention = CBAMBlock(self.feature_channels, reduction_ratio=16, spatial_kernel=7)

        # Custom head
        self.global_pool = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.LayerNorm(self.feature_channels),
            nn.Dropout(p=0.4),  # heavier dropout right after the backbone, dataset is small so this fights overfitting
            nn.Linear(self.feature_channels, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.3),
            nn.Linear(512, num_classes)
        )

        # Stored variables for activation/attention extraction
        self.last_spatial_attention = None
        self.last_channel_attention = None

    def forward(self, x):
        # 1. Feature extraction
        feats = self.features(x)

        # 2. Attention mechanism
        attn_feats, ca, sa = self.attention(feats)

        # detach so we don't keep the whole graph alive just for later visualization
        self.last_channel_attention = ca.detach()
        self.last_spatial_attention = sa.detach()

        # 3. Global average pooling and classification
        pooled = self.global_pool(attn_feats)
        logits = self.classifier(pooled)

        return logits

if __name__ == "__main__":
    # Smoke test model initialization and shape validation
    model = KidneyUltrasoundCNN(num_classes=5, pretrained=False)
    dummy_input = torch.randn(2, 3, 224, 224)
    logits = model(dummy_input)
    print(f"Input shape: {dummy_input.shape}")
    print(f"Output logits shape: {logits.shape}")
    print("Spatial attention map cache shape:", model.last_spatial_attention.shape)
    print("Channel attention map cache shape:", model.last_channel_attention.shape)
