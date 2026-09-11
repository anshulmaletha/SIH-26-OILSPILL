"""
Reproducible Final Evaluation Script for 1-Channel VV U-Net Baseline Model.
Evaluates models/best_unet_baseline.pt on official test scenes using a strict evaluation protocol:
- Per-patch Dice, IoU, precision, recall, F1
- Separate metrics for non-empty and empty GT patches
- Global pixel-level TP/FP/FN/TN metrics
- Per-scene breakdown across all test scenes
- Primary results with raw U-Net (threshold=0.5, post-processing OFF)
- Optional post-processing experiment comparison
- Untouched test benchmark excluding 20200319b.tif
Saves all outputs to results/final_evaluation/
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
import tifffile

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.postprocessing.mask_enhancer import ConservativeMaskEnhancer
from src.inference import extract_spatial_resolution


def resolve_data_dir() -> Path:
    """Resolve base directory containing test data folder."""
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


def compute_patch_confusion_matrix(pred_mask: np.ndarray, gt_mask: np.ndarray) -> Tuple[int, int, int, int]:
    """Compute TP, FP, FN, TN for a binary prediction and ground truth pair."""
    gt_bool = (gt_mask > 0)
    pred_bool = (pred_mask > 0)

    tp = int(np.sum(pred_bool & gt_bool))
    fp = int(np.sum(pred_bool & ~gt_bool))
    fn = int(np.sum(~pred_bool & gt_bool))
    tn = int(np.sum(~pred_bool & ~gt_bool))
    return tp, fp, fn, tn


def compute_metrics_from_counts(tp: int, fp: int, fn: int, tn: int) -> Dict[str, float]:
    """Compute Dice, IoU, Precision, Recall, F1 from raw TP, FP, FN, TN counts."""
    gt_pos = tp + fn
    pred_pos = tp + fp
    total_px = tp + fp + fn + tn

    dice = (2.0 * tp) / (2.0 * tp + fp + fn + 1e-7)
    iou = tp / (tp + fp + fn + 1e-7)
    precision = tp / (tp + fp + 1e-7) if pred_pos > 0 else 1.0
    recall = tp / (tp + fn + 1e-7) if gt_pos > 0 else 1.0
    f1 = (2.0 * precision * recall) / (precision + recall + 1e-7) if (precision + recall) > 0 else 0.0
    accuracy = (tp + tn) / max(total_px, 1)

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "gt_pos": gt_pos,
        "pred_pos": pred_pos,
        "dice": float(dice),
        "iou": float(iou),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "accuracy": float(accuracy)
    }


def compute_single_patch_metrics(tp: int, fp: int, fn: int, tn: int) -> Dict[str, float]:
    """Compute single patch metric dictionary according to protocol for empty vs non-empty patches."""
    gt_pos = tp + fn
    pred_pos = tp + fp

    if gt_pos > 0:
        dice = (2.0 * tp) / (2.0 * tp + fp + fn + 1e-7)
        iou = tp / (tp + fp + fn + 1e-7)
        precision = tp / (tp + fp + 1e-7) if pred_pos > 0 else 0.0
        recall = tp / (tp + fn + 1e-7)
        f1 = (2.0 * precision * recall) / (precision + recall + 1e-7) if (precision + recall) > 0 else 0.0
    else:
        # Empty GT patch
        if fp == 0:
            dice = 1.0
            iou = 1.0
            precision = 1.0
            recall = 1.0
            f1 = 1.0
        else:
            dice = 0.0
            iou = 0.0
            precision = 0.0
            recall = 1.0
            f1 = 0.0

    return {
        "dice": float(dice),
        "iou": float(iou),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1)
    }


def evaluate_test_set():
    base_dir = resolve_data_dir()
    test_dir = base_dir / "test" if (base_dir / "test").exists() else base_dir
    img_dir = test_dir / "images"
    mask_dir = test_dir / "masks"

    if not img_dir.exists() or not mask_dir.exists():
        print(f"[ERROR] Test directory not found at: {img_dir}")
        sys.exit(1)

    checkpoint_path = PROJECT_ROOT / "models" / "best_unet_baseline.pt"
    if not checkpoint_path.exists():
        print(f"[ERROR] Checkpoint not found at: {checkpoint_path}")
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("=" * 85)
    print(" FINAL EVALUATION OF SENTINEL-1 SAR OIL SPILL U-NET BASELINE")
    print("=" * 85)
    print(f" Target Device             : {device}")
    print(f" Checkpoint Location       : {checkpoint_path}")
    print(f" Evaluation Data Directory : {test_dir}")

    # 1. Load Model
    model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # 2. Setup SAR Preprocessor with exact training channel statistics
    preprocessor = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    preprocessor.channel_stats = [{"mean": -15.4214, "std": 5.1238, "min": -35.0, "max": 0.0}]
    preprocessor.is_fitted = True

    # 3. Setup Optional Post-Processor for comparison experiment
    enhancer = ConservativeMaskEnhancer(
        high_threshold=0.5,
        low_threshold=0.35,
        min_noise_area_pixels=15,
        morph_kernel_size=3
    )

    # Output Directory Setup
    out_dir = PROJECT_ROOT / "results" / "final_evaluation"
    out_overlay_dir = out_dir / "overlays"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_overlay_dir.mkdir(parents=True, exist_ok=True)

    test_scene_files = sorted([p.name for p in img_dir.glob("*.tif")])
    print(f" Found {len(test_scene_files)} Test Scenes: {test_scene_files}\n")

    scene_records = []
    all_patch_metrics_raw = []
    all_patch_metrics_post = []

    # Pixel accumulators
    global_accum = {
        "raw_all": [0, 0, 0, 0],
        "raw_nonempty": [0, 0, 0, 0],
        "raw_empty": [0, 0, 0, 0],
        "post_all": [0, 0, 0, 0],
        "post_nonempty": [0, 0, 0, 0],
        "post_empty": [0, 0, 0, 0]
    }

    # Accumulators excluding 20200319b.tif (untouched set)
    untouched_accum = {
        "raw_all": [0, 0, 0, 0],
        "raw_nonempty": [0, 0, 0, 0],
        "raw_empty": [0, 0, 0, 0],
        "post_all": [0, 0, 0, 0],
        "post_nonempty": [0, 0, 0, 0],
        "post_empty": [0, 0, 0, 0]
    }

    patch_size = 256

    for scene_name in test_scene_files:
        is_diagnostic_scene = (scene_name.lower() == "20200319b.tif")
        img_path = img_dir / scene_name
        mask_path = mask_dir / scene_name

        img_arr = tifffile.imread(str(img_path)).astype(np.float32)
        gt_arr = tifffile.imread(str(mask_path))
        if gt_arr.ndim == 3:
            gt_arr = gt_arr[0]
        gt_arr = (gt_arr > 0).astype(np.uint8)

        # Extract spatial resolution from GeoTIFF metadata for area calculation
        px_w, px_h, has_spatial_meta, spatial_msg = extract_spatial_resolution(img_path)
        if has_spatial_meta and px_w is not None and px_h is not None:
            pixel_area_km2 = (px_w * px_h) / 1e6
            spatial_source = f"GeoTIFF metadata ({px_w:.2f}m x {px_h:.2f}m)"
        else:
            pixel_area_km2 = 0.0001  # 10m x 10m = 100 m² = 0.0001 km²
            spatial_source = "FALLBACK 10m x 10m (no GeoTIFF spatial metadata)"
            print(f"  [WARNING] {scene_name}: {spatial_msg}. Using default 10m x 10m pixel resolution for area.")

        if img_arr.ndim == 3:
            raw_2d = img_arr[0]
        else:
            raw_2d = img_arr

        h, w = raw_2d.shape

        # Tiled sliding window prediction over full scene
        prob_accum = np.zeros((h, w), dtype=np.float32)
        count_accum = np.zeros((h, w), dtype=np.float32)

        stride = 128
        row_starts = list(range(0, h - patch_size + 1, stride))
        if row_starts[-1] + patch_size < h:
            row_starts.append(h - patch_size)

        col_starts = list(range(0, w - patch_size + 1, stride))
        if col_starts[-1] + patch_size < w:
            col_starts.append(w - patch_size)

        with torch.no_grad():
            for r in row_starts:
                for c in col_starts:
                    crop = raw_2d[r:r + patch_size, c:c + patch_size]
                    crop_3d = np.expand_dims(crop, axis=0) if crop.ndim == 2 else crop
                    crop_norm = preprocessor.transform(crop_3d)
                    crop_t = torch.from_numpy(crop_norm).float().unsqueeze(0).to(device)
                    logits = model(crop_t)
                    probs = torch.sigmoid(logits).squeeze().cpu().numpy()

                    prob_accum[r:r + patch_size, c:c + patch_size] += probs
                    count_accum[r:r + patch_size, c:c + patch_size] += 1.0

        full_prob_map = prob_accum / np.maximum(count_accum, 1.0)
        raw_pred_mask = (full_prob_map >= 0.5).astype(np.uint8)
        post_pred_mask = enhancer.process(full_prob_map, raw_pred_mask)

        # ----------------------------------------------------
        # Extract non-overlapping 256x256 patches for protocol metrics
        # ----------------------------------------------------
        patch_r_starts = list(range(0, h - patch_size + 1, patch_size))
        if patch_r_starts[-1] + patch_size < h:
            patch_r_starts.append(h - patch_size)

        patch_c_starts = list(range(0, w - patch_size + 1, patch_size))
        if patch_c_starts[-1] + patch_size < w:
            patch_c_starts.append(w - patch_size)

        scene_tp_raw, scene_fp_raw, scene_fn_raw, scene_tn_raw = 0, 0, 0, 0
        scene_tp_post, scene_fp_post, scene_fn_post, scene_tn_post = 0, 0, 0, 0

        scene_patch_raw_list = []
        scene_patch_post_list = []

        scene_patches_total = 0
        scene_patches_nonempty = 0
        scene_patches_empty = 0

        for r in patch_r_starts:
            for c in patch_c_starts:
                patch_gt = gt_arr[r:r + patch_size, c:c + patch_size]
                patch_raw = raw_pred_mask[r:r + patch_size, c:c + patch_size]
                patch_post = post_pred_mask[r:r + patch_size, c:c + patch_size]

                tp_r, fp_r, fn_r, tn_r = compute_patch_confusion_matrix(patch_raw, patch_gt)
                tp_p, fp_p, fn_p, tn_p = compute_patch_confusion_matrix(patch_post, patch_gt)

                m_raw = compute_single_patch_metrics(tp_r, fp_r, fn_r, tn_r)
                m_post = compute_single_patch_metrics(tp_p, fp_p, fn_p, tn_p)

                is_gt_pos = (patch_gt.sum() > 0)
                m_raw["is_nonempty"] = is_gt_pos
                m_post["is_nonempty"] = is_gt_pos
                m_raw["scene"] = scene_name
                m_post["scene"] = scene_name

                scene_patch_raw_list.append(m_raw)
                scene_patch_post_list.append(m_post)
                all_patch_metrics_raw.append(m_raw)
                all_patch_metrics_post.append(m_post)

                scene_tp_raw += tp_r; scene_fp_raw += fp_r; scene_fn_raw += fn_r; scene_tn_raw += tn_r
                scene_tp_post += tp_p; scene_fp_post += fp_p; scene_fn_post += fn_p; scene_tn_post += tn_p

                # Global accumulators
                global_accum["raw_all"][0] += tp_r; global_accum["raw_all"][1] += fp_r; global_accum["raw_all"][2] += fn_r; global_accum["raw_all"][3] += tn_r
                global_accum["post_all"][0] += tp_p; global_accum["post_all"][1] += fp_p; global_accum["post_all"][2] += fn_p; global_accum["post_all"][3] += tn_p

                if not is_diagnostic_scene:
                    untouched_accum["raw_all"][0] += tp_r; untouched_accum["raw_all"][1] += fp_r; untouched_accum["raw_all"][2] += fn_r; untouched_accum["raw_all"][3] += tn_r
                    untouched_accum["post_all"][0] += tp_p; untouched_accum["post_all"][1] += fp_p; untouched_accum["post_all"][2] += fn_p; untouched_accum["post_all"][3] += tn_p

                if is_gt_pos:
                    scene_patches_nonempty += 1
                    global_accum["raw_nonempty"][0] += tp_r; global_accum["raw_nonempty"][1] += fp_r; global_accum["raw_nonempty"][2] += fn_r; global_accum["raw_nonempty"][3] += tn_r
                    global_accum["post_nonempty"][0] += tp_p; global_accum["post_nonempty"][1] += fp_p; global_accum["post_nonempty"][2] += fn_p; global_accum["post_nonempty"][3] += tn_p
                    if not is_diagnostic_scene:
                        untouched_accum["raw_nonempty"][0] += tp_r; untouched_accum["raw_nonempty"][1] += fp_r; untouched_accum["raw_nonempty"][2] += fn_r; untouched_accum["raw_nonempty"][3] += tn_r
                        untouched_accum["post_nonempty"][0] += tp_p; untouched_accum["post_nonempty"][1] += fp_p; untouched_accum["post_nonempty"][2] += fn_p; untouched_accum["post_nonempty"][3] += tn_p
                else:
                    scene_patches_empty += 1
                    global_accum["raw_empty"][0] += tp_r; global_accum["raw_empty"][1] += fp_r; global_accum["raw_empty"][2] += fn_r; global_accum["raw_empty"][3] += tn_r
                    global_accum["post_empty"][0] += tp_p; global_accum["post_empty"][1] += fp_p; global_accum["post_empty"][2] += fn_p; global_accum["post_empty"][3] += tn_p
                    if not is_diagnostic_scene:
                        untouched_accum["raw_empty"][0] += tp_r; untouched_accum["raw_empty"][1] += fp_r; untouched_accum["raw_empty"][2] += fn_r; untouched_accum["raw_empty"][3] += tn_r
                        untouched_accum["post_empty"][0] += tp_p; untouched_accum["post_empty"][1] += fp_p; untouched_accum["post_empty"][2] += fn_p; untouched_accum["post_empty"][3] += tn_p

                scene_patches_total += 1

        # Per-Scene Metrics Computation
        s_raw_metrics = compute_metrics_from_counts(scene_tp_raw, scene_fp_raw, scene_fn_raw, scene_tn_raw)
        s_post_metrics = compute_metrics_from_counts(scene_tp_post, scene_fp_post, scene_fn_post, scene_tn_post)

        df_s_raw = pd.DataFrame(scene_patch_raw_list)
        df_s_nonempty = df_s_raw[df_s_raw["is_nonempty"]]
        df_s_empty = df_s_raw[~df_s_raw["is_nonempty"]]

        scene_records.append({
            "scene_name": scene_name,
            "dimensions": f"{h}x{w}",
            "is_untouched_test": not is_diagnostic_scene,
            "spatial_source": spatial_source,
            "pixel_area_km2": pixel_area_km2,
            "total_patches": scene_patches_total,
            "nonempty_patches": scene_patches_nonempty,
            "empty_patches": scene_patches_empty,
            "gt_oil_pixels": int(gt_arr.sum()),
            "gt_area_km2": round(float(gt_arr.sum() * pixel_area_km2), 4),
            "raw_pred_oil_pixels": int(raw_pred_mask.sum()),
            "raw_pred_area_km2": round(float(raw_pred_mask.sum() * pixel_area_km2), 4),
            "post_pred_oil_pixels": int(post_pred_mask.sum()),
            "post_pred_area_km2": round(float(post_pred_mask.sum() * pixel_area_km2), 4),
            # Global Scene Metrics (Raw U-Net Primary)
            "scene_global_dice": round(s_raw_metrics["dice"], 4),
            "scene_global_iou": round(s_raw_metrics["iou"], 4),
            "scene_global_precision": round(s_raw_metrics["precision"], 4),
            "scene_global_recall": round(s_raw_metrics["recall"], 4),
            "scene_global_f1": round(s_raw_metrics["f1"], 4),
            # Macro Patch Averages (Raw U-Net Primary)
            "macro_patch_dice": round(float(df_s_raw["dice"].mean()), 4),
            "macro_patch_iou": round(float(df_s_raw["iou"].mean()), 4),
            "macro_patch_precision": round(float(df_s_raw["precision"].mean()), 4),
            "macro_patch_recall": round(float(df_s_raw["recall"].mean()), 4),
            "macro_patch_f1": round(float(df_s_raw["f1"].mean()), 4),
            "nonempty_patch_dice": round(float(df_s_nonempty["dice"].mean()), 4) if len(df_s_nonempty) > 0 else None,
            "nonempty_patch_precision": round(float(df_s_nonempty["precision"].mean()), 4) if len(df_s_nonempty) > 0 else None,
            "nonempty_patch_recall": round(float(df_s_nonempty["recall"].mean()), 4) if len(df_s_nonempty) > 0 else None,
            "empty_patch_precision": round(float(df_s_empty["precision"].mean()), 4) if len(df_s_empty) > 0 else None,
            # Optional Post-Processed Comparison
            "post_global_dice": round(s_post_metrics["dice"], 4),
            "post_global_precision": round(s_post_metrics["precision"], 4),
            "post_global_recall": round(s_post_metrics["recall"], 4)
        })

        # Save 4-Panel Visualization Overlay for Scene
        fig, axes = plt.subplots(1, 4, figsize=(20, 5))
        ax_sar, ax_gt, ax_pred, ax_ovr = axes

        vmin, vmax = np.percentile(raw_2d, [2, 98])
        ax_sar.imshow(raw_2d, cmap="gray", vmin=vmin, vmax=vmax)
        ax_sar.set_title(f"1. SAR Input ({scene_name})\n{h}x{w} pixels", fontsize=10, fontweight="bold")
        ax_sar.axis("off")

        ax_gt.imshow(gt_arr, cmap="cividis", vmin=0, vmax=1)
        ax_gt.set_title(f"2. Ground Truth Mask\n({int(gt_arr.sum()):,} px | {gt_arr.sum()*pixel_area_km2:.2f} km²)", fontsize=10, fontweight="bold")
        ax_gt.axis("off")

        ax_pred.imshow(full_prob_map, cmap="magma", vmin=0, vmax=1)
        ax_pred.set_title(f"3. U-Net Heatmap (Primary Raw)\n(Pred: {int(raw_pred_mask.sum()):,} px | {raw_pred_mask.sum()*pixel_area_km2:.2f} km²)", fontsize=10, fontweight="bold")
        ax_pred.axis("off")

        norm_sar = np.clip((raw_2d - vmin) / (vmax - vmin + 1e-7), 0, 1)
        rgb = np.dstack([norm_sar, norm_sar, norm_sar])
        rgb[gt_arr > 0] = [0.2, 0.5, 1.0]           # Blue = Ground Truth
        rgb[raw_pred_mask > 0] = [1.0, 0.2, 0.2]   # Red = Raw U-Net Prediction
        overlap = (gt_arr > 0) & (raw_pred_mask > 0)
        rgb[overlap] = [1.0, 0.0, 1.0]                 # Magenta = True Positives

        ax_ovr.imshow(rgb)
        ax_ovr.set_title(f"4. Composite Overlay\n(Dice: {s_raw_metrics['dice']:.4f} | Prec: {s_raw_metrics['precision']:.4f})", fontsize=10, fontweight="bold")
        ax_ovr.axis("off")

        note = " [Diagnostic Scene]" if is_diagnostic_scene else " [Untouched Test Scene]"
        plt.suptitle(f"SIH 2026 Test Scene Evaluation: {scene_name}{note}", fontsize=13, fontweight="bold")
        plt.tight_layout()

        overlay_out_path = out_overlay_dir / f"overlay_{Path(scene_name).stem}.png"
        plt.savefig(overlay_out_path, dpi=130, bbox_inches="tight")
        plt.close(fig)
        print(f"  Processed {scene_name:<18} | GT: {int(gt_arr.sum()):8,d} px | Raw Pred: {int(raw_pred_mask.sum()):8,d} px | Global Dice: {s_raw_metrics['dice']:.4f} -> Saved overlay")

    # Save Per-Scene CSV
    df_scenes = pd.DataFrame(scene_records)
    csv_out_path = out_dir / "per_scene_metrics.csv"
    df_scenes.to_csv(csv_out_path, index=False)

    # ----------------------------------------------------
    # Calculate Macro and Global Aggregate Metrics
    # ----------------------------------------------------
    df_all_raw = pd.DataFrame(all_patch_metrics_raw)
    df_all_post = pd.DataFrame(all_patch_metrics_post)

    df_ne_raw = df_all_raw[df_all_raw["is_nonempty"]]
    df_e_raw = df_all_raw[~df_all_raw["is_nonempty"]]

    df_ne_post = df_all_post[df_all_post["is_nonempty"]]
    df_e_post = df_all_post[~df_all_post["is_nonempty"]]

    # Global pixel-level aggregates across ALL 7 test scenes
    g_raw_all = compute_metrics_from_counts(*global_accum["raw_all"])
    g_raw_ne = compute_metrics_from_counts(*global_accum["raw_nonempty"])
    g_raw_e = compute_metrics_from_counts(*global_accum["raw_empty"])

    g_post_all = compute_metrics_from_counts(*global_accum["post_all"])
    g_post_ne = compute_metrics_from_counts(*global_accum["post_nonempty"])
    g_post_e = compute_metrics_from_counts(*global_accum["post_empty"])

    # Global pixel-level aggregates for 6 UNTOUCHED test scenes
    u_raw_all = compute_metrics_from_counts(*untouched_accum["raw_all"])
    u_raw_ne = compute_metrics_from_counts(*untouched_accum["raw_nonempty"])
    u_raw_e = compute_metrics_from_counts(*untouched_accum["raw_empty"])

    metrics_summary_dict = {
        "evaluation_protocol": {
            "model_checkpoint": "models/best_unet_baseline.pt",
            "architecture": "1-Channel U-Net Baseline (features=16)",
            "input_channel": "VV",
            "preprocessing": "VV clip [-35.0, 0.0] dB + z-score normalization (mean -15.4214, std 5.1238)",
            "decision_threshold": 0.5,
            "primary_mode": "Raw U-Net (Threshold 0.5, Post-Processing OFF)",
            "optional_experiment": "Conservative Mask Enhancer (Hysteresis low=0.35, high=0.50, min_area=15, morph=3x3)",
            "total_test_scenes": len(test_scene_files),
            "untouched_test_scenes_count": len(test_scene_files) - 1,
            "diagnostic_scene_excluded_from_untouched_set": "20200319b.tif"
        },
        "untouched_test_set_6_scenes": {
            "global_pixel_metrics_primary_raw": u_raw_all,
            "global_pixel_nonempty_gt_patches": u_raw_ne,
            "global_pixel_empty_gt_patches": u_raw_e
        },
        "all_7_test_scenes_overall": {
            "global_pixel_metrics_primary_raw": g_raw_all,
            "global_pixel_nonempty_gt_patches": g_raw_ne,
            "global_pixel_empty_gt_patches": g_raw_e,
            "macro_patch_metrics_primary_raw": {
                "all_patches_mean_dice": float(df_all_raw["dice"].mean()),
                "all_patches_mean_iou": float(df_all_raw["iou"].mean()),
                "all_patches_mean_precision": float(df_all_raw["precision"].mean()),
                "all_patches_mean_recall": float(df_all_raw["recall"].mean()),
                "all_patches_mean_f1": float(df_all_raw["f1"].mean()),
                "nonempty_patches_mean_dice": float(df_ne_raw["dice"].mean()),
                "nonempty_patches_mean_precision": float(df_ne_raw["precision"].mean()),
                "nonempty_patches_mean_recall": float(df_ne_raw["recall"].mean()),
                "empty_patches_mean_precision": float(df_e_raw["precision"].mean())
            },
            "optional_postprocessing_comparison": {
                "global_pixel_metrics_post": g_post_all,
                "global_pixel_nonempty_gt_patches_post": g_post_ne,
                "all_patches_mean_dice_post": float(df_all_post["dice"].mean()),
                "nonempty_patches_mean_dice_post": float(df_ne_post["dice"].mean())
            }
        }
    }

    # Save JSON summary
    json_out_path = out_dir / "final_evaluation_metrics.json"
    with open(json_out_path, "w") as f:
        json.dump(metrics_summary_dict, f, indent=2)

    # Generate Human-Readable Text Report
    txt_out_path = out_dir / "final_evaluation_summary.txt"
    with open(txt_out_path, "w", encoding="utf-8") as f:
        f.write("=" * 85 + "\n")
        f.write(" SIH 2026 SENTINEL-1 SAR OIL SPILL DETECTOR - FINAL EVALUATION REPORT\n")
        f.write("=" * 85 + "\n\n")

        f.write("1. EVALUATION PROTOCOL SPECIFICATION\n")
        f.write("-" * 85 + "\n")
        f.write(f" Model Checkpoint    : models/best_unet_baseline.pt\n")
        f.write(f" Architecture        : 1-Channel U-Net Baseline (features=16, 10,157,767 bytes)\n")
        f.write(f" Input Channel       : 1-Channel VV\n")
        f.write(f" Preprocessing       : Clip VV [-35.0, 0.0] dB + Z-score Normalization\n")
        f.write(f" Decision Threshold  : 0.50 (Raw sigmoid output)\n")
        f.write(f" Primary Mode        : Raw U-Net (Post-Processing OFF)\n")
        f.write(f" Diagnostic Note     : 20200319b.tif was inspected diagnostically; not used for tuning.\n")
        f.write(f" Untouched Benchmark: 6 test scenes (excluding 20200319b.tif)\n")
        f.write(f" Total Test Benchmark: All 7 test scenes\n\n")

        f.write("2. PRIMARY BENCHMARK: UNTOUCHED TEST SET (6 SCENES)\n")
        f.write("-" * 85 + "\n")
        f.write(f"   Global Dice       : {u_raw_all['dice']:.4f}\n")
        f.write(f"   Global IoU        : {u_raw_all['iou']:.4f}\n")
        f.write(f"   Global Precision  : {u_raw_all['precision']:.4f}\n")
        f.write(f"   Global Recall     : {u_raw_all['recall']:.4f}\n")
        f.write(f"   Global F1-Score   : {u_raw_all['f1']:.4f}\n")
        f.write(f"   Total GT Oil Px   : {u_raw_all['gt_pos']:,} px ({u_raw_all['gt_pos']*0.0001:.2f} km²)\n")
        f.write(f"   Total Pred Oil Px : {u_raw_all['pred_pos']:,} px ({u_raw_all['pred_pos']*0.0001:.2f} km²)\n")
        f.write(f"   True Positives TP : {u_raw_all['tp']:,} px\n")
        f.write(f"   False Positives FP: {u_raw_all['fp']:,} px\n")
        f.write(f"   False Negatives FN: {u_raw_all['fn']:,} px\n\n")

        f.write("3. OVERALL BENCHMARK: ALL 7 TEST SCENES\n")
        f.write("-" * 85 + "\n")
        f.write(f"   Global Dice       : {g_raw_all['dice']:.4f}\n")
        f.write(f"   Global IoU        : {g_raw_all['iou']:.4f}\n")
        f.write(f"   Global Precision  : {g_raw_all['precision']:.4f}\n")
        f.write(f"   Global Recall     : {g_raw_all['recall']:.4f}\n")
        f.write(f"   Global F1-Score   : {g_raw_all['f1']:.4f}\n\n")

        f.write("4. PER-SCENE BREAKDOWN (PRIMARY RAW U-NET)\n")
        f.write("-" * 85 + "\n")
        f.write(f" Scene Name         | Status     | Dimensions | GT Oil (px) | Pred Oil (px) | Global Dice | Precision | Recall\n")
        f.write(" -------------------+------------+------------+-------------+---------------+-------------+-----------+---------\n")
        for rec in scene_records:
            status_str = "Untouched" if rec["is_untouched_test"] else "Diagnostic"
            f.write(f" {rec['scene_name']:<18} | {status_str:<10} | {rec['dimensions']:<10} | {rec['gt_oil_pixels']:11,d} | {rec['raw_pred_oil_pixels']:13,d} | {rec['scene_global_dice']:11.4f} | {rec['scene_global_precision']:9.4f} | {rec['scene_global_recall']:.4f}\n")

        f.write("\n" + "=" * 85 + "\n")
        f.write(" END OF EVALUATION REPORT\n")
        f.write("=" * 85 + "\n")

    print("\n" + "=" * 85)
    print(" [SUCCESS] FINAL TEST EVALUATION COMPLETE!")
    print(f"   - Summary Text Report : {txt_out_path}")
    print(f"   - Metrics JSON Data   : {json_out_path}")
    print(f"   - Per-Scene CSV File  : {csv_out_path}")
    print(f"   - Visual Overlays Dir : {out_overlay_dir}")
    print("=" * 85)


if __name__ == "__main__":
    evaluate_test_set()
