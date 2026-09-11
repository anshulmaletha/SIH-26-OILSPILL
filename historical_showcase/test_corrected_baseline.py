"""
Lightweight tests for mask-based sampling, alignment, empty-target loss, and U-Net forward.
Does not train a full model and does not touch Radar_data/test/.
"""

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
import pandas as pd
import torch

from src.data.windowed_dataset import SARPatchDataset, classify_mask_occupancy
from src.evaluation.metrics import calculate_segmentation_metrics
from src.models.unet import UNet
from src.training.losses import BCEDiceLoss, DiceLoss


def _train_dir() -> Path:
    for env_var in ["SAR_DATA_DIR", "DATA_DIR"]:
        if env_var in os.environ and os.environ[env_var].strip():
            p = Path(os.environ[env_var].strip())
            if p.exists():
                return p / "train" if (p / "train").exists() else p
    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        p = Path(user_profile) / "Downloads" / "Radar_data" / "train"
        if p.exists():
            return p
    default_p = PROJECT_ROOT / "data" / "raw"
    return default_p


def test_dataset_loader():
    train_dir = _train_dir()
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"
    assert csv_file.exists(), f"Missing {csv_file}"
    ds = SARPatchDataset(csv_file, data_dir=train_dir, patch_size=256, return_dict=True)
    item = ds[0]
    assert item["image"].shape == (1, 256, 256)
    assert item["mask"].shape == (1, 256, 256)
    assert set(torch.unique(item["mask"]).tolist()).issubset({0.0, 1.0})
    print("[OK] dataset loader: 1x256x256 image/mask, binary mask")


def test_mask_image_alignment():
    train_dir = _train_dir()
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"
    ds = SARPatchDataset(csv_file, data_dir=train_dir, patch_size=256, return_dict=True)
    found = False
    for i in range(min(200, len(ds))):
        item = ds[i]
        if item["mask"].sum() > 0:
            r, c = item["crop_coords"]
            assert item["image"].shape[-2:] == item["mask"].shape[-2:]
            assert item["image"].shape == (1, 256, 256)
            print(f"[OK] alignment: same crop ({r},{c}) for image and mask on {item['source_tiff']}")
            found = True
            break
    assert found, "Could not find a non-empty mask in the first 200 patches"


def test_sampling_distribution():
    train_dir = _train_dir()
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"
    df = pd.read_csv(csv_file)
    # Classify a deterministic slice for speed, then verify 1:1 construction.
    sample_df = df.iloc[:800].reset_index(drop=True)
    pos, neg = classify_mask_occupancy(sample_df, train_dir, patch_size=256)
    assert len(pos) + len(neg) == len(sample_df)

    ds = SARPatchDataset(sample_df, data_dir=train_dir, patch_size=256, return_dict=False)
    for idx in pos[:8]:
        _, mask = ds[int(idx)]
        assert mask.sum() > 0, "Positive index must have mask_crop.sum() > 0"
    for idx in neg[:8]:
        _, mask = ds[int(idx)]
        assert mask.sum() == 0, "Negative index must have mask_crop.sum() == 0"

    n = min(len(pos), len(neg), 32)
    rng = np.random.RandomState(0)
    sel_pos = rng.choice(pos, size=n, replace=False)
    sel_neg = rng.choice(neg, size=n, replace=False)
    assert len(sel_pos) == len(sel_neg)
    print(f"[OK] sampling distribution: slice pos={len(pos)} neg={len(neg)}; 1:1 draw {n}:{n}")


def test_loss_empty_and_nonempty():
    criterion = BCEDiceLoss(bce_weight=0.5, dice_weight=0.5)
    dice = DiceLoss()

    empty = torch.zeros(2, 1, 32, 32)
    nonempty = torch.zeros(2, 1, 32, 32)
    nonempty[:, :, 4:12, 4:12] = 1.0

    high_fp = torch.full((2, 1, 32, 32), 3.0)   # sigmoid ~ 0.95
    low_fp = torch.full((2, 1, 32, 32), -4.0)   # sigmoid ~ 0.018
    good_pos = torch.full((2, 1, 32, 32), -4.0)
    good_pos[:, :, 4:12, 4:12] = 4.0

    empty_high = dice(high_fp, empty).item()
    empty_low = dice(low_fp, empty).item()
    assert empty_high > empty_low, f"Empty GT must penalize FP more: {empty_high} vs {empty_low}"

    pos_good = dice(good_pos, nonempty).item()
    pos_bad = dice(low_fp, nonempty).item()
    assert pos_good < pos_bad, f"Non-empty GT must reward oil pixels: {pos_good} vs {pos_bad}"

    combo_high = criterion(high_fp, empty).item()
    combo_low = criterion(low_fp, empty).item()
    assert combo_high > combo_low
    assert not np.isnan(combo_high)

    # Metrics: empty+empty -> 1; empty+pred -> 0
    m_ok = calculate_segmentation_metrics(low_fp, empty, threshold=0.5)
    m_fp = calculate_segmentation_metrics(high_fp, empty, threshold=0.5)
    assert m_ok["dice"] == 1.0
    assert m_fp["dice"] == 0.0

    mixed_t = torch.cat([empty[:1], nonempty[:1]], dim=0)
    mixed_p = torch.cat([low_fp[:1], good_pos[:1]], dim=0)
    mixed = calculate_segmentation_metrics(mixed_p, mixed_t, threshold=0.5)
    assert 0.0 <= mixed["dice"] <= 1.0
    print("[OK] loss/metrics: empty FP penalized; empty+empty Dice=1; empty+FP Dice=0")


def test_model_forward():
    model = UNet(in_channels=1, out_channels=1, features=16)
    x = torch.randn(2, 1, 256, 256)
    logits = model(x)
    assert logits.shape == (2, 1, 256, 256)
    # Raw logits: values may be outside [0, 1]
    y = torch.zeros(2, 1, 256, 256)
    y[0, 0, 10:20, 10:20] = 1.0
    loss = BCEDiceLoss()(logits, y)
    loss.backward()
    assert not torch.isnan(loss)
    print(f"[OK] U-Net forward: {tuple(logits.shape)}, loss={loss.item():.4f}")


if __name__ == "__main__":
    print("=" * 70)
    print(" CORRECTED BASELINE LIGHTWEIGHT TESTS")
    print("=" * 70)
    test_dataset_loader()
    test_mask_image_alignment()
    test_sampling_distribution()
    test_loss_empty_and_nonempty()
    test_model_forward()
    print("=" * 70)
    print(" [OK] All lightweight tests PASSED")
    print("=" * 70)
