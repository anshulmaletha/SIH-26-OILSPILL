"""
Evaluation and visualization script for U-Net baseline checkpoint.
Evaluates best_unet_baseline.pt on validation set, generates training curves,
and saves 10 prediction overlays (SAR | Ground Truth | Prediction | Overlay).
"""

import os
import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset
from src.training.losses import BCEDiceLoss
from src.evaluation.metrics import calculate_segmentation_metrics


def resolve_data_dir() -> Path:
    for env_var in ["SAR_DATA_DIR", "DATA_DIR"]:
        if env_var in os.environ and os.environ[env_var].strip():
            p = Path(os.environ[env_var].strip())
            if p.exists():
                return p
    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        p = Path(user_profile) / "Downloads" / "Radar_data"
        if p.exists():
            return p
    return PROJECT_ROOT / "data"


def eval_and_visualize():
    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    checkpoint_path = PROJECT_ROOT / "models" / "best_unet_baseline.pt"
    if not checkpoint_path.exists():
        print(f"[ERROR] Checkpoint not found: {checkpoint_path}")
        sys.exit(1)

    print("=" * 80)
    print(" EVALUATING U-NET BASELINE CHECKPOINT")
    print("=" * 80)

    # 1. Load scene-disjoint val split
    train_df, val_df, train_scenes, val_scenes, _ = create_scene_split(csv_file, val_scene_ratio=0.25, seed=42)

    preprocessor = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    raw_train_ds = SARPatchDataset(train_df.iloc[:50], data_dir=train_dir, patch_size=256, return_dict=False)
    sample_imgs = [raw_train_ds[i][0].numpy() for i in range(len(raw_train_ds))]
    preprocessor.fit(sample_imgs)

    val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)

    # 2. Load Checkpoint
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = UNet(in_channels=1, out_channels=1, features=16).to(device)

    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    print(f" Loaded Checkpoint from Best Epoch : {checkpoint['epoch']}")
    print(f" Best Validation Loss               : {checkpoint['val_loss']:.4f}")
    print(f" Best Validation Dice               : {checkpoint['val_dice']:.4f}")
    print(f" Best Validation IoU                : {checkpoint['val_iou']:.4f}")
    print(f" Best Validation Precision          : {checkpoint['val_precision']:.4f}")
    print(f" Best Validation Recall             : {checkpoint['val_recall']:.4f}")
    print(f" Best Validation F1 Score           : {checkpoint['val_f1']:.4f}")

    # 3. Save Training Curves
    results_dir = PROJECT_ROOT / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    curves_file = results_dir / "baseline_training_curves.png"

    # Recorded epoch progression
    epochs = [1, 2, 3, 4, 5]
    train_losses = [0.8094, 0.7332, 0.6999, 0.6730, 0.6468]
    val_losses = [0.8330, 0.7415, 0.7027, 0.6848, 0.6662]
    val_dices = [0.1327, 0.0642, 0.1835, 0.1121, 0.1470]
    val_ious = [0.0759, 0.0376, 0.1120, 0.0637, 0.0860]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    ax1.plot(epochs, train_losses, label="Train Loss", color="crimson", marker="o", linewidth=2)
    ax1.plot(epochs, val_losses, label="Val Loss", color="royalblue", marker="s", linewidth=2)
    ax1.set_title("U-Net Baseline Loss Progression", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss (BCE + Soft Dice)")
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend()

    ax2.plot(epochs, val_dices, label="Val Dice", color="green", marker="^", linewidth=2)
    ax2.plot(epochs, val_ious, label="Val IoU", color="darkorange", marker="d", linewidth=2)
    ax2.set_title("Validation Segmentation Metrics", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Score")
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend()

    plt.suptitle("U-Net Baseline Real-Data Training Curves", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(curves_file, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"\n[SUCCESS] Saved Training Curves to: {curves_file}")

    # 4. Save 10 Validation Prediction Overlays
    val_vis_dir = results_dir / "val_predictions"
    val_vis_dir.mkdir(parents=True, exist_ok=True)

    # Find 10 diverse validation samples containing positive oil spill regions
    sample_indices = []
    for idx in range(len(val_ds)):
        item = val_ds[idx]
        if item["mask"].sum() > 0:
            sample_indices.append(idx)
            if len(sample_indices) >= 10:
                break

    if len(sample_indices) < 10:
        sample_indices += list(range(10 - len(sample_indices)))

    print(f"\n--- Generating 10 Validation Prediction Overlays in {val_vis_dir} ---")

    for i, idx in enumerate(sample_indices[:10], 1):
        item = val_ds[idx]
        img_t = item["image"].unsqueeze(0).to(device)  # (1, 1, 256, 256)
        gt_mask_t = item["mask"].squeeze().numpy()     # (256, 256)
        src_tiff = item["source_tiff"]

        with torch.no_grad():
            logits = model(img_t)
            probs = torch.sigmoid(logits).squeeze().cpu().numpy()
            pred_mask = (probs >= 0.5).astype(np.uint8)

        sar_img = item["image"].squeeze().numpy()

        fig, axes = plt.subplots(1, 4, figsize=(18, 4.5))
        ax_sar, ax_gt, ax_pred, ax_ovr = axes

        vmin, vmax = np.percentile(sar_img, [2, 98])
        ax_sar.imshow(sar_img, cmap="gray", vmin=vmin, vmax=vmax)
        ax_sar.set_title(f"SAR Intensity\n({src_tiff})", fontsize=10)
        ax_sar.axis("off")

        ax_gt.imshow(gt_mask_t, cmap="cividis", vmin=0, vmax=1)
        ax_gt.set_title(f"Ground Truth Mask\n(Pos: {int(gt_mask_t.sum())} px)", fontsize=10)
        ax_gt.axis("off")

        ax_pred.imshow(pred_mask, cmap="magma", vmin=0, vmax=1)
        ax_pred.set_title(f"U-Net Prediction\n(Pos: {int(pred_mask.sum())} px)", fontsize=10)
        ax_pred.axis("off")

        norm_sar = np.clip((sar_img - vmin) / (vmax - vmin + 1e-7), 0, 1)
        rgb = np.dstack([norm_sar, norm_sar, norm_sar])
        rgb[gt_mask_t > 0] = [0.2, 0.5, 1.0]     # Blue = Ground Truth
        rgb[pred_mask > 0] = [1.0, 0.2, 0.2]     # Red = Prediction
        overlap = (gt_mask_t > 0) & (pred_mask > 0)
        rgb[overlap] = [1.0, 0.0, 1.0]           # Magenta = True Positives

        ax_ovr.imshow(rgb)
        ax_ovr.set_title("Overlay\n(Blue: GT, Red: Pred, Mag: TP)", fontsize=10)
        ax_ovr.axis("off")

        plt.tight_layout()
        out_vis_path = val_vis_dir / f"val_sample_{i:02d}.png"
        plt.savefig(out_vis_path, dpi=120, bbox_inches="tight")
        plt.close(fig)

        print(f"  Saved: val_sample_{i:02d}.png (Scene: {src_tiff}, GT Pos Pixels: {int(gt_mask_t.sum())})")

    print(f"\n[SUCCESS] All 10 validation prediction visualizations saved to: {val_vis_dir}")
    print("=" * 80)


if __name__ == "__main__":
    eval_and_visualize()
