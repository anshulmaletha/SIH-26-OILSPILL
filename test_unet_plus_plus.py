"""
Unit smoke test for U-Net++ (Nested U-Net) architecture.
Verifies forward pass shape, configurable 1-channel and 2-channel input support, and 1-channel logit output shape [1, 1, 256, 256].
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))


def test_unet_plus_plus_forward():
    """Pass random tensors (1-channel and 2-channel) through UNetPlusPlus and verify output shape [1, 1, 256, 256]."""
    try:
        import torch
        from src.models.unet_plus_plus import UNetPlusPlus
    except ImportError as e:
        print(f"[FAIL] Missing PyTorch: {e}")
        sys.exit(1)

    print("=" * 60)
    print(" U-NET++ MODEL SMOKE TEST (1-CHANNEL & 2-CHANNEL)")
    print("=" * 60)

    # 1. Test Default 2-channel (VV + VH) input
    model_2ch = UNetPlusPlus(in_channels=2, out_channels=1)
    model_2ch.eval()

    with torch.no_grad():
        input_2ch = torch.randn(1, 2, 256, 256)
        out_2ch = model_2ch(input_2ch)
        print(f"  [2-Channel] Input Shape: {list(input_2ch.shape)} -> Logits Output Shape: {list(out_2ch.shape)}")
        assert out_2ch.shape == (1, 1, 256, 256), f"Expected (1, 1, 256, 256), got {out_2ch.shape}"

    # 2. Test 1-channel development dataset input
    model_1ch = UNetPlusPlus(in_channels=1, out_channels=1)
    model_1ch.eval()

    with torch.no_grad():
        input_1ch = torch.randn(1, 1, 256, 256)
        out_1ch = model_1ch(input_1ch)
        print(f"  [1-Channel] Input Shape: {list(input_1ch.shape)} -> Logits Output Shape: {list(out_1ch.shape)}")
        assert out_1ch.shape == (1, 1, 256, 256), f"Expected (1, 1, 256, 256), got {out_1ch.shape}"

    print("=" * 60)
    print(" [OK] U-Net++ smoke test (1ch & 2ch) PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    test_unet_plus_plus_forward()
