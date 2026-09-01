import { GeoJsonLayer } from "@deck.gl/layers";

import { LAYER_IDS } from "../config";
import { SLICK_POLYGONS } from "../data/sampleData";

/** Placeholder oil-slick extent polygons. */
export function createSlickPolygonLayer(visible: boolean) {
  const features = SLICK_POLYGONS.map((slick) => ({
    type: "Feature" as const,
    properties: { id: slick.id, confidence: slick.confidence },
    geometry: { type: "Polygon" as const, coordinates: [slick.ring] },
  }));

  return new GeoJsonLayer({
    id: LAYER_IDS.slickPolygon,
    visible,
    data: { type: "FeatureCollection", features },
    filled: true,
    stroked: true,
    getFillColor: [245, 158, 11, 70],
    getLineColor: [245, 158, 11, 220],
    getLineWidth: 2,
    lineWidthUnits: "pixels",
    pickable: true,
  });
}
