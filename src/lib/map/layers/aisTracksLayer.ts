import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";

import { LAYER_IDS } from "../config";
import { AIS_TRACKS } from "../data/sampleData";
import type { AisTrack, LngLat } from "../types";

const TRACK_COLORS: [number, number, number][] = [
  [74, 222, 128],
  [96, 165, 250],
  [244, 114, 182],
];

/** Placeholder AIS vessel tracks: path lines + position pings. */
export function createAisTrackLayers(visible: boolean) {
  const tracks = new PathLayer<AisTrack>({
    id: LAYER_IDS.aisTracks,
    visible,
    data: AIS_TRACKS,
    getPath: (d) => d.path,
    getColor: (_d, { index }) =>
      TRACK_COLORS[index % TRACK_COLORS.length] ?? [74, 222, 128],
    getWidth: 2.5,
    widthUnits: "pixels",
    pickable: true,
  });

  const pings = new ScatterplotLayer<{ position: LngLat; vesselName: string }>({
    id: `${LAYER_IDS.aisTracks}-pings`,
    visible,
    data: AIS_TRACKS.flatMap((t) =>
      t.path.map((position) => ({ position, vesselName: t.vesselName })),
    ),
    getPosition: (d) => d.position,
    getRadius: 60,
    radiusUnits: "meters",
    getFillColor: [255, 255, 255, 220],
    getLineColor: [74, 222, 128, 255],
    lineWidthMinPixels: 1,
    stroked: true,
    pickable: true,
  });

  return [tracks, pings];
}
