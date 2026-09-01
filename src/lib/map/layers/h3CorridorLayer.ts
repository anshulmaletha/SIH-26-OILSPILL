import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { gridDisk, latLngToCell } from "h3-js";

import { LAYER_IDS } from "../config";
import { CORRIDOR_WAYPOINTS, H3_CORRIDOR_RESOLUTION } from "../data/sampleData";

/** Placeholder H3 corridor: hexes surrounding the corridor waypoints. */
export function createH3CorridorLayer(visible: boolean) {
  const cells = new Set<string>();
  for (const [lng, lat] of CORRIDOR_WAYPOINTS) {
    const center = latLngToCell(lat, lng, H3_CORRIDOR_RESOLUTION);
    for (const cell of gridDisk(center, 1)) cells.add(cell);
  }

  return new H3HexagonLayer({
    id: LAYER_IDS.h3Corridor,
    visible,
    data: [...cells].map((hex) => ({ hex })),
    getHexagon: (d: { hex: string }) => d.hex,
    filled: true,
    stroked: true,
    getFillColor: [34, 211, 238, 60],
    getLineColor: [34, 211, 238, 200],
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    pickable: true,
  });
}
