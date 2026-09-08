"""
Generate comparison visualization for Original vs Conservative Post-Processed Oil Spill Mask.
Panels: Original Prediction | Post-processed Prediction | Comparison Overlay.
Saves figure to results/demo_outputs/postprocessing_comparison.png.
"""

import json
import os
import sys
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.inference import OilSpillInferenceEngine
from src.postprocessing.mask_enhancer import ConservativeMaskEnhancer


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
    img_path = base_dir / "train" / "images" / "20200224.tif"

    if not img_path.exists():
        print(f"[ERROR] Image not found: {img_path}")
        sys.exit(1)

    print("[INFO] Initializing OilSpillInferenceEngine with ConservativeMaskEnhancer...")
    engine = OilSpillInferenceEngine()

    res_raw = engine.detect(img_path, is_preprocessed=False, apply_postprocessing=False)
    res_post = engine.detect(img_path, is_preprocessed=False, apply_postprocessing=True)

    sar_img = res_raw["raw_sar_image"]
    prob_map = res_raw["probability_map"]
    orig_mask = res_raw["binary_mask"]
    post_mask = res_post["binary_mask"]

    orig_px = int(np.sum(orig_mask))
    post_px = int(np.sum(post_mask))
    diff_px = post_px - orig_px

    print(f" Source Image             : {img_path.name}")
    print(f" Original Binary Mask     : {orig_px:,} px ({res_raw['area_km2']:.4f} km²)")
    print(f" Post-Processed Mask      : {post_px:,} px ({res_post['area_km2']:.4f} km²)")
    print(f" Tail Recovery Difference : +{diff_px:,} px (+{diff_px * 0.0001:.4f} km²)")

    out_dir = PROJECT_ROOT / "results" / "demo_outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_fig = out_dir / "postprocessing_comparison.png"

    fig, axes = plt.subplots(1, 3, figsize=(18, 5.5))

    vmin, vmax = np.percentile(sar_img, [2, 98])
    norm_sar = np.clip((sar_img - vmin) / (vmax - vmin + 1e-7), 0, 1)

    # Panel 1: Original Prediction
    rgb_orig = np.dstack([norm_sar, norm_sar, norm_sar])
    rgb_orig[orig_mask > 0] = [1.0, 0.2, 0.2]  # Bright Red
    axes[0].imshow(rgb_orig)
    axes[0].set_title(f"1. Original U-Net Mask (Thresh=0.5)\n({orig_px:,} px / {orig_px*0.0001:.3f} km²)", fontsize=11, fontweight="bold")
    axes[0].axis("off")

    # Panel 2: Post-Processed Prediction
    rgb_post = np.dstack([norm_sar, norm_sar, norm_sar])
    rgb_post[post_mask > 0] = [0.0, 0.8, 1.0]  # Cyan
    axes[1].imshow(rgb_post)
    axes[1].set_title(f"2. Enhanced Mask (Hysteresis + Morphology)\n({post_px:,} px / {post_px*0.0001:.3f} km²)", fontsize=11, fontweight="bold")
    axes[1].axis("off")

    # Panel 3: Comparison Overlay (Green = Preserved Core, Cyan = Recovered Weak Tails)
    rgb_ovr = np.dstack([norm_sar, norm_sar, norm_sar])
    both = (orig_mask > 0) & (post_mask > 0)
    recovered_tails = (post_mask > 0) & (orig_mask == 0)

    rgb_ovr[both] = [0.1, 0.9, 0.2]             # Bright Green = Preserved Core Slick
    rgb_ovr[recovered_tails] = [1.0, 0.0, 0.8]  # Magenta = Recovered Weak/Thin Tails

    axes[2].imshow(rgb_ovr)
    axes[2].set_title(f"3. Tail Recovery Overlay\n(Green: Core Slick, Magenta: Recovered Tails +{diff_px:,} px)", fontsize=11, fontweight="bold")
    axes[2].axis("off")

    plt.suptitle(f"SIH 2026: Conservative Post-Processing Tail Recovery Comparison ({img_path.name})", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(out_fig, dpi=150, bbox_inches="tight")
    plt.close(fig)

    print(f"\n[SUCCESS] Comparison visualization saved to: {out_fig}")


if __name__ == "__main__":
    main()
