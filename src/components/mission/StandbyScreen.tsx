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
        backgroundColor: "rgba(5, 7, 10, 0.92)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: isStandby ? 1 : 0,
        pointerEvents: isStandby ? "auto" : "none",
        transition: "opacity 0.5s ease",
      }}
    >
      {/* Top label */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "#22D3EE",
          letterSpacing: "0.15em",
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
        }}
      >
        {/* Incident badge */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#5A7A94",
            border: "1px solid #1C2A38",
            padding: "4px 10px",
            borderRadius: 2,
            letterSpacing: "0.08em",
          }}
        >
          INC-2026-MUM-001
        </div>

        {/* Incident title */}
        <div
          style={{
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            fontSize: 28,
            fontWeight: 300,
            color: "#E2E8F0",
            letterSpacing: "-0.02em",
            marginTop: 12,
            textAlign: "center",
          }}
        >
          MUMBAI OFFSHORE CORRIDOR
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#3A5268",
            marginTop: 10,
            textAlign: "center",
            letterSpacing: "0.02em",
          }}
        >
          Sentinel-1A SAR Detection&nbsp; ·&nbsp; OpenDrift Backtrack&nbsp; ·&nbsp; AIS Attribution&nbsp; ·&nbsp; Containment Ops
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
            width: 320,
            height: 1,
            backgroundColor: "#1C2A38",
            margin: "24px 0",
          }}
        />

        {/* Start button */}
        <button
          onClick={() => dispatch({ type: "INITIATE" })}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: hovered ? "rgba(34,211,238,0.063)" : "#111822",
            border: "1px solid #22D3EE",
            color: "#22D3EE",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            padding: "14px 32px",
            cursor: "pointer",
            borderRadius: 2,
            transition: "background 0.2s ease",
            outline: "none",
          }}
        >
          {/* Pulsing cyan dot */}
          <span
            style={{
              display: "inline-block",
              width: 5,
              height: 5,
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
          bottom: 18,
          left: 20,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: "#3A5268",
          letterSpacing: "0.06em",
        }}
      >
        v2.4 XGBoost-Ensemble
      </div>

      {/* Bottom right: ready status */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          right: 20,
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
