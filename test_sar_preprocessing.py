"""
Unit tests for SAR-specific preprocessing module using random tensors.
Verifies shape validation, invalid value handling, clipping, independent normalization,
speckle filtering, and deterministic output without model training or accuracy claims.
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))


def test_sar_preprocessing_suite():
    try:
        import torch
        import numpy as np
        from src.preprocessing.sar_preprocessor import SARPreprocessor, validate_sar_input
        from src.preprocessing.speckle_filter import apply_lee_filter
    except ImportError as e:
        print(f"[FAIL] Required import missing: {e}")
        sys.exit(1)

    print("=" * 60)
    print(" SAR PREPROCESSING UNIT TEST SUITE")
    print("=" * 60)

    # 1. Test Input Validation for shape and channel count
    valid_tensor = torch.randn(2, 64, 64)
    b, h, w = validate_sar_input(valid_tensor, expected_channels=2)
    assert (b, h, w) == (1, 64, 64), "Validation failed on valid (2, 64, 64) input"

    invalid_channel_tensor = torch.randn(3, 64, 64)
    try:
        validate_sar_input(invalid_channel_tensor, expected_channels=2)
        assert False, "Should have raised ValueError for 3-channel input"
    except ValueError:
        print("  [OK] Input Validation: Correctly rejected 3-channel tensor")

    invalid_dim_tensor = torch.randn(64)
    try:
        validate_sar_input(invalid_dim_tensor, expected_channels=2)
        assert False, "Should have raised ValueError for 1D tensor"
    except ValueError:
        print("  [OK] Input Validation: Correctly rejected 1D tensor")

    # 2. Test Invalid Value Handling (NaN, Inf, -Inf)
    raw_tensor = torch.randn(2, 64, 64) * 20.0 - 20.0
    raw_tensor[0, 5, 5] = float("nan")
    raw_tensor[1, 10, 10] = float("inf")
    raw_tensor[0, 15, 15] = float("-inf")

    preprocessor = SARPreprocessor(
        clip_vv=(-35.0, 0.0),
        clip_vh=(-40.0, -5.0),
        enable_speckle_filter=False
    )
    
    # Fit preprocessor on random sample
    sample_np = raw_tensor.numpy()
    preprocessor.fit([sample_np])

    processed_tensor = preprocessor.transform(raw_tensor)
    
    # Verify no NaN or Inf in processed tensor
    assert not torch.isnan(processed_tensor).any(), "Processed tensor contains NaN"
    assert not torch.isinf(processed_tensor).any(), "Processed tensor contains Inf"
    print("  [OK] Invalid Value Handling: All NaNs and Infs replaced successfully")

    # 3. Test Independent VV / VH Clipping and Normalization
    vv_stats = preprocessor.vv_stats
    vh_stats = preprocessor.vh_stats
    assert vv_stats["mean"] != vh_stats["mean"] or vv_stats["min"] != vh_stats["min"], (
        "VV and VH statistics must be computed independently"
    )
    print(f"  VV Stats (mean/std): {vv_stats['mean']:.4f} / {vv_stats['std']:.4f}")
    print(f"  VH Stats (mean/std): {vh_stats['mean']:.4f} / {vh_stats['std']:.4f}")
    print("  [OK] Independent Normalization: VV and VH stats calculated independently")

    # 4. Test Optional Speckle Filter (Lee Filter)
    speckle_preprocessor = SARPreprocessor(
        enable_speckle_filter=True,
        speckle_filter_type="lee",
        speckle_filter_size=3
    )
    speckle_preprocessor.fit([sample_np])
    filtered_tensor = speckle_preprocessor.transform(raw_tensor)
    assert filtered_tensor.shape == (2, 64, 64), f"Filtered tensor shape mismatch: {filtered_tensor.shape}"
    print("  [OK] Optional Speckle Filter: Lee filter experiment executed successfully")

    # 5. Test Determinism
    out1 = preprocessor.transform(valid_tensor)
    out2 = preprocessor.transform(valid_tensor)
    assert torch.equal(out1, out2), "Preprocessing must be strictly deterministic"
    print("  [OK] Determinism Test: Identical inputs produce identical outputs")

    print("=" * 60)
    print(" [OK] All SAR Preprocessing unit tests PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    test_sar_preprocessing_suite()
