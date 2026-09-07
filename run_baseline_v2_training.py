"""
Baseline V2 Training Runner with Corrected Mask-Based Sampler and Robust Loss (Fast CPU Version).
Model: U-Net (in_channels=1, out_channels=1)
Target: mask_crop > 0 (Positivity determined strictly from actual ground-truth mask crops).
Saved Checkpoint: models/best_unet_baseline_v2.pt
Results Folder: results/baseline_v2/
"""

import os
import sys
import random
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tifffile
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset
from src.training.losses import BCEDiceLoss
from src.evaluation.metrics import calculate_segmentation_metrics


def set_seed(seed: int = 42):
    """Set reproducible seeds across all libraries."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


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


def run_baseline_v2():
    set_seed(42)

    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    results_dir = PROJECT_ROOT / "results" / "baseline_v2"
    results_dir.mkdir(parents=True, exist_ok=True)
    val_vis_dir = results_dir / "val_predictions"
    val_vis_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 95, flush=True)
    print(" CORRECTED U-NET BASELINE V2 TRAINING RUNNER", flush=True)
    print("=" * 95, flush=True)

    if not csv_file.exists():
        print(f"[ERROR] CSV file not found: {csv_file}", flush=True)
        sys.exit(1)

    # 1. Create Scene-Disjoint Split (Zero Scene Overlap)
    train_df, val_df, train_scenes, val_scenes, is_overlap_zero = create_scene_split(
        csv_file_or_df=csv_file,
        val_scene_ratio=0.25,
        seed=42
    )

    print(f" Train Scenes ({len(train_scenes)}) : {train_scenes}", flush=True)
    print(f" Val Scenes   ({len(val_scenes)})   : {val_scenes}", flush=True)
    print(f" Scene Overlap Is Zero: {is_overlap_zero}", flush=True)

    # 2. Fit Preprocessor strictly on training data
    preprocessor = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    raw_train_ds = SARPatchDataset(train_df.iloc[:50], data_dir=train_dir, patch_size=256, return_dict=False)
    sample_imgs = [raw_train_ds[i][0].numpy() for i in range(len(raw_train_ds))]
    preprocessor.fit(sample_imgs)

    full_train_ds = SARPatchDataset(train_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=False)
    full_val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)

    # 3. PRE-TRAINING SAMPLER CHECK (Determining positivity from actual mask crops)
    print("\n" + "=" * 80, flush=True)
    print(" PRE-TRAINING SAMPLER CHECK (CORRECTED MASK-BASED SAMPLING)", flush=True)
    print("=" * 80, flush=True)

    mask_cache = {}
    for mf in (train_dir / "masks").glob("*.tif"):
        try:
            arr = tifffile.imread(str(mf))
            mask_cache[mf.name] = (np.squeeze(arr) > 0).astype(np.uint8)
        except Exception:
            pass

    actual_pos_indices = []
    actual_neg_indices = []

    for idx, row in train_df.iterrows():
        tiff_name = Path(str(row["paths"]).replace("\\", "/")).name
        coords_str = str(row["coordinates"])
        r, c = map(int, coords_str.split(","))

        mask_scene = mask_cache.get(tiff_name)
        if mask_scene is not None:
            crop = mask_scene[r:r+256, c:c+256]
            if crop.sum() > 0:
                actual_pos_indices.append(idx)
            else:
                actual_neg_indices.append(idx)

    total_train_patches = len(train_df)
    actual_pos_count = len(actual_pos_indices)
    actual_neg_count = len(actual_neg_indices)

    # Fast Balanced Sampling: 150 positive mask patches + 150 negative mask patches
    np.random.seed(42)
    sample_pos = np.random.choice(actual_pos_indices, size=min(actual_pos_count, 150), replace=False)
    sample_neg = np.random.choice(actual_neg_indices, size=min(actual_neg_count, 150), replace=False)
    balanced_indices = np.concatenate([sample_pos, sample_neg])
    np.random.shuffle(balanced_indices)

    selected_pos_count = len(sample_pos)
    selected_neg_count = len(sample_neg)
    ratio_str = f"{selected_pos_count}:{selected_neg_count} (1.00:1.00)"

    print(f" Total Training Patches          : {total_train_patches}", flush=True)
    print(f" Actual Positive-Mask Patches    : {actual_pos_count} ({actual_pos_count/total_train_patches*100:.2f}%)", flush=True)
    print(f" Actual Empty-Mask Patches       : {actual_neg_count} ({actual_neg_count/total_train_patches*100:.2f}%)", flush=True)
    print(f" Number Selected as Positive     : {selected_pos_count}", flush=True)
    print(f" Number Selected as Negative     : {selected_neg_count}", flush=True)
    print(f" Positive/Negative Sampling Ratio: {ratio_str}", flush=True)

    verified_pos = 0
    for idx in sample_pos[:20]:
        item = full_train_ds[idx]
        if item[1].sum() > 0:
            verified_pos += 1

    print(f" Verified Sample Positives (>0 px): {verified_pos} / 20 (100% Verified Positive Masks)", flush=True)
    assert verified_pos == 20, "Selected positive patches must contain positive mask pixels"
    print("=" * 80, flush=True)

    # 4. Create Active Training and Validation Subsets
    train_ds = Subset(full_train_ds, balanced_indices)

    # Validation subset: 50 positive mask patches + 50 empty mask patches
    val_pos_indices = []
    val_neg_indices = []
    for idx, row in val_df.iterrows():
        tiff_name = Path(str(row["paths"]).replace("\\", "/")).name
        coords_str = str(row["coordinates"])
        r, c = map(int, coords_str.split(","))

        mask_scene = mask_cache.get(tiff_name)
        if mask_scene is not None:
            crop = mask_scene[r:r+256, c:c+256]
            if crop.sum() > 0:
                val_pos_indices.append(idx)
            else:
                val_neg_indices.append(idx)

    val_sample_pos = np.random.choice(val_pos_indices, size=min(len(val_pos_indices), 50), replace=False)
    val_sample_neg = np.random.choice(val_neg_indices, size=min(len(val_neg_indices), 50), replace=False)
    val_eval_indices = np.concatenate([val_sample_pos, val_sample_neg])
    np.random.shuffle(val_eval_indices)

    val_ds = Subset(full_val_ds, val_eval_indices)

    train_loader = DataLoader(train_ds, batch_size=16, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=16, shuffle=False, num_workers=0)

    # 5. Model, Loss, and Optimizer
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f" Training Compute Device: {device}", flush=True)

    model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    criterion = BCEDiceLoss(bce_weight=0.5, dice_weight=0.5)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=2)

    checkpoint_path = PROJECT_ROOT / "models" / "best_unet_baseline_v2.pt"
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    history = {
        "epoch": [], "train_loss": [], "val_loss": [],
        "val_Dice": [], "val_IoU": [], "val_precision": [],
        "val_recall": [], "val_F1": []
    }

    best_val_dice = -1.0
    best_epoch = 0
    patience = 5
    patience_counter = 0
    max_epochs = 10

    print("\n" + "=" * 95, flush=True)
    print(f" {'Epoch':<6} | {'Train Loss':<10} | {'Val Loss':<10} | {'Val Dice':<10} | {'Val IoU':<10} | {'Precision':<10} | {'Recall':<10} | {'F1 Score':<10}", flush=True)
    print("=" * 95, flush=True)

    for epoch in range(1, max_epochs + 1):
        # Training loop
        model.train()
        train_loss_sum = 0.0
        train_samples = 0

        for images, masks in train_loader:
            images = images.to(device)
            masks = masks.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)

            loss.backward()
            optimizer.step()

            bs = images.size(0)
            train_loss_sum += loss.item() * bs
            train_samples += bs

        avg_train_loss = train_loss_sum / max(train_samples, 1)

        # Validation loop
        model.eval()
        val_loss_sum = 0.0
        val_samples = 0
        metrics_acc = {"dice": 0.0, "iou": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}

        with torch.no_grad():
            for item in val_loader:
                if isinstance(item, dict):
                    images, masks = item["image"], item["mask"]
                else:
                    images, masks = item

                images = images.to(device)
                masks = masks.to(device)

                outputs = model(images)
                loss = criterion(outputs, masks)

                bs = images.size(0)
                val_loss_sum += loss.item() * bs
                val_samples += bs

                for i in range(bs):
                    single_m = calculate_segmentation_metrics(outputs[i:i+1], masks[i:i+1], threshold=0.5)
                    for k in metrics_acc:
                        metrics_acc[k] += single_m[k]

        avg_val_loss = val_loss_sum / max(val_samples, 1)
        avg_val_dice = metrics_acc["dice"] / max(val_samples, 1)
        avg_val_iou = metrics_acc["iou"] / max(val_samples, 1)
        avg_val_prec = metrics_acc["precision"] / max(val_samples, 1)
        avg_val_rec = metrics_acc["recall"] / max(val_samples, 1)
        avg_val_f1 = metrics_acc["f1"] / max(val_samples, 1)

        scheduler.step(avg_val_dice)

        history["epoch"].append(epoch)
        history["train_loss"].append(avg_train_loss)
        history["val_loss"].append(avg_val_loss)
        history["val_Dice"].append(avg_val_dice)
        history["val_IoU"].append(avg_val_iou)
        history["val_precision"].append(avg_val_prec)
        history["val_recall"].append(avg_val_rec)
        history["val_F1"].append(avg_val_f1)

        print(f" {epoch:<6d} | {avg_train_loss:<10.4f} | {avg_val_loss:<10.4f} | {avg_val_dice:<10.4f} | {avg_val_iou:<10.4f} | {avg_val_prec:<10.4f} | {avg_val_rec:<10.4f} | {avg_val_f1:<10.4f}", flush=True)

        if avg_val_dice >= best_val_dice:
            best_val_dice = avg_val_dice
            best_epoch = epoch
            patience_counter = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_dice": avg_val_dice,
                "val_iou": avg_val_iou,
                "val_loss": avg_val_loss,
                "val_precision": avg_val_prec,
                "val_recall": avg_val_rec,
                "val_f1": avg_val_f1
            }, checkpoint_path)
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\n Early stopping triggered at epoch {epoch}.", flush=True)
                break

    print("=" * 95, flush=True)

    # 6. Detailed Evaluation of Best Checkpoint
    print("\n--- DETAILED BEST CHECKPOINT EVALUATION (CORRECTED METRICS) ---", flush=True)
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    empty_metrics = {"dice": [], "iou": [], "precision": [], "recall": []}
    nonempty_metrics = {"dice": [], "iou": [], "precision": [], "recall": []}
    all_metrics = {"dice": [], "iou": [], "precision": [], "recall": []}

    total_gt_pos_pixels = 0
    total_pred_pos_pixels = 0
    empty_patches_count = 0
    nonempty_patches_count = 0

    with torch.no_grad():
        for idx in val_eval_indices:
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

    print(f" Best Epoch Loaded          : Epoch {checkpoint['epoch']}", flush=True)
    print(f" Total Val Patches Evaluated : {len(val_eval_indices)}", flush=True)
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

    # 7. Save Training Curves to results/baseline_v2/
    curves_file = results_dir / "baseline_v2_training_curves.png"
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    epochs_arr = history["epoch"]

    ax1.plot(epochs_arr, history["train_loss"], label="Train Loss", color="crimson", marker="o")
    ax1.plot(epochs_arr, history["val_loss"], label="Val Loss", color="royalblue", marker="s")
    ax1.set_title("U-Net V2 Loss Progression", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend()

    ax2.plot(epochs_arr, history["val_Dice"], label="Val Dice", color="green", marker="^")
    ax2.plot(epochs_arr, history["val_IoU"], label="Val IoU", color="darkorange", marker="d")
    ax2.set_title("Validation Segmentation Metrics", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Score")
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend()

    plt.suptitle("Corrected U-Net Baseline V2 Training Curves", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(curves_file, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"\n Saved Training Curves: {curves_file}", flush=True)

    # 8. Save 10 Validation Prediction Overlays (including BOTH empty and non-empty GT patches)
    print(f"\n--- Generating 10 Validation Prediction Overlays in {val_vis_dir} ---", flush=True)
    
    empty_indices = [idx for idx in val_eval_indices if full_val_ds[idx]["mask"].sum() == 0][:5]
    nonempty_indices = [idx for idx in val_eval_indices if full_val_ds[idx]["mask"].sum() > 0][:5]
    vis_indices = empty_indices + nonempty_indices

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

    print(f"\n[SUCCESS] All artifacts saved under {results_dir}", flush=True)
    print("=" * 95, flush=True)


if __name__ == "__main__":
    run_baseline_v2()
