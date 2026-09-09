import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { LAYER_IDS } from "../config";
import type { H3CellDensity } from "../../contracts/p4";
import { getDensityColor } from "../../adapters/p4Adapter";
import type { MapTooltipInfo } from "../types";

// Crisp light cyan/white line color for all hex borders — 1px always visible
const HEX_LINE_COLOR: [number, number, number, number] = [180, 240, 255, 190];

// Confirmed-match hex border — bright white-cyan, thicker 2.5px
const MATCH_LINE_COLOR: [number, number, number, number] = [240, 253, 255, 255];

/**
 * The hex index of the primary AIS-matched cell, used to render a
 * distinct bright/thick border on confirmed match cells.
 * From case_file_output.json → primary suspect corridor intersection.
 */
const MATCH_HEX_INDEX = "8742da54effffff";

export function createH3CorridorLayer(
  cells: H3CellDensity[],
  visible: boolean,
  relativeHour: number,
  onHover?: ((info: MapTooltipInfo | null) => void) | undefined,
  onClickHex?: ((cell: H3CellDensity, coordinate: [number, number], x: number, y: number) => void) | undefined
) {
  return new H3HexagonLayer<H3CellDensity>({
    id: LAYER_IDS.h3Corridor,
    visible,
    data: cells,
    getHexagon: (d) => d.h3Index,

    // Always filled — discrete opacity per density band (no blur, no blend)
    filled: true,
    getFillColor: (d) => getDensityColor(d.density, 1.0),

    // Always stroked — crisp 1px light cyan/white border on every hex
    stroked: true,
    getLineColor: (d) =>
      d.h3Index === MATCH_HEX_INDEX ? MATCH_LINE_COLOR : HEX_LINE_COLOR,
    getLineWidth: (d) =>
      d.h3Index === MATCH_HEX_INDEX ? 2.5 : 1,
    lineWidthMinPixels: 1,
    lineWidthUnits: "pixels",

    pickable: true,

    // Triggers re-evaluation when hour or cells change
    updateTriggers: {
      getFillColor: [cells, relativeHour],
      getLineColor: [cells, relativeHour],
      getLineWidth: [cells],
    },

    onClick: (info) => {
      if (info.object && onClickHex) {
        const c = info.object as H3CellDensity;
        const coord: [number, number] =
          info.coordinate &&
          typeof info.coordinate[0] === "number" &&
          typeof info.coordinate[1] === "number"
            ? [info.coordinate[0], info.coordinate[1]]
            : c.centerCoordinates;
        onClickHex(c, coord, info.x, info.y);
      }
    },

    onHover: (info) => {
      if (!onHover) return;
      if (!info.object) {
        onHover(null);
        return;
      }
      const c = info.object as H3CellDensity;

      // Map density to discrete band label
      const bandLabel =
        c.density > 0.75 ? "Peak (>75%)" :
        c.density > 0.50 ? "High (50–75%)" :
        c.density > 0.25 ? "Medium (25–50%)" :
        "Low (<25%)";

      onHover({
        x: info.x,
        y: info.y,
        type: "h3cell",
        title: c.h3Index,      // Full hex ID — monospace in tooltip
        items: [
          { label: "Timestep", value: `${relativeHour}h from detection` },
          { label: "Particle Count", value: String(c.particleCount) },
          { label: "Density Band", value: bandLabel },
          { label: "k-Ring", value: c.h3Index === MATCH_HEX_INDEX ? "k=0 (MATCH)" : "corridor" },
        ],
      });
    },
  });
}
