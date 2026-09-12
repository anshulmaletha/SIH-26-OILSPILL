/**
 * SIH 26143 — Synthetic AIS Vessel Swarm & Maritime Intelligence Data
 *
 * Generates calibrated realistic synthetic vessel tracks and live telemetry
 * across the Mumbai offshore maritime corridor (INC-2026-MUM-001).
 *
 * Provides rich, deterministic, realistic vessel metadata:
 * - Vessel Name, MMSI, Call Sign, Flag, Type, IMO
 * - Position (lat, lng), SOG Speed, COG / Heading
 * - Navigational Status, Destination, ETA, Dimensions (Length, Beam, Draught)
 * - Historical trajectory waypoints leading up to current position
 * - Suspicious / Dark vessel anomaly classifications
 * - Viewport boundary safety & Zoom-responsive LOD density tiers
 */

export interface SwarmVessel {
  id: string;
  name: string;
  mmsi: string;
  imo?: string;
  callsign: string;
  flag: string;
  vesselType: "tanker" | "bulk" | "container" | "misc";
  typeLabel: string;
  position: [number, number]; // [lng, lat]
  heading: number; // 0–359 degrees
  course: number; // COG degrees
  speedKnots: number; // SOG
  navStatus: string;
  destination: string;
  eta: string;
  lastSeen: string;
  lengthMeters: number;
  beamMeters: number;
  draughtMeters: number;
  /** Multi-point historical trajectory waypoints leading to current position */
  trajectory: [number, number][];
  /** Whether this vessel is one of the candidate suspects */
  isCandidate: boolean;
  /** Suspicion level */
  suspicionLevel: "high" | "moderate" | "low" | "none";
  /** Dark vessel flag */
  isDarkVessel?: boolean;
  /** Anomaly description if suspicious */
  suspiciousReason?: string;
  /** Threat classification tag */
  threatTag?: string;
  /** Blackout duration in hours */
  blackoutDurationHours?: number;
  /** Risk or confidence score */
  riskScore?: string | number;
  /** Minimum zoom level at which this vessel is revealed (LOD filtering) */
  minZoom?: number;
}

// ─── Seeded pseudo-random (LCG) for deterministic output ─────────────────────

function createSeededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─── Deterministic Name & Metadata Banks ──────────────────────────────────────

const TANKER_NAMES = [
  "MT Godavari Pioneer", "MT Samudra Ratna", "MT Arabian Glory", "MT Al-Jubail Express",
  "MT Bharat Sindhu", "MT Mumbai Pearl", "MT Sagar Kanya", "MT Ocean Monarch",
  "MT Gulf Horizon", "MT Indus Voyager", "MT Malabar Pride", "MT Western Star",
  "MT Fujairah Breeze", "MT Swarna Godavari", "MT Ratna Puja", "MT Konkan Star",
  "MT Desh Shanti", "MT Jag Pranam", "MT Abul Kalam", "MT Swarna Mala",
];

const CONTAINER_NAMES = [
  "CMA CGM Mumbai", "MSC Gujarat Express", "APL Arabian Sea", "Wan Hai 512",
  "Maersk Nhava Sheva", "Cosco Shipping Indus", "Ever Given Pioneer", "ONE Integrity",
  "Hapag-Lloyd Kandla", "OOCL South Asia", "ZIM India Transit", "Yang Ming Mandovi",
  "MSC Aravalli", "Hanjin Cochin", "KMTC Mumbai Gateway", "SITC Ocean Link",
];

const BULK_NAMES = [
  "MV Star Polaris", "MV Samudra Shaktiman", "MV Indian Reliance", "MV Gujarat Trader",
  "MV Pacific Carrier", "MV Goa Transporter", "MV Bengal Hawk", "MV Sagar Samrat",
  "MV Eastern Glory", "MV Deccan Pioneer", "MV Mandovi Bulk", "MV Arabian Ore",
  "MV Western Carrier", "MV Salgaocar Gem", "MV Mormugao Star", "MV Ganga Bulk",
];

const MISC_NAMES = [
  "Tug Sagar Rakshak", "OSV Coastal Sentinel", "FV Matsya Jeevan", "Tug Ocean Titan",
  "Surveyor Narmada", "Pilot Craft Mumbai 04", "OSV Samudra Sevak", "FV Sagar Deep",
  "Dredger Mandovi IX", "Barge Ganga 202", "Supply Vessel Malabar 01", "Patrol Interceptor 08",
];

const FLAGS_BY_PREFIX: Array<{ flag: string; prefix: string }> = [
  { flag: "India", prefix: "419" },
  { flag: "Panama", prefix: "352" },
  { flag: "Singapore", prefix: "563" },
  { flag: "Liberia", prefix: "636" },
  { flag: "Marshall Islands", prefix: "538" },
  { flag: "Bahamas", prefix: "311" },
  { flag: "Malta", prefix: "248" },
  { flag: "Cyprus", prefix: "209" },
];

const DESTINATIONS = [
  "MUMBAI (INBOM)",
  "NHAVA SHEVA / JNPT (INNSA)",
  "KANDLA (INIXY)",
  "MUNDRA PORT (INMUN)",
  "HAZIRA (INHAZ)",
  "SINGAPORE (SGSIN)",
  "COLOMBO (LKCMB)",
  "FUJAIRAH (AEFJR)",
  "JEBEL ALI (AEJEA)",
  "ROTTERDAM (NLRTM)",
  "PORT SULTAN QABOOS",
  "ANCHORAGE MUMBAI HIGH",
];

const NAV_STATUSES = [
  "Underway using Engine",
  "Underway using Engine",
  "Underway using Engine",
  "Underway using Engine",
  "At Anchor",
  "Restricted Maneuverability",
  "Moored / Awaiting Berth",
];

// ─── Calibrated Primary Clusters (230 base normal vessels) ───────────────────
// Provides a natural, corridor-clustered maritime traffic density of ~200–220 fully visible normal vessels at default zoom

const CLUSTERS: Array<{
  centerLng: number;
  centerLat: number;
  spreadLng: number;
  spreadLat: number;
  count: number;
  type: SwarmVessel["vesselType"];
  typeLabel: string;
  defaultCog: number;
  speedRange: [number, number];
  baseMinZoom?: number;
}> = [
  // 1. Central Arabian Sea Traffic Separation Scheme (TSS) & Approach Channel (Main container line)
  { centerLng: 72.15, centerLat: 19.05, spreadLng: 0.48, spreadLat: 0.24, count: 54, type: "container", typeLabel: "Container Ship", defaultCog: 78, speedRange: [16.0, 21.5], baseMinZoom: 0 },
  // 2. North-West Crude Tanker Trunk Line (Gulf to Mumbai / Hazira)
  { centerLng: 71.55, centerLat: 19.45, spreadLng: 0.42, spreadLat: 0.30, count: 46, type: "tanker", typeLabel: "Crude Oil Tanker", defaultCog: 135, speedRange: [11.5, 14.8], baseMinZoom: 0 },
  // 3. Nhava Sheva / JNPT Port Approach & Waiting Roads
  { centerLng: 72.82, centerLat: 18.94, spreadLng: 0.16, spreadLat: 0.15, count: 28, type: "container", typeLabel: "Container Ship", defaultCog: 92, speedRange: [6.0, 12.0], baseMinZoom: 0 },
  // 4. Bombay High / Western Offshore VLCC Anchorage Zone
  { centerLng: 71.25, centerLat: 19.68, spreadLng: 0.30, spreadLat: 0.22, count: 34, type: "tanker", typeLabel: "VLCC / Product Tanker", defaultCog: 150, speedRange: [0.2, 3.5], baseMinZoom: 0 },
  // 5. Southern Coastal Transit (Goa / Cochin to Mumbai bulk traffic)
  { centerLng: 72.45, centerLat: 18.42, spreadLng: 0.35, spreadLat: 0.22, count: 28, type: "bulk", typeLabel: "Bulk Carrier", defaultCog: 315, speedRange: [10.5, 14.2], baseMinZoom: 0 },
  // 6. Northern Feeder Lane (Gulf of Khambhat / Hazira)
  { centerLng: 71.75, centerLat: 20.25, spreadLng: 0.38, spreadLat: 0.25, count: 22, type: "bulk", typeLabel: "Bulk Carrier", defaultCog: 185, speedRange: [11.0, 15.0], baseMinZoom: 0 },
  // 7. Coastal Support / OSV / Tug vessels near offshore installations
  { centerLng: 72.48, centerLat: 19.55, spreadLng: 0.48, spreadLat: 0.35, count: 18, type: "misc", typeLabel: "Offshore Support / Tug", defaultCog: 240, speedRange: [6.0, 11.0], baseMinZoom: 0 },
];

// High-zoom detail vessels (revealed when zooming in closer for deep port/field inspection)
const DETAIL_CLUSTERS: Array<{
  centerLng: number;
  centerLat: number;
  spreadLng: number;
  spreadLat: number;
  count: number;
  type: SwarmVessel["vesselType"];
  typeLabel: string;
  defaultCog: number;
  speedRange: [number, number];
  baseMinZoom: number;
}> = [
  // High-zoom inner harbor service craft near JNPT
  { centerLng: 72.90, centerLat: 18.96, spreadLng: 0.10, spreadLat: 0.10, count: 30, type: "misc", typeLabel: "Harbor Tug / Pilot", defaultCog: 85, speedRange: [4.0, 9.0], baseMinZoom: 9.0 },
  // High-zoom offshore field supply vessels around Bombay High
  { centerLng: 71.30, centerLat: 19.72, spreadLng: 0.18, spreadLat: 0.18, count: 35, type: "misc", typeLabel: "Offshore Supply Vessel", defaultCog: 180, speedRange: [5.0, 10.5], baseMinZoom: 9.0 },
  // High-zoom local coastal feeder traffic
  { centerLng: 72.65, centerLat: 19.20, spreadLng: 0.25, spreadLat: 0.25, count: 35, type: "container", typeLabel: "Feeder Container", defaultCog: 110, speedRange: [12.0, 16.0], baseMinZoom: 9.0 },
];

// ─── Candidate & Suspicious Vessels ──────────────────────────────────────────

const CANDIDATE_VESSELS: SwarmVessel[] = [
  {
    id: "cand-001",
    name: "IND_TANKER_412",
    mmsi: "419000101",
    callsign: "VTBC",
    flag: "India",
    vesselType: "tanker",
    typeLabel: "Crude Oil Tanker (VLCC)",
    position: [71.90, 19.10],
    heading: 135,
    course: 135,
    speedKnots: 11.5,
    navStatus: "Underway using Engine",
    destination: "NHAVA SHEVA PORT",
    eta: "2026-05-15 14:00 UTC",
    lastSeen: "06:00:00 UTC",
    lengthMeters: 245,
    beamMeters: 42,
    draughtMeters: 14.5,
    isCandidate: true,
    suspicionLevel: "high",
    suspiciousReason: "Primary suspect: 14.2 → 4.1 kn speed drop at T-12h inside backtracked spill corridor",
    threatTag: "CRITICAL PROBABILITY (0.912)",
    minZoom: 0,
    trajectory: [
      [70.80, 20.10], // T-24h
      [71.00, 19.88], // T-18h
      [71.20, 19.65], // T-12h: Speed drop (14.2 → 4.1 kn) & discharge location
      [71.55, 19.40], // T-6h
      [71.90, 19.10], // T0: Present SAR detection position
    ],
  },
  {
    id: "dark-vessel-cfar-002",
    name: "DARK VESSEL-01 (CFAR_DARK_002)",
    mmsi: "N/A (RADAR CONTACT ONLY)",
    callsign: "UNREGISTERED",
    flag: "Unknown",
    vesselType: "tanker",
    typeLabel: "Crude Tanker (SAR Target)",
    position: [71.90, 19.28],
    heading: 142,
    course: 142,
    speedKnots: 0.0,
    navStatus: "AIS Blackout / Radar Contact",
    destination: "Unreported Transit",
    eta: "UNKNOWN",
    lastSeen: "14h ago (08:00:00 UTC)",
    lengthMeters: 175,
    beamMeters: 28,
    draughtMeters: 9.8,
    isCandidate: true,
    suspicionLevel: "high",
    isDarkVessel: true,
    blackoutDurationHours: 14,
    riskScore: "92 / 100 (CRITICAL)",
    suspiciousReason: "Rendezvous behavior with another dark contact & 14h continuous AIS blackout correlated with Sentinel-1A SAR detection at plume origin.",
    threatTag: "CFAR RADAR TARGET · 14h BLACKOUT",
    minZoom: 0,
    trajectory: [
      [71.55, 19.55],
      [71.72, 19.42],
      [71.84, 19.33],
      [71.90, 19.28],
    ],
  },
  {
    id: "dark-vessel-north-003",
    name: "DARK VESSEL-02 (NORTH SECTOR)",
    mmsi: "N/A (RADAR CONTACT ONLY)",
    callsign: "UNCONFIRMED",
    flag: "Panama (Suspected)",
    vesselType: "tanker",
    typeLabel: "Chemical / Products Tanker",
    position: [71.45, 19.95],
    heading: 198,
    course: 198,
    speedKnots: 5.4,
    navStatus: "Unusual Loitering / Intermittent AIS",
    destination: "HAZIRA OFFSHORE",
    eta: "2026-05-15 18:30 UTC",
    lastSeen: "4h ago (02:00:00 UTC)",
    lengthMeters: 160,
    beamMeters: 26,
    draughtMeters: 8.5,
    isCandidate: true,
    suspicionLevel: "high",
    isDarkVessel: true,
    blackoutDurationHours: 4,
    riskScore: "78 / 100 (HIGH)",
    suspiciousReason: "Route deviation from historical corridor with 4h transponder shutdown along northern feeder lane.",
    threatTag: "ROUTE DEVIATION · 4h BLACKOUT",
    minZoom: 0,
    trajectory: [
      [71.30, 20.35],
      [71.38, 20.15],
      [71.42, 20.02],
      [71.45, 19.95],
    ],
  },
  {
    id: "dark-vessel-south-004",
    name: "DARK VESSEL-03 (SOUTH TSS)",
    mmsi: "N/A (RADAR CONTACT ONLY)",
    callsign: "UNRESOLVED",
    flag: "Liberia (Suspected)",
    vesselType: "bulk",
    typeLabel: "Heavy Bulk Carrier",
    position: [72.25, 18.65],
    heading: 285,
    course: 282,
    speedKnots: 6.8,
    navStatus: "Abrupt Course Deviation",
    destination: "MUMBAI OUTER ANCHORAGE",
    eta: "2026-05-15 22:00 UTC",
    lastSeen: "9h ago (21:00:00 UTC)",
    lengthMeters: 225,
    beamMeters: 36,
    draughtMeters: 12.0,
    isCandidate: true,
    suspicionLevel: "high",
    isDarkVessel: true,
    blackoutDurationHours: 9,
    riskScore: "85 / 100 (HIGH)",
    suspiciousReason: "Loitering pattern detected near shipping lane with nighttime 90° heading shift and 9h AIS blackout traversing outer TSS.",
    threatTag: "LOITERING DETECTED · 9h BLACKOUT",
    minZoom: 0,
    trajectory: [
      [72.70, 18.45],
      [72.52, 18.52],
      [72.38, 18.59],
      [72.25, 18.65],
    ],
  },
  {
    id: "dark-vessel-west-005",
    name: "DARK VESSEL-04 (WEST OFFSHORE)",
    mmsi: "N/A (RADAR CONTACT ONLY)",
    callsign: "UNKNOWN",
    flag: "Unknown",
    vesselType: "tanker",
    typeLabel: "Product Tanker",
    position: [70.95, 19.55],
    heading: 155,
    course: 155,
    speedKnots: 4.2,
    navStatus: "AIS Blackout",
    destination: "UNREPORTED",
    eta: "UNKNOWN",
    lastSeen: "22h ago (08:00:00 UTC)",
    lengthMeters: 180,
    beamMeters: 30,
    draughtMeters: 9.2,
    isCandidate: true,
    suspicionLevel: "high",
    isDarkVessel: true,
    blackoutDurationHours: 22,
    riskScore: "89 / 100 (HIGH)",
    suspiciousReason: "AIS gap exceeds 6h threshold (22h total blackout) coinciding with backtracked drift corridor origin.",
    threatTag: "CORRIDOR ORIGIN · 22h BLACKOUT",
    minZoom: 0,
    trajectory: [
      [70.70, 19.85],
      [70.82, 19.72],
      [70.90, 19.62],
      [70.95, 19.55],
    ],
  },
  {
    id: "cand-005",
    name: "MT Al-Farabi Voyager",
    mmsi: "352009841",
    callsign: "3ERA9",
    flag: "Panama",
    vesselType: "tanker",
    typeLabel: "Oil/Chemical Tanker",
    position: [71.50, 19.50],
    heading: 140,
    course: 138,
    speedKnots: 11.8,
    navStatus: "Underway using Engine",
    destination: "COLOMBO (LKCMB)",
    eta: "2026-05-17 08:00 UTC",
    lastSeen: "05:58:30 UTC",
    lengthMeters: 183,
    beamMeters: 32,
    draughtMeters: 10.2,
    isCandidate: true,
    suspicionLevel: "moderate",
    suspiciousReason: "Moderate correlation: Transited outer corridor boundary at T-10h with normal speed profile",
    threatTag: "MODERATE PROXIMITY (0.540)",
    minZoom: 0,
    trajectory: [
      [71.15, 19.85],
      [71.28, 19.72],
      [71.40, 19.60],
      [71.50, 19.50],
    ],
  },
  {
    id: "cand-006",
    name: "CONTAINER_EXPRESS",
    mmsi: "419000202",
    callsign: "VTCP",
    flag: "Panama",
    vesselType: "container",
    typeLabel: "Container Carrier (Post-Panamax)",
    position: [72.80, 18.40],
    heading: 85,
    course: 85,
    speedKnots: 18.7,
    navStatus: "Underway using Engine",
    destination: "MUNDRA PORT",
    eta: "2026-05-15 19:00 UTC",
    lastSeen: "06:00:00 UTC",
    lengthMeters: 300,
    beamMeters: 45,
    draughtMeters: 13.2,
    isCandidate: true,
    suspicionLevel: "low",
    suspiciousReason: "Cleared candidate: Transited south of corridor at high continuous transit speed (18.7 kn)",
    threatTag: "CLEARED CANDIDATE (0.184)",
    minZoom: 0,
    trajectory: [
      [70.60, 18.30],
      [71.30, 18.33],
      [71.90, 18.36],
      [72.40, 18.38],
      [72.80, 18.40],
    ],
  },
];

// ─── Generator ───────────────────────────────────────────────────────────────

let _swarm: SwarmVessel[] | null = null;

export function generateSwarmVessels(): SwarmVessel[] {
  if (_swarm) return _swarm;

  const rand = createSeededRandom(42); // Fixed seed → deterministic swarm
  const vessels: SwarmVessel[] = [];
  let idCounter = 0;

  const allClusters = [...CLUSTERS, ...DETAIL_CLUSTERS];

  for (const cluster of allClusters) {
    for (let i = 0; i < cluster.count; i++) {
      // Box-Muller for realistic Gaussian cluster distribution
      const u = Math.max(1e-6, rand());
      const v = rand();
      const z1 = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      const z2 = Math.sqrt(-2 * Math.log(u)) * Math.sin(2 * Math.PI * v);

      const lng = cluster.centerLng + z1 * cluster.spreadLng;
      const lat = cluster.centerLat + z2 * cluster.spreadLat;

      // Clamp to Arabian Sea / Mumbai region
      const clampedLng = Math.max(70.0, Math.min(74.0, lng));
      const clampedLat = Math.max(17.0, Math.min(22.0, lat));

      // Deterministic metadata generation
      const flagInfo = FLAGS_BY_PREFIX[Math.floor(rand() * FLAGS_BY_PREFIX.length)]!;
      const mmsiSuffix = String(Math.floor(100000 + rand() * 900000));
      const mmsi = `${flagInfo.prefix}${mmsiSuffix}`;
      const callsign = `9V${String(Math.floor(1000 + rand() * 9000))}`;

      let name = "";
      if (cluster.type === "tanker") {
        name = TANKER_NAMES[(idCounter + i) % TANKER_NAMES.length]!;
      } else if (cluster.type === "container") {
        name = CONTAINER_NAMES[(idCounter + i) % CONTAINER_NAMES.length]!;
      } else if (cluster.type === "bulk") {
        name = BULK_NAMES[(idCounter + i) % BULK_NAMES.length]!;
      } else {
        name = MISC_NAMES[(idCounter + i) % MISC_NAMES.length]!;
      }

      if (idCounter > 20) {
        name = `${name} ${String((idCounter % 50) + 1).padStart(2, "0")}`;
      }

      const speedKnots = Number(
        (cluster.speedRange[0] + rand() * (cluster.speedRange[1] - cluster.speedRange[0])).toFixed(1)
      );

      const headingOffset = (rand() - 0.5) * 16;
      const heading = Math.round((cluster.defaultCog + headingOffset + 360) % 360);
      const course = Math.round((heading + (rand() - 0.5) * 4 + 360) % 360);

      const navStatus =
        speedKnots < 1.0
          ? "At Anchor"
          : NAV_STATUSES[Math.floor(rand() * NAV_STATUSES.length)]!;

      const destination = DESTINATIONS[Math.floor(rand() * DESTINATIONS.length)]!;
      const lastSeenMins = Math.floor(rand() * 12);
      const lastSeenSecs = Math.floor(rand() * 59);
      const lastSeen = `06:${String(lastSeenMins).padStart(2, "0")}:${String(lastSeenSecs).padStart(2, "0")} UTC`;

      const lengthMeters =
        cluster.type === "container"
          ? Math.round(220 + rand() * 140)
          : cluster.type === "tanker"
          ? Math.round(180 + rand() * 120)
          : cluster.type === "bulk"
          ? Math.round(160 + rand() * 100)
          : Math.round(45 + rand() * 60);

      const beamMeters = Math.round(lengthMeters * (0.14 + rand() * 0.04));
      const draughtMeters = Number((6.0 + rand() * 9.5).toFixed(1));

      // Generate realistic 4-point backward trajectory aligned with heading
      const backRad = ((heading + 180) % 360) * (Math.PI / 180);
      const cosLat = Math.cos((clampedLat * Math.PI) / 180) || 1;
      const stepLng = (Math.sin(backRad) / cosLat) * 0.08 * (speedKnots / 14);
      const stepLat = Math.cos(backRad) * 0.08 * (speedKnots / 14);

      const trajectory: [number, number][] = [
        [Number((clampedLng + stepLng * 3).toFixed(4)), Number((clampedLat + stepLat * 3).toFixed(4))],
        [Number((clampedLng + stepLng * 2).toFixed(4)), Number((clampedLat + stepLat * 2).toFixed(4))],
        [Number((clampedLng + stepLng * 1).toFixed(4)), Number((clampedLat + stepLat * 1).toFixed(4))],
        [clampedLng, clampedLat],
      ];

      const minZoom = cluster.baseMinZoom ?? 0;

      vessels.push({
        id: `swarm-${String(++idCounter).padStart(3, "0")}`,
        name,
        mmsi,
        callsign,
        flag: flagInfo.flag,
        vesselType: cluster.type,
        typeLabel: cluster.typeLabel,
        position: [clampedLng, clampedLat],
        heading,
        course,
        speedKnots,
        navStatus,
        destination,
        eta: "2026-05-15 16:00 UTC",
        lastSeen,
        lengthMeters,
        beamMeters,
        draughtMeters,
        trajectory,
        isCandidate: false,
        suspicionLevel: "none",
        minZoom,
      });
    }
  }

  // Always append the candidate & dark vessels
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

/** Returns all dark / suspicious vessels */
export function getDarkVessels(): SwarmVessel[] {
  return generateSwarmVessels().filter((v) => v.isDarkVessel || v.suspicionLevel === "high");
}

/** Color for a swarm vessel in the scatter layer */
export function swarmVesselColor(
  v: SwarmVessel,
  phase: "swarm" | "backtrack" = "swarm"
): [number, number, number, number] {
  if (v.isDarkVessel) {
    return [239, 68, 68, 245]; // Bright red
  }

  if (phase === "swarm") {
    return [34, 211, 238, 175];
  }

  // Backtrack phase
  if (!v.isCandidate) {
    return [90, 122, 148, 45]; // ghost grey
  }

  switch (v.suspicionLevel) {
    case "high":
      return [239, 68, 68, 255]; // red
    case "moderate":
      return [245, 158, 11, 220]; // amber
    case "low":
      return [100, 148, 190, 190]; // muted blue
    default:
      return [34, 211, 238, 175];
  }
}

export const SWARM_TOTAL =
  CLUSTERS.reduce((sum, c) => sum + c.count, 0) + CANDIDATE_VESSELS.length;
