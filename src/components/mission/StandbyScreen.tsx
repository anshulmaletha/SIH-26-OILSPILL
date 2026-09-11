import React, { useState } from "react";
import { useMission } from "@/lib/mission/missionState";

// Inject keyframes once
const PULSE_KEYFRAMES = `
@keyframes standby-dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
`;

if (typeof document !== "undefined") {
  const id = "__standby-pulse-kf__";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = PULSE_KEYFRAMES;
    document.head.appendChild(style);
  }
}

export const StandbyScreen: React.FC = () => {
  const { state, dispatch } = useMission();
  const isStandby = state.currentStage === "STANDBY";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "radial-gradient(ellipse at center, rgba(5, 7, 10, 0.40) 0%, rgba(5, 7, 10, 0.78) 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: isStandby ? 1 : 0,
        pointerEvents: isStandby ? "auto" : "none",
        transition: "opacity 0.4s ease",
      }}
    >
      {/* Top classification header */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "#22D3EE",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        SIH 26143 — MARITIME INTELLIGENCE PLATFORM
      </div>

      {/* Center content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "600px",
          width: "90vw",
          padding: "0 20px",
        }}
      >
        {/* Incident badge */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "#5A7A94",
            border: "1px solid #1C2A38",
            background: "rgba(10, 14, 20, 0.8)",
            padding: "4px 12px",
            borderRadius: 2,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          INC-2026-MUM-001
        </div>

        {/* Incident title */}
        <div
          style={{
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            fontSize: 32,
            fontWeight: 700,
            color: "#E2E8F0",
            letterSpacing: "-0.02em",
            marginTop: 14,
            textAlign: "center",
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
          }}
        >
          MUMBAI OFFSHORE CORRIDOR
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#88A2BC",
            marginTop: 10,
            textAlign: "center",
            letterSpacing: "0.02em",
            lineHeight: 1.5,
          }}
        >
          Sentinel-1A SAR Detection · OpenDrift Backtrack · AIS Attribution · Containment Ops
        </div>

        {/* Coordinates */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#22D3EE",
            marginTop: 8,
            letterSpacing: "0.04em",
          }}
        >
          Lat 19.35°N&nbsp;&nbsp;|&nbsp;&nbsp;Lon 71.85°E&nbsp;&nbsp;|&nbsp;&nbsp;Area 14.2 km²
        </div>

        {/* Divider */}
        <div
          style={{
            width: 280,
            height: 1,
            backgroundColor: "#1C2A38",
            margin: "24px 0",
          }}
        />

        {/* Start button */}
        <button
          type="button"
          onClick={() => dispatch({ type: "INITIATE" })}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: hovered ? "rgba(34, 211, 238, 0.15)" : "rgba(17, 24, 34, 0.9)",
            border: "1px solid #22D3EE",
            color: "#22D3EE",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            padding: "14px 28px",
            cursor: "pointer",
            borderRadius: 2,
            boxShadow: hovered ? "0 0 20px rgba(34,211,238,0.25)" : "0 4px 16px rgba(0,0,0,0.6)",
            transition: "all 0.2s ease",
            outline: "none",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#22D3EE",
              flexShrink: 0,
              animation: "standby-dot-pulse 1.4s ease-in-out infinite",
            }}
          />
          [ INITIATE SAR MISSION ANALYSIS ]
        </button>
      </div>

      {/* Bottom left: version */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 24,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: "#5A7A94",
          letterSpacing: "0.06em",
        }}
      >
        v2.4 XGBoost-Ensemble
      </div>

      {/* Bottom right: ready status */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 24,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: "#5A7A94",
          letterSpacing: "0.08em",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#22D3EE",
            display: "inline-block",
            animation: "standby-dot-pulse 2s ease-in-out infinite",
          }}
        />
        READY FOR MISSION
      </div>
    </div>
  );
};

export default StandbyScreen;
