import type { AisTrack, SarRasterPatch, SlickPolygon } from "../types";

/**
 * Synthetic placeholder data for Day 1.
 * Everything here is static so it is safe to import anywhere; real data
 * sources replace this module later without touching the layer or UI code.
 */

export const SAR_RASTER_PATCH: SarRasterPatch = {
  bounds: [103.72, 1.1, 103.9, 1.26],
};

export const SLICK_POLYGONS: SlickPolygon[] = [
  {
    id: "slick-001",
    confidence: 0.82,
    ring: [
      [103.8, 1.16],
      [103.85, 1.19],
      [103.88, 1.17],
      [103.86, 1.12],
      [103.81, 1.12],
      [103.8, 1.16],
    ],
  },
];

/** Waypoints of the shipping corridor the H3 cells are generated along. */
export const CORRIDOR_WAYPOINTS: [number, number][] = [
  [103.7, 1.08],
  [103.78, 1.12],
  [103.86, 1.15],
  [103.95, 1.2],
];

export const H3_CORRIDOR_RESOLUTION = 8;

export const AIS_TRACKS: AisTrack[] = [
  {
    vesselId: "mmsi-5630001",
    vesselName: "MV Meridian Star",
    path: [
      [103.68, 1.05],
      [103.74, 1.09],
      [103.82, 1.13],
      [103.9, 1.17],
      [103.98, 1.22],
    ],
  },
  {
    vesselId: "mmsi-5630002",
    vesselName: "ST Aurora",
    path: [
      [103.97, 1.08],
      [103.9, 1.11],
      [103.84, 1.16],
      [103.76, 1.2],
      [103.7, 1.25],
    ],
  },
  {
    vesselId: "mmsi-5630003",
    vesselName: "Pacific Kestrel",
    path: [
      [103.8, 1.28],
      [103.82, 1.22],
      [103.83, 1.16],
      [103.85, 1.1],
    ],
  },
];
