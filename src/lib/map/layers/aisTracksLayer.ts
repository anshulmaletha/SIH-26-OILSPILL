import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { LAYER_IDS } from "../config";
import type { VesselTrack } from "../../contracts/p5";
import type { ActiveVesselPosition } from "../../adapters/p5Adapter";
import type { MapTooltipInfo } from "../types";

export interface AisTrackLayerOptions {
  vessels: VesselTrack[];
  activePositions: ActiveVesselPosition[];
  visible: boolean;
  selectedTrackId?: string; // "all" | specific vesselId
  selectedTrackColor?: [number, number, number]; // custom RGB chosen by user
  followTrack?: boolean;
  onHover?: (info: MapTooltipInfo | null) => void;
  onSelectVessel?: (vessel: VesselTrack) => void;
}

const DEFAULT_TRACK_COLORS: [number, number, number][] = [
  [34, 197, 94],   // Emerald Green
  [56, 189, 248],  // Sky Blue
  [236, 72, 153],  // Pink / Magenta
  [249, 115, 22],  // Vibrant Orange
  [168, 85, 247],  // Purple
  [251, 191, 36],  // Amber
];

/**
 * Dedicated AIS vessel tracks overlay layer (P5 integration).
 * Supports path selection, custom color styling, and follow mode.
 */
export function createAisTrackLayers({
  vessels,
  activePositions,
  visible,
  selectedTrackId = "all",
  selectedTrackColor = [34, 197, 94],
  followTrack = false,
  onHover,
  onSelectVessel,
}: AisTrackLayerOptions) {
  if (!visible) return [];

  const isSpecificSelected = selectedTrackId !== "all";

  // 1. Vessel historical track paths
  const tracks = new PathLayer<VesselTrack>({
    id: LAYER_IDS.aisTracks,
    visible,
    data: vessels,
    getPath: (d) => d.path,
    getColor: (d, { index }) => {
      const isThisSelected = d.vesselId === selectedTrackId;

      if (isThisSelected) {
        // High-contrast full opacity user-selected color
        return [...selectedTrackColor, 255] as [number, number, number, number];
      }

      const baseColor = DEFAULT_TRACK_COLORS[index % DEFAULT_TRACK_COLORS.length] ?? [34, 197, 94];

      if (isSpecificSelected) {
        // De-emphasize other tracks when a specific track is selected
        return [...baseColor, 90] as [number, number, number, number];
      }

      // Normal mode: all tracks clearly visible
      return [...baseColor, 200] as [number, number, number, number];
    },
    getWidth: (d) => {
      if (d.vesselId === selectedTrackId) {
        return 4.5; // Thicker line with emphasis
      }
      return isSpecificSelected ? 1.8 : 2.8;
    },
    widthUnits: "pixels",
    pickable: true,
    updateTriggers: {
      getColor: [selectedTrackId, selectedTrackColor, followTrack],
      getWidth: [selectedTrackId, followTrack],
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
          { label: "Track Status", value: v.vesselId === selectedTrackId ? "SELECTED (ACTIVE)" : "Monitored" },
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
    getRadius: (d) => (d.vessel.vesselId === selectedTrackId ? 95 : 65),
    radiusUnits: "meters",
    getFillColor: (d) => {
      if (d.vessel.vesselId === selectedTrackId) {
        return [...selectedTrackColor, 255] as [number, number, number, number];
      }
      return [255, 255, 255, isSpecificSelected ? 140 : 230];
    },
    getLineColor: (d, { index }) => {
      if (d.vessel.vesselId === selectedTrackId) {
        return [255, 255, 255, 255];
      }
      const baseColor = DEFAULT_TRACK_COLORS[index % DEFAULT_TRACK_COLORS.length] ?? [34, 197, 94];
      return [...baseColor, isSpecificSelected ? 120 : 255] as [number, number, number, number];
    },
    lineWidthMinPixels: 2,
    stroked: true,
    pickable: true,
    updateTriggers: {
      getPosition: [activePositions],
      getFillColor: [selectedTrackId, selectedTrackColor],
      getRadius: [selectedTrackId],
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
          { label: "Selected", value: p.vessel.vesselId === selectedTrackId ? "YES" : "No" },
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
