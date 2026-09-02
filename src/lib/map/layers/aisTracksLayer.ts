import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { LAYER_IDS } from "../config";
import type { VesselTrack } from "../../contracts/p5";
import type { ActiveVesselPosition } from "../../adapters/p5Adapter";
import type { MapTooltipInfo } from "../types";

export interface AisTrackLayerOptions {
  vessels: VesselTrack[];
  activePositions: ActiveVesselPosition[];
  visible: boolean;
  selectedVesselId?: string | null;
  onHover?: (info: MapTooltipInfo | null) => void;
  onSelectVessel?: (vessel: VesselTrack) => void;
}

const TRACK_COLORS: [number, number, number][] = [
  [74, 222, 128], // Emerald Green
  [96, 165, 250], // Sky Blue
  [244, 114, 182], // Soft Pink
  [251, 191, 36], // Amber
];

/** Dedicated AIS vessel tracks overlay layer (P5 integration) */
export function createAisTrackLayers({
  vessels,
  activePositions,
  visible,
  selectedVesselId,
  onHover,
  onSelectVessel,
}: AisTrackLayerOptions) {
  if (!visible) return [];

  // 1. Vessel historical track paths
  const tracks = new PathLayer<VesselTrack>({
    id: LAYER_IDS.aisTracks,
    visible,
    data: vessels,
    getPath: (d) => d.path,
    getColor: (_d, { index }) => {
      if (_d.vesselId === selectedVesselId) return [56, 189, 248, 255];
      return TRACK_COLORS[index % TRACK_COLORS.length] ?? [74, 222, 128];
    },
    getWidth: (_d) => (_d.vesselId === selectedVesselId ? 4 : 2.5),
    widthUnits: "pixels",
    pickable: true,
    updateTriggers: {
      getColor: [selectedVesselId],
      getWidth: [selectedVesselId],
    },
    onHover: (info) => {
      if (!onHover) return;
      if (!info.object) {
        onHover(null);
        return;
      }
      const v = info.object as VesselTrack;
      onHover({
        x: info.x,
        y: info.y,
        type: "vessel",
        title: v.vesselName,
        items: [
          { label: "MMSI", value: v.mmsi },
          { label: "Flag", value: v.flag },
          { label: "Type", value: v.vesselType },
          { label: "Destination", value: v.destination },
        ],
        vesselData: v,
      });
    },
    onClick: (info) => {
      if (info.object && onSelectVessel) {
        onSelectVessel(info.object as VesselTrack);
      }
    },
  });

  // 2. Active vessel position pings at observation time
  const pings = new ScatterplotLayer<ActiveVesselPosition>({
    id: `${LAYER_IDS.aisTracks}-pings`,
    visible,
    data: activePositions,
    getPosition: (d) => d.currentPosition,
    getRadius: 70,
    radiusUnits: "meters",
    getFillColor: (d) => {
      if (d.vessel.vesselId === selectedVesselId) return [56, 189, 248, 255];
      return [255, 255, 255, 230];
    },
    getLineColor: [74, 222, 128, 255],
    lineWidthMinPixels: 2,
    stroked: true,
    pickable: true,
    updateTriggers: {
      getPosition: [activePositions],
      getFillColor: [selectedVesselId],
    },
    onHover: (info) => {
      if (!onHover) return;
      if (!info.object) {
        onHover(null);
        return;
      }
      const p = info.object as ActiveVesselPosition;
      onHover({
        x: info.x,
        y: info.y,
        type: "vessel",
        title: p.vessel.vesselName,
        items: [
          { label: "MMSI", value: p.vessel.mmsi },
          { label: "Speed (SOG)", value: `${p.speedKnots.toFixed(1)} knots` },
          { label: "Heading", value: `${p.heading.toFixed(0)}°` },
          { label: "Position", value: `${p.currentPosition[0].toFixed(3)}°E, ${p.currentPosition[1].toFixed(3)}°N` },
        ],
        vesselData: p.vessel,
      });
    },
    onClick: (info) => {
      if (info.object && onSelectVessel) {
        onSelectVessel((info.object as ActiveVesselPosition).vessel);
      }
    },
  });

  return [tracks, pings];
}
