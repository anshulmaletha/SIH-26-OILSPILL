import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { PathLayer } from "@deck.gl/layers";
import { LAYER_IDS } from "../config";
import type { H3CellDensityWithAge, H3CellDensity } from "../../adapters/p4Adapter";
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
  cells: H3CellDensityWithAge[],
  visible: boolean,
  relativeHour: number,
  missionStage?: string,
  onHover?: ((info: MapTooltipInfo | null) => void) | undefined,
  onClickHex?: ((cell: H3CellDensity, coordinate: [number, number], x: number, y: number) => void) | undefined
) {
  // In Kerala scenario, AIS_SWARM is the drift modeling stage where it animates backwards
  const isModeling = missionStage === "AIS_SWARM" || missionStage === "DRIFT_MODELING";

  // Compute centroid of each timestep to draw connection paths
  // Group by timestepHour
  const timestepGroups = new Map<number, { lat: number, lng: number, count: number, ageRatio: number }>();
  for (const cell of cells) {
    if (!timestepGroups.has(cell.timestepHour)) {
      timestepGroups.set(cell.timestepHour, { lat: 0, lng: 0, count: 0, ageRatio: cell.ageRatio });
    }
    const group = timestepGroups.get(cell.timestepHour)!;
    // Weight by density/particleCount for a more accurate center of mass
    const weight = cell.particleCount || 1;
    group.lng += cell.centerCoordinates[0] * weight;
    group.lat += cell.centerCoordinates[1] * weight;
    group.count += weight;
  }
  
  const pathCoords: [number, number][] = [];
  // Sort by timestepHour descending (from newest to oldest: 0, -6, -12, etc)
  const sortedHours = Array.from(timestepGroups.keys()).sort((a, b) => b - a);
  for (const hour of sortedHours) {
    const group = timestepGroups.get(hour)!;
    pathCoords.push([group.lng / group.count, group.lat / group.count]);
  }

  const h3Layer = new H3HexagonLayer<H3CellDensityWithAge>({
    id: LAYER_IDS.h3Corridor,
    visible,
    data: cells,
    getHexagon: (d) => d.h3Index.split('_')[0], // Extract raw h3Index

    // Always filled — discrete opacity per density band (no blur, no blend)
    filled: true,
    getFillColor: (d) => getDensityColor(d.density, 1.0, d.ageRatio),

    // Always stroked — crisp 1px light cyan/white border on every hex
    // Highlight state: during DRIFT_MODELING, all hexes get a brighter, slightly thicker cyan border
    stroked: true,
    getLineColor: (d) => {
      const rawHex = d.h3Index.split('_')[0];
      if (rawHex === MATCH_HEX_INDEX) return MATCH_LINE_COLOR;
      if (isModeling) return [34, 211, 238, 255]; // Bright cyan during modeling
      // Blend line color to purple for older steps too
      return [
        HEX_LINE_COLOR[0] * (1 - d.ageRatio) + 139 * d.ageRatio,
        HEX_LINE_COLOR[1] * (1 - d.ageRatio) + 92 * d.ageRatio,
        HEX_LINE_COLOR[2] * (1 - d.ageRatio) + 246 * d.ageRatio,
        HEX_LINE_COLOR[3]
      ];
    },
    getLineWidth: (d) => {
      const rawHex = d.h3Index.split('_')[0];
      if (rawHex === MATCH_HEX_INDEX) return 2.5;
      return isModeling ? 1.5 : 1;
    },
    lineWidthMinPixels: 1,
    lineWidthUnits: "pixels",

    pickable: true,

    // Triggers re-evaluation when hour or cells change
    updateTriggers: {
      getFillColor: [cells, relativeHour],
      getLineColor: [cells, relativeHour, missionStage],
      getLineWidth: [cells, missionStage],
    },

    onClick: (info) => {
      if (info.object && onClickHex) {
        const c = info.object as H3CellDensity;
        const coord: [number, number] =
          info.coordinate &&
          typeof info.coordinate[0] === "number" &&
          typeof info.coordinate[1] === "number"
            ? (info.coordinate as [number, number])
            : [0, 0];
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

  // To avoid require issues in frontend, I will just make it a solid thick line with lower opacity
  const pathLayer = new PathLayer({
    id: `${LAYER_IDS.h3Corridor}-path`,
    visible,
    data: pathCoords.length > 1 ? [{ path: pathCoords }] : [],
    getPath: (d: any) => d.path,
    getColor: [167, 139, 250, 180], // Soft purple/magenta trail matching the oldest hex color
    getWidth: 2.5,
    widthMinPixels: 2.5,
    widthUnits: "pixels",
  });

  return [h3Layer, pathLayer];
}
