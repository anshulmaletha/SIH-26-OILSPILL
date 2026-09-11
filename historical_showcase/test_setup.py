"""
Basic Test Script for SIH26143 Sentinel-1 SAR Oil-Spill Segmentation Project.
Verifies project modules, imports, and configuration without dataset or disk artifacts.
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))


def print_banner(title: str):
    print("\n" + "=" * 60)
    print(f" {title}")
    print("=" * 60)


def test_imports():
    """Check availability of required third-party dependencies."""
    print_banner("1. CHECKING DEPENDENCY IMPORTS")
    dependencies = [
        ("torch", "PyTorch"),
        ("numpy", "NumPy"),
        ("pandas", "Pandas"),
        ("rasterio", "Rasterio (Optional GIS reader)"),
        ("tifffile", "Tifffile (TIFF reader)"),
        ("matplotlib", "Matplotlib"),
        ("sklearn", "Scikit-Learn"),
        ("cv2", "OpenCV"),
    ]
    
    missing = []
    for pkg, label in dependencies:
        try:
            __import__(pkg)
            print(f"  [OK] {label:<35} (module: {pkg})")
        except ImportError:
            print(f"  [MISSING] {label:<31} (module: {pkg})")
            missing.append(pkg)
            
    if missing:
        print(f"\n  Note: Install missing dependencies via: pip install -r requirements.txt")
    return missing


def test_config():
    """Verify configuration settings and path declarations."""
    print_banner("2. TESTING PROJECT CONFIGURATION")
    from src.config import Config, get_default_config, RAW_DATA_DIR, SAMPLE_DATA_DIR, RESULTS_DIR, MODELS_DIR

    cfg = get_default_config()
    print(f"  Project Base Directory : {cfg.dataset.raw_data_dir.parent.parent}")
    print(f"  Raw Data Directory     : {RAW_DATA_DIR}")
    print(f"  Sample Data Directory  : {SAMPLE_DATA_DIR}")
    print(f"  Results Directory      : {RESULTS_DIR}")
    print(f"  Models Directory       : {MODELS_DIR}")
    print(f"  Configured Channels    : {cfg.dataset.channels}")
    print(f"  Default Image Size     : {cfg.dataset.image_size}")
    print(f"  dB Clip Bounds (VV)    : {cfg.normalization.clip_vv} dB")
    
    assert RAW_DATA_DIR.name == "raw"
    assert RESULTS_DIR.name == "results"
    assert cfg.dataset.channels == ["VV"]
    assert cfg.model.in_channels == 1
    assert cfg.model.features == 16
    print("  [OK] Configuration loaded and validated.")


def test_project_modules():
    """Verify loading and syntax of project source modules."""
    print_banner("3. TESTING PROJECT MODULE INTEGRITY")

    # 1. Test dataset_inspector
    from src.data.dataset_inspector import inspect_array
    import numpy as np
    dummy_arr = np.array([[-15.0, -10.0], [-20.0, np.nan]], dtype=np.float32)
    report = inspect_array(dummy_arr, name="InMemoryTest")
    assert report["nan_count"] == 1
    assert report["shape"] == [2, 2]
    print("  [OK] src.data.dataset_inspector loaded & verified.")

    # 2. Test normalization
    from src.preprocessing.normalization import SARNormalizer, clean_invalid_values, clip_sar_db
    cleaned = clean_invalid_values(dummy_arr, fill_value=0.0)
    assert not np.isnan(cleaned).any()
    clipped = clip_sar_db(cleaned, min_db=-35.0, max_db=0.0)
    assert np.all(clipped >= -35.0) and np.all(clipped <= 0.0)

    norm = SARNormalizer()
    norm.fit_from_samples([np.zeros((10, 10), dtype=np.float32)], [np.zeros((10, 10), dtype=np.float32)])
    assert norm.is_fitted
    print("  [OK] src.preprocessing.normalization loaded & verified.")

    # 3. Test dataset module import & instantiation
    from src.data.dataset import SAROilSpillDataset
    ds = SAROilSpillDataset()
    assert len(ds) == 0
    print("  [OK] src.data.dataset loaded & verified.")

    # 4. Test visualize_dataset module import
    from src.data.visualize_dataset import visualize_sample
    print("  [OK] src.data.visualize_dataset loaded & verified.")


def main():
    print("=" * 60)
    print(" SIH26143 SENTINEL-1 SAR OIL-SPILL PROJECT TEST SUITE")
    print("=" * 60)

    missing = test_imports()
    test_config()
    
    if "numpy" in missing:
        print("\n  [SKIP] Module integrity test requires numpy. Install requirements.txt to run in-memory verification.")
    else:
        test_project_modules()

    print_banner("TEST RUN COMPLETE")


if __name__ == "__main__":
    main()
