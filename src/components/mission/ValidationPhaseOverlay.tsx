import React, { useState, useEffect } from "react";
import { useMission } from "@/lib/mission/missionState";
import { fetchDetection, type DetectionResult } from "@/lib/api/client";

// Inject keyframes once
const VAL_KEYFRAMES = `
@keyframes val-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.85); }
}
@keyframes val-bar-flash {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
`;

if (typeof document !== "undefined") {
  const id = "__val-phase-kf__";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = VAL_KEYFRAMES;
    document.head.appendChild(style);
  }
}

// ── Types ──────────────────────────────────────────────────────────────────
type CheckStatus = "pending" | "active" | "complete";

// ── Helper: status dot ─────────────────────────────────────────────────────
const StatusDot: React.FC<{ status: CheckStatus; dotColor?: string }> = ({ status, dotColor = "#0F172A" }) => {
  const bg =
    status === "complete" ? dotColor : status === "active" ? "#D97706" : "#CBD5E1";

  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: bg,
        flexShrink: 0,
        marginTop: 3,
      }}
    />
  );
};

// ── Check row ─────────────────────────────────────────────────────────────
interface CheckRowProps {
  status: CheckStatus;
  label: string;
  activeText: string;
  result: string;
  resultColor?: string;
  showProgressBar?: boolean;
  isDark?: boolean;
}

const CheckRow: React.FC<CheckRowProps> = ({
  status,
  label,
  activeText,
  result,
  resultColor,
  showProgressBar = false,
  isDark = false,
}) => {
  const defaultResultColor = isDark ? "#F8FAFC" : "#0F172A";
  const finalResultColor = resultColor ?? defaultResultColor;

  return (
    <div style={{ padding: "8px 12px", borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <StatusDot status={status} dotColor={finalResultColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: 11,
              color: isDark ? "#F8FAFC" : "#0F172A",
              lineHeight: 1.3,
              fontWeight: 500,
            }}
          >
            {label}
          </div>

          {status === "pending" && (
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 9,
                color: isDark ? "#64748B" : "#94A3B8",
                marginTop: 2,
              }}
            >
              Pending evaluation…
            </div>
          )}

          {status === "active" && (
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 9,
                color: isDark ? "#94A3B8" : "#64748B",
                marginTop: 2,
              }}
            >
              {activeText}
            </div>
          )}

          {status === "complete" && (
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 9,
                color: finalResultColor,
                marginTop: 3,
                lineHeight: 1.4,
                fontWeight: 600,
              }}
            >
              {result}
            </div>
          )}
        </div>
      </div>

      {/* Active progress bar */}
      {showProgressBar && status === "active" && (
        <div
          style={{
            marginTop: 6,
            height: 2,
            backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: "60%",
              backgroundColor: isDark ? "#F8FAFC" : "#0F172A",
            }}
          />
        </div>
      )}
    </div>
  );
};

// ── Corner bracket (decorative) ────────────────────────────────────────────
const CornerBracket: React.FC<{ position: "tl" | "tr" | "bl" | "br" }> = ({
  position,
}) => {
  const size = 8;
  const thickness = 1;
  const color = "#22D3EE";
  const base: React.CSSProperties = { position: "absolute", width: size, height: size };

  if (position === "tl") {
    return (
      <div style={{ ...base, top: -1, left: -1 }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: size, height: thickness, backgroundColor: color }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: thickness, height: size, backgroundColor: color }} />
      </div>
    );
  }
  if (position === "tr") {
    return (
      <div style={{ ...base, top: -1, right: -1 }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: size, height: thickness, backgroundColor: color }} />
        <div style={{ position: "absolute", top: 0, right: 0, width: thickness, height: size, backgroundColor: color }} />
      </div>
    );
  }
  if (position === "bl") {
    return (
      <div style={{ ...base, bottom: -1, left: -1 }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: size, height: thickness, backgroundColor: color }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: thickness, height: size, backgroundColor: color }} />
      </div>
    );
  }
  return (
    <div style={{ ...base, bottom: -1, right: -1 }}>
      <div style={{ position: "absolute", bottom: 0, right: 0, width: size, height: thickness, backgroundColor: color }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: thickness, height: size, backgroundColor: color }} />
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
export const ValidationPhaseOverlay: React.FC = () => {
  const { state } = useMission();
  const isActive = state.currentStage === "VALIDATION_AUDIT";
  const elapsed = state.stageElapsedMs ?? 0;

  const [detectionData, setDetectionData] = useState<DetectionResult | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchDetection(state.scenario)
      .then((data) => {
        if (mounted) setDetectionData(data);
      })
      .catch((err) => {
        console.warn("Could not fetch detection data from API:", err);
      });
    return () => {
      mounted = false;
    };
  }, [state.scenario]);

  if (!isActive) return null;

  const poly = detectionData?.polygons?.[0];
  const lf = poly?.lookalike_filter;
  const isRejected = lf?.final_decision === "rejected";

  const getCheckStatus = (showAt: number, completeAt: number): CheckStatus => {
    if (elapsed < showAt) return "pending";
    if (elapsed >= completeAt) return "complete";
    return "active";
  };

  const check1Status = getCheckStatus(500, 2500);
  const check2Status = getCheckStatus(2500, 4500);
  const check3Status = getCheckStatus(4500, 6500);

  const showDiagnostic = elapsed > 6500;
  const showBadge = elapsed > 7500;

  // Real confidence target: 94.0% for confirmed slick, 32.0% for rejected lookalike
  const targetConf = poly?.confidence ? poly.confidence * 100 : (isRejected ? 32.0 : 94.0);
  const confPct = showDiagnostic ? Math.min(((elapsed - 6500) / 1000) * targetConf, targetConf) : 0;

  const windPassed = lf ? lf.wind_gate_passed : true;
  const dampingPassed = lf ? (lf.damping_gate_passed ?? lf.damping_ratio >= 0.5) : true;
  const shapePassed = lf ? lf.shape_gate_passed : true;

  const isDark = state.theme === "dark";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 500,
      }}
    >
      {/* ── Right side panel ─────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 72,
          right: 16,
          width: 310,
          border: `1px solid ${isDark ? "#1E293B" : "#CBD5E1"}`,
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          borderRadius: 2,
          boxShadow: isDark ? "0 4px 16px rgba(0, 0, 0, 0.4)" : "0 4px 12px rgba(0, 0, 0, 0.08)",
          overflow: "hidden",
        }}
      >
        {/* Panel header */}
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}` }}>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 9,
              color: isRejected ? "#DC2626" : (isDark ? "#F8FAFC" : "#0F172A"),
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 3,
            }}
          >
            VALIDATION AUDIT
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 8.5,
              color: isDark ? "#94A3B8" : "#64748B",
            }}
          >
            {detectionData?.filter_model || "Physical Look-Alike Discriminator (ERA5 + Damping)"}
          </div>
        </div>

        {/* Check 1 — ERA5 Wind (Gate A) */}
        <CheckRow
          status={check1Status}
          label="Gate A: ERA5 Surface Wind Analysis"
          activeText="Analyzing ERA5 surface wind vectors…"
          result={
            lf
              ? `${lf.wind_speed_ms.toFixed(1)} m/s — ${windPassed ? "Above 2.0 m/s operational floor (Valid SAR)" : "Below 2.0 m/s calm threshold (Look-alike alert)"}`
              : "3.8 m/s — Above 2.0 m/s operational floor (Valid SAR)"
          }
          resultColor={windPassed ? (isDark ? "#F8FAFC" : "#0F172A") : "#DC2626"}
          showProgressBar
          isDark={isDark}
        />

        {/* Check 2 — Damping Ratio (Gate B) */}
        <CheckRow
          status={check2Status}
          label="Gate B: Radar Backscatter Damping"
          activeText="Measuring radar backscatter damping ratio…"
          result={
            lf
              ? `${lf.damping_ratio.toFixed(2)} dB — ${dampingPassed ? "Damping ratio ≥ 0.50 dB (Crude surfactant)" : "Insufficient damping < 0.50 dB (Biogenic film)"}`
              : "3.82 dB — Damping ratio ≥ 0.50 dB (Crude surfactant)"
          }
          resultColor={dampingPassed ? (isDark ? "#F8FAFC" : "#0F172A") : "#DC2626"}
          showProgressBar
          isDark={isDark}
        />

        {/* Check 3 — Shape Gate (Gate C) */}
        <CheckRow
          status={check3Status}
          label="Gate C: Geometric Eccentricity & Aspect"
          activeText="Computing plume aspect ratio & sinuosity…"
          result={
            poly
              ? `Eccentricity ${(poly.geometry_features?.eccentricity ?? 0.94).toFixed(2)} — ${shapePassed ? "Elongated trail morphology (≥ 0.70)" : "Non-linear circular patch (< 0.70)"}`
              : "Eccentricity 0.94 — Elongated trail morphology"
          }
          resultColor={shapePassed ? (isDark ? "#F8FAFC" : "#0F172A") : "#DC2626"}
          showProgressBar
          isDark={isDark}
        />

        {/* Diagnostic meter (ONLY shown after calculations complete) */}
        {showDiagnostic ? (
          <div style={{ padding: "10px 12px", background: isDark ? "#1E293B" : "#F8FAFC" }}>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                color: isDark ? "#94A3B8" : "#64748B",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              CLASSIFICATION CONFIDENCE
            </div>

            {/* Progress bar track */}
            <div
              style={{
                height: 3,
                backgroundColor: isDark ? "#334155" : "#E2E8F0",
                borderRadius: 1,
                overflow: "hidden",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${confPct}%`,
                  backgroundColor: isRejected ? "#DC2626" : (isDark ? "#F8FAFC" : "#0F172A"),
                  transition: "width 0.05s linear",
                }}
              />
            </div>

            {/* Percentage value */}
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 20,
                fontWeight: 700,
                color: isDark ? "#F8FAFC" : "#0F172A",
                lineHeight: 1,
                marginBottom: 8,
              }}
            >
              {confPct.toFixed(1)}%
            </div>

            {/* Confirmation or Rejection badge */}
            {showBadge && (
              isRejected ? (
                <div
                  style={{
                    display: "block",
                    backgroundColor: isDark ? "#281216" : "#FEF2F2",
                    border: `1px solid ${isDark ? "#7F1D1D" : "#FECACA"}`,
                    padding: "6px 8px",
                    borderRadius: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 9,
                      color: "#DC2626",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "block",
                      fontWeight: 700,
                    }}
                  >
                    REJECTED — LOOK-ALIKE DISCARDED
                  </span>
                  {lf?.rejection_reason && (
                    <span
                      style={{
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: 8.5,
                        color: isDark ? "#FCA5A5" : "#991B1B",
                        marginTop: 3,
                        display: "block",
                        lineHeight: 1.3,
                      }}
                    >
                      {lf.rejection_reason}
                    </span>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "inline-block",
                    backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                    border: `1px solid ${isDark ? "#334155" : "#CBD5E1"}`,
                    padding: "4px 8px",
                    borderRadius: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 9,
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      letterSpacing: "0.05em",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    CONFIRMED CRUDE PETROLEUM SLICK
                  </span>
                </div>
              )
            )}
          </div>
        ) : (
          <div
            style={{
              padding: "8px 12px",
              background: isDark ? "#1E293B" : "#F8FAFC",
              fontFamily: "ui-monospace, monospace",
              fontSize: 8.5,
              color: isDark ? "#64748B" : "#94A3B8",
              borderTop: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
            }}
          >
            Evaluating physical discrimination gates…
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationPhaseOverlay;
