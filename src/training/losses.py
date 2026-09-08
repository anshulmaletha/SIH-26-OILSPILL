"""
Loss functions for Sentinel-1 SAR Oil Spill Segmentation.
Combines Binary Cross-Entropy with Logits (BCEWithLogitsLoss) and Soft Dice Loss.
Includes robust non-vanishing gradient penalty for empty target masks.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class DiceLoss(nn.Module):
    """
    Differentiable Soft Dice Loss for binary segmentation.
    Properly handles empty target masks (Y = 0) to penalize background false positives.
    Expects unnormalized raw logits from model.
    """

    def __init__(self, smooth: float = 1e-7):
        super().__init__()
        self.smooth = smooth

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        batch_size = probs.size(0)
        p = probs.reshape(batch_size, -1)
        y = targets.reshape(batch_size, -1).float()

        y_sum = y.sum(dim=1)
        p_sum = p.sum(dim=1)
        intersection = (p * y).sum(dim=1)

        dice_score = (2.0 * intersection + self.smooth) / (p_sum + y_sum + self.smooth)
        nonempty_loss = 1.0 - dice_score

        # Empty GT: any predicted mass is a false positive.
        # Square mean strongly penalizes confident FP; plus a soft mass term so
        # widespread moderate probabilities (e.g. ~0.35) are also driven down.
        empty_mass = p_sum / (p_sum + 1.0)
        empty_loss = p.pow(2).mean(dim=1) + empty_mass

        is_empty = y_sum <= 0
        sample_loss = torch.where(is_empty, empty_loss, nonempty_loss)
        return sample_loss.mean()


class BCEDiceLoss(nn.Module):
    """
    Weighted combination of BCEWithLogitsLoss and Soft Dice Loss.
    Loss = (bce_weight * BCE) + (dice_weight * DiceLoss)
    """

    def __init__(
        self,
        bce_weight: float = 0.5,
        dice_weight: float = 0.5,
        pos_weight: float = 1.0,
        smooth: float = 1e-7
    ):
        super().__init__()
        self.bce_weight = bce_weight
        self.dice_weight = dice_weight
        
        pos_tensor = torch.tensor([pos_weight]) if pos_weight != 1.0 else None
        self.bce_loss = nn.BCEWithLogitsLoss(pos_weight=pos_tensor)
        self.dice_loss = DiceLoss(smooth=smooth)

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        bce = self.bce_loss(logits, targets)
        dice = self.dice_loss(logits, targets)
        return (self.bce_weight * bce) + (self.dice_weight * dice)


class TverskyLoss(nn.Module):
    """
    Differentiable Tversky Loss for binary segmentation.
    Allows asymmetric weighting of False Positives (alpha) and False Negatives (beta).
    Supports thin-slick recall optimization when beta < alpha (e.g. alpha=0.7, beta=0.3).
    Expects unnormalized raw logits from model.
    """

    def __init__(self, alpha: float = 0.7, beta: float = 0.3, smooth: float = 1e-7):
        super().__init__()
        self.alpha = alpha
        self.beta = beta
        self.smooth = smooth

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        batch_size = probs.size(0)
        p = probs.reshape(batch_size, -1)
        y = targets.reshape(batch_size, -1).float()

        y_sum = y.sum(dim=1)
        p_sum = p.sum(dim=1)

        tp = (p * y).sum(dim=1)
        fp = (p * (1.0 - y)).sum(dim=1)
        fn = ((1.0 - p) * y).sum(dim=1)

        tversky_score = (tp + self.smooth) / (tp + (self.alpha * fp) + (self.beta * fn) + self.smooth)
        nonempty_loss = 1.0 - tversky_score

        # Empty GT penalty (any predicted mass is FP)
        empty_mass = p_sum / (p_sum + 1.0)
        empty_loss = p.pow(2).mean(dim=1) + empty_mass

        is_empty = y_sum <= 0
        sample_loss = torch.where(is_empty, empty_loss, nonempty_loss)
        return sample_loss.mean()


class BCETverskyLoss(nn.Module):
    """
    Weighted combination of BCEWithLogitsLoss and TverskyLoss.
    Loss = (bce_weight * BCE) + (tversky_weight * TverskyLoss)
    """

    def __init__(
        self,
        bce_weight: float = 0.5,
        tversky_weight: float = 0.5,
        alpha: float = 0.7,
        beta: float = 0.3,
        pos_weight: float = 1.0,
        smooth: float = 1e-7
    ):
        super().__init__()
        self.bce_weight = bce_weight
        self.tversky_weight = tversky_weight
        pos_tensor = torch.tensor([pos_weight]) if pos_weight != 1.0 else None
        self.bce_loss = nn.BCEWithLogitsLoss(pos_weight=pos_tensor)
        self.tversky_loss = TverskyLoss(alpha=alpha, beta=beta, smooth=smooth)

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        bce = self.bce_loss(logits, targets)
        tv = self.tversky_loss(logits, targets)
        return (self.bce_weight * bce) + (self.tversky_weight * tv)

