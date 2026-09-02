import { GeoJsonLayer } from "@deck.gl/layers";
import { LAYER_IDS } from "../config";
import type { SlickPolygonData } from "../../contracts/p1";
import type { MapTooltipInfo } from "../types";

export function createSlickPolygonLayer(
  slicks: SlickPolygonData[],
  visible: boolean,
  onHover?: (info: MapTooltipInfo | null) => void
) {
  const features = slicks.map((slick) => ({
    type: "Feature" as const,
    properties: slick,
    geometry: {
      type: "Polygon" as const,
      coordinates: [slick.coordinates],
    },
  }));

  return new GeoJsonLayer({
    id: LAYER_IDS.slickPolygon,
    visible,
    data: { type: "FeatureCollection", features },
    filled: true,
    stroked: true,
    getFillColor: [245, 158, 11, 120], // Translucent rich amber
    getLineColor: [251, 191, 36, 255], // Glowing amber outline
    getLineWidth: 3,
    lineWidthUnits: "pixels",
    pickable: true,
    onHover: (info) => {
      if (!onHover) return;
      if (!info.object) {
        onHover(null);
        return;
      }
      const p = info.object.properties as SlickPolygonData;
      onHover({
        x: info.x,
        y: info.y,
        type: "slick",
        title: `Oil Slick (${p.id})`,
        items: [
          { label: "Confidence", value: `${(p.confidence * 100).toFixed(1)}%` },
          { label: "Area", value: `${p.areaKm2.toFixed(2)} km²` },
          { label: "Category", value: p.thicknessCategory.replace("_", " ").toUpperCase() },
          { label: "Est. Volume", value: `${p.estimatedVolumeM3 ?? 0} m³` },
        ],
      });
    },
  });
}
