import React from "react";
import { useMission } from "@/lib/mission/missionState";

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
const StatusDot: React.FC<{ status: CheckStatus }> = ({ status }) => {
  const bg =
    status === "complete" ? "#22D3EE" : status === "active" ? "#F59E0B" : "#1C2A38";

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
        <StatusDot status={status} />
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

  if (!isActive) return null;

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

  // Confidence fill: 0 → 94.8% over 1000ms starting at elapsed=6500
  const confPct = showDiagnostic ? Math.min(((elapsed - 6500) / 1000) * 94.8, 94.8) : 0;

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
          width: 300,
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
              color: "#22D3EE",
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
            Lookalike Discrimination Filter v2.4
          </div>
        </div>

        {/* Check 1 — ERA5 Wind */}
        {elapsed >= 500 && (
          <CheckRow
            status={check1Status}
            label="ERA5 Surface Wind Analysis"
            result="6.6 m/s WSW — Above 3.0 m/s calm threshold"
            resultColor="#22D3EE"
            showProgressBar
          />
        )}

        {/* Check 2 — Chlorophyll */}
        {elapsed >= 2500 && (
          <CheckRow
            status={check2Status}
            label="Chlorophyll-a / Algal Index"
            result="0.21 mg/m³ — Biogenic surfactant: NEGATIVE"
            resultColor="#22D3EE"
            showProgressBar
          />
        )}

        {/* Check 3 — Internal Waves */}
        {elapsed >= 4500 && (
          <CheckRow
            status={check3Status}
            label="Internal Waves / Bathymetric Check"
            result="Depth 62m — No reflection artifact detected"
            resultColor="#22D3EE"
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
                  backgroundColor: "#22D3EE",
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

            {/* Confirmation badge */}
            {showBadge && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationPhaseOverlay;
