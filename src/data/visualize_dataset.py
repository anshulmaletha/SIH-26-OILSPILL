"""
Visualization utilities for Sentinel-1 SAR imagery and segmentation masks.
Supports rendering VV channel, VH channel, Ground Truth Mask, and Overlay.
"""

import argparse
from pathlib import Path
from typing import Optional, Union, Tuple

import matplotlib.pyplot as plt
import numpy as np

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


def load_image_file(path: Union[str, Path]) -> np.ndarray:
    """Load image from file (TIFF, NPY, PNG, JPG)."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {p}")

    if p.suffix.lower() == ".npy":
        return np.load(p)

    if HAS_RASTERIO:
        try:
            with rasterio.open(p) as src:
                arr = src.read()
                if arr.shape[0] == 1:
                    return arr[0]
                return arr
        except Exception:
            pass

    if HAS_CV2:
        img = cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
        if img is not None:
            return img

    raise RuntimeError(f"Unable to read image from {p}")


def visualize_sample(
    vv: np.ndarray,
    vh: np.ndarray,
    mask: Optional[np.ndarray] = None,
    title: str = "Sentinel-1 SAR Sample",
    save_path: Optional[Union[str, Path]] = None,
    figsize: Tuple[int, int] = (16, 4),
    show_plot: bool = True
) -> plt.Figure:
    """
    Visualize VV, VH, binary mask, and VV + mask overlay.

    Args:
        vv: 2D numpy array for VV channel.
        vh: 2D numpy array for VH channel.
        mask: Optional 2D numpy array for binary oil spill mask.
        title: Plot title.
        save_path: Optional path to save figure.
        figsize: Figure dimensions.
        show_plot: Whether to invoke plt.show().

    Returns:
        Matplotlib Figure object.
    """
    # Ensure 2D arrays
    if vv.ndim > 2:
        vv = np.squeeze(vv)
    if vh.ndim > 2:
        vh = np.squeeze(vh)
    if mask is not None and mask.ndim > 2:
        mask = np.squeeze(mask)

    num_cols = 4 if mask is not None else 2
    fig, axes = plt.subplots(1, num_cols, figsize=figsize)

    if num_cols == 2:
        ax_vv, ax_vh = axes
    else:
        ax_vv, ax_vh, ax_mask, ax_overlay = axes

    # Normalize VV and VH for display if needed
    vv_disp = np.nan_to_num(vv, nan=np.nanmean(vv))
    vh_disp = np.nan_to_num(vh, nan=np.nanmean(vh))

    # VV plot
    im0 = ax_vv.imshow(vv_disp, cmap="gray")
    ax_vv.set_title("VV Polarization")
    ax_vv.axis("off")
    fig.colorbar(im0, ax=ax_vv, fraction=0.046, pad=0.04)

    # VH plot
    im1 = ax_vh.imshow(vh_disp, cmap="gray")
    ax_vh.set_title("VH Polarization")
    ax_vh.axis("off")
    fig.colorbar(im1, ax=ax_vh, fraction=0.046, pad=0.04)

    if mask is not None:
        # Binary Mask plot
        mask_disp = (mask > 0).astype(np.uint8)
        im2 = ax_mask.imshow(mask_disp, cmap="cividis", vmin=0, vmax=1)
        ax_mask.set_title("Oil Spill Mask")
        ax_mask.axis("off")
        fig.colorbar(im2, ax=ax_mask, fraction=0.046, pad=0.04)

        # Overlay plot
        # Normalize VV to [0, 1] for RGB background
        vmin, vmax = np.percentile(vv_disp, [2, 98])
        vv_norm = np.clip((vv_disp - vmin) / (vmax - vmin + 1e-7), 0, 1)
        
        rgb = np.dstack([vv_norm, vv_norm, vv_norm])
        # Overlay oil spill pixels in bright red
        rgb[mask_disp == 1] = [1.0, 0.2, 0.2]

        ax_overlay.imshow(rgb)
        ax_overlay.set_title("VV + Mask Overlay")
        ax_overlay.axis("off")

    fig.suptitle(title, fontsize=14, fontweight="bold")
    plt.tight_layout()

    if save_path:
        out = Path(save_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(out, bbox_inches="tight", dpi=150)
        print(f"Saved visualization to: {out}")

    if show_plot:
        plt.show()
    else:
        plt.close(fig)

    return fig


def main():
    parser = argparse.ArgumentParser(description="Visualize Sentinel-1 VV, VH, and Mask.")
    parser.add_argument("--vv", type=str, required=True, help="Path to VV channel file")
    parser.add_argument("--vh", type=str, required=True, help="Path to VH channel file")
    parser.add_argument("--mask", type=str, default=None, help="Path to segmentation mask file")
    parser.add_argument("--out", type=str, default=None, help="Output path to save visualization")
    args = parser.parse_args()

    vv_data = load_image_file(args.vv)
    vh_data = load_image_file(args.vh)
    mask_data = load_image_file(args.mask) if args.mask else None

    visualize_sample(
        vv=vv_data,
        vh=vh_data,
        mask=mask_data,
        save_path=args.out,
        show_plot=True if not args.out else False
    )


if __name__ == "__main__":
    main()
