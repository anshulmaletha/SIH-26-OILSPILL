"""
Normalization and Preprocessing utilities for Sentinel-1 SAR imagery.
Calculates statistics exclusively from training data.
"""

import json
from pathlib import Path
from typing import Dict, Optional, Tuple, Union

import numpy as np
import torch


def clean_invalid_values(
    arr: np.ndarray,
    fill_value: float = 0.0,
    nodata_value: Optional[float] = None
) -> np.ndarray:
    """
    Replace NaN, Inf, and specified nodata values in a SAR numpy array.

    Args:
        arr: Input numpy array.
        fill_value: Value to replace invalid entries with.
        nodata_value: Optional specific nodata marker to replace.

    Returns:
        Cleaned numpy array (float32).
    """
    arr_clean = np.copy(arr).astype(np.float32)
    invalid_mask = np.isnan(arr_clean) | np.isinf(arr_clean)
    if nodata_value is not None:
        invalid_mask |= np.isclose(arr_clean, nodata_value)
    arr_clean[invalid_mask] = fill_value
    return arr_clean


def clip_sar_db(
    arr: np.ndarray,
    min_db: float = -35.0,
    max_db: float = 0.0
) -> np.ndarray:
    """
    Clip SAR decibel (dB) values within a realistic physical dynamic range.

    Args:
        arr: Input SAR array in dB.
        min_db: Minimum dB threshold.
        max_db: Maximum dB threshold.

    Returns:
        Clipped array.
    """
    return np.clip(arr, min_db, max_db)


def zscore_normalize(
    arr: np.ndarray,
    mean: float,
    std: float,
    eps: float = 1e-7
) -> np.ndarray:
    """
    Z-score standardization: (x - mean) / (std + eps).
    """
    return (arr - mean) / (std + eps)


def minmax_normalize(
    arr: np.ndarray,
    min_val: float,
    max_val: float,
    eps: float = 1e-7
) -> np.ndarray:
    """
    Min-Max scaling to [0, 1]: (x - min) / (max - min + eps).
    """
    return (arr - min_val) / (max_val - min_val + eps)


class SARNormalizer:
    """
    Normalizer class for Sentinel-1 SAR images (VV and VH channels).
    Maintains statistics derived ONLY from the training dataset.
    """

    def __init__(
        self,
        clip_min_db: float = -35.0,
        clip_max_db: float = 0.0,
        strategy: str = "zscore",
        fill_value: float = 0.0
    ):
        """
        Args:
            clip_min_db: Lower clipping boundary in dB.
            clip_max_db: Upper clipping boundary in dB.
            strategy: Normalization strategy ('zscore' or 'minmax').
            fill_value: Replacement value for NaNs/Infs.
        """
        self.clip_min_db = clip_min_db
        self.clip_max_db = clip_max_db
        self.strategy = strategy
        self.fill_value = fill_value
        
        # Statistics dictionary populated strictly during fitting
        self.stats: Dict[str, Dict[str, float]] = {
            "VV": {"mean": 0.0, "std": 1.0, "min": clip_min_db, "max": clip_max_db},
            "VH": {"mean": 0.0, "std": 1.0, "min": clip_min_db, "max": clip_max_db},
        }
        self.is_fitted = False

    def fit_from_samples(
        self,
        vv_list: list,
        vh_list: list
    ) -> "SARNormalizer":
        """
        Compute mean, std, min, max statistics from training samples only.

        Args:
            vv_list: List of VV numpy arrays from training set.
            vh_list: List of VH numpy arrays from training set.

        Returns:
            Fitted SARNormalizer instance.
        """
        if len(vv_list) == 0 or len(vh_list) == 0:
            raise ValueError("Cannot fit normalizer with empty training sample lists.")

        def compute_channel_stats(arr_list, channel_name):
            cleaned = []
            for item in arr_list:
                arr = clean_invalid_values(item, fill_value=self.fill_value)
                arr = clip_sar_db(arr, self.clip_min_db, self.clip_max_db)
                cleaned.append(arr.flatten())
            
            concat_arr = np.concatenate(cleaned)
            mean_val = float(np.mean(concat_arr))
            std_val = float(np.std(concat_arr))
            min_val = float(np.min(concat_arr))
            max_val = float(np.max(concat_arr))

            self.stats[channel_name] = {
                "mean": mean_val,
                "std": std_val if std_val > 1e-7 else 1.0,
                "min": min_val,
                "max": max_val
            }

        compute_channel_stats(vv_list, "VV")
        compute_channel_stats(vh_list, "VH")
        self.is_fitted = True
        return self

    def transform(
        self,
        vv: np.ndarray,
        vh: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Apply invalid value cleaning, clipping, and fitted normalization.

        Args:
            vv: VV channel numpy array.
            vh: VH channel numpy array.

        Returns:
            Tuple of normalized (vv, vh) numpy arrays.
        """
        vv_clean = clean_invalid_values(vv, fill_value=self.fill_value)
        vh_clean = clean_invalid_values(vh, fill_value=self.fill_value)

        vv_clip = clip_sar_db(vv_clean, self.clip_min_db, self.clip_max_db)
        vh_clip = clip_sar_db(vh_clean, self.clip_min_db, self.clip_max_db)

        if self.strategy == "zscore":
            vv_norm = zscore_normalize(
                vv_clip,
                self.stats["VV"]["mean"],
                self.stats["VV"]["std"]
            )
            vh_norm = zscore_normalize(
                vh_clip,
                self.stats["VH"]["mean"],
                self.stats["VH"]["std"]
            )
        elif self.strategy == "minmax":
            vv_norm = minmax_normalize(
                vv_clip,
                self.stats["VV"]["min"],
                self.stats["VV"]["max"]
            )
            vh_norm = minmax_normalize(
                vh_clip,
                self.stats["VH"]["min"],
                self.stats["VH"]["max"]
            )
        else:
            raise ValueError(f"Unknown normalization strategy: {self.strategy}")

        return vv_norm, vh_norm

    def transform_tensor(
        self,
        vv: torch.Tensor,
        vh: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Apply normalization to PyTorch Tensors.
        """
        vv_np, vh_np = self.transform(vv.detach().cpu().numpy(), vh.detach().cpu().numpy())
        return torch.from_numpy(vv_np).float(), torch.from_numpy(vh_np).float()

    def save_stats(self, json_path: Union[str, Path]) -> None:
        """Save fitted statistics to JSON file."""
        path = Path(json_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "clip_min_db": self.clip_min_db,
            "clip_max_db": self.clip_max_db,
            "strategy": self.strategy,
            "stats": self.stats,
            "is_fitted": self.is_fitted
        }
        with open(path, "w") as f:
            json.dump(data, f, indent=4)

    def load_stats(self, json_path: Union[str, Path]) -> "SARNormalizer":
        """Load statistics from JSON file."""
        path = Path(json_path)
        if not path.exists():
            raise FileNotFoundError(f"Statistics file not found: {path}")
        with open(path, "r") as f:
            data = json.load(f)
        self.clip_min_db = data.get("clip_min_db", -35.0)
        self.clip_max_db = data.get("clip_max_db", 0.0)
        self.strategy = data.get("strategy", "zscore")
        self.stats = data.get("stats", self.stats)
        self.is_fitted = data.get("is_fitted", True)
        return self
