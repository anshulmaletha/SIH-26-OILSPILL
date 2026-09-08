"""
Integrated End-to-End Segmentation Pipeline for Sentinel-1 SAR Oil Spill Segmentation.
Links TIFF/Dataset -> Preprocessing -> Model (UNet / UNet++) -> Logits -> Mask -> Metrics.
"""

from typing import Dict, Any, Union, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from src.config import Config, get_default_config
from src.models.unet import UNet
from src.models.unet_plus_plus import UNetPlusPlus
from src.preprocessing.sar_preprocessor import SARPreprocessor, validate_sar_input
from src.evaluation.metrics import calculate_segmentation_metrics
from src.training.losses import BCEDiceLoss


def get_model(
    model_name: str = "unet",
    in_channels: int = 1,
    out_channels: int = 1,
    features: int = 16
) -> nn.Module:
    """
    Factory function to instantiate selected segmentation model.

    Args:
        model_name: "unet" or "unet_plus_plus".
        in_channels: Number of input channels (1 for VV channel).
        out_channels: Number of output channels (1 for binary logits).
        features: Base channel dimension size.

    Returns:
        PyTorch nn.Module instance.
    """
    name = model_name.lower().strip()
    if name in ("unet", "u-net"):
        return UNet(in_channels=in_channels, out_channels=out_channels, features=features)
    elif name in ("unet_plus_plus", "unet++", "u-net++"):
        return UNetPlusPlus(in_channels=in_channels, out_channels=out_channels, features=features)
    else:
        raise ValueError(f"Unsupported model_name: '{model_name}'. Choose 'unet' or 'unet_plus_plus'.")


def predict_sample(
    model: nn.Module,
    sample: Union[np.ndarray, torch.Tensor],
    preprocessor: Optional[SARPreprocessor] = None,
    threshold: float = 0.5,
    device: Optional[torch.device] = None
) -> Dict[str, Any]:
    """
    Single-sample inference function.

    Args:
        model: Trained or loaded PyTorch segmentation model (UNet or UNetPlusPlus).
        sample: Input 1-channel VV array or tensor of shape (1, H, W) or (H, W).
        preprocessor: Fitted SARPreprocessor instance (optional).
        threshold: Decision threshold for binary segmentation mask.
        device: PyTorch target device.

    Returns:
        Dict containing:
            - "probability_map": 2D numpy float array [0, 1]
            - "binary_mask": 2D numpy uint8 array [0, 1]
            - "confidence": float average probability over detected positive region (or entire map)
            - "area_pixels": integer total count of positive oil spill pixels
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model.eval()

    # Preprocess sample if preprocessor provided
    if preprocessor is not None:
        processed_sample = preprocessor.transform(sample)
    else:
        is_tensor = isinstance(sample, torch.Tensor)
        processed_sample = sample.float() if is_tensor else torch.from_numpy(sample).float()

    if isinstance(processed_sample, np.ndarray):
        processed_sample = torch.from_numpy(processed_sample).float()

    # Ensure shape (1, C, H, W)
    if processed_sample.ndim == 2:
        input_batch = processed_sample.unsqueeze(0).unsqueeze(0)
    elif processed_sample.ndim == 3:
        input_batch = processed_sample.unsqueeze(0)
    elif processed_sample.ndim == 4:
        input_batch = processed_sample
    else:
        raise ValueError(f"Expected 2D, 3D or 4D tensor, got shape {processed_sample.shape}")

    input_batch = input_batch.to(device)

    with torch.no_grad():
        logits = model(input_batch)
        probs = torch.sigmoid(logits)  # Convert unnormalized logits to probabilities

    # Squeeze batch and channel dims to obtain 2D maps
    prob_map = probs.squeeze(0).squeeze(0).cpu().numpy()
    binary_mask = (prob_map >= threshold).astype(np.uint8)

    area_pixels = int(np.sum(binary_mask))

    if area_pixels > 0:
        confidence = float(np.mean(prob_map[binary_mask == 1]))
    else:
        confidence = float(np.mean(prob_map))

    return {
        "probability_map": prob_map,
        "binary_mask": binary_mask,
        "confidence": confidence,
        "area_pixels": area_pixels
    }


class SegmentationPipeline:
    """
    Integrated SAR Oil-Spill Segmentation Pipeline supporting UNet & UNet++.
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        preprocessor: Optional[SARPreprocessor] = None,
        device: Optional[torch.device] = None
    ):
        self.config = config or get_default_config()
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Instantiate preprocessor if not provided
        if preprocessor is None:
            norm_cfg = self.config.normalization
            self.preprocessor = SARPreprocessor(
                clip_vv=norm_cfg.clip_vv,
                clip_vh=norm_cfg.clip_vh,
                strategy=norm_cfg.strategy,
                enable_speckle_filter=norm_cfg.enable_speckle_filter
            )
        else:
            self.preprocessor = preprocessor

        # Instantiate selectable model
        model_cfg = self.config.model
        self.model = get_model(
            model_name=model_cfg.model_name,
            in_channels=model_cfg.in_channels,
            out_channels=model_cfg.out_channels,
            features=model_cfg.features
        ).to(self.device)

        self.criterion = BCEDiceLoss(bce_weight=0.5, dice_weight=0.5)

    def evaluate_dataloader(
        self,
        dataloader: DataLoader,
        mode: str = "val"
    ) -> Dict[str, float]:
        """
        Evaluate dataset dataloader in validation or testing mode.
        """
        self.model.eval()
        total_loss = 0.0
        total_samples = 0
        accumulated_metrics = {"dice": 0.0, "iou": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}

        with torch.no_grad():
            for batch in dataloader:
                if isinstance(batch, (tuple, list)):
                    images, masks = batch
                elif isinstance(batch, dict):
                    images, masks = batch["image"], batch["mask"]
                else:
                    raise TypeError("Unsupported dataloader batch format.")

                images = images.to(self.device)
                masks = masks.to(self.device)

                outputs = self.model(images)
                loss = self.criterion(outputs, masks)

                batch_size = images.size(0)
                total_loss += loss.item() * batch_size
                total_samples += batch_size

                batch_metrics = calculate_segmentation_metrics(
                    outputs,
                    masks,
                    threshold=self.config.model.threshold
                )
                for k in accumulated_metrics:
                    accumulated_metrics[k] += batch_metrics[k] * batch_size

        avg_loss = total_loss / max(total_samples, 1)
        res = {f"{mode}_{k}": v / max(total_samples, 1) for k, v in accumulated_metrics.items()}
        res[f"{mode}_loss"] = avg_loss
        return res

    def predict(
        self,
        sample: Union[np.ndarray, torch.Tensor]
    ) -> Dict[str, Any]:
        """Run single sample inference through pipeline."""
        return predict_sample(
            model=self.model,
            sample=sample,
            preprocessor=self.preprocessor,
            threshold=self.config.model.threshold,
            device=self.device
        )
