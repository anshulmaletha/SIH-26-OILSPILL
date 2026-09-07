"""
Conservative Post-Processing Enhancer for SAR Oil Spill Binary Masks.
Recovers thin/weak slick tails via probability-guided hysteresis, reconnects nearby fragments
using conservative morphological closing, and removes small isolated noise components
without generating false positives.
"""

from typing import Dict, Any, Optional
import numpy as np
import cv2


class ConservativeMaskEnhancer:
    """
    Configurable, conservative post-processing stage for predicted oil spill masks.
    """

    def __init__(
        self,
        high_threshold: float = 0.5,
        low_threshold: float = 0.35,
        min_noise_area_pixels: int = 15,
        morph_kernel_size: int = 3,
        enable_hysteresis: bool = True,
        enable_morphology: bool = True,
        enable_noise_removal: bool = True
    ):
        """
        Args:
            high_threshold: Primary decision threshold for strong oil spill seeds (default 0.5).
            low_threshold: Secondary decision threshold for weak/thin tail recovery (default 0.35).
            min_noise_area_pixels: Minimum area threshold in pixels to remove isolated noise (default 15).
            morph_kernel_size: Kernel diameter for conservative morphological closing (default 3).
            enable_hysteresis: Enables probability-guided hysteresis tail recovery.
            enable_morphology: Enables conservative morphological closing.
            enable_noise_removal: Enables small noise component removal.
        """
        self.high_threshold = high_threshold
        self.low_threshold = low_threshold
        self.min_noise_area_pixels = min_noise_area_pixels
        self.morph_kernel_size = morph_kernel_size
        self.enable_hysteresis = enable_hysteresis
        self.enable_morphology = enable_morphology
        self.enable_noise_removal = enable_noise_removal

    def process(self, prob_map: np.ndarray, initial_mask: Optional[np.ndarray] = None) -> np.ndarray:
        """
        Enhance binary prediction mask using probability-guided hysteresis, conservative closing, and noise filtering.

        Args:
            prob_map: 2D float array [0, 1] containing U-Net output probabilities.
            initial_mask: Optional 2D uint8 binary mask [0, 1]. If None, computed as (prob_map >= high_threshold).

        Returns:
            Enhanced 2D uint8 binary mask [0, 1].
        """
        if initial_mask is None:
            seed_mask = (prob_map >= self.high_threshold).astype(np.uint8)
        else:
            seed_mask = (initial_mask > 0).astype(np.uint8)

        if not np.any(seed_mask > 0):
            # No seed detections found; return initial seed mask safely
            return seed_mask.copy()

        # Step 1: Probability-guided hysteresis tail recovery
        if self.enable_hysteresis and prob_map is not None:
            cand_mask = (prob_map >= self.low_threshold).astype(np.uint8)
            num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(cand_mask, connectivity=8)

            # Find component labels overlapping with high-confidence seed detections
            seed_labels = np.unique(labels[seed_mask > 0])
            seed_labels = seed_labels[seed_labels != 0]

            enhanced_mask = np.isin(labels, seed_labels).astype(np.uint8)
        else:
            enhanced_mask = seed_mask.copy()

        # Step 2: Conservative Morphological Closing to reconnect nearby fragments along elongated slicks
        if self.enable_morphology and self.morph_kernel_size > 1:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (self.morph_kernel_size, self.morph_kernel_size))
            enhanced_mask = cv2.morphologyEx(enhanced_mask, cv2.MORPH_CLOSE, kernel)

        # Step 3: Remove tiny isolated noise components
        if self.enable_noise_removal and self.min_noise_area_pixels > 0:
            num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(enhanced_mask, connectivity=8)
            clean_mask = np.zeros_like(enhanced_mask)
            for label_id in range(1, num_labels):
                area = stats[label_id, cv2.CC_STAT_AREA]
                if area >= self.min_noise_area_pixels:
                    clean_mask[labels == label_id] = 1
            enhanced_mask = clean_mask

        return enhanced_mask
