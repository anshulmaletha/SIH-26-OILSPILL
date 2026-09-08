"""
Training and Validation pipeline for U-Net Sentinel-1 SAR Oil Spill Segmentation.
Implements training loop, validation, optimizer, LR scheduler, checkpointing, and early stopping.
"""

from pathlib import Path
from typing import Dict, Any, Optional, Tuple, Union

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau

from src.training.losses import BCEDiceLoss
from src.evaluation.metrics import calculate_segmentation_metrics
from src.config import MODELS_DIR


class EarlyStopping:
    """
    Early stopping handler to stop training when validation loss stops improving.
    """

    def __init__(self, patience: int = 7, min_delta: float = 1e-4, mode: str = "min"):
        self.patience = patience
        self.min_delta = min_delta
        self.mode = mode
        self.counter = 0
        self.best_score: Optional[float] = None
        self.early_stop = False

    def __call__(self, val_score: float) -> bool:
        score = -val_score if self.mode == "min" else val_score

        if self.best_score is None:
            self.best_score = score
            return True
        elif score < self.best_score + self.min_delta:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True
            return False
        else:
            self.best_score = score
            self.counter = 0
            return True


def train_one_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device
) -> Dict[str, float]:
    """Run single training epoch."""
    model.train()
    total_loss = 0.0
    total_samples = 0

    for batch in dataloader:
        if isinstance(batch, (tuple, list)):
            images, masks = batch
        elif isinstance(batch, dict):
            images, masks = batch["image"], batch["mask"]
        else:
            raise TypeError("Unsupported dataloader batch format.")

        images = images.to(device)
        masks = masks.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, masks)

        loss.backward()
        optimizer.step()

        batch_size = images.size(0)
        total_loss += loss.item() * batch_size
        total_samples += batch_size

    avg_loss = total_loss / max(total_samples, 1)
    return {"loss": avg_loss}


def validate_one_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: torch.device
) -> Dict[str, float]:
    """Run validation loop and calculate loss and metrics."""
    model.eval()
    total_loss = 0.0
    total_samples = 0

    accumulated_metrics = {"dice": 0.0, "iou": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}

    with torch.no_grad():
        for batch in dataloader:
            if isinstance(batch, (tuple, list)):
                images, masks = batch
            elif isinstance(batch, dict):
                images, masks = batch["image"], batch["mask"]
            else:
                raise TypeError("Unsupported dataloader batch format.")

            images = images.to(device)
            masks = masks.to(device)

            outputs = model(images)
            loss = criterion(outputs, masks)

            batch_size = images.size(0)
            total_loss += loss.item() * batch_size
            total_samples += batch_size

            # Compute batch metrics
            batch_metrics = calculate_segmentation_metrics(outputs, masks)
            for k in accumulated_metrics:
                accumulated_metrics[k] += batch_metrics[k] * batch_size

    avg_loss = total_loss / max(total_samples, 1)
    avg_metrics = {f"val_{k}": v / max(total_samples, 1) for k, v in accumulated_metrics.items()}
    avg_metrics["val_loss"] = avg_loss

    return avg_metrics


def train_model(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    num_epochs: int = 10,
    lr: float = 1e-3,
    weight_decay: float = 1e-4,
    checkpoint_dir: Union[str, Path] = MODELS_DIR,
    device: Optional[torch.device] = None
) -> Dict[str, Any]:
    """
    Complete model training pipeline runner.
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = model.to(device)
    criterion = BCEDiceLoss(bce_weight=0.5, dice_weight=0.5)
    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    scheduler = ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=3)
    early_stopping = EarlyStopping(patience=7, mode="min")

    checkpoint_path = Path(checkpoint_dir)
    checkpoint_path.mkdir(parents=True, exist_ok=True)
    best_model_file = checkpoint_path / "best_unet_model.pt"

    history = {"train_loss": [], "val_loss": [], "val_dice": [], "val_iou": []}

    for epoch in range(1, num_epochs + 1):
        train_stats = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_stats = validate_one_epoch(model, val_loader, criterion, device)

        scheduler.step(val_stats["val_loss"])

        history["train_loss"].append(train_stats["loss"])
        history["val_loss"].append(val_stats["val_loss"])
        history["val_dice"].append(val_stats["val_dice"])
        history["val_iou"].append(val_stats["val_iou"])

        # Checkpointing
        is_best = early_stopping(val_stats["val_loss"])
        if is_best:
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": val_stats["val_loss"],
                "val_dice": val_stats["val_dice"]
            }, best_model_file)

        if early_stopping.early_stop:
            print(f"Early stopping triggered at epoch {epoch}")
            break

    return history
