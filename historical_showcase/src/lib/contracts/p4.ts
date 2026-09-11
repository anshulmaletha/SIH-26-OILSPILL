/**
 * P4 Contract: H3 Hexagonal Corridor Matching
 * Owner: P4 (H3 Corridor Matching)
 */

export interface H3CellDensity {
  /** Hexadecimal H3 Index string */
  h3Index: string;
  particleCount: number;
  /** Normalized density: 0.0 to 1.0 */
  density: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  centerCoordinates: [longitude: number, latitude: number];
}

export interface H3CorridorTimestep {
  relativeHour: number; // e.g. -24, -18, -12, -6, 0
  timestamp: string;
  cells: H3CellDensity[];
  totalCells: number;
  dominantDirectionDegrees: number;
}

export interface P4Output {
  corridorId: string;
  h3Resolution: number; // typically 7 or 8
  timesteps: H3CorridorTimestep[];
  staticHullBoundary?: [number, number][];
  totalCoverageAreaKm2: number;
  generatedAt: string;
}
