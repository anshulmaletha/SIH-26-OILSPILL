import type { Layer } from "@deck.gl/core";
import type { LayerId } from "../config";
import type { P1Output } from "../../contracts/p1";
import type { P4Output, H3CellDensity } from "../../contracts/p4";
import type { P5Output, VesselTrack } from "../../contracts/p5";
import { createSarRasterLayer } from "./sarRasterLayer";
import { createSlickPolygonLayer } from "./slickPolygonLayer";
import { createH3CorridorLayer } from "./h3CorridorLayer";
import { createAisTrackLayers } from "./aisTracksLayer";
import { getH3CorridorForTrackAndHour } from "../../adapters/p4Adapter";
import { getVesselPositionsAtHour } from "../../adapters/p5Adapter";
import type { MapTooltipInfo } from "../types";

export interface BuildLayersOptions {
  visibility: Record<LayerId, boolean>;
  p1Data: P1Output;
  p4Data: P4Output;
  p5Data: P5Output;
  relativeHour: number;
  windSpeedMs?: number | undefined;
  windHeadingDeg?: number | undefined;
  currentSpeedMs?: number | undefined;
  currentHeadingDeg?: number | undefined;
  sarOpacity?: number | undefined;
  selectedTrackId?: string | undefined;
  selectedTrackColor?: [number, number, number] | undefined;
  followTrack?: boolean | undefined;
  primarySuspectVesselId?: string | undefined;
  onHover?: ((info: MapTooltipInfo | null) => void) | undefined;
  onSelectVessel?: ((vessel: VesselTrack) => void) | undefined;
  onClickHex?: ((cell: H3CellDensity, coordinate: [number, number], x: number, y: number) => void) | undefined;
}

/**
 * Builds all modular Deck.gl layers for SIH 26143:
 * 1. SAR Raster overlay (P1)
 * 2. H3 Hexagonal Density Corridor overlay (P4)
 * 3. Oil Slick Polygon overlay with organic physics (P1)
 * 4. AIS Vessel Tracks + ship icon markers + dark vessel marker (P5)
 */
export function buildLayers({
  visibility,
  p1Data,
  p4Data,
  p5Data,
  relativeHour,
  windSpeedMs,
  windHeadingDeg,
  currentSpeedMs,
  currentHeadingDeg,
  sarOpacity = 0.55,
  selectedTrackId = "all",
  selectedTrackColor = [34, 211, 238],
  followTrack = false,
  primarySuspectVesselId,
  onHover,
  onSelectVessel,
  onClickHex,
}: BuildLayersOptions): Layer[] {
  const layers: Layer[] = [];

  // 1. SAR Raster Layer (P1)
  if (visibility["sar-raster"]) {
    const sar = createSarRasterLayer(p1Data.sarScene, true, sarOpacity);
    if (sar) layers.push(sar);
  }

  // 2. H3 Density Corridor Layer (P4)
  if (visibility["h3-corridor"]) {
    const h3Cells = getH3CorridorForTrackAndHour(
      p4Data,
      p5Data,
      selectedTrackId,
      relativeHour
    );
    if (h3Cells && h3Cells.length > 0) {
      const h3Layer = createH3CorridorLayer(h3Cells, true, relativeHour, onHover, onClickHex);
      layers.push(h3Layer);
    }
  }

  // 3. Dynamic Organic Oil Slick Polygon Layer (P1 + Physics Engine)
  if (visibility["slick-polygon"] && p1Data.slicks && p1Data.slicks.length > 0) {
    const slickLayers = createSlickPolygonLayer(
      p1Data.slicks, 
      true, 
      onHover, 
      relativeHour,
      windSpeedMs,
      windHeadingDeg,
      currentSpeedMs,
      currentHeadingDeg
    );
    if (Array.isArray(slickLayers)) {
      layers.push(...slickLayers);
    } else if (slickLayers) {
      layers.push(slickLayers);
    }
  }

  // 4. AIS Tracks & Vessel Markers Layer (P5)
  if (visibility["ais-tracks"]) {
    const timePositions = getVesselPositionsAtHour(p5Data, relativeHour);
    const aisLayers = createAisTrackLayers({
      vessels: p5Data.vessels || [],
      activePositions: timePositions || [],
      visible: true,
      selectedTrackId,
      selectedTrackColor,
      followTrack,
      primarySuspectVesselId,
      onHover,
      onSelectVessel,
    });
    layers.push(...aisLayers);
  }

  return layers;
}
