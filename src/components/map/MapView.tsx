import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type IControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScatterplotLayer, PathLayer } from "@deck.gl/layers";

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
import { VesselInfoPanel } from "./VesselInfoPanel";
import type { MissionStage } from "@/lib/mission/missionState";
import type { SwarmVessel } from "@/lib/mission/swarmData";
import { swarmVesselColor } from "@/lib/mission/swarmData";

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
  const [selectedSwarmVessel, setSelectedSwarmVessel] = useState<SwarmVessel | null>(null);

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
    const extraLayers = [];

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
      onSelectVessel: (vessel) => {
        onSelectVessel?.(vessel);
        const match = swarmVessels.find(
          (sv) => sv.mmsi === vessel.mmsi || sv.name === vessel.vesselName || sv.id === vessel.vesselId
        );
        if (match) {
          setSelectedSwarmVessel(match);
        } else {
          setSelectedSwarmVessel({
            id: vessel.vesselId,
            name: vessel.vesselName,
            mmsi: vessel.mmsi || "N/A",
            callsign: vessel.callsign || "N/A",
            flag: vessel.flag,
            vesselType: (vessel.vesselType.toLowerCase().includes("tanker")
              ? "tanker"
              : vessel.vesselType.toLowerCase().includes("container")
              ? "container"
              : "bulk") as any,
            typeLabel: vessel.vesselType,
            position: vessel.path[vessel.path.length - 1] || [71.2, 19.65],
            heading: 135,
            course: 135,
            speedKnots: 14.0,
            navStatus: vessel.isDarkVessel ? "AIS Blackout" : "Underway using Engine",
            destination: vessel.destination || "MUMBAI",
            eta: vessel.eta || "2026-05-15 14:00 UTC",
            lastSeen: "06:00:00 UTC",
            lengthMeters: vessel.lengthMeters || 200,
            beamMeters: vessel.beamMeters || 32,
            draughtMeters: vessel.draughtMeters || 10.5,
            trajectory: vessel.path || [],
            isCandidate: vessel.isCandidate,
            suspicionLevel: vessel.isCandidate ? "high" : "none",
            isDarkVessel: vessel.isDarkVessel,
            suspiciousReason: vessel.darkAnomaly?.notes,
            threatTag: vessel.isDarkVessel ? "AIS BLACKOUT" : undefined,
          });
        }
      },
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

    // Add synthetic swarm scatter layer for all interactive vessels
    if (swarmVessels.length > 0) {
      const swarmLayer = new ScatterplotLayer<SwarmVessel>({
        id: "mission-swarm",
        data: swarmVessels,
        getPosition: (d) => d.position,
        getRadius: (d) => (d.isDarkVessel ? 1200 : d.isCandidate ? 950 : 650),
        getFillColor: (d) => swarmVesselColor(d, swarmPhase),
        radiusUnits: "meters",
        radiusMinPixels: (d) => (d.isDarkVessel ? 4 : swarmPhase === "backtrack" ? 3 : 2.5),
        pickable: true,
        parameters: { depthTest: false },
        updateTriggers: {
          getFillColor: [swarmPhase, selectedSwarmVessel],
          getRadius: [selectedSwarmVessel],
        },
        onHover: (info) => {
          if (!info.object) {
            if (tooltip?.type === "swarm-vessel") setTooltip(null);
            return;
          }
          const v = info.object as SwarmVessel;
          setTooltip({
            x: info.x,
            y: info.y,
            type: "swarm-vessel",
            title: v.name,
            items: [
              { label: "MMSI", value: v.mmsi || "—" },
              { label: "Type", value: v.typeLabel },
              { label: "Speed", value: `${v.speedKnots.toFixed(1)} kn` },
              { label: "Heading", value: `${v.heading}°` },
              { label: "Coord", value: `${v.position[1].toFixed(4)}°N, ${v.position[0].toFixed(4)}°E` },
            ],
          });
        },
        onClick: (info) => {
          if (info.object) {
            const v = info.object as SwarmVessel;
            setSelectedSwarmVessel(v);
          }
        },
      });
      extraLayers.push(swarmLayer);
    }

    // Add selected vessel trajectory, past waypoints & target highlight ring
    if (selectedSwarmVessel) {
      const isDarkTarget = selectedSwarmVessel.isDarkVessel || selectedSwarmVessel.suspicionLevel === "high";
      const baseColor: [number, number, number] = isDarkTarget ? [239, 68, 68] : [34, 211, 238];

      if (selectedSwarmVessel.trajectory && selectedSwarmVessel.trajectory.length > 1) {
        // 1. Soft glow underlay for trajectory
        const glowLayer = new PathLayer<{ path: [number, number][] }>({
          id: "selected-vessel-trajectory-glow",
          data: [{ path: selectedSwarmVessel.trajectory }],
          getPath: (d) => d.path,
          getColor: [...baseColor, 65],
          getWidth: 7,
          widthUnits: "pixels",
          pickable: false,
          updateTriggers: {
            getPath: [selectedSwarmVessel],
            getColor: [selectedSwarmVessel],
          },
        });
        extraLayers.push(glowLayer);

        // 2. Crisp main trajectory line
        const trajectoryLayer = new PathLayer<{ path: [number, number][] }>({
          id: "selected-vessel-trajectory",
          data: [{ path: selectedSwarmVessel.trajectory }],
          getPath: (d) => d.path,
          getColor: [...baseColor, 240],
          getWidth: 2.5,
          widthUnits: "pixels",
          pickable: false,
          updateTriggers: {
            getPath: [selectedSwarmVessel],
            getColor: [selectedSwarmVessel],
          },
        });
        extraLayers.push(trajectoryLayer);

        // 3. Historical waypoint pings along the trajectory
        const waypointData = selectedSwarmVessel.trajectory.slice(0, -1).map((pt, idx, arr) => ({
          position: pt,
          index: idx,
          total: arr.length,
          timeLabel: `T-${(arr.length - idx) * 6}h Historical Ping`,
        }));

        const waypointsLayer = new ScatterplotLayer({
          id: "selected-vessel-waypoints",
          data: waypointData,
          getPosition: (d) => d.position,
          getRadius: 450,
          radiusUnits: "meters",
          radiusMinPixels: 3,
          getFillColor: [...baseColor, 180],
          getLineColor: [13, 17, 23, 255],
          lineWidthMinPixels: 1,
          stroked: true,
          pickable: true,
          onHover: (info) => {
            if (!info.object) return;
            const wp = info.object as typeof waypointData[0];
            setTooltip({
              x: info.x,
              y: info.y,
              type: "vessel",
              title: `${selectedSwarmVessel.name} — ${wp.timeLabel}`,
              items: [
                { label: "Waypoint", value: `#${wp.index + 1} of ${wp.total + 1}` },
                { label: "Position", value: `${wp.position[1].toFixed(4)}°N, ${wp.position[0].toFixed(4)}°E` },
                { label: "Status", value: "Historical AIS Trail" },
              ],
            });
          },
        });
        extraLayers.push(waypointsLayer);
      }

      // 4. Forward heading course vector (shows current travel direction)
      if (selectedSwarmVessel.speedKnots > 0.5) {
        const [lng, lat] = selectedSwarmVessel.position;
        const rad = (selectedSwarmVessel.heading * Math.PI) / 180;
        const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
        const vectorLen = 0.045 * (selectedSwarmVessel.speedKnots / 12);
        const forwardPos: [number, number] = [
          lng + (Math.sin(rad) / cosLat) * vectorLen,
          lat + Math.cos(rad) * vectorLen,
        ];

        const headingVectorLayer = new PathLayer<{ path: [number, number][] }>({
          id: "selected-vessel-heading-vector",
          data: [{ path: [[lng, lat], forwardPos] }],
          getPath: (d) => d.path,
          getColor: [...baseColor, 220],
          getWidth: 2,
          widthUnits: "pixels",
          pickable: false,
        });
        extraLayers.push(headingVectorLayer);
      }

      // 5. High-visibility target ring marker
      const ringLayer = new ScatterplotLayer<SwarmVessel>({
        id: "selected-vessel-ring",
        data: [selectedSwarmVessel],
        getPosition: (d) => d.position,
        getRadius: isDarkTarget ? 2200 : 1600,
        radiusUnits: "meters",
        radiusMinPixels: 9,
        getFillColor: [0, 0, 0, 0],
        getLineColor: isDarkTarget ? [239, 68, 68, 255] : [34, 211, 238, 255],
        lineWidthMinPixels: 2.5,
        stroked: true,
        pickable: false,
        updateTriggers: {
          getPosition: [selectedSwarmVessel],
          getLineColor: [selectedSwarmVessel],
        },
      });
      extraLayers.push(ringLayer);
    }

    return [...baseLayers, ...extraLayers];
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
    selectedSwarmVessel,
    tooltip?.type,
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
    map.addControl(new NavigationControl(), "top-right");
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

      {/* Floating Interactive Vessel Information HUD Panel */}
      <VesselInfoPanel
        vessel={selectedSwarmVessel}
        onClose={() => setSelectedSwarmVessel(null)}
      />
    </div>
  );
}
