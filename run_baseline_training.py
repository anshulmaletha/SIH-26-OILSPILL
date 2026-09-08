"""
U-Net 1-channel SAR oil-spill baseline trainer.

Sampling uses actual mask crops (mask_crop.sum() > 0), never CSV `class`.
Official train/val CSVs are used; Downloads/Radar_data/test/ is never touched.
"""

import argparse
import os
import random
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, Subset

from src.data.scene_split import create_scene_split
from src.data.windowed_dataset import SARPatchDataset, classify_mask_occupancy
from src.evaluation.metrics import calculate_segmentation_metrics
from src.models.unet import UNet
from src.preprocessing.sar_preprocessor import SARPreprocessor
from src.training.losses import BCEDiceLoss


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def load_official_train_val(train_dir: Path):
    """Load official train/val CSVs. Fall back to scene split only if val CSV is missing."""
    train_csv = train_dir / "dataframe_train_dataset_256_90.csv"
    val_csv = train_dir / "dataframe_val_dataset_256_90.csv"
    if not train_csv.exists():
        raise FileNotFoundError(f"Train CSV not found: {train_csv}")

    if val_csv.exists():
        train_df = pd.read_csv(train_csv)
        val_df = pd.read_csv(val_csv)
        train_scenes = sorted({Path(str(p).replace("\\", "/")).name for p in train_df["paths"]})
        val_scenes = sorted({Path(str(p).replace("\\", "/")).name for p in val_df["paths"]})
        overlap = set(train_scenes).intersection(val_scenes)
        if len(overlap) == 0:
            return train_df, val_df, train_scenes, val_scenes, True, "official_csv"

    train_df, val_df, train_scenes, val_scenes, is_overlap_zero = create_scene_split(
        csv_file_or_df=train_csv, val_scene_ratio=0.25, seed=42
    )
    return train_df, val_df, train_scenes, val_scenes, is_overlap_zero, "scene_split"


def make_balanced_indices(pos_idx, neg_idx, n_pos, n_neg, rng):
    n_pos = min(int(n_pos), len(pos_idx))
    n_neg = min(int(n_neg), len(neg_idx))
    sample_pos = rng.choice(pos_idx, size=n_pos, replace=False)
    sample_neg = rng.choice(neg_idx, size=n_neg, replace=False)
    combined = np.concatenate([sample_pos, sample_neg])
    rng.shuffle(combined)
    return combined, sample_pos, sample_neg


def save_training_curves(history, curves_file: Path, title: str):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    epochs_arr = history["epoch"]
    ax1.plot(epochs_arr, history["train_loss"], label="Train Loss", color="crimson", marker="o")
    ax1.plot(epochs_arr, history["val_loss"], label="Val Loss", color="royalblue", marker="s")
    ax1.set_title("Training & Validation Loss", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Loss (BCE + Dice)")
    ax1.grid(True, linestyle="--", alpha=0.6)
    ax1.legend()

    ax2.plot(epochs_arr, history["val_Dice"], label="Val Dice", color="green", marker="^")
    ax2.plot(epochs_arr, history["val_IoU"], label="Val IoU", color="darkorange", marker="d")
    ax2.plot(epochs_arr, history["val_F1"], label="Val F1", color="purple", marker="x")
    ax2.set_title("Validation Segmentation Metrics", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Metric Score")
    ax2.grid(True, linestyle="--", alpha=0.6)
    ax2.legend()

    plt.suptitle(title, fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(curves_file, dpi=150, bbox_inches="tight")
    plt.close(fig)


def save_val_overlays(model, dataset, vis_indices, device, val_vis_dir: Path):
    val_vis_dir.mkdir(parents=True, exist_ok=True)
    model.eval()
    with torch.no_grad():
        for vis_count, idx in enumerate(vis_indices, start=1):
            item = dataset[int(idx)]
            img_t = item["image"].unsqueeze(0).to(device)
            gt_mask_t = item["mask"].squeeze().numpy()
            src_tiff = item["source_tiff"]

            logits = model(img_t)
            probs = torch.sigmoid(logits).squeeze().cpu().numpy()
            pred_mask = (probs >= 0.5).astype(np.uint8)
            sar_img = item["image"].squeeze().numpy()

            fig, axes = plt.subplots(1, 4, figsize=(18, 4.5))
            ax_sar, ax_gt, ax_pred, ax_ovr = axes
            vmin, vmax = np.percentile(sar_img, [2, 98])
            ax_sar.imshow(sar_img, cmap="gray", vmin=vmin, vmax=vmax)
            ax_sar.set_title(f"SAR Intensity\n({src_tiff})", fontsize=10)
            ax_sar.axis("off")

            ax_gt.imshow(gt_mask_t, cmap="cividis", vmin=0, vmax=1)
            ax_gt.set_title(f"Ground Truth\n(Pos: {int(gt_mask_t.sum())} px)", fontsize=10)
            ax_gt.axis("off")

            ax_pred.imshow(pred_mask, cmap="magma", vmin=0, vmax=1)
            ax_pred.set_title(f"U-Net Prediction\n(Pos: {int(pred_mask.sum())} px)", fontsize=10)
            ax_pred.axis("off")

            norm_sar = np.clip((sar_img - vmin) / (vmax - vmin + 1e-7), 0, 1)
            rgb = np.dstack([norm_sar, norm_sar, norm_sar])
            rgb[gt_mask_t > 0] = [0.2, 0.5, 1.0]
            rgb[pred_mask > 0] = [1.0, 0.2, 0.2]
            overlap = (gt_mask_t > 0) & (pred_mask > 0)
            rgb[overlap] = [1.0, 0.0, 1.0]
            ax_ovr.imshow(rgb)
            label_type = "Empty GT" if gt_mask_t.sum() == 0 else "Non-empty GT"
            ax_ovr.set_title(f"Overlay ({label_type})\nBlue: GT, Red: Pred, Mag: TP", fontsize=10)
            ax_ovr.axis("off")

            plt.tight_layout()
            plt.savefig(val_vis_dir / f"val_sample_{vis_count:02d}.png", dpi=120, bbox_inches="tight")
            plt.close(fig)


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


def run_baseline(smoke: bool = False):
    set_seed(42)

    base_dir = resolve_data_dir()
    train_dir = base_dir / "train" if (base_dir / "train").exists() else base_dir
    test_dir = base_dir / "test"
    if test_dir.exists():
        print(f"[INFO] Official test set present at {test_dir} — not used.", flush=True)

    print("=" * 95, flush=True)
    title = " U-NET BASELINE SMOKE RUN (2 EPOCHS)" if smoke else " U-NET BASELINE (MASK-BALANCED SAMPLING)"
    print(title, flush=True)
    print("=" * 95, flush=True)

    train_df, val_df, train_scenes, val_scenes, is_overlap_zero, split_mode = load_official_train_val(train_dir)
    print(f" Split mode: {split_mode}", flush=True)
    print(f" Train scenes ({len(train_scenes)}): {train_scenes}", flush=True)
    print(f" Val scenes   ({len(val_scenes)}): {val_scenes}", flush=True)
    print(f" Scene overlap is zero: {is_overlap_zero}", flush=True)
    print(f" Train patches: {len(train_df)} | Val patches: {len(val_df)}", flush=True)
    if not is_overlap_zero:
        raise RuntimeError("Train/val parent scenes must be disjoint.")

    preprocessor = SARPreprocessor(in_channels=1, clip_vv=(-35.0, 0.0), strategy="zscore")
    raw_train_ds = SARPatchDataset(train_df.iloc[:50], data_dir=train_dir, patch_size=256, return_dict=False)
    sample_imgs = [raw_train_ds[i][0].numpy() for i in range(len(raw_train_ds))]
    preprocessor.fit(sample_imgs)

    full_train_ds = SARPatchDataset(
        train_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=False
    )
    full_val_ds = SARPatchDataset(
        val_df, data_dir=train_dir, patch_size=256, preprocessor=preprocessor, return_dict=True
    )

    print("\nClassifying train/val patches from actual mask crops (not CSV class)...", flush=True)
    train_pos, train_neg = classify_mask_occupancy(train_df, train_dir, patch_size=256)
    val_pos, val_neg = classify_mask_occupancy(val_df, train_dir, patch_size=256)

    print(f" Train actual non-empty: {len(train_pos)} | empty: {len(train_neg)}", flush=True)
    print(f" Val   actual non-empty: {len(val_pos)} | empty: {len(val_neg)}", flush=True)

    rng = np.random.RandomState(42)
    if smoke:
        n_train_pos = n_train_neg = 64
        n_val_pos = n_val_neg = 32
        max_epochs = 2
        patience = 5
        batch_size = 8
        best_model_path = PROJECT_ROOT / "models" / "smoke_unet_baseline.pt"
        results_dir = PROJECT_ROOT / "results" / "smoke"
        curves_file = results_dir / "smoke_training_curves.png"
    else:
        n_train_pos = len(train_pos)
        n_train_neg = len(train_pos)  # 1:1 with all non-empty patches
        n_val_pos = min(250, len(val_pos))
        n_val_neg = min(250, len(val_neg))
        max_epochs = 20
        patience = 5
        batch_size = 16
        best_model_path = PROJECT_ROOT / "models" / "best_unet_baseline.pt"
        results_dir = PROJECT_ROOT / "results"
        curves_file = results_dir / "baseline_training_curves.png"

    train_indices, sample_pos, sample_neg = make_balanced_indices(
        train_pos, train_neg, n_train_pos, n_train_neg, rng
    )
    val_indices, val_sample_pos, val_sample_neg = make_balanced_indices(
        val_pos, val_neg, n_val_pos, n_val_neg, rng
    )

    print("\n--- Sampling (mask occupancy, 1:1) ---", flush=True)
    print(f" Train selected non-empty: {len(sample_pos)} | empty: {len(sample_neg)}", flush=True)
    print(
        f" Train ratio: {len(sample_pos)}:{len(sample_neg)} "
        f"({len(sample_pos) / max(len(sample_neg), 1):.2f}:1)",
        flush=True,
    )
    print(f" Val selected non-empty: {len(val_sample_pos)} | empty: {len(val_sample_neg)}", flush=True)

    verified_pos = 0
    check_n = min(20, len(sample_pos))
    for idx in sample_pos[:check_n]:
        _, mask_t = full_train_ds[int(idx)]
        if mask_t.sum() > 0:
            verified_pos += 1
    print(f" Verified train positives with oil pixels: {verified_pos}/{check_n}", flush=True)
    if check_n > 0 and verified_pos != check_n:
        raise RuntimeError("Positive samples must have non-empty mask crops.")

    train_ds = Subset(full_train_ds, train_indices.tolist())
    val_ds = Subset(full_val_ds, val_indices.tolist())
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f" Device: {device}", flush=True)
    model = UNet(in_channels=1, out_channels=1, features=16).to(device)
    criterion = BCEDiceLoss(bce_weight=0.5, dice_weight=0.5)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=2)

    best_model_path.parent.mkdir(parents=True, exist_ok=True)
    results_dir.mkdir(parents=True, exist_ok=True)
    val_vis_dir = results_dir / "val_predictions"
    val_vis_dir.mkdir(parents=True, exist_ok=True)

    history = {
        "epoch": [], "train_loss": [], "val_loss": [],
        "val_Dice": [], "val_IoU": [], "val_precision": [],
        "val_recall": [], "val_F1": [],
    }
    best_val_dice = -1.0
    patience_counter = 0

    print(f" {'Epoch':<6} | {'Train Loss':<10} | {'Val Loss':<10} | {'Val Dice':<10} | {'Val IoU':<10} | {'Precision':<10} | {'Recall':<10} | {'F1 Score':<10}", flush=True)
    print("=" * 95, flush=True)

    for epoch in range(1, max_epochs + 1):
        model.train()
        train_loss_sum = 0.0
        train_samples = 0
        epoch_pos_patches = 0
        epoch_neg_patches = 0
        pred_means = []

        for images, masks in train_loader:
            images = images.to(device)
            masks = masks.to(device)
            with torch.no_grad():
                mask_sums = masks.reshape(masks.size(0), -1).sum(dim=1)
                epoch_pos_patches += int((mask_sums > 0).sum().item())
                epoch_neg_patches += int((mask_sums == 0).sum().item())

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()

            bs = images.size(0)
            train_loss_sum += loss.item() * bs
            train_samples += bs
            pred_means.append(torch.sigmoid(outputs.detach()).mean().item())

        avg_train_loss = train_loss_sum / max(train_samples, 1)
        mean_pred_prob = float(np.mean(pred_means)) if pred_means else 0.0

        model.eval()
        val_loss_sum = 0.0
        val_samples = 0
        metrics_acc = {"dice": 0.0, "iou": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}
        with torch.no_grad():
            for item in val_loader:
                if isinstance(item, dict):
                    images, masks = item["image"], item["mask"]
                else:
                    images, masks = item
                images = images.to(device)
                masks = masks.to(device)
                outputs = model(images)
                loss = criterion(outputs, masks)
                bs = images.size(0)
                val_loss_sum += loss.item() * bs
                val_samples += bs
                for i in range(bs):
                    single_m = calculate_segmentation_metrics(outputs[i:i + 1], masks[i:i + 1], threshold=0.5)
                    for k in metrics_acc:
                        metrics_acc[k] += single_m[k]

        avg_val_loss = val_loss_sum / max(val_samples, 1)
        avg_val_dice = metrics_acc["dice"] / max(val_samples, 1)
        avg_val_iou = metrics_acc["iou"] / max(val_samples, 1)
        avg_val_prec = metrics_acc["precision"] / max(val_samples, 1)
        avg_val_rec = metrics_acc["recall"] / max(val_samples, 1)
        avg_val_f1 = metrics_acc["f1"] / max(val_samples, 1)
        scheduler.step(avg_val_dice)

        history["epoch"].append(epoch)
        history["train_loss"].append(avg_train_loss)
        history["val_loss"].append(avg_val_loss)
        history["val_Dice"].append(avg_val_dice)
        history["val_IoU"].append(avg_val_iou)
        history["val_precision"].append(avg_val_prec)
        history["val_recall"].append(avg_val_rec)
        history["val_F1"].append(avg_val_f1)

        print(
            f" {epoch:<6d} | {avg_train_loss:<10.4f} | {avg_val_loss:<10.4f} | {avg_val_dice:<10.4f} | "
            f"{avg_val_iou:<10.4f} | {avg_val_prec:<10.4f} | {avg_val_rec:<10.4f} | {avg_val_f1:<10.4f}",
            flush=True,
        )
        print(
            f"         train patches this epoch: non-empty={epoch_pos_patches} empty={epoch_neg_patches} | "
            f"mean pred prob={mean_pred_prob:.4f}",
            flush=True,
        )
        if mean_pred_prob < 0.01 or mean_pred_prob > 0.99:
            print("         [WARN] Predictions look collapsed (near all-zero or all-one).", flush=True)

        if avg_val_dice >= best_val_dice:
            best_val_dice = avg_val_dice
            patience_counter = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_dice": avg_val_dice,
                "val_iou": avg_val_iou,
                "val_loss": avg_val_loss,
                "val_precision": avg_val_prec,
                "val_recall": avg_val_rec,
                "val_f1": avg_val_f1,
            }, best_model_path)
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\n Early stopping triggered at epoch {epoch}.", flush=True)
                break

    print("=" * 95, flush=True)
    save_training_curves(history, curves_file, "U-Net Baseline Training Curves (mask-balanced)")

    checkpoint = torch.load(best_model_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    vis_empty = val_sample_neg[:5]
    vis_nonempty = val_sample_pos[:5]
    vis_indices = list(vis_empty) + list(vis_nonempty)
    save_val_overlays(model, full_val_ds, vis_indices, device, val_vis_dir)

    print(f" Best checkpoint: {best_model_path} (epoch {checkpoint['epoch']}, val Dice={checkpoint['val_dice']:.4f})", flush=True)
    print(f" Curves: {curves_file}", flush=True)
    print(f" Val overlays: {val_vis_dir}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="2-epoch smoke run on a small balanced subset")
    args = parser.parse_args()
    run_baseline(smoke=args.smoke)
