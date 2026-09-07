"""
Smoke test for U-Net training pipeline, loss functions, and evaluation metrics.
Uses random tensors in memory without disk artifacts, synthetic training, or accuracy claims.
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))


def test_pipeline_smoke():
    """Run model-only smoke test on losses, metrics, optimizer, and training steps."""
    try:
        import torch
        import torch.optim as optim
        from torch.optim.lr_scheduler import ReduceLROnPlateau
        from src.models.unet import UNet
        from src.training.losses import BCEDiceLoss, DiceLoss
        from src.evaluation.metrics import calculate_segmentation_metrics
        from src.training.train import train_one_epoch, validate_one_epoch, EarlyStopping
    except ImportError as e:
        print(f"[FAIL] Missing required module for training smoke test: {e}")
        sys.exit(1)

    print("=" * 60)
    print(" TRAINING PIPELINE SMOKE TEST")
    print("=" * 60)

    # 1. Instantiate Model & Loss
    model = UNet(in_channels=2, out_channels=1)
    criterion = BCEDiceLoss(bce_weight=0.5, dice_weight=0.5)
    optimizer = optim.AdamW(model.parameters(), lr=1e-3)
    scheduler = ReduceLROnPlateau(optimizer, mode="min")
    early_stopping = EarlyStopping(patience=3)

    # 2. Random tensor batch (Batch size 2, 2 channels, 64x64 height/width)
    x = torch.randn(2, 2, 64, 64)
    y = torch.randint(0, 2, (2, 1, 64, 64)).float()

    # 3. Model forward pass & loss computation
    outputs = model(x)
    loss = criterion(outputs, y)
    assert not torch.isnan(loss), "Loss computed to NaN"
    assert loss.item() > 0, "Loss should be positive"
    print(f"  Forward Pass Loss Value     : {loss.item():.4f}")

    # 4. Backward pass & optimizer step
    optimizer.zero_grad()
    loss.backward()
    
    # Verify gradients computed
    has_grads = any(p.grad is not None for p in model.parameters())
    assert has_grads, "Gradients were not computed properly in backward pass"
    optimizer.step()
    scheduler.step(loss.item())
    print("  Backward Pass & Grad Step  : [OK]")

    # 5. Verify segmentation metrics computation
    metrics = calculate_segmentation_metrics(outputs.detach(), y)
    required_metrics = ["dice", "iou", "precision", "recall", "f1"]
    for m in required_metrics:
        assert m in metrics, f"Metric '{m}' missing from outputs"
        assert 0.0 <= metrics[m] <= 1.0, f"Metric '{m}' out of valid range [0, 1]: {metrics[m]}"
    print(f"  Calculated Metrics Keys    : {list(metrics.keys())}")
    print("  Metrics Computation        : [OK]")

    # 6. Verify early stopping helper logic
    st = early_stopping(val_score=0.5)
    assert st is True
    print("  Early Stopping Handler     : [OK]")

    print("=" * 60)
    print(" [OK] Training pipeline smoke test PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    test_pipeline_smoke()
