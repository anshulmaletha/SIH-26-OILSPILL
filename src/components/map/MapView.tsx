import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type IControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ScatterplotLayer, PathLayer, IconLayer, TextLayer } from "@deck.gl/layers";

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
import { type SwarmVessel } from "@/lib/mission/swarmData";
import {
  getMasterShipAtlasDataUri,
  SHIP_ICON_MAPPING,
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
  onSelectVessel?: ((vessel: any) => void) | undefined;
  /** Currently selected vessel (controlled) */
  selectedVessel?: SwarmVessel | VesselTrack | any | null;
  /** Current mission stage — controls swarm layer visibility */
  missionStage?: MissionStage | undefined;
  /** Elapsed ms in current mission stage for animations */
  stageElapsedMs?: number | undefined;
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
  selectedTrackColor = [15, 23, 42],
  followTrack = false,
  theme = "light",
  primarySuspectVesselId,
  onSelectVessel,
  selectedVessel: propsSelectedVessel,
  missionStage,
  stageElapsedMs = 0,
  swarmVessels = [],
  swarmPhase = "swarm",
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const rafRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<MapTooltipInfo | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(INITIAL_VIEW_STATE.zoom);
  const [mapViewportKey, setMapViewportKey] = useState<number>(0);
  const [selectedHexCell, setSelectedHexCell] = useState<{
    cell: H3CellDensity;
    coordinate: [number, number];
    ringK: number;
  } | null>(null);
  const [hexScreenPos, setHexScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [internalSelectedVessel, setInternalSelectedVessel] = useState<SwarmVessel | VesselTrack | null>(null);

  const selectedVessel = propsSelectedVessel !== undefined ? propsSelectedVessel : internalSelectedVessel;
  const styleUrl = BASEMAP_STYLES[theme] ?? BASEMAP_STYLES.light;

  const handleSelectVessel = useCallback(
    (vessel: SwarmVessel | VesselTrack | any | null) => {
      setInternalSelectedVessel(vessel);
      if (onSelectVessel) {
        onSelectVessel(vessel);
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

  // Safety-filtered vessels: accounts for icon size, rotation diagonal, and viewport bounds
  // Prevents any normal vessel from appearing partially cut off at canvas edges
  const visibleSwarmVessels = useMemo(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !mapReady) {
      return swarmVessels;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const currentZ = map.getZoom();

    // Safety margin in pixels from all 4 boundaries (accounts for dot radius + outline)
    const MARGIN_PX = 14;

    return (swarmVessels || []).filter((v) => {
      // Dark vessels & candidates always pass so critical alerts are never hidden
      if (v.isDarkVessel || v.isCandidate || v.suspicionLevel === "high") {
        return true;
      }

      // Check zoom LOD threshold
      const minZ = v.minZoom ?? 0;
      if (currentZ < minZ) return false;

      // Viewport bounds projection check with safety margin
      try {
        if (!v.position || typeof v.position[0] !== "number" || typeof v.position[1] !== "number") {
          return false;
        }
        const pt = map.project(v.position);
        if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number" || isNaN(pt.x) || isNaN(pt.y)) {
          return false;
        }

        // Must be completely inside the padded safe area of the map viewport
        return (
          pt.x >= MARGIN_PX &&
          pt.x <= width - MARGIN_PX &&
          pt.y >= MARGIN_PX &&
          pt.y <= height - MARGIN_PX
        );
      } catch {
        return false;
      }
    });
  }, [swarmVessels, mapViewportKey, currentZoom, mapReady]);

  // Dynamic icon sizing: scaled for visual comfort and zero visual clutter
  const dynamicIconSize = useMemo(() => {
    if (currentZoom >= 10.5) return 28;
    if (currentZoom >= 9.0) return 26;
    if (currentZoom >= 7.0) return 23;
    return 18;
  }, [currentZoom]);

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
      theme,
      missionStage,
      stageElapsedMs,
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

    const extraLayers: (ScatterplotLayer | PathLayer | IconLayer<SwarmVessel> | TextLayer<any>)[] = [];

    const isSuspectStage =
      missionStage === "BACKTRACK_CORRIDOR" ||
      missionStage === "CULPRIT_LOCK" ||
      missionStage === "CONTAINMENT_ROOM" ||
      missionStage === "CASE_FILE";

    // Suspect candidate vessels (e.g. cand-001 / MT IND_TANKER_412, cand-005, cand-006, etc.)
    const candidateSuspectVessels = visibleSwarmVessels.filter(
      (d) =>
        !d.isDarkVessel &&
        (d.isCandidate ||
          d.id === "cand-001" ||
          d.mmsi === "419000101" ||
          d.id === primarySuspectVesselId ||
          d.name?.includes("IND_TANKER_412") ||
          d.suspicionLevel === "high" ||
          d.suspicionLevel === "moderate")
    );

    // Primary culprit vessel (cand-001 / MT IND_TANKER_412)
    const primaryCulprit =
      candidateSuspectVessels.find(
        (d) =>
          d.id === primarySuspectVesselId ||
          d.id === "cand-001" ||
          d.mmsi === "419000101" ||
          d.name?.includes("IND_TANKER_412")
      ) || candidateSuspectVessels[0];

    const otherCandidates = candidateSuspectVessels.filter(
      (d) => d.id !== primaryCulprit?.id
    );

    const darkVesselsInSwarm = visibleSwarmVessels.filter((d) => d.isDarkVessel);

    // Normal background traffic: during suspect stages, candidate vessels are NOT small dots (rendered as prominent ship icons)
    const normalVessels = visibleSwarmVessels.filter(
      (d) =>
        !d.isDarkVessel &&
        (!isSuspectStage || !candidateSuspectVessels.some((c) => c.id === d.id))
    );

    // Helper to calculate vessel position interpolated across relativeHour (-24h to 0h)
    // Allows ALL ships to move along their trajectories during backtracking
    const getSwarmPosition = (d: SwarmVessel): [number, number] => {
      if (relativeHour >= 0 || !d.trajectory || d.trajectory.length < 2) {
        return d.position;
      }
      // relativeHour winds backward from 0 to -24h
      // norm: 1.0 at 0h (latest pos), 0.0 at -24h (earliest pos)
      const norm = Math.max(0, Math.min(1, (relativeHour + 24) / 24));
      const traj = d.trajectory;
      const exactIndex = norm * (traj.length - 1);
      const i1 = Math.floor(exactIndex);
      const i2 = Math.min(traj.length - 1, Math.ceil(exactIndex));
      const t = exactIndex - i1;

      const pt1 = traj[i1] ?? d.position;
      const pt2 = traj[i2] ?? pt1;

      return [
        pt1[0] + t * (pt2[0] - pt1[0]),
        pt1[1] + t * (pt2[1] - pt1[1]),
      ];
    };

    // 1. Normal vessel dots (ScatterplotLayer) - small, clean, subtle dots
    if (normalVessels.length > 0) {
      const normalDotsLayer = new ScatterplotLayer<SwarmVessel>({
        id: "mission-swarm-dots",
        data: normalVessels,
        getPosition: (d: SwarmVessel) => getSwarmPosition(d),
        getRadius: (d: SwarmVessel) => {
          const isSelected =
            selectedVessel &&
            (("id" in selectedVessel && selectedVessel.id === d.id) ||
              ("vesselId" in selectedVessel && selectedVessel.vesselId === d.id));
          if (isSelected) return 6.5;
          if (d.isCandidate) return 5.0;
          return 3.8;
        },
        radiusUnits: "pixels",
        radiusMinPixels: 3,
        radiusMaxPixels: 8,
        getFillColor: (d: SwarmVessel) => {
          const isSelected =
            selectedVessel &&
            (("id" in selectedVessel && selectedVessel.id === d.id) ||
              ("vesselId" in selectedVessel && selectedVessel.vesselId === d.id));
          if (isSelected) return theme === "dark" ? [255, 255, 255, 255] : [15, 23, 42, 255];
          if (swarmPhase === "backtrack" || isSuspectStage) {
            return theme === "dark" ? [71, 85, 105, 75] : [148, 163, 184, 85];
          }

          if (theme === "dark") {
            if (d.vesselType === "tanker") return [56, 189, 248, 200];
            if (d.vesselType === "bulk") return [20, 184, 166, 200];
            if (d.vesselType === "container") return [96, 165, 250, 200];
            return [148, 163, 184, 180];
          }

          if (d.vesselType === "tanker") return [30, 41, 59, 210];
          if (d.vesselType === "bulk") return [51, 65, 85, 210];
          if (d.vesselType === "container") return [71, 85, 105, 210];
          if (d.vesselType === "misc") return [100, 116, 139, 180];
          return [51, 65, 85, 200];
        },
        getLineColor: (d: SwarmVessel) => {
          const isSelected =
            selectedVessel &&
            (("id" in selectedVessel && selectedVessel.id === d.id) ||
              ("vesselId" in selectedVessel && selectedVessel.vesselId === d.id));
          if (isSelected) return theme === "dark" ? [245, 158, 11, 255] : [15, 23, 42, 255];
          return theme === "dark" ? [15, 23, 42, 220] : [255, 255, 255, 220];
        },
        lineWidthMinPixels: 1,
        stroked: true,
        filled: true,
        pickable: true,
        transitions: {
          getPosition: 200,
        },
        updateTriggers: {
          getPosition: [relativeHour],
          getRadius: [selectedVessel],
          getFillColor: [swarmPhase, isSuspectStage, selectedVessel, theme],
          getLineColor: [selectedVessel, theme],
        },
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
          setTooltip({
            x: info.x,
            y: info.y,
            type: "vessel",
            title: v.name,
            items: [
              { label: "MMSI", value: v.mmsi || "—" },
              { label: "Type", value: v.typeLabel || "Vessel" },
              { label: "Speed", value: `${(v.speedKnots ?? 0).toFixed(1)} kn` },
              { label: "Heading", value: `${(v.heading ?? 0).toFixed(0)}°` },
              { label: "Status", value: v.navStatus || "Underway" },
            ],
          });
        },
      });
      extraLayers.push(normalDotsLayer);
    }

    const shipAtlas = getMasterShipAtlasDataUri();

    // 2. Suspect Candidate Ships (IconLayer) - PROMINENT HIGH-VISIBILITY SHIP SILHOUETTES
    if (candidateSuspectVessels.length > 0 && isSuspectStage) {
      // 2a. Target Beacon Reticle Rings (ScatterplotLayer)
      const suspectReticleLayer = new ScatterplotLayer<SwarmVessel>({
        id: "mission-suspect-beacon-rings",
        data: candidateSuspectVessels,
        getPosition: (d: SwarmVessel) => getSwarmPosition(d),
        getRadius: (d: SwarmVessel) => (d.id === primaryCulprit?.id ? 1250 : 800),
        radiusUnits: "meters",
        radiusMinPixels: (d: SwarmVessel) => (d.id === primaryCulprit?.id ? 16 : 12),
        radiusMaxPixels: 38,
        stroked: true,
        filled: false,
        lineWidthMinPixels: (d: SwarmVessel) => (d.id === primaryCulprit?.id ? 2.5 : 1.8),
        getLineColor: (d: SwarmVessel) =>
          d.id === primaryCulprit?.id
            ? theme === "dark"
              ? [254, 240, 138, 255]
              : [220, 38, 38, 255]
            : [245, 158, 11, 210],
        pickable: false,
        transitions: {
          getPosition: 200,
        },
        updateTriggers: {
          getPosition: [relativeHour],
          getRadius: [primaryCulprit],
          getLineColor: [primaryCulprit, theme],
        },
      });
      extraLayers.push(suspectReticleLayer);

      // 2b. Primary Culprit Inner Concentric Alert Ring & Pulse Core
      if (primaryCulprit) {
        const innerBeaconLayer = new ScatterplotLayer<SwarmVessel>({
          id: "mission-culprit-inner-beacon",
          data: [primaryCulprit],
          getPosition: (d: SwarmVessel) => getSwarmPosition(d),
          getRadius: 600,
          radiusUnits: "meters",
          radiusMinPixels: 10,
          radiusMaxPixels: 22,
          stroked: true,
          filled: true,
          getFillColor: [245, 158, 11, 28],
          getLineColor: theme === "dark" ? [245, 158, 11, 240] : [220, 38, 38, 240],
          lineWidthMinPixels: 2,
          pickable: false,
          transitions: {
            getPosition: 200,
          },
          updateTriggers: {
            getPosition: [relativeHour],
            getLineColor: [theme],
          },
        });
        extraLayers.push(innerBeaconLayer);

        const centerPipLayer = new ScatterplotLayer<SwarmVessel>({
          id: "mission-culprit-center-pip",
          data: [primaryCulprit],
          getPosition: (d: SwarmVessel) => getSwarmPosition(d),
          getRadius: 200,
          radiusUnits: "meters",
          radiusMinPixels: 3.5,
          radiusMaxPixels: 8,
          stroked: true,
          filled: true,
          getFillColor: theme === "dark" ? [255, 255, 255, 255] : [220, 38, 38, 255],
          getLineColor: [255, 255, 255, 255],
          lineWidthMinPixels: 1,
          pickable: false,
          transitions: {
            getPosition: 200,
          },
          updateTriggers: {
            getPosition: [relativeHour],
            getFillColor: [theme],
          },
        });
        extraLayers.push(centerPipLayer);

        // 2c. Culprit Historical Corridor Trajectory & Heading Velocity Vector
        if (primaryCulprit.trajectory && primaryCulprit.trajectory.length > 1) {
          extraLayers.push(
            new PathLayer({
              id: "mission-culprit-traj-glow",
              data: [{ path: primaryCulprit.trajectory }],
              getPath: (d: { path: [number, number][] }) => d.path,
              getColor: () => [245, 158, 11, 55],
              getWidth: 6,
              widthUnits: "pixels",
              pickable: false,
              parameters: { depthTest: false },
            }),
            new PathLayer({
              id: "mission-culprit-traj-line",
              data: [{ path: primaryCulprit.trajectory }],
              getPath: (d: { path: [number, number][] }) => d.path,
              getColor: () => [245, 158, 11, 240],
              getWidth: 2.4,
              widthUnits: "pixels",
              pickable: false,
              parameters: { depthTest: false },
            })
          );
        }

        // Forward velocity course vector (heading 135° ~3.5km) anchored to dynamic vessel position
        const curCulpritPos = getSwarmPosition(primaryCulprit);
        const headingRad = ((primaryCulprit.heading ?? 135) * Math.PI) / 180;
        const cosLat = Math.cos((curCulpritPos[1] * Math.PI) / 180) || 1;
        const vecLen = 0.032;
        const forwardPt: [number, number] = [
          curCulpritPos[0] + (Math.sin(headingRad) * vecLen) / cosLat,
          curCulpritPos[1] + Math.cos(headingRad) * vecLen,
        ];
        extraLayers.push(
          new PathLayer({
            id: "mission-culprit-heading-vector",
            data: [{ path: [curCulpritPos, forwardPt] }],
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: () => (theme === "dark" ? [254, 240, 138, 240] : [220, 38, 38, 240]),
            getWidth: 2.2,
            widthUnits: "pixels",
            pickable: false,
            parameters: { depthTest: false },
            transitions: { getPath: 200 },
            updateTriggers: { getPath: [relativeHour] },
          })
        );
      }

      // 2d. Suspect Candidate Vessels - PROMINENT SHIP ICONS (Dynamic backtrack motion)
      const suspectShipsLayer = new IconLayer<SwarmVessel>({
        id: "mission-suspect-ships",
        data: candidateSuspectVessels,
        getPosition: (d: SwarmVessel) => getSwarmPosition(d),
        getIcon: (d: SwarmVessel) =>
          d.id === primaryCulprit?.id ? "ship-culprit" : "ship-amber",
        getSize: (d: SwarmVessel) => {
          const isSelected =
            selectedVessel &&
            (("id" in selectedVessel && selectedVessel.id === d.id) ||
              ("vesselId" in selectedVessel && selectedVessel.vesselId === d.id));
          const isPrimary = d.id === primaryCulprit?.id;
          if (isPrimary) return isSelected ? dynamicIconSize * 1.85 : dynamicIconSize * 1.65;
          return isSelected ? dynamicIconSize * 1.45 : dynamicIconSize * 1.3;
        },
        getAngle: (d: SwarmVessel) => -(d.heading ?? d.course ?? 0),
        iconAtlas: shipAtlas,
        iconMapping: SHIP_ICON_MAPPING,
        sizeUnits: "pixels",
        pickable: true,
        transitions: {
          getPosition: 200,
        },
        updateTriggers: {
          getPosition: [relativeHour],
          getSize: [dynamicIconSize, selectedVessel, primaryCulprit],
          getIcon: [primaryCulprit],
        },
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
          const isPrimary = v.id === primaryCulprit?.id;
          const dynamicPos = getSwarmPosition(v);
          setTooltip({
            x: info.x,
            y: info.y,
            type: isPrimary ? "candidate" : "vessel",
            title: isPrimary ? `⚠ PRIMARY CULPRIT: ${v.name}` : v.name,
            items: [
              { label: "MMSI", value: v.mmsi || "—" },
              {
                label: "Status",
                value: isPrimary ? "ATTRIBUTED CULPRIT (94.2%)" : (v.threatTag || "CORRIDOR CANDIDATE"),
              },
              { label: "Type", value: v.typeLabel || "Crude Oil Tanker" },
              {
                label: "Speed",
                value: isPrimary
                  ? (relativeHour <= -9 && relativeHour >= -15)
                    ? "4.1 kn (Anomaly Drop at Spill Origin)"
                    : relativeHour < -15
                    ? "14.2 kn (Corridor Transit)"
                    : "11.5 kn (Transit to Nhava Sheva)"
                  : `${(v.speedKnots ?? 0).toFixed(1)} kn`,
              },
              { label: "Heading", value: `${(v.heading ?? 0).toFixed(0)}°` },
              { label: "Position", value: `${dynamicPos[1].toFixed(4)}°N, ${dynamicPos[0].toFixed(4)}°E` },
              {
                label: "Reason",
                value: v.suspiciousReason || "Discharge corridor intersection at T-12h",
              },
            ],
          });
        },
      });
      extraLayers.push(suspectShipsLayer);

      // 2e. Floating Tactical HUD Callout Badges (TextLayer)
      if (primaryCulprit) {
        extraLayers.push(
          new TextLayer<SwarmVessel>({
            id: "mission-culprit-text-callout",
            data: [primaryCulprit],
            getPosition: (d: SwarmVessel) => getSwarmPosition(d),
            getText: () => "▲ PRIMARY CULPRIT · IND_TANKER_412 (94.2%)",
            getSize: 11.5,
            getColor: theme === "dark" ? [254, 240, 138, 255] : [15, 23, 42, 255],
            getTextAnchor: "middle",
            getAlignmentBaseline: "bottom",
            getPixelOffset: [0, -34],
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontWeight: 700,
            background: true,
            getBackgroundColor: theme === "dark" ? [15, 23, 42, 240] : [255, 255, 255, 245],
            getBorderColor: theme === "dark" ? [245, 158, 11, 240] : [220, 38, 38, 240],
            getBorderWidth: 1.5,
            backgroundPadding: [8, 4, 8, 4],
            pickable: true,
            transitions: {
              getPosition: 200,
            },
            onClick: () => handleSelectVessel(primaryCulprit),
            updateTriggers: {
              getPosition: [relativeHour],
              getColor: [theme],
              getBackgroundColor: [theme],
              getBorderColor: [theme],
            },
          })
        );
      }

      if (otherCandidates.length > 0) {
        extraLayers.push(
          new TextLayer<SwarmVessel>({
            id: "mission-candidate-text-callouts",
            data: otherCandidates,
            getPosition: (d: SwarmVessel) => getSwarmPosition(d),
            getText: (d: SwarmVessel) => `● CANDIDATE · ${d.name}`,
            getSize: 9.5,
            getColor: theme === "dark" ? [226, 232, 240, 240] : [51, 65, 85, 240],
            getTextAnchor: "middle",
            getAlignmentBaseline: "bottom",
            getPixelOffset: [0, -28],
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
            background: true,
            getBackgroundColor: theme === "dark" ? [15, 23, 42, 215] : [255, 255, 255, 230],
            getBorderColor: [245, 158, 11, 180],
            getBorderWidth: 1,
            backgroundPadding: [6, 3, 6, 3],
            pickable: true,
            transitions: {
              getPosition: 200,
            },
            onClick: (info) => {
              if (info.object) handleSelectVessel(info.object as SwarmVessel);
            },
            updateTriggers: {
              getPosition: [relativeHour],
              getColor: [theme],
              getBackgroundColor: [theme],
            },
          })
        );
      }
    }

    // 3. Dark Vessel Ship Markers (IconLayer) - PROMINENT RED SHIP SILHOUETTES (Dynamic backtrack motion)
    if (darkVesselsInSwarm.length > 0) {
      const darkVesselsLayer = new IconLayer<SwarmVessel>({
        id: "mission-dark-vessel-ships",
        data: darkVesselsInSwarm,
        getPosition: (d: SwarmVessel) => getSwarmPosition(d),
        getIcon: () => "ship-red",
        getSize: (d: SwarmVessel) => {
          const isSelected =
            selectedVessel &&
            (("id" in selectedVessel && selectedVessel.id === d.id) ||
              ("vesselId" in selectedVessel && selectedVessel.vesselId === d.id));
          return isSelected ? dynamicIconSize * 1.5 : dynamicIconSize * 1.3;
        },
        getAngle: (d: SwarmVessel) => -(d.heading ?? d.course ?? 0),
        iconAtlas: shipAtlas,
        iconMapping: SHIP_ICON_MAPPING,
        sizeUnits: "pixels",
        pickable: true,
        transitions: {
          getPosition: 200,
        },
        updateTriggers: {
          getPosition: [relativeHour],
          getSize: [dynamicIconSize, selectedVessel],
        },
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
          setTooltip({
            x: info.x,
            y: info.y,
            type: "dark-vessel",
            title: v.name,
            items: [
              { label: "MMSI", value: v.mmsi || "—" },
              { label: "Type", value: v.typeLabel || "Dark Target" },
              { label: "Speed", value: `${(v.speedKnots ?? 0).toFixed(1)} kn` },
              { label: "Heading", value: `${(v.heading ?? 0).toFixed(0)}°` },
              { label: "Status", value: "BLACKOUT / SAR RADAR TARGET" },
              { label: "Threat", value: v.threatTag || "CRITICAL PROBABILITY" },
            ],
          });
        },
      });
      extraLayers.push(darkVesselsLayer);
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
    visibleSwarmVessels,
    dynamicIconSize,
    swarmPhase,
    selectedVessel,
    theme,
    missionStage,
    stageElapsedMs,
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

    const updateViewport = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setMapViewportKey((k) => k + 1);
      });
    };

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
      setCurrentZoom(map.getZoom());
      updateViewport();
      onMapReady?.(map);
    });

    map.on("move", updateViewport);
    map.on("zoom", () => {
      if (map) {
        setCurrentZoom(map.getZoom());
      }
      updateViewport();
    });
    map.on("rotate", updateViewport);
    map.on("pitch", updateViewport);
    map.on("resize", updateViewport);

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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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

  // Follow Selected Track (Camera is kept still per user requirement)
  useEffect(() => {
    // Camera is intentionally kept still across all interactions
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
        onClose={() => handleSelectVessel(null)}
      />

      {/* Docked H3 Cell Details Popover (Click Interactivity) */}
      {selectedHexCell && hexScreenPos && (
        <div
          className="absolute z-30"
          style={{
            left: hexScreenPos.x + 16,
            top: hexScreenPos.y - 30,
            zIndex: 35,
            width: "215px",
            background: theme === "dark" ? "#0F172A" : "#FFFFFF",
            border: `1px solid ${theme === "dark" ? "#1E293B" : "#CBD5E1"}`,
            borderLeft: `2px solid ${theme === "dark" ? "#F8FAFC" : "#0F172A"}`,
            borderRadius: "2px",
            padding: "8px 10px",
            boxShadow: theme === "dark" ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.08)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${theme === "dark" ? "#1E293B" : "#E2E8F0"}`,
              paddingBottom: "4px",
              marginBottom: "6px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: theme === "dark" ? "#F8FAFC" : "#0F172A",
                letterSpacing: "0.08em",
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
                color: theme === "dark" ? "#94A3B8" : "#64748B",
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
              <span style={{ color: theme === "dark" ? "#94A3B8" : "#64748B" }}>Hex ID</span>
              <span style={{ color: theme === "dark" ? "#F8FAFC" : "#0F172A", fontWeight: 600 }}>{selectedHexCell.cell.h3Index}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: theme === "dark" ? "#94A3B8" : "#64748B" }}>Particle Count</span>
              <span style={{ color: theme === "dark" ? "#CBD5E1" : "#334155" }}>{selectedHexCell.cell.particleCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: theme === "dark" ? "#94A3B8" : "#64748B" }}>Ring (k)</span>
              <span style={{ color: theme === "dark" ? "#F8FAFC" : "#0F172A", fontWeight: 700 }}>
                k = {selectedHexCell.ringK}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: theme === "dark" ? "#94A3B8" : "#64748B" }}>Weight / Density</span>
              <span style={{ color: theme === "dark" ? "#F8FAFC" : "#0F172A", fontWeight: 700 }}>
                {selectedHexCell.cell.density.toFixed(2)} ({(selectedHexCell.cell.density * 100).toFixed(0)}%)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: theme === "dark" ? "#94A3B8" : "#64748B" }}>Risk Level</span>
              <span
                style={{
                  color: selectedHexCell.cell.riskLevel === "critical" || selectedHexCell.cell.riskLevel === "high"
                    ? "#DC2626"
                    : (theme === "dark" ? "#CBD5E1" : "#334155"),
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
              background: theme === "dark" ? "#0F172A" : "#FFFFFF",
              border: `1px solid ${theme === "dark" ? "#1E293B" : "#CBD5E1"}`,
              borderLeft: `2px solid ${tooltip.type === "dark-vessel" ? "#DC2626" : (theme === "dark" ? "#F8FAFC" : "#0F172A")}`,
              borderRadius: "2px",
              padding: "6px 9px",
              boxShadow: theme === "dark" ? "0 2px 10px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.08)",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "8px",
                borderBottom: `1px solid ${theme === "dark" ? "#1E293B" : "#E2E8F0"}`,
                paddingBottom: "3px",
                marginBottom: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  color: tooltip.type === "dark-vessel" ? "#DC2626" : (theme === "dark" ? "#F8FAFC" : "#0F172A"),
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
                  color: tooltip.type === "dark-vessel" ? "#DC2626" : (theme === "dark" ? "#94A3B8" : "#64748B"),
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
                      color: theme === "dark" ? "#94A3B8" : "#5A7A94",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      color: theme === "dark" ? "#F8FAFC" : "#0F172A",
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
