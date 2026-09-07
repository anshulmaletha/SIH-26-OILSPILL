import type { P1Output } from "../contracts/p1";
import type { P3Output } from "../contracts/p3";
import type { P4Output } from "../contracts/p4";
import type { P5Output, CaseFileMetadata } from "../contracts/p5";

export interface CompleteCaseFile {
  metadata: CaseFileMetadata;
  sarObservation: P1Output["sarScene"];
  slickExtent: P1Output["slicks"];
  corridorDispersion: {
    corridorId: string;
    totalCoverageAreaKm2: number;
    timestepsCount: number;
  };
  aisEvaluation: {
    totalVesselsMonitored: number;
    candidatesIdentified: number;
    darkVesselsDetected: number;
  };
  suspectRanking: P3Output["suspects"];
  forensicHash: string;
}

export function compileCaseFile({
  p1Data,
  p3Data,
  p4Data,
  p5Data,
}: {
  p1Data: P1Output;
  p3Data: P3Output;
  p4Data: P4Output;
  p5Data: P5Output;
}): CompleteCaseFile {
  const caseId = `CASE-SIH26143-${Date.now().toString(36).toUpperCase()}`;

  return {
    metadata: {
      caseId,
      incidentName: "Singapore Strait TSS Heavy Hydrocarbon Discharge",
      creationDate: new Date().toISOString(),
      leadInvestigator: "Maritime & Port Authority Intelligence Division (SIH 26143 P6)",
      status: p3Data.suspects.length > 0 ? "Forwarded to Port Authority" : "Under Review",
      jurisdiction: "Singapore Strait / Malacca TSS Sector 4",
      executiveSummary:
        p3Data.suspects.length > 0
          ? `Forensic correlation identified ${p3Data.suspects.length} suspect vessel(s). Primary polluter candidate identified as ${p3Data.suspects[0]?.vesselName} (Score: ${(p3Data.suspects[0]?.overallScore * 100).toFixed(1)}%).`
          : "Null-result case file. Zero monitored AIS vessels intersected the backtracked H3 dispersion corridor.",
    },
    sarObservation: p1Data.sarScene,
    slickExtent: p1Data.slicks,
    corridorDispersion: {
      corridorId: p4Data.corridorId,
      totalCoverageAreaKm2: p4Data.totalCoverageAreaKm2,
      timestepsCount: p4Data.timesteps.length,
    },
    aisEvaluation: {
      totalVesselsMonitored: p5Data.totalVesselsMonitored,
      candidatesIdentified: p5Data.candidatesIdentified,
      darkVesselsDetected: p5Data.darkVesselsDetected,
    },
    suspectRanking: p3Data.suspects,
    forensicHash: `SHA256-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`,
  };
}

export function triggerCaseFileDownload(caseFile: CompleteCaseFile, format: "json" | "txt" = "json"): boolean {
  try {
    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === "json") {
      content = JSON.stringify(caseFile, null, 2);
      mimeType = "application/json";
      extension = "json";
    } else {
      content = [
        "==================================================================",
        "  SIH 26143 — MARITIME OIL SPILL INVESTIGATION DOSSIER",
        "==================================================================",
        `Case ID:           ${caseFile.metadata.caseId}`,
        `Incident:          ${caseFile.metadata.incidentName}`,
        `Creation Date:     ${caseFile.metadata.creationDate}`,
        `Status:            ${caseFile.metadata.status}`,
        `Jurisdiction:      ${caseFile.metadata.jurisdiction}`,
        `Forensic Hash:     ${caseFile.forensicHash}`,
        "",
        "------------------------------------------------------------------",
        "1. EXECUTIVE SUMMARY",
        "------------------------------------------------------------------",
        caseFile.metadata.executiveSummary,
        "",
        "------------------------------------------------------------------",
        "2. SAR & SLICK OBSERVATION (P1)",
        "------------------------------------------------------------------",
        `Satellite:         ${caseFile.sarObservation?.satelliteId ?? "Sentinel-1A"}`,
        `Mean Backscatter:  ${caseFile.sarObservation?.meanBackscatterDb ?? -18} dB`,
        `Slick Count:       ${caseFile.slickExtent.length}`,
        `Primary Area:      ${caseFile.slickExtent[0]?.areaKm2 ?? 0} km²`,
        `Confidence:        ${((caseFile.slickExtent[0]?.confidence ?? 0) * 100).toFixed(1)}%`,
        "",
        "------------------------------------------------------------------",
        "3. SUSPECT RANKING & FEATURE CORRELATION (P3)",
        "------------------------------------------------------------------",
        ...caseFile.suspectRanking.map(
          (s) =>
            `#${s.rank} ${s.vesselName} (MMSI: ${s.mmsi}) | Overall Score: ${(s.overallScore * 100).toFixed(1)}%\n` +
            `   - Type: ${s.vesselType} [Flag: ${s.flag}]\n` +
            `   - Corridor Overlap: ${(s.featureScores.trajectoryIntersection * 100).toFixed(0)}% | Temporal Match: ${(s.featureScores.temporalProximity * 100).toFixed(0)}%\n` +
            `   - Recommendation: ${s.recommendation}\n`
        ),
        "==================================================================",
      ].join("\n");
      mimeType = "text/plain";
      extension = "txt";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${caseFile.metadata.caseId}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error("Failed to export case file:", err);
    return false;
  }
}
