"""
U-Net++ (Nested U-Net) architecture for Sentinel-1 SAR Oil Spill Segmentation.
Input: (B, 2, H, W) - 2 channels for VV and VH polarizations.
Output: (B, 1, H, W) - 1 channel unnormalized binary segmentation logits.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBlock(nn.Module):
    """(Conv2d -> BatchNorm2d -> ReLU) * 2"""

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.conv(x)


class UNetPlusPlus(nn.Module):
    """
    U-Net++ (Nested U-Net architecture with dense skip pathways).

    Args:
        in_channels: Number of input channels (default: 2 for VV + VH).
        out_channels: Number of output channels (default: 1 for binary logits).
        features: Base channel dimension (default: 64).
        deep_supervision: If True, returns auxiliary outputs during training (default: False).
    """

    def __init__(
        self,
        in_channels: int = 2,
        out_channels: int = 1,
        features: int = 64,
        deep_supervision: bool = False
    ):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels
        self.deep_supervision = deep_supervision

        nb_filter = [features, features * 2, features * 4, features * 8, features * 16]

        self.pool = nn.MaxPool2d(2, 2)
        self.up = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=True)

        # Level 0
        self.conv0_0 = ConvBlock(in_channels, nb_filter[0])
        self.conv0_1 = ConvBlock(nb_filter[0] + nb_filter[1], nb_filter[0])
        self.conv0_2 = ConvBlock(nb_filter[0] * 2 + nb_filter[1], nb_filter[0])
        self.conv0_3 = ConvBlock(nb_filter[0] * 3 + nb_filter[1], nb_filter[0])
        self.conv0_4 = ConvBlock(nb_filter[0] * 4 + nb_filter[1], nb_filter[0])

        # Level 1
        self.conv1_0 = ConvBlock(nb_filter[0], nb_filter[1])
        self.conv1_1 = ConvBlock(nb_filter[1] + nb_filter[2], nb_filter[1])
        self.conv1_2 = ConvBlock(nb_filter[1] * 2 + nb_filter[2], nb_filter[1])
        self.conv1_3 = ConvBlock(nb_filter[1] * 3 + nb_filter[2], nb_filter[1])

        # Level 2
        self.conv2_0 = ConvBlock(nb_filter[1], nb_filter[2])
        self.conv2_1 = ConvBlock(nb_filter[2] + nb_filter[3], nb_filter[2])
        self.conv2_2 = ConvBlock(nb_filter[2] * 2 + nb_filter[3], nb_filter[2])

        # Level 3
        self.conv3_0 = ConvBlock(nb_filter[2], nb_filter[3])
        self.conv3_1 = ConvBlock(nb_filter[3] + nb_filter[4], nb_filter[3])

        # Level 4 (Bottleneck)
        self.conv4_0 = ConvBlock(nb_filter[3], nb_filter[4])

        # Final 1x1 Convolution layers for raw logits
        if self.deep_supervision:
            self.final1 = nn.Conv2d(nb_filter[0], out_channels, kernel_size=1)
            self.final2 = nn.Conv2d(nb_filter[0], out_channels, kernel_size=1)
            self.final3 = nn.Conv2d(nb_filter[0], out_channels, kernel_size=1)
            self.final4 = nn.Conv2d(nb_filter[0], out_channels, kernel_size=1)
        else:
            self.final = nn.Conv2d(nb_filter[0], out_channels, kernel_size=1)

    def _align_and_cat(self, to_cat: list, upsampled: torch.Tensor) -> torch.Tensor:
        """Helper to pad upsampled features if dimensions differ and concatenate."""
        target_h, target_w = to_cat[0].shape[2], to_cat[0].shape[3]
        up_h, up_w = upsampled.shape[2], upsampled.shape[3]

        diff_y = target_h - up_h
        diff_x = target_w - up_w

        if diff_y != 0 or diff_x != 0:
            upsampled = F.pad(upsampled, [diff_x // 2, diff_x - diff_x // 2,
                                          diff_y // 2, diff_y - diff_y // 2])

        return torch.cat(to_cat + [upsampled], dim=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass. Returns unnormalized binary segmentation logits.
        """
        x0_0 = self.conv0_0(x)
        x1_0 = self.conv1_0(self.pool(x0_0))
        x0_1 = self.conv0_1(self._align_and_cat([x0_0], self.up(x1_0)))

        x2_0 = self.conv2_0(self.pool(x1_0))
        x1_1 = self.conv1_1(self._align_and_cat([x1_0], self.up(x2_0)))
        x0_2 = self.conv0_2(self._align_and_cat([x0_0, x0_1], self.up(x1_1)))

        x3_0 = self.conv3_0(self.pool(x2_0))
        x2_1 = self.conv2_1(self._align_and_cat([x2_0], self.up(x3_0)))
        x1_2 = self.conv1_2(self._align_and_cat([x1_0, x1_1], self.up(x2_1)))
        x0_3 = self.conv0_3(self._align_and_cat([x0_0, x0_1, x0_2], self.up(x1_2)))

        x4_0 = self.conv4_0(self.pool(x3_0))
        x3_1 = self.conv3_1(self._align_and_cat([x3_0], self.up(x4_0)))
        x2_2 = self.conv2_2(self._align_and_cat([x2_0, x2_1], self.up(x3_1)))
        x1_3 = self.conv1_3(self._align_and_cat([x1_0, x1_1, x1_2], self.up(x2_2)))
        x0_4 = self.conv0_4(self._align_and_cat([x0_0, x0_1, x0_2, x0_3], self.up(x1_3)))

        if self.deep_supervision:
            output1 = self.final1(x0_1)
            output2 = self.final2(x0_2)
            output3 = self.final3(x0_3)
            output4 = self.final4(x0_4)
            return torch.stack([output1, output2, output3, output4], dim=0)

        logits = self.final(x0_4)
        return logits
