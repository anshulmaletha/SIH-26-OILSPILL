"""
Sentinel-1 SAR Dataset Inspector.
Analyzes TIFF files or numpy arrays to report metadata, shape, dtypes, statistics,
and invalid value statistics (NaN, Inf, NoData).
"""

import argparse
import sys
from pathlib import Path
from typing import Dict, Any, Union, Optional

import numpy as np

try:
    import rasterio
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


def inspect_array(arr: np.ndarray, name: str = "Array") -> Dict[str, Any]:
    """
    Inspect a numpy array and return numerical statistics and validity metrics.

    Args:
        arr: Input numpy array.
        name: Identifier label for reporting.

    Returns:
        Dict containing array analysis.
    """
    nan_count = int(np.isnan(arr).sum())
    inf_count = int(np.isinf(arr).sum())
    total_elements = arr.size
    
    # Calculate valid data statistics
    valid_mask = ~(np.isnan(arr) | np.isinf(arr))
    valid_elements = int(valid_mask.sum())

    if valid_elements > 0:
        valid_data = arr[valid_mask]
        min_val = float(np.min(valid_data))
        max_val = float(np.max(valid_data))
        mean_val = float(np.mean(valid_data))
        std_val = float(np.std(valid_data))
    else:
        min_val = max_val = mean_val = std_val = float('nan')

    report = {
        "name": name,
        "shape": list(arr.shape),
        "ndim": arr.ndim,
        "dtype": str(arr.dtype),
        "total_pixels": total_elements,
        "channels": arr.shape[0] if arr.ndim == 3 else 1,
        "min": min_val,
        "max": max_val,
        "mean": mean_val,
        "std": std_val,
        "nan_count": nan_count,
        "inf_count": inf_count,
        "valid_percent": round((valid_elements / total_elements) * 100, 2) if total_elements > 0 else 0.0
    }
    return report


def inspect_tiff(file_path: Union[str, Path]) -> Dict[str, Any]:
    """
    Inspect a Sentinel-1 TIFF file and report image parameters and data quality.

    Args:
        file_path: Path to TIFF file.

    Returns:
        Dictionary containing file metadata and channel statistics.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    metadata = {
        "file_path": str(path),
        "file_size_bytes": path.stat().st_size,
        "reader": "none",
        "crs": None,
        "nodata": None,
        "channels_info": []
    }

    data: Optional[np.ndarray] = None

    if HAS_RASTERIO:
        try:
            with rasterio.open(path) as src:
                metadata["reader"] = "rasterio"
                metadata["crs"] = str(src.crs) if src.crs else None
                metadata["nodata"] = src.nodata
                data = src.read()  # Shape: (channels, height, width)
        except Exception as e:
            metadata["rasterio_error"] = str(e)

    if data is None and HAS_CV2:
        try:
            img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
            if img is not None:
                metadata["reader"] = "opencv"
                if img.ndim == 2:
                    data = np.expand_dims(img, axis=0)
                else:
                    data = np.transpose(img, (2, 0, 1))
        except Exception as e:
            metadata["opencv_error"] = str(e)

    if data is None and path.suffix.lower() == ".npy":
        try:
            arr = np.load(path)
            metadata["reader"] = "numpy"
            if arr.ndim == 2:
                data = np.expand_dims(arr, axis=0)
            else:
                data = arr
        except Exception as e:
            metadata["numpy_error"] = str(e)

    if data is None:
        raise RuntimeError(f"Could not load TIFF image from {path}. Install rasterio or opencv-python.")

    metadata["shape"] = list(data.shape)
    metadata["dtype"] = str(data.dtype)
    num_channels = data.shape[0]

    for c in range(num_channels):
        ch_report = inspect_array(data[c], name=f"Channel_{c+1}")
        metadata["channels_info"].append(ch_report)

    return metadata


def print_inspection_report(report: Dict[str, Any]) -> None:
    """Print inspection report in structured text format."""
    print("=" * 60)
    print(f" SENTINEL-1 DATASET INSPECTION REPORT")
    print("=" * 60)
    if "file_path" in report:
        print(f" File Path   : {report['file_path']}")
        print(f" File Size   : {report['file_size_bytes'] / (1024*1024):.2f} MB")
        print(f" Reader Used : {report['reader']}")
        print(f" CRS         : {report['crs']}")
        print(f" NoData Val  : {report['nodata']}")
    print(f" Shape       : {report.get('shape')}")
    print(f" Data Type   : {report.get('dtype')}")
    print("-" * 60)

    for ch_info in report.get("channels_info", []):
        print(f" [{ch_info['name']}]")
        print(f"  - Dimensions   : {ch_info['shape']}")
        print(f"  - Min / Max    : {ch_info['min']:.4f} / {ch_info['max']:.4f}")
        print(f"  - Mean / Std   : {ch_info['mean']:.4f} / {ch_info['std']:.4f}")
        print(f"  - NaN Count    : {ch_info['nan_count']}")
        print(f"  - Inf Count    : {ch_info['inf_count']}")
        print(f"  - Valid Data % : {ch_info['valid_percent']}%")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Inspect Sentinel-1 SAR TIFF files.")
    parser.add_argument("file_path", type=str, help="Path to TIFF or SAR image file")
    args = parser.parse_args()

    try:
        report = inspect_tiff(args.file_path)
        print_inspection_report(report)
    except Exception as e:
        print(f"Error inspecting dataset: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
