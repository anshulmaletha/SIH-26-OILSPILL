import React from "react";
import { useMission } from "@/lib/mission/missionState";

// Inject keyframes once
const SAR_KEYFRAMES = `
@keyframes radar-sweep-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes pulse-ring {
  0%   { opacity: 0.5; }
  100% { opacity: 1; }
}
@keyframes scanline-flash {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}
`;

if (typeof document !== "undefined") {
  const id = "__sar-phase-kf__";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = SAR_KEYFRAMES;
    document.head.appendChild(style);
  }
}

export const SARPhaseOverlay: React.FC = () => {
  const { state } = useMission();
  const isActive = state.currentStage === "SAR_ACQUISITION";
  const elapsed = state.stageElapsedMs ?? 0;

  if (!isActive) return null;

  const scanPct = Math.min(elapsed / 3000, 1);
  const showScanLine = elapsed < 3000;
  const showAnomalyLock = elapsed > 3500;
  const showAlertBox = elapsed > 4000;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 500,
        overflow: "hidden",
      }}
    >
      {/* ── 1. RADAR SWEEP ──────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 180,
          height: 180,
          border: "2px dashed rgba(34,211,238,0.25)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Rotating conic gradient sweep */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "conic-gradient(transparent 270deg, rgba(34,211,238,0.13) 360deg)",
            animation: "radar-sweep-rotate 3s linear infinite",
          }}
        />
        {/* Center crosshair dot */}
        <div
          style={{
            position: "relative",
            width: 4,
            height: 4,
            borderRadius: "50%",
            backgroundColor: "#22D3EE",
            zIndex: 1,
          }}
        />
      </div>

      {/* Radar label */}
      <div
        style={{
          position: "absolute",
          top: 268,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: "#22D3EE",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          opacity: 0.7,
        }}
      >
        SAR RADAR SWEEP
      </div>

      {/* ── 2. SCANLINE REVEAL ──────────────────────────────── */}
      {showScanLine && (
        <>
          <div
            style={{
              position: "absolute",
              top: `${scanPct * 100}vh`,
              left: 0,
              right: 0,
              height: 1,
              background: "rgba(34,211,238,0.19)",
              animation: "scanline-flash 0.4s ease-in-out infinite",
            }}
          />
          {/* Scanned region fill (above the line) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: `${scanPct * 100}vh`,
              background: "rgba(34,211,238,0.025)",
              pointerEvents: "none",
            }}
          />
          {/* SCANNING label */}
          <div
            style={{
              position: "absolute",
              top: `calc(${scanPct * 100}vh - 14px)`,
              right: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: "#22D3EE",
              letterSpacing: "0.1em",
              opacity: 0.9,
            }}
          >
            ▶ SCANNING
          </div>
        </>
      )}

      {/* ── 3. ANOMALY DETECTION LOCK ───────────────────────── */}
      {showAnomalyLock && (
        <div
          style={{
            position: "absolute",
            top: "45%",
            left: "55%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Outer pulse ring */}
          <div
            style={{
              width: 60,
              height: 60,
              border: "1px solid #EF4444",
              borderRadius: "50%",
              animation: "pulse-ring 1.5s ease-in-out infinite alternate",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Center dot */}
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                backgroundColor: "#EF4444",
              }}
            />
            {/* Tick — top */}
            <div
              style={{
                position: "absolute",
                top: -5,
                left: "50%",
                transform: "translateX(-50%)",
                width: 1,
                height: 5,
                backgroundColor: "#EF4444",
              }}
            />
            {/* Tick — bottom */}
            <div
              style={{
                position: "absolute",
                bottom: -5,
                left: "50%",
                transform: "translateX(-50%)",
                width: 1,
                height: 5,
                backgroundColor: "#EF4444",
              }}
            />
            {/* Tick — left */}
            <div
              style={{
                position: "absolute",
                left: -5,
                top: "50%",
                transform: "translateY(-50%)",
                width: 5,
                height: 1,
                backgroundColor: "#EF4444",
              }}
            />
            {/* Tick — right */}
            <div
              style={{
                position: "absolute",
                right: -5,
                top: "50%",
                transform: "translateY(-50%)",
                width: 5,
                height: 1,
                backgroundColor: "#EF4444",
              }}
            />
          </div>
        </div>
      )}

      {/* ── 4. ALERT BOX ────────────────────────────────────── */}
      {showAlertBox && (
        <div
          style={{
            position: "absolute",
            top: "42%",
            left: "calc(55% + 42px)",
            background: "#0D1117",
            border: "1px solid #EF4444",
            borderLeft: "3px solid #EF4444",
            padding: "8px 12px",
            fontFamily: "'JetBrains Mono', monospace",
            minWidth: 220,
            zIndex: 501,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#EF4444",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            ANOMALY DETECTED
          </div>
          <div style={{ fontSize: 9, color: "#C8D8E8", lineHeight: 1.7 }}>
            <div>Lat 19.35°N&nbsp;&nbsp;Lon 71.85°E</div>
            <div>σ° = -18.6 dB&nbsp;&nbsp;|&nbsp;&nbsp;Area: 14.2 km²</div>
            <div>Confidence: 94%</div>
            <div style={{ color: "#F59E0B", marginTop: 2 }}>
              Classification: CRUDE PETROLEUM SLICK
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SARPhaseOverlay;
