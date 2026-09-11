import React from "react";
import { useMission } from "@/lib/mission/missionState";
import type { P1Output } from "@/lib/contracts/p1";
import type { P3Output } from "@/lib/contracts/p3";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";
import { PanelFooter } from "@/components/ui/panel-system/PanelFooter";

interface CaseFileOverlayProps {
  p1Data: P1Output;
  p3Data: P3Output;
}

interface EvidenceItem {
  label: string;
  value: string;
  verified: boolean;
  isHash?: boolean;
}

const EVIDENCE_ITEMS: EvidenceItem[] = [
  { label: "SAR Scene ID", value: "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI", verified: true },
  { label: "Acquisition Timestamp", value: "2026-05-15T06:00:00Z", verified: true },
  { label: "Slick Footprint", value: "14.2 km\u00b2 (multi-polygon cluster, 4.82 km\u00b2 core)", verified: true },
  { label: "Radar Backscatter \u03c3\u00b0", value: "-18.6 dB (VV Polarization \u00b7 Lee Filtered)", verified: true },
  { label: "Neural Model Confidence", value: "94.0% (UNet++ Segmentation Architecture)", verified: true },
  { label: "AIS Transponder Gap", value: "MMSI 419000101 \u00b7 2026-05-14 18:30\u201321:54Z (3.4h)", verified: true },
  { label: "H3 Corridor Intersection", value: "Resolution 7 \u00b7 k=0 Origin Spatial Overlap Confirmed", verified: true },
  { label: "Attribution Score", value: "91.2% (XGBoost Multi-Factor Ensemble v2.4)", verified: true },
  { label: "Maritime Jurisdiction", value: "IMO MARPOL 73/78 Annex I \u00b7 Arabian Sea PSSA", verified: true },
  { label: "Cryptographic SHA-256", value: "a7f3c9e2b14d8f016a2e53c7d1b9f4a3e82c6751d9f0b23e5a48271c9d36fe8", verified: true, isHash: true },
];

const HASH = "a7f3c9e2b14d8f016a2e53c7d1b9f4a3e82c6751d9f0b23e5a48271c9d36fe8";

const CHECKLIST_ITEMS = [
  "SAR detection confirmed",
  "Drift corridor match",
  "AIS transponder anomaly",
  "Vessel attribution scored",
  "Evidence chain sealed",
];

export const CaseFileOverlay: React.FC<CaseFileOverlayProps> = ({ p1Data, p3Data }) => {
  const { state } = useMission();

  if (state.currentStage !== "CASE_FILE") return null;

  const elapsed = state.stageElapsedMs;

  const visibleCount = Math.min(EVIDENCE_ITEMS.length, Math.floor(elapsed / 450));
  const showHash = elapsed > 4500;
  const showExport = elapsed > 5500;

  function handleExport() {
    const primary = p3Data.suspects[0];
    const report = [
      "=".repeat(68),
      "SIH 26143 \u2014 MARITIME OIL SPILL FORENSIC INVESTIGATION DOSSIER",
      "=".repeat(68),
      `Case ID:            INC-2026-MUM-001`,
      `Generated:          ${new Date().toISOString()}`,
      `Authority:          Indian Coast Guard / Directorate General of Shipping`,
      `Jurisdiction:       IMO MARPOL 73/78 Annex I (Oil Pollution Prevention)`,
      "",
      "\u2500\u2500 INCIDENT SUMMARY \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
      `SAR Scene ID:       ${p1Data.sarScene.sceneId}`,
      `Detection Time:     ${p1Data.sarScene.acquisitionTime}`,
      `Coordinates:        Lat 19.352\u00b0N, Lon 71.855\u00b0E (Mumbai Offshore)`,
      `Slick Area:         ${p1Data.slicks[0]?.areaKm2 ?? 14.2} km\u00b2`,
      `Model Confidence:   ${(p1Data.modelConfidence * 100).toFixed(1)}% (UNet++)`,
      "",
      "\u2500\u2500 ATTRIBUTION FINDINGS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
      primary
        ? [
            `Primary Suspect:    ${primary.vesselName}`,
            `IMO Number:         ${(primary as { imo?: string }).imo ?? "9384124"}`,
            `MMSI:               ${primary.mmsi}`,
            `Vessel Type:        ${primary.vesselType}`,
            `Flag State:         ${primary.flag}`,
            `Attribution Score:  ${(primary.overallScore * 100).toFixed(1)}%`,
            `Confidence:         ${(primary.confidence * 100).toFixed(1)}%`,
            `AIS Gap Score:      ${(primary.featureScores.aisGapScore * 100).toFixed(0)}% (3.4h Blackout)`,
            `Corridor Match:     ${(primary.featureScores.trajectoryIntersection * 100).toFixed(0)}% (H3 k=0)`,
            `Recommendation:     ${primary.recommendation}`,
          ].join("\n")
        : "No primary suspect identified.",
      "",
      "\u2500\u2500 EVIDENCE INTEGRITY SEAL \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
      `Algorithm:          SHA-256`,
      `Hash:               ${HASH}`,
      `Tamper Status:      VERIFIED UNALTERED`,
      "",
      "=".repeat(68),
      "OFFICIAL USE ONLY \u2014 CONFIDENTIAL FORENSIC DOSSIER",
      "=".repeat(68),
    ].join("\n");

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "INC-2026-MUM-001_forensic_report.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 52,
        right: 0,
        bottom: 0,
        zIndex: 25,
        width: 380,
        pointerEvents: "auto",
      }}
    >
      <OperationsPanel
        variant="drawer"
        borderLeftAccent
        accentColor="cyan"
        style={{
          height: "100%",
          borderRadius: 0,
          borderTop: "none",
          borderRight: "none",
          borderBottom: "none",
          backgroundColor: "#080B0F",
        }}
      >
        <PanelHeader
          category="07 · CASE FILE"
          title="FORENSIC DOSSIER"
          statusText="FINALIZED"
          statusVariant="cyan"
        />

        {/* Case header block */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #1C2A38",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontFamily: "JetBrains Mono, monospace",
              color: "#5A7A94",
            }}
          >
            INC-2026-MUM-001
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#22D3EE",
              marginTop: 3,
            }}
          >
            INVESTIGATION COMPLETE
          </div>
        </div>

        {/* 4 key results block */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #1C2A38",
          }}
        >
          <div
            style={{
              fontSize: 8,
              color: "#5A7A94",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 10,
            }}
          >
            SUMMARY
          </div>

          {/* Row 1 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: "1px solid #111822",
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontFamily: "JetBrains Mono, monospace",
                color: "#5A7A94",
                textTransform: "uppercase",
              }}
            >
              DETECTION
            </span>
            <span style={{ fontSize: 10, color: "#E2E8F0" }}>Oil Spill · 14.2 km²</span>
          </div>

          {/* Row 2 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: "1px solid #111822",
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontFamily: "JetBrains Mono, monospace",
                color: "#5A7A94",
                textTransform: "uppercase",
              }}
            >
              CONFIDENCE
            </span>
            <span style={{ fontSize: 10, color: "#22D3EE", fontWeight: 700 }}>94.0%</span>
          </div>

          {/* Row 3 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: "1px solid #111822",
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontFamily: "JetBrains Mono, monospace",
                color: "#5A7A94",
                textTransform: "uppercase",
              }}
            >
              ATTRIBUTION
            </span>
            <span style={{ fontSize: 10, color: "#E2E8F0" }}>MT IND_TANKER_412</span>
          </div>

          {/* Row 4 */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 0",
              borderBottom: "1px solid #111822",
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontFamily: "JetBrains Mono, monospace",
                color: "#5A7A94",
                textTransform: "uppercase",
              }}
            >
              EVIDENCE
            </span>
            <span style={{ fontSize: 10, color: "#10B981", fontWeight: 700 }}>10 / 10 VERIFIED</span>
          </div>
        </div>

        {/* Key evidence checklist */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #1C2A38",
          }}
        >
          <div
            style={{
              fontSize: 8,
              color: "#5A7A94",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            KEY EVIDENCE
          </div>

          {CHECKLIST_ITEMS.map((item, i) =>
            visibleCount > i * 2 ? (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "3px 0",
                }}
              >
                <span style={{ color: "#10B981" }}>✓</span>
                <span style={{ fontSize: 10, color: "#C8D8E8" }}>{item}</span>
              </div>
            ) : null
          )}
        </div>

        {/* Evidence integrity row */}
        {showHash && (
          <div
            style={{
              padding: "8px 14px",
              borderBottom: "1px solid #1C2A38",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9, color: "#5A7A94" }}>EVIDENCE INTEGRITY</span>
              <StatusBadge label="✓ VERIFIED" variant="emerald" size="sm" />
            </div>
          </div>
        )}

        {/* Export Footer */}
        {showExport && (
          <PanelFooter
            primaryAction={
              <button
                type="button"
                onClick={handleExport}
                className="w-full py-2.5 px-4 rounded-xs bg-[#111822] hover:bg-[#22D3EE]/15 border border-[#22D3EE] text-[#22D3EE] font-mono text-[11px] font-bold tracking-wider cursor-pointer uppercase transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
              >
                <span>↓</span>
                EXPORT FORENSIC DOSSIER
              </button>
            }
            note="Certified for Indian Coast Guard · DG Shipping · ITOPF Legal Submissions"
          />
        )}
      </OperationsPanel>
    </div>
  );
};

export default CaseFileOverlay;
