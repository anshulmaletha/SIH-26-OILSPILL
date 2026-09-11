/**
 * SIH 26143 — Telemetry Log Generator
 *
 * Real, stage-keyed technical execution logs reflecting actual pipeline components:
 * - PyTorch U-Net baseline on Sentinel-1 SAR imagery (models/best_unet_baseline.pt)
 * - 3-gate physical look-alike filter (lookalike_filter.py)
 * - OpenDrift Lagrangian advection with ERA5 winds (run_mumbai_demo.py)
 * - Standardized AIS spatiotemporal corridor matching (candidate_matcher.py)
 * - Explainable weighted linear attribution scoring (scoring_engine.py)
 * - OpenDrift forward drift advection (forward_drift_particles.json)
 * - Tamper-evident ReportLab legal PDF dossier with SHA-256 seal (case_file_exporter.py)
 */

import type { MissionStage } from "./missionState";

export interface TelemetryLine {
  /** Simulated mission-time offset key, shown as [HH:MM:SS] */
  offsetLabel: string;
  message: string;
  level: "info" | "ok" | "warn" | "crit" | "data";
}

// ─── Per-Stage Ground Truth Log Scripts ──────────────────────────────────────

export const TELEMETRY_SCRIPTS: Record<MissionStage, TelemetryLine[]> = {
  STANDBY: [
    { offsetLabel: "00:00:00", message: "SIH 2026 Maritime Oil Spill Attribution Platform — ONLINE", level: "info" },
    { offsetLabel: "00:00:01", message: "Geospatial engine ready. Uber H3 resolution 7 indexing online.", level: "info" },
  ],

  SAR_ACQUISITION: [
    { offsetLabel: "00:00:00", message: "SAR TASK INITIATED — Sentinel-1A IW GRDH pass ingested", level: "info" },
    { offsetLabel: "00:00:10", message: "Scene ID: S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI", level: "data" },
    { offsetLabel: "00:00:16", message: "Band: C-Band (5.405 GHz)  |  Polarization: VV  |  Resolution: 10m", level: "data" },
    { offsetLabel: "00:00:26", message: "Preprocessing: PyTorch Refined Lee speckle filter (5×5 kernel), dB [-35, 0]", level: "info" },
    { offsetLabel: "00:00:38", message: "Segmentation inference: PyTorch U-Net baseline (models/best_unet_baseline.pt)", level: "info" },
    { offsetLabel: "00:00:48", message: "▶ Anomaly DETECTED at Centroid [19.350°N, 71.853°E]  σ°=-18.6 dB", level: "crit" },
    { offsetLabel: "00:00:56", message: "Slick polygon vectorized: Area 4.82 km²  |  Perimeter 14.8 km  |  Confidence: 0.94", level: "ok" },
    { offsetLabel: "00:01:04", message: "Alert: Confirmed crude petroleum slick detected in Mumbai offshore sector", level: "crit" },
  ],

  VALIDATION_AUDIT: [
    { offsetLabel: "00:00:00", message: "LOOKALIKE FILTER — 3-gate physical discrimination audit (lookalike_filter.py)", level: "info" },
    { offsetLabel: "00:00:08", message: "Atmospheric forcing: ECMWF ERA5 reanalysis surface wind slice loaded", level: "data" },
    { offsetLabel: "00:00:16", message: "Gate A [ERA5 Wind]: 3.8 m/s → PASS (within operational floor 2.0–12.0 m/s)", level: "ok" },
    { offsetLabel: "00:00:26", message: "Gate B [Radar Damping]: Damping ratio 3.82 dB → PASS (≥ 0.50 dB, rules out biogenic slick)", level: "ok" },
    { offsetLabel: "00:00:36", message: "Gate C [Geometry]: Eccentricity 0.88 → PASS (≥ 0.70, confirms elongated streak)", level: "ok" },
    { offsetLabel: "00:00:46", message: "Filter decision: Crude petroleum discharge CONFIRMED — false positive rejected", level: "ok" },
    { offsetLabel: "00:00:54", message: "Proceeding to Lagrangian backtrack corridor and AIS candidate matching", level: "info" },
  ],

  AIS_SWARM: [
    { offsetLabel: "00:00:00", message: "AIS CORRIDOR QUERY — Temporal window 2026-05-14T06:00Z to 2026-05-15T06:00Z (T-24h)", level: "info" },
    { offsetLabel: "00:00:06", message: "Geographic bounds: 70.5°E–73.0°E, 18.0°N–20.5°N (Mumbai High offshore sector)", level: "info" },
    { offsetLabel: "00:00:14", message: "Ingesting standardized AIS records (standardized_ais_indexed.csv)…", level: "data" },
    { offsetLabel: "00:00:22", message: "Indexed 578 vessel broadcast records across 289 discrete 5-minute sampling epochs", level: "data" },
    { offsetLabel: "00:00:32", message: "Spatial-temporal discretization: Uber H3 Resolution 7 hexagonal indexing", level: "info" },
    { offsetLabel: "00:00:42", message: "Corridor density: Ingested maritime traffic telemetry with historical waypoints", level: "data" },
    { offsetLabel: "00:00:50", message: "Traffic indexed. Ready for backward trajectory set-intersection matching", level: "ok" },
  ],

  BACKTRACK_CORRIDOR: [
    { offsetLabel: "00:00:00", message: "OPENDRIFT BACKTRACK — 500 particles initialized at slick centroid [19.350°N, 71.853°E]", level: "info" },
    { offsetLabel: "00:00:08", message: "ERA5 surface winds loaded: u10/v10 vectors ~3.8 m/s (3% wind drift factor)", level: "data" },
    { offsetLabel: "00:00:16", message: "Hydrodynamic currents: 0.0 m/s fallback calm velocity (offline temporal boundary)", level: "data" },
    { offsetLabel: "00:00:24", message: "Backward advection: T=0h → T=-6h → T=-12h → T=-24h (-900s timesteps)", level: "info" },
    { offsetLabel: "00:00:32", message: "H3 Res-7 hex binning (h3_corridor_output.json): Spatiotemporal corridor mapped", level: "info" },
    { offsetLabel: "00:00:40", message: "Corridor set-intersection test with bounded k-ring expansion (decay 1/(1+k))", level: "info" },
    { offsetLabel: "00:00:48", message: "Vessel cleared: CONTAINER_EXPRESS outside origin corridor (steady 18.5 kn transit)", level: "ok" },
    { offsetLabel: "00:00:56", message: "Corridor match: IND_TANKER_412 intersects origin hexes at T-6h and T-12h", level: "warn" },
    { offsetLabel: "00:01:04", message: "SAR CFAR match: Contact CFAR_DARK_002 at [19.28°N, 71.90°E] — zero AIS broadcast", level: "crit" },
    { offsetLabel: "00:01:12", message: "AIS anomaly: MMSI 419000101 has 3.4h (204 min) blackout over origin corridor", level: "warn" },
  ],

  CULPRIT_LOCK: [
    { offsetLabel: "00:00:00", message: "ATTRIBUTION SCORING — Explainable Weighted Linear Model (scoring_engine.py)", level: "info" },
    { offsetLabel: "00:00:06", message: "Evaluating candidate: IND_TANKER_412 (MMSI: 419000101, Flag: India, Tanker)", level: "info" },
    { offsetLabel: "00:00:12", message: "  w1 · S_corr (H3 corridor overlap, k-ring 6/8):  14.3% (weight 0.40)", level: "data" },
    { offsetLabel: "00:00:18", message: "  w2 · S_head (Heading alignment with slick axis 135°): 100.0% (weight 0.25)", level: "data" },
    { offsetLabel: "00:00:24", message: "  w3 · S_speed (Speed drop 14.2 → 3.8 kts over origin): 100.0% (weight 0.20)", level: "data" },
    { offsetLabel: "00:00:30", message: "  w4 · S_gap (AIS blackout 3.4h over origin):        100.0% (weight 0.15)", level: "warn" },
    { offsetLabel: "00:00:38", message: "  TOTAL ATTRIBUTION SCORE: 65.72 / 100 (Normalized: 0.6572)", level: "data" },
    { offsetLabel: "00:00:46", message: "▶ PRIMARY CULPRIT: MT IND_TANKER_412 — IMO: 9384124", level: "crit" },
    { offsetLabel: "00:00:54", message: "Legal referral: Directorate General of Shipping / Indian Coast Guard", level: "crit" },
  ],

  CONTAINMENT_ROOM: [
    { offsetLabel: "00:00:00", message: "FORWARD DRIFT SIMULATION — OpenDrift forward trajectory (forward_drift_particles.json)", level: "info" },
    { offsetLabel: "00:00:06", message: "500 particles seeded at detected slick centroid [19.350°N, 71.853°E]", level: "info" },
    { offsetLabel: "00:00:14", message: "Atmospheric advection: ERA5 surface winds driving eastward drift toward Mumbai", level: "data" },
    { offsetLabel: "00:00:22", message: "Checkpoint T+6h:  Centroid [19.340°N, 71.881°E]  |  Area: 5.4 km²", level: "data" },
    { offsetLabel: "00:00:30", message: "Checkpoint T+12h: Centroid [19.336°N, 71.917°E]  |  Area: 6.8 km²", level: "data" },
    { offsetLabel: "00:00:38", message: "Checkpoint T+18h: Centroid [19.323°N, 71.949°E]  |  Area: 8.5 km²", level: "data" },
    { offsetLabel: "00:00:46", message: "Checkpoint T+24h: Centroid [19.324°N, 71.950°E]  |  Area: 10.2 km²", level: "data" },
    { offsetLabel: "00:00:54", message: "Operational dispatch assessment: Est. coastal distance ~45 km ESE, drift ~0.45 km/h", level: "ok" },
  ],

  CASE_FILE: [
    { offsetLabel: "00:00:00", message: "FORENSIC DOSSIER GENERATION — Case ID: INC-2026-MUM-001 (case_file_exporter.py)", level: "info" },
    { offsetLabel: "00:00:06", message: "Compiling SAR detection geometry, physical filter gates, and OpenDrift corridor", level: "info" },
    { offsetLabel: "00:00:12", message: "Embedding AIS gap record: MMSI 419000101 | 2026-05-14T18:30Z–21:54Z (3.4h)", level: "data" },
    { offsetLabel: "00:00:18", message: "Attribution evidence matrix compiled: 4 weighted factors, total score 65.72%", level: "data" },
    { offsetLabel: "00:00:26", message: "Legal jurisdiction: IMO MARPOL 73/78 Annex I — Arabian Sea PSSA", level: "data" },
    { offsetLabel: "00:00:34", message: "SHA-256 seal: d9845cb3f0907f9cbb87a6f2bbdd9cf629bb4e015d8f6d89e5bb3057e9fe5757", level: "ok" },
    { offsetLabel: "00:00:42", message: "Dossier ready: 3-page tamper-evident ReportLab PDF (case_file_report.pdf)", level: "ok" },
    { offsetLabel: "00:00:50", message: "✓ CASE FILE FINALIZED — Available for Indian Coast Guard evidentiary submission", level: "ok" },
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
