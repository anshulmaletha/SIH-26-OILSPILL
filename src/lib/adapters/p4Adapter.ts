import { gridDiskDistances, latLngToCell, cellToLatLng } from "h3-js";
import type { P4Output, H3CorridorTimestep, H3CellDensity } from "../contracts/p4";
import type { P5Output } from "../contracts/p5";
import { H3_CORRIDOR_RESOLUTION } from "../map/data/sampleData";
import { getVesselPositionsAtHour } from "./p5Adapter";

/**
 * Creates dense synthetic H3 hexagonal cluster around a given center [lng, lat]
 * Generates 4 concentric rings (61 hexagons) with discrete density decay from core to edge.
 */
export function createSyntheticH3Cells(
  centerLng: number,
  centerLat: number,
  baseDensity: number = 0.85
): H3CellDensity[] {
  const centerHex = latLngToCell(centerLat, centerLng, H3_CORRIDOR_RESOLUTION);
  const ringGroups = gridDiskDistances(centerHex, 4);

  // Discrete decay multipliers per ring k=0..4
  const ringMultipliers = [1.05, 0.82, 0.58, 0.32, 0.14];

  const cells: H3CellDensity[] = [];

  ringGroups.forEach((hexesInRing, ringK) => {
    const mult = ringMultipliers[ringK] ?? 0.1;
    const density = Math.max(0.08, Math.min(1.0, baseDensity * mult));
    const riskLevel: H3CellDensity["riskLevel"] =
      density > 0.75 ? "critical" : density > 0.5 ? "high" : density > 0.25 ? "medium" : "low";

    for (const hex of hexesInRing) {
      const [cLat, cLng] = cellToLatLng(hex);
      cells.push({
        h3Index: hex,
        particleCount: Math.round(density * 100),
        density: Number(density.toFixed(2)),
        riskLevel,
        centerCoordinates: [cLng, cLat],
      });
    }
  });

  return cells;
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
  corridorId: "H3-CORR-MUM-0515",
  h3Resolution: H3_CORRIDOR_RESOLUTION,
  totalCoverageAreaKm2: 38.6,
  generatedAt: "2026-05-15T06:25:00Z",
  timesteps: [
    // -12h: release origin — IND_TANKER_412 speed-drop zone near (71.20, 19.65)
    createSyntheticH3Timestep(-12, "2026-05-14T18:00:00Z", 71.2, 19.65, 0.95),
    // -9h: early plume — mid-trajectory near (71.45, 19.55)
    createSyntheticH3Timestep(-9, "2026-05-14T21:00:00Z", 71.45, 19.55, 0.85),
    // -6h: mid-corridor — (71.65, 19.45)
    createSyntheticH3Timestep(-6, "2026-05-15T00:00:00Z", 71.65, 19.45, 0.75),
    // -3h: approaching detection — (71.75, 19.4)
    createSyntheticH3Timestep(-3, "2026-05-15T03:00:00Z", 71.75, 19.4, 0.65),
    // 0h: detection zone — slick centroid (71.85, 19.35) from sar_detection_output.json
    createSyntheticH3Timestep(0, "2026-05-15T06:00:00Z", 71.85, 19.35, 0.55),
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

  let closest = timesteps[0]!;
  let minDiff = Math.abs(closest.relativeHour - relativeHour);

  for (const ts of timesteps) {
    const diff = Math.abs(ts.relativeHour - relativeHour);
    if (diff < minDiff) {
      minDiff = diff;
      closest = ts;
    }
  }

  return closest ?? null;
}

/**
 * Maps particle density (0.0 to 1.0) to a cyan RGBA color with discrete opacity steps.
 *
 * Design spec: single accent hue (#22D3EE / [34, 211, 238]) only.
 * Density maps to fill opacity in 5 discrete choropleth bands:
 *   ≥ 0.85  →  Core Peak   (alpha 230 / ~90%)
 *   ≥ 0.65  →  High Ring   (alpha 185 / ~72%)
 *   ≥ 0.45  →  Medium Ring (alpha 135 / ~53%)
 *   ≥ 0.20  →  Low Ring    (alpha 80  / ~31%)
 *   < 0.20  →  Edge Fringe (alpha 35  / ~14%)
 */
export function getDensityColor(
  density: number,
  alphaMultiplier: number = 1
): [number, number, number, number] {
  const d = Math.max(0, Math.min(1, density));

  // Consistent Cyan RGB: #22D3EE = [34, 211, 238]
  const r = 34;
  const g = 211;
  const b = 238;

  let alpha: number;
  if (d >= 0.85) {
    alpha = 230; // ~90%
  } else if (d >= 0.65) {
    alpha = 185; // ~72%
  } else if (d >= 0.45) {
    alpha = 135; // ~53%
  } else if (d >= 0.20) {
    alpha = 80;  // ~31%
  } else {
    alpha = 35;  // ~14%
  }

  return [r, g, b, Math.round(alpha * alphaMultiplier)];
}

export function parseP4Payload(raw: unknown): P4Output {
  if (!raw || typeof raw !== "object") return DEFAULT_P4_DATA;
  const p4 = raw as Partial<P4Output>;
  if (!p4.timesteps || !Array.isArray(p4.timesteps)) return DEFAULT_P4_DATA;
  return p4 as P4Output;
}
