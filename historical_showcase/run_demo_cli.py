"""
SIH 2026 Command-Line Inference Demo Runner for Sentinel-1 SAR Oil Spill Detection.

Usage:
    py -3.10 run_demo_cli.py --input <path_to_sar_image_or_tiff> [--postprocess] [--geojson] [--out_dir results/demo_outputs]

Examples:
    py -3.10 run_demo_cli.py --input data/train/images/20200224.tif --geojson
    py -3.10 run_demo_cli.py --sample positive --postprocess
    py -3.10 run_demo_cli.py --sample negative
"""

import argparse
import json
import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.inference import OilSpillInferenceEngine
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset, classify_mask_occupancy


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


def run_cli_demo():
    parser = argparse.ArgumentParser(description="SIH 2026 Sentinel-1 SAR Oil Spill Detection CLI Demo")
    parser.add_argument("--input", type=str, default=None, help="Path to input SAR image file (TIFF, PNG, NPY)")
    parser.add_argument("--sample", type=str, choices=["positive", "negative"], default=None, help="Run on pre-configured validation sample")
    parser.add_argument("--threshold", type=float, default=0.5, help="Binary classification threshold (default 0.5)")
    parser.add_argument("--postprocess", action="store_true", help="Apply conservative post-processing enhancement")
    parser.add_argument("--geojson", action="store_true", help="Generate and save PRD Stage-1 GeoJSON polygon output")
    parser.add_argument("--out_dir", type=str, default="results/demo_outputs", help="Directory to save output visual overlays")
    args = parser.parse_args()

    print("=" * 85)
    print(" SIH 2026: SENTINEL-1 SAR OIL SPILL DETECTION CLI DEMO")
    print("=" * 85)

    engine = OilSpillInferenceEngine(checkpoint_path=PROJECT_ROOT / "models" / "best_unet_baseline.pt", threshold=args.threshold)
    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    is_preprocessed = False
    source_label = "sample"
    if args.input is not None:
        input_path = Path(args.input)
        if not input_path.exists():
            print(f"[ERROR] Input file not found: {input_path}")
            sys.exit(1)
        target_input = input_path
        source_label = input_path.stem
    elif args.sample is not None and csv_file.exists():
        train_df, val_df, train_scenes, val_scenes, _ = create_scene_split(csv_file, val_scene_ratio=0.25, seed=42)
        val_pos_idx, val_neg_idx = classify_mask_occupancy(val_df, train_dir, patch_size=256)
        val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=engine.preprocessor, return_dict=True)
        
        idx = int(val_pos_idx[0]) if args.sample == "positive" else int(val_neg_idx[0])
        item = val_ds[idx]
        target_input = item["image"].squeeze().numpy()
        is_preprocessed = True
        source_label = f"val_{args.sample}_{item['source_tiff']}"
        print(f" Loaded validation sample ({args.sample}): Scene {item['source_tiff']} at {item['crop_coords']}")
    else:
        # Default to synthetic or test sample
        print(" [INFO] No input specified. Testing with sample synthetic SAR array.")
        target_input = np.random.normal(-15.0, 5.0, (256, 256)).astype(np.float32)
        source_label = "synthetic_sample"

    # Run Detection
    if args.geojson:
        results = engine.detect_and_vectorize(target_input, is_preprocessed=is_preprocessed, apply_postprocessing=args.postprocess)
    else:
        results = engine.detect(target_input, is_preprocessed=is_preprocessed, apply_postprocessing=args.postprocess)

    print("\n" + "=" * 85)
    print(" DETECTION RESULTS SUMMARY")
    print("=" * 85)
    print(f" Source Name        : {results['source_name']}")
    print(f" Image Dimensions   : {results['dimensions'][0]} x {results['dimensions'][1]} pixels")
    print(f" Detection Status   : {results['status']}")
    print(f" Detected Oil Pixels: {results['oil_pixels']:,} px")
    print(f" Estimated Oil Area : {results['area_km2']:.4f} km² ({results['area_km2']*100:.2f} hectares)")
    print(f" Coverage Percentage: {results['coverage_pct']:.2f}%")
    print(f" Model Confidence   : {results['confidence']*100:.2f}% ({results.get('confidence_type', 'confidence')})")
    print(f" Post-Processing    : {'ENABLED (Enhanced)' if results.get('postprocessing_applied') else 'OFF (Raw U-Net Default)'}")
    print(f" Spatial Resolution : {'GeoTIFF metadata' if results['spatial_metadata']['available'] else '10m x 10m fallback'}")
    print("=" * 85)

    out_dir = PROJECT_ROOT / args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    # Save GeoJSON if requested
    if args.geojson and "geojson" in results:
        geojson_file = out_dir / f"detection_{source_label}.geojson"
        with open(geojson_file, "w") as f:
            json.dump(results["geojson"], f, indent=2)
        print(f"[SUCCESS] Saved Stage-1 GeoJSON to: {geojson_file}")
        print(f"          Total slick polygons: {results['geojson']['geometry_features']['total_slicks_detected']}")

    # Save Overlay Figure
    safe_name = results['source_name'].replace('.tif', '').replace('.png', '').replace(' ', '_')
    out_file = out_dir / f"detection_{safe_name}.png"

    fig, axes = plt.subplots(1, 4, figsize=(18, 4.5))
    sar_img = results["raw_sar_image"]
    prob_map = results["probability_map"]
    pred_mask = results["binary_mask"]
    is_post = results.get("postprocessing_applied", False)

    vmin, vmax = np.percentile(sar_img, [2, 98])
    axes[0].imshow(sar_img, cmap="gray", vmin=vmin, vmax=vmax)
    axes[0].set_title(f"1. Input SAR Intensity\n({results['source_name']})", fontsize=10, fontweight="bold")
    axes[0].axis("off")

    axes[1].imshow(prob_map, cmap="magma", vmin=0, vmax=1)
    axes[1].set_title(f"2. U-Net Probability Map\n(Conf: {results['confidence']*100:.1f}%)", fontsize=10, fontweight="bold")
    axes[1].axis("off")

    axes[2].imshow(pred_mask, cmap="cividis", vmin=0, vmax=1)
    mask_title = "3. Binary Mask [Post-Processed]" if is_post else "3. Binary Mask [Raw U-Net]"
    axes[2].set_title(f"{mask_title}\n(Oil: {results['oil_pixels']:,} px / {results['area_km2']:.3f} km²)", fontsize=10, fontweight="bold")
    axes[2].axis("off")

    norm_sar = np.clip((sar_img - vmin) / (vmax - vmin + 1e-7), 0, 1)
    rgb = np.dstack([norm_sar, norm_sar, norm_sar])
    rgb[pred_mask > 0] = [1.0, 0.2, 0.2]  # Bright Red = Oil Spill
    axes[3].imshow(rgb)
    status_color = "crimson" if results["oil_pixels"] > 0 else "darkgreen"
    axes[3].set_title(f"4. Composite Overlay\n({results['status']})", fontsize=10, fontweight="bold", color=status_color)
    axes[3].axis("off")

    plt.suptitle("SIH 2026: Sentinel-1 SAR Oil Spill Segmentation", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(out_file, dpi=140, bbox_inches="tight")
    plt.close(fig)

    print(f"[SUCCESS] Output visualization saved to: {out_file}")
    print("=" * 85)


if __name__ == "__main__":
    run_cli_demo()
