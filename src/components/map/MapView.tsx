import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type IControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";

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
import type { MissionStage } from "@/lib/mission/missionState";
import type { SwarmVessel } from "@/lib/mission/swarmData";
import { swarmVesselColor } from "@/lib/mission/swarmData";
import { OperationsPanel, PanelHeader, MetricRow, StatusBadge, CollapsibleSection } from "@/components/ui/panel-system";

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
  /** Current mission stage — controls swarm layer visibility */
  missionStage?: MissionStage | undefined;
  /** Synthetic swarm vessels for phases 3 & 4 */
  swarmVessels?: SwarmVessel[] | undefined;
  /** Which color scheme to use for swarm vessels */
  swarmPhase?: "swarm" | "backtrack" | undefined;
  /** Callback fired when the map instance is ready (for external flyTo calls) */
  onMapReady?: ((map: MapLibreMap) => void) | undefined;
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
  missionStage,
  swarmVessels = [],
  swarmPhase = "swarm",
  onMapReady,
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

  const layers = useMemo(() => {
    const baseLayers = buildLayers({
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
        let k = 0;
        try {
          k = Math.max(0, Math.min(4, Math.round(Math.sqrt(Math.max(0, 1 - cell.density) * 16))));
        } catch {
          k = 0;
        }
        setSelectedHexCell({ cell, coordinate: coord, ringK: k });
      },
    });

    // Add synthetic swarm scatter layer for AIS_SWARM and BACKTRACK_CORRIDOR phases
    if (swarmVessels.length > 0) {
      const swarmLayer = new ScatterplotLayer({
        id: "mission-swarm",
        data: swarmVessels,
        getPosition: (d) => d.position,
        getRadius: (d) => (d.isCandidate ? 900 : 600),
        getFillColor: (d) => swarmVesselColor(d, swarmPhase),
        radiusUnits: "meters",
        radiusMinPixels: swarmPhase === "backtrack" ? 3 : 2,
        pickable: false,
        parameters: { depthTest: false },
        updateTriggers: {
          getFillColor: [swarmPhase],
          radiusMinPixels: [swarmPhase],
        },
      });
      return [...baseLayers, swarmLayer];
    }

    return baseLayers;
  }, [
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
    swarmVessels,
    swarmPhase,
  ]);

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
    map.addControl(new NavigationControl(), "bottom-right");
    map.addControl(new ScaleControl(), "bottom-right");

    map.on("load", () => {
      if (overlayRef.current) return;
      const overlay = new MapboxOverlay({ interleaved: false, layers });
      overlayRef.current = overlay;
      map.addControl(overlay as unknown as IControl);
      setMapReady(true);
      // Fire onMapReady so the mission controller can issue flyTo
      onMapReady?.(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


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
            left: Math.max(300, Math.min(typeof window !== "undefined" ? window.innerWidth - 560 : 700, hexScreenPos.x + 16)),
            top: Math.max(70, Math.min(typeof window !== "undefined" ? window.innerHeight - 320 : 500, hexScreenPos.y - 30)),
            zIndex: 35,
            width: "240px",
          }}
        >
          <OperationsPanel
            variant="compact"
            borderLeftAccent
            accentColor={selectedHexCell.cell.riskLevel === "critical" ? "red" : "cyan"}
            className="w-[230px]"
          >
            <PanelHeader
              category="SPATIAL"
              title="H3 CELL"
              statusText={selectedHexCell.cell.riskLevel.toUpperCase()}
              statusVariant={selectedHexCell.cell.riskLevel === "critical" ? "red" : "cyan"}
              onClose={() => setSelectedHexCell(null)}
            />

            <div className="p-2.5 flex flex-col gap-1.5">
              <div className="font-mono text-[9px] text-[#22D3EE] bg-[#111822] px-2 py-1 rounded border border-[#1C2A38] break-all">
                {selectedHexCell.cell.h3Index}
              </div>
              <MetricRow
                label="Oil Probability"
                value={`${(selectedHexCell.cell.density * 100).toFixed(0)}%`}
                highlight
                color={selectedHexCell.cell.density > 0.6 ? "red" : "cyan"}
              />
              <MetricRow
                label="Particle Count"
                value={selectedHexCell.cell.particleCount}
              />
              <MetricRow
                label="Risk"
                value={selectedHexCell.cell.riskLevel.toUpperCase()}
                color={selectedHexCell.cell.riskLevel === "critical" ? "red" : "amber"}
              />
            </div>

            <CollapsibleSection label="Details">
              <div className="flex flex-col gap-1 pt-1">
                <MetricRow
                  label="Ring Distance"
                  value={`k = ${selectedHexCell.ringK}`}
                  color={selectedHexCell.ringK === 0 ? "cyan" : "dim"}
                />
                <MetricRow
                  label="Density Index"
                  value={selectedHexCell.cell.density.toFixed(3)}
                  mono
                />
              </div>
            </CollapsibleSection>
          </OperationsPanel>
        </div>
      )}

      {/* Compact docked hover tooltip card — styled with OperationsPanel */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: (typeof window !== "undefined" && tooltip.x > window.innerWidth - 350)
              ? tooltip.x - 235
              : Math.max(300, tooltip.x + 14),
            top: Math.max(70, Math.min(typeof window !== "undefined" ? window.innerHeight - 150 : 600, tooltip.y + 14)),
            width: "220px",
          }}
        >
          <OperationsPanel
            variant="compact"
            borderLeftAccent
            accentColor={tooltip.type === "dark-vessel" ? "red" : "cyan"}
            style={{
              padding: "6px 8px",
            }}
          >
            {/* Title row */}
            <div className="flex items-baseline justify-between gap-2 border-b border-[#1C2A38] pb-1.5 mb-1.5">
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: tooltip.type === "dark-vessel" ? "#EF4444" : "#22D3EE",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tooltip.title}
              </span>
              <StatusBadge
                label={tooltip.type}
                variant={tooltip.type === "dark-vessel" ? "red" : "cyan"}
                size="sm"
              />
            </div>

            {/* Data rows */}
            <div className="flex flex-col gap-0.5">
              {tooltip.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 text-[8.5px] leading-tight"
                >
                  <span style={{ color: "#5A7A94", fontFamily: "'Inter', sans-serif" }}>
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#C8D8E8",
                      fontWeight: 500,
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </OperationsPanel>
        </div>
      )}
    </div>
  );
}
