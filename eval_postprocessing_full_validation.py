"""
Full Validation Set Evaluation of ConservativeMaskEnhancer vs Raw U-Net Baseline.
Uses models/best_unet_baseline.pt on the full scene-disjoint validation set (seed=42, ratio=0.25).
Reports Dice, IoU, Precision, Recall, F1, FP pixels, and FN pixels for both raw and post-processed predictions.
Generates results/demo_outputs/postprocessing_full_validation_comparison.png.
"""

import os
import sys
import numpy as np
import torch
import matplotlib.pyplot as plt
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset
from src.postprocessing.mask_enhancer import ConservativeMaskEnhancer


def compute_metrics(pred_mask: np.ndarray, target_mask: np.ndarray):
    """Compute binary classification metrics and pixel counts."""
    pred_b = (pred_mask > 0).astype(bool)
    target_b = (target_mask > 0).astype(bool)

    tp = int(np.sum(pred_b & target_b))
    fp = int(np.sum(pred_b & ~target_b))
    fn = int(np.sum(~pred_b & target_b))
    tn = int(np.sum(~pred_b & ~target_b))

    if (tp + fp + fn) == 0:
        dice = 1.0
        iou = 1.0
        precision = 1.0
        recall = 1.0
        f1 = 1.0
    else:
        dice = float((2.0 * tp) / (2.0 * tp + fp + fn + 1e-7))
        iou = float(tp / (tp + fp + fn + 1e-7))
        precision = float(tp / (tp + fp + 1e-7)) if (tp + fp) > 0 else 1.0
        recall = float(tp / (tp + fn + 1e-7)) if (tp + fn) > 0 else 1.0
        f1 = float((2.0 * precision * recall) / (precision + recall + 1e-7)) if (precision + recall) > 0 else 0.0

    return {
        "dice": dice,
        "iou": iou,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn
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
    if not checkpoint_path.exists():
        print(f"[ERROR] Checkpoint not found: {checkpoint_path}")
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("=" * 85)
    print(" FULL VALIDATION SET EVALUATION: RAW U-NET VS CONSERVATIVE POST-PROCESSING")
    print("=" * 85)
    print(f" Loading Checkpoint : {checkpoint_path.name}")
    print(f" Device             : {device}")

    # Load Model
    model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Load Dataset Split
    train_df, val_df, train_scenes, val_scenes, _ = create_scene_split(csv_file, val_scene_ratio=0.25, seed=42)
    preprocessor = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    raw_train_ds = SARPatchDataset(train_df.iloc[:50], data_dir=train_dir, patch_size=256, return_dict=False)
    preprocessor.fit([raw_train_ds[i][0].numpy() for i in range(len(raw_train_ds))])

    val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)
    total_val_patches = len(val_ds)
    print(f" Total Validation Patches: {total_val_patches} (across {len(val_scenes)} validation scenes)")

    enhancer = ConservativeMaskEnhancer(
        high_threshold=0.5,
        low_threshold=0.35,
        min_noise_area_pixels=15,
        morph_kernel_size=3
    )

    # Accumulators
    raw_all = {"dice": [], "iou": [], "precision": [], "recall": [], "f1": []}
    post_all = {"dice": [], "iou": [], "precision": [], "recall": [], "f1": []}

    raw_empty = {"dice": [], "iou": [], "precision": [], "recall": [], "f1": []}
    post_empty = {"dice": [], "iou": [], "precision": [], "recall": [], "f1": []}

    raw_nonempty = {"dice": [], "iou": [], "precision": [], "recall": [], "f1": []}
    post_nonempty = {"dice": [], "iou": [], "precision": [], "recall": [], "f1": []}

    raw_total_fp = 0
    raw_total_fn = 0
    post_total_fp = 0
    post_total_fn = 0

    empty_count = 0
    nonempty_count = 0

    with torch.no_grad():
        for idx in range(total_val_patches):
            item = val_ds[idx]
            img_t = item["image"].unsqueeze(0).to(device)
            gt_mask = item["mask"].squeeze().numpy()

            logits = model(img_t)
            prob_map = torch.sigmoid(logits).squeeze().cpu().numpy()
            raw_mask = (prob_map >= 0.5).astype(np.uint8)

            post_mask = enhancer.process(prob_map, raw_mask)

            m_raw = compute_metrics(raw_mask, gt_mask)
            m_post = compute_metrics(post_mask, gt_mask)

            raw_total_fp += m_raw["fp"]
            raw_total_fn += m_raw["fn"]
            post_total_fp += m_post["fp"]
            post_total_fn += m_post["fn"]

            is_empty = (gt_mask.sum() == 0)
            if is_empty:
                empty_count += 1
                for k in raw_empty:
                    raw_empty[k].append(m_raw[k])
                    post_empty[k].append(m_post[k])
            else:
                nonempty_count += 1
                for k in raw_nonempty:
                    raw_nonempty[k].append(m_raw[k])
                    post_nonempty[k].append(m_post[k])

            for k in raw_all:
                raw_all[k].append(m_raw[k])
                post_all[k].append(m_post[k])

    print("\n" + "=" * 85)
    print(" SUMMARY METRICS COMPARISON (FULL VALIDATION SET)")
    print("=" * 85)
    print(f" Empty Patches: {empty_count} | Non-Empty Patches: {nonempty_count}")

    print("\n1. NON-EMPTY VALIDATION PATCHES PERFORMANCE (>0% oil):")
    print(f"   Metric      | Raw U-Net (0.5) | Post-Processed | Delta")
    print(f"   ------------+-----------------+----------------+--------")
    for k in ["dice", "iou", "precision", "recall", "f1"]:
        r_val = np.mean(raw_nonempty[k])
        p_val = np.mean(post_nonempty[k])
        diff = p_val - r_val
        sign = "+" if diff >= 0 else ""
        print(f"   {k.capitalize():11s} | {r_val:15.4f} | {p_val:14.4f} | {sign}{diff:.4f}")

    print("\n2. EMPTY-MASK VALIDATION PATCHES PERFORMANCE (0% oil):")
    print(f"   Metric      | Raw U-Net (0.5) | Post-Processed | Delta")
    print(f"   ------------+-----------------+----------------+--------")
    for k in ["dice", "precision", "recall"]:
        r_val = np.mean(raw_empty[k])
        p_val = np.mean(post_empty[k])
        diff = p_val - r_val
        sign = "+" if diff >= 0 else ""
        print(f"   {k.capitalize():11s} | {r_val:15.4f} | {p_val:14.4f} | {sign}{diff:.4f}")

    print("\n3. ALL VALIDATION PATCHES OVERALL PERFORMANCE:")
    print(f"   Metric      | Raw U-Net (0.5) | Post-Processed | Delta")
    print(f"   ------------+-----------------+----------------+--------")
    for k in ["dice", "iou", "precision", "recall", "f1"]:
        r_val = np.mean(raw_all[k])
        p_val = np.mean(post_all[k])
        diff = p_val - r_val
        sign = "+" if diff >= 0 else ""
        print(f"   {k.capitalize():11s} | {r_val:15.4f} | {p_val:14.4f} | {sign}{diff:.4f}")

    print("\n4. PIXEL ERROR COMPARISON (FULL VALIDATION SET):")
    print(f"   Error Type           | Raw U-Net (0.5) | Post-Processed | Change")
    print(f"   ---------------------+-----------------+----------------+--------")
    fp_diff = post_total_fp - raw_total_fp
    fn_diff = post_total_fn - raw_total_fn
    fp_sign = "+" if fp_diff >= 0 else ""
    fn_sign = "+" if fn_diff >= 0 else ""
    print(f"   False Positive Pixels| {raw_total_fp:15,d} | {post_total_fp:14,d} | {fp_sign}{fp_diff:,d} px")
    print(f"   False Negative Pixels| {raw_total_fn:15,d} | {post_total_fn:14,d} | {fn_sign}{fn_diff:,d} px")
    print("=" * 85)

    # Generate Comparison Visualization Plot
    out_dir = PROJECT_ROOT / "results" / "demo_outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_fig = out_dir / "postprocessing_full_validation_comparison.png"

    metrics_names = ["Dice", "IoU", "Precision", "Recall", "F1"]
    raw_nonempty_vals = [np.mean(raw_nonempty[k.lower()]) for k in metrics_names]
    post_nonempty_vals = [np.mean(post_nonempty[k.lower()]) for k in metrics_names]

    x = np.arange(len(metrics_names))
    width = 0.35

    fig, ax = plt.subplots(figsize=(10, 6))
    rects1 = ax.bar(x - width/2, raw_nonempty_vals, width, label='Raw U-Net (0.5)', color='royalblue')
    rects2 = ax.bar(x + width/2, post_nonempty_vals, width, label='Post-Processed', color='teal')

    ax.set_ylabel('Score')
    ax.set_title('Full Validation Set Performance: Raw U-Net vs Post-Processed Mask\n(Non-Empty Validation Patches)', fontsize=12, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(metrics_names, fontweight='bold')
    ax.set_ylim(0, 1.0)
    ax.grid(True, linestyle='--', alpha=0.5, axis='y')
    ax.legend(loc='upper left')

    for rect in rects1:
        height = rect.get_height()
        ax.annotate(f'{height:.3f}', xy=(rect.get_x() + rect.get_width() / 2, height), xytext=(0, 3),
                    textcoords="offset points", ha='center', va='bottom', fontsize=9)

    for rect in rects2:
        height = rect.get_height()
        ax.annotate(f'{height:.3f}', xy=(rect.get_x() + rect.get_width() / 2, height), xytext=(0, 3),
                    textcoords="offset points", ha='center', va='bottom', fontsize=9, fontweight='bold')

    plt.tight_layout()
    plt.savefig(out_fig, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"\n[SUCCESS] Saved full validation comparison figure: {out_fig}")
    print("=" * 85)


if __name__ == "__main__":
    main()
