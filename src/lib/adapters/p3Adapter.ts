import type { P3Output, RankedSuspect } from "../contracts/p3";

/** Default fallback dataset for P3 suspect rankings */
export const DEFAULT_P3_DATA: P3Output = {
  incidentId: "INC-2026-MUM-001",
  generatedAt: "2026-05-15T06:30:00Z",
  totalSuspectsEvaluated: 2,
  algorithmVersion: "XGBoost-Ensemble-v2.4",
  suspects: [
    {
      rank: 1,
      vesselId: "mmsi-419000101",
      vesselName: "IND_TANKER_412",
      mmsi: "419000101",
      vesselType: "Crude Oil Tanker",
      flag: "India",
      // total_score: 98.33 from ranked_suspects.json → overallScore: 0.9833 (÷100)
      // case_file_output.json → ranked_suspects[0].total_score: 0.912 (normalized 0–1)
      // Using case_file_output.json value as authoritative (already normalized by scorer)
      overallScore: 0.912,
      confidence: 0.95,
      isDarkVessel: false,
      isPrimarySuspect: true,
      recommendation: "CRITICAL PROBABILITY — Recommend Indian Coast Guard inspection at Nhava Sheva anchorage. Speed anomaly of 3.8–4.3 kts at T-12h within backtracked corridor.",
      featureScores: {
        // From ranked_suspects.json → feature_breakdown (mapped: corridor_overlap→trajectoryIntersection, heading_alignment→temporalProximity, speed_anomaly→speedAnomaly, ais_gap_history→aisGapScore)
        trajectoryIntersection: 1.0,    // corridor_overlap_score: 1.0
        temporalProximity: 0.9444,      // heading_alignment_score: 0.9444
        speedAnomaly: 1.0,              // speed_anomaly_score: 1.0
        aisGapScore: 1.0,               // ais_gap_history_score: 1.0
      },
    },
    {
      rank: 2,
      vesselId: "dark-vessel-cfar-002",
      vesselName: "DARK VESSEL (SAR-only)",
      mmsi: "",
      vesselType: "Unknown (SAR-only CFAR detection)",
      flag: "Unknown",
      // No AIS → no scoring from ranked_suspects.json. Candidate by virtue of positional proximity.
      overallScore: 0.0,
      confidence: 0.0,
      isDarkVessel: true,
      isPrimarySuspect: false,
      recommendation: "UNIDENTIFIED VESSEL — SAR CFAR detection CFAR_DARK_002 at [71.9°E, 19.28°N]. No AIS transponder throughout 12h window. H3 cell 8742da462ffffff within dispersion corridor.",
      featureScores: {
        trajectoryIntersection: 0.0,
        temporalProximity: 0.0,
        speedAnomaly: 0.0,
        aisGapScore: 0.0,
      },
    },
    {
      rank: 3,
      vesselId: "mmsi-419000202",
      vesselName: "CONTAINER_EXPRESS",
      mmsi: "419000202",
      vesselType: "Container Ship",
      flag: "Panama",
      // case_file_output.json → ranked_suspects[1].total_score: 0.184 (already 0–1 normalized)
      overallScore: 0.184,
      confidence: 0.91,
      isDarkVessel: false,
      isPrimarySuspect: false,
      recommendation: "CLEARED — Transit speed 18–19 kts, COG 85° (perpendicular to spill corridor). No corridor intersection. Score 18.4%.",
      featureScores: {
        trajectoryIntersection: 0.12,
        temporalProximity: 0.08,
        speedAnomaly: 0.05,
        aisGapScore: 0.0,
      },
    },
  ],
};

/** Empty scenario representation for "No Candidate Identified" */
export const NO_CANDIDATES_P3_DATA: P3Output = {
  incidentId: "INC-2026-MUM-002",
  generatedAt: "2026-05-15T06:30:00Z",
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
