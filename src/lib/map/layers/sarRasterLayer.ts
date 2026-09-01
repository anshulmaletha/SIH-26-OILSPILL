import { BitmapLayer } from "@deck.gl/layers";

import { LAYER_IDS } from "../config";
import { SAR_RASTER_PATCH } from "../data/sampleData";

/**
 * Placeholder SAR raster.
 * Generates a small grayscale "backscatter-like" image on a canvas at
 * call time (client-only — this module is only reachable from the
 * lazy-loaded map view) and draws it into fixed geographic bounds.
 */
function makeSarImage(): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  // Deterministic pseudo-noise so the render is stable across reloads.
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    const wave = Math.sin(x / 9) * Math.cos(y / 11) * 60;
    const v = Math.max(0, Math.min(255, 110 + wave + (rand() - 0.5) * 70));
    image.data[i * 4 + 0] = v;
    image.data[i * 4 + 1] = v;
    image.data[i * 4 + 2] = v + 10;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function createSarRasterLayer(visible: boolean) {
  const [minLng, minLat, maxLng, maxLat] = SAR_RASTER_PATCH.bounds;
  return new BitmapLayer({
    id: LAYER_IDS.sarRaster,
    visible,
    image: makeSarImage(),
    bounds: [
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
    ],
    opacity: 0.55,
    pickable: false,
  });
}
