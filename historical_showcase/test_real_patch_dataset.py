"""
Verification test script for real SAR patch segmentation dataset loader and scene-level split utility.
Loads 10 real patches from CSV metadata, crops 256x256 image/mask windows, and reports all metrics.
"""

import os
import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import torch
import numpy as np
from src.data.windowed_dataset import SARPatchDataset
from src.data.scene_split import create_scene_split


def test_real_patch_loader():
    train_dir = None
    for env_var in ["SAR_DATA_DIR", "DATA_DIR"]:
        if env_var in os.environ and os.environ[env_var].strip():
            p = Path(os.environ[env_var].strip())
            if p.exists():
                train_dir = p / "train" if (p / "train").exists() else p
                break
    if train_dir is None:
        user_profile = os.environ.get("USERPROFILE")
        if user_profile:
            p = Path(user_profile) / "Downloads" / "Radar_data" / "train"
            if p.exists():
                train_dir = p
    if train_dir is None:
        train_dir = PROJECT_ROOT / "data" / "raw"

    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    print("=" * 75)
    print(" REAL DATASET PATCH LOADER & SCENE SPLIT VERIFICATION")
    print("=" * 75)

    if not csv_file.exists():
        print(f"[ERROR] CSV file not found: {csv_file}")
        sys.exit(1)

    # 1. Test Scene-Level Disjoint Split Utility
    train_df, val_df, train_scenes, val_scenes, is_overlap_zero = create_scene_split(
        csv_file_or_df=csv_file,
        val_scene_ratio=0.25,
        seed=42
    )

    print("\n--- 1. SCENE-LEVEL SPLIT VERIFICATION ---")
    print(f" Total Unique Parent Scenes : {len(train_scenes) + len(val_scenes)}")
    print(f" Train Scenes Count         : {len(train_scenes)} -> {train_scenes}")
    print(f" Validation Scenes Count    : {len(val_scenes)} -> {val_scenes}")
    print(f" Train Patches Count        : {len(train_df)}")
    print(f" Validation Patches Count   : {len(val_df)}")
    print(f" Scene Overlap Is Zero      : {is_overlap_zero} (Strictly Disjoint)")
    assert is_overlap_zero, "Scene overlap must be exactly ZERO"

    # 2. Instantiate Real Patch Dataset Loader
    dataset = SARPatchDataset(
        csv_file_or_df=csv_file,
        data_dir=train_dir,
        patch_size=256,
        return_dict=True
    )

    print(f"\n--- 2. VERIFYING 10 REAL PATCH CROPS ---")
    print(f" Total Patches in Dataset   : {len(dataset)}")
    print("-" * 75)

    # Test 10 real patches
    sample_indices = range(min(10, len(dataset)))

    for i in sample_indices:
        item = dataset[i]
        img_t = item["image"]
        mask_t = item["mask"]
        csv_cls = item["csv_class"]
        src_tiff = item["source_tiff"]
        coords = item["crop_coords"]

        img_min = float(torch.min(img_t).item())
        img_max = float(torch.max(img_t).item())
        mask_unique = torch.unique(mask_t).tolist()

        print(f" Patch #{i+1:02d}:")
        print(f"   - Source TIFF   : {src_tiff}")
        print(f"   - Crop Coords   : Row={coords[0]}, Col={coords[1]}")
        print(f"   - Image Shape   : {list(img_t.shape)} (dtype: {img_t.dtype})")
        print(f"   - Mask Shape    : {list(mask_t.shape)} (dtype: {mask_t.dtype})")
        print(f"   - Image Min/Max : {img_min:.4f} / {img_max:.4f} dB")
        print(f"   - Mask Unique   : {mask_unique}")
        print(f"   - CSV Class     : {csv_cls} ({'Positive Oil Spill' if csv_cls == 1.0 else 'Negative Background'})")
        print("-" * 75)

        # Assertions to ensure strict validity
        assert img_t.shape == (1, 256, 256), f"Invalid image shape: {img_t.shape}"
        assert mask_t.shape == (1, 256, 256), f"Invalid mask shape: {mask_t.shape}"
        assert set(mask_unique).issubset({0.0, 1.0}), f"Mask unique values must be subset of {{0.0, 1.0}}, got {mask_unique}"

    print(" [OK] All 10 real patch crops verified successfully!")
    print("=" * 75)


if __name__ == "__main__":
    test_real_patch_loader()
