import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

interface DarkVesselPulseProps {
  /** Geographic position [longitude, latitude] */
  position: [number, number];
  /** MapLibre map instance — used to project geo → screen coordinates */
  mapRef: React.RefObject<MapLibreMap | null>;
  /** Called when user clicks the pulsing marker */
  onClick?: () => void;
  /** Custom label / name for the dark vessel */
  label?: string;
  /** Custom status / anomaly note */
  statusText?: string;
}

/**
 * DarkVesselPulse — CSS-animated pulsing red ring at a fixed geographic position.
 *
 * Renders as an absolute-positioned DOM element over the map canvas.
 * Uses MapLibre's `map.project()` to convert [lng, lat] → screen px.
 * Updates on every map move/zoom so the marker tracks the geo-point.
 *
 * Color: #EF4444 (alert red) — the ONE place red appears in the app.
 * Concentric ring scale+fade animation with high-contrast radar ping styling.
 */
export function DarkVesselPulse({
  position,
  mapRef,
  onClick,
  label = "DARK VESSEL (CFAR)",
  statusText = "AIS: BLACKOUT · NO SIGNAL",
}: DarkVesselPulseProps) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      try {
        if (
          !map ||
          !position ||
          typeof position[0] !== "number" ||
          typeof position[1] !== "number" ||
          isNaN(position[0]) ||
          isNaN(position[1])
        ) {
          return;
        }
        const pt = map.project(position as [number, number]);
        if (pt && typeof pt.x === "number" && typeof pt.y === "number") {
          setScreenPos({ x: pt.x, y: pt.y });
        }
      } catch {
        // Map may not be ready or point outside bounds
      }
    };

    // Initial position
    update();

    // Re-project on every map event that moves the viewport
    map.on("move", update);
    map.on("zoom", update);
    map.on("rotate", update);
    map.on("pitch", update);
    map.on("resize", update);

    return () => {
      map.off("move", update);
      map.off("zoom", update);
      map.off("rotate", update);
      map.off("pitch", update);
      map.off("resize", update);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [position, mapRef]);

  if (!screenPos) return null;

  const latStr =
    position && typeof position[1] === "number" && !isNaN(position[1])
      ? `${position[1].toFixed(4)}°N`
      : "";
  const lngStr =
    position && typeof position[0] === "number" && !isNaN(position[0])
      ? `${position[0].toFixed(4)}°E`
      : "";

  return (
    <div
      style={{
        position: "absolute",
        left: screenPos.x,
        top: screenPos.y,
        pointerEvents: "auto",
        cursor: "pointer",
        zIndex: 25,
      }}
      onClick={onClick}
      title={`${label} — Click for full radar & SAR telemetry`}
    >
      {/* ── Concentric radiating dashed sonar rings ── */}
      <div
        className="dark-vessel-sonar-ring"
        style={{
          width: 34,
          height: 34,
          marginLeft: -17,
          marginTop: -17,
          animationDelay: "0ms",
        }}
      />
      <div
        className="dark-vessel-sonar-ring"
        style={{
          width: 34,
          height: 34,
          marginLeft: -17,
          marginTop: -17,
          animationDelay: "800ms",
        }}
      />
      <div
        className="dark-vessel-sonar-ring"
        style={{
          width: 34,
          height: 34,
          marginLeft: -17,
          marginTop: -17,
          animationDelay: "1600ms",
        }}
      />

      {/* Static inner dashed ring */}
      <div
        style={{
          position: "absolute",
          width: 18,
          height: 18,
          marginLeft: -9,
          marginTop: -9,
          borderRadius: "50%",
          border: "1px dashed rgba(239, 68, 68, 0.85)",
          pointerEvents: "none",
        }}
      />

      {/* Red Dark Ship Hull Marker Core */}
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        style={{
          position: "absolute",
          left: -13,
          top: -13,
          filter: "drop-shadow(0 0 10px #EF4444)",
          pointerEvents: "none",
        }}
      >
        <path
          d="M 16,3 C 19.5,5.5 22,12 21.5,20 L 19,27 L 13,27 L 10.5,20 C 10,12 12.5,5.5 16,3 Z"
          fill="#EF4444"
          stroke="#FCA5A5"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M 16,6 C 18,8 20,13 19.5,19 L 17.5,24 L 14.5,24 L 12.5,19 C 12,13 14,8 16,6 Z"
          fill="#1A0707"
          stroke="#EF4444"
          strokeWidth="0.8"
        />
        <rect x="13.5" y="16" width="5" height="6" rx="1" fill="#EF4444" stroke="#FCA5A5" strokeWidth="0.8" />
        <circle cx="16" cy="19" r="1" fill="#FFFFFF" />
      </svg>

      {/* ── Compact docked label card near the marker on the map canvas ── */}
      <div
        style={{
          position: "absolute",
          left: 20,
          top: -18,
          background: "#0D1117",
          border: "1px solid #1C2A38",
          borderLeft: "2px solid #EF4444",
          borderRadius: "2px",
          padding: "5px 8px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.75)",
          fontFamily: "'JetBrains Mono', monospace",
          pointerEvents: "auto",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#EF4444",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "8.5px",
              fontWeight: 700,
              color: "#EF4444",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
        </div>
        {(latStr || lngStr) && (
          <div
            style={{
              fontSize: "8.5px",
              color: "#C8D8E8",
              marginTop: 2,
              lineHeight: 1.3,
            }}
          >
            {latStr}, {lngStr}
          </div>
        )}
        <div
          style={{
            fontSize: "7px",
            color: "#EF4444",
            opacity: 0.85,
            marginTop: 1,
            letterSpacing: "0.04em",
          }}
        >
          {statusText}
        </div>
      </div>
    </div>
  );
}
