# Experimental & Legacy Artifacts

This document catalogs all experimental, legacy, and diagnostic files in the repository.
These are **not part of the production pipeline** — the production system uses only:
- `sih_dashboard.py` (demo entry point)
- `models/best_unet_baseline.pt` (production checkpoint)
- `src/` core modules

---

## ⚠️ Experimental Model Checkpoints

| Checkpoint | Experiment | Notes |
|-----------|-----------|-------|
| `models/best_unet_baseline_v2.pt` | Baseline V2 training | Alternate training run |
| `models/best_unet_plus_plus.pt` | U-Net++ architecture | Higher param count, no improvement |
| `models/unet_hard_negative.pt` | Hard-negative mining | FP reduction experiment |
| `models/smoke_unet_baseline.pt` | Smoke test | Quick validation only |
| `models/smoke_unet_plus_plus.pt` | Smoke test | Quick validation only |
| `results/exp_per_scene_tversky/best_exp_model.pt` | Per-scene Tversky loss | Recall experiment |

---

## 🔬 Experimental Training Scripts

| Script | Purpose |
|--------|---------|
| `run_baseline_training.py` | Original U-Net baseline trainer |
| `run_baseline_v2_training.py` | V2 baseline trainer variant |
| `run_hard_negative_training.py` | Hard-negative mining U-Net trainer |
| `run_unet_plus_plus_training.py` | U-Net++ architecture trainer |
| `run_exp_per_scene_tversky.py` | Per-scene Tversky loss experiment |

---

## 🔍 Diagnostic / Analysis Scripts

| Script | Purpose |
|--------|---------|
| `analyze_mask_pixel_distribution.py` | Mask pixel distribution analysis |
| `audit_global_validation_metrics.py` | Global validation metrics audit |
| `check_real_data_visualization.py` | Real data visual inspection |
| `generate_postprocessing_comparison.py` | Post-processing comparison visuals |
| `generate_sar_detection_geojson.py` | GeoJSON detection output generator |
| `inspect_dataset_csvs.py` | CSV dataset structure inspector |
| `inspect_dataset_structure.py` | TIFF dataset structure inspector |
| `investigate_class_mask_mismatch.py` | Class/mask label mismatch analysis |
| `run_diagnostic_audit.py` | Full diagnostic pipeline audit |

---

## 📊 Experimental Evaluation Scripts

| Script | Purpose |
|--------|---------|
| `eval_baseline.py` | Baseline model evaluation |
| `eval_baseline_v2.py` | V2 baseline evaluation |
| `eval_postprocessing_full_validation.py` | Post-processing validation experiment |

---

## 📁 Experimental Results Directories

| Directory | Contents |
|-----------|----------|
| `results/exp_per_scene_tversky/` | Per-scene Tversky experiment outputs |
| `results/smoke/` | Smoke test training curves |
| `results/unet_plus_plus_smoke/` | U-Net++ smoke test outputs |
| `results/unet_plus_plus/` | U-Net++ full training outputs |
| `results/hard_negative_experiment/` | Hard-negative experiment outputs |
| `results/baseline_v2/` | V2 baseline training outputs |

---

## 🏷️ Legacy / Deprecated Files

| File | Status | Replacement |
|------|--------|-------------|
| `run_demo_server.py` | **DEPRECATED** | `sih_dashboard.py` |

---

## 📝 Diagnostic Test Scene

**`20200319b.tif`** — This test scene is labelled as **DIAGNOSTIC** in `evaluate_final_test_set.py`.
It was inspected during development and is **excluded from the primary untouched benchmark metrics**.
The untouched test benchmark uses the remaining 6 test scenes.
