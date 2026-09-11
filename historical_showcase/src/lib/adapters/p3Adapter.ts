import type { P3Output, RankedSuspect } from "../contracts/p3";

/** Default fallback dataset for P3 suspect rankings */
export const DEFAULT_P3_DATA: P3Output = {
  incidentId: "INC-2026-MUM-001",
  generatedAt: "2026-05-15T06:30:00Z",
  totalSuspectsEvaluated: 2,
  algorithmVersion: "Weighted Rule-Based Attribution Model",
  suspects: [
    {
      rank: 1,
      vesselId: "mmsi-419000101",
      vesselName: "IND_TANKER_412",
      mmsi: "419000101",
      vesselType: "Crude Oil Tanker",
      flag: "India",
      overallScore: 0.6572,
      confidence: 0.88,
      isDarkVessel: false,
      isPrimarySuspect: true,
      recommendation: "HIGH PROBABILITY — Recommend Indian Coast Guard inspection at Nhava Sheva anchorage. Speed anomaly of 4.1 kts at discharge window with 3.4h AIS blackout.",
      featureScores: {
        trajectoryIntersection: 0.1429,
        temporalProximity: 0.9444,
        speedAnomaly: 1.0,
        aisGapScore: 1.0,
      },
    },
    {
      rank: 2,
      vesselId: "dark-vessel-cfar-002",
      vesselName: "DARK VESSEL (SAR CFAR_DARK_002)",
      mmsi: "",
      vesselType: "Unknown (SAR-only CFAR contact)",
      flag: "Unknown",
      overallScore: 0.0,
      confidence: 0.0,
      isDarkVessel: true,
      isPrimarySuspect: false,
      recommendation: "UNIDENTIFIED VESSEL — Radar contact CFAR_DARK_002 at [71.9°E, 19.28°N]. Zero AIS transponder activity.",
      featureScores: {
        trajectoryIntersection: 0.0,
        temporalProximity: 0.0,
        speedAnomaly: 0.0,
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
  algorithmVersion: "Weighted Rule-Based Attribution Model",
  suspects: [],
};

export function convertSuspectsResponseToP3(data: any): P3Output {
  if (!data || data.null_result || !Array.isArray(data.ranked_suspects) || data.ranked_suspects.length === 0) {
    return {
      ...NO_CANDIDATES_P3_DATA,
      algorithmVersion: data?.scoring_model || "Weighted Rule-Based Attribution Model",
    };
  }

  const suspects: RankedSuspect[] = data.ranked_suspects.map((s: any, idx: number) => {
    const fb = s.feature_breakdown || {};
    const normScore = s.normalized_score ?? (s.total_score ? s.total_score / 100 : 0);
    return {
      rank: s.rank ?? idx + 1,
      vesselId: s.vessel_id?.toLowerCase()?.replace("_", "-") || `vessel-${idx + 1}`,
      vesselName: s.vessel_name || `VESSEL_${idx + 1}`,
      mmsi: String(s.vessel_id || "").replace("MMSI_", ""),
      vesselType: s.vessel_type || "Commercial Vessel",
      flag: s.flag || "Unknown",
      overallScore: Number(normScore.toFixed(4)),
      confidence: Number((normScore * 0.95).toFixed(2)),
      isDarkVessel: false,
      isPrimarySuspect: idx === 0,
      recommendation: s.assessment || (idx === 0 ? "PRIMARY SUSPECT — Recommend maritime authority boarding and inspection." : "SECONDARY CONTACT"),
      featureScores: {
        trajectoryIntersection: fb.corridor_overlap_score ?? 0,
        temporalProximity: fb.heading_alignment_score ?? 0,
        speedAnomaly: fb.speed_anomaly_score ?? 0,
        aisGapScore: fb.ais_gap_history_score ?? 0,
      },
    };
  });

  // If dark vessels are present in response, add them to P3 suspects list
  if (Array.isArray(data.dark_vessels)) {
    data.dark_vessels.forEach((dv: any, idx: number) => {
      suspects.push({
        rank: suspects.length + 1,
        vesselId: dv.cfar_detection_id ? dv.cfar_detection_id.toLowerCase().replace("_", "-") : `dark-vessel-${idx + 1}`,
        vesselName: `DARK VESSEL (${dv.cfar_detection_id || "UNIDENTIFIED"})`,
        mmsi: "",
        vesselType: "Radar Contact (CFAR Detection)",
        flag: "Unknown",
        overallScore: 0.0,
        confidence: 0.0,
        isDarkVessel: true,
        isPrimarySuspect: false,
        recommendation: `SAR radar contact at [${dv.position?.coordinates?.[0] ?? 71.9}°E, ${dv.position?.coordinates?.[1] ?? 19.28}°N]. Zero correlated AIS broadcasts.`,
        featureScores: {
          trajectoryIntersection: 0,
          temporalProximity: 0,
          speedAnomaly: 0,
          aisGapScore: 0,
        },
      });
    });
  }

  return {
    incidentId: "INC-2026-MUM-001",
    generatedAt: new Date().toISOString(),
    totalSuspectsEvaluated: suspects.length,
    algorithmVersion: data.scoring_model || "Weighted Rule-Based Attribution Model",
    suspects,
  };
}

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
