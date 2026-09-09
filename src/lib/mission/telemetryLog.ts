/**
 * SIH 26143 — Telemetry Log Generator
 *
 * Pre-scripted, stage-keyed log lines that feed the typewriter terminal.
 * Timestamps are aligned to the Mumbai offshore corridor incident
 * (INC-2026-MUM-001, acquisition time 2026-05-15T06:00:00Z).
 */

import type { MissionStage } from "./missionState";

export interface TelemetryLine {
  /** Simulated mission-time offset key, shown as [HH:MM:SS] */
  offsetLabel: string;
  message: string;
  level: "info" | "ok" | "warn" | "crit" | "data";
}

// ─── Per-Stage Log Scripts ────────────────────────────────────────────────────

export const TELEMETRY_SCRIPTS: Record<MissionStage, TelemetryLine[]> = {
  STANDBY: [
    { offsetLabel: "00:00:00", message: "SIH 26143 Maritime Intelligence Platform — ONLINE", level: "info" },
    { offsetLabel: "00:00:01", message: "Operator console initialized. Awaiting mission start.", level: "info" },
  ],

  SAR_ACQUISITION: [
    { offsetLabel: "00:00:00", message: "SAR TASK INITIATED — Sentinel-1A IW GRDH pass acquired", level: "info" },
    { offsetLabel: "00:00:12", message: "Scene ID: S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI", level: "data" },
    { offsetLabel: "00:00:18", message: "Polarization: VV  |  Resolution: 10m  |  Swath: 250km", level: "data" },
    { offsetLabel: "00:00:31", message: "Loading NetCDF backscatter tile [71.8°E–71.9°E, 19.3°N–19.4°N]…", level: "info" },
    { offsetLabel: "00:00:44", message: "Speckle filter applied: Lee 5×5 kernel", level: "info" },
    { offsetLabel: "00:00:55", message: "UNet++ segmentation inference — batch size 1 — RUNNING", level: "info" },
    { offsetLabel: "00:01:08", message: "▶ Anomaly DETECTED  Lat 19.35°N  Lon 71.85°E  σ°=-18.6dB", level: "crit" },
    { offsetLabel: "00:01:14", message: "Slick polygon vectorized: 4.82 km²  confidence: 0.94", level: "ok" },
    { offsetLabel: "00:01:20", message: "Alert: CRUDE PETROLEUM SLICK — Area 14.2 km² (multi-polygon)", level: "crit" },
  ],

  VALIDATION_AUDIT: [
    { offsetLabel: "00:00:00", message: "LOOKALIKE FILTER — Phase 1 discrimination audit started", level: "info" },
    { offsetLabel: "00:00:08", message: "Loading ERA5 NetCDF: U10=3.2 m/s  V10=5.8 m/s  |  resultant=6.6 m/s", level: "data" },
    { offsetLabel: "00:00:15", message: "Check [1/3] Wind speed 6.6 m/s > 3.0 m/s calm threshold → PASS (rules out calm-water slick)", level: "ok" },
    { offsetLabel: "00:00:24", message: "Loading MODIS OC4 chlorophyll-a raster…", level: "info" },
    { offsetLabel: "00:00:31", message: "Check [2/3] Chlorophyll-a index: 0.21 mg/m³ (NEGATIVE) → PASS (rules out biogenic surfactant)", level: "ok" },
    { offsetLabel: "00:00:42", message: "Loading GEBCO bathymetry: depth 62m  |  internal wave check…", level: "info" },
    { offsetLabel: "00:00:50", message: "Check [3/3] Bathymetric reflection: NEGATIVE → PASS (rules out natural false positive)", level: "ok" },
    { offsetLabel: "00:00:58", message: "Discrimination model score: 94.8%", level: "data" },
    { offsetLabel: "00:01:04", message: "✓ STATUS CONFIRMED: CRUDE PETROLEUM SLICK — proceeding to AIS attribution", level: "ok" },
  ],

  AIS_SWARM: [
    { offsetLabel: "00:00:00", message: "AIS CORRIDOR QUERY — temporal window T-24h to T=0h", level: "info" },
    { offsetLabel: "00:00:06", message: "Querying LRIT + MarineTraffic AIS archive: 71.5°E–73.5°E, 18.0°N–21.0°N", level: "info" },
    { offsetLabel: "00:00:12", message: "Ingesting vessel pings… 100 active vessels", level: "data" },
    { offsetLabel: "00:00:18", message: "Ingesting vessel pings… 200 active vessels", level: "data" },
    { offsetLabel: "00:00:24", message: "Ingesting vessel pings… 312 active vessels", level: "data" },
    { offsetLabel: "00:00:30", message: "Ingesting vessel pings… 412 active vessels", level: "data" },
    { offsetLabel: "00:00:36", message: "MARITIME TRAFFIC INGESTED: 412 vessels in temporal corridor", level: "info" },
    { offsetLabel: "00:00:42", message: "Vessel types: 127 tankers, 98 bulk carriers, 84 containers, 103 mixed", level: "data" },
    { offsetLabel: "00:00:50", message: "Initiating H3 spatial-temporal indexing at resolution 7…", level: "info" },
  ],

  BACKTRACK_CORRIDOR: [
    { offsetLabel: "00:00:00", message: "OPENDRIFT BACKTRACK — initializing particles at slick centroid [71.85°E, 19.35°N]", level: "info" },
    { offsetLabel: "00:00:08", message: "HYCOM ocean currents loaded: U=0.28 m/s (135°)  V=0.14 m/s", level: "data" },
    { offsetLabel: "00:00:14", message: "ERA5 wind stress: 10m wind 6.6 m/s (SW 245°) → drift factor 3%", level: "data" },
    { offsetLabel: "00:00:22", message: "Backward particle advection: T=0h → T=-6h  corridor: [71.65°E, 19.45°N]", level: "info" },
    { offsetLabel: "00:00:30", message: "Backward particle advection: T=-6h → T=-12h  corridor: [71.2°E, 19.65°N]", level: "info" },
    { offsetLabel: "00:00:38", message: "H3 hexagon indexing: 412 vessels evaluated", level: "info" },
    { offsetLabel: "00:00:45", message: "Corridor intersection test: 407 vessels CLEARED (outside H3 corridor)", level: "ok" },
    { offsetLabel: "00:00:52", message: "5 candidate vessels intersect backtrack corridor — highlighting", level: "warn" },
    { offsetLabel: "00:01:00", message: "DARK VESSEL: SAR CFAR detection CFAR_DARK_002 at [71.9°E, 19.28°N] — no AIS", level: "crit" },
    { offsetLabel: "00:01:08", message: "AIS gap detected: MMSI 419000101 — 3.4h blackout over origin corridor", level: "warn" },
  ],

  CULPRIT_LOCK: [
    { offsetLabel: "00:00:00", message: "ATTRIBUTION SCORING — XGBoost Ensemble v2.4 initialized", level: "info" },
    { offsetLabel: "00:00:06", message: "Evaluating IND_TANKER_412 (MMSI: 419000101, Aframax crude carrier)…", level: "info" },
    { offsetLabel: "00:00:12", message: "  S_time (temporal proximity):         0.9444  →  94.4%", level: "data" },
    { offsetLabel: "00:00:18", message: "  S_dist (corridor geometric overlap):  1.0000  →  100.0%", level: "data" },
    { offsetLabel: "00:00:24", message: "  S_type (vessel profile — crude):      0.9500  →  95.0%", level: "data" },
    { offsetLabel: "00:00:30", message: "  P_dark (AIS gap 3.4h over origin):   +0.25   →  +25% suspicion", level: "warn" },
    { offsetLabel: "00:00:36", message: "  Speed anomaly T-9h: 14.2 kts → 3.8 kts at [71.2°E, 19.65°N]", level: "warn" },
    { offsetLabel: "00:00:44", message: "  FINAL SCORE: 0.912  (91.2%)  confidence: 0.95", level: "data" },
    { offsetLabel: "00:00:52", message: "▶ CULPRIT IDENTIFIED: MT IND_TANKER_412 — IMO: 9384124", level: "crit" },
    { offsetLabel: "00:01:00", message: "Recommendation: Coast Guard intercept at Nhava Sheva anchorage", level: "crit" },
  ],

  CONTAINMENT_ROOM: [
    { offsetLabel: "00:00:00", message: "INCIDENT RESPONSE — containment operations panel OPEN", level: "info" },
    { offsetLabel: "00:00:06", message: "Forward drift initialized: T+0h → T+48h  particles: 5000", level: "info" },
    { offsetLabel: "00:00:14", message: "T+6h  projected centroid: [72.05°E, 19.18°N]  area: 18.4 km²", level: "data" },
    { offsetLabel: "00:00:22", message: "T+12h projected centroid: [72.22°E, 19.05°N]  area: 28.1 km²", level: "data" },
    { offsetLabel: "00:00:30", message: "WARNING: Mangrove zone impact in T+31h — deploy booms NOW", level: "warn" },
    { offsetLabel: "00:00:38", message: "Boom barriers: Sector A (Dharamtar inlet) — RECOMMENDED", level: "info" },
    { offsetLabel: "00:00:46", message: "Skimmer deployment zones calculated: 3 recovery sites", level: "info" },
    { offsetLabel: "00:00:54", message: "Containment efficiency estimate: 67% at T+24h with boom deployment", level: "data" },
  ],

  CASE_FILE: [
    { offsetLabel: "00:00:00", message: "FORENSIC DOSSIER GENERATION — case ID: INC-2026-MUM-001", level: "info" },
    { offsetLabel: "00:00:06", message: "Compiling satellite imagery mosaic (3 scenes, 4 bands)…", level: "info" },
    { offsetLabel: "00:00:12", message: "Appending AIS gap record: MMSI 419000101 | 2026-05-14T18:30Z–21:54Z", level: "data" },
    { offsetLabel: "00:00:18", message: "Embedding drift simulation plots (backward + forward)…", level: "info" },
    { offsetLabel: "00:00:24", message: "Attribution evidence matrix compiled — 6 supporting factors", level: "data" },
    { offsetLabel: "00:00:30", message: "Legal jurisdiction: IMO MARPOL 73/78 Annex I — Arabian Sea PSSA", level: "data" },
    { offsetLabel: "00:00:38", message: "SHA-256 hash computed: a7f3c9e2b14d…  (evidence integrity seal)", level: "ok" },
    { offsetLabel: "00:00:44", message: "Case file ready for download — forward to Indian Coast Guard / DG Shipping", level: "ok" },
    { offsetLabel: "00:00:50", message: "✓ CASE FILE FINALIZED — INC-2026-MUM-001.pdf", level: "ok" },
  ],
};

// ─── Helper: get log lines visible at elapsed time ────────────────────────────

/**
 * Returns log lines that should be visible given elapsed milliseconds in the
 * current stage. Each line appears when its offsetLabel time (in seconds) has elapsed.
 */
export function getVisibleLogs(
  stage: MissionStage,
  elapsedMs: number
): TelemetryLine[] {
  const script = TELEMETRY_SCRIPTS[stage] ?? [];
  const elapsedSec = elapsedMs / 1000;

  return script.filter((line) => {
    const [h, m, s] = line.offsetLabel.split(":").map(Number);
    const lineSec = (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
    return elapsedSec >= lineSec;
  });
}

/** Color token per log level */
export function levelColor(level: TelemetryLine["level"]): string {
  switch (level) {
    case "ok":   return "#22D3EE";
    case "warn": return "#F59E0B";
    case "crit": return "#EF4444";
    case "data": return "#C8D8E8";
    default:     return "#5A7A94";
  }
}
