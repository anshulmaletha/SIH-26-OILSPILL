import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

interface DarkVesselPulseProps {
  /** Geographic position [longitude, latitude] */
  position: [number, number];
  /** MapLibre map instance — used to project geo → screen coordinates */
  mapRef: React.RefObject<MapLibreMap | null>;
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
 * Color: #EF4444 (alert red) — the ONE place red appears in the app.
 * No glow, no bloom — just concentric ring scale+fade animation.
 */
export function DarkVesselPulse({ position, mapRef, onClick }: DarkVesselPulseProps) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const pt = map.project(position as [number, number]);
      setScreenPos({ x: pt.x, y: pt.y });
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

  const isNearRight = typeof window !== "undefined" && screenPos.x > window.innerWidth - 240;
  const isNearBottom = typeof window !== "undefined" && screenPos.y > window.innerHeight - 100;
  const isNearTop = screenPos.y < 120;

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
      title="Dark Vessel — SAR-only detection (click to inspect)"
    >
      {/* ── Concentric radiating dashed sonar rings ── */}
      <div
        className="dark-vessel-sonar-ring"
        style={{
          width: 32,
          height: 32,
          marginLeft: -16,
          marginTop: -16,
          animationDelay: "0ms",
        }}
      />
      <div
        className="dark-vessel-sonar-ring"
        style={{
          width: 32,
          height: 32,
          marginLeft: -16,
          marginTop: -16,
          animationDelay: "800ms",
        }}
      />
      <div
        className="dark-vessel-sonar-ring"
        style={{
          width: 32,
          height: 32,
          marginLeft: -16,
          marginTop: -16,
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
          border: "1px dashed rgba(239, 68, 68, 0.75)",
          pointerEvents: "none",
        }}
      />

      {/* Solid red core dot */}
      <div
        className="dark-vessel-pulse-core"
        style={{
          width: 8,
          height: 8,
          marginLeft: -4,
          marginTop: -4,
          background: "#EF4444",
        }}
      />

      {/* ── Compact docked label card near the marker on the map canvas ── */}
      <div
        style={{
          position: "absolute",
          left: isNearRight ? "auto" : 20,
          right: isNearRight ? 20 : "auto",
          top: isNearBottom ? "auto" : (isNearTop ? 20 : -18),
          bottom: isNearBottom ? 20 : "auto",
          background: "#0D1117",
          border: "1px solid #1C2A38",
          borderLeft: isNearRight ? "1px solid #1C2A38" : "2px solid #EF4444",
          borderRight: isNearRight ? "2px solid #EF4444" : "none",
          borderRadius: "2px",
          padding: "5px 8px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          fontFamily: "'JetBrains Mono', monospace",
          pointerEvents: "auto",
          whiteSpace: "nowrap",
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
            DARK VESSEL (CFAR)
          </span>
        </div>
        <div
          style={{
            fontSize: "8.5px",
            color: "#C8D8E8",
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {position[1].toFixed(4)}°N, {position[0].toFixed(4)}°E
        </div>
        <div
          style={{
            fontSize: "7px",
            color: "#5A7A94",
            marginTop: 1,
            letterSpacing: "0.04em",
          }}
        >
          AIS: BLACKOUT · NO SIGNAL
        </div>
      </div>
    </div>
  );
}
