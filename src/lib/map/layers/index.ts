import type { Layer } from "@deck.gl/core";
import type { LayerId } from "../config";
import type { P1Output } from "../../contracts/p1";
import type { P4Output } from "../../contracts/p4";
import type { P5Output, VesselTrack } from "../../contracts/p5";
import { createSarRasterLayer } from "./sarRasterLayer";
import { createSlickPolygonLayer } from "./slickPolygonLayer";
import { createH3CorridorLayer } from "./h3CorridorLayer";
import { createAisTrackLayers } from "./aisTracksLayer";
import { getH3TimestepForHour } from "../../adapters/p4Adapter";
import { getVesselPositionsAtHour } from "../../adapters/p5Adapter";
import type { MapTooltipInfo } from "../types";

export interface BuildLayersOptions {
  visibility: Record<LayerId, boolean>;
  p1Data: P1Output;
  p4Data: P4Output;
  p5Data: P5Output;
  relativeHour: number;
  sarOpacity?: number;
  selectedTrackId?: string;
  selectedTrackColor?: [number, number, number];
  followTrack?: boolean;
  onHover?: (info: MapTooltipInfo | null) => void;
  onSelectVessel?: (vessel: VesselTrack) => void;
}

/**
 * Builds all modular Deck.gl layers for SIH 26143:
 * 1. SAR Raster overlay (P1)
 * 2. Oil Slick Polygon overlay (P1)
 * 3. H3 Hexagonal Density Corridor overlay (P4)
 * 4. AIS Vessel Tracks overlay (P5) with track selection & color customizer
 */
export function buildLayers({
  visibility,
  p1Data,
  p4Data,
  p5Data,
  relativeHour,
  sarOpacity = 0.55,
  selectedTrackId = "all",
  selectedTrackColor = [34, 197, 94],
  followTrack = false,
  onHover,
  onSelectVessel,
}: BuildLayersOptions): Layer[] {
  const layers: Layer[] = [];

  // 1. SAR Raster Layer (P1)
  if (visibility["sar-raster"]) {
    const sar = createSarRasterLayer(p1Data.sarScene, true, sarOpacity);
    if (sar) layers.push(sar);
  }

  // 2. H3 Density Corridor Layer (P4)
  if (visibility["h3-corridor"]) {
    const h3Timestep = getH3TimestepForHour(p4Data, relativeHour);
    if (h3Timestep && h3Timestep.cells.length > 0) {
      const h3Layer = createH3CorridorLayer(
        h3Timestep.cells,
        true,
        relativeHour,
        onHover
      );
      layers.push(h3Layer);
    }
  }

  // 3. Oil Slick Polygon Layer (P1)
  if (visibility["slick-polygon"] && p1Data.slicks && p1Data.slicks.length > 0) {
    const slickLayer = createSlickPolygonLayer(
      p1Data.slicks,
      true,
      onHover
    );
    layers.push(slickLayer);
  }

  // 4. AIS Vessel Tracks & Position Pings (P5)
  const activePositions = getVesselPositionsAtHour(p5Data, relativeHour);
  const aisLayers = createAisTrackLayers({
    vessels: p5Data.vessels,
    activePositions,
    visible: !!visibility["ais-tracks"],
    selectedTrackId,
    selectedTrackColor,
    followTrack,
    onHover,
    onSelectVessel,
  });

  layers.push(...aisLayers);

  return layers;
}
