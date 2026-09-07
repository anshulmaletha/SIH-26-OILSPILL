# SIH26143 Sentinel-1 SAR Oil Spill Segmentation

Deep learning segmentation system for detecting marine oil spills from Sentinel-1 Synthetic Aperture Radar (SAR) imagery using PyTorch.

**Production Model:** 1-Channel VV U-Net (`features=16`) · **Checkpoint:** `models/best_unet_baseline.pt`

---

## ⚙️ Production Pipeline Specification

| Parameter | Value | Details |
|---|---|---|
| **Sensor** | Sentinel-1 SAR | Synthetic Aperture Radar (C-band) |
| **Polarization** | VV only (1 channel) | Single co-polarization channel |
| **Model Architecture** | Standard U-Net (`features=16`) | 1 input channel, 1 output channel (~10M params) |
| **SAR Preprocessing** | Clip to `[-35.0, 0.0]` dB | Removes extreme noise / nodata |
| **Normalization** | Z-score standard scaling | `(x - mean) / std` using training statistics |
| **Channel Statistics** | `mean = -15.4214`, `std = 5.1238` | Derived from training dataset |
| **Decision Threshold** | `0.50` | Applied to raw sigmoid probability map |
| **Primary Production Mode** | Raw U-Net (Post-processing OFF) | Default unbiased predictions |
| **Optional Enhancement** | Conservative Mask Enhancer | Hysteresis thresholding + small island filtering |
| **Production Checkpoint** | `models/best_unet_baseline.pt` | Official trained weights (DO NOT MODIFY) |
| **Patch Size & Tiling** | 256×256 pixels | Sliding window inference with 50% overlap (stride=128) |
| **Spatial Resolution** | GeoTIFF metadata / 10m fallback | Pixel area calculated from GeoTIFF tags (defaults to 10m×10m) |

---

## 📁 Repository Organization

```text
SIH26143-OilSpill/
├── sih_dashboard.py              # 🚀 OFFICIAL DEMO ENTRY POINT (Interactive Web Dashboard)
├── run_demo_cli.py               # 💻 CLI inference demo
├── evaluate_final_test_set.py    # 📊 Official test benchmark evaluation script
│
├── src/                          # 📦 Core Production Package
│   ├── config.py                 # Paths and global configuration defaults
│   ├── inference.py              # Production inference engine (OilSpillInferenceEngine)
│   ├── pipeline.py               # Integrated segmentation pipeline
│   ├── data/
│   │   ├── dataset.py            # PyTorch SAR Dataset class (1-channel VV + Mask)
│   │   ├── windowed_dataset.py   # Windowed SAR patch dataset with scene-level split
│   │   ├── scene_split.py        # Scene-level train/val data splitting
│   │   ├── dataset_inspector.py  # TIFF metadata & data quality inspector
│   │   └── visualize_dataset.py  # SAR visualization utility
│   ├── preprocessing/
│   │   ├── sar_preprocessor.py   # SAR preprocessing (clip + z-score + invalid handling)
│   │   ├── normalization.py      # SARNormalizer class
│   │   └── speckle_filter.py     # Lee/median speckle filter
│   ├── models/
│   │   └── unet.py               # Production U-Net architecture (features=16)
│   ├── evaluation/
│   │   └── metrics.py            # Dice, IoU, precision, recall, F1 computation
│   └── postprocessing/
│       ├── mask_enhancer.py      # Conservative hysteresis mask enhancer
│       └── vectorize.py          # Stage 1 GeoJSON polygon vectorizer (PRD §7.1 schema)
│
├── models/
│   ├── best_unet_baseline.pt     # ✅ PRODUCTION CHECKPOINT (1-ch VV U-Net, features=16)
│   ├── best_unet_baseline_v2.pt  # ⚠️ Experimental (Baseline V2 training run)
│   ├── best_unet_plus_plus.pt    # ⚠️ Experimental (U-Net++ architecture)
│   ├── unet_hard_negative.pt     # ⚠️ Experimental (Hard-negative mining)
│   ├── smoke_unet_baseline.pt    # 🧪 Smoke test checkpoint
│   └── smoke_unet_plus_plus.pt   # 🧪 Smoke test checkpoint
│
├── results/
│   ├── final_evaluation/         # 📊 Final test benchmark outputs & visual overlays
│   │   ├── final_evaluation_metrics.json
│   │   ├── final_evaluation_summary.txt
│   │   ├── per_scene_metrics.csv
│   │   └── overlays/             # Full-scene 4-panel evaluation overlays
│   ├── demo_outputs/             # Demo output artifacts & GeoJSON files
│   └── [experimental results]    # See EXPERIMENTAL.md
│
├── test_*.py                     # Unit and integration test suite
├── EXPERIMENTAL.md               # 📜 Catalog of experimental/legacy artifacts
├── requirements.txt              # Project dependencies
├── .gitignore                    # Git ignore configuration
└── README.md                     # This documentation
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd SIH26143-OilSpill
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Data Directory
Set the `SAR_DATA_DIR` or `DATA_DIR` environment variable to point to your Sentinel-1 dataset:
```bash
# Windows PowerShell
$env:SAR_DATA_DIR = "C:\path\to\Radar_data"

# Linux/macOS
export SAR_DATA_DIR="/path/to/Radar_data"
```
*If not set, the system automatically searches `%USERPROFILE%\Downloads\Radar_data` (Windows) or `./data/`.*

### 3. Launch the Official Presentation Dashboard
```bash
python sih_dashboard.py [--port 7860]
# Open browser → http://localhost:7860
```
**Dashboard Features:**
- **One-click Sample Inference:** Test preloaded oil slick or clean ocean scenes.
- **File Upload:** Upload any custom SAR image (GeoTIFF `.tif`, `.png`, `.jpg`, `.npy`).
- **Raw U-Net Default:** Displays unbiased U-Net predictions by default.
- **Post-Processing Toggle:** Interactive switch to enable conservative hysteresis enhancement for thin tails.
- **4-Panel Visualization:** SAR intensity → U-Net probability heatmap → Binary mask → Composite overlay.
- **Quantitative Metrics:** Detected oil pixel count, estimated area (km² from spatial metadata), coverage %, mean confidence.

### 4. CLI Inference Demo
```bash
# Run on a custom SAR file
python run_demo_cli.py --input path/to/sentinel1.tif

# Run on pre-configured validation samples
python run_demo_cli.py --sample positive
python run_demo_cli.py --sample negative
```

### 5. Final Test Benchmark Evaluation
```bash
python evaluate_final_test_set.py
```
Evaluates `models/best_unet_baseline.pt` on the test scenes following the strict evaluation protocol:
- Per-patch Dice, IoU, precision, recall, F1
- Global pixel-level confusion matrix (`TP`, `FP`, `FN`, `TN`)
- Per-scene breakdown across all test scenes
- **Untouched Benchmark:** Evaluated on the 6 untouched test scenes (excluding diagnostic scene `20200319b.tif`)
- **Overall Benchmark:** Evaluated across all 7 test scenes
- Area computed from GeoTIFF spatial metadata tags, with explicit fallback logging if metadata is absent
- Outputs saved to `results/final_evaluation/`

> **Note on `20200319b.tif`:** This test scene is labelled as **DIAGNOSTIC**. It was inspected
> during initial development for qualitative sanity checks and is strictly excluded from the
> primary untouched benchmark metrics.

### 6. Run Test Suite
```bash
python test_setup.py            # Environment & dependency check
python test_unet.py             # U-Net forward/backward pass & shape check
python test_sar_preprocessing.py # Preprocessing & normalization unit tests
python test_integrated_pipeline.py # End-to-end pipeline test
```

---

## 🔬 SAR Preprocessing Pipeline

```python
from src.preprocessing.sar_preprocessor import SARPreprocessor

# Initialize with exact production parameters
preprocessor = SARPreprocessor(
    in_channels=1,
    clip_vv=(-35.0, 0.0),
    strategy="zscore"
)
# Set fitted training channel statistics
preprocessor.channel_stats = [{"mean": -15.4214, "std": 5.1238, "min": -35.0, "max": 0.0}]
preprocessor.is_fitted = True

# Transform raw VV SAR array (1, H, W)
normalized_array = preprocessor.transform(raw_vv_array)
```

---

## 🧠 Python Inference API

```python
from src.inference import OilSpillInferenceEngine

# Initialize inference engine (loads models/best_unet_baseline.pt)
engine = OilSpillInferenceEngine()

# Run detection on GeoTIFF or image file
result = engine.detect("data/test/images/sample_scene.tif", apply_postprocessing=False)

# Access detection outputs and quantitative metrics
print(f"Status: {result['status']}")
print(f"Oil Pixels: {result['oil_pixels']:,} px")
print(f"Estimated Area: {result['area_km2']:.4f} km²")
print(f"Coverage: {result['coverage_pct']:.2f}%")
print(f"Confidence: {result['confidence']*100:.1f}%")
print(f"Spatial Metadata: {result['spatial_metadata']}")

# Extract GeoJSON slick polygons (Stage 1 schema)
vectorized_result = engine.detect_and_vectorize("data/test/images/sample_scene.tif")
geojson_features = vectorized_result["geojson"]
```

---

## 📦 Model Checkpoint Catalog

| Checkpoint | Status | Description |
|---|---|---|
| `models/best_unet_baseline.pt` | ✅ **PRODUCTION** | Official 1-ch VV U-Net (`features=16`) |
| `models/best_unet_baseline_v2.pt` | ⚠️ Experimental | V2 baseline training variant |
| `models/best_unet_plus_plus.pt` | ⚠️ Experimental | Nested U-Net++ architecture experiment |
| `models/unet_hard_negative.pt` | ⚠️ Experimental | Hard-negative mining experiment |
| `models/smoke_unet_baseline.pt` | 🧪 Smoke Test | 2-epoch validation checkpoint |
| `models/smoke_unet_plus_plus.pt` | 🧪 Smoke Test | 2-epoch validation checkpoint |

*For complete details on experimental training runs, diagnostic scripts, and legacy files, see [EXPERIMENTAL.md](EXPERIMENTAL.md).*

---

## 📜 License
SIH26143 Sentinel-1 SAR Oil Spill Segmentation Project.

