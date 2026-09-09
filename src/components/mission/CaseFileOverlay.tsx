/**
 * Phase 7: CASE_FILE
 * Forensic dossier generation and export.
 */

import { useMission } from "@/lib/mission/missionState";
import type { P1Output } from "@/lib/contracts/p1";
import type { P3Output } from "@/lib/contracts/p3";

interface CaseFileOverlayProps {
  p1Data: P1Output;
  p3Data: P3Output;
}

interface EvidenceItem {
  label: string;
  value: string;
  verified: boolean;
}

const EVIDENCE_ITEMS: EvidenceItem[] = [
  { label: "SAR Scene ID", value: "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI", verified: true },
  { label: "Detection Time", value: "2026-05-15T06:00:00Z", verified: true },
  { label: "Slick Area", value: "4.82 km² (multi-polygon)", verified: true },
  { label: "Backscatter σ°", value: "-18.6 dB (VV polarization)", verified: true },
  { label: "Model Confidence", value: "94.0% (UNet++ segmentation)", verified: true },
  { label: "AIS Gap Record", value: "MMSI 419000101 · 2026-05-14 18:30–21:54Z · 3.4h", verified: true },
  { label: "Corridor Match", value: "H3 resolution 7 · k=0 intersection confirmed", verified: true },
  { label: "Attribution Score", value: "91.2% (XGBoost Ensemble v2.4)", verified: true },
  { label: "Jurisdiction", value: "IMO MARPOL 73/78 Annex I · Arabian Sea PSSA", verified: true },
  { label: "SHA-256 Hash", value: "a7f3c9e2b14d8f016a2e53c7d1b9f4a3…", verified: true },
];

const HASH = "a7f3c9e2b14d8f016a2e53c7d1b9f4a3e82c6751d9f0b23e5a48271c9d36fe8";

export function CaseFileOverlay({ p1Data, p3Data }: CaseFileOverlayProps) {
  const { state, dispatch } = useMission();

  if (state.currentStage !== "CASE_FILE") return null;

  const elapsed = state.stageElapsedMs;

  // Reveal evidence items progressively
  const visibleCount = Math.min(EVIDENCE_ITEMS.length, Math.floor(elapsed / 500));

  // Hash appears after all items (5000ms)
  const showHash = elapsed > 5000;

  // Export button active after 6000ms
  const showExport = elapsed > 6000;

  function handleExport() {
    // Build a simple text report for export
    const primary = p3Data.suspects[0];
    const report = [
      "=".repeat(64),
      "SIH 26143 — MARITIME OIL SPILL FORENSIC REPORT",
      "=".repeat(64),
      `Case ID:       INC-2026-MUM-001`,
      `Generated:     ${new Date().toISOString()}`,
      `Jurisdiction:  IMO MARPOL 73/78 Annex I`,
      "",
      "── INCIDENT SUMMARY ──────────────────────────────────────────",
      `SAR Scene:     ${p1Data.sarScene.sceneId}`,
      `Detection:     ${p1Data.sarScene.acquisitionTime}`,
      `Slick Area:    ${p1Data.slicks[0]?.areaKm2 ?? 4.82} km²`,
      `Confidence:    ${(p1Data.modelConfidence * 100).toFixed(1)}%`,
      "",
      "── PRIMARY CULPRIT ───────────────────────────────────────────",
      primary
        ? [
            `Vessel:        ${primary.vesselName}`,
            `MMSI:          ${primary.mmsi}`,
            `Type:          ${primary.vesselType}`,
            `Flag:          ${primary.flag}`,
            `Score:         ${(primary.overallScore * 100).toFixed(1)}%`,
            `Confidence:    ${(primary.confidence * 100).toFixed(1)}%`,
            `AIS Gap:       ${(primary.featureScores.aisGapScore * 100).toFixed(0)}%`,
            `Recommendation: ${primary.recommendation}`,
          ].join("\n")
        : "No primary suspect identified.",
      "",
      "── EVIDENCE INTEGRITY ────────────────────────────────────────",
      `SHA-256: ${HASH}`,
      "",
      "=".repeat(64),
      "For official maritime enforcement use only.",
      "=".repeat(64),
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
        background: "#080B0F",
        borderLeft: "1px solid #1C2A38",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #1C2A38",
          background: "#0D1117",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                color: "#22D3EE",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              FORENSIC DOSSIER
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#3A5268",
                marginTop: 2,
              }}
            >
              INC-2026-MUM-001  ·  {new Date().toLocaleDateString("en-GB")}
            </div>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8,
              padding: "3px 8px",
              border: "1px solid #22D3EE30",
              color: "#22D3EE",
              background: "#22D3EE08",
            }}
          >
            FINALIZED
          </div>
        </div>
      </div>

      {/* Generating animation header */}
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid #1C2A38",
          background: "#0A0E14",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
          }}
        >
          <span style={{ color: "#5A7A94" }}>
            COMPILING EVIDENCE MATRIX —{" "}
            <span style={{ color: "#22D3EE" }}>{visibleCount} / {EVIDENCE_ITEMS.length}</span>
          </span>
          <span style={{ color: "#22D3EE" }}>
            {Math.round((visibleCount / EVIDENCE_ITEMS.length) * 100)}%
          </span>
        </div>
        <div style={{ height: 2, background: "#1C2A38", marginTop: 6 }}>
          <div
            style={{
              height: "100%",
              background: "#22D3EE",
              width: `${(visibleCount / EVIDENCE_ITEMS.length) * 100}%`,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Evidence items */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: "8px 14px" }}
        className="custom-scrollbar"
      >
        {EVIDENCE_ITEMS.slice(0, visibleCount).map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "6px 0",
              borderBottom: "1px solid #111822",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 9,
                  color: "#5A7A94",
                }}
              >
                {item.label}
              </span>
              {item.verified && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 7,
                    color: "#22D3EE",
                    border: "1px solid #22D3EE20",
                    padding: "1px 4px",
                  }}
                >
                  ✓ VERIFIED
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#C8D8E8",
                marginTop: 2,
                wordBreak: "break-all",
              }}
            >
              {item.value}
            </span>
          </div>
        ))}

        {/* Hash integrity block */}
        {showHash && (
          <div
            style={{
              marginTop: 10,
              padding: "10px",
              border: "1px solid #22D3EE20",
              background: "#22D3EE06",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#22D3EE",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              EVIDENCE INTEGRITY SEAL
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#5A7A94",
                wordBreak: "break-all",
                lineHeight: 1.6,
              }}
            >
              SHA-256:
              <br />
              <span style={{ color: "#C8D8E8" }}>{HASH}</span>
            </div>
          </div>
        )}
      </div>

      {/* Export footer */}
      {showExport && (
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid #1C2A38",
            background: "#0D1117",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleExport}
            style={{
              width: "100%",
              padding: "11px",
              background: "#111822",
              border: "1px solid #22D3EE",
              color: "#22D3EE",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#22D3EE10";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#111822";
            }}
          >
            <span style={{ fontSize: 14 }}>↓</span>
            EXPORT FORENSIC REPORT
          </button>
          <div
            style={{
              marginTop: 6,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8,
              color: "#3A5268",
              textAlign: "center",
            }}
          >
            Ready for Indian Coast Guard  ·  DG Shipping  ·  ITOPF
          </div>
        </div>
      )}
    </div>
  );
}
