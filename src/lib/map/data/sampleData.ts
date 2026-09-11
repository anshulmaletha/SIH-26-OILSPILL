import type { AisTrack, SarRasterPatch, SlickPolygon } from "../types";
import { generateOrganicSlick } from "../../physics/slickPhysics";

/**
 * Mumbai Offshore Corridor AOI demo data — SIH 26143 fixed scenario.
 * Slick generated from dynamic organic physics model (Fay spreading + ERA5 wind + HYCOM currents).
 */

export const SAR_RASTER_PATCH: SarRasterPatch = {
  bounds: [70.5, 18.2, 73.0, 20.0],
};

const initialSlick = generateOrganicSlick([71.853, 19.352], 0);

export const SLICK_POLYGONS: SlickPolygon[] = [
  {
    id: "slick_mumbai_01",
    confidence: 0.94,
    ring: initialSlick.corePolygon,
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
    vesselId: "dark-vessel-cfar-002",
    vesselName: "DARK VESSEL (SAR-only)",
    path: [
      [71.9, 19.28],
    ],
  },
];
