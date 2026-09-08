# SIH 26143 — Maritime Situation & Oil Spill Intelligence Platform

An end-to-end maritime intelligence and oil spill attribution system developed for SIH 2026. This platform integrates satellite SAR imagery oil slick detection, hydrodynamic drift and physics simulation, AIS trajectory correlation, dark vessel identification, and interactive situational visualization.

---

## 🏗️ Architecture & Modules

The platform is structured into four cohesive pipelines and interfaces:

1. **Frontend Maritime Situation Deck (`src/components/`, `src/routes/`, `src/lib/map/`)**
   - Interactive web interface with MapLibre/Deck.gl visualization.
   - Real-time SAR raster overlay, slick polygon rendering, AIS vessel track trajectories, H3 spatial corridor heatmaps, drift particle animations, dark vessel alerts, and suspect ranking tables.
   - Case file export and telemetry reporting.

2. **Phase 1 (P1): Oil Spill Segmentation & Detection Pipeline (`src/models/`, `src/preprocessing/`, `src/inference.py`, `src/pipeline.py`)**
   - Deep learning segmentation (U-Net / U-Net++ architectures) trained on Sentinel-1 SAR VV imagery.
   - Custom SAR preprocessing (speckle filtering, clipping, normalization).
   - Post-processing hysteresis thresholding and polygon vectorization into GeoJSON format.

3. **Phase 2 (P2): Ocean Drift & Physics Engine (`engine.py`, `hycom.py`, `era5.py`, `forward_forecast.py`)**
   - Backward and forward particle drift simulation.
   - Integration with HYCOM ocean surface currents and ERA5 wind vector datasets.
   - Time-series drift tracking and uncertainty corridor generation.

4. **Phase 3 (P3): Vessel Attribution & Scoring Engine (`scoring_engine.py`, `lookalike_filter.py`, `pipeline_integrator.py`)**
   - Multi-factor suspect vessel ranking (spatial proximity, temporal alignment, track anomaly, vessel type risk).
   - Dark vessel classification (AIS transmission gaps, anomalous maneuvers).
   - Automated case file generation and export.

---

## 📁 Repository Structure

```text
SIH-26-OILSPILL/
├── src/                          # Source Code
│   ├── components/               # React UI & Dashboard components
│   │   ├── dashboard/            # Suspect table, Dark vessel alerts, Case export
│   │   ├── map/                  # MapLibre/Deck.gl Map view, Layers, Legend, Slider
│   │   └── ui/                   # UI primitive components
│   ├── lib/                      # Frontend adapters, contracts, map layers & demo data
│   │   ├── adapters/             # P1, P3, P4, P5 pipeline data adapters
│   │   ├── contracts/            # TypeScript schemas & contracts
│   │   ├── data/                 # Offline demo dataset
│   │   └── map/                  # Map configurations & Deck.gl layers
│   ├── models/                   # PyTorch Neural Network architectures (UNet, UNet++)
│   ├── preprocessing/            # SAR preprocessing, speckle filter, normalizers
│   ├── postprocessing/           # Mask enhancement, contour vectorization
│   ├── data/                     # Dataset loaders, windowed patchers, scene splitters
│   ├── evaluation/               # Metrics (Dice, IoU, F1, precision, recall)
│   ├── inference.py              # OilSpillInferenceEngine production inference
│   ├── pipeline.py               # Integrated P1 segmentation pipeline
│   └── config.py                 # P1 configuration & path definitions
│
├── models/                       # Model Weights
│   └── best_unet_baseline.pt     # Production 1-ch VV U-Net checkpoint
│
├── engine.py                     # P2: Physics drift simulation engine
├── hycom.py                      # P2: HYCOM ocean currents integration
├── era5.py                       # P2: ERA5 wind velocity integration
├── forward_forecast.py           # P2: Forward spill drift forecasting
├── run_mumbai_demo.py            # P2: Mumbai drift demo script
│
├── scoring_engine.py             # P3: Suspect vessel scoring engine
├── lookalike_filter.py           # P3: Natural lookalike discrimination filter
├── pipeline_integrator.py        # P3: End-to-end pipeline integrator
├── case_file.json                # P3: Sample generated case file
├── ranked_suspects.json          # P3: Suspect ranking output
│
├── sih_dashboard.py              # Gradio/Streamlit SAR inference dashboard
├── run_demo_cli.py               # CLI inference utility
├── evaluate_final_test_set.py    # Test set evaluation benchmark
├── test_*.py                     # Test suites (P1, P2, P3 unit & integration tests)
├── requirements.txt              # Python dependencies
├── package.json                  # Node.js dependencies
└── README.md                     # Project documentation
```

---

## 🚀 Quick Start

### 🌐 Frontend Setup (Web Dashboard)

```bash
# Install Node dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### 🐍 Python Backend & AI Pipelines Setup

```bash
# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Run P1 SAR Segmentation Demo
```bash
# Run CLI demo on sample SAR data
python run_demo_cli.py --sample positive

# Launch SAR Inference Web Dashboard
python sih_dashboard.py
```

#### Run P2 Physics Drift Simulation
```bash
# Run Mumbai drift simulation demo
python run_mumbai_demo.py
```

#### Run P3 Attribution Pipeline & Tests
```bash
# Run end-to-end attribution integration
python pipeline_integrator.py

# Run test suites
python -m pytest test_*.py
```

---

## 🧪 Testing & Verification

- `python test_phase1_lookalike.py` — Verifies lookalike filtering logic.
- `python test_phase2_scoring.py` — Verifies suspect scoring algorithms.
- `python test_phase3_integration.py` — Validates complete multi-stage pipeline integration.
- `python test_sar_preprocessing.py` — Validates Sentinel-1 SAR preprocessing and normalization.
- `python test_unet.py` — Validates neural network model forward/backward pass.
- `npm run build` — Validates TypeScript compilation and frontend bundling.

---

## 📜 License
SIH 2026 — Maritime Situation & Oil Spill Intelligence Platform.
