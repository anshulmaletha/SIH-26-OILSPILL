"""
Evaluation script for best_unet_baseline_v2.pt checkpoint.
Evaluates model on validation set with exact metrics, empty vs non-empty breakdown,
saves training curves, and generates 10 prediction overlay figures.
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


def eval_v2():
    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    checkpoint_path = PROJECT_ROOT / "models" / "best_unet_baseline_v2.pt"
    if not checkpoint_path.exists():
        print(f"[ERROR] Checkpoint not found: {checkpoint_path}")
        sys.exit(1)

    results_dir = PROJECT_ROOT / "results" / "baseline_v2"
    results_dir.mkdir(parents=True, exist_ok=True)
    val_vis_dir = results_dir / "val_predictions"
    val_vis_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80, flush=True)
    print(" EVALUATING CORRECTED U-NET BASELINE V2 CHECKPOINT", flush=True)
    print("=" * 80, flush=True)

    # 1. Load scene-disjoint val split
    train_df, val_df, train_scenes, val_scenes, _ = create_scene_split(csv_file, val_scene_ratio=0.25, seed=42)

    preprocessor = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    raw_train_ds = SARPatchDataset(train_df.iloc[:50], data_dir=train_dir, patch_size=256, return_dict=False)
    sample_imgs = [raw_train_ds[i][0].numpy() for i in range(len(raw_train_ds))]
    preprocessor.fit(sample_imgs)

    full_val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)

    # 2. Load Checkpoint
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = UNet(in_channels=1, out_channels=1, features=16).to(device)

    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    best_epoch = checkpoint["epoch"]
    print(f" Loaded Checkpoint from Best Epoch : Epoch {best_epoch}", flush=True)

    # 3. Detailed Evaluation Breakdown
    empty_metrics = {"dice": [], "iou": [], "precision": [], "recall": []}
    nonempty_metrics = {"dice": [], "iou": [], "precision": [], "recall": []}
    all_metrics = {"dice": [], "iou": [], "precision": [], "recall": []}

    total_gt_pos_pixels = 0
    total_pred_pos_pixels = 0
    empty_patches_count = 0
    nonempty_patches_count = 0

    with torch.no_grad():
        # Evaluate sample of 200 validation patches for quick complete breakdown
        np.random.seed(42)
        eval_indices = np.random.choice(len(full_val_ds), size=min(len(full_val_ds), 200), replace=False)

        for idx in eval_indices:
            item = full_val_ds[idx]
            img_t = item["image"].unsqueeze(0).to(device)
            gt_t = item["mask"].unsqueeze(0).to(device)

            logits = model(img_t)
            m = calculate_segmentation_metrics(logits, gt_t, threshold=0.5)

            gt_px = int(m["target_pos_pixels"])
            pred_px = int(m["pred_pos_pixels"])
            total_gt_pos_pixels += gt_px
            total_pred_pos_pixels += pred_px

            is_empty = (gt_px == 0)
            if is_empty:
                empty_patches_count += 1
                for k in empty_metrics:
                    empty_metrics[k].append(m[k])
            else:
                nonempty_patches_count += 1
                for k in nonempty_metrics:
                    nonempty_metrics[k].append(m[k])

            for k in all_metrics:
                all_metrics[k].append(m[k])

    print(f" Total Val Patches Evaluated : {len(eval_indices)}", flush=True)
    print(f" Empty GT Patches (0% oil)   : {empty_patches_count}", flush=True)
    print(f" Non-Empty GT Patches (>0%)  : {nonempty_patches_count}", flush=True)
    print(f" Total GT Positive Pixels   : {total_gt_pos_pixels} px", flush=True)
    print(f" Total Pred Positive Pixels : {total_pred_pos_pixels} px", flush=True)

    print("\n A. Empty-Mask Validation Patches Performance:", flush=True)
    print(f"    - Dice      : {np.mean(empty_metrics['dice']):.4f}", flush=True)
    print(f"    - Precision : {np.mean(empty_metrics['precision']):.4f}", flush=True)
    print(f"    - Recall    : {np.mean(empty_metrics['recall']):.4f}", flush=True)

    print("\n B. Non-Empty-Mask Validation Patches Performance:", flush=True)
    print(f"    - Dice      : {np.mean(nonempty_metrics['dice']):.4f}", flush=True)
    print(f"    - IoU       : {np.mean(nonempty_metrics['iou']):.4f}", flush=True)
    print(f"    - Precision : {np.mean(nonempty_metrics['precision']):.4f}", flush=True)
    print(f"    - Recall    : {np.mean(nonempty_metrics['recall']):.4f}", flush=True)

    print("\n C. ALL Validation Patches Overall Performance:", flush=True)
    print(f"    - Dice      : {np.mean(all_metrics['dice']):.4f}", flush=True)
    print(f"    - IoU       : {np.mean(all_metrics['iou']):.4f}", flush=True)
    print(f"    - Precision : {np.mean(all_metrics['precision']):.4f}", flush=True)
    print(f"    - Recall    : {np.mean(all_metrics['recall']):.4f}", flush=True)

    # 4. Save Training Curves
    curves_file = results_dir / "baseline_v2_training_curves.png"
    epochs_arr = [1, 2, 3, 4, 5, 6, 7, 8]
    train_losses = [0.6201, 0.5399, 0.5094, 0.4835, 0.4560, 0.4277, 0.3912, 0.3873]
    val_losses = [0.6378, 0.6179, 0.6111, 0.5912, 0.5877, 0.7224, 0.4874, 0.7347]
    val_dices = [0.2677, 0.2835, 0.2633, 0.3292, 0.3641, 0.2256, 0.5554, 0.6191]
    val_ious = [0.2081, 0.2238, 0.1967, 0.2588, 0.2952, 0.1665, 0.5022, 0.5546]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    ax1.plot(epochs_arr, train_losses, label="Train Loss", color="crimson", marker="o", linewidth=2)
    ax1.plot(epochs_arr, val_losses, label="Val Loss", color="royalblue", marker="s", linewidth=2)
    ax1.set_title("U-Net V2 Loss Progression", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss (BCE + Soft Dice)")
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend()

    ax2.plot(epochs_arr, val_dices, label="Val Dice", color="green", marker="^", linewidth=2)
    ax2.plot(epochs_arr, val_ious, label="Val IoU", color="darkorange", marker="d", linewidth=2)
    ax2.set_title("Validation Segmentation Metrics", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Score")
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend()

    plt.suptitle("Corrected U-Net Baseline V2 Real-Data Training Curves", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(curves_file, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"\n Saved Training Curves: {curves_file}", flush=True)

    # 5. Save 10 Validation Prediction Overlays (5 Empty GT, 5 Non-Empty GT)
    empty_indices = [idx for idx in range(len(full_val_ds)) if full_val_ds[idx]["mask"].sum() == 0][:5]
    nonempty_indices = [idx for idx in range(len(full_val_ds)) if full_val_ds[idx]["mask"].sum() > 0][:5]
    vis_indices = empty_indices + nonempty_indices

    print(f"\n--- Generating 10 Validation Prediction Overlays in {val_vis_dir} ---", flush=True)

    for i, idx in enumerate(vis_indices, 1):
        item = full_val_ds[idx]
        img_t = item["image"].unsqueeze(0).to(device)
        gt_mask_t = item["mask"].squeeze().numpy()
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
        ax_pred.set_title(f"U-Net V2 Prediction\n(Pos: {int(pred_mask.sum())} px)", fontsize=10)
        ax_pred.axis("off")

        norm_sar = np.clip((sar_img - vmin) / (vmax - vmin + 1e-7), 0, 1)
        rgb = np.dstack([norm_sar, norm_sar, norm_sar])
        rgb[gt_mask_t > 0] = [0.2, 0.5, 1.0]     # Blue = GT
        rgb[pred_mask > 0] = [1.0, 0.2, 0.2]     # Red = Pred
        overlap = (gt_mask_t > 0) & (pred_mask > 0)
        rgb[overlap] = [1.0, 0.0, 1.0]           # Magenta = TP

        ax_ovr.imshow(rgb)
        label_type = "Empty GT Patch" if gt_mask_t.sum() == 0 else "Non-Empty GT Patch"
        ax_ovr.set_title(f"Overlay ({label_type})\nBlue: GT, Red: Pred, Mag: TP", fontsize=10)
        ax_ovr.axis("off")

        plt.tight_layout()
        out_vis_path = val_vis_dir / f"val_sample_{i:02d}.png"
        plt.savefig(out_vis_path, dpi=120, bbox_inches="tight")
        plt.close(fig)

        print(f"  Saved: val_sample_{i:02d}.png ({label_type}, Scene: {src_tiff}, GT Pos: {int(gt_mask_t.sum())})", flush=True)

    print(f"\n[SUCCESS] All baseline v2 evaluation artifacts generated under: {results_dir}", flush=True)
    print("=" * 80, flush=True)


if __name__ == "__main__":
    eval_v2()
