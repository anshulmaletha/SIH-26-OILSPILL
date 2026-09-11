"""
Real-Data Visualization Check for Sentinel-1 SAR Oil Spill Dataset.
Loads one matched sample pair from Downloads/Radar_data/train/,
prints metadata, renders SAR image, ground-truth mask, and overlay,
and saves the figure to results/real_data_visualization.png.
"""

import os
import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import matplotlib.pyplot as plt
import numpy as np
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


def visualize_real_sample():
    base_dir = resolve_data_dir()
    radar_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir

    img_dir = radar_dir / "images"
    mask_dir = radar_dir / "masks"

    if not img_dir.exists() or not mask_dir.exists():
        print(f"[ERROR] Directory not found: {img_dir} or {mask_dir}")
        sys.exit(1)

    # Find first matched pair
    img_files = sorted(list(img_dir.glob("*.tif")) + list(img_dir.glob("*.tiff")))
    if not img_files:
        print("[ERROR] No TIFF files found in train/images")
        sys.exit(1)

    matched_pair = None
    for img_path in img_files:
        mask_path = mask_dir / img_path.name
        if mask_path.exists():
            matched_pair = (img_path, mask_path)
            break

    if matched_pair is None:
        print("[ERROR] No matched image/mask pair found!")
        sys.exit(1)

    img_path, mask_path = matched_pair

    # Load image and mask
    raw_img = tifffile.imread(str(img_path))
    raw_mask = tifffile.imread(str(mask_path))

    # Normalize dimensions to (H, W)
    img_2d = np.squeeze(raw_img)
    mask_2d = np.squeeze(raw_mask)

    # Extract required metadata
    img_shape = list(raw_img.shape)
    mask_shape = list(raw_mask.shape)
    img_dtype = str(raw_img.dtype)
    mask_dtype = str(raw_mask.dtype)
    img_min = float(np.nanmin(img_2d))
    img_max = float(np.nanmax(img_2d))
    mask_unique = np.unique(mask_2d).tolist()

    print("=" * 65)
    print(" REAL-DATA SAMPLE METADATA & INSPECTION")
    print("=" * 65)
    print(f" Filename Pair     : {img_path.name} <---> {mask_path.name}")
    print(f" Image Shape       : {img_shape}")
    print(f" Mask Shape        : {mask_shape}")
    print(f" Image Data Type   : {img_dtype}")
    print(f" Mask Data Type    : {mask_dtype}")
    print(f" Image Min / Max   : {img_min:.4f} / {img_max:.4f} dB")
    print(f" Mask Unique Vals  : {mask_unique}")
    print("=" * 65)

    # Downsample large imagery for visualization performance if needed
    h, w = img_2d.shape
    step = max(1, min(h // 1000, w // 1000))
    img_vis = img_2d[::step, ::step]
    mask_vis = mask_2d[::step, ::step]

    # Handle NaNs in visualization array
    img_vis_clean = np.nan_to_num(img_vis, nan=np.nanmean(img_vis))

    # Prepare 3-panel figure: 1. SAR Image, 2. Ground-Truth Mask, 3. Overlay
    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    ax_img, ax_mask, ax_overlay = axes

    # 1. SAR Image
    vmin, vmax = np.percentile(img_vis_clean, [2, 98])
    im0 = ax_img.imshow(img_vis_clean, cmap="gray", vmin=vmin, vmax=vmax)
    ax_img.set_title(f"SAR Intensity ({img_path.name})\n[Min: {img_min:.1f}, Max: {img_max:.1f} dB]", fontsize=12)
    ax_img.axis("off")
    fig.colorbar(im0, ax=ax_img, fraction=0.046, pad=0.04, label="dB")

    # 2. Ground-Truth Mask
    bin_mask = (mask_vis > 0).astype(np.uint8)
    im1 = ax_mask.imshow(bin_mask, cmap="cividis", vmin=0, vmax=1)
    ax_mask.set_title(f"Ground-Truth Mask\n[Unique: {mask_unique}]", fontsize=12)
    ax_mask.axis("off")
    fig.colorbar(im1, ax=ax_mask, fraction=0.046, pad=0.04, label="Binary Class")

    # 3. SAR + Mask Overlay
    norm_img = np.clip((img_vis_clean - vmin) / (vmax - vmin + 1e-7), 0, 1)
    rgb = np.dstack([norm_img, norm_img, norm_img])
    # Overlay oil spill pixels in bright red
    rgb[bin_mask == 1] = [1.0, 0.2, 0.2]

    ax_overlay.imshow(rgb)
    ax_overlay.set_title("SAR + Mask Overlay\n(Oil Spill highlighted in Red)", fontsize=12)
    ax_overlay.axis("off")

    plt.suptitle("Sentinel-1 SAR Real-Data Inspection Pair", fontsize=16, fontweight="bold")
    plt.tight_layout()

    # Save visualization output to results/
    results_dir = PROJECT_ROOT / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    out_file = results_dir / "real_data_visualization.png"

    plt.savefig(out_file, dpi=150, bbox_inches="tight")
    plt.close(fig)

    print(f"\n[SUCCESS] Visualization figure saved to: {out_file}")


if __name__ == "__main__":
    visualize_real_sample()
