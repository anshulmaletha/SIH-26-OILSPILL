import React, { useEffect } from "react";
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

export interface VesselInfoPanelProps {
  vessel: SwarmVessel | VesselTrack | null;
  onClose: () => void;
}

function normalizeVessel(v: SwarmVessel | VesselTrack | null): (SwarmVessel & { imo?: string }) | null {
  if (!v) return null;
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

  const darkRiskScore =
    vt.darkAnomaly?.gapDurationHours === 14
      ? "92 / 100 (CRITICAL)"
      : vt.darkAnomaly?.gapDurationHours === 4
      ? "78 / 100 (HIGH)"
      : vt.darkAnomaly?.gapDurationHours === 9
      ? "85 / 100 (HIGH)"
      : vt.darkAnomaly?.gapDurationHours === 22
      ? "89 / 100 (HIGH)"
      : isDark
      ? "90 / 100 (HIGH)"
      : undefined;

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
    suspicionLevel: isDark ? "high" : vt.isCandidate ? "moderate" : "none",
    suspiciousReason:
      vt.darkAnomaly?.notes ??
      (isDark ? "Radar contact correlated with SAR detection · AIS transponder disabled" : undefined),
    threatTag: isDark ? "DARK TARGET · RADAR ONLY" : undefined,
    blackoutDurationHours: vt.darkAnomaly?.gapDurationHours,
    riskScore: isDark ? darkRiskScore : undefined,
    trajectory: vt.path && vt.path.length > 0 ? vt.path : [pos],
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export const VesselInfoPanel: React.FC<VesselInfoPanelProps> = ({ vessel: rawVessel, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const vessel = normalizeVessel(rawVessel);
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
    vessel.mmsi === "419000101"
      ? "⚠ PRIMARY ATTRIBUTED CULPRIT"
      : isDark
      ? "⚠ SAR RADAR CONTACT (DARK VESSEL)"
      : vessel.mmsi === "419000202"
      ? "✓ CLEARED CONTROL VESSEL"
      : "AIS VESSEL TELEMETRY";

  return (
    <div
      className="animate-in fade-in zoom-in-95 duration-200"
      style={{
        position: "absolute",
        top: "76px",
        right: "14px",
        zIndex: 35,
        width: "325px",
        backgroundColor: "rgba(13, 17, 23, 0.95)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${isDark ? "#EF4444" : "#1C2A38"}`,
        borderTop: `3px solid ${isDark ? "#EF4444" : "#22D3EE"}`,
        borderRadius: "3px",
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
              {headerTag}
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
            title={vessel.name || "Target"}
          >
            {vessel.name || "UNIDENTIFIED TARGET"}
          </h3>

          <div style={{ fontSize: "9px", color: "#5A7A94", marginTop: "2px" }}>
            {vessel.typeLabel || "Commercial Vessel"} • {vessel.flag || "International Registry"}
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
          <X size={15} />
        </button>
      </div>

      {/* ── Anomaly Banner (if dark or high-suspicion) ── */}
      {isDark && (
        <div
          style={{
            margin: "8px 10px 0 10px",
            padding: "8px",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: "3px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#EF4444", fontSize: "9px", fontWeight: 700 }}>
              <AlertTriangle size={12} />
              <span>{vessel.threatTag || "CFAR ANOMALY DETECTED"}</span>
            </div>
            <span
              style={{
                fontSize: "8px",
                color: "#EF4444",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                padding: "1px 5px",
                borderRadius: "2px",
                fontWeight: 700,
              }}
            >
              RISK: {vessel.riskScore || "HIGH"}
            </span>
          </div>
          <div style={{ fontSize: "8.5px", color: "#FCA5A5", lineHeight: 1.35 }}>
            {vessel.suspiciousReason || "AIS transponder inactive during passage through observation corridor."}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Position Grid */}
        <div>
          <div style={{ fontSize: "8px", color: "#5A7A94", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            LIVE COORDINATES
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#111822",
              padding: "7px 10px",
              borderRadius: "3px",
              border: "1px solid #1C2A38",
            }}
          >
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>LATITUDE</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF" }}>
                {lat.toFixed(4)}°N
              </span>
            </div>
            <div style={{ width: "1px", height: "20px", backgroundColor: "#1C2A38" }} />
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>LONGITUDE</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#FFFFFF" }}>
                {lng.toFixed(4)}°E
              </span>
            </div>
            <div style={{ width: "1px", height: "20px", backgroundColor: "#1C2A38" }} />
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>POSITION FORMAT</span>
              <span style={{ fontSize: "9px", fontWeight: 600, color: isDark ? "#EF4444" : "#22D3EE" }}>
                {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
              </span>
            </div>
          </div>
        </div>

        {/* Movement / Speed / Heading */}
        <div>
          <div style={{ fontSize: "8px", color: "#5A7A94", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            {isDark ? "ANOMALY NAVIGATION TELEMETRY" : "NAVIGATION & DYNAMICS"}
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
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>
                {isDark ? "EST. SPEED" : "SPEED (SOG)"}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: isDark ? "#EF4444" : "#22D3EE" }}>
                {speed.toFixed(1)} kn
              </span>
            </div>
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>COURSE (COG)</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#C8D8E8" }}>
                {course}°
              </span>
            </div>
            <div>
              <span style={{ fontSize: "7.5px", color: "#5A7A94", display: "block" }}>HEADING</span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#C8D8E8" }}>
                {heading}°
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry / Identity Breakdown */}
        <div>
          <div style={{ fontSize: "8px", color: "#5A7A94", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            {isDark ? "DARK TARGET & SENSOR CORRELATION" : "VOYAGE & IDENTIFICATION"}
          </div>
          <div
            style={{
              backgroundColor: "#111822",
              padding: "6px 8px",
              borderRadius: "3px",
              border: `1px solid ${isDark ? "rgba(239, 68, 68, 0.25)" : "#1C2A38"}`,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "9px",
            }}
          >
            {isDark ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>CFAR CONTACT ID:</span>
                  <span style={{ color: "#EF4444", fontWeight: 700 }}>{vessel.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>BLACKOUT DURATION:</span>
                  <span style={{ color: "#EF4444", fontWeight: 700 }}>
                    {vessel.blackoutDurationHours ? `${vessel.blackoutDurationHours} HOURS` : "14.0 HOURS"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>LAST AIS SIGNAL:</span>
                  <span style={{ color: "#FCA5A5", fontWeight: 600 }}>{vessel.lastSeen}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>RISK / CONFIDENCE:</span>
                  <span style={{ color: "#EF4444", fontWeight: 700 }}>{vessel.riskScore || "92 / 100"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>TRANSPONDER STATE:</span>
                  <span style={{ color: "#EF4444", fontWeight: 600 }}>INACTIVE / BLACKOUT</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>SENSOR DETECT:</span>
                  <span style={{ color: "#C8D8E8", fontWeight: 500 }}>Sentinel-1A SAR Radar</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>FLAG / REGISTRY:</span>
                  <span style={{ color: "#C8D8E8", fontWeight: 500 }}>{vessel.flag || "Unregistered / Unknown"}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>MMSI:</span>
                  <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{vessel.mmsi || "N/A"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>IMO NUMBER:</span>
                  <span style={{ color: "#C8D8E8", fontWeight: 600 }}>{vessel.imo || "IMO 9482104"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>CALL SIGN:</span>
                  <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{vessel.callsign || "UNKNOWN"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>FLAG / REGISTRY:</span>
                  <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{vessel.flag || "International"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>AIS STATUS:</span>
                  <span style={{ color: "#22D3EE", fontWeight: 600 }}>
                    {vessel.navStatus || "Underway using Engine"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>DESTINATION:</span>
                  <span
                    style={{
                      color: "#FFFFFF",
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
                  <span style={{ color: "#5A7A94" }}>EST. ARRIVAL (ETA):</span>
                  <span style={{ color: "#C8D8E8" }}>{vessel.eta || "2026-05-15 14:00 UTC"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>LAST AIS PING:</span>
                  <span style={{ color: "#C8D8E8" }}>{vessel.lastSeen || "06:00:00 UTC"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#5A7A94" }}>DIMENSIONS:</span>
                  <span style={{ color: "#C8D8E8" }}>
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
            padding: "5px 8px",
            backgroundColor: isDark ? "rgba(239, 68, 68, 0.08)" : "rgba(34, 211, 238, 0.04)",
            border: `1px dashed ${isDark ? "#EF4444" : "#1C2A38"}`,
            borderRadius: "3px",
            fontSize: "8px",
            color: isDark ? "#EF4444" : "#22D3EE",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                backgroundColor: isDark ? "#EF4444" : "#22D3EE",
                display: "inline-block",
              }}
            />
            <span>HISTORICAL TRAJECTORY TRAIL ACTIVE</span>
          </div>
          <span style={{ color: "#5A7A94" }}>
            {vessel.mmsi === "419000101" || vessel.mmsi === "419000202"
              ? "289 AIS WAYPOINTS (5-MIN EPOCHS)"
              : `${vessel.trajectory?.length || 4} WAYPOINTS`}
          </span>
        </div>
      </div>
    </div>
  );
};
