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

  const isDark = state.theme === "dark";
  const showAnomalyLock = elapsed > 3500;
  const showAlertBox = elapsed > 3800;

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
      {/* ── Status Indicator (Top Center) ── */}
      <div
        style={{
          position: "absolute",
          top: 68,
          left: "50%",
          transform: "translateX(-50%)",
          background: isDark ? "#0F172A" : "#FFFFFF",
          border: `1px solid ${isDark ? "#1E293B" : "#CBD5E1"}`,
          borderRadius: 2,
          padding: "6px 14px",
          boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.06)",
          fontFamily: "ui-monospace, monospace",
          fontSize: 9,
          color: isDark ? "#F8FAFC" : "#0F172A",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: showAnomalyLock ? "#DC2626" : (isDark ? "#F8FAFC" : "#0F172A"),
          }}
        />
        <span>
          {showAnomalyLock
            ? "ANOMALY IDENTIFIED · U-Net Segmentation Complete"
            : "Sentinel-1A SAR Ingestion · C-Band VV Speckle Filter (5×5)"}
        </span>
      </div>

      {/* ── Anomaly Reticle & Alert Box (Only revealed after detection) ── */}
      {showAlertBox && (
        <div
          style={{
            position: "absolute",
            top: 110,
            right: 16,
            background: isDark ? "#0F172A" : "#FFFFFF",
            border: `1px solid ${isDark ? "#1E293B" : "#CBD5E1"}`,
            borderLeft: "3px solid #DC2626",
            borderRadius: 2,
            padding: "10px 14px",
            fontFamily: "ui-monospace, monospace",
            minWidth: 260,
            zIndex: 501,
            boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#DC2626",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            ANOMALY DETECTED (STAGE 1)
          </div>
          <div style={{ fontSize: 9, color: isDark ? "#F8FAFC" : "#0F172A", lineHeight: 1.6 }}>
            <div>Centroid: 19.350°N, 71.853°E</div>
            <div>Backscatter: σ° = -18.6 dB (VV)</div>
            <div>Vectorized Area: 4.82 km² · Perimeter: 14.8 km</div>
            <div>PyTorch U-Net Confidence: 94.0%</div>
            <div style={{ color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 700, marginTop: 4 }}>
              Classification: Potential Crude Petroleum Slick
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SARPhaseOverlay;
