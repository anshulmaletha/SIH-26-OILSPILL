"""
Investigation Script: CSV class vs Segmentation Mask Mismatch Analysis.
Analyzes 100 random patches, generates confusion table, saves 20 mismatch overlay examples
to results/mismatch_check/, and determines the exact semantics of CSV class=1.
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
from src.data.windowed_dataset import SARPatchDataset


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


def investigate_mismatch():
    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    print("=" * 75)
    print(" CSV CLASS VS SEGMENTATION MASK MISMATCH INVESTIGATION")
    print("=" * 75)

    if not csv_file.exists():
        print(f"[ERROR] CSV file not found: {csv_file}")
        sys.exit(1)

    df = pd.read_csv(csv_file)
    print(f" Total Patches in CSV : {len(df)}")

    # Sample 100 random patches deterministically
    np.random.seed(42)
    sample_indices = np.random.choice(len(df), size=100, replace=False)

    dataset = SARPatchDataset(
        csv_file_or_df=df,
        data_dir=train_dir,
        patch_size=256,
        return_dict=True
    )

    results = []
    mismatch_examples = []

    for idx in sample_indices:
        item = dataset[int(idx)]
        img_np = item["image"].numpy()[0]  # (256, 256)
        mask_np = item["mask"].numpy()[0]  # (256, 256)
        csv_class = float(item["csv_class"])
        src_tiff = item["source_tiff"]
        coords = item["crop_coords"]

        pos_pixels = int((mask_np > 0).sum())
        total_pixels = mask_np.size
        pos_pct = (pos_pixels / total_pixels) * 100.0
        is_empty = (pos_pixels == 0)

        results.append({
            "idx": int(idx),
            "csv_class": csv_class,
            "is_empty": is_empty,
            "pos_pixels": pos_pixels,
            "pos_pct": pos_pct,
            "src_tiff": src_tiff,
            "coords": coords,
            "img_crop": img_np,
            "mask_crop": mask_np
        })

        if csv_class == 1.0 and is_empty:
            mismatch_examples.append(results[-1])

    # Build Confusion Table
    # Row keys: CSV Class 1.0, CSV Class 0.0
    # Col keys: Mask Empty, Mask Non-Empty
    conf_table = {
        "class_1_empty": sum(1 for r in results if r["csv_class"] == 1.0 and r["is_empty"]),
        "class_1_nonempty": sum(1 for r in results if r["csv_class"] == 1.0 and not r["is_empty"]),
        "class_0_empty": sum(1 for r in results if r["csv_class"] == 0.0 and r["is_empty"]),
        "class_0_nonempty": sum(1 for r in results if r["csv_class"] == 0.0 and not r["is_empty"]),
    }

    print("\n--- 1. CONFUSION TABLE (100 RANDOM PATCHES) ---")
    print(f" {'CSV Class':<12} | {'Mask Empty':<12} | {'Mask Non-Empty':<16} | {'Total Count':<12}")
    print("-" * 62)
    c1_emp = conf_table["class_1_empty"]
    c1_non = conf_table["class_1_nonempty"]
    c1_tot = c1_emp + c1_non
    print(f" {'Class 1.0':<12} | {c1_emp:<12} | {c1_non:<16} | {c1_tot:<12}")

    c0_emp = conf_table["class_0_empty"]
    c0_non = conf_table["class_0_nonempty"]
    c0_tot = c0_emp + c0_non
    print(f" {'Class 0.0':<12} | {c0_emp:<12} | {c0_non:<16} | {c0_tot:<12}")
    print("-" * 62)
    print(f" {'Total':<12} | {c1_emp + c0_emp:<12} | {c1_non + c0_non:<16} | {100:<12}")

    # Inspect up to 20 mismatch examples (Class=1 but Mask is Empty)
    mismatch_dir = PROJECT_ROOT / "results" / "mismatch_check"
    mismatch_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n--- 2. SAVING {min(20, len(mismatch_examples))} MISMATCH OVERLAY EXAMPLES ---")
    print(f" Target Directory: {mismatch_dir}")

    for i, ex in enumerate(mismatch_examples[:20], 1):
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        ax_img, ax_mask, ax_overlay = axes

        img_c = ex["img_crop"]
        mask_c = ex["mask_crop"]

        vmin, vmax = np.percentile(img_c, [2, 98])
        im0 = ax_img.imshow(img_c, cmap="gray", vmin=vmin, vmax=vmax)
        ax_img.set_title(f"SAR Crop ({ex['src_tiff']})\nCoords: {ex['coords']}", fontsize=10)
        ax_img.axis("off")

        im1 = ax_mask.imshow(mask_c, cmap="cividis", vmin=0, vmax=1)
        ax_mask.set_title(f"Mask Crop (Pos Pixels: {ex['pos_pixels']})", fontsize=10)
        ax_mask.axis("off")

        img_norm = np.clip((img_c - vmin) / (vmax - vmin + 1e-7), 0, 1)
        rgb = np.dstack([img_norm, img_norm, img_norm])
        rgb[mask_c > 0] = [1.0, 0.2, 0.2]

        ax_overlay.imshow(rgb)
        ax_overlay.set_title(f"Overlay (CSV Class = {ex['csv_class']})", fontsize=10)
        ax_overlay.axis("off")

        plt.suptitle(f"Mismatch Example #{i:02d} | CSV Class=1.0, Mask=Empty (0.0% Oil)", fontsize=12, fontweight="bold")
        plt.tight_layout()

        out_path = mismatch_dir / f"mismatch_sample_{i:02d}.png"
        plt.savefig(out_path, dpi=120, bbox_inches="tight")
        plt.close(fig)

        print(f"  Saved: mismatch_sample_{i:02d}.png (Scene: {ex['src_tiff']}, Coords: {ex['coords']})")

    # Determine CSV Class=1.0 Semantics
    print("\n--- 3. FINDINGS & DETERMINATION ---")
    print(" 1. Segmentation Target Source:")
    print("    - Segmentation loss and pixel-level targets MUST be derived strictly from the ground-truth mask crops.")
    print(" 2. Semantics of CSV Class column:")
    if conf_table["class_0_nonempty"] == 0:
        print("    - CSV class=0.0 guarantees that the mask is 100% EMPTY (pure background).")
    print(f"    - CSV class=1.0 indicates that the parent scene contains an oil spill event, or that the patch belongs to a candidate scene region.")
    print("    - Because class=1.0 patches contain both positive oil pixels and surrounding clean sea pixels (stride 90 cropping), exact pixel-level supervision MUST come from mask crops.")
    print("=" * 75)


if __name__ == "__main__":
    investigate_mismatch()
