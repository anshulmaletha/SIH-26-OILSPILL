"""
Hard-Negative Mining U-Net Training & Benchmark Runner.
Trains one improved U-Net model (models/unet_hard_negative.pt) focused on false positive reduction.

Key Features:
- 1-channel VV U-Net (features=16)
- VV clip [-35, 0] dB, z-score normalization
- Scene-level train/val split (zero scene overlap)
- Hard-Negative Mining: empty training patches ranked by baseline FP prediction mass
- FP-Penalizing Loss: BCETverskyLoss (alpha=0.7 FP penalty, beta=0.3 FN weight)
- Evaluates against untouched baseline (models/best_unet_baseline.pt) on validation set
"""

import argparse
import json
import os
import sys
import time
import random
from pathlib import Path
from typing import Dict, Any, List, Tuple

# Agent/piped runs use block-buffered stdout, so prints stay invisible until
# the process exits or the buffer fills. Force line buffering immediately.
os.environ.setdefault("PYTHONUNBUFFERED", "1")
try:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)
except Exception:
    pass

def log(msg: str = "") -> None:
    print(msg, flush=True)


log("[startup] interpreter alive; importing libraries (torch/matplotlib may take a while)...")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset
from src.training.losses import BCETverskyLoss
from src.evaluation.metrics import calculate_segmentation_metrics

log("[startup] libraries imported")


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


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


def compute_confusion_matrix_counts(pred_mask: np.ndarray, gt_mask: np.ndarray) -> Tuple[int, int, int, int]:
    gt_bool = (gt_mask > 0)
    pred_bool = (pred_mask > 0)
    tp = int(np.sum(pred_bool & gt_bool))
    fp = int(np.sum(pred_bool & ~gt_bool))
    fn = int(np.sum(~pred_bool & gt_bool))
    tn = int(np.sum(~pred_bool & ~gt_bool))
    return tp, fp, fn, tn


def evaluate_model_on_val_set(
    model: nn.Module,
    val_ds: SARPatchDataset,
    device: torch.device,
    log_every: int = 200,
) -> Dict[str, Any]:
    """Evaluate model across full validation set and compute global pixel metrics & patch averages."""
    model.eval()
    
    tp_all, fp_all, fn_all, tn_all = 0, 0, 0, 0
    tp_ne, fp_ne, fn_ne, tn_ne = 0, 0, 0, 0
    tp_e, fp_e, fn_e, tn_e = 0, 0, 0, 0

    patch_dices, patch_ious, patch_precisions, patch_recalls = [], [], [], []
    ne_dices, ne_precisions, ne_recalls = [], [], []

    empty_count, nonempty_count = 0, 0
    n_val = len(val_ds)
    t_eval = time.time()

    with torch.no_grad():
        for idx in range(n_val):
            item = val_ds[idx]
            img_t = item["image"].unsqueeze(0).to(device)
            gt_arr = (item["mask"].squeeze().numpy() > 0).astype(np.uint8)

            logits = model(img_t)
            prob_map = torch.sigmoid(logits).squeeze().cpu().numpy()
            pred_b = (prob_map >= 0.5).astype(np.uint8)

            tp, fp, fn, tn = compute_confusion_matrix_counts(pred_b, gt_arr)

            tp_all += tp; fp_all += fp; fn_all += fn; tn_all += tn
            gt_pos = tp + fn

            if gt_pos > 0:
                nonempty_count += 1
                tp_ne += tp; fp_ne += fp; fn_ne += fn; tn_ne += tn
                p_dice = (2.0 * tp) / (2.0 * tp + fp + fn + 1e-7)
                p_iou = tp / (tp + fp + fn + 1e-7)
                p_prec = tp / (tp + fp + 1e-7) if (tp + fp) > 0 else 0.0
                p_rec = tp / (tp + fn + 1e-7)

                ne_dices.append(p_dice)
                ne_precisions.append(p_prec)
                ne_recalls.append(p_rec)
            else:
                empty_count += 1
                tp_e += tp; fp_e += fp; fn_e += fn; tn_e += tn
                p_dice = 1.0 if fp == 0 else 0.0
                p_iou = 1.0 if fp == 0 else 0.0
                p_prec = 1.0 if fp == 0 else 0.0
                p_rec = 1.0

            patch_dices.append(p_dice)
            patch_ious.append(p_iou)
            patch_precisions.append(p_prec)
            patch_recalls.append(p_rec)

            if log_every and (idx == 0 or (idx + 1) % log_every == 0 or (idx + 1) == n_val):
                log(f"  val eval {idx + 1}/{n_val} | {time.time() - t_eval:.1f}s")

    # Global pixel calculations
    global_dice = (2.0 * tp_all) / (2.0 * tp_all + fp_all + fn_all + 1e-7)
    global_iou = tp_all / (tp_all + fp_all + fn_all + 1e-7)
    global_prec = tp_all / (tp_all + fp_all + 1e-7) if (tp_all + fp_all) > 0 else 1.0
    global_rec = tp_all / (tp_all + fn_all + 1e-7) if (tp_all + fn_all) > 0 else 1.0
    global_f1 = (2.0 * global_prec * global_rec) / (global_prec + global_rec + 1e-7)

    ne_global_dice = (2.0 * tp_ne) / (2.0 * tp_ne + fp_ne + fn_ne + 1e-7)
    ne_global_prec = tp_ne / (tp_ne + fp_ne + 1e-7) if (tp_ne + fp_ne) > 0 else 1.0
    ne_global_rec = tp_ne / (tp_ne + fn_ne + 1e-7) if (tp_ne + fn_ne) > 0 else 1.0

    return {
        "global_tp": tp_all,
        "global_fp": fp_all,
        "global_fn": fn_all,
        "global_tn": tn_all,
        "global_gt_pos": tp_all + fn_all,
        "global_pred_pos": tp_all + fp_all,
        "global_dice": float(global_dice),
        "global_iou": float(global_iou),
        "global_precision": float(global_prec),
        "global_recall": float(global_rec),
        "global_f1": float(global_f1),
        # Non-empty GT
        "nonempty_tp": tp_ne,
        "nonempty_fp": fp_ne,
        "nonempty_fn": fn_ne,
        "nonempty_global_dice": float(ne_global_dice),
        "nonempty_global_precision": float(ne_global_prec),
        "nonempty_global_recall": float(ne_global_rec),
        # Empty GT false positives
        "empty_fp": fp_e,
        "empty_tn": tn_e,
        "empty_patches_count": empty_count,
        "nonempty_patches_count": nonempty_count,
        # Patch Macro Averages
        "macro_patch_dice": float(np.mean(patch_dices)),
        "macro_patch_precision": float(np.mean(patch_precisions)),
        "macro_patch_recall": float(np.mean(patch_recalls)),
        "nonempty_patch_dice": float(np.mean(ne_dices)) if len(ne_dices) > 0 else 0.0,
        "nonempty_patch_precision": float(np.mean(ne_precisions)) if len(ne_precisions) > 0 else 0.0,
        "nonempty_patch_recall": float(np.mean(ne_recalls)) if len(ne_recalls) > 0 else 0.0
    }


def main(startup_test: bool = False):
    set_seed(42)
    start_time = time.time()

    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"
    log(f"[startup] data_dir={base_dir}")
    log(f"[startup] train_dir={train_dir}")
    log(f"[startup] csv={csv_file}")

    if not csv_file.exists():
        log(f"[ERROR] CSV dataset file not found at: {csv_file}")
        sys.exit(1)

    baseline_ckpt_path = PROJECT_ROOT / "models" / "best_unet_baseline.pt"
    if not baseline_ckpt_path.exists():
        log(f"[ERROR] Baseline checkpoint not found at: {baseline_ckpt_path}")
        sys.exit(1)

    new_ckpt_path = PROJECT_ROOT / "models" / "unet_hard_negative.pt"
    results_dir = PROJECT_ROOT / "results" / "hard_negative_experiment"
    results_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    log("=" * 85)
    log(" HARD-NEGATIVE MINING U-NET TRAINING EXPERIMENT")
    if startup_test:
        log(" MODE: STARTUP TEST (no training, baseline checkpoint read-only)")
    log("=" * 85)
    log(f" Target Compute Device : {device}")
    log(f" Baseline Checkpoint   : {baseline_ckpt_path} (Read-Only)")
    log(f" Target Checkpoint     : {new_ckpt_path}")
    log(f" Output Results Folder : {results_dir}")

    # 1. Scene-Level Disjoint Split (Zero Scene Overlap)
    log("[startup] reading CSV and creating scene split (no TIFF scan in this step)...")
    t0 = time.time()
    train_df, val_df, train_scenes, val_scenes, is_overlap_zero = create_scene_split(
        csv_file_or_df=csv_file,
        val_scene_ratio=0.25,
        seed=42
    )
    log(f"[startup] scene split done in {time.time() - t0:.2f}s")

    log(f"\n Train Scenes ({len(train_scenes)}) : {train_scenes}")
    log(f" Val Scenes   ({len(val_scenes)})   : {val_scenes}")
    log(f" Scene Overlap Is Zero: {is_overlap_zero}")
    log(f" Train patches: {len(train_df)} | Val patches: {len(val_df)}")

    banned_scenes = {"20200319b.tif", "20200319b.tiff"}
    used_scenes = set(train_scenes) | set(val_scenes)
    if used_scenes & banned_scenes:
        log(f"[WARN] Dropping banned test scene(s) from train/val: {sorted(used_scenes & banned_scenes)}")
        train_df = train_df[~train_df["scene_name"].isin(banned_scenes)].copy().reset_index(drop=True)
        val_df = val_df[~val_df["scene_name"].isin(banned_scenes)].copy().reset_index(drop=True)
        train_scenes = [s for s in train_scenes if s not in banned_scenes]
        val_scenes = [s for s in val_scenes if s not in banned_scenes]
    else:
        log(" Confirmed 20200319b.tif is not in train/val scene lists.")

    # 2. Fit Preprocessor strictly on training data
    # Dataset __init__ only copies the DataFrame; TIFF I/O starts on first __getitem__.
    fit_n = 4 if startup_test else 50
    log(f"[startup] fitting preprocessor on first {fit_n} train patches (first TIFF scene load can be slow)...")
    preprocessor = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    raw_train_ds = SARPatchDataset(train_df.iloc[:fit_n], data_dir=train_dir, patch_size=256, return_dict=False)
    fit_imgs = []
    for i in range(len(raw_train_ds)):
        t1 = time.time()
        img, _mask = raw_train_ds[i]
        fit_imgs.append(img.numpy())
        log(f"[startup] loaded fit patch {i + 1}/{len(raw_train_ds)} in {time.time() - t1:.2f}s "
            f"(cached scenes={len(raw_train_ds._scene_cache)})")
    preprocessor.fit(fit_imgs)
    log("[startup] preprocessor fit complete")

    full_train_ds = SARPatchDataset(train_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)
    full_val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)
    log(f"[startup] dataset objects created (train={len(full_train_ds)}, val={len(full_val_ds)}; TIFFs still lazy)")

    if startup_test:
        log("[startup] loading 2 val patches to confirm lazy TIFF crop path...")
        for i in range(min(2, len(full_val_ds))):
            t1 = time.time()
            item = full_val_ds[i]
            log(f"[startup] val patch {i} loaded in {time.time() - t1:.2f}s "
                f"image={tuple(item['image'].shape)} mask_sum={float(item['mask'].sum()):.0f} "
                f"scene={item['source_tiff']}")

        log("[startup] loading baseline checkpoint read-only (no write)...")
        t1 = time.time()
        baseline_model = UNet(in_channels=1, out_channels=1, features=16).to(device)
        baseline_ckpt = torch.load(baseline_ckpt_path, map_location=device)
        baseline_model.load_state_dict(baseline_ckpt["model_state_dict"])
        baseline_model.eval()
        log(f"[startup] baseline loaded in {time.time() - t1:.2f}s (keys={list(baseline_ckpt.keys())})")
        with torch.no_grad():
            sample = full_val_ds[0]["image"].unsqueeze(0).to(device)
            logits = baseline_model(sample)
        log(f"[startup] baseline forward ok, logits={tuple(logits.shape)}")
        log(f"[startup] SUCCESS in {time.time() - start_time:.2f}s - no training, baseline not modified")
        return

    # 3. Load Untouched Baseline Model to Mine Hard Negatives from Training Scenes
    log("\n" + "-" * 85)
    log(" STEP 1: MINING HARD-NEGATIVE TRAINING PATCHES USING BASELINE MODEL")
    log(" " + "-" * 85)

    baseline_model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    baseline_ckpt = torch.load(baseline_ckpt_path, map_location=device)
    baseline_model.load_state_dict(baseline_ckpt["model_state_dict"])
    baseline_model.eval()

    pos_indices = []
    empty_candidates = []  # List of tuples: (idx, fp_pixel_count, mean_prob)

    n_train = len(full_train_ds)
    log(f" Scanning {n_train} train patches (lazy TIFF cache + baseline FP score). Progress every 50 items.")
    t_scan = time.time()
    with torch.no_grad():
        for idx in range(n_train):
            item = full_train_ds[idx]
            gt_mask = item["mask"].squeeze().numpy()
            is_pos = (gt_mask.sum() > 0)

            if is_pos:
                pos_indices.append(idx)
            else:
                img_t = item["image"].unsqueeze(0).to(device)
                logits = baseline_model(img_t)
                prob_map = torch.sigmoid(logits).squeeze().cpu().numpy()
                fp_count = int(np.sum(prob_map >= 0.5))
                mean_prob = float(np.mean(prob_map))
                empty_candidates.append((idx, fp_count, mean_prob))

            if idx == 0 or (idx + 1) % 50 == 0 or (idx + 1) == n_train:
                elapsed = time.time() - t_scan
                log(f"  mining {idx + 1}/{n_train} | cached_scenes={len(full_train_ds._scene_cache)} | {elapsed:.1f}s")

    # Sort empty candidates by FP count descending, then mean prob descending
    empty_candidates.sort(key=lambda x: (x[1], x[2]), reverse=True)

    num_pos = len(pos_indices)
    # Mine top hard negatives (equal to positive count for 1:1 ratio)
    hard_neg_indices = [c[0] for c in empty_candidates[:num_pos]]

    train_indices = np.array(pos_indices + hard_neg_indices)
    np.random.seed(42)
    np.random.shuffle(train_indices)

    log(f" Total Positive GT Patches Mined    : {num_pos}")
    log(f" Total Hard-Negative Patches Mined  : {len(hard_neg_indices)}")
    log(f" Combined Balanced Training Subset : {len(train_indices)} patches (1.00:1.00 ratio)")

    # 4. DataLoader Setup
    train_subset = Subset(full_train_ds, train_indices)
    train_loader = DataLoader(train_subset, batch_size=16, shuffle=True, num_workers=0)

    # 5. Initialize Improved U-Net Model, Loss, & Optimizer
    log("\n" + "-" * 85)
    log(" STEP 2: TRAINING HARD-NEGATIVE U-NET EXPERIMENT (BCETversky Loss alpha=0.7, beta=0.3)")
    log(" " + "-" * 85)

    model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    # BCETverskyLoss: alpha=0.70 heavily penalizes FP, beta=0.30 preserves recall
    criterion = BCETverskyLoss(bce_weight=0.4, tversky_weight=0.6, alpha=0.70, beta=0.30)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=2)

    max_epochs = 20
    patience = 4
    best_val_dice = -1.0
    best_epoch = 0
    patience_counter = 0

    history = {
        "epoch": [], "train_loss": [], "val_dice": [],
        "val_precision": [], "val_recall": [], "val_f1": []
    }

    log(f" {'Epoch':<6} | {'Train Loss':<10} | {'Val Dice':<10} | {'Val Precision':<13} | {'Val Recall':<10} | {'Val F1':<10}")
    log("-" * 80)

    for epoch in range(1, max_epochs + 1):
        model.train()
        train_loss_sum = 0.0
        train_samples = 0

        n_batches = len(train_loader)
        log(f" Epoch {epoch}/{max_epochs}: training {n_batches} batches...")
        for b_i, batch in enumerate(train_loader, 1):
            images = batch["image"].to(device)
            masks = batch["mask"].to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)

            loss.backward()
            optimizer.step()

            bs = images.size(0)
            train_loss_sum += loss.item() * bs
            train_samples += bs

            if b_i == 1 or b_i % 10 == 0 or b_i == n_batches:
                log(f"  epoch {epoch} train batch {b_i}/{n_batches} loss={loss.item():.4f}")

        avg_train_loss = train_loss_sum / max(train_samples, 1)

        # Validation evaluation
        log(f" Epoch {epoch}: full validation on {len(full_val_ds)} patches...")
        val_metrics = evaluate_model_on_val_set(model, full_val_ds, device)
        v_dice = val_metrics["global_dice"]
        v_prec = val_metrics["global_precision"]
        v_rec = val_metrics["global_recall"]
        v_f1 = val_metrics["global_f1"]

        scheduler.step(v_dice)

        history["epoch"].append(epoch)
        history["train_loss"].append(avg_train_loss)
        history["val_dice"].append(v_dice)
        history["val_precision"].append(v_prec)
        history["val_recall"].append(v_rec)
        history["val_f1"].append(v_f1)

        log(f" {epoch:<6d} | {avg_train_loss:<10.4f} | {v_dice:<10.4f} | {v_prec:<13.4f} | {v_rec:<10.4f} | {v_f1:<10.4f}")

        if v_dice >= best_val_dice:
            best_val_dice = v_dice
            best_epoch = epoch
            patience_counter = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_dice": v_dice,
                "val_precision": v_prec,
                "val_recall": v_rec,
                "val_f1": v_f1
            }, new_ckpt_path)
        else:
            patience_counter += 1
            if patience_counter >= patience:
                log(f"\n Early stopping triggered at epoch {epoch}.")
                break

    training_duration_sec = time.time() - start_time
    log("-" * 80)
    log(f" Training Complete in {training_duration_sec:.2f} seconds.")
    log(f" Best Model Checkpoint Saved to : {new_ckpt_path} (Epoch {best_epoch}, Val Dice: {best_val_dice:.4f})")

    # 6. Side-by-Side Evaluation & Comparison against Baseline Checkpoint
    log("\n" + "=" * 85)
    log(" STEP 3: DIRECT BENCHMARK COMPARISON ON FULL VALIDATION SET (8,147 PATCHES)")
    log("=" * 85)

    new_model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    new_ckpt = torch.load(new_ckpt_path, map_location=device)
    new_model.load_state_dict(new_ckpt["model_state_dict"])

    base_eval = evaluate_model_on_val_set(baseline_model, full_val_ds, device)
    new_eval = evaluate_model_on_val_set(new_model, full_val_ds, device)

    fp_reduction_px = base_eval["global_fp"] - new_eval["global_fp"]
    fp_reduction_pct = (fp_reduction_px / max(base_eval["global_fp"], 1)) * 100.0
    recall_diff = new_eval["global_recall"] - base_eval["global_recall"]

    log(f"\n {'Metric / Count':<30} | {'Untouched Baseline':<20} | {'Hard-Negative U-Net':<20} | {'Delta':<15}")
    log("-" * 90)
    log(f" {'Global Dice Score':<30} | {base_eval['global_dice']:<20.4f} | {new_eval['global_dice']:<20.4f} | {new_eval['global_dice']-base_eval['global_dice']:+.4f}")
    log(f" {'Global IoU Score':<30} | {base_eval['global_iou']:<20.4f} | {new_eval['global_iou']:<20.4f} | {new_eval['global_iou']-base_eval['global_iou']:+.4f}")
    log(f" {'Global Precision':<30} | {base_eval['global_precision']:<20.4f} | {new_eval['global_precision']:<20.4f} | {new_eval['global_precision']-base_eval['global_precision']:+.4f}")
    log(f" {'Global Recall':<30} | {base_eval['global_recall']:<20.4f} | {new_eval['global_recall']:<20.4f} | {recall_diff:+.4f}")
    log(f" {'Global F1 Score':<30} | {base_eval['global_f1']:<20.4f} | {new_eval['global_f1']:<20.4f} | {new_eval['global_f1']-base_eval['global_f1']:+.4f}")
    log("-" * 90)
    log(f" {'True Positive Pixels (TP)':<30} | {base_eval['global_tp']:<20,d} | {new_eval['global_tp']:<20,d} | {new_eval['global_tp']-base_eval['global_tp']:+,d} px")
    log(f" {'False Positive Pixels (FP)':<30} | {base_eval['global_fp']:<20,d} | {new_eval['global_fp']:<20,d} | {new_eval['global_fp']-base_eval['global_fp']:+,d} px ({fp_reduction_pct:-.2f}%)")
    log(f" {'False Negative Pixels (FN)':<30} | {base_eval['global_fn']:<20,d} | {new_eval['global_fn']:<20,d} | {new_eval['global_fn']-base_eval['global_fn']:+,d} px")
    log(f" {'Empty GT False Positives':<30} | {base_eval['empty_fp']:<20,d} | {new_eval['empty_fp']:<20,d} | {new_eval['empty_fp']-base_eval['empty_fp']:+,d} px")
    log("-" * 90)
    log(f" {'Non-Empty GT Global Dice':<30} | {base_eval['nonempty_global_dice']:<20.4f} | {new_eval['nonempty_global_dice']:<20.4f} | {new_eval['nonempty_global_dice']-base_eval['nonempty_global_dice']:+.4f}")
    log(f" {'Non-Empty GT Precision':<30} | {base_eval['nonempty_global_precision']:<20.4f} | {new_eval['nonempty_global_precision']:<20.4f} | {new_eval['nonempty_global_precision']-base_eval['nonempty_global_precision']:+.4f}")
    log(f" {'Non-Empty GT Recall':<30} | {base_eval['nonempty_global_recall']:<20.4f} | {new_eval['nonempty_global_recall']:<20.4f} | {new_eval['nonempty_global_recall']-base_eval['nonempty_global_recall']:+.4f}")

    # 7. Save Comparison Report Artifact
    comparison_dict = {
        "experiment": "Hard-Negative Mining U-Net Experiment",
        "training_time_seconds": round(training_duration_sec, 2),
        "best_epoch": best_epoch,
        "checkpoint_path": str(new_ckpt_path),
        "fp_reduction": {
            "baseline_fp_pixels": base_eval["global_fp"],
            "new_fp_pixels": new_eval["global_fp"],
            "pixels_reduced": fp_reduction_px,
            "percentage_reduction": round(fp_reduction_pct, 2),
            "false_positives_decreased": bool(fp_reduction_px > 0)
        },
        "recall_preservation": {
            "baseline_recall": base_eval["global_recall"],
            "new_recall": new_eval["global_recall"],
            "recall_preserved": bool(new_eval["global_recall"] >= 0.85 * base_eval["global_recall"])
        },
        "baseline_validation_metrics": base_eval,
        "hard_negative_validation_metrics": new_eval
    }

    report_path = results_dir / "comparison_report.json"
    with open(report_path, "w") as f:
        json.dump(comparison_dict, f, indent=2)

    # Save Training Curves
    curves_path = results_dir / "training_curves.png"
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    ax1.plot(history["epoch"], history["train_loss"], color="crimson", marker="o", label="Train Loss")
    ax1.set_title("Training Loss (BCETversky)", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend()

    ax2.plot(history["epoch"], history["val_dice"], color="green", marker="^", label="Val Dice")
    ax2.plot(history["epoch"], history["val_precision"], color="blue", marker="s", label="Val Precision")
    ax2.plot(history["epoch"], history["val_recall"], color="darkorange", marker="d", label="Val Recall")
    ax2.set_title("Validation Metrics Progression", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend()

    plt.suptitle("Hard-Negative Mining U-Net Training Curves", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(curves_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

    log(f"\n [SUCCESS] Hard-negative experiment completed!")
    log(f"   - Checkpoint Saved  : {new_ckpt_path}")
    log(f"   - JSON Report Saved : {report_path}")
    log(f"   - Training Curves   : {curves_path}")
    log("=" * 85)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--startup-test",
        action="store_true",
        help="Load CSV/split, a few TIFF patches, and the baseline checkpoint, then exit without training.",
    )
    args = parser.parse_args()
    main(startup_test=args.startup_test)
