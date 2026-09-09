import { useState } from "react";
import { LAYER_META, type LayerId, TRACK_COLOR_OPTIONS } from "@/lib/map/config";
import type { VesselTrack } from "@/lib/contracts/p5";
import { MapLegend } from "./MapLegend";

const LAYER_TYPE_LABELS: Record<LayerId, string> = {
  "sar-raster":    "SAR",
  "slick-polygon": "SLICK",
  "h3-corridor":   "H3",
  "ais-tracks":    "AIS",
};

export interface LayerPanelProps {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  sarOpacity?: number | undefined;
  onChangeSarOpacity?: ((opacity: number) => void) | undefined;
  vessels?: VesselTrack[] | undefined;
  selectedTrackId?: string | undefined;
  onSelectTrackId?: ((id: string) => void) | undefined;
  selectedTrackColorId?: string | undefined;
  onSelectTrackColorId?: ((colorId: string) => void) | undefined;
  followTrack?: boolean | undefined;
  onToggleFollowTrack?: ((enabled: boolean) => void) | undefined;
}

// ── Shared flat panel styles ───────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  width: 220,
  background: "#0D1117",
  border: "1px solid #1C2A38",
  borderRadius: "2px",
  color: "#C8D8E8",
  overflow: "hidden",
  fontFamily: "'Inter', 'Space Grotesk', sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 10px",
  background: "#0A0E14",
  borderBottom: "1px solid #1C2A38",
};

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "8px",
  color: "#3A5268",
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
  fontWeight: 700,
};

const collapseButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#3A5268",
  padding: "0 2px",
  fontSize: "10px",
  lineHeight: 1,
};

// ── 1. Layer Controls Card ─────────────────────────────────────────────────────
export function LayerControlsCard({
  visibility,
  onToggle,
  sarOpacity = 0.55,
  onChangeSarOpacity,
}: {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  sarOpacity?: number | undefined;
  onChangeSarOpacity?: ((opacity: number) => void) | undefined;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={sectionLabelStyle}>Layer Controls</span>
        <button
          type="button"
          style={collapseButtonStyle}
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Body — smooth fade/slide transition */}
      <div
        style={{
          maxHeight: isCollapsed ? 0 : 400,
          overflow: "hidden",
          opacity: isCollapsed ? 0 : 1,
          transition: "max-height 220ms ease, opacity 180ms ease",
        }}
      >
        <div style={{ padding: "8px 10px" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {LAYER_META.map((meta) => {
              const active = visibility[meta.id];
              return (
                <li key={meta.id} style={{ marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => onToggle(meta.id)}
                    aria-pressed={active}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 6px",
                      background: active ? "#111822" : "transparent",
                      border: `1px solid ${active ? "#1C2A38" : "transparent"}`,
                      borderRadius: "2px",
                      cursor: "pointer",
                      opacity: active ? 1 : 0.45,
                      transition: "opacity 200ms ease, background 200ms ease",
                      textAlign: "left",
                    }}
                  >
                    {/* Color dot */}
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        background: meta.color,
                        flexShrink: 0,
                        borderRadius: 0,
                      }}
                    />
                    {/* Label */}
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "11px",
                        color: "#C8D8E8",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {meta.label}
                    </span>
                    {/* Type tag */}
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "7.5px",
                        color: active ? "#22D3EE" : "#3A5268",
                        letterSpacing: "0.06em",
                        flexShrink: 0,
                      }}
                    >
                      {LAYER_TYPE_LABELS[meta.id]}
                    </span>
                    {/* Square checkbox-style toggle */}
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        border: `1px solid ${active ? "#22D3EE" : "#1C2A38"}`,
                        background: active ? "#22D3EE22" : "transparent",
                        flexShrink: 0,
                        borderRadius: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 200ms ease, border-color 200ms ease",
                      }}
                    >
                      {active && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            background: "#22D3EE",
                            borderRadius: 0,
                          }}
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* SAR opacity slider */}
          {visibility["sar-raster"] && onChangeSarOpacity && (
            <div
              style={{
                marginTop: 8,
                padding: "7px 6px",
                border: "1px solid #1C2A38",
                borderRadius: "2px",
                background: "#0A0E14",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <span style={{ ...sectionLabelStyle, color: "#5A7A94" }}>SAR Opacity</span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "9px",
                    color: "#22D3EE",
                  }}
                >
                  {Math.round(sarOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                className="scrubber"
                min={10}
                max={100}
                step={5}
                value={Math.round(sarOpacity * 100)}
                style={{
                  "--range-fill": `${Math.round(sarOpacity * 100)}%`,
                } as React.CSSProperties}
                onChange={(e) => onChangeSarOpacity(Number(e.target.value) / 100)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 2. Track Selection Card ────────────────────────────────────────────────────
export function TrackSelectionCard({
  vessels = [],
  selectedTrackId = "all",
  onSelectTrackId,
  selectedTrackColorId = "cyan",
  onSelectTrackColorId,
  followTrack = false,
  onToggleFollowTrack,
}: {
  vessels?: VesselTrack[] | undefined;
  selectedTrackId?: string | undefined;
  onSelectTrackId?: ((id: string) => void) | undefined;
  selectedTrackColorId?: string | undefined;
  onSelectTrackColorId?: ((colorId: string) => void) | undefined;
  followTrack?: boolean | undefined;
  onToggleFollowTrack?: ((enabled: boolean) => void) | undefined;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const aisVessels = vessels.filter((v) => !v.isDarkVessel);

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={sectionLabelStyle}>Track Selection</span>
        <button
          type="button"
          style={collapseButtonStyle}
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? "▼" : "▲"}
        </button>
      </div>

      <div
        style={{
          maxHeight: isCollapsed ? 0 : 400,
          overflow: "hidden",
          opacity: isCollapsed ? 0 : 1,
          transition: "max-height 220ms ease, opacity 180ms ease",
        }}
      >
        <div style={{ padding: "8px 10px" }}>
          {/* Vessel selector */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ ...sectionLabelStyle, color: "#5A7A94", marginBottom: 4 }}>
              Active Path
            </div>
            <select
              value={selectedTrackId}
              onChange={(e) => onSelectTrackId?.(e.target.value)}
              style={{
                width: "100%",
                background: "#0A0E14",
                border: "1px solid #1C2A38",
                borderRadius: "2px",
                padding: "4px 6px",
                fontSize: "11px",
                fontFamily: "'Inter', sans-serif",
                color: "#C8D8E8",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="all">All Tracks ({aisVessels.length})</option>
              {aisVessels.map((v) => (
                <option key={v.vesselId} value={v.vesselId}>
                  {v.vesselName}
                </option>
              ))}
            </select>
          </div>

          {/* Path color picker — 4 cyan-family swatches */}
          {onSelectTrackColorId && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...sectionLabelStyle, color: "#5A7A94", marginBottom: 5 }}>
                Path Color
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {TRACK_COLOR_OPTIONS.map((c) => {
                  const isSelected = selectedTrackColorId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectTrackColorId(c.id)}
                      title={c.name}
                      style={{
                        width: 20,
                        height: 20,
                        background: c.hex,
                        border: isSelected ? "1.5px solid #E2E8F0" : "1px solid #1C2A38",
                        borderRadius: 0,
                        cursor: "pointer",
                        padding: 0,
                        outline: "none",
                        opacity: isSelected ? 1 : 0.6,
                        transition: "opacity 150ms, border-color 150ms",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Follow track toggle */}
          {onToggleFollowTrack && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 7,
                borderTop: "1px solid #1C2A38",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "11px",
                    color: "#C8D8E8",
                  }}
                >
                  Follow Track
                </div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "8px",
                    color: "#3A5268",
                  }}
                >
                  Auto-center camera
                </div>
              </div>
              {/* Square toggle */}
              <button
                type="button"
                onClick={() => onToggleFollowTrack(!followTrack)}
                style={{
                  width: 28,
                  height: 14,
                  background: followTrack ? "#22D3EE22" : "transparent",
                  border: `1px solid ${followTrack ? "#22D3EE" : "#1C2A38"}`,
                  borderRadius: 0,
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 200ms, border-color 200ms",
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: followTrack ? 14 : 2,
                    width: 8,
                    height: 8,
                    background: followTrack ? "#22D3EE" : "#3A5268",
                    borderRadius: 0,
                    transition: "left 200ms, background 200ms",
                  }}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Combined Panel Stack ───────────────────────────────────────────────────────
export function LayerPanel(props: LayerPanelProps) {
  return (
    <div
      className="custom-scrollbar"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maxHeight: "calc(100vh - 72px)",
        overflowY: "auto",
        paddingBottom: 16,
        paddingRight: 2,
      }}
    >
      <LayerControlsCard
        visibility={props.visibility}
        onToggle={props.onToggle}
        sarOpacity={props.sarOpacity ?? 0.55}
        onChangeSarOpacity={props.onChangeSarOpacity}
      />

      {props.visibility["ais-tracks"] && (
        <TrackSelectionCard
          vessels={props.vessels ?? []}
          selectedTrackId={props.selectedTrackId ?? "all"}
          onSelectTrackId={props.onSelectTrackId}
          selectedTrackColorId={props.selectedTrackColorId ?? "cyan"}
          onSelectTrackColorId={props.onSelectTrackColorId}
          followTrack={props.followTrack ?? false}
          onToggleFollowTrack={props.onToggleFollowTrack}
        />
      )}

      <MapLegend visibility={props.visibility} />
    </div>
  );
}
