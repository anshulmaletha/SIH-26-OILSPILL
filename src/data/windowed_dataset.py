"""
Real Segmentation Dataset Loader for Sentinel-1 SAR Oil Spill Dataset.
Uses scene array caching to crop 256x256 image and mask patches directly
from parent TIFF files based on CSV coordinates ('row,col').
"""

from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

try:
    import tifffile
    HAS_TIFFFILE = True
except ImportError:
    HAS_TIFFFILE = False

try:
    import rasterio
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


class SARPatchDataset(Dataset):
    """
    PyTorch Dataset loading 256x256 crops from Sentinel-1 SAR TIFF scenes and masks
    using CSV metadata ('paths', 'coordinates', 'class').
    """

    def __init__(
        self,
        csv_file_or_df: Union[str, Path, pd.DataFrame],
        data_dir: Union[str, Path],
        patch_size: int = 256,
        preprocessor: Optional[Any] = None,
        transform: Optional[Callable] = None,
        return_dict: bool = True
    ):
        """
        Args:
            csv_file_or_df: Path to CSV or pandas DataFrame containing 'paths', 'coordinates', 'class'.
            data_dir: Base directory containing 'images/' and 'masks/' subfolders.
            patch_size: Square crop size (default 256).
            preprocessor: Optional fitted SARPreprocessor instance.
            transform: Optional spatial transforms function.
            return_dict: If True, returns dict with tensors and metadata; else (image_tensor, mask_tensor).
        """
        self.data_dir = Path(data_dir)
        self.img_dir = self.data_dir / "images"
        self.mask_dir = self.data_dir / "masks"
        self.patch_size = patch_size
        self.preprocessor = preprocessor
        self.transform = transform
        self.return_dict = return_dict

        if isinstance(csv_file_or_df, (str, Path)):
            self.df = pd.read_csv(csv_file_or_df)
        else:
            self.df = csv_file_or_df.copy()

        # Cache open parent scene arrays in memory for instant O(1) patch cropping
        self._scene_cache: Dict[str, np.ndarray] = {}

    def _get_scene_array(self, file_path: Path) -> np.ndarray:
        """Retrieve cached parent scene array or load from TIFF."""
        path_str = str(file_path)
        if path_str not in self._scene_cache:
            arr = None
            if HAS_TIFFFILE:
                try:
                    arr = tifffile.imread(path_str)
                except Exception:
                    pass

            if arr is None and HAS_RASTERIO:
                try:
                    with rasterio.open(path_str) as src:
                        arr = src.read()
                except Exception:
                    pass

            if arr is None and HAS_CV2:
                try:
                    img = cv2.imread(path_str, cv2.IMREAD_UNCHANGED)
                    if img is not None:
                        arr = img
                except Exception:
                    pass

            if arr is None:
                raise RuntimeError(f"Could not load TIFF file: {file_path}")

            # Normalize dimensions to (C, H, W)
            if arr.ndim == 2:
                arr = np.expand_dims(arr, axis=0)
            elif arr.ndim == 3 and (arr.shape[2] < arr.shape[0] and arr.shape[2] < arr.shape[1]):
                arr = np.transpose(arr, (2, 0, 1))

            self._scene_cache[path_str] = arr.astype(np.float32)

        return self._scene_cache[path_str]

    def _crop_window(
        self,
        file_path: Path,
        row: int,
        col: int,
        pad_mode: str = "reflect"
    ) -> np.ndarray:
        """Extract a 256x256 window with boundary validation and padding."""
        if not file_path.exists():
            raise FileNotFoundError(f"File referenced in CSV does not exist: {file_path}")

        scene_arr = self._get_scene_array(file_path)  # Shape (C, H, W)
        c, h, w = scene_arr.shape

        # Calculate crop bounds
        row_start = max(0, min(row, h - 1))
        col_start = max(0, min(col, w - 1))

        row_end = min(row_start + self.patch_size, h)
        col_end = min(col_start + self.patch_size, w)

        crop_data = scene_arr[:, row_start:row_end, col_start:col_end]

        # Handle boundary padding if crop is near image border
        actual_h = crop_data.shape[1]
        actual_w = crop_data.shape[2]
        if actual_h < self.patch_size or actual_w < self.patch_size:
            pad_h = self.patch_size - actual_h
            pad_w = self.patch_size - actual_w
            if pad_mode == "constant":
                crop_data = np.pad(
                    crop_data,
                    pad_width=((0, 0), (0, pad_h), (0, pad_w)),
                    mode="constant",
                    constant_values=0
                )
            else:
                crop_data = np.pad(
                    crop_data,
                    pad_width=((0, 0), (0, pad_h), (0, pad_w)),
                    mode="reflect"
                )

        return crop_data.astype(np.float32)

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int) -> Union[Dict[str, Any], Tuple[torch.Tensor, torch.Tensor]]:
        if idx < 0 or idx >= len(self.df):
            raise IndexError(f"Index {idx} out of range for dataset of size {len(self.df)}")

        row_data = self.df.iloc[idx]

        # Resolve old Windows path in CSV to local filename
        full_ref_path = str(row_data["paths"])
        tiff_filename = Path(full_ref_path.replace("\\", "/")).name

        img_path = self.img_dir / tiff_filename
        mask_path = self.mask_dir / tiff_filename

        # Parse coordinates (row, col)
        coords_str = str(row_data["coordinates"])
        row_val, col_val = map(int, coords_str.split(","))

        # Crop 256x256 image (reflect pad) and mask (constant-zero pad) windowed from parent TIFFs
        image_crop = self._crop_window(img_path, row_val, col_val, pad_mode="reflect")  # (1, 256, 256)
        mask_crop = self._crop_window(mask_path, row_val, col_val, pad_mode="constant")  # (1, 256, 256)

        # Ensure mask target is binary 0 / 1
        mask_crop = (mask_crop > 0).astype(np.float32)

        # Apply preprocessor if provided
        if self.preprocessor is not None:
            image_crop = self.preprocessor.transform(image_crop)
            if isinstance(image_crop, torch.Tensor):
                image_crop = image_crop.numpy()

        image_tensor = torch.from_numpy(image_crop).float()
        mask_tensor = torch.from_numpy(mask_crop).float()

        if self.transform is not None:
            image_tensor, mask_tensor = self.transform(image_tensor, mask_tensor)

        csv_class = float(row_data.get("class", 0.0))

        if self.return_dict:
            return {
                "image": image_tensor,
                "mask": mask_tensor,
                "csv_class": csv_class,
                "source_tiff": tiff_filename,
                "crop_coords": (row_val, col_val)
            }

        return image_tensor, mask_tensor


def classify_mask_occupancy(
    df: pd.DataFrame,
    data_dir: Union[str, Path],
    patch_size: int = 256,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Classify each CSV row as positive or negative using the actual mask crop.

    Positive: mask_crop.sum() > 0
    Negative: mask_crop.sum() == 0

    CSV `class` is ignored. Returns positional index arrays into `df`.
    """
    data_dir = Path(data_dir)
    mask_dir = data_dir / "masks"

    mask_cache: Dict[str, np.ndarray] = {}
    for mask_file in list(mask_dir.glob("*.tif")) + list(mask_dir.glob("*.tiff")):
        arr = None
        if HAS_TIFFFILE:
            try:
                arr = tifffile.imread(str(mask_file))
            except Exception:
                arr = None
        if arr is None:
            continue
        mask_cache[mask_file.name] = (np.squeeze(arr) > 0)

    pos_indices: List[int] = []
    neg_indices: List[int] = []

    for i in range(len(df)):
        row = df.iloc[i]
        tiff_name = Path(str(row["paths"]).replace("\\", "/")).name
        row_val, col_val = map(int, str(row["coordinates"]).split(","))
        scene = mask_cache.get(tiff_name)
        if scene is None:
            raise FileNotFoundError(f"Mask scene not loaded for CSV path: {tiff_name}")

        if scene.ndim != 2:
            scene = np.squeeze(scene)
        h, w = scene.shape
        r0 = max(0, min(row_val, h - 1))
        c0 = max(0, min(col_val, w - 1))
        crop = scene[r0:min(r0 + patch_size, h), c0:min(c0 + patch_size, w)]
        if int(crop.sum()) > 0:
            pos_indices.append(i)
        else:
            neg_indices.append(i)

    return np.asarray(pos_indices, dtype=np.int64), np.asarray(neg_indices, dtype=np.int64)

