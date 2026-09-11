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
    {
      relativeHour: -24,
      timestamp: "2026-05-14T06:00:00Z",
      cells: [
        { h3Index: "8742dacc0ffffff", particleCount: 8, density: 0.08, riskLevel: "low", centerCoordinates: [71.70219, 19.44163] },
        { h3Index: "8742dacc1ffffff", particleCount: 1, density: 0.01, riskLevel: "low", centerCoordinates: [71.7221, 19.44999] },
        { h3Index: "8742dacc2ffffff", particleCount: 3, density: 0.03, riskLevel: "low", centerCoordinates: [71.70014, 19.46824] },
        { h3Index: "8742dacc3ffffff", particleCount: 12, density: 0.12, riskLevel: "low", centerCoordinates: [71.72005, 19.4766] },
        { h3Index: "8742dacc5ffffff", particleCount: 2, density: 0.02, riskLevel: "low", centerCoordinates: [71.68228, 19.45989] },
        { h3Index: "8742dacd1ffffff", particleCount: 101, density: 1.0, riskLevel: "critical", centerCoordinates: [71.69809, 19.49485] },
        { h3Index: "8742dacd3ffffff", particleCount: 86, density: 0.85, riskLevel: "critical", centerCoordinates: [71.71801, 19.50321] },
        { h3Index: "8742dacd5ffffff", particleCount: 18, density: 0.18, riskLevel: "low", centerCoordinates: [71.67817, 19.51321] },
        { h3Index: "8742dacd8ffffff", particleCount: 95, density: 0.94, riskLevel: "critical", centerCoordinates: [71.73792, 19.51156] },
        { h3Index: "8742dacd9ffffff", particleCount: 34, density: 0.34, riskLevel: "medium", centerCoordinates: [71.75784, 19.51991] },
        { h3Index: "8742dacdbffffff", particleCount: 72, density: 0.71, riskLevel: "high", centerCoordinates: [71.75578, 19.54652] },
        { h3Index: "8742dacdeffffff", particleCount: 46, density: 0.46, riskLevel: "medium", centerCoordinates: [71.73587, 19.53817] },
      ],
      totalCells: 12,
      dominantDirectionDegrees: 135,
    },
    {
      relativeHour: -18,
      timestamp: "2026-05-14T12:00:00Z",
      cells: [
        { h3Index: "8742dacc3ffffff", particleCount: 6, density: 0.06, riskLevel: "low", centerCoordinates: [71.72005, 19.4766] },
        { h3Index: "8742dacd1ffffff", particleCount: 42, density: 0.39, riskLevel: "medium", centerCoordinates: [71.69809, 19.49485] },
        { h3Index: "8742dacd3ffffff", particleCount: 88, density: 0.81, riskLevel: "critical", centerCoordinates: [71.71801, 19.50321] },
        { h3Index: "8742dacd8ffffff", particleCount: 108, density: 1.0, riskLevel: "critical", centerCoordinates: [71.73792, 19.51156] },
        { h3Index: "8742dacd9ffffff", particleCount: 52, density: 0.48, riskLevel: "medium", centerCoordinates: [71.75784, 19.51991] },
        { h3Index: "8742dacdbffffff", particleCount: 65, density: 0.60, riskLevel: "high", centerCoordinates: [71.75578, 19.54652] },
        { h3Index: "8742dacdeffffff", particleCount: 39, density: 0.36, riskLevel: "medium", centerCoordinates: [71.73587, 19.53817] },
      ],
      totalCells: 7,
      dominantDirectionDegrees: 135,
    },
    {
      relativeHour: -12,
      timestamp: "2026-05-14T18:00:00Z",
      cells: [
        { h3Index: "8742da540ffffff", particleCount: 14, density: 0.10, riskLevel: "low", centerCoordinates: [71.81555, 19.38978] },
        { h3Index: "8742da544ffffff", particleCount: 45, density: 0.32, riskLevel: "medium", centerCoordinates: [71.83546, 19.39814] },
        { h3Index: "8742da545ffffff", particleCount: 92, density: 0.65, riskLevel: "high", centerCoordinates: [71.8176, 19.36317] },
        { h3Index: "8742da560ffffff", particleCount: 118, density: 0.84, riskLevel: "critical", centerCoordinates: [71.77773, 19.42475] },
        { h3Index: "8742da562ffffff", particleCount: 38, density: 0.27, riskLevel: "medium", centerCoordinates: [71.77568, 19.45136] },
        { h3Index: "8742da563ffffff", particleCount: 141, density: 1.0, riskLevel: "critical", centerCoordinates: [71.79559, 19.45971] },
        { h3Index: "8742da567ffffff", particleCount: 22, density: 0.16, riskLevel: "low", centerCoordinates: [71.75782, 19.47796] },
      ],
      totalCells: 7,
      dominantDirectionDegrees: 135,
    },
    {
      relativeHour: -6,
      timestamp: "2026-05-15T00:00:00Z",
      cells: [
        { h3Index: "8742da540ffffff", particleCount: 75, density: 0.44, riskLevel: "medium", centerCoordinates: [71.81555, 19.38978] },
        { h3Index: "8742da541ffffff", particleCount: 171, density: 1.0, riskLevel: "critical", centerCoordinates: [71.83751, 19.37153] },
        { h3Index: "8742da543ffffff", particleCount: 29, density: 0.17, riskLevel: "low", centerCoordinates: [71.85743, 19.37989] },
        { h3Index: "8742da545ffffff", particleCount: 134, density: 0.78, riskLevel: "critical", centerCoordinates: [71.8176, 19.36317] },
        { h3Index: "8742da548ffffff", particleCount: 1, density: 0.01, riskLevel: "low", centerCoordinates: [71.87938, 19.36163] },
        { h3Index: "8742da54cffffff", particleCount: 12, density: 0.07, riskLevel: "low", centerCoordinates: [71.85948, 19.35327] },
        { h3Index: "8742da54effffff", particleCount: 14, density: 0.08, riskLevel: "low", centerCoordinates: [71.83956, 19.34491] },
        { h3Index: "8742da56affffff", particleCount: 54, density: 0.32, riskLevel: "medium", centerCoordinates: [71.79764, 19.4331] },
      ],
      totalCells: 8,
      dominantDirectionDegrees: 135,
    },
    {
      relativeHour: 0,
      timestamp: "2026-05-15T06:00:00Z",
      cells: [
        { h3Index: "8742da541ffffff", particleCount: 40, density: 0.18, riskLevel: "low", centerCoordinates: [71.83751, 19.37153] },
        { h3Index: "8742da548ffffff", particleCount: 51, density: 0.22, riskLevel: "low", centerCoordinates: [71.87938, 19.36163] },
        { h3Index: "8742da54affffff", particleCount: 45, density: 0.20, riskLevel: "low", centerCoordinates: [71.8993, 19.36998] },
        { h3Index: "8742da54cffffff", particleCount: 118, density: 0.52, riskLevel: "high", centerCoordinates: [71.85948, 19.35327] },
        { h3Index: "8742da54effffff", particleCount: 227, density: 1.0, riskLevel: "critical", centerCoordinates: [71.83956, 19.34491] },
        { h3Index: "8742da55dffffff", particleCount: 19, density: 0.08, riskLevel: "low", centerCoordinates: [71.88143, 19.33501] },
      ],
      totalCells: 6,
      dominantDirectionDegrees: 135,
    },
  ],
};

export function convertCorridorResponseToP4(data: any): P4Output {
  if (!data || !data.corridor) return DEFAULT_P4_DATA;

  const keyToRelHour: Record<string, { hour: number; iso: string }> = {
    t0: { hour: 0, iso: "2026-05-15T06:00:00Z" },
    t_minus_6h: { hour: -6, iso: "2026-05-15T00:00:00Z" },
    t_minus_12h: { hour: -12, iso: "2026-05-14T18:00:00Z" },
    t_minus_18h: { hour: -18, iso: "2026-05-14T12:00:00Z" },
    t_minus_24h: { hour: -24, iso: "2026-05-14T06:00:00Z" },
  };

  const timesteps: H3CorridorTimestep[] = Object.entries(data.corridor).map(([key, stepData]: [string, any]) => {
    const meta = keyToRelHour[key] ?? { hour: 0, iso: "2026-05-15T06:00:00Z" };
    const hexIds: string[] = stepData.hex_ids || [];
    const densityMap: Record<string, number> = stepData.particle_density || {};

    let maxDensity = 1;
    for (const hex of hexIds) {
      const c = densityMap[hex] ?? 1;
      if (c > maxDensity) maxDensity = c;
    }

    const cells: H3CellDensity[] = hexIds.map((hex: string) => {
      const count = densityMap[hex] ?? 1;
      const norm = Number((count / maxDensity).toFixed(2));
      const [lat, lng] = cellToLatLng(hex);
      const riskLevel: H3CellDensity["riskLevel"] =
        norm > 0.75 ? "critical" : norm > 0.5 ? "high" : norm > 0.25 ? "medium" : "low";

      return {
        h3Index: hex,
        particleCount: count,
        density: norm,
        riskLevel,
        centerCoordinates: [lng, lat],
      };
    });

    return {
      relativeHour: meta.hour,
      timestamp: meta.iso,
      cells,
      totalCells: cells.length,
      dominantDirectionDegrees: 135,
    };
  });

  timesteps.sort((a, b) => a.relativeHour - b.relativeHour);

  return {
    corridorId: "H3-CORR-MUM-0515",
    h3Resolution: data.h3_resolution || H3_CORRIDOR_RESOLUTION,
    totalCoverageAreaKm2: 42.5,
    generatedAt: "2026-05-15T06:25:00Z",
    timesteps,
  };
}

/**
 * Returns genuine H3 corridor cells computed from oceanographic Lagrangian particle backtracking.
 * Corridor cells reflect physical particle dispersion, NOT a synthetic halo around vessels.
 */
export function getH3CorridorForTrackAndHour(
  p4: P4Output,
  _p5?: P5Output,
  _selectedTrackId: string = "all",
  relativeHour: number = 0
): H3CellDensity[] {
  const ts = getH3TimestepForHour(p4, relativeHour);
  return ts?.cells || [];
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
