"""
Configuration settings and paths for Sentinel-1 SAR Oil Spill Segmentation.
"""

from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

import os

# Project Base Directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Data Directories (Configurable via environment variables)
def get_data_dir() -> Path:
    for env_var in ["SAR_DATA_DIR", "DATA_DIR"]:
        if env_var in os.environ and os.environ[env_var].strip():
            p = Path(os.environ[env_var].strip())
            if p.exists():
                return p
    user_profile = os.environ.get("USERPROFILE")
    if user_profile:
        p = Path(user_profile) / "Downloads" / "Radar_data"
        if p.exists():
            return p
    return BASE_DIR / "data"

DATA_DIR = get_data_dir()
RAW_DATA_DIR = DATA_DIR / "raw"
SAMPLE_DATA_DIR = DATA_DIR / "sample"

# Output Directories
RESULTS_DIR = BASE_DIR / "results"
MODELS_DIR = BASE_DIR / "models"


@dataclass
class DatasetConfig:
    """Dataset configuration parameters."""
    raw_data_dir: Path = RAW_DATA_DIR
    sample_data_dir: Path = SAMPLE_DATA_DIR
    channels: List[str] = field(default_factory=lambda: ["VV"])
    image_size: Tuple[int, int] = (256, 256)
    invalid_value: float = -9999.0
    nodata_threshold: float = -50.0
    # Data Split Ratios (Keeping official test set strictly separate)
    train_ratio: float = 0.70
    val_ratio: float = 0.15
    test_ratio: float = 0.15


@dataclass
class NormalizationConfig:
    """Normalization configuration parameters."""
    clip_vv: Tuple[float, float] = (-35.0, 0.0)
    clip_vh: Tuple[float, float] = (-40.0, -5.0)
    strategy: str = "zscore"
    enable_speckle_filter: bool = False
    speckle_filter_type: str = "lee"
    speckle_filter_size: int = 3
    fill_invalid_value: float = 0.0


@dataclass
class ModelConfig:
    """Model selection and parameters."""
    model_name: str = "unet"  # Supported: "unet", "unet_plus_plus"
    in_channels: int = 1
    out_channels: int = 1
    features: int = 16
    threshold: float = 0.5


@dataclass
class Config:
    """Global configuration object."""
    dataset: DatasetConfig = field(default_factory=DatasetConfig)
    normalization: NormalizationConfig = field(default_factory=NormalizationConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    results_dir: Path = RESULTS_DIR
    models_dir: Path = MODELS_DIR


def get_default_config() -> Config:
    """Return default configuration instance."""
    return Config()
