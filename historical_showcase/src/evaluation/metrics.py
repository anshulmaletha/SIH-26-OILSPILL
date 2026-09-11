"""
Evaluation metrics for Sentinel-1 SAR Oil Spill Binary Segmentation.
Computes Dice, IoU, Precision, Recall, and F1 score with exact empty-target handling.
"""

from typing import Dict
import torch


def calculate_segmentation_metrics(
    pred_logits: torch.Tensor,
    targets: torch.Tensor,
    threshold: float = 0.5,
    eps: float = 1e-7
) -> Dict[str, float]:
    """
    Calculate binary segmentation metrics.

    Args:
        pred_logits: Model output raw logits (B, 1, H, W) or single (1, H, W).
        targets: Ground truth binary masks (B, 1, H, W) or single (1, H, W).
        threshold: Probability threshold for positive classification (default 0.5).
        eps: Small constant for numerical stability.

    Returns:
        Dict containing dice, iou, precision, recall, f1_score metrics as floats.
    """
    probs = torch.sigmoid(pred_logits)
    preds = (probs >= threshold).float()
    targets_bin = (targets >= threshold).float()

    if preds.dim() == 3:
        preds = preds.unsqueeze(0)
        targets_bin = targets_bin.unsqueeze(0)
    elif preds.dim() == 2:
        preds = preds.view(1, 1, *preds.shape)
        targets_bin = targets_bin.view(1, 1, *targets_bin.shape)

    batch_size = preds.size(0)
    sample_metrics = []
    for i in range(batch_size):
        sample_metrics.append(
            _single_mask_metrics(preds[i].reshape(-1), targets_bin[i].reshape(-1), eps)
        )

    averaged = {
        "dice": float(np_mean([m["dice"] for m in sample_metrics])),
        "iou": float(np_mean([m["iou"] for m in sample_metrics])),
        "precision": float(np_mean([m["precision"] for m in sample_metrics])),
        "recall": float(np_mean([m["recall"] for m in sample_metrics])),
        "f1": float(np_mean([m["f1"] for m in sample_metrics])),
        "target_pos_pixels": float(sum(m["target_pos_pixels"] for m in sample_metrics)),
        "pred_pos_pixels": float(sum(m["pred_pos_pixels"] for m in sample_metrics)),
        "is_empty": float(sum(m["is_empty"] for m in sample_metrics) / batch_size),
    }
    return averaged


def np_mean(values):
    return sum(values) / max(len(values), 1)


def _single_mask_metrics(preds_flat: torch.Tensor, targets_flat: torch.Tensor, eps: float) -> Dict[str, float]:
    target_pos_pixels = float(targets_flat.sum().item())
    pred_pos_pixels = float(preds_flat.sum().item())

    if target_pos_pixels == 0:
        if pred_pos_pixels == 0:
            return {
                "dice": 1.0,
                "iou": 1.0,
                "precision": 1.0,
                "recall": 1.0,
                "f1": 1.0,
                "target_pos_pixels": 0.0,
                "pred_pos_pixels": 0.0,
                "is_empty": 1.0,
            }
        return {
            "dice": 0.0,
            "iou": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "target_pos_pixels": 0.0,
            "pred_pos_pixels": pred_pos_pixels,
            "is_empty": 1.0,
        }

    tp = (preds_flat * targets_flat).sum()
    fp = (preds_flat * (1.0 - targets_flat)).sum()
    fn = ((1.0 - preds_flat) * targets_flat).sum()

    precision = (tp + eps) / (tp + fp + eps)
    recall = (tp + eps) / (tp + fn + eps)
    f1_score = (2.0 * precision * recall) / (precision + recall + eps)
    iou = (tp + eps) / (tp + fp + fn + eps)
    dice = (2.0 * tp + eps) / (2.0 * tp + fp + fn + eps)

    return {
        "dice": float(dice.item()),
        "iou": float(iou.item()),
        "precision": float(precision.item()),
        "recall": float(recall.item()),
        "f1": float(f1_score.item()),
        "target_pos_pixels": target_pos_pixels,
        "pred_pos_pixels": pred_pos_pixels,
        "is_empty": 0.0,
    }
