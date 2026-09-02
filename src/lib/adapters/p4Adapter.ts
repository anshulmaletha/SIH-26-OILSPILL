import { gridDisk, latLngToCell } from "h3-js";
import type { P4Output, H3CorridorTimestep, H3CellDensity } from "../contracts/p4";
import type { P5Output } from "../contracts/p5";
import { H3_CORRIDOR_RESOLUTION } from "../map/data/sampleData";
import { getVesselPositionsAtHour } from "./p5Adapter";

/**
 * Creates synthetic H3 hexagonal cluster around a given center [lng, lat]
 */
export function createSyntheticH3Cells(
  centerLng: number,
  centerLat: number,
  baseDensity: number = 0.8
): H3CellDensity[] {
  const centerHex = latLngToCell(centerLat, centerLng, H3_CORRIDOR_RESOLUTION);
  const disk = gridDisk(centerHex, 2);

  return disk.map((hex, idx) => {
    const isCenter = idx === 0;
    const isInner = idx > 0 && idx < 7;
    // Hexagonal cell density gradient
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
}

function createSyntheticH3Timestep(
  relHour: number,
  isoTime: string,
  centerLng: number,
  centerLat: number,
  baseDensity: number
): H3CorridorTimestep {
  const cells = createSyntheticH3Cells(centerLng, centerLat, baseDensity);

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
    // -24h: release origin
    createSyntheticH3Timestep(-24, "2026-09-01T06:00:00Z", 103.68, 1.05, 0.95),
    // -18h: early plume
    createSyntheticH3Timestep(-18, "2026-09-01T12:00:00Z", 103.74, 1.09, 0.85),
    // -12h: mid-corridor
    createSyntheticH3Timestep(-12, "2026-09-01T18:00:00Z", 103.82, 1.13, 0.75),
    // -6h: approaching detection
    createSyntheticH3Timestep(-6, "2026-09-02T00:00:00Z", 103.90, 1.17, 0.65),
    // 0h: detection zone
    createSyntheticH3Timestep(0, "2026-09-02T06:00:00Z", 103.98, 1.22, 0.55),
  ],
};

/**
 * Dynamically computes H3 corridor cells linked directly to the selected AIS vessel track
 * and observation hour.
 */
export function getH3CorridorForTrackAndHour(
  p4: P4Output,
  p5: P5Output,
  selectedTrackId: string = "all",
  relativeHour: number = 0
): H3CellDensity[] {
  const activePositions = getVesselPositionsAtHour(p5, relativeHour);

  if (selectedTrackId && selectedTrackId !== "all") {
    // 1. Single Selected Track: Center H3 cells on that specific vessel's position at this hour
    const match = activePositions.find((p) => p.vessel.vesselId === selectedTrackId);
    if (match && match.currentPosition) {
      const baseDensity = Math.max(0.45, 0.95 - (Math.abs(relativeHour + 24) / 24) * 0.4);
      return createSyntheticH3Cells(match.currentPosition[0], match.currentPosition[1], baseDensity);
    }
  }

  // 2. "All Tracks" selected: Create H3 cells along all candidate tracks at this hour
  const allCells: H3CellDensity[] = [];
  const seenHexes = new Set<string>();

  for (const pos of activePositions) {
    if (pos.vessel.isCandidate || pos.currentPosition) {
      const baseDensity = Math.max(0.4, 0.9 - (Math.abs(relativeHour + 24) / 24) * 0.35);
      const cells = createSyntheticH3Cells(pos.currentPosition[0], pos.currentPosition[1], baseDensity);
      for (const cell of cells) {
        if (!seenHexes.has(cell.h3Index)) {
          seenHexes.add(cell.h3Index);
          allCells.push(cell);
        }
      }
    }
  }

  if (allCells.length > 0) return allCells;

  // Fallback to primary timestep if no active positions
  const fallbackTs = getH3TimestepForHour(p4, relativeHour);
  return fallbackTs?.cells || [];
}

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
