"""
SAR-specific preprocessing pipeline for Sentinel-1 Imagery.
Handles input validation, NaN/invalid value cleaning, independent dB clipping,
training-only statistics normalization, and optional speckle filtering.
Supports configurable input channels (1-channel or 2-channel VV/VH).
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import numpy as np
import torch

from src.preprocessing.speckle_filter import apply_speckle_filter


def validate_sar_input(
    data: Union[np.ndarray, torch.Tensor],
    expected_channels: Optional[int] = None
) -> Tuple[int, int, int]:
    """
    Validate SAR input shape and channel count.
    Accepts (C, H, W) or (B, C, H, W).
    """
    shape = list(data.shape)
    
    if len(shape) == 3:
        num_channels, h, w = shape
        b = 1
    elif len(shape) == 4:
        b, num_channels, h, w = shape
    else:
        raise ValueError(
            f"Invalid input dimensions {len(shape)}. Expected 3D (C, H, W) or 4D (B, C, H, W) tensor/array."
        )

    if expected_channels is not None and num_channels != expected_channels:
        raise ValueError(
            f"Invalid channel count {num_channels}. Expected {expected_channels} channels."
        )

    if h <= 0 or w <= 0:
        raise ValueError(f"Invalid spatial dimensions H={h}, W={w}. Height and Width must be > 0.")

    return b, h, w


class SARPreprocessor:
    """
    Deterministic SAR Preprocessor for Sentinel-1 Imagery (supports 1-channel or 2-channel VV/VH).
    """

    def __init__(
        self,
        in_channels: int = 2,
        clip_vv: Tuple[float, float] = (-35.0, 0.0),
        clip_vh: Tuple[float, float] = (-40.0, -5.0),
        enable_speckle_filter: bool = False,
        speckle_filter_type: str = "lee",
        speckle_filter_size: int = 3,
        fill_invalid_value: float = 0.0,
        strategy: str = "zscore"
    ):
        self.in_channels = in_channels
        self.clip_vv = clip_vv
        self.clip_vh = clip_vh
        self.enable_speckle_filter = enable_speckle_filter
        self.speckle_filter_type = speckle_filter_type
        self.speckle_filter_size = speckle_filter_size
        self.fill_invalid_value = fill_invalid_value
        self.strategy = strategy

        self.channel_stats: List[Dict[str, float]] = [
            {"mean": 0.0, "std": 1.0, "min": clip_vv[0], "max": clip_vv[1]}
            for _ in range(in_channels)
        ]
        self.is_fitted = False

    @property
    def vv_stats(self) -> Dict[str, float]:
        return self.channel_stats[0] if self.channel_stats else {"mean": 0.0, "std": 1.0, "min": self.clip_vv[0], "max": self.clip_vv[1]}

    @property
    def vh_stats(self) -> Dict[str, float]:
        return self.channel_stats[1] if len(self.channel_stats) > 1 else {"mean": 0.0, "std": 1.0, "min": self.clip_vh[0], "max": self.clip_vh[1]}

    def clean_invalid(self, arr: np.ndarray) -> np.ndarray:
        """Replace NaN, Inf, and negative infinity values deterministically."""
        cleaned = np.copy(arr).astype(np.float32)
        invalid_mask = np.isnan(cleaned) | np.isinf(cleaned)
        cleaned[invalid_mask] = self.fill_invalid_value
        return cleaned

    def fit(self, train_samples: List[np.ndarray]) -> "SARPreprocessor":
        """
        Compute channel statistics independently from training samples only.
        """
        if not train_samples:
            raise ValueError("Cannot fit preprocessor with empty training samples list.")

        num_channels = train_samples[0].shape[0] if train_samples[0].ndim == 3 else 1
        self.in_channels = num_channels
        self.channel_stats = []

        channel_data_lists: List[List[np.ndarray]] = [[] for _ in range(num_channels)]

        for sample in train_samples:
            validate_sar_input(sample, expected_channels=self.in_channels)
            
            for c in range(num_channels):
                ch_arr = self.clean_invalid(sample[c] if sample.ndim == 3 else sample)

                if self.enable_speckle_filter:
                    ch_arr = apply_speckle_filter(ch_arr, filter_type=self.speckle_filter_type, size=self.speckle_filter_size)

                clip_bounds = self.clip_vv if c == 0 else self.clip_vh
                ch_clip = np.clip(ch_arr, clip_bounds[0], clip_bounds[1])
                channel_data_lists[c].append(ch_clip.flatten())

        for c in range(num_channels):
            concat_c = np.concatenate(channel_data_lists[c])
            std_val = float(np.std(concat_c))
            self.channel_stats.append({
                "mean": float(np.mean(concat_c)),
                "std": std_val if std_val > 1e-7 else 1.0,
                "min": float(np.min(concat_c)),
                "max": float(np.max(concat_c))
            })

        self.is_fitted = True
        return self

    def transform(
        self,
        data: Union[np.ndarray, torch.Tensor]
    ) -> Union[np.ndarray, torch.Tensor]:
        """
        Preprocess SAR input (C, H, W) or (B, C, H, W).
        """
        is_tensor = isinstance(data, torch.Tensor)
        arr = data.detach().cpu().numpy() if is_tensor else np.copy(data)

        b, h, w = validate_sar_input(arr, expected_channels=self.in_channels)

        has_batch = (arr.ndim == 4)
        if not has_batch:
            arr_batch = np.expand_dims(arr, axis=0)
        else:
            arr_batch = arr

        processed_batch = []
        for i in range(b):
            processed_channels = []
            for c in range(self.in_channels):
                ch = self.clean_invalid(arr_batch[i, c])

                if self.enable_speckle_filter:
                    ch = apply_speckle_filter(ch, filter_type=self.speckle_filter_type, size=self.speckle_filter_size)

                clip_bounds = self.clip_vv if c == 0 else self.clip_vh
                ch_clip = np.clip(ch, clip_bounds[0], clip_bounds[1])

                stats = self.channel_stats[c] if c < len(self.channel_stats) else {"mean": 0.0, "std": 1.0, "min": clip_bounds[0], "max": clip_bounds[1]}

                if self.strategy == "zscore":
                    ch_norm = (ch_clip - stats["mean"]) / (stats["std"] + 1e-7)
                elif self.strategy == "minmax":
                    ch_norm = (ch_clip - stats["min"]) / (stats["max"] - stats["min"] + 1e-7)
                elif self.strategy == "per_scene_zscore":
                    ch_mean = float(np.mean(ch_clip))
                    ch_std = float(np.std(ch_clip))
                    ch_norm = (ch_clip - ch_mean) / (ch_std if ch_std > 1e-7 else 1.0)
                elif self.strategy == "per_scene_minmax":
                    ch_min = float(np.min(ch_clip))
                    ch_max = float(np.max(ch_clip))
                    ch_norm = (ch_clip - ch_min) / (ch_max - ch_min + 1e-7)
                else:
                    raise ValueError(f"Unknown strategy: {self.strategy}")

                processed_channels.append(ch_norm)

            processed_batch.append(np.stack(processed_channels, axis=0))

        out_arr = np.stack(processed_batch, axis=0)
        if not has_batch:
            out_arr = out_arr[0]

        return torch.from_numpy(out_arr).float() if is_tensor else out_arr.astype(np.float32)
