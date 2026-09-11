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

export function DarkVesselPulse({
  position,
  mapRef,
  label = "DARK VESSEL (CFAR)",
  statusText = "AIS: BLACKOUT · NO SIGNAL",
  onClick,
}: DarkVesselPulseProps) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      if (!map || !position || position.length < 2) return;
      try {
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
          left: 20,
          top: -18,
          background: "#0D1117",
          border: "1px solid #1C2A38",
          borderLeft: "2px solid #EF4444",
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
            {label}
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
          {Array.isArray(position) && position.length >= 2 && typeof position[0] === "number" && typeof position[1] === "number"
            ? `${position[1].toFixed(4)}°N, ${position[0].toFixed(4)}°E`
            : "19.2800°N, 71.9000°E"}
        </div>
        <div
          style={{
            fontSize: "7px",
            color: "#5A7A94",
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
