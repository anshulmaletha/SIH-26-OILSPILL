import { useState } from "react";
import { LAYER_META, type LayerId } from "@/lib/map/config";

interface MapLegendProps {
  visibility: Record<LayerId, boolean>;
}

// 5 discrete hex swatches: dim edge → bright cyan core (14% → 90%)
const DENSITY_SWATCHES = [
  { opacity: 0.14, label: "Low" },
  { opacity: 0.31, label: "" },
  { opacity: 0.53, label: "" },
  { opacity: 0.72, label: "" },
  { opacity: 0.90, label: "Peak" },
];

/** Small inline SVG hexagon swatch (flat-top) */
function HexSwatch({ opacity, label }: { opacity: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg width="18" height="16" viewBox="-10 -9 20 18">
        <polygon
          points="9,0 4.5,-7.79 -4.5,-7.79 -9,0 -4.5,7.79 4.5,7.79"
          fill="#22D3EE"
          fillOpacity={opacity}
          stroke="#B4F0FF"
          strokeOpacity={0.85}
          strokeWidth="1"
        />
      </svg>
      {label && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "7px",
            color: "#3A5268",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function MapLegend({ visibility }: MapLegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const visible = LAYER_META.filter((m) => visibility[m.id]);
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        width: 200,
        background: "#0D1117",
        border: "1px solid #1C2A38",
        borderRadius: "2px",
        color: "#C8D8E8",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: isCollapsed ? "none" : "1px solid #1C2A38",
          padding: "6px 10px",
          background: "#0A0E14",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8px",
            color: "#3A5268",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontWeight: 700,
          }}
        >
          Legend — {visible.length} Active
        </span>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#3A5268",
            padding: "0 2px",
            fontSize: "10px",
            lineHeight: 1,
          }}
          title={isCollapsed ? "Expand legend" : "Collapse legend"}
        >
          {isCollapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div style={{ padding: "8px 10px" }}>
          {/* Layer swatches */}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, marginBottom: 8 }}>
            {visible.map((meta) => (
              <li
                key={meta.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: meta.color,
                    flexShrink: 0,
                    borderRadius: 0,
                    opacity: 0.85,
                  }}
                />
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "10px",
                    color: "#C8D8E8",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {meta.label}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "8px",
                    color: "#3A5268",
                    marginLeft: "auto",
                    flexShrink: 0,
                  }}
                >
                  {meta.id === "sar-raster"   ? "SAR"  :
                   meta.id === "slick-polygon" ? "POLY" :
                   meta.id === "h3-corridor"   ? "H3"   : "AIS"}
                </span>
              </li>
            ))}
          </ul>

          {/* H3 density swatch row — only when H3 corridor is visible */}
          {visibility["h3-corridor"] && (
            <div
              style={{
                borderTop: "1px solid #1C2A38",
                paddingTop: 8,
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "7.5px",
                  color: "#3A5268",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                Match Density
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 4,
                }}
              >
                {DENSITY_SWATCHES.map((s, i) => (
                  <HexSwatch key={i} opacity={s.opacity} label={s.label} />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "7px",
                  color: "#3A5268",
                  marginTop: 4,
                }}
              >
                <span>Low</span>
                <span style={{ color: "#22D3EE" }}>High</span>
              </div>
            </div>
          )}

          {/* Dark vessel indicator */}
          <div
            style={{
              borderTop: "1px solid #1C2A38",
              paddingTop: 7,
              marginTop: 7,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: "#EF4444",
                flexShrink: 0,
                borderRadius: "50%",
              }}
            />
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "10px",
                color: "#C8D8E8",
              }}
            >
              Dark Vessel
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                color: "#EF4444",
                marginLeft: "auto",
              }}
            >
              CFAR
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
