"""
End-to-end smoke test for integrated segmentation pipeline.
Verifies pipeline execution for both U-Net and U-Net++ models using 1-channel and 2-channel inputs with random tensors in memory.
"""

import sys
from pathlib import Path

# Add project root directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))


def test_integrated_pipeline_smoke():
    try:
        import torch
        import numpy as np
        from torch.utils.data import DataLoader, TensorDataset
        from src.config import Config
        from src.pipeline import SegmentationPipeline
        from src.preprocessing.sar_preprocessor import SARPreprocessor
    except ImportError as e:
        print(f"[FAIL] Missing required module for integrated pipeline smoke test: {e}")
        sys.exit(1)

    print("=" * 65)
    print(" INTEGRATED PIPELINE SMOKE TEST (1-CHANNEL & 2-CHANNEL)")
    print("=" * 65)

    models_to_verify = ["unet", "unet_plus_plus"]
    channels_to_test = [1, 2]

    for channels in channels_to_test:
        print(f"\n==================== Testing {channels}-Channel Input ====================")
        images_tensor = torch.randn(2, channels, 64, 64) * 10.0 - 15.0
        masks_tensor = torch.randint(0, 2, (2, 1, 64, 64)).float()

        dataset = TensorDataset(images_tensor, masks_tensor)
        dataloader = DataLoader(dataset, batch_size=2)
        sample_input = images_tensor[0]

        for model_name in models_to_verify:
            print(f"\n--- Model: '{model_name}', in_channels={channels} ---")
            
            cfg = Config()
            cfg.model.model_name = model_name
            cfg.model.in_channels = channels
            cfg.model.out_channels = 1

            preprocessor = SARPreprocessor()
            preprocessor.fit([sample_input.numpy()])

            pipeline = SegmentationPipeline(config=cfg, preprocessor=preprocessor)

            # Evaluate DataLoader
            val_results = pipeline.evaluate_dataloader(dataloader, mode="val")
            assert "val_loss" in val_results and "val_dice" in val_results

            # Single Sample Inference
            pred_res = pipeline.predict(sample_input)
            prob_map = pred_res["probability_map"]
            bin_mask = pred_res["binary_mask"]

            assert prob_map.shape == (64, 64)
            assert bin_mask.shape == (64, 64)
            assert bin_mask.dtype == np.uint8

            print(f"  [OK] Evaluated loss: {val_results['val_loss']:.4f}, dice: {val_results['val_dice']:.4f}")
            print(f"  [OK] Single sample prediction output mask shape: {bin_mask.shape}")

    print("\n" + "=" * 65)
    print(" [OK] Integrated Pipeline smoke test (1ch & 2ch) PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    test_integrated_pipeline_smoke()
