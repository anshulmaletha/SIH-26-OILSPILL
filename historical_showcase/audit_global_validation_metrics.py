"""
Audit script to calculate GLOBAL pixel-level totals (TP, FP, FN, TN, GT pos, Pred pos)
and Global Dice, IoU, Precision, Recall across all 8,147 validation patches.
Compares Raw U-Net (threshold 0.5) vs Conservative Post-processing.
"""

import os
import sys
import numpy as np
import torch
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset
from src.postprocessing.mask_enhancer import ConservativeMaskEnhancer


def compute_global_metrics(tp: int, fp: int, fn: int, tn: int):
    """Compute global pixel-level metrics from summed confusion matrix counts."""
    total_gt_pos = tp + fn
    total_pred_pos = tp + fp
    total_pixels = tp + fp + fn + tn

    dice = (2.0 * tp) / (2.0 * tp + fp + fn + 1e-7)
    iou = tp / (tp + fp + fn + 1e-7)
    precision = tp / (tp + fp + 1e-7) if (tp + fp) > 0 else 1.0
    recall = tp / (tp + fn + 1e-7) if (tp + fn) > 0 else 1.0

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "gt_pos": total_gt_pos,
        "pred_pos": total_pred_pos,
        "dice": float(dice),
        "iou": float(iou),
        "precision": float(precision),
        "recall": float(recall)
    }


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


def main():
    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    checkpoint_path = PROJECT_ROOT / "models" / "best_unet_baseline.pt"
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    train_df, val_df, train_scenes, val_scenes, _ = create_scene_split(csv_file, val_scene_ratio=0.25, seed=42)
    preprocessor = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    raw_train_ds = SARPatchDataset(train_df.iloc[:50], data_dir=train_dir, patch_size=256, return_dict=False)
    preprocessor.fit([raw_train_ds[i][0].numpy() for i in range(len(raw_train_ds))])

    val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)
    total_val_patches = len(val_ds)

    enhancer = ConservativeMaskEnhancer(
        high_threshold=0.5,
        low_threshold=0.35,
        min_noise_area_pixels=15,
        morph_kernel_size=3
    )

    # Pixel accumulators for Raw vs Post
    # Overall
    raw_tp_all, raw_fp_all, raw_fn_all, raw_tn_all = 0, 0, 0, 0
    post_tp_all, post_fp_all, post_fn_all, post_tn_all = 0, 0, 0, 0

    # Non-Empty
    raw_tp_ne, raw_fp_ne, raw_fn_ne, raw_tn_ne = 0, 0, 0, 0
    post_tp_ne, post_fp_ne, post_fn_ne, post_tn_ne = 0, 0, 0, 0

    # Empty
    raw_tp_e, raw_fp_e, raw_fn_e, raw_tn_e = 0, 0, 0, 0
    post_tp_e, post_fp_e, post_fn_e, post_tn_e = 0, 0, 0, 0

    empty_count = 0
    nonempty_count = 0

    with torch.no_grad():
        for idx in range(total_val_patches):
            item = val_ds[idx]
            img_t = item["image"].unsqueeze(0).to(device)
            gt_b = (item["mask"].squeeze().numpy() > 0)

            logits = model(img_t)
            prob_map = torch.sigmoid(logits).squeeze().cpu().numpy()
            raw_b = (prob_map >= 0.5)

            post_b = (enhancer.process(prob_map, raw_b.astype(np.uint8)) > 0)

            # Raw confusion matrix
            tp_r = int(np.sum(raw_b & gt_b))
            fp_r = int(np.sum(raw_b & ~gt_b))
            fn_r = int(np.sum(~raw_b & gt_b))
            tn_r = int(np.sum(~raw_b & ~gt_b))

            # Post confusion matrix
            tp_p = int(np.sum(post_b & gt_b))
            fp_p = int(np.sum(post_b & ~gt_b))
            fn_p = int(np.sum(~post_b & gt_b))
            tn_p = int(np.sum(~post_b & ~gt_b))

            # Accumulate overall
            raw_tp_all += tp_r; raw_fp_all += fp_r; raw_fn_all += fn_r; raw_tn_all += tn_r
            post_tp_all += tp_p; post_fp_all += fp_p; post_fn_all += fn_p; post_tn_all += tn_p

            is_empty = (np.sum(gt_b) == 0)
            if is_empty:
                empty_count += 1
                raw_tp_e += tp_r; raw_fp_e += fp_r; raw_fn_e += fn_r; raw_tn_e += tn_r
                post_tp_e += tp_p; post_fp_e += fp_p; post_fn_e += fn_p; post_tn_e += tn_p
            else:
                nonempty_count += 1
                raw_tp_ne += tp_r; raw_fp_ne += fp_r; raw_fn_ne += fn_r; raw_tn_ne += tn_r
                post_tp_ne += tp_p; post_fp_ne += fp_p; post_fn_ne += fn_p; post_tn_ne += tn_p

    # Compute Global Summaries
    raw_m_all = compute_global_metrics(raw_tp_all, raw_fp_all, raw_fn_all, raw_tn_all)
    post_m_all = compute_global_metrics(post_tp_all, post_fp_all, post_fn_all, post_tn_all)

    raw_m_ne = compute_global_metrics(raw_tp_ne, raw_fp_ne, raw_fn_ne, raw_tn_ne)
    post_m_ne = compute_global_metrics(post_tp_ne, post_fp_ne, post_fn_ne, post_tn_ne)

    raw_m_e = compute_global_metrics(raw_tp_e, raw_fp_e, raw_fn_e, raw_tn_e)
    post_m_e = compute_global_metrics(post_tp_e, post_fp_e, post_fn_e, post_tn_e)

    print("=" * 85)
    print(" GLOBAL PIXEL-LEVEL AUDIT REPORT (8,147 VALIDATION PATCHES)")
    print("=" * 85)
    print(f" Total Patches Evaluated: {total_val_patches} (Empty: {empty_count}, Non-Empty: {nonempty_count})")
    print(f" Total Image Pixels     : {total_val_patches * 256 * 256:,} px")
    print(f" Total Ground Truth Pos : {raw_m_all['gt_pos']:,} px ({raw_m_all['gt_pos']*0.0001:.2f} km²)")

    print("\n" + "-" * 85)
    print(" 1. GLOBAL TOTALS: NON-EMPTY GT PATCHES (1,414 Patches)")
    print(" " + "-" * 85)
    print(f"   Metric / Count        | Raw U-Net (0.5)     | Post-Processed      | Delta")
    print(f"   ----------------------+---------------------+---------------------+--------")
    print(f"   True Positives (TP)   | {raw_m_ne['tp']:19,d} | {post_m_ne['tp']:19,d} | +{post_m_ne['tp']-raw_m_ne['tp']:,d} px")
    print(f"   False Positives (FP)  | {raw_m_ne['fp']:19,d} | {post_m_ne['fp']:19,d} | +{post_m_ne['fp']-raw_m_ne['fp']:,d} px")
    print(f"   False Negatives (FN)  | {raw_m_ne['fn']:19,d} | {post_m_ne['fn']:19,d} | -{raw_m_ne['fn']-post_m_ne['fn']:,d} px")
    print(f"   True Negatives (TN)   | {raw_m_ne['tn']:19,d} | {post_m_ne['tn']:19,d} | -{raw_m_ne['tn']-post_m_ne['tn']:,d} px")
    print(f"   Total GT Positive     | {raw_m_ne['gt_pos']:19,d} | {post_m_ne['gt_pos']:19,d} | 0 px")
    print(f"   Total Pred Positive   | {raw_m_ne['pred_pos']:19,d} | {post_m_ne['pred_pos']:19,d} | +{post_m_ne['pred_pos']-raw_m_ne['pred_pos']:,d} px")
    print(f"   ----------------------+---------------------+---------------------+--------")
    print(f"   Global Dice           | {raw_m_ne['dice']:19.4f} | {post_m_ne['dice']:19.4f} | {post_m_ne['dice']-raw_m_ne['dice']:+.4f}")
    print(f"   Global IoU            | {raw_m_ne['iou']:19.4f} | {post_m_ne['iou']:19.4f} | {post_m_ne['iou']-raw_m_ne['iou']:+.4f}")
    print(f"   Global Precision      | {raw_m_ne['precision']:19.4f} | {post_m_ne['precision']:19.4f} | {post_m_ne['precision']-raw_m_ne['precision']:+.4f}")
    print(f"   Global Recall         | {raw_m_ne['recall']:19.4f} | {post_m_ne['recall']:19.4f} | {post_m_ne['recall']-raw_m_ne['recall']:+.4f}")

    print("\n" + "-" * 85)
    print(" 2. GLOBAL TOTALS: EMPTY GT PATCHES (6,733 Patches)")
    print(" " + "-" * 85)
    print(f"   Metric / Count        | Raw U-Net (0.5)     | Post-Processed      | Delta")
    print(f"   ----------------------+---------------------+---------------------+--------")
    print(f"   True Positives (TP)   | {raw_m_e['tp']:19,d} | {post_m_e['tp']:19,d} | 0 px")
    print(f"   False Positives (FP)  | {raw_m_e['fp']:19,d} | {post_m_e['fp']:19,d} | +{post_m_e['fp']-raw_m_e['fp']:,d} px")
    print(f"   False Negatives (FN)  | {raw_m_e['fn']:19,d} | {post_m_e['fn']:19,d} | 0 px")
    print(f"   True Negatives (TN)   | {raw_m_e['tn']:19,d} | {post_m_e['tn']:19,d} | -{raw_m_e['tn']-post_m_e['tn']:,d} px")
    print(f"   Total GT Positive     | {raw_m_e['gt_pos']:19,d} | {post_m_e['gt_pos']:19,d} | 0 px")
    print(f"   Total Pred Positive   | {raw_m_e['pred_pos']:19,d} | {post_m_e['pred_pos']:19,d} | +{post_m_e['pred_pos']-raw_m_e['pred_pos']:,d} px")

    print("\n" + "-" * 85)
    print(" 3. GLOBAL TOTALS: ENTIRE VALIDATION SET OVERALL (8,147 Patches)")
    print(" " + "-" * 85)
    print(f"   Metric / Count        | Raw U-Net (0.5)     | Post-Processed      | Delta")
    print(f"   ----------------------+---------------------+---------------------+--------")
    print(f"   True Positives (TP)   | {raw_m_all['tp']:19,d} | {post_m_all['tp']:19,d} | +{post_m_all['tp']-raw_m_all['tp']:,d} px")
    print(f"   False Positives (FP)  | {raw_m_all['fp']:19,d} | {post_m_all['fp']:19,d} | +{post_m_all['fp']-raw_m_all['fp']:,d} px")
    print(f"   False Negatives (FN)  | {raw_m_all['fn']:19,d} | {post_m_all['fn']:19,d} | -{raw_m_all['fn']-post_m_all['fn']:,d} px")
    print(f"   True Negatives (TN)   | {raw_m_all['tn']:19,d} | {post_m_all['tn']:19,d} | -{raw_m_all['tn']-post_m_all['tn']:,d} px")
    print(f"   Total GT Positive     | {raw_m_all['gt_pos']:19,d} | {post_m_all['gt_pos']:19,d} | 0 px")
    print(f"   Total Pred Positive   | {raw_m_all['pred_pos']:19,d} | {post_m_all['pred_pos']:19,d} | +{post_m_all['pred_pos']-raw_m_all['pred_pos']:,d} px")
    print(f"   ----------------------+---------------------+---------------------+--------")
    print(f"   Global Dice           | {raw_m_all['dice']:19.4f} | {post_m_all['dice']:19.4f} | {post_m_all['dice']-raw_m_all['dice']:+.4f}")
    print(f"   Global IoU            | {raw_m_all['iou']:19.4f} | {post_m_all['iou']:19.4f} | {post_m_all['iou']-raw_m_all['iou']:+.4f}")
    print(f"   Global Precision      | {raw_m_all['precision']:19.4f} | {post_m_all['precision']:19.4f} | {post_m_all['precision']-raw_m_all['precision']:+.4f}")
    print(f"   Global Recall         | {raw_m_all['recall']:19.4f} | {post_m_all['recall']:19.4f} | {post_m_all['recall']-raw_m_all['recall']:+.4f}")
    print("=" * 85)

if __name__ == "__main__":
    main()
