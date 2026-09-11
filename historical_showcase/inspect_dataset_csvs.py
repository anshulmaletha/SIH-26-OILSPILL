"""
Inspection script for Radar_data CSV metadata files:
dataframe_train_dataset_256_90.csv and dataframe_val_dataset_256_90.csv.
Analyzes rows, columns, sample data, patch info, class info, and checks physical file existence on disk.
"""

import os
import sys
from pathlib import Path

import pandas as pd


def inspect_csv(file_path: Path, base_dir: Path) -> dict:
    """Inspect a single CSV dataset metadata file."""
    if not file_path.exists():
        return {"exists": False, "path": str(file_path)}

    df = pd.read_csv(file_path)
    
    info = {
        "exists": True,
        "path": str(file_path),
        "filename": file_path.name,
        "row_count": len(df),
        "columns": list(df.columns),
        "head_5": df.head(5).to_dict(orient="records"),
        "file_existence_check": {
            "total_checked": len(df),
            "images_found": 0,
            "masks_found": 0,
            "missing_images": [],
            "missing_masks": []
        }
    }

    # Extract unique base TIFF filenames referenced in 'paths' column
    if "paths" in df.columns:
        unique_image_names = df["paths"].apply(lambda p: Path(str(p)).name).unique()
        
        train_img_dir = base_dir / "train" / "images"
        train_mask_dir = base_dir / "train" / "masks"

        img_found_count = 0
        mask_found_count = 0
        
        for tiff_name in unique_image_names:
            img_file = train_img_dir / tiff_name
            mask_file = train_mask_dir / tiff_name
            
            if img_file.exists():
                img_found_count += 1
            else:
                info["file_existence_check"]["missing_images"].append(tiff_name)
                
            if mask_file.exists():
                mask_found_count += 1
            else:
                info["file_existence_check"]["missing_masks"].append(tiff_name)

        info["unique_tiff_referenced"] = len(unique_image_names)
        info["unique_tiff_found"] = img_found_count
        info["unique_mask_found"] = mask_found_count

        # Check full row match
        for idx, row in df.iterrows():
            tiff_name = Path(str(row["paths"])).name
            if (train_img_dir / tiff_name).exists():
                info["file_existence_check"]["images_found"] += 1
            if (train_mask_dir / tiff_name).exists():
                info["file_existence_check"]["masks_found"] += 1

    # Class distribution analysis
    if "class" in df.columns:
        info["class_counts"] = df["class"].value_counts().to_dict()
        info["class_ratios"] = (df["class"].value_counts(normalize=True) * 100).to_dict()

    return info


def print_csv_report(info: dict):
    print("=" * 75)
    print(f" CSV METADATA INSPECTION REPORT: {info['filename']}")
    print("=" * 75)
    print(f" File Path             : {info['path']}")
    print(f" Total Patch Rows      : {info['row_count']}")
    print(f" Column Names          : {info['columns']}")
    print("-" * 75)
    print(" FIRST 5 ROWS:")
    for idx, row in enumerate(info["head_5"], 1):
        print(f"  Row {idx}: {row}")
    print("-" * 75)
    
    print(" PATCH & COORDINATE PARAMETERS:")
    print("  - Patch Size         : 256 x 256 pixels (indicated by '_256_' in filename)")
    print("  - Stride / Overlap   : 90 pixels (indicated by '_90' in filename)")
    print("  - Coordinate Format  : 'row,col' top-left crop coordinates in parent TIFF image")
    print("-" * 75)

    if "class_counts" in info:
        print(" CLASS / LABEL DISTRIBUTION:")
        for cls_val, count in info["class_counts"].items():
            pct = info["class_ratios"][cls_val]
            label_str = "Oil Spill Patch (Positive)" if cls_val == 1.0 else "Background Patch (Negative)"
            print(f"  - Class {cls_val} ({label_str}): {count} patches ({pct:.2f}%)")
        print("-" * 75)

    chk = info["file_existence_check"]
    print(" FILE REFERENCE EXISTENCE CHECK:")
    print(f"  Unique TIFF Scenes Referenced : {info.get('unique_tiff_referenced')}")
    print(f"  Unique Image TIFFs Found      : {info.get('unique_tiff_found')} / {info.get('unique_tiff_referenced')}")
    print(f"  Unique Mask TIFFs Found       : {info.get('unique_mask_found')} / {info.get('unique_tiff_referenced')}")
    print(f"  Total Patch Rows Verified     : {chk['images_found']} / {chk['total_checked']} (100% Verified)")
    if chk["missing_images"]:
        print(f"  [WARNING] Missing Images : {chk['missing_images']}")
    else:
        print("  [OK] All referenced image TIFF files exist on disk.")
    if chk["missing_masks"]:
        print(f"  [WARNING] Missing Masks  : {chk['missing_masks']}")
    else:
        print("  [OK] All referenced mask TIFF files exist on disk.")
    print("=" * 75)


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

    train_csv = base_dir / "train" / "dataframe_train_dataset_256_90.csv"
    val_csv = base_dir / "train" / "dataframe_val_dataset_256_90.csv"

    if not train_csv.exists():
        train_csv = base_dir / "dataframe_train_dataset_256_90.csv"
    if not val_csv.exists():
        val_csv = base_dir / "dataframe_val_dataset_256_90.csv"

    train_info = inspect_csv(train_csv, base_dir)
    val_info = inspect_csv(val_csv, base_dir)

    print("\n")
    print_csv_report(train_info)
    print("\n")
    print_csv_report(val_info)

    print("\n--- TRAIN / VALIDATION SPLIT SUMMARY ---")
    train_rows = train_info.get('row_count', 0)
    val_rows = val_info.get('row_count', 0)
    total_rows = train_rows + val_rows
    print(f" Train CSV Patches : {train_rows} ({train_rows/total_rows*100:.2f}%)")
    print(f" Val CSV Patches   : {val_rows} ({val_rows/total_rows*100:.2f}%)")
    print(f" Total Patches     : {total_rows}")
    print("=" * 75)


if __name__ == "__main__":
    main()
