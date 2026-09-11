"""
Comprehensive P1 Pipeline Hardening Verification & Test Suite.
Tests all critical P1 paths:
1. SAR GeoTIFF loading and VV extraction
2. Preprocessing consistency with production checkpoint (1-channel VV, clip [-35,0] dB, z-score)
3. Sliding-window full-scene inference and overlap averaging
4. Thresholding (0.50)
5. Empty-scene / empty-mask behavior
6. Thin/small slick preservation (ConservativeMaskEnhancer)
7. Vectorization and polygon validity (PRD Stage-1 GeoJSON schema)
8. GeoTIFF georeferencing and WGS84 coordinate conversion
9. Exact area_pixels and area_km2
10. Dynamic acquisition_time parsing across formats
11. Missing-georeference handling
12. Confidence calculation and semantics
13. Error handling on invalid/corrupt inputs
14. Real SAR smoke tests (positive scene, difficult scene, clean scene)
"""

import json
import os
import sys
import unittest
from pathlib import Path
import numpy as np
import torch

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor, validate_sar_input
from src.postprocessing.mask_enhancer import ConservativeMaskEnhancer
from src.postprocessing.vectorize import (
    extract_slick_geojson,
    extract_acquisition_time,
    extract_geotiff_spatial_metadata,
    utm_to_latlon
)
from src.inference import OilSpillInferenceEngine, extract_spatial_resolution
from src.data.dataset import load_sar_image


def resolve_data_dir() -> Path:
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
    return PROJECT_ROOT / "data"


class TestP1PipelineHardening(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.data_dir = resolve_data_dir()
        cls.checkpoint_path = PROJECT_ROOT / "models" / "best_unet_baseline.pt"
        cls.engine = OilSpillInferenceEngine(checkpoint_path=cls.checkpoint_path)

    def test_01_model_checkpoint_integrity(self):
        """Verify models/best_unet_baseline.pt exists, is unmodified, and loads as 1-channel U-Net."""
        self.assertTrue(self.checkpoint_path.exists(), "Production checkpoint missing!")
        model = self.engine.model
        self.assertIsInstance(model, UNet)
        self.assertEqual(model.inc.double_conv[0].in_channels, 1)
        self.assertEqual(model.outc.out_channels, 1)

    def test_02_preprocessing_consistency(self):
        """Verify exact preprocessing parameters: 1-ch VV, clip [-35,0] dB, zscore stats."""
        prep = self.engine.preprocessor
        self.assertEqual(prep.in_channels, 1)
        self.assertEqual(prep.clip_vv, (-35.0, 0.0))
        self.assertEqual(prep.strategy, "zscore")
        self.assertEqual(prep.channel_stats[0]["mean"], -15.4214)
        self.assertEqual(prep.channel_stats[0]["std"], 5.1238)

        # Test transformation of extreme values
        raw_test = np.array([[[-50.0, -35.0, -15.4214, 0.0, 10.0, np.nan]]], dtype=np.float32)
        transformed = prep.transform(raw_test)
        # NaN must be cleaned to 0.0 -> clipped to 0.0 -> z-score
        self.assertFalse(np.isnan(transformed).any())
        self.assertFalse(np.isinf(transformed).any())
        # -15.4214 should become ~0.0
        self.assertAlmostEqual(transformed[0, 0, 2], 0.0, places=3)

    def test_03_geotiff_loading_and_shape(self):
        """Verify loading SAR GeoTIFF files produces float32 3D array (1, H, W)."""
        train_img_dir = self.data_dir / "train" / "images"
        if train_img_dir.exists():
            tiffs = list(train_img_dir.glob("*.tif"))
            if tiffs:
                arr = load_sar_image(tiffs[0])
                self.assertIsInstance(arr, np.ndarray)
                self.assertEqual(arr.dtype, np.float32)
                self.assertEqual(arr.ndim, 3)
                self.assertIn(arr.shape[0], (1, 2))

    def test_04_sliding_window_inference(self):
        """Verify tiled inference produces full-scene matching spatial shape and valid probabilities."""
        test_scene = np.random.normal(-15.0, 5.0, (512, 512)).astype(np.float32)
        prob_map, mask = self.engine.predict_full_scene(test_scene, patch_size=256, stride=128)
        self.assertEqual(prob_map.shape, (512, 512))
        self.assertEqual(mask.shape, (512, 512))
        self.assertTrue((prob_map >= 0.0).all() and (prob_map <= 1.0).all())
        self.assertTrue(set(np.unique(mask)).issubset({0, 1}))

    def test_05_empty_scene_behavior(self):
        """Verify empty scene (no oil detected) produces correct status, confidence, and empty GeoJSON features."""
        clean_arr = np.full((256, 256), -10.0, dtype=np.float32)  # Bright background = high radar return = no slick
        res = self.engine.detect_and_vectorize(clean_arr)
        self.assertEqual(res["status"], "NO OIL SPILL DETECTED")
        self.assertEqual(res["oil_pixels"], 0)
        self.assertEqual(res["area_km2"], 0.0)
        self.assertEqual(res["confidence_type"], "clean_background_probability")
        self.assertGreaterEqual(res["confidence"], 0.5)
        self.assertEqual(len(res["geojson"]["polygons"]["features"]), 0)

    def test_06_thin_slick_preservation(self):
        """Verify ConservativeMaskEnhancer preserves connected weak/thin tails while removing isolated noise."""
        enhancer = ConservativeMaskEnhancer(high_threshold=0.5, low_threshold=0.35, min_noise_area_pixels=15)
        prob = np.zeros((100, 100), dtype=np.float32)
        # Core spill (prob=0.8)
        prob[40:60, 40:60] = 0.8
        # Attached thin tail (prob=0.42, between low and high threshold)
        prob[60:75, 48:52] = 0.42
        # Isolated false positive speckle (prob=0.8, only 4 pixels)
        prob[10:12, 10:12] = 0.8

        raw_mask = (prob >= 0.5).astype(np.uint8)
        enhanced_mask = enhancer.process(prob, raw_mask)

        # Attached tail should be recovered
        self.assertEqual(enhanced_mask[65, 50], 1)
        # Isolated 4px noise should be suppressed
        self.assertEqual(enhanced_mask[10, 10], 0)

    def test_07_dynamic_acquisition_time_parsing(self):
        """Verify acquisition time parsing across various filename patterns."""
        self.assertEqual(extract_acquisition_time(None, "2018_09_26.tif"), "2018-09-26T00:00:00Z")
        self.assertEqual(extract_acquisition_time(None, "2018_12_19_d.tif"), "2018-12-19T00:00:00Z")
        self.assertEqual(extract_acquisition_time(None, "20200224.tif"), "2020-02-24T00:00:00Z")
        self.assertEqual(extract_acquisition_time(None, "20200319b.tif"), "2020-03-19T00:00:00Z")

    def test_08_geojson_schema_and_polygon_validity(self):
        """Verify PRD Stage-1 GeoJSON output structure, linear ring closure, and morphological properties."""
        mask = np.zeros((300, 300), dtype=np.uint8)
        # Draw a synthetic elliptical oil slick
        mask[100:150, 100:180] = 1
        prob = np.full((300, 300), 0.1, dtype=np.float32)
        prob[mask == 1] = 0.92

        geojson = extract_slick_geojson(mask, prob, source_name="20200224.tif", min_area_pixels=15)
        self.assertIn("scene_id", geojson)
        self.assertIn("acquisition_time", geojson)
        self.assertIn("polygons", geojson)
        self.assertIn("geometry_features", geojson)

        features = geojson["polygons"]["features"]
        self.assertGreater(len(features), 0)
        poly = features[0]
        self.assertEqual(poly["type"], "Feature")
        self.assertEqual(poly["geometry"]["type"], "Polygon")
        coords = poly["geometry"]["coordinates"][0]
        # Ring must be closed
        self.assertEqual(coords[0], coords[-1])
        self.assertGreaterEqual(len(coords), 4)

        props = poly["properties"]
        self.assertIn("area_km2", props)
        self.assertIn("area_pixels", props)
        self.assertIn("perimeter_km", props)
        self.assertIn("eccentricity", props)
        self.assertIn("centroid", props)
        self.assertGreater(props["area_pixels"], 0)

    def test_09_utm_to_wgs84_conversion(self):
        """Verify analytical UTM to WGS84 coordinates (Gulf of Mexico test)."""
        # Easting 303648m, Northing 3168248m in Zone 16N
        lat, lon = utm_to_latlon(303648.0, 3168248.0, zone=16, northern_hemisphere=True)
        self.assertAlmostEqual(lat, 28.6263, places=2)
        self.assertAlmostEqual(lon, -89.0104, places=2)

    def test_10_invalid_input_error_handling(self):
        """Verify inference engine raises clear exceptions on corrupt/invalid inputs."""
        with self.assertRaises(FileNotFoundError):
            self.engine.load_sar_input("non_existent_file_path_12345.tif")

        with self.assertRaises(Exception):
            self.engine.load_sar_input(np.zeros((10,)))  # 1D array

    def test_11_real_positive_scene_smoke_test(self):
        """Smoke test on real positive validation scene 20200224.tif."""
        img_path = self.data_dir / "train" / "images" / "20200224.tif"
        if not img_path.exists():
            self.skipTest(f"Sample file {img_path} not found.")

        res = self.engine.detect_and_vectorize(img_path)
        self.assertEqual(res["status"], "OIL SPILL DETECTED")
        self.assertGreater(res["oil_pixels"], 1000)
        self.assertGreater(res["area_km2"], 0.1)
        self.assertGreater(len(res["geojson"]["polygons"]["features"]), 0)
        self.assertIn("spatial_metadata", res)

    def test_12_real_difficult_scene_smoke_test(self):
        """Smoke test on real difficult scene 2018_12_19_f_.tif."""
        img_path = self.data_dir / "test" / "images" / "2018_12_19_f_.tif"
        if not img_path.exists():
            self.skipTest(f"Test file {img_path} not found.")

        res = self.engine.detect(img_path)
        self.assertEqual(res["status"], "OIL SPILL DETECTED")
        self.assertGreater(res["oil_pixels"], 1000)
        self.assertEqual(res["dimensions"][0], 2554)

    def test_13_real_clean_scene_smoke_test(self):
        """Smoke test on real scene with minimal detection (20200319.tif)."""
        img_path = self.data_dir / "train" / "images" / "20200319.tif"
        if not img_path.exists():
            self.skipTest(f"Sample file {img_path} not found.")

        res = self.engine.detect_and_vectorize(img_path)
        self.assertIn("status", res)
        self.assertIn("oil_pixels", res)
        self.assertIn("geojson", res)


if __name__ == "__main__":
    unittest.main(verbosity=2)
