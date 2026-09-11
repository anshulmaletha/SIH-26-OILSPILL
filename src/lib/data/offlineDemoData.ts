/**
 * SIH 26143 — Offline Demo Data & Pre-Cached Scenarios
 *
 * Dedicated zero-dependency offline datasets for SIH live evaluation and demo reliability.
 * Supports both:
 * 1. Scenario 1: Active Oil Spill Incident with Ranked Suspects & Dark Vessel Anomaly
 * 2. Scenario 2: Uncorrelated Drift / No Candidate Identified (Null-Result Scenario)
 */

import type { P1Output } from "../contracts/p1";
import type { P3Output } from "../contracts/p3";
import type { P4Output } from "../contracts/p4";
import type { P5Output } from "../contracts/p5";
import { DEFAULT_P1_DATA } from "../adapters/p1Adapter";
import { DEFAULT_P3_DATA, NO_CANDIDATES_P3_DATA } from "../adapters/p3Adapter";
import { DEFAULT_P4_DATA } from "../adapters/p4Adapter";
import { DEFAULT_P5_DATA, EMPTY_P5_DATA } from "../adapters/p5Adapter";

export interface MetoceanConditions {
  windSpeedKnots: number;
  windDirectionDegrees: number;
  currentSpeedKnots: number;
  currentDirectionDegrees: number;
  seaSurfaceTemperatureC: number;
  waveHeightMeters: number;
}

export interface IncidentScenario {
  id: string;
  name: string;
  sector: string;
  description: string;
  p1Data: P1Output;
  p3Data: P3Output;
  p4Data: P4Output;
  p5Data: P5Output;
  metocean: MetoceanConditions;
  isNoCandidateScenario: boolean;
}

export const OFFLINE_SCENARIOS: Record<string, IncidentScenario> = {
  active: {
    id: "INC-2026-MUM-001",
    name: "Mumbai Offshore Corridor Incident (Active Suspects)",
    sector: "Arabian Sea — Mumbai Offshore Corridor (71.85°E, 19.35°N)",
    description:
      "Active heavy crude oil slick identified via Sentinel-1A SAR radar (scene S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI). OpenDrift backtracking reconstructed 12h dispersion corridor. 2 candidate AIS tracks correlated plus 1 SAR-only dark vessel, identifying 1 primary polluter (IND_TANKER_412, score 65.7%) and 1 unregistered dark vessel (CFAR_DARK_002).",
    p1Data: DEFAULT_P1_DATA,
    p3Data: DEFAULT_P3_DATA,
    p4Data: DEFAULT_P4_DATA,
    p5Data: DEFAULT_P5_DATA,
    metocean: {
      windSpeedKnots: 12.4,
      windDirectionDegrees: 245,
      currentSpeedKnots: 1.8,
      currentDirectionDegrees: 135,
      seaSurfaceTemperatureC: 28.6,
      waveHeightMeters: 1.1,
    },
    isNoCandidateScenario: false,
  },
  rejected_lookalike: {
    id: "INC-2026-MUM-LOOKALIKE",
    name: "Arabian Sea Calm Patch (Look-Alike Discarded)",
    sector: "Arabian Sea — Mumbai Offshore (72.62°E, 18.60°N)",
    description:
      "Low-wind calm patch identified by initial SAR sweep. Look-Alike Discriminator evaluates physical gates (wind speed 1.4 m/s < 2.0 m/s threshold, damping ratio 0.35 < 0.50) and correctly rejects the candidate as biogenic surfactant / natural calm sea.",
    p1Data: {
      ...DEFAULT_P1_DATA,
      slicks: [
        {
          id: "lookalike_poly_mumbai_002",
          sceneId: "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI",
          detectionTime: "2026-05-15T06:00:00Z",
          confidence: 0.32,
          areaKm2: 8.5,
          thicknessCategory: "biogenic_sheen",
          centroid: [72.62, 18.60],
          coordinates: [
            [72.600, 18.600],
            [72.610, 18.615],
            [72.625, 18.620],
            [72.640, 18.615],
            [72.645, 18.600],
            [72.635, 18.585],
            [72.620, 18.582],
            [72.605, 18.588],
            [72.600, 18.600],
          ],
          boundingExtent: [72.600, 18.582, 72.645, 18.620],
        },
      ],
      modelConfidence: 0.32,
    },
    p3Data: NO_CANDIDATES_P3_DATA,
    p4Data: DEFAULT_P4_DATA,
    p5Data: EMPTY_P5_DATA,
    metocean: {
      windSpeedKnots: 2.7,
      windDirectionDegrees: 245,
      currentSpeedKnots: 1.1,
      currentDirectionDegrees: 135,
      seaSurfaceTemperatureC: 28.6,
      waveHeightMeters: 0.4,
    },
    isNoCandidateScenario: true,
  },
  no_candidates: {
    id: "INC-2026-MUM-002",
    name: "Arabian Sea Sector (Null-Result / No Candidate Identified)",
    sector: "Arabian Sea South Sector (71.00°E, 18.50°N)",
    description:
      "Confirmed slick segmentation and OpenDrift backtracking completed. Sector AIS queries show all active shipping remained >14.8 nm clear of the dispersion corridor. Successfully demonstrating the null-result investigation pipeline.",
    p1Data: {
      ...DEFAULT_P1_DATA,
    },
    p3Data: NO_CANDIDATES_P3_DATA,
    p4Data: DEFAULT_P4_DATA,
    p5Data: EMPTY_P5_DATA,
    metocean: {
      windSpeedKnots: 11.5,
      windDirectionDegrees: 230,
      currentSpeedKnots: 1.4,
      currentDirectionDegrees: 120,
      seaSurfaceTemperatureC: 28.1,
      waveHeightMeters: 0.9,
    },
    isNoCandidateScenario: true,
  },
};

/**
 * Retrieves the pre-cached offline scenario payload by key.
 * Guarantees zero runtime external network calls.
 */
export function getOfflineScenario(scenarioId: "active" | "rejected_lookalike" | "no_candidates" = "active"): IncidentScenario {
  return OFFLINE_SCENARIOS[scenarioId] ?? OFFLINE_SCENARIOS["active"]!;
}
