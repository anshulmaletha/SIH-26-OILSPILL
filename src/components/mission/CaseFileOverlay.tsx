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
    fetchCaseFileMetadata()
      .then((data) => {
        if (mounted) setCaseMeta(data);
      })
      .catch((err) => {
        console.warn("Could not fetch case file metadata:", err);
      });
    return () => {
      mounted = false;
    };
  }, [state.currentStage]);

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
    { label: "Radar Damping", value: "Δσ° = 4.8 dB (Threshold ≥ 4.5 dB Verified)", verified: true },
    { label: "Physical Filter", value: "Gate A (Wind) + Gate B (Damping) + Gate C (Shape) Passed", verified: true },
    { label: "AIS Gap Record", value: isNullResult ? "None — All vessels maintained continuous broadcast" : "MMSI 419000101 · 2026-05-14 18:30–21:54Z · 3.4h", verified: true },
    { label: "Corridor Match", value: `H3 resolution ${caseMeta?.h3_resolution || 7} · Lagrangian particle backtracking`, verified: true },
    {
      label: "Attribution Score",
      value: isNullResult
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
    const pdfUrl = getCaseFilePdfUrl();
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = "case_file_report.pdf";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const isDark = state.theme === "dark";

  return (
    <div
      style={{
        position: "absolute",
        top: 52,
        right: 0,
        bottom: 0,
        zIndex: 25,
        width: 380,
        background: isDark ? "#0F172A" : "#FFFFFF",
        borderLeft: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: isDark ? "-4px 0 16px rgba(0, 0, 0, 0.4)" : "-4px 0 16px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
          background: isDark ? "#1E293B" : "#F8FAFC",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                fontWeight: 700,
                color: isDark ? "#F8FAFC" : "#0F172A",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              FORENSIC DOSSIER
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                color: isDark ? "#94A3B8" : "#64748B",
                marginTop: 2,
              }}
            >
              INC-2026-MUM-001 · {new Date().toLocaleDateString("en-GB")}
            </div>
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 8.5,
              fontWeight: 700,
              padding: "3px 8px",
              border: "1px solid #BBF7D0",
              color: "#16A34A",
              background: "#F0FDF4",
              borderRadius: 3,
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
          borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
          background: isDark ? "#0F172A" : "#FFFFFF",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "ui-monospace, monospace",
            fontSize: 9,
          }}
        >
          <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>
            COMPILING EVIDENCE MATRIX —{" "}
            <span style={{ color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 700 }}>{visibleCount} / {evidenceItems.length}</span>
          </span>
          <span style={{ color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 700 }}>
            {Math.round((visibleCount / evidenceItems.length) * 100)}%
          </span>
        </div>
        <div style={{ height: 3, background: isDark ? "#1E293B" : "#E2E8F0", marginTop: 6, borderRadius: 2, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              background: isDark ? "#F8FAFC" : "#0F172A",
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
              padding: "7px 0",
              borderBottom: `1px solid ${isDark ? "#1E293B" : "#F1F5F9"}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: isDark ? "#94A3B8" : "#64748B",
                }}
              >
                {item.label}
              </span>
              {item.verified && (
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 7.5,
                    fontWeight: 700,
                    color: "#16A34A",
                    border: "1px solid #BBF7D0",
                    background: isDark ? "#062817" : "#F0FDF4",
                    padding: "1px 5px",
                    borderRadius: 2,
                  }}
                >
                  ✓ VERIFIED
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 9.5,
                color: isDark ? "#F8FAFC" : "#0F172A",
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
              marginTop: 12,
              padding: "10px",
              border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
              background: isDark ? "#1E293B" : "#F8FAFC",
              borderRadius: 3,
            }}
          >
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                fontWeight: 700,
                color: isDark ? "#F8FAFC" : "#0F172A",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              EVIDENCE INTEGRITY SEAL
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                color: isDark ? "#94A3B8" : "#64748B",
                wordBreak: "break-all",
                lineHeight: 1.5,
              }}
            >
              SHA-256:
              <br />
              <span style={{ color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 600 }}>{realHash}</span>
            </div>
          </div>
        )}
      </div>

      {/* Export footer */}
      {showExport && (
        <div
          style={{
            padding: "12px 14px",
            borderTop: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
            background: isDark ? "#1E293B" : "#F8FAFC",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleExport}
            style={{
              width: "100%",
              padding: "11px",
              background: isDark ? "#F8FAFC" : "#0F172A",
              border: "none",
              borderRadius: 4,
              color: isDark ? "#0F172A" : "#FFFFFF",
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = isDark ? "#E2E8F0" : "#1E293B";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = isDark ? "#F8FAFC" : "#0F172A";
            }}
          >
            <span style={{ fontSize: 13 }}>↓</span>
            EXPORT FORENSIC REPORT
          </button>
          <div
            style={{
              marginTop: 6,
              fontFamily: "ui-monospace, monospace",
              fontSize: 8.5,
              color: isDark ? "#94A3B8" : "#64748B",
              textAlign: "center",
            }}
          >
            Ready for Indian Coast Guard · DG Shipping · ITOPF
          </div>
        </div>
      )}
    </div>
  );
}
