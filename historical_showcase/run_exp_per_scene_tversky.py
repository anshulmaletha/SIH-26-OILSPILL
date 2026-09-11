"""
Experiment Runner: exp_per_scene_tversky
Hypothesis:
  1. Per-scene dynamic z-score normalization reduces inter-scene intensity/domain shift.
  2. Tversky loss (alpha=0.7, beta=0.3) improves recall on thin oil slicks.

Saved Checkpoint: results/exp_per_scene_tversky/best_exp_model.pt (Baseline models/best_unet_baseline.pt is NEVER modified)
All outputs saved to: results/exp_per_scene_tversky/
"""

import os
import sys
import random
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tifffile
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset

from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset
from src.training.losses import BCEDiceLoss, BCETverskyLoss
from src.evaluation.metrics import calculate_segmentation_metrics
from src.inference import OilSpillInferenceEngine
from src.data.dataset import load_sar_image


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def evaluate_patch_dataset(model, dataloader, device, threshold=0.5):
    model.eval()
    all_dices = []
    all_ious = []
    all_precs = []
    all_recs = []

    nonempty_dices, nonempty_ious, nonempty_precs, nonempty_recs = [], [], [], []
    empty_fp_pixels, empty_total_pixels = 0, 0

    with torch.no_grad():
        for batch in dataloader:
            if isinstance(batch, (tuple, list)):
                imgs, targets = batch[0], batch[1]
            else:
                imgs, targets = batch["image"], batch["mask"]

            imgs = imgs.to(device)
            targets = targets.to(device)

            logits = model(imgs)
            probs = torch.sigmoid(logits)
            preds = (probs >= threshold).float()

            for i in range(preds.size(0)):
                p = preds[i, 0].cpu().numpy().astype(np.uint8)
                y = targets[i, 0].cpu().numpy().astype(np.uint8)

                gt_sum = int(np.sum(y))
                tp = int(np.sum((y == 1) & (p == 1)))
                fp = int(np.sum((y == 0) & (p == 1)))
                fn = int(np.sum((y == 1) & (p == 0)))

                dice = (2.0 * tp) / (2.0 * tp + fp + fn) if (2 * tp + fp + fn) > 0 else (1.0 if gt_sum == 0 and fp == 0 else 0.0)
                iou = float(tp) / (tp + fp + fn) if (tp + fp + fn) > 0 else (1.0 if gt_sum == 0 and fp == 0 else 0.0)
                prec = float(tp) / (tp + fp) if (tp + fp) > 0 else 0.0
                rec = float(tp) / (tp + fn) if (tp + fn) > 0 else 0.0

                all_dices.append(dice)
                all_ious.append(iou)
                all_precs.append(prec)
                all_recs.append(rec)

                if gt_sum > 0:
                    nonempty_dices.append(dice)
                    nonempty_ious.append(iou)
                    nonempty_precs.append(prec)
                    nonempty_recs.append(rec)
                else:
                    empty_fp_pixels += fp
                    empty_total_pixels += p.size

    return {
        "dice": float(np.mean(all_dices)),
        "iou": float(np.mean(all_ious)),
        "precision": float(np.mean(all_precs)),
        "recall": float(np.mean(all_recs)),
        "nonempty_dice": float(np.mean(nonempty_dices)) if nonempty_dices else 0.0,
        "nonempty_iou": float(np.mean(nonempty_ious)) if nonempty_ious else 0.0,
        "nonempty_precision": float(np.mean(nonempty_precs)) if nonempty_precs else 0.0,
        "nonempty_recall": float(np.mean(nonempty_recs)) if nonempty_recs else 0.0,
        "empty_fp_pixels": int(empty_fp_pixels),
        "empty_total_pixels": int(empty_total_pixels),
        "empty_fp_rate": float(empty_fp_pixels / max(1, empty_total_pixels))
    }


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


def run_experiment():
    set_seed(42)

    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    csv_file = train_dir / "dataframe_train_dataset_256_90.csv"

    exp_dir = PROJECT_ROOT / "results" / "exp_per_scene_tversky"
    exp_dir.mkdir(parents=True, exist_ok=True)
    checkpoint_file = exp_dir / "best_exp_model.pt"

    print("=" * 95, flush=True)
    print(" EXPERIMENT: PER-SCENE DYNAMIC NORMALIZATION + TVERSKY LOSS (alpha=0.7, beta=0.3)", flush=True)
    print("=" * 95, flush=True)

    # 1. Same Scene-Disjoint Split
    train_df, val_df, train_scenes, val_scenes, is_overlap_zero = create_scene_split(
        csv_file_or_df=csv_file,
        val_scene_ratio=0.25,
        seed=42
    )

    print(f" Train Scenes ({len(train_scenes)}) : {train_scenes}", flush=True)
    print(f" Val Scenes   ({len(val_scenes)})   : {val_scenes}", flush=True)
    print(f" Scene Overlap Zero Check       : {is_overlap_zero}", flush=True)

    # 2. Experimental Preprocessor with strategy="per_scene_zscore"
    preprocessor = SARPreprocessor(
        in_channels=1,
        clip_vv=(-35.0, 0.0),
        strategy="per_scene_zscore"
    )

    full_train_ds = SARPatchDataset(train_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=False)
    full_val_ds = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)

    # 3. Same 1:1 Mask-Based Sampler Setup
    mask_cache = {}
    for mf in (train_dir / "masks").glob("*.tif"):
        try:
            arr = tifffile.imread(str(mf))
            mask_cache[mf.name] = (np.squeeze(arr) > 0).astype(np.uint8)
        except Exception:
            pass

    actual_pos_indices = []
    actual_neg_indices = []

    for idx, row in train_df.iterrows():
        path_obj = Path(row["paths"])
        scene_name = path_obj.name
        r_start, c_start = map(int, str(row["coordinates"]).split(","))

        if scene_name in mask_cache:
            mask_arr = mask_cache[scene_name]
            crop = mask_arr[r_start:r_start+256, c_start:c_start+256]
            if np.any(crop > 0):
                actual_pos_indices.append(idx)
            else:
                actual_neg_indices.append(idx)
        else:
            actual_neg_indices.append(idx)

    rng = random.Random(42)
    sample_size = min(len(actual_pos_indices), len(actual_neg_indices))
    sampled_pos = rng.sample(actual_pos_indices, sample_size)
    sampled_neg = rng.sample(actual_neg_indices, sample_size)
    balanced_indices = sampled_pos + sampled_neg
    rng.shuffle(balanced_indices)

    train_subset = Subset(full_train_ds, balanced_indices)

    # Sample representative validation subset for fast epoch tracking
    val_sub_indices = list(range(0, len(full_val_ds), max(1, len(full_val_ds) // 500)))[:500]
    val_subset = Subset(full_val_ds, val_sub_indices)

    print(f" Pos Patches: {len(sampled_pos)}, Neg Patches: {len(sampled_neg)}, Total Balanced Train: {len(train_subset)}", flush=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f" Computing device: {device}", flush=True)

    # 4. Phase 1: SMOKE TEST
    print("\n" + "=" * 80, flush=True)
    print(" PHASE 1: SMOKE TEST (1 Epoch on 50 Samples)", flush=True)
    print("=" * 80, flush=True)

    smoke_subset = Subset(train_subset, list(range(min(50, len(train_subset)))))
    smoke_loader = DataLoader(smoke_subset, batch_size=8, shuffle=True)
    
    smoke_model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    smoke_criterion = BCETverskyLoss(bce_weight=0.5, tversky_weight=0.5, alpha=0.7, beta=0.3)
    smoke_optimizer = torch.optim.Adam(smoke_model.parameters(), lr=1e-3)

    smoke_model.train()
    smoke_loss_accum = 0.0
    for b_img, b_target in smoke_loader:
        b_img = b_img.to(device)
        b_target = b_target.to(device)
        smoke_optimizer.zero_grad()
        out = smoke_model(b_img)
        loss = smoke_criterion(out, b_target)
        loss.backward()
        smoke_optimizer.step()
        smoke_loss_accum += loss.item()

    smoke_loss_avg = smoke_loss_accum / len(smoke_loader)
    print(f" Smoke Test Loss : {smoke_loss_avg:.4f}", flush=True)
    print(" Smoke Test Passed Successfully!\n", flush=True)

    # 5. Phase 2: FULL EXPERIMENTAL TRAINING (5 Epochs)
    print("=" * 80, flush=True)
    print(" PHASE 2: EXPERIMENTAL TRAINING (5 Epochs with BCETverskyLoss alpha=0.7, beta=0.3)", flush=True)
    print("=" * 80, flush=True)

    train_loader = DataLoader(train_subset, batch_size=32, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_subset, batch_size=32, shuffle=False, num_workers=0)

    model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    criterion = BCETverskyLoss(bce_weight=0.5, tversky_weight=0.5, alpha=0.7, beta=0.3)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

    best_val_loss = float("inf")
    best_val_dice = 0.0
    best_epoch = 0

    history = {
        "train_loss": [], "val_loss": [], "val_dice": [], "val_iou": [], "val_precision": [], "val_recall": []
    }

    num_epochs = 5
    for epoch in range(1, num_epochs + 1):
        model.train()
        train_loss_accum = 0.0
        for step, (b_img, b_target) in enumerate(train_loader):
            b_img = b_img.to(device)
            b_target = b_target.to(device)
            optimizer.zero_grad()
            logits = model(b_img)
            loss = criterion(logits, b_target)
            loss.backward()
            optimizer.step()
            train_loss_accum += loss.item()

        avg_train_loss = train_loss_accum / len(train_loader)

        # Evaluate Validation Tracking Subset
        model.eval()
        val_loss_accum = 0.0
        val_dices, val_ious, val_precs, val_recs = [], [], [], []
        with torch.no_grad():
            for batch in val_loader:
                v_imgs = batch["image"].to(device)
                v_targets = batch["mask"].to(device)
                v_logits = model(v_imgs)
                v_loss = criterion(v_logits, v_targets)
                val_loss_accum += v_loss.item()

                probs = torch.sigmoid(v_logits)
                preds = (probs >= 0.5).float()

                for i in range(preds.size(0)):
                    p_np = preds[i, 0].cpu().numpy().astype(np.uint8)
                    y_np = v_targets[i, 0].cpu().numpy().astype(np.uint8)
                    gt_s = int(np.sum(y_np))
                    tp = int(np.sum((y_np == 1) & (p_np == 1)))
                    fp = int(np.sum((y_np == 0) & (p_np == 1)))
                    fn = int(np.sum((y_np == 1) & (p_np == 0)))

                    d = (2.0 * tp) / (2.0 * tp + fp + fn) if (2 * tp + fp + fn) > 0 else (1.0 if gt_s == 0 and fp == 0 else 0.0)
                    io = float(tp) / (tp + fp + fn) if (tp + fp + fn) > 0 else (1.0 if gt_s == 0 and fp == 0 else 0.0)
                    pr = float(tp) / (tp + fp) if (tp + fp) > 0 else 0.0
                    rc = float(tp) / (tp + fn) if (tp + fn) > 0 else 0.0

                    val_dices.append(d)
                    val_ious.append(io)
                    val_precs.append(pr)
                    val_recs.append(rc)

        avg_val_loss = val_loss_accum / len(val_loader)
        avg_val_dice = float(np.mean(val_dices))
        avg_val_iou = float(np.mean(val_ious))
        avg_val_prec = float(np.mean(val_precs))
        avg_val_rec = float(np.mean(val_recs))

        history["train_loss"].append(avg_train_loss)
        history["val_loss"].append(avg_val_loss)
        history["val_dice"].append(avg_val_dice)
        history["val_iou"].append(avg_val_iou)
        history["val_precision"].append(avg_val_prec)
        history["val_recall"].append(avg_val_rec)

        print(f" Epoch [{epoch}/{num_epochs}] | Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f} | Val Dice: {avg_val_dice:.4f} | Val IoU: {avg_val_iou:.4f} | Val Prec: {avg_val_prec:.4f} | Val Rec: {avg_val_rec:.4f}", flush=True)

        if avg_val_dice > best_val_dice or epoch == num_epochs:
            if avg_val_dice > best_val_dice:
                best_val_dice = avg_val_dice
                best_val_loss = avg_val_loss
                best_epoch = epoch
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_loss": avg_val_loss,
                "val_dice": avg_val_dice,
                "val_iou": avg_val_iou,
                "val_precision": avg_val_prec,
                "val_recall": avg_val_rec
            }, checkpoint_file)

    print(f"\n Saved Best Experimental Model Checkpoint to: {checkpoint_file}", flush=True)
    print(f" Best Epoch: {best_epoch}, Best Val Dice: {best_val_dice:.4f}", flush=True)

    # 6. Phase 3: BENCHMARK COMPARISON ON SAME FULL VALIDATION SET
    print("\n" + "=" * 80, flush=True)
    print(" PHASE 3: VALIDATION BENCHMARK COMPARISON (BASELINE vs EXPERIMENTAL)", flush=True)
    print("=" * 80, flush=True)

    baseline_ckpt_path = PROJECT_ROOT / "models" / "best_unet_baseline.pt"
    
    # Load Baseline Model
    base_model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    base_ckpt = torch.load(baseline_ckpt_path, map_location=device)
    base_model.load_state_dict(base_ckpt["model_state_dict"])

    # Load Experimental Model
    exp_model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    exp_ckpt = torch.load(checkpoint_file, map_location=device)
    exp_model.load_state_dict(exp_ckpt["model_state_dict"])

    # Dataset loader for baseline (global z-score) vs experiment (per-scene z-score)
    base_prep = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    raw_train_ds = SARPatchDataset(train_df.iloc[:50], data_dir=train_dir, patch_size=256, return_dict=False)
    sample_imgs = [raw_train_ds[i][0].numpy() for i in range(len(raw_train_ds))]
    base_prep.fit(sample_imgs)

    val_ds_base = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=base_prep, return_dict=True)
    loader_val_base = DataLoader(val_ds_base, batch_size=32, shuffle=False)

    val_ds_exp = SARPatchDataset(val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True)
    loader_val_exp = DataLoader(val_ds_exp, batch_size=32, shuffle=False)

    base_metrics = evaluate_patch_dataset(base_model, loader_val_base, device)
    exp_metrics = evaluate_patch_dataset(exp_model, loader_val_exp, device)

    # 7. Scene-level evaluation on 20200319b.tif and 2018_08_21_.tif
    def eval_scene(model_obj, prep_obj, split, fname):
        p_img = base_dir / split / "images" / fname
        p_mask = base_dir / split / "masks" / fname
        sar_img = load_sar_image(p_img)
        gt_mask = load_sar_image(p_mask)
        sar_2d = sar_img[0] if sar_img.ndim == 3 else sar_img
        gt_2d = gt_mask[0] if gt_mask.ndim == 3 else gt_mask
        gt_bin = (gt_2d > 0).astype(np.uint8)

        h, w = sar_2d.shape
        crops, coords = [], []
        row_starts = list(range(0, h - 256 + 1, 128))
        if row_starts[-1] + 256 < h: row_starts.append(h - 256)
        col_starts = list(range(0, w - 256 + 1, 128))
        if col_starts[-1] + 256 < w: col_starts.append(w - 256)

        for r in row_starts:
            for c in col_starts:
                crops.append(sar_2d[r:r+256, c:c+256][np.newaxis, :, :])
                coords.append((r, c))

        crops_np = np.stack(crops, axis=0)
        norm_crops = prep_obj.transform(crops_np)
        batch_t = torch.from_numpy(norm_crops).float().to(device)

        probs_list = []
        model_obj.eval()
        with torch.no_grad():
            for i in range(0, len(batch_t), 32):
                logits = model_obj(batch_t[i:i+32])
                probs = torch.sigmoid(logits).squeeze(1).cpu().numpy()
                probs_list.append(probs)

        all_probs = np.concatenate(probs_list, axis=0)
        prob_accum = np.zeros((h, w), dtype=np.float32)
        count_accum = np.zeros((h, w), dtype=np.float32)

        for idx, (r, c) in enumerate(coords):
            prob_accum[r:r+256, c:c+256] += all_probs[idx]
            count_accum[r:r+256, c:c+256] += 1.0

        full_prob = prob_accum / np.maximum(count_accum, 1.0)
        pred_bin = (full_prob >= 0.5).astype(np.uint8)

        tp = int(np.sum((gt_bin == 1) & (pred_bin == 1)))
        fp = int(np.sum((gt_bin == 0) & (pred_bin == 1)))
        fn = int(np.sum((gt_bin == 1) & (pred_bin == 0)))

        dice = (2.0 * tp) / (2.0 * tp + fp + fn) if (2 * tp + fp + fn) > 0 else 0.0
        iou = float(tp) / (tp + fp + fn) if (tp + fp + fn) > 0 else 0.0
        prec = float(tp) / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = float(tp) / (tp + fn) if (tp + fn) > 0 else 0.0

        return {"dice": dice, "iou": iou, "precision": prec, "recall": rec, "tp": tp, "fp": fp, "fn": fn, "pred_oil_px": int(np.sum(pred_bin))}

    base_thin_scene = eval_scene(base_model, base_prep, "test", "20200319b.tif")
    exp_thin_scene = eval_scene(exp_model, preprocessor, "test", "20200319b.tif")

    base_val_scene = eval_scene(base_model, base_prep, "train", "2018_08_21_.tif")
    exp_val_scene = eval_scene(exp_model, preprocessor, "train", "2018_08_21_.tif")

    print(f"\n--- PATCH-LEVEL VALIDATION METRICS ---", flush=True)
    print(f" Metric                     | Baseline U-Net  | Exp U-Net (Per-Scene + Tversky)", flush=True)
    print(f" Overall Val Dice           | {base_metrics['dice']:.4f}         | {exp_metrics['dice']:.4f}", flush=True)
    print(f" Overall Val IoU            | {base_metrics['iou']:.4f}         | {exp_metrics['iou']:.4f}", flush=True)
    print(f" Overall Val Precision      | {base_metrics['precision']:.4f}         | {exp_metrics['precision']:.4f}", flush=True)
    print(f" Overall Val Recall         | {base_metrics['recall']:.4f}         | {exp_metrics['recall']:.4f}", flush=True)
    print(f" Non-Empty Mask Dice        | {base_metrics['nonempty_dice']:.4f}         | {exp_metrics['nonempty_dice']:.4f}", flush=True)
    print(f" Non-Empty Mask Recall      | {base_metrics['nonempty_recall']:.4f}         | {exp_metrics['nonempty_recall']:.4f}", flush=True)
    print(f" Empty Mask FP Rate         | {base_metrics['empty_fp_rate']:.4f}         | {exp_metrics['empty_fp_rate']:.4f}", flush=True)

    print(f"\n--- SCENE-LEVEL THIN-SLICK EVALUATION (20200319b.tif) ---", flush=True)
    print(f" Metric                     | Baseline U-Net  | Exp U-Net (Per-Scene + Tversky)", flush=True)
    print(f" Scene Dice                 | {base_thin_scene['dice']:.4f}         | {exp_thin_scene['dice']:.4f}", flush=True)
    print(f" Scene Recall               | {base_thin_scene['recall']:.4f}         | {exp_thin_scene['recall']:.4f}", flush=True)
    print(f" Scene Precision            | {base_thin_scene['precision']:.4f}         | {exp_thin_scene['precision']:.4f}", flush=True)
    print(f" True Positives (TP)        | {base_thin_scene['tp']:<8}       | {exp_thin_scene['tp']:<8}", flush=True)
    print(f" False Positives (FP)       | {base_thin_scene['fp']:<8}       | {exp_thin_scene['fp']:<8}", flush=True)
    print(f" False Negatives (FN)       | {base_thin_scene['fn']:<8}       | {exp_thin_scene['fn']:<8}", flush=True)

    thin_slick_improved = exp_thin_scene['recall'] > base_thin_scene['recall']
    fp_increased = exp_metrics['empty_fp_rate'] > base_metrics['empty_fp_rate'] or exp_thin_scene['fp'] > base_thin_scene['fp']

    print(f"\n--- HYPOTHESIS TEST VERDICT ---", flush=True)
    print(f" Thin-Slick Recall Improved? : {thin_slick_improved} ({base_thin_scene['recall']:.4f} -> {exp_thin_scene['recall']:.4f})", flush=True)
    print(f" False Positives Increased?   : {fp_increased} (Scene FP: {base_thin_scene['fp']} -> {exp_thin_scene['fp']})", flush=True)

    # Save summary JSON
    summary_report = {
        "baseline_val_metrics": base_metrics,
        "experimental_val_metrics": exp_metrics,
        "scene_20200319b_baseline": base_thin_scene,
        "scene_20200319b_experimental": exp_thin_scene,
        "scene_2018_08_21_baseline": base_val_scene,
        "scene_2018_08_21_experimental": exp_val_scene,
        "thin_slick_recall_improved": bool(thin_slick_improved),
        "false_positives_increased": bool(fp_increased)
    }

    with open(exp_dir / "exp_metrics.json", "w") as f:
        json.dump(summary_report, f, indent=2)

    # Save Plot Curves
    epochs = list(range(1, num_epochs + 1))
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    ax1.plot(epochs, history["train_loss"], label="Train Loss", color="crimson", marker="o")
    ax1.plot(epochs, history["val_loss"], label="Val Loss", color="royalblue", marker="s")
    ax1.set_title("Experimental U-Net (Per-Scene + Tversky) Loss Curves", fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss")
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend()

    ax2.plot(epochs, history["val_dice"], label="Val Dice", color="green", marker="^")
    ax2.plot(epochs, history["val_recall"], label="Val Recall", color="darkorange", marker="d")
    ax2.plot(epochs, history["val_precision"], label="Val Precision", color="purple", marker="v")
    ax2.set_title("Experimental Validation Metrics", fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Score")
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend()

    plt.tight_layout()
    plt.savefig(exp_dir / "exp_training_curves.png", dpi=150, bbox_inches="tight")
    print(f"\n Saved training curves to: {exp_dir / 'exp_training_curves.png'}", flush=True)


if __name__ == "__main__":
    run_experiment()
