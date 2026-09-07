import type { P3Output, RankedSuspect } from "../contracts/p3";

/** Default fallback dataset for P3 suspect rankings */
export const DEFAULT_P3_DATA: P3Output = {
  incidentId: "INC-2026-SIN-001",
  generatedAt: "2026-09-02T06:30:00Z",
  totalSuspectsEvaluated: 3,
  algorithmVersion: "XGBoost-Ensemble-v2.4",
  suspects: [
    {
      rank: 1,
      vesselId: "mmsi-5630001",
      vesselName: "MV Meridian Star",
      mmsi: "5630001",
      vesselType: "Crude Oil Tanker",
      flag: "Panama",
      overallScore: 0.94,
      confidence: 0.92,
      isDarkVessel: false,
      isPrimarySuspect: true,
      recommendation: "CRITICAL PROBABILITY — Recommend port authority inspection at Singapore Anchorage",
      featureScores: {
        trajectoryIntersection: 0.96,
        temporalProximity: 0.92,
        speedAnomaly: 0.88,
        aisGapScore: 0.15,
      },
    },
    {
      rank: 2,
      vesselId: "mmsi-5630002",
      vesselName: "ST Aurora",
      mmsi: "5630002",
      vesselType: "Chemical Tanker",
      flag: "Singapore",
      overallScore: 0.68,
      confidence: 0.74,
      isDarkVessel: true,
      isPrimarySuspect: false,
      recommendation: "SECONDARY SUSPECT — Unexplained 7.2h AIS transponder gap coinciding with backtracked origin",
      featureScores: {
        trajectoryIntersection: 0.72,
        temporalProximity: 0.65,
        speedAnomaly: 0.45,
        aisGapScore: 0.89,
      },
    },
    {
      rank: 3,
      vesselId: "mmsi-5630003",
      vesselName: "Pacific Kestrel",
      mmsi: "5630003",
      vesselType: "Bulk Carrier",
      flag: "Liberia",
      overallScore: 0.18,
      confidence: 0.85,
      isDarkVessel: false,
      isPrimarySuspect: false,
      recommendation: "UNLIKELY — Peripheral transit outside high-density corridor core",
      featureScores: {
        trajectoryIntersection: 0.22,
        temporalProximity: 0.15,
        speedAnomaly: 0.12,
        aisGapScore: 0.05,
      },
    },
  ],
};

/** Empty scenario representation for "No Candidate Identified" */
export const NO_CANDIDATES_P3_DATA: P3Output = {
  incidentId: "INC-2026-MALACCA-002",
  generatedAt: "2026-09-02T06:30:00Z",
  totalSuspectsEvaluated: 0,
  algorithmVersion: "XGBoost-Ensemble-v2.4",
  suspects: [],
};

export function parseP3Payload(raw: unknown): P3Output {
  if (!raw || typeof raw !== "object") return DEFAULT_P3_DATA;
  const p3 = raw as Partial<P3Output>;
  if (!p3.suspects || !Array.isArray(p3.suspects)) return DEFAULT_P3_DATA;
  return p3 as P3Output;
}

export function getRankBadge(rank: number): { label: string; color: string; bg: string } {
  if (rank === 1) return { label: "#1 High Risk", color: "text-rose-400", bg: "bg-rose-500/15 border-rose-500/30" };
  if (rank === 2) return { label: "#2 Moderate", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" };
  return { label: `#${rank} Low Risk`, color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" };
}
