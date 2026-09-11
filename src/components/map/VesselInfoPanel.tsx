import React, { useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import type { SwarmVessel } from "@/lib/mission/swarmData";
import { Panel, PanelHeader, DataRow, SectionLabel, T } from "@/components/ui/PanelKit";

export interface VesselInfoPanelProps {
  vessel: SwarmVessel | null;
  onClose: () => void;
}

export const VesselInfoPanel: React.FC<VesselInfoPanelProps> = ({ vessel, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!vessel) return null;

  const isDark = vessel.isDarkVessel || vessel.suspicionLevel === "high";
  const pos = vessel.position || [71.9, 19.28];
  const lng = typeof pos[0] === "number" ? pos[0] : 71.9;
  const lat = typeof pos[1] === "number" ? pos[1] : 19.28;
  const speed = typeof vessel.speedKnots === "number" ? vessel.speedKnots : 0;
  const heading = vessel.heading ?? 135;
  const course = vessel.course ?? heading;
  const lengthMeters = vessel.lengthMeters ?? (isDark ? 175 : 200);
  const beamMeters = vessel.beamMeters ?? (isDark ? 28 : 32);
  const draughtMeters = vessel.draughtMeters ?? (isDark ? 9.8 : 10.5);

  const statusTitle = vessel.mmsi === "419000101"
    ? "PRIMARY ATTRIBUTED CULPRIT"
    : vessel.isDarkVessel
      ? "SAR RADAR CONTACT (DARK VESSEL)"
      : vessel.mmsi === "419000202"
        ? "CLEARED CONTROL VESSEL"
        : "SIMULATED CORRIDOR TRAFFIC";

  const accentColor = isDark ? T.red : T.sky;

  return (
    <div
      className="panel-slide-in"
      style={{
        position: "absolute",
        top: 76,
        right: 14,
        zIndex: 30,
        width: 335,
        pointerEvents: "auto",
      }}
    >
      <Panel accentColor={accentColor}>
        {/* Header */}
        <div style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${T.border}`,
          backgroundColor: isDark ? "rgba(239, 68, 68, 0.08)" : T.bgHeader,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start"
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', backgroundColor: accentColor,
                boxShadow: `0 0 8px ${accentColor}`,
              }} />
              <span style={{
                fontFamily: T.fontMono, fontSize: 10, fontWeight: 700, color: accentColor,
                letterSpacing: "0.08em", textTransform: "uppercase",
              }}>
                {statusTitle}
              </span>
            </div>
            <div style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 700, color: T.brightText, marginBottom: 2 }}>
              {vessel.name}
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.midText }}>
              {vessel.typeLabel} · {vessel.flag}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: T.midText,
              cursor: 'pointer', padding: 4, display: 'flex'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Anomaly Banner */}
        {isDark && vessel.suspiciousReason && (
          <div style={{ padding: '10px 14px 0 14px' }}>
            <div style={{
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: 2, padding: "8px 10px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.red, fontFamily: T.fontMono, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                <AlertTriangle size={12} />
                {vessel.threatTag || "ANOMALY DETECTED"}
              </div>
              <div style={{ fontFamily: T.fontSans, fontSize: 11, color: "#FCA5A5", lineHeight: 1.4 }}>
                {vessel.suspiciousReason}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: "12px 14px" }}>
          {/* Position & Movement */}
          <SectionLabel>Live Telemetry</SectionLabel>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16
          }}>
            <div style={{ backgroundColor: T.bgElevated, border: `1px solid ${T.border}`, padding: '8px', borderRadius: 2 }}>
              <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 2 }}>Coordinates</div>
              <div style={{ fontFamily: T.fontMono, fontSize: 12, color: T.brightText, fontWeight: 600 }}>
                {lat.toFixed(4)}°N <span style={{ color: T.dimText }}>/</span> {lng.toFixed(4)}°E
              </div>
            </div>
            <div style={{ backgroundColor: T.bgElevated, border: `1px solid ${T.border}`, padding: '8px', borderRadius: 2 }}>
              <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 2 }}>Kinematics</div>
              <div style={{ fontFamily: T.fontMono, fontSize: 12, color: accentColor, fontWeight: 600 }}>
                {speed.toFixed(1)}kts <span style={{ color: T.dimText }}>@</span> {heading}°
              </div>
            </div>
          </div>

          {/* Identification */}
          <SectionLabel>Voyage & Identification</SectionLabel>
          <div style={{ backgroundColor: 'rgba(56,189,248,0.02)', border: `1px solid ${T.border}`, borderRadius: 2, padding: '4px 0' }}>
            <DataRow label="MMSI" value={vessel.mmsi || "N/A"} />
            <DataRow label="Call Sign" value={vessel.callsign || "UNKNOWN"} />
            <DataRow label="Status" value={vessel.navStatus || (isDark ? "AIS Blackout" : "Underway")} valueColor={accentColor} />
            <DataRow label="Destination" value={vessel.destination || "UNREPORTED"} />
            <DataRow label="Last Signal" value={vessel.lastSeen || "06:00:00 UTC"} />
            <DataRow label="Dimensions" value={`${lengthMeters}m × ${beamMeters}m`} borderBottom={false} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "8px 14px",
          backgroundColor: T.bgHeader,
          borderTop: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: T.sky }} />
            <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.sky, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Trajectory Active
            </span>
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.midText }}>
            {vessel.mmsi === "419000101" || vessel.mmsi === "419000202" ? "289 Waypoints" : `${vessel.trajectory?.length || 4} Waypoints`}
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default VesselInfoPanel;
