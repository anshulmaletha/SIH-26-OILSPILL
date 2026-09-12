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
        {/* Scenario Picker */}
        <div style={{ display: "flex", gap: "24px", marginTop: "20px" }}>
          
          {/* Mumbai Live Demo Card */}
          <div
            onClick={() => dispatch({ type: "SET_SCENARIO", scenario: "active" })}
            style={{
              width: "280px",
              background: "#0A0E14",
              border: "1px solid #1C2A38",
              borderRadius: "4px",
              padding: "20px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#22D3EE"; e.currentTarget.style.background = "rgba(34,211,238,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1C2A38"; e.currentTarget.style.background = "#0A0E14"; }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5A7A94", marginBottom: "8px" }}>LIVE DEMO</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: "#E2E8F0", textAlign: "center", marginBottom: "12px" }}>MUMBAI OFFSHORE</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#9CA3AF", textAlign: "center", lineHeight: 1.4, marginBottom: "16px" }}>
              Real-time pipeline.<br/>Dark Vessel Tracking<br/>Multi-factor Scoring
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#22D3EE" }}>[ INITIATE ]</div>
          </div>

          {/* Kerala Historical Card */}
          <div
            onClick={() => dispatch({ type: "SET_SCENARIO", scenario: "kerala" })}
            style={{
              width: "280px",
              background: "#0A0E14",
              border: "1px solid #1C2A38",
              borderRadius: "4px",
              padding: "20px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F59E0B"; e.currentTarget.style.background = "rgba(245,158,11,0.05)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1C2A38"; e.currentTarget.style.background = "#0A0E14"; }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5A7A94", marginBottom: "8px" }}>HISTORICAL VALIDATION</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: "#E2E8F0", textAlign: "center", marginBottom: "12px" }}>MSC ELSA 3 (KERALA)</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#9CA3AF", textAlign: "center", lineHeight: 1.4, marginBottom: "16px" }}>
              Physics geometry verification.<br/>No live tracking.<br/>Origin Error: 4.8km
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#F59E0B" }}>[ INITIATE ]</div>
          </div>

        </div>
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
        PyTorch U-Net · OpenDrift Physics · Explainable Attribution Engine
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
