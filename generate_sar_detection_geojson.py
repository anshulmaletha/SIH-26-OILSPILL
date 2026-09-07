"""
Generate Stage 1 SAR Oil Slick GeoJSON vector output from U-Net full-scene binary mask.
Runs on existing full-scene validation example 20200224.tif.
Outputs results/demo_outputs/sar_detection_output.json.
"""

import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.inference import OilSpillInferenceEngine


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
        print(f"[ERROR] Validation scene not found at: {img_path}")
        sys.exit(1)

    print(f"[INFO] Initializing OilSpillInferenceEngine...")
    engine = OilSpillInferenceEngine()

    print(f"[INFO] Running full-scene U-Net inference and slick vectorization on: {img_path.name}...")
    res = engine.detect_and_vectorize(img_path, is_preprocessed=False, min_area_pixels=50)

    out_dir = PROJECT_ROOT / "results" / "demo_outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_json = out_dir / "sar_detection_output.json"

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(res["geojson"], f, indent=2)

    geom_feats = res["geojson"]["geometry_features"]
    poly_count = geom_feats["total_slicks_detected"]
    print("=" * 80)
    print(" STAGE 1 GEOJSON VECTOR EXTRACTION COMPLETED")
    print("=" * 80)
    print(f" Source Image      : {res['source_name']}")
    print(f" Image Dimensions  : {res['dimensions'][0]} x {res['dimensions'][1]} px")
    print(f" Total Polygons    : {poly_count}")
    print(f" Total Oil Area    : {geom_feats['total_area_km2']:.4f} km²")
    print(f" Mean Confidence   : {res['geojson']['confidence']*100:.2f}%")
    print(f" Output JSON Path  : {out_json}")
    print("=" * 80)


if __name__ == "__main__":
    main()
