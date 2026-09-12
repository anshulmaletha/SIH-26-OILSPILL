import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

interface DarkVesselPulseProps {
  /** Geographic position [longitude, latitude] */
  position: [number, number];
  /** MapLibre map instance — used to project geo → screen coordinates */
  mapRef: React.RefObject<MapLibreMap | null>;
  /** Optional custom label for the dark target */
  label?: string;
  /** Optional status text */
  statusText?: string;
  /** Called when user clicks the pulsing marker */
  onClick?: () => void;
}

/**
 * DarkVesselPulse — CSS-animated pulsing red ring at a fixed geographic position.
 *
 * Renders as an absolute-positioned DOM element over the map canvas.
 * Uses MapLibre's `map.project()` to convert [lng, lat] → screen px.
 * Updates on every map move/zoom so the marker tracks the geo-point.
 *
 * Color: #EF4444 (alert red) — high-contrast radar ping styling.
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
        if (pt && typeof pt.x === "number" && typeof pt.y === "number" && !isNaN(pt.x) && !isNaN(pt.y)) {
          setScreenPos({ x: pt.x, y: pt.y });
        }
      } catch {
        // Map transform may not be fully initialized
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

  if (!screenPos || !position || position.length < 2) return null;

  const latStr =
    position && typeof position[1] === "number" && !isNaN(position[1])
      ? `${position[1].toFixed(4)}°N`
      : "19.2800°N";
  const lngStr =
    position && typeof position[0] === "number" && !isNaN(position[0])
      ? `${position[0].toFixed(4)}°E`
      : "71.9000°E";

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
      {/* Crisp Dark Ship Hull Marker Core */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        style={{
          position: "absolute",
          left: -11,
          top: -11,
          pointerEvents: "none",
        }}
      >
        <path
          d="M 16,3 C 19.5,5.5 22,12 21.5,20 L 19,27 L 13,27 L 10.5,20 C 10,12 12.5,5.5 16,3 Z"
          fill="#DC2626"
          stroke="#0F172A"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="18" r="1.5" fill="#FFFFFF" />
      </svg>

      {/* ── Compact docked label card near the marker on the map canvas ── */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: -16,
          background: "#FFFFFF",
          border: "1px solid #CBD5E1",
          borderLeft: "2px solid #DC2626",
          borderRadius: "2px",
          padding: "4px 7px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          fontFamily: "ui-monospace, monospace",
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
              background: "#DC2626",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "8.5px",
              fontWeight: 700,
              color: "#DC2626",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
        </div>
        <div
          style={{
            fontSize: "8.5px",
            color: "#0F172A",
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {latStr}, {lngStr}
        </div>
        <div
          style={{
            fontSize: "7px",
            color: "#64748B",
            marginTop: 1,
            letterSpacing: "0.02em",
          }}
        >
          {statusText}
        </div>
      </div>
    </div>
  );
}
