import { useState } from "react";
import type { VesselTrack } from "@/lib/contracts/p5";

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
    <div
      style={{
        background: "#0D1117",
        border: "1px solid #EF4444",  // Red border — this is the ONE red UI element
        borderRadius: "2px",
        padding: "10px 12px",
        color: "#C8D8E8",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: isCollapsed ? "none" : "1px solid #1C2A38",
          paddingBottom: isCollapsed ? 0 : 8,
          marginBottom: isCollapsed ? 0 : 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Red alert indicator — pulsing dot */}
          <span
            style={{
              width: 8,
              height: 8,
              background: "#EF4444",
              borderRadius: "50%",
              flexShrink: 0,
              animation: "pulse-ring-inner 1.8s ease-in-out infinite",
            }}
          />
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "9px",
                color: "#EF4444",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontWeight: 700,
              }}
            >
              Alert — Dark Vessel Detected
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                color: "#5A7A94",
                marginTop: 2,
              }}
            >
              {darkVessels.length} vessel{darkVessels.length > 1 ? "s" : ""} · AIS blackout · SAR CFAR match
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 3 }}>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              width: 20,
              height: 20,
              border: "1px solid #1C2A38",
              background: "transparent",
              color: "#3A5268",
              cursor: "pointer",
              borderRadius: 0,
              fontSize: "9px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? "▼" : "▲"}
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            style={{
              width: 20,
              height: 20,
              border: "1px solid #1C2A38",
              background: "transparent",
              color: "#3A5268",
              cursor: "pointer",
              borderRadius: 0,
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            title="Dismiss alert"
          >
            ×
          </button>
        </div>
      </div>

      {/* Alert content */}
      <div
        style={{
          maxHeight: isCollapsed ? 0 : 400,
          overflow: "hidden",
          transition: "max-height 220ms ease",
        }}
      >
        {darkVessels.map((vessel) => {
          const anomaly = vessel.darkAnomaly!;
          const isFocused = selectedVesselId === vessel.vesselId;

          return (
            <div
              key={vessel.vesselId}
              style={{
                border: `1px solid ${isFocused ? "#EF4444" : "#1C2A38"}`,
                background: isFocused ? "#EF444408" : "#080C12",
                borderRadius: "2px",
                padding: "8px",
                marginBottom: 4,
                transition: "border-color 200ms, background 200ms",
              }}
            >
              {/* Vessel ID row + focus button */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 7,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11px",
                      color: "#E2E8F0",
                      fontWeight: 700,
                    }}
                  >
                    {vessel.vesselName}
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "8.5px",
                      color: "#5A7A94",
                      marginTop: 2,
                    }}
                  >
                    SAR CFAR Detection · No AIS record
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onFocusVessel?.(vessel.vesselId)}
                  style={{
                    height: 22,
                    padding: "0 8px",
                    background: "#EF444418",
                    border: "1px solid #EF4444",
                    borderRadius: 0,
                    color: "#EF4444",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "8px",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.08em",
                    flexShrink: 0,
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  Focus Map
                </button>
              </div>

              {/* 3-cell telemetry grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                {/* Gap duration */}
                <div
                  style={{
                    border: "1px solid #1C2A38",
                    background: "#0A0E14",
                    padding: "5px 6px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "7.5px",
                      color: "#5A7A94",
                      marginBottom: 2,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.05em",
                    }}
                  >
                    Blackout Gap
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "10px",
                      color: "#EF4444",
                      fontWeight: 700,
                    }}
                  >
                    {anomaly.gapDurationHours.toFixed(1)}h
                  </div>
                </div>

                {/* Corridor match */}
                <div
                  style={{
                    border: "1px solid #1C2A38",
                    background: "#0A0E14",
                    padding: "5px 6px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "7.5px",
                      color: "#5A7A94",
                      marginBottom: 2,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.05em",
                    }}
                  >
                    H3 Match
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "10px",
                      color: anomaly.spillCorridorIntersection ? "#22D3EE" : "#3A5268",
                      fontWeight: 700,
                    }}
                  >
                    {anomaly.spillCorridorIntersection ? "Confirmed" : "None"}
                  </div>
                </div>

                {/* Radar correlated */}
                <div
                  style={{
                    border: "1px solid #1C2A38",
                    background: "#0A0E14",
                    padding: "5px 6px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "7.5px",
                      color: "#5A7A94",
                      marginBottom: 2,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.05em",
                    }}
                  >
                    Radar
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "10px",
                      color: anomaly.radarContactCorrelated ? "#22D3EE" : "#3A5268",
                      fontWeight: 700,
                    }}
                  >
                    {anomaly.radarContactCorrelated ? "Correlated" : "None"}
                  </div>
                </div>
              </div>

              {/* Forensic note */}
              <div
                style={{
                  border: "1px solid #1C2A3880",
                  background: "#080C12",
                  padding: "6px 7px",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "9px",
                  color: "#5A7A94",
                  lineHeight: 1.5,
                  borderRadius: "2px",
                }}
              >
                <span
                  style={{
                    color: "#C8D8E8",
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "8px",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                  }}
                >
                  Forensic Note:{" "}
                </span>
                {anomaly.notes}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
