/**
 * ShipIcon — directional chevron arrow vessel marker for Deck.gl IconLayer.
 *
 * Generates a crisp monochrome cyan chevron arrow pointing "up" (north = 0°).
 * Deck.gl IconLayer's `getAngle` is used to rotate to actual heading.
 *
 * Style: clean, directional chevron with light edge border and dark center line.
 * Size: 64×64 px atlas, rendered at 26–32px.
 */

const ATLAS_SIZE = 64; // px per icon in the atlas texture

/**
 * Generates the directional chevron SVG as a data URI.
 * @param color hex color string (without #) — defaults to 22D3EE (cyan)
 */
export function getShipIconDataUri(color = "22D3EE"): string {
  // Precision directional chevron arrow: tip points North (y-), wings sweep back
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS_SIZE}" height="${ATLAS_SIZE}" viewBox="0 0 64 64">
    <g transform="translate(32,32)">
      <!-- Directional chevron arrow -->
      <path
        d="M 0,-22 L 15,16 L 0,8 L -15,16 Z"
        fill="#${color}"
        fill-opacity="1"
        stroke="#E2E8F0"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <!-- Dark center spine / navigation keel -->
      <line x1="0" y1="-14" x2="0" y2="7" stroke="#0A0E14" stroke-width="1.5" stroke-linecap="round" />
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Generates the suspect vessel halo icon data URI.
 * Subtle dashed ring around suspect vessel inside the matched hex.
 */
export function getSuspectHaloDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS_SIZE}" height="${ATLAS_SIZE}" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="22" fill="none" stroke="#22D3EE" stroke-width="1.2" stroke-opacity="0.65" stroke-dasharray="3 3" />
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SHIP_ICON_MAPPING = {
  ship: {
    x: 0, y: 0,
    width: ATLAS_SIZE, height: ATLAS_SIZE,
    anchorX: ATLAS_SIZE / 2, anchorY: ATLAS_SIZE / 2,
    mask: false,
  },
};

export const HALO_ICON_MAPPING = {
  halo: {
    x: 0, y: 0,
    width: ATLAS_SIZE, height: ATLAS_SIZE,
    anchorX: ATLAS_SIZE / 2, anchorY: ATLAS_SIZE / 2,
    mask: false,
  },
};

export const SHIP_ICON_SIZE = 26; // pixels rendered on map

