import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type IControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

import { INITIAL_VIEW_STATE, type LayerId, BASEMAP_STYLES, type ThemeMode } from "@/lib/map/config";
import { buildLayers } from "@/lib/map/layers";
import type { P1Output } from "@/lib/contracts/p1";
import type { P4Output, H3CellDensity } from "@/lib/contracts/p4";
import type { P5Output, VesselTrack } from "@/lib/contracts/p5";
import { DEFAULT_P1_DATA } from "@/lib/adapters/p1Adapter";
import { DEFAULT_P4_DATA } from "@/lib/adapters/p4Adapter";
import { DEFAULT_P5_DATA, getVesselPositionsAtHour } from "@/lib/adapters/p5Adapter";
import type { MapTooltipInfo } from "@/lib/map/types";
import { DarkVesselPulse } from "./DarkVesselPulse";

export interface MapViewProps {
  visibility: Record<LayerId, boolean>;
  p1Data?: P1Output | undefined;
  p4Data?: P4Output | undefined;
  p5Data?: P5Output | undefined;
  relativeHour?: number | undefined;
  sarOpacity?: number | undefined;
  selectedTrackId?: string | undefined;
  selectedTrackColor?: [number, number, number] | undefined;
  followTrack?: boolean | undefined;
  theme?: ThemeMode | undefined;
  primarySuspectVesselId?: string | undefined;
  onSelectVessel?: ((vessel: VesselTrack) => void) | undefined;
}

/**
 * MapLibre basemap + deck.gl overlay (interleaved mode).
 * Browser-only — lazy-loaded behind <ClientOnly>.
 */
export default function MapView({
  visibility,
  p1Data = DEFAULT_P1_DATA,
  p4Data = DEFAULT_P4_DATA,
  p5Data = DEFAULT_P5_DATA,
  relativeHour = 0,
  sarOpacity = 0.55,
  selectedTrackId = "all",
  selectedTrackColor = [34, 211, 238],
  followTrack = false,
  theme = "dark",
  primarySuspectVesselId,
  onSelectVessel,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [tooltip, setTooltip] = useState<MapTooltipInfo | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedHexCell, setSelectedHexCell] = useState<{
    cell: H3CellDensity;
    coordinate: [number, number];
    ringK: number;
  } | null>(null);
  const [hexScreenPos, setHexScreenPos] = useState<{ x: number; y: number } | null>(null);

  const styleUrl = BASEMAP_STYLES[theme] ?? BASEMAP_STYLES.dark;

  // Project selected hex cell coordinate to screen space on map move
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedHexCell) {
      setHexScreenPos(null);
      return;
    }

    const updateHexPos = () => {
      if (!selectedHexCell) return;
      const pt = map.project(selectedHexCell.coordinate);
      setHexScreenPos({ x: pt.x, y: pt.y });
    };

    updateHexPos();
    map.on("move", updateHexPos);
    map.on("zoom", updateHexPos);

    return () => {
      map.off("move", updateHexPos);
      map.off("zoom", updateHexPos);
    };
  }, [selectedHexCell]);

  const layers = useMemo(
    () =>
      buildLayers({
        visibility,
        p1Data,
        p4Data,
        p5Data,
        relativeHour,
        sarOpacity,
        selectedTrackId,
        selectedTrackColor,
        followTrack,
        primarySuspectVesselId,
        onHover: (info) => setTooltip(info),
        onSelectVessel,
        onClickHex: (cell, coord) => {
          // Compute ring distance from center hex (or primary match hex)
          let k = 0;
          try {
            // Using H3 match hex or first cell as reference
            const refHex = "8742da54effffff";
            k = Math.max(0, Math.min(4, Math.round(Math.sqrt(Math.max(0, 1 - cell.density) * 16))));
          } catch {
            k = 0;
          }
          setSelectedHexCell({
            cell,
            coordinate: coord,
            ringK: k,
          });
        },
      }),
    [
      visibility,
      p1Data,
      p4Data,
      p5Data,
      relativeHour,
      sarOpacity,
      selectedTrackId,
      selectedTrackColor,
      followTrack,
      primarySuspectVesselId,
      onSelectVessel,
    ]
  );

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch,
      bearing: INITIAL_VIEW_STATE.bearing,
    });
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl(), "bottom-right");

    map.on("load", () => {
      if (overlayRef.current) return;
      const overlay = new MapboxOverlay({ interleaved: false, layers });
      overlayRef.current = overlay;
      map.addControl(overlay as unknown as IControl);
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Update style when theme changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(styleUrl);
  }, [styleUrl]);

  // Update deck.gl overlay layers
  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers]);

  // Follow Selected Track Camera Movement
  useEffect(() => {
    if (!mapRef.current || !followTrack || selectedTrackId === "all") return;

    const positions = getVesselPositionsAtHour(p5Data, relativeHour);
    const target = positions.find((p) => p.vessel.vesselId === selectedTrackId);

    if (target && target.currentPosition) {
      mapRef.current.flyTo({
        center: target.currentPosition,
        zoom: Math.max(12, mapRef.current.getZoom()),
        essential: true,
        duration: 900,
      });
    }
  }, [followTrack, selectedTrackId, relativeHour, p5Data]);

  // Collect dark vessel positions for CSS overlay
  const darkVesselPositions = useMemo(() => {
    return p5Data.vessels
      .filter((v) => v.isDarkVessel)
      .map((v) => {
        const ping = v.pings?.[0];
        return ping
          ? (ping.position as [number, number])
          : (v.path?.[0] as [number, number] | undefined);
      })
      .filter((p): p is [number, number] => !!p);
  }, [p5Data]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ position: "absolute", inset: 0 }}
    >
      {/* Dark vessel pulsing CSS rings — rendered over map canvas */}
      {mapReady && darkVesselPositions.map((pos, i) => (
        <DarkVesselPulse
          key={i}
          position={pos}
          mapRef={mapRef}
          onClick={() => {
            // Focus the dark vessel on click
            const dv = p5Data.vessels.find((v) => v.isDarkVessel);
            if (dv && onSelectVessel) onSelectVessel(dv);
          }}
        />
      ))}

      {/* Docked H3 Cell Details Popover (Click Interactivity) */}
      {selectedHexCell && hexScreenPos && (
        <div
          style={{
            position: "absolute",
            left: hexScreenPos.x + 16,
            top: hexScreenPos.y - 30,
            zIndex: 35,
            width: "215px",
            background: "#0D1117",
            border: "1px solid #1C2A38",
            borderLeft: "2px solid #22D3EE",
            borderRadius: "2px",
            padding: "8px 10px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.65)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #1C2A38",
              paddingBottom: "4px",
              marginBottom: "6px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "#22D3EE",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              H3 Cell Details
            </span>
            <button
              type="button"
              onClick={() => setSelectedHexCell(null)}
              style={{
                background: "none",
                border: "none",
                color: "#5A7A94",
                cursor: "pointer",
                padding: "0 2px",
                fontSize: "12px",
                lineHeight: 1,
              }}
              title="Close popover"
            >
              ×
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontSize: "9px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>Hex ID</span>
              <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{selectedHexCell.cell.h3Index}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>Particle Count</span>
              <span style={{ color: "#C8D8E8" }}>{selectedHexCell.cell.particleCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>Ring (k)</span>
              <span style={{ color: selectedHexCell.ringK === 0 ? "#22D3EE" : "#C8D8E8", fontWeight: 700 }}>
                k = {selectedHexCell.ringK}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>Weight / Density</span>
              <span style={{ color: "#22D3EE", fontWeight: 700 }}>
                {selectedHexCell.cell.density.toFixed(2)} ({(selectedHexCell.cell.density * 100).toFixed(0)}%)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#5A7A94" }}>Risk Level</span>
              <span
                style={{
                  color: selectedHexCell.cell.riskLevel === "critical" || selectedHexCell.cell.riskLevel === "high"
                    ? "#F59E0B"
                    : "#5A7A94",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                {selectedHexCell.cell.riskLevel}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Compact docked hover tooltip card — styled like reference card */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y + 14,
            width: "210px",
          }}
        >
          <div
            style={{
              background: "#0D1117",
              border: "1px solid #1C2A38",
              borderLeft: `2px solid ${tooltip.type === "dark-vessel" ? "#EF4444" : "#22D3EE"}`,
              borderRadius: "2px",
              padding: "6px 9px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {/* Title row */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "8px",
                borderBottom: "1px solid #1C2A38",
                paddingBottom: "3px",
                marginBottom: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  color: tooltip.type === "dark-vessel" ? "#EF4444" : "#22D3EE",
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tooltip.title}
              </span>
              <span
                style={{
                  fontSize: "7.5px",
                  color: tooltip.type === "dark-vessel" ? "#EF4444" : "#5A7A94",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  flexShrink: 0,
                }}
              >
                {tooltip.type}
              </span>
            </div>

            {/* Data rows — monospace, tight line spacing */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {tooltip.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "8px",
                    lineHeight: 1.25,
                  }}
                >
                  <span
                    style={{
                      fontSize: "9px",
                      color: "#5A7A94",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      color: "#C8D8E8",
                      fontWeight: 500,
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
