import type { AisTrack, SarRasterPatch, SlickPolygon } from "../types";

/**
 * Mumbai Offshore Corridor AOI demo data — SIH 26143 fixed scenario.
 * Slick from sar_detection_output.json (scene: S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI).
 * AIS tracks from generate_and_index_ais.py (IND_TANKER_412 / CONTAINER_EXPRESS).
 */

export const SAR_RASTER_PATCH: SarRasterPatch = {
  // Bounding box enclosing the Mumbai AOI: West 70.50°E, East 73.00°E, South 18.20°N, North 20.00°N
  bounds: [70.5, 18.2, 73.0, 20.0],
};

export const SLICK_POLYGONS: SlickPolygon[] = [
  {
    id: "slick_mumbai_01",
    // confidence field absent in sar_detection_output.json — defaulted to 0.88 (model output)
    confidence: 0.88,
    ring: [
      // Exact coordinates from sar_detection_output.json → polygons[0].geometry.coordinates
      [71.835, 19.36],
      [71.86, 19.37],
      [71.87, 19.34],
      [71.845, 19.33],
      [71.835, 19.36],
    ],
  },
];

/** Waypoints of the OpenDrift backtrack corridor along IND_TANKER_412's COG 135° track. */
export const CORRIDOR_WAYPOINTS: [number, number][] = [
  [71.2, 19.65],
  [71.45, 19.55],
  [71.65, 19.45],
  [71.85, 19.35],
];

export const H3_CORRIDOR_RESOLUTION = 7;

export const AIS_TRACKS: AisTrack[] = [
  {
    // IND_TANKER_412 — MMSI 419000101 — primary suspect (total_score 0.912 from case_file_output.json)
    // Trajectory from generate_and_index_ais.py: (70.80, 20.10) → (71.90, 19.10), COG 135°
    // Speed drop to 3.8–4.3 kts at T-12h near (71.20, 19.65)
    vesselId: "mmsi-419000101",
    vesselName: "IND_TANKER_412",
    path: [
      [70.8, 20.1],
      [71.2, 19.65],
      [71.55, 19.4],
      [71.75, 19.25],
      [71.9, 19.1],
    ],
  },
  {
    // CONTAINER_EXPRESS — MMSI 419000202 — low score (0.184, ~18.4% from case_file_output.json)
    // Transits (70.60, 18.30) → (72.80, 18.40) at 18–19 kts, COG 85°
    vesselId: "mmsi-419000202",
    vesselName: "CONTAINER_EXPRESS",
    path: [
      [70.6, 18.3],
      [71.3, 18.33],
      [71.9, 18.36],
      [72.4, 18.38],
      [72.8, 18.4],
    ],
  },
  {
    // SAR-only dark vessel — no MMSI — position from dark_vessel_output.json
    vesselId: "dark-vessel-cfar-002",
    vesselName: "DARK VESSEL (SAR-only)",
    path: [
      [71.9, 19.28],
    ],
  },
];

