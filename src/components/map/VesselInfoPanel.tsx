import React, { useEffect, useState } from "react";
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
  ShieldAlert,
  Activity,
} from "lucide-react";
import type { SwarmVessel } from "@/lib/mission/swarmData";
import type { VesselTrack } from "@/lib/contracts/p5";
import { useMission } from "@/lib/mission/missionState";

export interface VesselInfoPanelProps {
  vessel: SwarmVessel | VesselTrack | null;
  onClose: () => void;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
  }
  return hash;
}

function normalizeVessel(
  v: SwarmVessel | VesselTrack | null,
  currentStage: string | null
): (SwarmVessel & { imo?: string }) | null {
  if (!v) return null;
  const isAfterBacktrack = currentStage === "CULPRIT_LOCK" || currentStage === "CONTAINMENT_ROOM" || currentStage === "CASE_FILE";
  const isBacktrack = currentStage === "BACKTRACK_CORRIDOR";

  if ("position" in v && Array.isArray((v as SwarmVessel).position)) {
    const sv = v as SwarmVessel;
    const imo = sv.imo || `IMO ${9100000 + Math.abs(simpleHash(sv.id || sv.name)) % 800000}`;
    return { ...sv, imo };
  }
  const vt = v as VesselTrack;
  const ping = vt.pings?.[0];
  const pos = (ping?.position ?? vt.path?.[0] ?? [71.9, 19.28]) as [number, number];
  const isDark = !!(vt.isDarkVessel || vt.darkAnomaly);
  const imo = vt.imo || `IMO ${9100000 + Math.abs(simpleHash(vt.vesselId || vt.vesselName)) % 800000}`;

  // Calculation timing: do not show attribution score before backtrack/attribution is calculated!
  let darkRiskScore: string | undefined = undefined;
  if (isAfterBacktrack) {
    darkRiskScore =
      vt.darkAnomaly?.gapDurationHours === 14
        ? "92 / 100 (HIGH PROBABILITY)"
        : vt.darkAnomaly?.gapDurationHours === 4
        ? "78 / 100 (ELEVATED)"
        : vt.darkAnomaly?.gapDurationHours === 9
        ? "85 / 100 (HIGH)"
        : vt.darkAnomaly?.gapDurationHours === 22
        ? "89 / 100 (HIGH)"
        : isDark
        ? "90 / 100 (HIGH)"
        : undefined;
  } else if (isBacktrack) {
    darkRiskScore = "Evaluating corridor drift…";
  } else {
    darkRiskScore = "Pending attribution calculation";
  }

  const darkLastSeen = vt.darkAnomaly?.gapDurationHours
    ? `${vt.darkAnomaly.gapDurationHours}h ago (Signal Lost)`
    : ping?.timestamp ?? "06:00:00 UTC";

  return {
    id: vt.vesselId,
    name: vt.vesselName,
    position: pos,
    speedKnots: ping?.sogKnots ?? (isDark ? vt.darkAnomaly?.estimatedTransitSpeedKnots ?? 0 : 12.5),
    heading: ping?.headingDegrees ?? 135,
    course: ping?.cogDegrees ?? ping?.headingDegrees ?? 135,
    vesselType: isDark ? "tanker" : vt.isCandidate ? "tanker" : "container",
    typeLabel: vt.vesselType,
    flag: vt.flag,
    mmsi: vt.mmsi,
    imo,
    callsign: vt.callsign ?? "UNKNOWN",
    destination: vt.destination,
    eta: vt.eta || "2026-05-15 14:00 UTC",
    lastSeen: isDark ? darkLastSeen : ping?.timestamp ?? "06:00:00 UTC",
    lengthMeters: vt.lengthMeters,
    beamMeters: vt.beamMeters,
    draughtMeters: vt.draughtMeters,
    navStatus: ping?.navStatus ?? (isDark ? "AIS Blackout" : "Underway using Engine"),
    isCandidate: vt.isCandidate,
    isDarkVessel: isDark,
    suspicionLevel: isAfterBacktrack ? (isDark ? "high" : vt.isCandidate ? "moderate" : "none") : "none",
    suspiciousReason: isAfterBacktrack
      ? (vt.darkAnomaly?.notes ?? (isDark ? "Radar contact correlated with SAR detection · AIS transponder disabled" : undefined))
      : undefined,
    threatTag: isAfterBacktrack
      ? (isDark ? "DARK TARGET · RADAR ONLY" : undefined)
      : isBacktrack
      ? "CORRIDOR CANDIDATE"
      : undefined,
    blackoutDurationHours: vt.darkAnomaly?.gapDurationHours,
    riskScore: isDark || vt.isCandidate ? darkRiskScore : undefined,
    trajectory: vt.path && vt.path.length > 0 ? vt.path : [pos],
  };
}

export const VesselInfoPanel: React.FC<VesselInfoPanelProps> = ({ vessel: rawVessel, onClose }) => {
  const [dockSide, setDockSide] = useState<"left" | "right">("left");
  let currentStage: string | null = null;
  let isDarkTheme = false;
  try {
    const mission = useMission();
    currentStage = mission.state.currentStage;
    isDarkTheme = mission.state.theme === "dark";
  } catch {
    currentStage = null;
    isDarkTheme = false;
  }

  const isAfterBacktrack = currentStage === "CULPRIT_LOCK" || currentStage === "CONTAINMENT_ROOM" || currentStage === "CASE_FILE";
  const isBacktrack = currentStage === "BACKTRACK_CORRIDOR";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const vessel = normalizeVessel(rawVessel, currentStage);
  if (!vessel) return null;

  const isDark = !!(vessel.isDarkVessel || vessel.suspicionLevel === "high");
  const pos = vessel.position || [71.9, 19.28];
  const lng = typeof pos[0] === "number" ? pos[0] : 71.9;
  const lat = typeof pos[1] === "number" ? pos[1] : 19.28;
  const speed = typeof vessel.speedKnots === "number" ? vessel.speedKnots : 0;
  const heading = vessel.heading ?? 135;
  const course = vessel.course ?? heading;
  const lengthMeters = vessel.lengthMeters ?? (isDark ? 175 : 200);
  const beamMeters = vessel.beamMeters ?? (isDark ? 28 : 32);
  const draughtMeters = vessel.draughtMeters ?? (isDark ? 9.8 : 10.5);

  const headerTag =
    isAfterBacktrack && vessel.mmsi === "419000101"
      ? "PRIMARY ATTRIBUTED CULPRIT"
      : isBacktrack && vessel.mmsi === "419000101"
      ? "CORRIDOR CANDIDATE VESSEL"
      : isDark
      ? "SAR RADAR CONTACT (UNIDENTIFIED)"
      : vessel.mmsi === "419000202"
      ? "CONTROL VESSEL"
      : "AIS VESSEL TELEMETRY";

  return (
    <div
      className="animate-in fade-in zoom-in-95 duration-200"
      style={{
        position: "absolute",
        top: "76px",
        left: dockSide === "left" ? (currentStage === "AIS_SWARM" ? "334px" : "14px") : undefined,
        right: dockSide === "right" ? "14px" : undefined,
        zIndex: 40,
        width: "330px",
        maxHeight: "calc(100vh - 96px)",
        display: "flex",
        flexDirection: "column",
        backgroundColor: isDarkTheme ? "#0F172A" : "#FFFFFF",
        border: `1px solid ${isDarkTheme ? "#1E293B" : "#E2E8F0"}`,
        borderTop: isDark ? "3px solid #DC2626" : `3px solid ${isDarkTheme ? "#F8FAFC" : "#0F172A"}`,
        borderRadius: "4px",
        boxShadow: isDarkTheme
          ? "0 12px 28px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.3)"
          : "0 12px 28px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: isDarkTheme ? "#F8FAFC" : "#0F172A",
        pointerEvents: "auto",
        transition: "left 0.2s ease, right 0.2s ease",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${isDarkTheme ? "#1E293B" : "#E2E8F0"}`,
          backgroundColor: isDarkTheme
            ? (isDark ? "#281216" : "#1E293B")
            : (isDark ? "#FEF2F2" : "#F8FAFC"),
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
                backgroundColor: isDark ? "#DC2626" : (isDarkTheme ? "#F8FAFC" : "#0F172A"),
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: isDark ? "#DC2626" : (isDarkTheme ? "#94A3B8" : "#64748B"),
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {headerTag}
            </span>
          </div>

          <h3
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: isDarkTheme ? "#F8FAFC" : "#0F172A",
              margin: 0,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={vessel.name || "Target"}
          >
            {vessel.name || "UNIDENTIFIED TARGET"}
          </h3>

          <div style={{ fontSize: "10px", color: isDarkTheme ? "#94A3B8" : "#64748B", marginTop: "2px" }}>
            {vessel.typeLabel || "Commercial Vessel"} • {vessel.flag || "International Registry"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setDockSide((prev) => (prev === "left" ? "right" : "left"))}
            style={{
              background: "transparent",
              border: `1px solid ${isDarkTheme ? "#334155" : "#CBD5E1"}`,
              borderRadius: "3px",
              padding: "2px 6px",
              fontSize: "9px",
              fontFamily: "ui-monospace, monospace",
              fontWeight: 600,
              color: isDarkTheme ? "#94A3B8" : "#64748B",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
            title={`Dock panel to ${dockSide === "left" ? "Right side" : "Left side"}`}
          >
            ⇄ {dockSide === "left" ? "DOCK RIGHT" : "DOCK LEFT"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: isDarkTheme ? "#94A3B8" : "#64748B",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "3px",
            }}
            title="Close panel"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Anomaly Banner (if dark or high-suspicion) ── */}
      {isDark && (
        <div
          style={{
            margin: "8px 10px 0 10px",
            padding: "8px 10px",
            backgroundColor: isDarkTheme ? "#281216" : "#FEF2F2",
            border: `1px solid ${isDarkTheme ? "#7F1D1D" : "#FCA5A5"}`,
            borderRadius: "3px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#DC2626", fontSize: "10px", fontWeight: 700 }}>
              <AlertTriangle size={12} />
              <span>{vessel.threatTag || "CFAR RADAR DETECTION"}</span>
            </div>
            <span
              style={{
                fontSize: "8.5px",
                color: "#DC2626",
                border: `1px solid ${isDarkTheme ? "#7F1D1D" : "#FCA5A5"}`,
                padding: "1px 5px",
                borderRadius: "2px",
                fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              RISK: {vessel.riskScore || "CALCULATING"}
            </span>
          </div>
          <div style={{ fontSize: "9px", color: isDarkTheme ? "#FCA5A5" : "#991B1B", lineHeight: 1.35 }}>
            {vessel.suspiciousReason || "AIS transponder inactive during passage through observation corridor."}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          overflowY: "auto",
          flex: 1,
        }}
      >
        {/* Position Grid */}
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, color: isDarkTheme ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px", fontFamily: "ui-monospace, monospace" }}>
            LIVE COORDINATES
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: isDarkTheme ? "#1E293B" : "#F8FAFC",
              padding: "8px 10px",
              borderRadius: "3px",
              border: `1px solid ${isDarkTheme ? "#334155" : "#E2E8F0"}`,
            }}
          >
            <div>
              <span style={{ fontSize: "8px", color: isDarkTheme ? "#94A3B8" : "#64748B", display: "block", fontFamily: "ui-monospace, monospace" }}>LATITUDE</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontFamily: "ui-monospace, monospace" }}>
                {lat.toFixed(4)}°N
              </span>
            </div>
            <div style={{ width: "1px", height: "22px", backgroundColor: isDarkTheme ? "#334155" : "#CBD5E1" }} />
            <div>
              <span style={{ fontSize: "8px", color: isDarkTheme ? "#94A3B8" : "#64748B", display: "block", fontFamily: "ui-monospace, monospace" }}>LONGITUDE</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontFamily: "ui-monospace, monospace" }}>
                {lng.toFixed(4)}°E
              </span>
            </div>
            <div style={{ width: "1px", height: "22px", backgroundColor: isDarkTheme ? "#334155" : "#CBD5E1" }} />
            <div>
              <span style={{ fontSize: "8px", color: isDarkTheme ? "#94A3B8" : "#64748B", display: "block", fontFamily: "ui-monospace, monospace" }}>FORMAT</span>
              <span style={{ fontSize: "9px", fontWeight: 600, color: isDark ? "#DC2626" : (isDarkTheme ? "#F8FAFC" : "#0F172A"), fontFamily: "ui-monospace, monospace" }}>
                {lat.toFixed(3)}°N, {lng.toFixed(3)}°E
              </span>
            </div>
          </div>
        </div>

        {/* Movement / Speed / Heading */}
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, color: isDarkTheme ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px", fontFamily: "ui-monospace, monospace" }}>
            {isDark ? "RADAR NAVIGATION ESTIMATE" : "NAVIGATION & DYNAMICS"}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "6px",
              backgroundColor: isDarkTheme ? "#1E293B" : "#F8FAFC",
              padding: "8px 10px",
              borderRadius: "3px",
              border: `1px solid ${isDarkTheme ? "#334155" : "#E2E8F0"}`,
            }}
          >
            <div>
              <span style={{ fontSize: "8px", color: isDarkTheme ? "#94A3B8" : "#64748B", display: "block", fontFamily: "ui-monospace, monospace" }}>
                {isDark ? "EST. SPEED" : "SPEED (SOG)"}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: isDark ? "#DC2626" : (isDarkTheme ? "#F8FAFC" : "#0F172A"), fontFamily: "ui-monospace, monospace" }}>
                {speed.toFixed(1)} kn
              </span>
            </div>
            <div>
              <span style={{ fontSize: "8px", color: isDarkTheme ? "#94A3B8" : "#64748B", display: "block", fontFamily: "ui-monospace, monospace" }}>COURSE (COG)</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontFamily: "ui-monospace, monospace" }}>
                {course}°
              </span>
            </div>
            <div>
              <span style={{ fontSize: "8px", color: isDarkTheme ? "#94A3B8" : "#64748B", display: "block", fontFamily: "ui-monospace, monospace" }}>HEADING</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontFamily: "ui-monospace, monospace" }}>
                {heading}°
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry / Identity Breakdown */}
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, color: isDarkTheme ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px", fontFamily: "ui-monospace, monospace" }}>
            {isDark ? "RADAR CONTACT & CORRELATION" : "VOYAGE & IDENTIFICATION"}
          </div>
          <div
            style={{
              backgroundColor: isDarkTheme ? "#1E293B" : "#F8FAFC",
              padding: "8px 10px",
              borderRadius: "3px",
              border: `1px solid ${isDark ? (isDarkTheme ? "#7F1D1D" : "#FCA5A5") : (isDarkTheme ? "#334155" : "#E2E8F0")}`,
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              fontSize: "10px",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {isDark ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>CFAR CONTACT ID:</span>
                  <span style={{ color: "#DC2626", fontWeight: 700 }}>{vessel.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>BLACKOUT DURATION:</span>
                  <span style={{ color: "#DC2626", fontWeight: 700 }}>
                    {vessel.blackoutDurationHours ? `${vessel.blackoutDurationHours} HOURS` : "14.0 HOURS"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>LAST AIS SIGNAL:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontWeight: 600 }}>{vessel.lastSeen}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>ATTRIBUTION STATUS:</span>
                  <span style={{ color: "#DC2626", fontWeight: 700 }}>{vessel.riskScore || "EVALUATING"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>TRANSPONDER STATE:</span>
                  <span style={{ color: "#DC2626", fontWeight: 600 }}>INACTIVE / BLACKOUT</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>SENSOR DETECT:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontWeight: 500 }}>Sentinel-1A SAR Radar</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>FLAG / REGISTRY:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontWeight: 500 }}>{vessel.flag || "Unregistered / Unknown"}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>MMSI:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontWeight: 600 }}>{vessel.mmsi || "N/A"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>IMO NUMBER:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontWeight: 600 }}>{vessel.imo || "IMO 9482104"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>CALL SIGN:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontWeight: 600 }}>{vessel.callsign || "UNKNOWN"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>FLAG / REGISTRY:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontWeight: 600 }}>{vessel.flag || "International"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>AIS STATUS:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A", fontWeight: 600 }}>
                    {vessel.navStatus || "Underway using Engine"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>DESTINATION:</span>
                  <span
                    style={{
                      color: isDarkTheme ? "#F8FAFC" : "#0F172A",
                      fontWeight: 600,
                      maxWidth: "160px",
                      textAlign: "right",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {vessel.destination || "UNREPORTED"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>EST. ARRIVAL (ETA):</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A" }}>{vessel.eta || "2026-05-15 14:00 UTC"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>LAST AIS PING:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A" }}>{vessel.lastSeen || "06:00:00 UTC"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>DIMENSIONS:</span>
                  <span style={{ color: isDarkTheme ? "#F8FAFC" : "#0F172A" }}>
                    {lengthMeters}m × {beamMeters}m (d: {draughtMeters}m)
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Trajectory Status Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            backgroundColor: isDark ? (isDarkTheme ? "#281216" : "#FEF2F2") : (isDarkTheme ? "#1E293B" : "#F8FAFC"),
            border: `1px solid ${isDark ? (isDarkTheme ? "#7F1D1D" : "#FCA5A5") : (isDarkTheme ? "#334155" : "#E2E8F0")}`,
            borderRadius: "3px",
            fontSize: "9px",
            fontFamily: "ui-monospace, monospace",
            color: isDark ? "#DC2626" : (isDarkTheme ? "#F8FAFC" : "#0F172A"),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: isDark ? "#DC2626" : (isDarkTheme ? "#F8FAFC" : "#0F172A"),
                display: "inline-block",
              }}
            />
            <span style={{ fontWeight: 600 }}>TRAJECTORY ACTIVE</span>
          </div>
          <span style={{ color: isDarkTheme ? "#94A3B8" : "#64748B" }}>
            {vessel.mmsi === "419000101" || vessel.mmsi === "419000202"
              ? "289 AIS WAYPOINTS"
              : `${vessel.trajectory?.length || 4} WAYPOINTS`}
          </span>
        </div>
      </div>
    </div>
  );
};
