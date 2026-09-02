import { BitmapLayer } from "@deck.gl/layers";
import { LAYER_IDS } from "../config";
import type { SarRasterData } from "../../contracts/p1";

function makeSarTexture(meanDb: number = -18): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const image = ctx.createImageData(size, size);

  // High-fidelity speckle simulation
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const baseVal = Math.max(30, Math.min(180, Math.round(140 + meanDb * 3)));

  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);

    // Synthetic sea clutter texture
    const wave = Math.sin(x / 14) * Math.cos(y / 18) * 25 + Math.sin((x + y) / 10) * 15;
    const speckle = (rand() - 0.5) * 55;
    const v = Math.max(0, Math.min(255, baseVal + wave + speckle));

    const idx = i * 4;
    image.data[idx + 0] = Math.round(v * 0.85); // R
    image.data[idx + 1] = Math.round(v * 0.95); // G (slight greenish radar tint)
    image.data[idx + 2] = Math.round(v * 1.05); // B
    image.data[idx + 3] = 200;                  // Alpha
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function createSarRasterLayer(
  sarData: SarRasterData | undefined,
  visible: boolean,
  opacity: number = 0.5
) {
  if (!sarData) return null;

  const [minLng, minLat, maxLng, maxLat] = sarData.bounds;

  return new BitmapLayer({
    id: LAYER_IDS.sarRaster,
    visible,
    image: sarData.imageUrl || makeSarTexture(sarData.meanBackscatterDb),
    bounds: [
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
    ],
    opacity,
    pickable: false,
  });
}
