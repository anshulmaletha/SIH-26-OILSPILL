import { gridDisk, latLngToCell } from "h3-js";
import type { P4Output, H3CorridorTimestep, H3CellDensity } from "../contracts/p4";
import { CORRIDOR_WAYPOINTS, H3_CORRIDOR_RESOLUTION } from "../map/data/sampleData";

function createSyntheticH3Timestep(
  relHour: number,
  isoTime: string,
  centerLng: number,
  centerLat: number,
  baseDensity: number
): H3CorridorTimestep {
  const centerHex = latLngToCell(centerLat, centerLng, H3_CORRIDOR_RESOLUTION);
  const disk = gridDisk(centerHex, 2);

  const cells: H3CellDensity[] = disk.map((hex, idx) => {
    const isCenter = idx === 0;
    const isInner = idx < 7;
    // Hexagonal cell density varies by distance from center
    const density = isCenter
      ? Math.min(1.0, baseDensity * 1.1)
      : isInner
      ? baseDensity * 0.75
      : baseDensity * 0.35;

    const riskLevel =
      density > 0.75 ? "critical" : density > 0.5 ? "high" : density > 0.25 ? "medium" : "low";

    return {
      h3Index: hex,
      particleCount: Math.round(density * 100),
      density: Number(density.toFixed(2)),
      riskLevel,
      centerCoordinates: [centerLng, centerLat],
    };
  });

  return {
    relativeHour: relHour,
    timestamp: isoTime,
    cells,
    totalCells: cells.length,
    dominantDirectionDegrees: 68,
  };
}

/** Fallback dataset for P4 H3 corridor matching across observation times */
export const DEFAULT_P4_DATA: P4Output = {
  corridorId: "H3-CORR-SIN-0902",
  h3Resolution: H3_CORRIDOR_RESOLUTION,
  totalCoverageAreaKm2: 38.6,
  generatedAt: "2026-09-02T06:25:00Z",
  timesteps: [
    // -24h: concentrated near release origin
    createSyntheticH3Timestep(-24, "2026-09-01T06:00:00Z", 103.712, 1.075, 0.95),
    // -18h: drifted eastward
    createSyntheticH3Timestep(-18, "2026-09-01T12:00:00Z", 103.748, 1.092, 0.85),
    // -12h: mid-corridor
    createSyntheticH3Timestep(-12, "2026-09-01T18:00:00Z", 103.785, 1.115, 0.75),
    // -6h: approaching detection zone
    createSyntheticH3Timestep(-6, "2026-09-02T00:00:00Z", 103.818, 1.135, 0.65),
    // 0h: detection location
    createSyntheticH3Timestep(0, "2026-09-02T06:00:00Z", 103.84, 1.15, 0.55),
  ],
};

export function getH3TimestepForHour(p4: P4Output, relativeHour: number): H3CorridorTimestep | null {
  const timesteps = p4?.timesteps || DEFAULT_P4_DATA.timesteps;
  if (!timesteps || timesteps.length === 0) return null;

  const exact = timesteps.find((ts) => ts.relativeHour === relativeHour);
  if (exact) return exact;

  let closest = timesteps[0];
  let minDiff = Math.abs(closest.relativeHour - relativeHour);

  for (const ts of timesteps) {
    const diff = Math.abs(ts.relativeHour - relativeHour);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ts;
    }
  }

  return closest;
}

/**
 * Maps particle density (0.0 to 1.0) to color and opacity.
 * - High density (>0.75): Hot Magenta / Crimson [244, 63, 94]
 * - Medium-High (>0.50): Vibrant Orange [249, 115, 22]
 * - Medium (>0.25): Amber / Yellow [245, 158, 11]
 * - Low (<=0.25): Cyan [34, 211, 238]
 */
export function getDensityColor(
  density: number,
  alphaMultiplier: number = 1
): [number, number, number, number] {
  const d = Math.max(0, Math.min(1, density));

  let r = 34;
  let g = 211;
  let b = 238;

  if (d > 0.75) {
    r = 244;
    g = 63;
    b = 94;
  } else if (d > 0.5) {
    r = 249;
    g = 115;
    b = 22;
  } else if (d > 0.25) {
    r = 245;
    g = 158;
    b = 11;
  } else {
    r = 34;
    g = 211;
    b = 238;
  }

  const alpha = Math.round((60 + d * 175) * alphaMultiplier);
  return [r, g, b, alpha];
}

export function parseP4Payload(raw: unknown): P4Output {
  if (!raw || typeof raw !== "object") return DEFAULT_P4_DATA;
  const p4 = raw as Partial<P4Output>;
  if (!p4.timesteps || !Array.isArray(p4.timesteps)) return DEFAULT_P4_DATA;
  return p4 as P4Output;
}
