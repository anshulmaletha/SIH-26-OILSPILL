"""
Mask Pixel Distribution Analyzer across ALL Train (21,744) and Validation (7,249) CSV patches.
Calculates exact positive oil pixel counts, percentages, empty vs non-empty counts,
summary statistics, range distributions, and saves histogram plot to results/mask_pixel_distribution.png.
"""

import os
import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tifffile


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


def analyze_mask_distribution():
    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    mask_dir = train_dir / "masks"

    train_csv = train_dir / "dataframe_train_dataset_256_90.csv"
    val_csv = train_dir / "dataframe_val_dataset_256_90.csv"

    print("=" * 75)
    print(" ALL-PATCH MASK PIXEL DISTRIBUTION ANALYSIS")
    print("=" * 75)

    if not train_csv.exists() or not val_csv.exists():
        print(f"[ERROR] CSV files not found: {train_csv} or {val_csv}")
        sys.exit(1)

    df_train = pd.read_csv(train_csv)
    df_val = pd.read_csv(val_csv)

    print(f" Train CSV Patches : {len(df_train)}")
    print(f" Val CSV Patches   : {len(df_val)}")
    print(f" Total Patches     : {len(df_train) + len(df_val)}")

    # Pre-cache all 14 parent mask TIFFs in memory for fast indexing
    print("\n--- Pre-caching Parent Mask TIFFs ---")
    mask_cache = {}
    mask_files = list(mask_dir.glob("*.tif")) + list(mask_dir.glob("*.tiff"))
    for mf in mask_files:
        try:
            arr = tifffile.imread(str(mf))
            arr_2d = np.squeeze(arr)
            mask_cache[mf.name] = (arr_2d > 0).astype(np.uint8)
        except Exception as e:
            print(f" Error loading mask {mf.name}: {e}")

    print(f" Cached {len(mask_cache)} parent mask TIFF scenes.")

    def process_dataframe(df: pd.DataFrame, split_label: str):
        pos_pixels_list = []
        pos_pct_list = []

        total_pixels_per_patch = 256 * 256

        for idx, row in df.iterrows():
            tiff_name = Path(str(row["paths"]).replace("\\", "/")).name
            coords_str = str(row["coordinates"])
            r, c = map(int, coords_str.split(","))

            mask_scene = mask_cache.get(tiff_name)
            if mask_scene is None:
                continue

            h, w = mask_scene.shape
            r_end = min(r + 256, h)
            c_end = min(c + 256, w)

            crop = mask_scene[r:r_end, c:c_end]
            pos_pixels = int(np.sum(crop))
            pos_pct = (pos_pixels / total_pixels_per_patch) * 100.0

            pos_pixels_list.append(pos_pixels)
            pos_pct_list.append(pos_pct)

        pos_pixels_arr = np.array(pos_pixels_list, dtype=np.int32)
        pos_pct_arr = np.array(pos_pct_list, dtype=np.float32)

        empty_count = int(np.sum(pos_pixels_arr == 0))
        non_empty_count = int(np.sum(pos_pixels_arr > 0))
        total_count = len(pos_pixels_arr)

        stats = {
            "split": split_label,
            "total_count": total_count,
            "empty_count": empty_count,
            "empty_pct": (empty_count / total_count) * 100.0 if total_count > 0 else 0.0,
            "non_empty_count": non_empty_count,
            "non_empty_pct": (non_empty_count / total_count) * 100.0 if total_count > 0 else 0.0,
            "min": float(np.min(pos_pct_arr)),
            "max": float(np.max(pos_pct_arr)),
            "mean": float(np.mean(pos_pct_arr)),
            "median": float(np.median(pos_pct_arr)),
            "p50": float(np.percentile(pos_pct_arr, 50)),
            "p75": float(np.percentile(pos_pct_arr, 75)),
            "p90": float(np.percentile(pos_pct_arr, 90)),
            "p95": float(np.percentile(pos_pct_arr, 95)),
            "p99": float(np.percentile(pos_pct_arr, 99)),
            # Bins
            "bin_0": int(np.sum(pos_pct_arr == 0.0)),
            "bin_0_1": int(np.sum((pos_pct_arr > 0.0) & (pos_pct_arr <= 1.0))),
            "bin_1_5": int(np.sum((pos_pct_arr > 1.0) & (pos_pct_arr <= 5.0))),
            "bin_5_10": int(np.sum((pos_pct_arr > 5.0) & (pos_pct_arr <= 10.0))),
            "bin_gt_10": int(np.sum(pos_pct_arr > 10.0)),
            "pos_pct_arr": pos_pct_arr
        }
        return stats

    train_stats = process_dataframe(df_train, "Train")
    val_stats = process_dataframe(df_val, "Validation")

    def print_split_report(s: dict):
        print(f"\n--- {s['split'].upper()} SPLIT MASK PIXEL STATS ---")
        print(f" Total Patches      : {s['total_count']}")
        print(f" Empty Masks (0% oil): {s['empty_count']} ({s['empty_pct']:.2f}%)")
        print(f" Non-Empty Masks    : {s['non_empty_count']} ({s['non_empty_pct']:.2f}%)")
        print("-" * 65)
        print(" POSITIVE PIXEL % SUMMARY STATS:")
        print(f"   - Min    : {s['min']:.4f}%")
        print(f"   - Max    : {s['max']:.4f}%")
        print(f"   - Mean   : {s['mean']:.4f}%")
        print(f"   - Median : {s['median']:.4f}%")
        print(f"   - P50    : {s['p50']:.4f}%")
        print(f"   - P75    : {s['p75']:.4f}%")
        print(f"   - P90    : {s['p90']:.4f}%")
        print(f"   - P95    : {s['p95']:.4f}%")
        print(f"   - P99    : {s['p99']:.4f}%")
        print("-" * 65)
        print(" POSITIVE PIXEL % RANGE BINS:")
        tot = s['total_count']
        print(f"   - 0% oil (empty) : {s['bin_0']:<6} ({s['bin_0']/tot*100:.2f}%)")
        print(f"   - 0 - 1% oil     : {s['bin_0_1']:<6} ({s['bin_0_1']/tot*100:.2f}%)")
        print(f"   - 1 - 5% oil     : {s['bin_1_5']:<6} ({s['bin_1_5']/tot*100:.2f}%)")
        print(f"   - 5 - 10% oil    : {s['bin_5_10']:<6} ({s['bin_5_10']/tot*100:.2f}%)")
        print(f"   - > 10% oil      : {s['bin_gt_10']:<6} ({s['bin_gt_10']/tot*100:.2f}%)")
        print("=" * 65)

    print_split_report(train_stats)
    print_split_report(val_stats)

    # Plot distribution histogram
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    ax_train, ax_val = axes

    # Non-zero positive pixel percentages for log/distribution plot
    train_pos = train_stats["pos_pct_arr"][train_stats["pos_pct_arr"] > 0]
    val_pos = val_stats["pos_pct_arr"][val_stats["pos_pct_arr"] > 0]

    bins = [0.0, 0.001, 1.0, 5.0, 10.0, 20.0, 50.0, 100.0]
    
    # Train Bar Chart Bins
    t_bin_counts = [
        train_stats['bin_0'],
        train_stats['bin_0_1'],
        train_stats['bin_1_5'],
        train_stats['bin_5_10'],
        train_stats['bin_gt_10']
    ]
    bin_labels = ['0%', '0-1%', '1-5%', '5-10%', '>10%']

    ax_train.bar(bin_labels, t_bin_counts, color='teal', edgecolor='black', alpha=0.8)
    ax_train.set_title(f"Train Mask Oil Pixel % Distribution\n(Total Patches: {train_stats['total_count']})", fontsize=12)
    ax_train.set_xlabel("Oil Coverage Range (%)", fontsize=10)
    ax_train.set_ylabel("Patch Count", fontsize=10)
    for i, count in enumerate(t_bin_counts):
        pct = (count / train_stats['total_count']) * 100
        ax_train.text(i, count + 100, f"{count}\n({pct:.1f}%)", ha='center', va='bottom', fontsize=9)

    # Val Bar Chart Bins
    v_bin_counts = [
        val_stats['bin_0'],
        val_stats['bin_0_1'],
        val_stats['bin_1_5'],
        val_stats['bin_5_10'],
        val_stats['bin_gt_10']
    ]

    ax_val.bar(bin_labels, v_bin_counts, color='navy', edgecolor='black', alpha=0.8)
    ax_val.set_title(f"Val Mask Oil Pixel % Distribution\n(Total Patches: {val_stats['total_count']})", fontsize=12)
    ax_val.set_xlabel("Oil Coverage Range (%)", fontsize=10)
    ax_val.set_ylabel("Patch Count", fontsize=10)
    for i, count in enumerate(v_bin_counts):
        pct = (count / val_stats['total_count']) * 100
        ax_val.text(i, count + 50, f"{count}\n({pct:.1f}%)", ha='center', va='bottom', fontsize=9)

    plt.suptitle("Mask Ground-Truth Oil Pixel Coverage Distribution across All Patches", fontsize=14, fontweight="bold")
    plt.tight_layout()

    out_file = PROJECT_ROOT / "results" / "mask_pixel_distribution.png"
    out_file.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_file, dpi=150, bbox_inches="tight")
    plt.close(fig)

    print(f"\n[SUCCESS] Histogram plot saved to: {out_file}")


if __name__ == "__main__":
    analyze_mask_distribution()
