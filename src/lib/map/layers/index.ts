import type { Layer } from "@deck.gl/core";

import type { LayerId } from "../config";
import { createAisTrackLayers } from "./aisTracksLayer";
import { createH3CorridorLayer } from "./h3CorridorLayer";
import { createSarRasterLayer } from "./sarRasterLayer";
import { createSlickPolygonLayer } from "./slickPolygonLayer";

/**
 * Builds all placeholder deck.gl layers for the dashboard.
 * Swap the individual create*Layer implementations for real data
 * pipelines later — the UI only depends on this function's signature.
 */
export function buildLayers(visibility: Record<LayerId, boolean>): Layer[] {
  return [
    createSarRasterLayer(visibility["sar-raster"]),
    createH3CorridorLayer(visibility["h3-corridor"]),
    createSlickPolygonLayer(visibility["slick-polygon"]),
    ...createAisTrackLayers(visibility["ais-tracks"]),
  ];
}
