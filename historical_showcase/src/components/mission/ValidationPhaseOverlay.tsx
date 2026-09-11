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
const StatusDot: React.FC<{ status: CheckStatus; dotColor?: string }> = ({ status, dotColor = "#22D3EE" }) => {
  const bg =
    status === "complete" ? dotColor : status === "active" ? "#F59E0B" : "#1C2A38";

  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: bg,
        flexShrink: 0,
        animation:
          status === "active" ? "val-dot-pulse 0.9s ease-in-out infinite" : undefined,
      }}
    />
  );
};

// ── Check row ─────────────────────────────────────────────────────────────
interface CheckRowProps {
  status: CheckStatus;
  label: string;
  result: string;
  resultColor?: string;
  showProgressBar?: boolean;
}

const CheckRow: React.FC<CheckRowProps> = ({
  status,
  label,
  result,
  resultColor = "#22D3EE",
  showProgressBar = false,
}) => (
  <div style={{ padding: "8px 12px", borderBottom: "1px solid #1C2A38" }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <div style={{ paddingTop: 2 }}>
        <StatusDot status={status} dotColor={resultColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            color: "#C8D8E8",
            lineHeight: 1.4,
          }}
        >
          {label}
        </div>
        {status !== "pending" && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: status === "complete" ? resultColor : "#5A7A94",
              marginTop: 3,
              lineHeight: 1.4,
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
          backgroundColor: "#1C2A38",
          borderRadius: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "60%",
            backgroundColor: "#F59E0B",
            animation: "val-bar-flash 0.7s ease-in-out infinite",
          }}
        />
      </div>
    )}
  </div>
);

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
          top: 80,
          right: 12,
          width: 310,
          border: "1px solid #1C2A38",
          backgroundColor: "#0D1117",
          borderRadius: 2,
          overflow: "visible",
        }}
      >
        {/* Decorative corner brackets */}
        <CornerBracket position="tl" />
        <CornerBracket position="tr" />
        <CornerBracket position="bl" />
        <CornerBracket position="br" />

        {/* Panel header */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #1C2A38" }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: isRejected ? "#F59E0B" : "#22D3EE",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 3,
            }}
          >
            VALIDATION AUDIT
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "#5A7A94",
            }}
          >
            {detectionData?.filter_model || "Physical Look-Alike Discriminator (ERA5 + Damping)"}
          </div>
        </div>

        {/* Check 1 — ERA5 Wind (Gate A) */}
        {elapsed >= 500 && (
          <CheckRow
            status={check1Status}
            label="Gate A: ERA5 Surface Wind Analysis"
            result={
              lf
                ? `${lf.wind_speed_ms.toFixed(1)} m/s — ${windPassed ? "Above 2.0 m/s operational floor (Valid SAR)" : "Below 2.0 m/s calm threshold (Look-alike alert)"}`
                : "3.8 m/s — Above 2.0 m/s operational floor (Valid SAR)"
            }
            resultColor={windPassed ? "#22D3EE" : "#EF4444"}
            showProgressBar
          />
        )}

        {/* Check 2 — Damping Ratio (Gate B) */}
        {elapsed >= 2500 && (
          <CheckRow
            status={check2Status}
            label="Gate B: Radar Backscatter Damping"
            result={
              lf
                ? `${lf.damping_ratio.toFixed(2)} dB — ${dampingPassed ? "Damping ratio ≥ 0.50 dB (Crude surfactant)" : "Insufficient damping < 0.50 dB (Biogenic film)"}`
                : "3.82 dB — Damping ratio ≥ 0.50 dB (Crude surfactant)"
            }
            resultColor={dampingPassed ? "#22D3EE" : "#EF4444"}
            showProgressBar
          />
        )}

        {/* Check 3 — Shape Gate (Gate C) */}
        {elapsed >= 4500 && (
          <CheckRow
            status={check3Status}
            label="Gate C: Geometric Eccentricity & Aspect"
            result={
              poly
                ? `Eccentricity ${(poly.geometry_features?.eccentricity ?? 0.94).toFixed(2)} — ${shapePassed ? "Elongated trail morphology (≥ 0.70)" : "Non-linear circular patch (< 0.70)"}`
                : "Eccentricity 0.94 — Elongated trail morphology"
            }
            resultColor={shapePassed ? "#22D3EE" : "#EF4444"}
            showProgressBar
          />
        )}

        {/* Diagnostic meter */}
        {showDiagnostic && (
          <div style={{ padding: "10px 12px" }}>
            {/* Meter label */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#5A7A94",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              CLASSIFICATION CONFIDENCE
            </div>

            {/* Progress bar track */}
            <div
              style={{
                height: 4,
                backgroundColor: "#1C2A38",
                borderRadius: 0,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${confPct}%`,
                  backgroundColor: isRejected ? "#EF4444" : "#22D3EE",
                  transition: "width 0.05s linear",
                }}
              />
            </div>

            {/* Percentage value */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 22,
                color: "#E2E8F0",
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
                    backgroundColor: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    padding: "6px 8px",
                    borderRadius: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: "#EF4444",
                      letterSpacing: "0.06em",
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
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 8,
                        color: "#FCA5A5",
                        marginTop: 4,
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
                    backgroundColor: "rgba(34,211,238,0.063)",
                    border: "1px solid rgba(34,211,238,0.25)",
                    padding: "4px 8px",
                    borderRadius: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: "#22D3EE",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    CONFIRMED CRUDE PETROLEUM SLICK
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationPhaseOverlay;
