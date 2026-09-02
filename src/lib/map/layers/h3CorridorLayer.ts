import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { LAYER_IDS } from "../config";
import type { H3CellDensity } from "../../contracts/p4";
import { getDensityColor } from "../../adapters/p4Adapter";
import type { MapTooltipInfo } from "../types";

export function createH3CorridorLayer(
  cells: H3CellDensity[],
  visible: boolean,
  relativeHour: number,
  onHover?: (info: MapTooltipInfo | null) => void
) {
  return new H3HexagonLayer<H3CellDensity>({
    id: LAYER_IDS.h3Corridor,
    visible,
    data: cells,
    getHexagon: (d) => d.h3Index,
    filled: true,
    stroked: true,
    getFillColor: (d) => getDensityColor(d.density, 0.75),
    getLineColor: (d) => {
      const [r, g, b] = getDensityColor(d.density);
      return [r, g, b, 240];
    },
    getLineWidth: 1.5,
    lineWidthUnits: "pixels",
    pickable: true,
    updateTriggers: {
      getFillColor: [cells, relativeHour],
      getLineColor: [cells, relativeHour],
    },
    onHover: (info) => {
      if (!onHover) return;
      if (!info.object) {
        onHover(null);
        return;
      }
      const c = info.object as H3CellDensity;
      onHover({
        x: info.x,
        y: info.y,
        type: "h3cell",
        title: `H3 Hex Cell (${c.h3Index.substring(0, 10)}...)`,
        items: [
          { label: "Corridor Time", value: `${relativeHour}h from detection` },
          { label: "Particle Density", value: `${(c.density * 100).toFixed(0)}%` },
          { label: "Particle Count", value: c.particleCount },
          { label: "Risk Category", value: c.riskLevel.toUpperCase() },
        ],
      });
    },
  });
}
