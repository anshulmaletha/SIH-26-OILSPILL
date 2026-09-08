"""
Speckle filtering utilities for Sentinel-1 SAR imagery.
Provides optional spatial filtering algorithms (Lee filter, Median filter, Box filter)
to suppress multiplicative SAR speckle noise.
"""

from typing import Union
import numpy as np
import torch


def apply_lee_filter(
    img: np.ndarray,
    size: int = 3,
    cu: float = 0.25
) -> np.ndarray:
    """
    Apply Lee Speckle Filter to a 2D SAR numpy array (intensity or dB).

    Args:
        img: 2D numpy array.
        size: Window size (must be odd integer >= 3).
        cu: Estimated noise coefficient of variation.

    Returns:
        Filtered 2D numpy array.
    """
    if img.ndim != 2:
        raise ValueError(f"Lee filter expects 2D array, got shape {img.shape}")
    
    if size % 2 == 0 or size < 3:
        raise ValueError(f"Filter size must be an odd integer >= 3, got {size}")

    img_float = img.astype(np.float64)
    padded = np.pad(img_float, pad_width=size // 2, mode="reflect")
    
    # Calculate local mean and variance using sliding windows
    sub_views = np.lib.stride_tricks.sliding_window_view(padded, (size, size))
    local_mean = np.mean(sub_views, axis=(-2, -1))
    local_var = np.var(sub_views, axis=(-2, -1))

    # Weighting factor W = local_var / (local_var + noise_var)
    noise_var = (cu * local_mean) ** 2
    w = local_var / (local_var + noise_var + 1e-8)
    w = np.clip(w, 0.0, 1.0)

    filtered = local_mean + w * (img_float - local_mean)
    return filtered.astype(np.float32)


def apply_speckle_filter(
    img: Union[np.ndarray, torch.Tensor],
    filter_type: str = "lee",
    size: int = 3
) -> Union[np.ndarray, torch.Tensor]:
    """
    Apply speckle filter to 2D single-channel or (2, H, W) dual-channel SAR data.
    """
    is_tensor = isinstance(img, torch.Tensor)
    arr = img.detach().cpu().numpy() if is_tensor else np.copy(img)

    if arr.ndim == 2:
        channels = [arr]
    elif arr.ndim == 3 and arr.shape[0] == 2:
        channels = [arr[0], arr[1]]
    else:
        raise ValueError(f"Expected shape (H, W) or (2, H, W), got {arr.shape}")

    filtered_channels = []
    for c in channels:
        if filter_type.lower() == "lee":
            f_c = apply_lee_filter(c, size=size)
        elif filter_type.lower() == "median":
            from scipy.ndimage import median_filter
            f_c = median_filter(c, size=size)
        else:
            raise ValueError(f"Unsupported speckle filter type: '{filter_type}'. Choose 'lee' or 'median'.")
        filtered_channels.append(f_c)

    if arr.ndim == 2:
        res = filtered_channels[0]
    else:
        res = np.stack(filtered_channels, axis=0)

    return torch.from_numpy(res).float() if is_tensor else res
