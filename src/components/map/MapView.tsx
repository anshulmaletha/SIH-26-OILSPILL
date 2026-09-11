import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type IControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ScatterplotLayer, PathLayer, IconLayer } from "@deck.gl/layers";

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
import { type SwarmVessel, swarmVesselColor } from "@/lib/mission/swarmData";
import {
  getMasterShipAtlasDataUri,
  SHIP_ICON_MAPPING,
  SHIP_ICON_SIZE,
} from "@/lib/map/ShipIcon";

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
  const [selectedVessel, setSelectedVessel] = useState<SwarmVessel | VesselTrack | null>(null);

  const styleUrl = BASEMAP_STYLES[theme] ?? BASEMAP_STYLES.dark;

  const handleSelectVessel = useCallback(
    (vessel: SwarmVessel | VesselTrack | any | null) => {
      if (!vessel) {
        setSelectedVessel(null);
        return;
      }
      setSelectedVessel(vessel);
      if ("vesselId" in vessel && onSelectVessel) {
        onSelectVessel(vessel as VesselTrack);
      }
    },
    [onSelectVessel]
  );

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
      onSelectVessel: (vessel) => handleSelectVessel(vessel),
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

    const extraLayers: (ScatterplotLayer | PathLayer | IconLayer<SwarmVessel>)[] = [];

    // Add synthetic swarm ship icons for maritime traffic (interactive ship-shaped markers)
    if (swarmVessels.length > 0) {
      const shipAtlas = getMasterShipAtlasDataUri();

      const swarmLayer = new IconLayer<SwarmVessel>({
        id: "mission-swarm-ships",
        data: swarmVessels,
        getPosition: (d: SwarmVessel) => d.position,
        getIcon: (d: SwarmVessel) => {
          if (d.isDarkVessel || d.suspicionLevel === "high") return "ship-red";
          if (d.isCandidate || d.suspicionLevel === "moderate") return "ship-amber";
          if (swarmPhase === "backtrack" && !d.isCandidate) return "ship-teal";
          if (d.vesselType === "tanker") return "ship-tanker";
          if (d.vesselType === "bulk") return "ship-bulk";
          if (d.vesselType === "container") return "ship-container";
          if (d.vesselType === "misc") return "ship-other";
          return "ship-cyan";
        },
        getSize: (d: SwarmVessel) => {
          const isSelected =
            selectedVessel &&
            (("id" in selectedVessel && selectedVessel.id === d.id) ||
              ("vesselId" in selectedVessel && selectedVessel.vesselId === d.id));
          if (isSelected) return SHIP_ICON_SIZE * 1.35;
          if (d.isDarkVessel) return SHIP_ICON_SIZE * 1.25;
          if (d.isCandidate) return SHIP_ICON_SIZE * 1.15;
          if (d.vesselType === "tanker" || d.vesselType === "bulk") return SHIP_ICON_SIZE * 1.08;
          if (d.vesselType === "container") return SHIP_ICON_SIZE;
          return SHIP_ICON_SIZE * 0.92;
        },
        getAngle: (d: SwarmVessel) => -(d.heading ?? d.course ?? 0),
        iconAtlas: shipAtlas,
        iconMapping: SHIP_ICON_MAPPING,
        sizeUnits: "pixels",
        pickable: true,
        onClick: (info) => {
          if (info.object) {
            handleSelectVessel(info.object as SwarmVessel);
          }
        },
        onHover: (info) => {
          if (!info.object) {
            setTooltip(null);
            return;
          }
          const v = info.object as SwarmVessel;
          const isDark = !!(v.isDarkVessel || v.suspicionLevel === "high");
          setTooltip({
            x: info.x,
            y: info.y,
            type: isDark ? "dark-vessel" : "vessel",
            title: v.name,
            items: [
              { label: "MMSI", value: v.mmsi || "—" },
              { label: "Type", value: v.typeLabel || "Vessel" },
              { label: "Speed", value: `${(v.speedKnots ?? 0).toFixed(1)} kn` },
              { label: "Heading", value: `${(v.heading ?? 0).toFixed(0)}°` },
              { label: "Status", value: isDark ? "BLACKOUT / ANOMALY" : (v.navStatus || "Underway") },
            ],
          });
        },
      });
      extraLayers.push(swarmLayer);
    }

    // Selected Vessel Trajectory, Waypoints, Heading Vector, and Target Ring
    if (selectedVessel) {
      const v = selectedVessel;
      const isDark = "isDarkVessel" in v ? !!v.isDarkVessel : false;
      const isCandidate = "isCandidate" in v ? !!v.isCandidate : false;
      const trajColor: [number, number, number] = isDark
        ? [239, 68, 68]
        : isCandidate
        ? [245, 158, 11]
        : [34, 211, 238];

      // Extract trajectory path
      let trajectory: [number, number][] = [];
      if ("trajectory" in v && Array.isArray(v.trajectory) && v.trajectory.length > 0) {
        trajectory = v.trajectory;
      } else if ("path" in v && Array.isArray(v.path) && v.path.length > 0) {
        trajectory = v.path;
      }

      // Extract current position
      let curPos: [number, number] | null = null;
      if ("position" in v && Array.isArray(v.position) && typeof v.position[0] === "number") {
        curPos = v.position as [number, number];
      } else if ("pings" in v && v.pings?.[0]?.position) {
        curPos = v.pings[0].position as [number, number];
      } else if (trajectory.length > 0) {
        curPos = (trajectory[trajectory.length - 1] ?? null) as [number, number] | null;
      }

      if (trajectory.length > 1) {
        // 1. Glow underlay
        extraLayers.push(
          new PathLayer({
            id: "selected-vessel-trajectory-glow",
            data: [{ path: trajectory }],
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: () => [...trajColor, 60] as [number, number, number, number],
            getWidth: 6,
            widthUnits: "pixels",
            pickable: false,
            parameters: { depthTest: false },
          })
        );

        // 2. Crisp main path line
        extraLayers.push(
          new PathLayer({
            id: "selected-vessel-trajectory-line",
            data: [{ path: trajectory }],
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: () => [...trajColor, 230] as [number, number, number, number],
            getWidth: 2.2,
            widthUnits: "pixels",
            pickable: false,
            parameters: { depthTest: false },
          })
        );

        // 3. Waypoint dots along historical trajectory
        extraLayers.push(
          new ScatterplotLayer({
            id: "selected-vessel-waypoints",
            data: trajectory.map((p, idx) => ({
              position: p,
              isCurrent: idx === trajectory.length - 1,
            })),
            getPosition: (d: { position: [number, number] }) => d.position,
            getRadius: (d: { isCurrent: boolean }) => (d.isCurrent ? 600 : 350),
            radiusUnits: "meters",
            radiusMinPixels: 3,
            getFillColor: (d: { isCurrent: boolean }) =>
              d.isCurrent ? [...trajColor, 255] : [13, 17, 23, 220],
            getLineColor: () => [...trajColor, 255] as [number, number, number, number],
            lineWidthMinPixels: 1.5,
            stroked: true,
            filled: true,
            pickable: false,
            parameters: { depthTest: false },
          })
        );
      }

      // 4. Forward heading vector and target ring
      if (curPos && typeof curPos[0] === "number" && typeof curPos[1] === "number") {
        const heading =
          ("heading" in v && typeof v.heading === "number" ? v.heading : undefined) ??
          ("pings" in v && v.pings?.[0]?.headingDegrees ? v.pings[0].headingDegrees : undefined) ??
          135;
        const headingRad = (heading * Math.PI) / 180;
        const cosLat = Math.cos((curPos[1] * Math.PI) / 180) || 1;
        const length = 0.025; // ~2.5km vector length
        const forwardPt: [number, number] = [
          curPos[0] + (Math.sin(headingRad) * length) / cosLat,
          curPos[1] + Math.cos(headingRad) * length,
        ];

        extraLayers.push(
          new PathLayer({
            id: "selected-vessel-heading-vector",
            data: [{ path: [curPos, forwardPt] }],
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: () => (isDark ? [239, 68, 68, 240] : [34, 211, 238, 240]),
            getWidth: 2,
            widthUnits: "pixels",
            pickable: false,
            parameters: { depthTest: false },
          })
        );

        extraLayers.push(
          new ScatterplotLayer({
            id: "selected-vessel-target-ring",
            data: [{ position: curPos }],
            getPosition: (d: { position: [number, number] }) => d.position,
            getRadius: 850,
            radiusUnits: "meters",
            radiusMinPixels: 12,
            getFillColor: [0, 0, 0, 0],
            getLineColor: isDark ? [239, 68, 68, 255] : [34, 211, 238, 255],
            lineWidthMinPixels: 2,
            stroked: true,
            filled: false,
            pickable: false,
            parameters: { depthTest: false },
          })
        );
      }
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
    handleSelectVessel,
    swarmVessels,
    swarmPhase,
    selectedVessel,
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
      const overlay = new MapboxOverlay({
        interleaved: false,
        layers,
        getCursor: ({ isHovering }) => (isHovering ? "pointer" : "default"),
        onClick: (info) => {
          if (!info.object) {
            setSelectedVessel(null);
            setSelectedHexCell(null);
          }
        },
      });
      overlayRef.current = overlay;
      map.addControl(overlay as unknown as IControl);
      setMapReady(true);
      onMapReady?.(map);
    });

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point);
      if (!features || features.length === 0) {
        setSelectedVessel(null);
        setSelectedHexCell(null);
      }
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

  // Collect dark vessels from p5Data
  const darkVessels = useMemo(() => {
    return (p5Data?.vessels || []).filter((v) => v.isDarkVessel);
  }, [p5Data]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ position: "absolute", inset: 0 }}
    >
      {/* Dark vessel pulsing CSS rings — rendered over map canvas for all dark vessels */}
      {mapReady &&
        darkVessels.map((v, i) => {
          const ping = v.pings?.[0];
          const pos = (ping?.position ?? v.path?.[0]) as [number, number] | undefined;
          if (!pos || typeof pos[0] !== "number" || typeof pos[1] !== "number") return null;

          return (
            <DarkVesselPulse
              key={v.vesselId || i}
              position={pos}
              mapRef={mapRef}
              label={v.vesselName}
              statusText={
                v.darkAnomaly?.notes ??
                (v.darkAnomaly?.estimatedTransitSpeedKnots
                  ? `SOG ${v.darkAnomaly.estimatedTransitSpeedKnots} kn · GAP ${v.darkAnomaly.gapDurationHours || 14}h`
                  : "AIS: BLACKOUT · NO SIGNAL")
              }
              onClick={() => handleSelectVessel(v)}
            />
          );
        })}

      {/* Dark Maritime HUD Panel for Selected Vessel */}
      <VesselInfoPanel
        vessel={selectedVessel}
        onClose={() => setSelectedVessel(null)}
      />

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

      {/* Compact docked hover tooltip card */}
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
