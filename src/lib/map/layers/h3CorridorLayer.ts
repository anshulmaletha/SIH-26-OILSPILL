import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { LAYER_IDS } from "../config";
import type { H3CellDensity } from "../../contracts/p4";
import { getDensityColor } from "../../adapters/p4Adapter";
import type { MapTooltipInfo } from "../types";

/**
 * Key forensic correlation hexagons:
 * - MATCH_HEX_INDEX: observation head / slick match
 * - SUSPECT_HEX_INDEX_1 & 2: suspect corridor intersection & speed-drop point
 */
const MATCH_HEX_INDEX = "8742da54effffff";
const SUSPECT_HEX_INDEX_1 = "8742dacd1ffffff";
const SUSPECT_HEX_INDEX_2 = "8760d2481ffffff";

export function createH3CorridorLayer(
  cells: H3CellDensity[],
  visible: boolean,
  relativeHour: number,
  theme: "light" | "dark" = "light",
  isBacktracking: boolean = false,
  onHover?: ((info: MapTooltipInfo | null) => void) | undefined,
  onClickHex?: ((cell: H3CellDensity, coordinate: [number, number], x: number, y: number) => void) | undefined
) {
  const isDark = theme === "dark";

  return new H3HexagonLayer<H3CellDensity>({
    id: LAYER_IDS.h3Corridor,
    visible,
    data: cells,
    getHexagon: (d) => d.h3Index,

    // Always filled with theme-adapted high-contrast colors
    filled: true,
    getFillColor: (d) => {
      const isMatch =
        d.h3Index === MATCH_HEX_INDEX ||
        d.h3Index === SUSPECT_HEX_INDEX_1 ||
        d.h3Index === SUSPECT_HEX_INDEX_2 ||
        !!d.isMatch;
      const isWave = !!d.isWavefront;
      const isActive = d.isActive !== false;

      if (isDark) {
        if (isWave) return [103, 232, 249, 255]; // brilliant luminous cyan wave
        if (isMatch) return [255, 255, 255, 240]; // pure white correlation beacon
        if (!isActive) return [34, 211, 238, 45]; // visible anticipated path
        return getDensityColor(d.density, 1.0, "dark");
      }

      // LIGHT MODE (High contrast against Carto Positron basemap)
      if (isWave) return [8, 145, 178, 255]; // saturated dark cyan wave
      if (isMatch) return [15, 23, 42, 240]; // charcoal match highlight
      if (!isActive) return [224, 242, 254, 120]; // clear light azure wash
      return getDensityColor(d.density, 1.0, "light");
    },

    // Always stroked with crisp, distinct hexagon borders
    stroked: true,
    getLineColor: (d) => {
      const isMatch =
        d.h3Index === MATCH_HEX_INDEX ||
        d.h3Index === SUSPECT_HEX_INDEX_1 ||
        d.h3Index === SUSPECT_HEX_INDEX_2 ||
        !!d.isMatch;
      const isWave = !!d.isWavefront;

      if (isDark) {
        if (isMatch) return [255, 255, 255, 255];
        if (isWave) return [207, 250, 254, 255];
        return [103, 232, 249, 185]; // neon cyan border
      }

      // Light mode: high-contrast dark oceanic borders so hexes pop with crisp clarity
      if (isMatch) return [15, 23, 42, 255];
      if (isWave) return [15, 23, 42, 255];
      return [15, 23, 42, 175]; // crisp dark slate 1.5px outline
    },

    getLineWidth: (d) => {
      const isMatch =
        d.h3Index === MATCH_HEX_INDEX ||
        d.h3Index === SUSPECT_HEX_INDEX_1 ||
        d.h3Index === SUSPECT_HEX_INDEX_2 ||
        !!d.isMatch;
      if (isMatch || d.isWavefront) return 3.0;
      return d.ringK === 0 ? 1.8 : 1.2;
    },
    lineWidthMinPixels: 1.2,
    lineWidthUnits: "pixels",

    pickable: true,

    // Triggers re-evaluation when hour, cells, theme, or backtracking state changes
    updateTriggers: {
      getFillColor: [cells, relativeHour, theme, isBacktracking],
      getLineColor: [cells, relativeHour, theme, isBacktracking],
      getLineWidth: [cells, relativeHour, isBacktracking],
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

      const bandLabel =
        c.density > 0.75 ? "Peak (>75%)" :
        c.density > 0.50 ? "High (50–75%)" :
        c.density > 0.25 ? "Medium (25–50%)" :
        "Low (<25%)";

      const timeLabel =
        c.hour !== undefined
          ? `T${c.hour <= 0 ? c.hour.toFixed(0) : "+" + c.hour.toFixed(0)}h (${Math.abs(c.hour)}h backtrack)`
          : `${relativeHour}h from detection`;

      onHover({
        x: info.x,
        y: info.y,
        type: "h3cell",
        title: c.h3Index,
        items: [
          { label: "Corridor Sector", value: c.sectorName || "Offshore Drift Ribbon" },
          { label: "Timestep", value: timeLabel },
          { label: "Particle Count", value: `${c.particleCount} particles` },
          { label: "Density Band", value: bandLabel },
          {
            label: "Correlation",
            value:
              c.h3Index === MATCH_HEX_INDEX
                ? "SLICK HEAD MATCH (k=0)"
                : c.h3Index === SUSPECT_HEX_INDEX_1 || c.h3Index === SUSPECT_HEX_INDEX_2
                  ? "SUSPECT AIS INTERSECT"
                  : c.ringK === 0
                    ? "Corridor Spine (k=0)"
                    : "Dispersion Flank (k=1)",
          },
        ],
      });
    },
  });
}
