"""
PyTorch Dataset module for Sentinel-1 SAR Oil Spill Segmentation.
Updated to support confirmed 1-channel float32 TIFF dataset structure (Downloads/Radar_data).
Flexibly handles single-channel (1, H, W) or multi-channel SAR inputs and binary masks.
"""

from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import numpy as np
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


def load_sar_image(file_path: Union[str, Path]) -> np.ndarray:
    """Read a SAR image or mask from file. Returns float32 numpy array with shape (C, H, W)."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    arr = None

    if path.suffix.lower() == ".npy":
        arr = np.load(path).astype(np.float32)
        if arr.ndim == 2:
            arr = np.expand_dims(arr, axis=0)
        return arr

    if HAS_TIFFFILE and path.suffix.lower() in (".tif", ".tiff"):
        try:
            raw = tifffile.imread(str(path))
            if raw is not None:
                if raw.ndim == 2:
                    arr = np.expand_dims(raw, axis=0)
                elif raw.ndim == 3:
                    if raw.shape[0] < raw.shape[1] and raw.shape[0] < raw.shape[2]:
                        arr = raw
                    else:
                        arr = np.transpose(raw, (2, 0, 1))
        except Exception:
            pass

    if arr is None and HAS_RASTERIO and path.suffix.lower() in (".tif", ".tiff"):
        try:
            with rasterio.open(path) as src:
                arr = src.read()
        except Exception:
            pass

    if arr is None and HAS_CV2:
        img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is not None:
            if img.ndim == 2:
                arr = np.expand_dims(img, axis=0)
            elif img.ndim == 3:
                arr = np.transpose(img, (2, 0, 1))

    if arr is None:
        raise RuntimeError(f"Could not read SAR file from {path}")

    return arr.astype(np.float32)


class SAROilSpillDataset(Dataset):
    """
    PyTorch Dataset for Sentinel-1 SAR Oil Spill Imagery and Binary Masks.
    Matches confirmed dataset structure (Downloads/Radar_data): train/images, train/masks, test/images, test/masks.
    """

    def __init__(
        self,
        data_dir: Optional[Union[str, Path]] = None,
        split: str = "train",
        items: Optional[List[Dict[str, Union[str, Path, np.ndarray]]]] = None,
        preprocessor: Optional[Any] = None,
        transform: Optional[Callable] = None,
        return_dict: bool = False
    ):
        """
        Args:
            data_dir: Root dataset folder (e.g. Downloads/Radar_data).
            split: 'train' or 'test'.
            items: Direct list of dicts, e.g. [{"image": path_or_arr, "mask": path_or_arr}, ...]
            preprocessor: Fitted SARPreprocessor or Normalizer instance.
            transform: Optional spatial transforms function.
            return_dict: Returns dict if True, else tuple (image_tensor, mask_tensor).
        """
        self.split = split
        self.preprocessor = preprocessor
        self.transform = transform
        self.return_dict = return_dict
        self.items: List[Dict[str, Any]] = []

        if items is not None:
            self.items = items
        elif data_dir is not None:
            self.items = self._discover_dataset_items(Path(data_dir), split)

    def _discover_dataset_items(self, base_dir: Path, split: str) -> List[Dict[str, Path]]:
        """Discover paired image and mask files from split/images and split/masks directories."""
        split_dir = base_dir / split
        img_dir = split_dir / "images"
        mask_dir = split_dir / "masks"

        if not img_dir.exists():
            return []

        extensions = ("*.tif", "*.tiff", "*.png", "*.jpg", "*.npy")
        img_files = []
        for ext in extensions:
            img_files.extend(list(img_dir.glob(ext)))
        img_files = sorted(list(set(img_files)))

        mask_files_map = {}
        if mask_dir.exists():
            for ext in extensions:
                for m_path in mask_dir.glob(ext):
                    mask_files_map[m_path.stem] = m_path

        items = []
        for img_path in img_files:
            mask_path = mask_files_map.get(img_path.stem)
            items.append({
                "image": img_path,
                "mask": mask_path,
                "stem": img_path.stem
            })

        return items

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, idx: int) -> Union[Tuple[torch.Tensor, torch.Tensor], Dict[str, torch.Tensor]]:
        if idx < 0 or idx >= len(self.items):
            raise IndexError(f"Index {idx} out of range for dataset of size {len(self.items)}")

        item = self.items[idx]

        # Load Image (C, H, W)
        if isinstance(item["image"], (str, Path)):
            img_arr = load_sar_image(item["image"])
        elif isinstance(item["image"], np.ndarray):
            img_arr = item["image"].astype(np.float32)
            if img_arr.ndim == 2:
                img_arr = np.expand_dims(img_arr, axis=0)
        else:
            raise TypeError(f"Unsupported image type: {type(item['image'])}")

        # Load Mask (1, H, W)
        mask_arr = None
        if item.get("mask") is not None:
            if isinstance(item["mask"], (str, Path)):
                mask_arr = load_sar_image(item["mask"])
            elif isinstance(item["mask"], np.ndarray):
                mask_arr = item["mask"].astype(np.float32)
                if mask_arr.ndim == 2:
                    mask_arr = np.expand_dims(mask_arr, axis=0)

        if mask_arr is None:
            mask_arr = np.zeros((1, img_arr.shape[1], img_arr.shape[2]), dtype=np.float32)

        # Apply preprocessor if provided
        if self.preprocessor is not None:
            if hasattr(self.preprocessor, "transform"):
                img_arr = self.preprocessor.transform(img_arr)
                if isinstance(img_arr, torch.Tensor):
                    img_arr = img_arr.numpy()

        # Ensure mask is binary [0, 1]
        mask_arr = (mask_arr > 0).astype(np.float32)

        image_tensor = torch.from_numpy(img_arr).float()
        mask_tensor = torch.from_numpy(mask_arr).float()

        if self.transform is not None:
            image_tensor, mask_tensor = self.transform(image_tensor, mask_tensor)

        if self.return_dict:
            return {"image": image_tensor, "mask": mask_tensor, "stem": item.get("stem", f"sample_{idx}")}

        return image_tensor, mask_tensor
