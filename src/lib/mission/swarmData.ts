/**
 * SIH 26143 — Synthetic AIS Vessel Swarm Data
 *
 * Generates ~400 geo-aligned synthetic vessel positions for Phase 3 (AIS_SWARM).
 * Distribution is deliberately biased toward the real Mumbai offshore corridor
 * shipping lanes to match incident INC-2026-MUM-001.
 *
 * Key geographic reference:
 *   Spill centroid:       71.85°E, 19.35°N
 *   Primary suspect path: (70.80, 20.10) → (71.90, 19.10)
 *   Mumbai port approach: 72.85°E, 18.95°N
 *   Arabian Sea corridor: 71.0°E–73.5°E, 17.5°N–21.0°N
 */

export interface SwarmVessel {
  id: string;
  position: [number, number]; // [lng, lat]
  vesselType: "tanker" | "bulk" | "container" | "misc";
  /** Whether this vessel is one of the 5–6 suspect candidates (highlighted in phase 4) */
  isCandidate: boolean;
  /** BACKTRACK phase suspicion level */
  suspicionLevel: "high" | "moderate" | "low" | "none";
}

// ─── Seeded pseudo-random (LCG) for deterministic output ─────────────────────

function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─── Shipping lane clusters ───────────────────────────────────────────────────

const CLUSTERS: Array<{
  centerLng: number;
  centerLat: number;
  spreadLng: number;
  spreadLat: number;
  count: number;
  type: SwarmVessel["vesselType"];
}> = [
  // Main Arabian Sea–Mumbai shipping corridor (heavily trafficked)
  { centerLng: 72.10, centerLat: 19.00, spreadLng: 0.80, spreadLat: 0.55, count: 90, type: "container" },
  { centerLng: 71.60, centerLat: 19.40, spreadLng: 0.70, spreadLat: 0.60, count: 75, type: "tanker" },
  // JNPT / Nhava Sheva approach lane
  { centerLng: 72.85, centerLat: 18.92, spreadLng: 0.30, spreadLat: 0.25, count: 45, type: "container" },
  // Western offshore: VLCC anchorage zone
  { centerLng: 71.20, centerLat: 19.70, spreadLng: 0.55, spreadLat: 0.45, count: 55, type: "tanker" },
  // Southern transit: bulk carriers heading NW
  { centerLng: 72.40, centerLat: 18.30, spreadLng: 0.60, spreadLat: 0.40, count: 50, type: "bulk" },
  // Northern approach: Kandla/Gujarat traffic
  { centerLng: 71.80, centerLat: 20.50, spreadLng: 0.70, spreadLat: 0.50, count: 40, type: "bulk" },
  // Scattered misc vessels (fishing, service, tug)
  { centerLng: 72.50, centerLat: 19.60, spreadLng: 1.00, spreadLat: 0.80, count: 57, type: "misc" },
];

// ─── Candidate vessels (phase 4 suspects) ────────────────────────────────────
// These are the 5–6 ships that remain highlighted after the backtrack.
// Positions are consistent with the corridor backtrack path and real vessel data.

const CANDIDATE_VESSELS: SwarmVessel[] = [
  {
    id: "cand-001",
    position: [71.20, 19.65],  // IND_TANKER_412 speed-drop point (primary)
    vesselType: "tanker",
    isCandidate: true,
    suspicionLevel: "high",
  },
  {
    id: "cand-002",
    position: [71.90, 19.28],  // Dark vessel CFAR_DARK_002 SAR position
    vesselType: "tanker",
    isCandidate: true,
    suspicionLevel: "high",
  },
  {
    id: "cand-003",
    position: [71.50, 19.50],  // Moderate suspect: edge of corridor
    vesselType: "tanker",
    isCandidate: true,
    suspicionLevel: "moderate",
  },
  {
    id: "cand-004",
    position: [71.75, 19.20],  // Moderate: tanker, outer corridor
    vesselType: "bulk",
    isCandidate: true,
    suspicionLevel: "moderate",
  },
  {
    id: "cand-005",
    position: [71.35, 19.80],  // Low: slow cargo, anchored at boundary
    vesselType: "misc",
    isCandidate: true,
    suspicionLevel: "low",
  },
  {
    id: "cand-006",
    position: [72.05, 19.10],  // Low: container, incompatible speed
    vesselType: "container",
    isCandidate: true,
    suspicionLevel: "low",
  },
];

// ─── Generator ───────────────────────────────────────────────────────────────

let _swarm: SwarmVessel[] | null = null;

export function generateSwarmVessels(): SwarmVessel[] {
  if (_swarm) return _swarm;

  const rand = createSeededRandom(42);  // Fixed seed → deterministic swarm
  const vessels: SwarmVessel[] = [];
  let idCounter = 0;

  for (const cluster of CLUSTERS) {
    for (let i = 0; i < cluster.count; i++) {
      // Box-Muller for Gaussian spread
      const u = Math.max(1e-6, rand());
      const v = rand();
      const z1 = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      const z2 = Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v);

      const lng = cluster.centerLng + z1 * cluster.spreadLng;
      const lat = cluster.centerLat + z2 * cluster.spreadLat;

      // Clamp to Arabian Sea region
      const clampedLng = Math.max(70.0, Math.min(74.0, lng));
      const clampedLat = Math.max(17.0, Math.min(22.0, lat));

      vessels.push({
        id: `swarm-${String(++idCounter).padStart(3, "0")}`,
        position: [clampedLng, clampedLat],
        vesselType: cluster.type,
        isCandidate: false,
        suspicionLevel: "none",
      });
    }
  }

  // Append the 6 candidate vessels
  vessels.push(...CANDIDATE_VESSELS);

  _swarm = vessels;
  return vessels;
}

/** Returns only the innocent vessels (used for dimming in phase 4) */
export function getInnocentVessels(): SwarmVessel[] {
  return generateSwarmVessels().filter((v) => !v.isCandidate);
}

/** Returns only the candidate suspects (highlighted in phase 4) */
export function getCandidateVessels(): SwarmVessel[] {
  return CANDIDATE_VESSELS;
}

/** Color for a swarm vessel in the scatter layer */
export function swarmVesselColor(v: SwarmVessel, phase: "swarm" | "backtrack"): [number, number, number, number] {
  if (phase === "swarm") {
    // All vessels: dim cyan dots
    return [34, 211, 238, 160];
  }

  // Backtrack phase
  if (!v.isCandidate) {
    return [90, 122, 148, 30]; // ghost grey
  }

  switch (v.suspicionLevel) {
    case "high":     return [239, 68, 68, 230];   // red
    case "moderate": return [245, 158, 11, 200];  // amber
    case "low":      return [100, 148, 190, 180]; // muted blue
    default:         return [34, 211, 238, 160];
  }
}

export const SWARM_TOTAL = CLUSTERS.reduce((sum, c) => sum + c.count, 0) + CANDIDATE_VESSELS.length;
