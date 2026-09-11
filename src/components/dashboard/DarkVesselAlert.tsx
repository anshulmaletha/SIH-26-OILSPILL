import { useState } from "react";
import type { VesselTrack } from "@/lib/contracts/p5";
import { Panel, PanelHeader, T } from "@/components/ui/PanelKit";
import { AlertTriangle, MapPin } from "lucide-react";

export interface DarkVesselAlertProps {
  vessels?: VesselTrack[];
  selectedVesselId?: string;
  onFocusVessel?: (vesselId: string) => void;
}

export function DarkVesselAlert({
  vessels = [],
  selectedVesselId,
  onFocusVessel,
}: DarkVesselAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const darkVessels = vessels.filter((v) => v.isDarkVessel && v.darkAnomaly);

  if (darkVessels.length === 0 || isDismissed) return null;

  return (
    <Panel style={{ border: `1px solid ${T.red}` }} accentColor={T.red}>
      <PanelHeader
        label={`Alert — Dark Vessel Detected (${darkVessels.length})`}
        color={T.red}
        compact
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{ background: 'none', border: 'none', color: T.dimText, cursor: 'pointer', fontSize: 10 }}
            >
              {isCollapsed ? "▼" : "▲"}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              style={{ background: 'none', border: 'none', color: T.dimText, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        }
      />

      {!isCollapsed && (
        <div style={{ padding: "10px 14px", animation: "fadeIn 0.2s ease" }}>
          {darkVessels.map((vessel) => {
            const anomaly = vessel.darkAnomaly!;
            const isFocused = selectedVesselId === vessel.vesselId;

            return (
              <div
                key={vessel.vesselId}
                style={{
                  border: `1px solid ${isFocused ? T.red : T.border}`,
                  background: isFocused ? "rgba(239, 68, 68, 0.08)" : T.bgElevated,
                  borderRadius: 2,
                  padding: 10,
                  marginBottom: 6,
                  transition: "border-color 200ms, background 200ms",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: T.fontSans, fontSize: 13, fontWeight: 700, color: T.brightText }}>
                      {vessel.vesselName}
                    </div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.midText, marginTop: 2 }}>
                      SAR CFAR Detection · No AIS record
                    </div>
                  </div>
                  <button
                    onClick={() => onFocusVessel?.(vessel.vesselId)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "rgba(239, 68, 68, 0.1)", border: `1px solid ${T.red}`,
                      color: T.red, padding: "4px 8px", borderRadius: 2,
                      fontFamily: T.fontMono, fontSize: 10, textTransform: "uppercase", cursor: "pointer"
                    }}
                  >
                    <MapPin size={12} /> Map
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, padding: "6px 8px", borderRadius: 2 }}>
                    <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 2 }}>Blackout Gap</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color: T.red }}>{anomaly.gapDurationHours.toFixed(1)}h</div>
                  </div>
                  <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, padding: "6px 8px", borderRadius: 2 }}>
                    <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 2 }}>H3 Match</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: anomaly.spillCorridorIntersection ? T.sky : T.dimText }}>
                      {anomaly.spillCorridorIntersection ? "Confirmed" : "None"}
                    </div>
                  </div>
                  <div style={{ background: T.bgPanel, border: `1px solid ${T.border}`, padding: "6px 8px", borderRadius: 2 }}>
                    <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 2 }}>Radar Match</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 700, color: anomaly.radarContactCorrelated ? T.sky : T.dimText }}>
                      {anomaly.radarContactCorrelated ? "Correlated" : "None"}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: T.bgPanel, border: `1px solid ${T.border}`, padding: "8px 10px",
                  borderRadius: 2, fontFamily: T.fontSans, fontSize: 11, color: T.bodyText, lineHeight: 1.4
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.red, fontFamily: T.fontMono, fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                    <AlertTriangle size={12} /> FORENSIC NOTE
                  </div>
                  {anomaly.notes}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export default DarkVesselAlert;
