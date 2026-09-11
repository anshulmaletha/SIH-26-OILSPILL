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

  // Darker, desaturated slate radar texture for high-contrast backdrop
  const baseVal = Math.max(15, Math.min(100, Math.round(75 + meanDb * 2)));

  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);

    // Synthetic sea clutter texture
    const wave = Math.sin(x / 14) * Math.cos(y / 18) * 20 + Math.sin((x + y) / 10) * 12;
    const speckle = (rand() - 0.5) * 45;
    const v = Math.max(0, Math.min(255, baseVal + wave + speckle));

    const idx = i * 4;
    image.data[idx + 0] = Math.round(v * 0.45); // R: deep slate
    image.data[idx + 1] = Math.round(v * 0.52); // G: desaturated radar slate
    image.data[idx + 2] = Math.round(v * 0.62); // B: moody navy-slate
    image.data[idx + 3] = 170;                  // Subtle alpha
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
