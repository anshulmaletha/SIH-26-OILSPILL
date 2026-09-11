import React from "react";
import {
  X,
  Navigation,
  Compass,
  Gauge,
  MapPin,
  Clock,
  Radio,
  AlertTriangle,
  Anchor,
  Flag,
  Ship,
  Info,
} from "lucide-react";
import type { SwarmVessel } from "@/lib/mission/swarmData";

export interface VesselInfoPanelProps {
  vessel: SwarmVessel | null;
  onClose: () => void;
}

export const VesselInfoPanel: React.FC<VesselInfoPanelProps> = ({ vessel, onClose }) => {
  if (!vessel) return null;

  const isDark = vessel.isDarkVessel || vessel.suspicionLevel === "high";
  const [lng, lat] = vessel.position;

  return (
    <div
      className="animate-in fade-in zoom-in-95 duration-200"
      style={{
        position: "absolute",
        top: "76px",
        right: "14px",
        zIndex: 30,
        width: "320px",
        backgroundColor: "#0D1117",
        border: `1px solid ${isDark ? "#EF4444" : "#1C2A38"}`,
        borderTop: `3px solid ${isDark ? "#EF4444" : "#22D3EE"}`,
        borderRadius: "4px",
        boxShadow: isDark
          ? "0 8px 32px rgba(239, 68, 68, 0.25), 0 2px 10px rgba(0,0,0,0.8)"
          : "0 8px 32px rgba(0,0,0,0.7)",
        overflow: "hidden",
        fontFamily: "'JetBrains Mono', monospace",
        color: "#C8D8E8",
        pointerEvents: "auto",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #1C2A38",
          backgroundColor: isDark ? "rgba(239, 68, 68, 0.08)" : "rgba(34, 211, 238, 0.04)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: isDark ? "#EF4444" : "#22D3EE",
                boxShadow: isDark ? "0 0 8px #EF4444" : "0 0 8px #22D3EE",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: isDark ? "#EF4444" : "#22D3EE",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {isDark ? "⚠ SUSPICIOUS MARITIME TARGET" : "AIS VESSEL TELEMETRY"}
            </span>
          </div>

          <h3
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#FFFFFF",
              margin: 0,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={vessel.name}
          >
            {vessel.name}
          </h3>

          <div style={{ fontSize: "9px", color: "#5A7A94", marginTop: "2px" }}>
            {vessel.typeLabel} • {vessel.flag}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#5A7A94",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "2px",
          }}
          title="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Anomaly Banner (if dark or high-suspicion) ── */}
      {isDark && vessel.suspiciousReason && (
        <div
          style={{
            margin: "8px 10px 0 10px",
            padding: "8px",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: "3px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#EF4444", fontSize: "9px", fontWeight: 700, marginBottom: "3px" }}>
            <AlertTriangle size={11} />
            <span>{vessel.threatTag || "ANOMALY DETECTED"}</span>
          </div>
          <div style={{ fontSize: "8.5px", color: "#FCA5A5", lineHeight: 1.35 }}>
            {vessel.suspiciousReason}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Position Grid */}
        <div>
          <div style={{ fontSize: "8px", color: "#5A7A94", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            LIVE POSITION
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              backgroundColor: "#111822",
              padding: "6px 8px",
              borderRadius: "3px",
              border: "1px solid #1C2A38",
            }}
          >
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>LATITUDE</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF" }}>
                {lat.toFixed(4)}° N
              </span>
            </div>
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>LONGITUDE</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF" }}>
                {lng.toFixed(4)}° E
              </span>
            </div>
          </div>
        </div>

        {/* Movement / Speed / Heading */}
        <div>
          <div style={{ fontSize: "8px", color: "#5A7A94", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            NAVIGATION & DYNAMICS
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "6px",
              backgroundColor: "#111822",
              padding: "6px 8px",
              borderRadius: "3px",
              border: "1px solid #1C2A38",
            }}
          >
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>SPEED (SOG)</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#EF4444" : "#22D3EE" }}>
                {vessel.speedKnots.toFixed(1)} kn
              </span>
            </div>
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>COURSE (COG)</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#C8D8E8" }}>
                {vessel.course}°
              </span>
            </div>
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>HEADING</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#C8D8E8" }}>
                {vessel.heading}°
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry / Identity Breakdown */}
        <div>
          <div style={{ fontSize: "8px", color: "#5A7A94", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            VOYAGE & IDENTIFICATION
          </div>
          <div
            style={{
              backgroundColor: "#111822",
              padding: "6px 8px",
              borderRadius: "3px",
              border: "1px solid #1C2A38",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "9px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>MMSI:</span>
              <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{vessel.mmsi}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>CALL SIGN:</span>
              <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{vessel.callsign}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>STATUS:</span>
              <span style={{ color: isDark ? "#EF4444" : "#22D3EE", fontWeight: 600 }}>
                {vessel.navStatus}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>DESTINATION:</span>
              <span style={{ color: "#FFFFFF", fontWeight: 600, maxWidth: "160px", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {vessel.destination}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>LAST SIGNAL:</span>
              <span style={{ color: "#C8D8E8" }}>{vessel.lastSeen}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>DIMENSIONS:</span>
              <span style={{ color: "#C8D8E8" }}>
                {vessel.lengthMeters}m × {vessel.beamMeters}m (d: {vessel.draughtMeters}m)
              </span>
            </div>
          </div>
        </div>

        {/* Trajectory Status Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 8px",
            backgroundColor: "rgba(34, 211, 238, 0.04)",
            border: "1px dashed #1C2A38",
            borderRadius: "3px",
            fontSize: "8px",
            color: "#22D3EE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                backgroundColor: "#22D3EE",
                display: "inline-block",
              }}
            />
            <span>HISTORICAL TRAJECTORY ACTIVE</span>
          </div>
          <span style={{ color: "#5A7A94" }}>
            {vessel.trajectory?.length || 4} WAYPOINTS
          </span>
        </div>
      </div>
    </div>
  );
};
