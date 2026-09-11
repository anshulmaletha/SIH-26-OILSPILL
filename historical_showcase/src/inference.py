"""
SIH 2026 Final Demo Inference Engine for Sentinel-1 SAR Oil Spill Segmentation.
Loads trained U-Net baseline checkpoint (models/best_unet_baseline.pt),
applies SARPreprocessor, runs sliding-window/tiled inference on SAR images,
applies sigmoid + 0.5 threshold, and computes quantitative oil spill statistics.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Union, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import cv2

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.data.dataset import load_sar_image


def extract_spatial_resolution(image_input: Union[str, Path, np.ndarray]) -> Tuple[Optional[float], Optional[float], bool, str]:
    """
    Extract pixel resolution (pixel_width_m, pixel_height_m) in meters from GeoTIFF spatial metadata.
    Returns (pixel_width_m, pixel_height_m, is_metadata_available, info_msg)
    """
    if not isinstance(image_input, (str, Path)):
        return None, None, False, "Input is in-memory array; spatial metadata unavailable."

    path = Path(image_input)
    if not path.exists() or path.suffix.lower() not in (".tif", ".tiff"):
        return None, None, False, f"File format '{path.suffix}' does not support GeoTIFF spatial metadata."

    # Try rasterio first if available
    try:
        import rasterio
        with rasterio.open(path) as ds:
            res_x, res_y = ds.res
            if res_x > 0 and res_y > 0:
                if ds.crs and ds.crs.is_projected:
                    return float(res_x), float(res_y), True, "Extracted from GeoTIFF CRS (projected meters)."
                elif ds.crs and ds.crs.is_geographic:
                    lat_ref = ds.bounds.bottom if ds.bounds else 0.0
                    scale_x_m = float(res_x) * 111320.0 * np.cos(np.radians(lat_ref))
                    scale_y_m = float(res_y) * 111320.0
                    return abs(float(scale_x_m)), abs(float(scale_y_m)), True, "Converted from GeoTIFF geographic coordinates."
                else:
                    return float(res_x), float(res_y), True, "Extracted from GeoTIFF pixel resolution."
    except Exception:
        pass

    # Try tifffile fallback
    try:
        import tifffile
        with tifffile.TiffFile(path) as tif:
            page = tif.pages[0]
            if "ModelPixelScaleTag" in page.tags:
                scales = page.tags["ModelPixelScaleTag"].value
                sx, sy = float(scales[0]), float(scales[1])
                if sx > 0 and sy > 0:
                    return sx, sy, True, "Extracted from GeoTIFF ModelPixelScaleTag."
    except Exception:
        pass

    return None, None, False, "GeoTIFF spatial georeferencing metadata tag missing."


class OilSpillInferenceEngine:
    """
    Production-ready Inference Engine for Sentinel-1 SAR Oil Spill Detection.
    Uses trained U-Net baseline model checkpoint.
    """

    def __init__(
        self,
        checkpoint_path: Optional[Union[str, Path]] = None,
        threshold: float = 0.5,
        device: Optional[torch.device] = None
    ):
        self.project_root = PROJECT_ROOT
        if checkpoint_path is None:
            checkpoint_path = self.project_root / "models" / "best_unet_baseline.pt"
        self.checkpoint_path = Path(checkpoint_path)

        if not self.checkpoint_path.exists():
            raise FileNotFoundError(f"Trained model checkpoint not found at: {self.checkpoint_path}")

        self.threshold = threshold
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Instantiate U-Net baseline architecture (1 channel in, 1 channel out, 16 features)
        self.model = UNet(in_channels=1, out_channels=1, features=16).to(self.device)
        checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()

        # Initialize SAR Preprocessor with exact training dataset channel statistics
        self.preprocessor = SARPreprocessor(
            in_channels=1,
            clip_vv=(-35.0, 0.0),
            strategy="zscore"
        )
        self.preprocessor.channel_stats = [
            {"mean": -15.4214, "std": 5.1238, "min": -35.0, "max": 0.0}
        ]
        self.preprocessor.is_fitted = True

        from src.postprocessing.mask_enhancer import ConservativeMaskEnhancer
        self.postprocessor = ConservativeMaskEnhancer(
            high_threshold=self.threshold,
            low_threshold=0.35,
            min_noise_area_pixels=15,
            morph_kernel_size=3
        )

    def fit_preprocessor_from_samples(self, sample_imgs: list):
        """Optionally fit preprocessor on exact sample images."""
        self.preprocessor.fit(sample_imgs)

    def load_sar_input(self, image_input: Union[str, Path, np.ndarray]) -> Tuple[np.ndarray, str]:
        """
        Load SAR image from file path (TIFF, PNG, JPG, NPY) or numpy array.
        Returns float32 array (1, H, W) and image source filename.
        """
        if isinstance(image_input, (str, Path)):
            path = Path(image_input)
            source_name = path.name
            if path.suffix.lower() in (".tif", ".tiff", ".npy"):
                arr = load_sar_image(path)
            else:
                img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
                if img is None:
                    raise ValueError(f"Could not read image from path: {path}")
                if img.ndim == 2:
                    arr = np.expand_dims(img, axis=0)
                elif img.ndim == 3:
                    arr = np.transpose(img, (2, 0, 1))[:1]
                else:
                    arr = img
        elif isinstance(image_input, np.ndarray):
            source_name = "User Uploaded Array"
            arr = image_input.astype(np.float32)
            if arr.ndim == 2:
                arr = np.expand_dims(arr, axis=0)
            elif arr.ndim == 3:
                if arr.shape[0] in (1, 2, 3, 4):
                    arr = arr[:1]
                elif arr.shape[2] in (1, 2, 3, 4):
                    arr = np.transpose(arr, (2, 0, 1))[:1]
                else:
                    arr = arr[:1]
            else:
                raise ValueError(f"Unsupported array shape: {arr.shape}. Expected 2D or 3D array.")
        else:
            raise TypeError(f"Unsupported image input type: {type(image_input)}")

        return arr.astype(np.float32), source_name

    def predict_patch(self, patch_2d: np.ndarray, is_preprocessed: bool = False) -> Tuple[np.ndarray, np.ndarray]:
        """
        Run inference on a single 256x256 patch array (1, 256, 256).
        Returns probability map (256, 256) and binary mask (256, 256).
        """
        if patch_2d.ndim == 2:
            patch_arr = np.expand_dims(patch_2d, axis=0)
        elif patch_2d.ndim == 3 and patch_2d.shape[0] > 1:
            patch_arr = patch_2d[:1]
        else:
            patch_arr = patch_2d

        # Apply preprocessing if not already preprocessed
        if not is_preprocessed:
            norm_patch = self.preprocessor.transform(patch_arr)
        else:
            norm_patch = patch_arr

        if isinstance(norm_patch, np.ndarray):
            patch_t = torch.from_numpy(norm_patch).float()
        else:
            patch_t = norm_patch.float()

        if patch_t.ndim == 3:
            input_batch = patch_t.unsqueeze(0)
        else:
            input_batch = patch_t

        input_batch = input_batch.to(self.device)

        with torch.no_grad():
            logits = self.model(input_batch)
            probs = torch.sigmoid(logits)

        prob_map = probs.squeeze().cpu().numpy()
        binary_mask = (prob_map >= self.threshold).astype(np.uint8)
        return prob_map, binary_mask

    def predict_full_scene(
        self,
        sar_arr: np.ndarray,
        patch_size: int = 256,
        stride: int = 128,
        is_preprocessed: bool = False
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Run tiled/sliding-window inference over arbitrary sized SAR scenes (e.g. 512x512, 1024x1024, or full TIFF).
        Supports seamless tile stitching with overlapping window averaging.
        """
        if sar_arr.ndim == 3:
            raw_2d = sar_arr[0]
        else:
            raw_2d = sar_arr

        h, w = raw_2d.shape

        if h <= patch_size and w <= patch_size:
            # Handle smaller images with padding if needed
            pad_h = max(0, patch_size - h)
            pad_w = max(0, patch_size - w)
            if pad_h > 0 or pad_w > 0:
                padded = np.pad(raw_2d, ((0, pad_h), (0, pad_w)), mode="reflect")
                prob_crop, mask_crop = self.predict_patch(padded, is_preprocessed=is_preprocessed)
                return prob_crop[:h, :w], mask_crop[:h, :w]
            else:
                return self.predict_patch(raw_2d, is_preprocessed=is_preprocessed)

        # Sliding window tiling for large scenes
        prob_accum = np.zeros((h, w), dtype=np.float32)
        count_accum = np.zeros((h, w), dtype=np.float32)

        row_starts = list(range(0, h - patch_size + 1, stride))
        if row_starts[-1] + patch_size < h:
            row_starts.append(h - patch_size)

        col_starts = list(range(0, w - patch_size + 1, stride))
        if col_starts[-1] + patch_size < w:
            col_starts.append(w - patch_size)

        for r in row_starts:
            for c in col_starts:
                crop = raw_2d[r:r + patch_size, c:c + patch_size]
                tile_prob, _ = self.predict_patch(crop, is_preprocessed=is_preprocessed)
                prob_accum[r:r + patch_size, c:c + patch_size] += tile_prob
                count_accum[r:r + patch_size, c:c + patch_size] += 1.0

        full_prob = prob_accum / np.maximum(count_accum, 1.0)
        full_mask = (full_prob >= self.threshold).astype(np.uint8)
        return full_prob, full_mask

    def detect(
        self,
        image_input: Union[str, Path, np.ndarray],
        is_preprocessed: bool = False,
        apply_postprocessing: bool = False
    ) -> Dict[str, Any]:
        """
        Complete end-to-end detection pipeline.
        Returns structured results dict with quantitative oil spill metrics and formatted visualization data.
        """
        sar_arr, source_name = self.load_sar_input(image_input)
        raw_2d = sar_arr[0] if sar_arr.ndim == 3 else sar_arr

        h, w = raw_2d.shape
        prob_map, binary_mask = self.predict_full_scene(raw_2d, patch_size=256, stride=128, is_preprocessed=is_preprocessed)
        raw_binary_mask = binary_mask.copy()

        if apply_postprocessing and self.postprocessor is not None:
            binary_mask = self.postprocessor.process(prob_map, raw_binary_mask)

        oil_pixels = int(np.sum(binary_mask))
        total_pixels = h * w
        coverage_pct = float((oil_pixels / total_pixels) * 100.0)

        # Dynamic area calculation from GeoTIFF spatial metadata
        px_w, px_h, has_meta, meta_msg = extract_spatial_resolution(image_input)
        if has_meta and px_w is not None and px_h is not None:
            pixel_area_m2 = px_w * px_h
            area_km2 = float(oil_pixels * (pixel_area_m2 / 1e6))
            spatial_metadata_info = {
                "available": True,
                "pixel_width_m": px_w,
                "pixel_height_m": px_h,
                "pixel_area_m2": pixel_area_m2,
                "message": meta_msg
            }
        else:
            # Fallback to default 10m x 10m pixel size (0.0001 km² per pixel)
            area_km2 = float(oil_pixels * 0.0001)
            spatial_metadata_info = {
                "available": False,
                "pixel_width_m": 10.0,
                "pixel_height_m": 10.0,
                "pixel_area_m2": 100.0,
                "warning": f"Spatial metadata unavailable ({meta_msg}). Area calculated using default 10m x 10m pixel resolution."
            }

        if oil_pixels > 0:
            avg_confidence = float(np.mean(prob_map[binary_mask == 1]))
            detection_status = "OIL SPILL DETECTED"
            confidence_type = "mean_slick_probability"
        else:
            mean_bg_prob = float(np.mean(prob_map))
            avg_confidence = float(1.0 - mean_bg_prob)
            detection_status = "NO OIL SPILL DETECTED"
            confidence_type = "clean_background_probability"

        return {
            "source_name": source_name,
            "dimensions": (h, w),
            "status": detection_status,
            "oil_pixels": oil_pixels,
            "total_pixels": total_pixels,
            "coverage_pct": coverage_pct,
            "area_km2": area_km2,
            "spatial_metadata": spatial_metadata_info,
            "confidence": avg_confidence,
            "confidence_type": confidence_type,
            "probability_map": prob_map,
            "binary_mask": binary_mask,
            "raw_binary_mask": raw_binary_mask,
            "raw_sar_image": raw_2d,
            "postprocessing_applied": apply_postprocessing
        }

    def detect_and_vectorize(
        self,
        image_input: Union[str, Path, np.ndarray],
        is_preprocessed: bool = False,
        apply_postprocessing: bool = False,
        min_area_pixels: int = 15
    ) -> Dict[str, Any]:
        """
        Runs end-to-end U-Net inference and converts predicted full-scene binary mask
        into Stage 1 GeoJSON slick polygon features compatible with PRD §7.1 schema.
        """
        res = self.detect(image_input, is_preprocessed=is_preprocessed, apply_postprocessing=apply_postprocessing)
        source_path = Path(image_input) if isinstance(image_input, (str, Path)) else None
        from src.postprocessing.vectorize import extract_slick_geojson
        geojson = extract_slick_geojson(
            binary_mask=res["binary_mask"],
            prob_map=res["probability_map"],
            source_name=res["source_name"],
            source_path=source_path,
            min_area_pixels=min_area_pixels
        )
        res["geojson"] = geojson
        return res
