import { PathLayer, ScatterplotLayer, IconLayer } from "@deck.gl/layers";
import { LAYER_IDS } from "../config";
import type { VesselTrack } from "../../contracts/p5";
import type { ActiveVesselPosition } from "../../adapters/p5Adapter";
import type { MapTooltipInfo } from "../types";
import {
  getShipIconDataUri,
  getSuspectHaloDataUri,
  SHIP_ICON_MAPPING,
  HALO_ICON_MAPPING,
  SHIP_ICON_SIZE,
} from "../ShipIcon";

export interface AisTrackLayerOptions {
  vessels: VesselTrack[];
  activePositions: ActiveVesselPosition[];
  visible: boolean;
  selectedTrackId?: string | undefined; // "all" | specific vesselId
  selectedTrackColor?: [number, number, number] | undefined; // custom RGB (restricted to cyan family)
  followTrack?: boolean | undefined;
  primarySuspectVesselId?: string | undefined; // vessel with highest score — gets subtle cyan halo ring
  onHover?: ((info: MapTooltipInfo | null) => void) | undefined;
  onSelectVessel?: ((vessel: VesselTrack) => void) | undefined;
}

// Cyan family — all tracks use shades of #22D3EE
// [34, 211, 238] full cyan   — selected/candidate track
// [14, 116, 144] dim cyan    — de-emphasized tracks
// [20, 184, 166] teal        — cleared/non-candidate tracks
const CYAN_FULL: [number, number, number] = [34, 211, 238];
const CYAN_DIM:  [number, number, number] = [14, 116, 144];
const TEAL:      [number, number, number] = [20, 184, 166];

/** Dark vessel fixed position — red, SAR-only, no track */
const DARK_VESSEL_COLOR: [number, number, number, number] = [239, 68, 68, 255]; // #EF4444

/**
 * Dedicated AIS vessel tracks overlay layer (P5 integration).
 * Cyan-only track palette. Ship-icon markers rotated to heading.
 * Dark vessel rendered as a separate red ScatterplotLayer (no path).
 */
export function createAisTrackLayers({
  vessels,
  activePositions,
  visible,
  selectedTrackId = "all",
  selectedTrackColor = CYAN_FULL,
  followTrack = false,
  primarySuspectVesselId,
  onHover,
  onSelectVessel,
}: AisTrackLayerOptions) {
  if (!visible) return [];

  const isSpecificSelected = selectedTrackId !== "all";

  // Separate dark vessels (no AIS track to render)
  const darkVesselPositions = activePositions.filter((p) => p.vessel.isDarkVessel);
  const aisPositions = activePositions.filter((p) => !p.vessel.isDarkVessel);
  const aisVessels = vessels.filter((v) => !v.isDarkVessel);

  // ── 1. Motion trails behind moving vessels (fading dashes indicating travel direction) ──
  interface MotionTrailDash {
    id: string;
    path: [number, number][];
    color: [number, number, number, number];
    width: number;
  }

  const motionDashes: MotionTrailDash[] = [];

  for (const pos of aisPositions) {
    if (pos.speedKnots < 0.2) continue;
    const [lng, lat] = pos.currentPosition;
    const heading = pos.heading;
    const backRad = ((heading + 180) % 360) * (Math.PI / 180);
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
    const dirLng = Math.sin(backRad) / cosLat;
    const dirLat = Math.cos(backRad);

    const isThisSelected = pos.vessel.vesselId === selectedTrackId;
    const baseColor = isThisSelected ? selectedTrackColor : (pos.vessel.isCandidate ? CYAN_FULL : TEAL);

    // 5 short fading dashes trailing behind the ship icon
    const dashSteps = [
      { start: 0.003, end: 0.009, alpha: 215, width: 2.5 },
      { start: 0.012, end: 0.018, alpha: 165, width: 2.2 },
      { start: 0.021, end: 0.027, alpha: 115, width: 1.8 },
      { start: 0.030, end: 0.036, alpha: 65,  width: 1.5 },
      { start: 0.039, end: 0.045, alpha: 30,  width: 1.2 },
    ];

    dashSteps.forEach((d, idx) => {
      const p1: [number, number] = [lng + dirLng * d.start, lat + dirLat * d.start];
      const p2: [number, number] = [lng + dirLng * d.end, lat + dirLat * d.end];
      motionDashes.push({
        id: `${pos.vessel.vesselId}-dash-${idx}`,
        path: [p1, p2],
        color: [...baseColor, d.alpha],
        width: d.width,
      });
    });
  }

  const motionTrailLayer = new PathLayer<MotionTrailDash>({
    id: `${LAYER_IDS.aisTracks}-motion-trails`,
    visible,
    data: motionDashes,
    getPath: (d) => d.path,
    getColor: (d) => d.color,
    getWidth: (d) => d.width,
    widthUnits: "pixels",
    pickable: false,
    updateTriggers: {
      getPath: [activePositions],
      getColor: [activePositions, selectedTrackId, selectedTrackColor],
    },
    transitions: {
      getPath: 250,
    },
  });

  // ── 2. Subtle historical reference path (faint, de-emphasized) ─────────────
  const tracks = new PathLayer<VesselTrack>({
    id: LAYER_IDS.aisTracks,
    visible,
    data: isSpecificSelected
      ? aisVessels.filter((v) => v.vesselId === selectedTrackId)
      : aisVessels,
    getPath: (d) => d.path,
    getColor: (d) => {
      const isThisSelected = d.vesselId === selectedTrackId;
      if (isThisSelected) {
        return [...selectedTrackColor, 120] as [number, number, number, number];
      }
      return [...TEAL, 35] as [number, number, number, number];
    },
    getWidth: (d) => (d.vesselId === selectedTrackId ? 2 : 1),
    widthUnits: "pixels",
    pickable: true,
    updateTriggers: {
      getColor: [selectedTrackId, selectedTrackColor],
      getWidth: [selectedTrackId],
    },
    onHover: (info) => {
      if (!onHover) return;
      if (!info.object) { onHover(null); return; }
      const v = info.object as VesselTrack;
      onHover({
        x: info.x, y: info.y,
        type: "vessel",
        title: v.vesselName,
        items: [
          { label: "MMSI", value: v.mmsi || "—" },
          { label: "Status", value: v.vesselId === selectedTrackId ? "SELECTED" : "Monitored" },
        ],
        vesselData: v,
      });
    },
    onClick: (info) => {
      if (info.object && onSelectVessel) onSelectVessel(info.object as VesselTrack);
    },
  });

  // ── 3. Normal AIS Vessels: Subtle Clean Blue Dots (ScatterplotLayer) ──────
  const aisDots = new ScatterplotLayer<ActiveVesselPosition>({
    id: `${LAYER_IDS.aisTracks}-dots`,
    visible,
    data: aisPositions,
    getPosition: (d) => d.currentPosition,
    getRadius: (d) => {
      const isThisSelected = d.vessel.vesselId === selectedTrackId;
      if (isThisSelected) return 6.5;
      if (d.vessel.isCandidate) return 5.0;
      return 4.0;
    },
    radiusUnits: "pixels",
    radiusMinPixels: 3,
    radiusMaxPixels: 8,
    getFillColor: (d) => {
      const isThisSelected = d.vessel.vesselId === selectedTrackId;
      if (isThisSelected) return [255, 255, 255, 255];
      if (d.vessel.isCandidate) return [245, 158, 11, 230];
      const typeLower = (d.vessel.vesselType || "").toLowerCase();
      if (typeLower.includes("tanker")) return [56, 189, 248, 205];
      if (typeLower.includes("bulk")) return [20, 184, 166, 205];
      if (typeLower.includes("container")) return [96, 165, 250, 205];
      if (typeLower.includes("tug") || typeLower.includes("osv") || typeLower.includes("support")) return [148, 163, 184, 180];
      return [34, 211, 238, 200];
    },
    getLineColor: (d) => {
      const isThisSelected = d.vessel.vesselId === selectedTrackId;
      if (isThisSelected) return [34, 211, 238, 255];
      return [10, 15, 26, 220];
    },
    lineWidthMinPixels: 1,
    stroked: true,
    filled: true,
    pickable: true,
    transitions: {
      getPosition: 250,
    },
    updateTriggers: {
      getPosition: [activePositions],
      getRadius: [selectedTrackId],
      getFillColor: [selectedTrackId, selectedTrackColor, activePositions],
      getLineColor: [selectedTrackId],
    },
    onHover: (info) => {
      if (!onHover) return;
      if (!info.object) { onHover(null); return; }
      const p = info.object as ActiveVesselPosition;
      onHover({
        x: info.x, y: info.y,
        type: "vessel",
        title: p.vessel.vesselName,
        items: [
          { label: "MMSI",    value: p.vessel.mmsi || "—" },
          { label: "Type",    value: p.vessel.vesselType || "Vessel" },
          { label: "Speed",   value: `${p.speedKnots.toFixed(1)} kn` },
          { label: "Heading", value: `${p.heading.toFixed(0)}°` },
          { label: "Coord",   value: `${p.currentPosition[1].toFixed(4)}°N, ${p.currentPosition[0].toFixed(4)}°E` },
        ],
        vesselData: p.vessel,
      });
    },
    onClick: (info) => {
      if (info.object && onSelectVessel) onSelectVessel((info.object as ActiveVesselPosition).vessel);
    },
  });

  // ── 3. Suspect halo ring (IconLayer) — subtle ring for primary suspect ──────
  const haloLayers: IconLayer<ActiveVesselPosition>[] = [];
  if (primarySuspectVesselId) {
    const suspectPos = aisPositions.filter((p) => p.vessel.vesselId === primarySuspectVesselId);
    if (suspectPos.length > 0) {
      const haloAtlas = getSuspectHaloDataUri();
      haloLayers.push(
        new IconLayer<ActiveVesselPosition>({
          id: `${LAYER_IDS.aisTracks}-halo`,
          visible,
          data: suspectPos,
          getPosition: (d) => d.currentPosition,
          getIcon: () => "halo",
          getSize: () => SHIP_ICON_SIZE * 2.5,
          getColor: () => [34, 211, 238, 100] as [number, number, number, number],
          iconAtlas: haloAtlas,
          iconMapping: HALO_ICON_MAPPING,
          sizeUnits: "pixels",
          pickable: false,
          updateTriggers: { getPosition: [activePositions] },
        })
      );
    }
  }

  // ── 4. Dark vessel marker (IconLayer) — red ship hull silhouette rotated to heading ─────
  const darkVesselLayer = new IconLayer<ActiveVesselPosition>({
    id: `${LAYER_IDS.aisTracks}-dark-vessel`,
    visible,
    data: darkVesselPositions,
    getPosition: (d) => d.currentPosition,
    getIcon: () => "ship-red",
    getSize: () => SHIP_ICON_SIZE * 1.25,
    getAngle: (d) => -(d.heading ?? 0),
    iconAtlas: shipIconAtlas,
    iconMapping: SHIP_ICON_MAPPING,
    sizeUnits: "pixels",
    pickable: true,
    updateTriggers: { getPosition: [darkVesselPositions], getAngle: [darkVesselPositions] },
    onHover: (info) => {
      if (!onHover) return;
      if (!info.object) { onHover(null); return; }
      const p = info.object as ActiveVesselPosition;
      onHover({
        x: info.x, y: info.y,
        type: "dark-vessel",
        title: p.vessel.vesselName || "DARK VESSEL — SAR Only",
        items: [
          { label: "Detection", value: p.vessel.darkAnomaly ? "CFAR_DARK_002" : "SAR Target" },
          { label: "AIS", value: "BLACKOUT — No signal" },
          { label: "Heading", value: `${(p.heading ?? 0).toFixed(0)}°` },
          { label: "Position", value: `${p.currentPosition[1].toFixed(4)}°N, ${p.currentPosition[0].toFixed(4)}°E` },
        ],
        vesselData: p.vessel,
      });
    },
    onClick: (info) => {
      if (info.object && onSelectVessel) onSelectVessel((info.object as ActiveVesselPosition).vessel);
    },
  });

  return [tracks, motionTrailLayer, ...haloLayers, aisDots, darkVesselLayer];
}
