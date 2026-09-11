"""
Scene-level dataset split utility for Sentinel-1 SAR Oil Spill Segmentation.
Ensures training and validation splits contain disjoint sets of parent TIFF scenes (zero overlap).
Does not overwrite original CSV metadata files.
"""

from pathlib import Path
from typing import Tuple, List, Union

import pandas as pd
import numpy as np


def create_scene_split(
    csv_file_or_df: Union[str, Path, pd.DataFrame],
    val_scene_ratio: float = 0.25,
    seed: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame, List[str], List[str], bool]:
    """
    Split dataset patches by parent scene filenames so no scene overlaps between train and val.

    Args:
        csv_file_or_df: Path to CSV or pandas DataFrame containing 'paths' column.
        val_scene_ratio: Fraction of unique scenes to allocate to validation.
        seed: Random seed for deterministic reproducibility.

    Returns:
        Tuple of (train_df, val_df, train_scene_names, val_scene_names, is_overlap_zero)
    """
    if isinstance(csv_file_or_df, (str, Path)):
        df = pd.read_csv(csv_file_or_df)
    else:
        df = csv_file_or_df.copy()

    if "paths" not in df.columns:
        raise ValueError("DataFrame must contain 'paths' column to identify parent scenes.")

    # Extract clean scene filenames (e.g. '20200307.tif')
    df["scene_name"] = df["paths"].apply(lambda p: Path(str(p)).name)

    unique_scenes = sorted(df["scene_name"].unique())
    num_val_scenes = max(1, int(len(unique_scenes) * val_scene_ratio))

    rng = np.random.RandomState(seed)
    shuffled_scenes = np.copy(unique_scenes)
    rng.shuffle(shuffled_scenes)

    val_scene_names = sorted(shuffled_scenes[:num_val_scenes].tolist())
    train_scene_names = sorted(shuffled_scenes[num_val_scenes:].tolist())

    # Verify zero scene overlap
    overlap = set(train_scene_names).intersection(set(val_scene_names))
    is_overlap_zero = (len(overlap) == 0)

    train_df = df[df["scene_name"].isin(train_scene_names)].copy().reset_index(drop=True)
    val_df = df[df["scene_name"].isin(val_scene_names)].copy().reset_index(drop=True)

    return train_df, val_df, train_scene_names, val_scene_names, is_overlap_zero
