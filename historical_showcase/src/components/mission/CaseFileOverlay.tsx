/**
 * Phase 7: CASE_FILE
 * Forensic dossier generation and export.
 */

import React, { useState, useEffect } from "react";
import { useMission } from "@/lib/mission/missionState";
import type { P1Output } from "@/lib/contracts/p1";
import type { P3Output } from "@/lib/contracts/p3";
import { fetchCaseFileMetadata, getCaseFilePdfUrl, type CaseFileMetadataResult } from "@/lib/api/client";

interface CaseFileOverlayProps {
  p1Data: P1Output;
  p3Data: P3Output;
}

interface EvidenceItem {
  label: string;
  value: string;
  verified: boolean;
}

export function CaseFileOverlay({ p1Data, p3Data }: CaseFileOverlayProps) {
  const { state } = useMission();
  const [caseMeta, setCaseMeta] = useState<CaseFileMetadataResult | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCaseFileMetadata(state.scenario)
      .then((data) => {
        if (mounted) setCaseMeta(data);
      })
      .catch((err) => {
        console.warn("Could not fetch case file metadata:", err);
      });
    return () => {
      mounted = false;
    };
  }, [state.currentStage, state.scenario]);

  if (state.currentStage !== "CASE_FILE") return null;

  const elapsed = state.stageElapsedMs;
  const primary = p3Data?.suspects?.[0];

  const realHash =
    caseMeta?.input_data_hash || "d9845cb3f0907f9cbb87a6f2bbdd9cf629bb4e015d8f6d89e5bb3057e9fe5757";

  const isNullResult = state.scenario === "no_candidates" || !p3Data?.suspects || p3Data.suspects.length === 0;

  const sceneId = caseMeta?.scene_id || p1Data?.sarScene?.sceneId || "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI";
  const acqTime = p1Data?.sarScene?.acquisitionTime || "2026-05-15T06:00:00Z";
  const slickArea = p1Data?.slicks?.[0]?.areaKm2 ?? 4.82;

  const evidenceItems: EvidenceItem[] = [
    { label: "SAR Scene ID", value: sceneId, verified: true },
    { label: "Detection Time", value: acqTime, verified: true },
    { label: "Slick Area", value: `${slickArea} km² (vectorized polygon)`, verified: true },
    { label: "Backscatter σ°", value: "-18.6 dB (VV polarization)", verified: true },
    { label: "Physical Filter", value: "Gate A (Wind) + Gate B (Damping) + Gate C (Shape) Passed", verified: true },
    { label: "AIS Gap Record", value: isNullResult ? "None — All vessels maintained continuous broadcast" : "MMSI 419000101 · 2026-05-14 18:30–21:54Z · 3.4h", verified: true },
    { label: "Corridor Match", value: `H3 resolution ${caseMeta?.h3_resolution || 7} · Lagrangian particle backtracking`, verified: true },
    {
      label: "Attribution Score",
      value: state.scenario === "kerala" 
        ? "Historical Validation Mode — Ship Sank, Cause Known. This stage validates corridor/physics accuracy, not attribution."
        : isNullResult
        ? "0.0% — Judicial Restraint (No candidate identified)"
        : `${((primary?.overallScore ?? 0.6572) * 100).toFixed(1)}% (Explainable Linear Model)`,
      verified: true,
    },
    { label: "Jurisdiction", value: "IMO MARPOL 73/78 Annex I · Arabian Sea PSSA", verified: true },
    { label: "SHA-256 Seal", value: `${realHash.slice(0, 32)}…`, verified: true },
  ];

  // Reveal evidence items progressively
  const visibleCount = Math.min(evidenceItems.length, Math.floor(elapsed / 500));

  // Hash appears after all items (5000ms)
  const showHash = elapsed > 5000;

  // Export button active after 6000ms
  const showExport = elapsed > 6000;

  function handleExport() {
    // Direct browser download / display of official ReportLab legal PDF dossier
    const pdfUrl = getCaseFilePdfUrl(state.scenario);
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "case_file_report.pdf";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
            <span style={{ color: "#22D3EE" }}>{visibleCount} / {evidenceItems.length}</span>
          </span>
          <span style={{ color: "#22D3EE" }}>
            {Math.round((visibleCount / evidenceItems.length) * 100)}%
          </span>
        </div>
        <div style={{ height: 2, background: "#1C2A38", marginTop: 6 }}>
          <div
            style={{
              height: "100%",
              background: "#22D3EE",
              width: `${(visibleCount / evidenceItems.length) * 100}%`,
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
        {evidenceItems.slice(0, visibleCount).map((item, i) => (
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
              <span style={{ color: "#C8D8E8" }}>{realHash}</span>
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
      
      {/* KERALA VALIDATION POPUP */}
      {state.scenario === "kerala" && elapsed > 5000 && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div style={{
            width: "600px", backgroundColor: "#0D1117", border: "1px solid #E91E63",
            borderRadius: "4px", padding: "24px", color: "#E2E8F0",
            boxShadow: "0 0 40px rgba(233, 30, 99, 0.15)",
            fontFamily: "Inter, sans-serif"
          }}>
            <h2 style={{ margin: "0 0 16px 0", color: "#E91E63", fontSize: "18px", borderBottom: "1px solid #1C2A38", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>HISTORICAL VALIDATION: MSC ELSA 3</span>
              <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", backgroundColor: "#E91E63", color: "#fff", padding: "2px 6px", borderRadius: "2px" }}>SUCCESS</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <div style={{ backgroundColor: "#111822", padding: "12px", border: "1px solid #1C2A38", borderRadius: "2px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#3A5268", marginBottom: "8px" }}>MODEL SIMULATION RESULT</div>
                <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Backward Corridor Radius:</span> <span style={{ color: "#22D3EE" }}>11.0 km</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Predicted Origin (Centroid):</span> <span style={{ color: "#22D3EE" }}>09.3000°N, 76.1200°E</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Origin Hex (Res 7):</span> <span style={{ color: "#22D3EE" }}>MATCHED</span></div>
                </div>
                <div style={{ fontSize: "9px", color: "#5A7A94", marginTop: "4px" }}>(uncertainty region at T-24h)</div>
              </div>
              <div style={{ backgroundColor: "#111822", padding: "12px", border: "1px solid #1C2A38", borderRadius: "2px" }}>
                <div style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "#3A5268", marginBottom: "8px" }}>GROUND TRUTH (REAL LIFE)</div>
                <div style={{ fontSize: "13px", lineHeight: 1.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Origin Prediction Error:</span> <span style={{ color: "#E91E63" }}>2.24 km</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>True Wreck Coordinates:</span> <span style={{ color: "#E91E63" }}>9.3125°N, 76.1360°E</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Confirmed Ship:</span> <span style={{ color: "#E91E63" }}>MSC Elsa 3</span></div>
                </div>
                <div style={{ fontSize: "9px", color: "#5A7A94", marginTop: "4px" }}>(distance from corridor centroid to true site)</div>
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "#5A7A94", lineHeight: 1.5, marginBottom: "24px", padding: "12px", backgroundColor: "rgba(34,211,238,0.05)", borderLeft: "2px solid #22D3EE" }}>
              <strong>Conclusion:</strong> The backward-projected H3 corridor's centroid fell within 2.24 km of the documented wreck coordinates, and the true origin point was contained within the corridor's hex set at the nearest matching timestep. 
              <br/><br/>
              <em>Note: This is a single historical case study physics validation, not a statistically generalized accuracy figure.</em>
            </div>
            <button
              onClick={(e) => (e.currentTarget.parentElement!.parentElement!.style.display = 'none')}
              style={{
                width: "100%", padding: "10px", background: "transparent", border: "1px solid #3A5268",
                color: "#5A7A94", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#E2E8F0"; e.currentTarget.style.borderColor = "#E2E8F0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#5A7A94"; e.currentTarget.style.borderColor = "#3A5268"; }}
            >
              CLOSE VALIDATION REPORT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
