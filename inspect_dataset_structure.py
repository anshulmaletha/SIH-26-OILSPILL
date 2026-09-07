"""
Dataset Inspector for Radar_data dataset.
Inspects train/images, train/masks, test/images, test/masks.
Reports file counts, matching filenames, shapes, dtypes, channel counts, mask unique values, and corrupt files.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

import numpy as np

try:
    import tifffile
    HAS_TIFFFILE = True
except ImportError:
    HAS_TIFFFILE = False

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    import rasterio
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False


def load_image_info(filepath: Path) -> Dict:
    """Read metadata and data info for image or mask file."""
    info = {
        "path": str(filepath),
        "filename": filepath.name,
        "stem": filepath.stem,
        "exists": filepath.exists(),
        "size_bytes": filepath.stat().st_size if filepath.exists() else 0,
        "is_corrupt": False,
        "error": None,
        "shape": None,
        "dtype": None,
        "channels": None,
        "min": None,
        "max": None,
        "unique_values": None,
        "reader": None
    }

    if not filepath.exists():
        info["is_corrupt"] = True
        info["error"] = "File does not exist"
        return info

    arr = None

    # 1. Try tifffile
    if HAS_TIFFFILE and filepath.suffix.lower() in (".tif", ".tiff"):
        try:
            arr_tiff = tifffile.imread(str(filepath))
            if arr_tiff is not None:
                info["reader"] = "tifffile"
                if arr_tiff.ndim == 2:
                    arr = np.expand_dims(arr_tiff, axis=0)  # (1, H, W)
                elif arr_tiff.ndim == 3:
                    # Determine if (C, H, W) or (H, W, C)
                    if arr_tiff.shape[0] < arr_tiff.shape[1] and arr_tiff.shape[0] < arr_tiff.shape[2]:
                        arr = arr_tiff
                    else:
                        arr = np.transpose(arr_tiff, (2, 0, 1))
        except Exception as e:
            info["tifffile_error"] = str(e)

    # 2. Try PIL
    if arr is None and HAS_PIL:
        try:
            pil_img = Image.open(filepath)
            arr_np = np.array(pil_img)
            info["reader"] = "pil"
            if arr_np.ndim == 2:
                arr = np.expand_dims(arr_np, axis=0)
            elif arr_np.ndim == 3:
                if arr_np.shape[0] < arr_np.shape[1] and arr_np.shape[0] < arr_np.shape[2]:
                    arr = arr_np
                else:
                    arr = np.transpose(arr_np, (2, 0, 1))
        except Exception as e:
            info["pil_error"] = str(e)

    # 3. Try OpenCV
    if arr is None and HAS_CV2:
        try:
            img = cv2.imread(str(filepath), cv2.IMREAD_UNCHANGED)
            if img is not None:
                info["reader"] = "opencv"
                if img.ndim == 2:
                    arr = np.expand_dims(img, axis=0)
                elif img.ndim == 3:
                    arr = np.transpose(img, (2, 0, 1))
        except Exception as e:
            info["opencv_error"] = str(e)

    # 4. Try rasterio
    if arr is None and HAS_RASTERIO and filepath.suffix.lower() in (".tif", ".tiff"):
        try:
            with rasterio.open(filepath) as src:
                arr = src.read()
                info["reader"] = "rasterio"
        except Exception as e:
            info["rasterio_error"] = str(e)

    if arr is None:
        info["is_corrupt"] = True
        info["error"] = "Failed to load image file using tifffile, pil, opencv, or rasterio."
        return info

    info["shape"] = list(arr.shape)  # [C, H, W]
    info["dtype"] = str(arr.dtype)
    info["channels"] = arr.shape[0]
    info["min"] = float(np.nanmin(arr)) if arr.size > 0 else None
    info["max"] = float(np.nanmax(arr)) if arr.size > 0 else None

    # Calculate unique values for masks or small arrays
    if arr.size < 50000000:
        unique_vals = np.unique(arr)
        if len(unique_vals) <= 20:
            info["unique_values"] = unique_vals.tolist()
        else:
            info["unique_values"] = [float(np.min(unique_vals)), float(np.max(unique_vals))]

    return info


def inspect_split_directory(split_name: str, base_dir: Path) -> Dict:
    """Inspect images and masks within a split (train or test)."""
    img_dir = base_dir / split_name / "images"
    mask_dir = base_dir / split_name / "masks"

    report = {
        "split": split_name,
        "img_dir": str(img_dir),
        "mask_dir": str(mask_dir),
        "img_dir_exists": img_dir.exists(),
        "mask_dir_exists": mask_dir.exists(),
        "img_file_count": 0,
        "mask_file_count": 0,
        "matched_count": 0,
        "unmatched_images": [],
        "unmatched_masks": [],
        "corrupt_files": [],
        "shapes_detected": set(),
        "dtypes_detected": set(),
        "channels_detected": set(),
        "mask_unique_values": set(),
        "sample_image_info": None,
        "sample_mask_info": None
    }

    if not img_dir.exists():
        print(f"Warning: Image directory not found: {img_dir}")
        return report

    img_extensions = ("*.tif", "*.tiff", "*.png", "*.jpg", "*.jpeg", "*.npy")
    img_files = []
    for ext in img_extensions:
        img_files.extend(list(img_dir.glob(ext)))
    img_files = sorted(list(set(img_files)))
    report["img_file_count"] = len(img_files)

    mask_files = []
    if mask_dir.exists():
        for ext in img_extensions:
            mask_files.extend(list(mask_dir.glob(ext)))
    mask_files = sorted(list(set(mask_files)))
    report["mask_file_count"] = len(mask_files)

    img_stems = {f.stem: f for f in img_files}
    mask_stems = {f.stem: f for f in mask_files}

    matched_stems = set(img_stems.keys()).intersection(set(mask_stems.keys()))
    report["matched_count"] = len(matched_stems)
    report["unmatched_images"] = [f.name for s, f in img_stems.items() if s not in matched_stems]
    report["unmatched_masks"] = [f.name for s, f in mask_stems.items() if s not in matched_stems]

    # Inspect images
    for idx, f in enumerate(img_files):
        info = load_image_info(f)
        if info["is_corrupt"]:
            report["corrupt_files"].append(str(f))
        else:
            report["shapes_detected"].add(tuple(info["shape"]))
            report["dtypes_detected"].add(info["dtype"])
            report["channels_detected"].add(info["channels"])
            if report["sample_image_info"] is None:
                report["sample_image_info"] = info

    # Inspect masks
    for idx, f in enumerate(mask_files):
        info = load_image_info(f)
        if info["is_corrupt"]:
            report["corrupt_files"].append(str(f))
        else:
            report["shapes_detected"].add(tuple(info["shape"]))
            report["dtypes_detected"].add(info["dtype"])
            if info["unique_values"] is not None:
                report["mask_unique_values"].update([str(v) for v in info["unique_values"]])
            if report["sample_mask_info"] is None:
                report["sample_mask_info"] = info

    return report


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

    print("=" * 70)
    print(" SENTINEL-1 SAR DATASET INSPECTION REPORT")
    print(f" Target Directory: {base_dir}")
    print("=" * 70)

    if not base_dir.exists():
        print(f"[ERROR] Dataset directory does not exist at: {base_dir}")
        sys.exit(1)

    train_report = inspect_split_directory("train", base_dir)
    test_report = inspect_split_directory("test", base_dir)

    print("\n--- 1. FILE COUNTS AND PAIRING ---")
    print(f" Train Split:")
    print(f"   - Images Directory : {train_report['img_dir']} (Exists: {train_report['img_dir_exists']})")
    print(f"   - Masks Directory  : {train_report['mask_dir']} (Exists: {train_report['mask_dir_exists']})")
    print(f"   - Image File Count : {train_report['img_file_count']}")
    print(f"   - Mask File Count  : {train_report['mask_file_count']}")
    print(f"   - Matched Pairs    : {train_report['matched_count']}")
    print(f"   - Unmatched Images : {len(train_report['unmatched_images'])}")
    print(f"   - Unmatched Masks  : {len(train_report['unmatched_masks'])}")

    print(f"\n Test Split:")
    print(f"   - Images Directory : {test_report['img_dir']} (Exists: {test_report['img_dir_exists']})")
    print(f"   - Masks Directory  : {test_report['mask_dir']} (Exists: {test_report['mask_dir_exists']})")
    print(f"   - Image File Count : {test_report['img_file_count']}")
    print(f"   - Mask File Count  : {test_report['mask_file_count']}")
    print(f"   - Matched Pairs    : {test_report['matched_count']}")
    print(f"   - Unmatched Images : {len(test_report['unmatched_images'])}")
    print(f"   - Unmatched Masks  : {len(test_report['unmatched_masks'])}")

    print("\n--- 2. CORRUPT / UNREADABLE FILES ---")
    total_corrupt = len(train_report['corrupt_files']) + len(test_report['corrupt_files'])
    print(f" Total Corrupt Files Found: {total_corrupt}")
    if total_corrupt > 0:
        for cf in train_report['corrupt_files'] + test_report['corrupt_files']:
            print(f"   - {cf}")

    print("\n--- 3. SAMPLE IMAGE METADATA ---")
    if train_report['sample_image_info']:
        s_img = train_report['sample_image_info']
        print(f" Train Image Sample  : {s_img['filename']}")
        print(f"   - Reader Used     : {s_img.get('reader')}")
        print(f"   - Shape (C, H, W) : {s_img['shape']}")
        print(f"   - Channels Count  : {s_img['channels']}")
        print(f"   - Data Type       : {s_img['dtype']}")
        print(f"   - Min / Max Val   : {s_img['min']} / {s_img['max']}")

    if test_report['sample_image_info']:
        s_test_img = test_report['sample_image_info']
        print(f"\n Test Image Sample   : {s_test_img['filename']}")
        print(f"   - Reader Used     : {s_test_img.get('reader')}")
        print(f"   - Shape (C, H, W) : {s_test_img['shape']}")
        print(f"   - Channels Count  : {s_test_img['channels']}")
        print(f"   - Data Type       : {s_test_img['dtype']}")
        print(f"   - Min / Max Val   : {s_test_img['min']} / {s_test_img['max']}")

    print("\n--- 4. SAMPLE MASK METADATA & UNIQUE VALUES ---")
    if train_report['sample_mask_info']:
        s_mask = train_report['sample_mask_info']
        print(f" Train Mask Sample   : {s_mask['filename']}")
        print(f"   - Reader Used     : {s_mask.get('reader')}")
        print(f"   - Shape (C, H, W) : {s_mask['shape']}")
        print(f"   - Data Type       : {s_mask['dtype']}")
        print(f"   - Min / Max Val   : {s_mask['min']} / {s_mask['max']}")
        print(f"   - Unique Values   : {sorted(list(train_report['mask_unique_values']))}")

    if test_report['sample_mask_info']:
        s_test_mask = test_report['sample_mask_info']
        print(f"\n Test Mask Sample    : {s_test_mask['filename']}")
        print(f"   - Reader Used     : {s_test_mask.get('reader')}")
        print(f"   - Shape (C, H, W) : {s_test_mask['shape']}")
        print(f"   - Data Type       : {s_test_mask['dtype']}")
        print(f"   - Min / Max Val   : {s_test_mask['min']} / {s_test_mask['max']}")
        print(f"   - Unique Values   : {sorted(list(test_report['mask_unique_values']))}")

    print("\n--- 5. DATASET STRUCTURE SUMMARY ---")
    all_img_channels = list(train_report['channels_detected'].union(test_report['channels_detected']))
    all_dtypes = list(train_report['dtypes_detected'].union(test_report['dtypes_detected']))
    all_shapes = list(train_report['shapes_detected'].union(test_report['shapes_detected']))
    print(f" Image Shapes Detected Across Dataset   : {all_shapes}")
    print(f" Image Channels Detected Across Dataset : {all_img_channels}")
    print(f" Data Types Detected Across Dataset     : {all_dtypes}")
    print("=" * 70)


if __name__ == "__main__":
    main()
