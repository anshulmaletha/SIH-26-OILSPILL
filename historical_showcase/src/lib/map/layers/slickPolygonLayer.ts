import { GeoJsonLayer } from "@deck.gl/layers";
import { LAYER_IDS } from "../config";
import type { SlickPolygonData } from "../../contracts/p1";
import type { MapTooltipInfo } from "../types";

export function createSlickPolygonLayer(
  slicks: SlickPolygonData[],
  visible: boolean,
  missionStage?: string,
  onHover?: (info: MapTooltipInfo | null) => void
) {
  // During SAR_ACQUISITION (Scanning & Detection), it looks like raw SAR backscatter.
  // When it hits VALIDATION_AUDIT (Segmentation & Look-alike), it becomes the binary mask.
  const isRawSar = missionStage === "SAR_ACQUISITION";

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
    // Task 2: Raw SAR appearance -> Binary mask transition
    getFillColor: isRawSar ? [30, 35, 40, 200] : [245, 158, 11, 120], 
    getLineColor: isRawSar ? [100, 110, 120, 150] : [251, 191, 36, 255], 
    getLineWidth: isRawSar ? 1 : 3,
    lineWidthUnits: "pixels",
    pickable: true,
    updateTriggers: {
      getFillColor: [missionStage],
      getLineColor: [missionStage],
      getLineWidth: [missionStage],
    },
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
