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
    id: "INC-2026-SIN-001",
    name: "Singapore Strait TSS Incident (Active Suspects)",
    sector: "Singapore Strait Traffic Separation Scheme (103.85°E, 1.18°N)",
    description:
      "Active heavy crude oil slick identified via Sentinel-1A SAR radar. OpenDrift backtracking reconstructed 24h dispersion corridor. 3 candidate AIS tracks correlated, identifying 1 primary polluter and 1 dark vessel transponder anomaly.",
    p1Data: DEFAULT_P1_DATA,
    p3Data: DEFAULT_P3_DATA,
    p4Data: DEFAULT_P4_DATA,
    p5Data: DEFAULT_P5_DATA,
    metocean: {
      windSpeedKnots: 14.2,
      windDirectionDegrees: 245,
      currentSpeedKnots: 1.8,
      currentDirectionDegrees: 68,
      seaSurfaceTemperatureC: 29.4,
      waveHeightMeters: 0.9,
    },
    isNoCandidateScenario: false,
  },
  no_candidates: {
    id: "INC-2026-MALACCA-002",
    name: "Malacca South Corridor (Null-Result / No Candidate Identified)",
    sector: "Malacca Strait South Sector (103.45°E, 1.25°N)",
    description:
      "Confirmed slick segmentation and OpenDrift backtracking completed. Sector AIS queries show all active shipping remained >14.8 nm clear of the dispersion corridor. Successfully demonstrating the null-result investigation pipeline.",
    p1Data: {
      ...DEFAULT_P1_DATA,
      incidentId: "INC-2026-MALACCA-002",
    },
    p3Data: NO_CANDIDATES_P3_DATA,
    p4Data: DEFAULT_P4_DATA,
    p5Data: EMPTY_P5_DATA,
    metocean: {
      windSpeedKnots: 11.5,
      windDirectionDegrees: 230,
      currentSpeedKnots: 1.4,
      currentDirectionDegrees: 75,
      seaSurfaceTemperatureC: 29.1,
      waveHeightMeters: 0.7,
    },
    isNoCandidateScenario: true,
  },
};

/**
 * Retrieves the pre-cached offline scenario payload by key.
 * Guarantees zero runtime external network calls.
 */
export function getOfflineScenario(scenarioId: "active" | "no_candidates" = "active"): IncidentScenario {
  return OFFLINE_SCENARIOS[scenarioId] || OFFLINE_SCENARIOS.active;
}
