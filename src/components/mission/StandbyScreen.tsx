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
  const isDark = state.theme === "dark";

  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(248, 250, 252, 0.95)",
        backdropFilter: "blur(6px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: isStandby ? 1 : 0,
        pointerEvents: isStandby ? "auto" : "none",
        transition: "opacity 0.4s ease, background-color 0.2s ease",
      }}
    >
      {/* Top label */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "ui-monospace, monospace",
          fontSize: 10,
          fontWeight: 700,
          color: isDark ? "#94A3B8" : "#64748B",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        SIH 26143 — MARITIME INTELLIGENCE PLATFORM
      </div>

      {/* Top right theme toggle */}
      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <button
          onClick={() => dispatch({ type: "TOGGLE_THEME" })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 4,
            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
            background: isDark ? "#1E293B" : "#FFFFFF",
            color: isDark ? "#F8FAFC" : "#0F172A",
            fontFamily: "ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            transition: "all 0.15s ease",
          }}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? "☾ DARK MODE" : "☀ LIGHT MODE"}
        </button>
      </div>

      {/* Center card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          border: isDark ? "1px solid #1E293B" : "1px solid #E2E8F0",
          borderRadius: 6,
          boxShadow: isDark ? "0 20px 25px -5px rgba(0, 0, 0, 0.4)" : "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
          padding: "36px 44px",
          maxWidth: "540px",
          width: "90%",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
        }}
      >
        {/* Incident badge */}
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 700,
            color: isDark ? "#F8FAFC" : "#0F172A",
            backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
            border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
            padding: "4px 10px",
            borderRadius: 3,
            letterSpacing: "0.08em",
          }}
        >
          INC-2026-MUM-001
        </div>

        {/* Incident title */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 26,
            fontWeight: 700,
            color: isDark ? "#F8FAFC" : "#0F172A",
            letterSpacing: "-0.02em",
            marginTop: 14,
            textAlign: "center",
          }}
        >
          MUMBAI OFFSHORE CORRIDOR
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 12,
            color: isDark ? "#94A3B8" : "#64748B",
            marginTop: 8,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Sentinel-1A SAR Radar Detection · OpenDrift Backtracking · AIS Attribution · Spill Containment Ops
        </div>

        {/* Coordinates */}
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            color: isDark ? "#F8FAFC" : "#0F172A",
            backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
            border: isDark ? "1px solid #334155" : "1px solid #E2E8F0",
            padding: "6px 12px",
            borderRadius: 3,
            marginTop: 14,
            letterSpacing: "0.04em",
          }}
        >
          19.350°N, 71.853°E · Observed Area 4.82 km²
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: 1,
            backgroundColor: isDark ? "#1E293B" : "#E2E8F0",
            margin: "24px 0",
          }}
        />

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, width: "100%", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => dispatch({ type: "INITIATE" })}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: isDark ? (hovered ? "#E2E8F0" : "#F8FAFC") : (hovered ? "#1E293B" : "#0F172A"),
              border: "none",
              color: isDark ? "#0F172A" : "#FFFFFF",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "12px 24px",
              cursor: "pointer",
              borderRadius: 4,
              transition: "all 0.15s ease",
              outline: "none",
            }}
          >
            <span>▶</span>
            <span>INITIATE SAR MISSION ANALYSIS</span>
          </button>

          <button
            onClick={() => dispatch({ type: "SET_SEARCH_OPEN", open: true })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: isDark ? "#1E293B" : "#F1F5F9",
              border: isDark ? "1px solid #334155" : "1px solid #CBD5E1",
              color: isDark ? "#F8FAFC" : "#0F172A",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              padding: "12px 18px",
              cursor: "pointer",
              borderRadius: 4,
              transition: "all 0.15s ease",
              outline: "none",
            }}
            title="Search AIS vessels by Name or ID (Ctrl+K)"
          >
            <span>🔍</span>
            <span>SEARCH AIS (⌘K)</span>
          </button>
        </div>
      </div>

      {/* Bottom left: version */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 24,
          fontFamily: "ui-monospace, monospace",
          fontSize: 9,
          color: isDark ? "#64748B" : "#94A3B8",
          letterSpacing: "0.04em",
        }}
      >
        PyTorch U-Net · OpenDrift Lagrangian Physics · Explainable Attribution
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
          fontFamily: "ui-monospace, monospace",
          fontSize: 9,
          fontWeight: 600,
          color: isDark ? "#94A3B8" : "#64748B",
          letterSpacing: "0.06em",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "#16A34A",
            display: "inline-block",
          }}
        />
        SYSTEM READY
      </div>
    </div>
  );
};

export default StandbyScreen;
