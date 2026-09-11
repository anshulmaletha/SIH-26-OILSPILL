/**
 * ShipIcon — Realistic naval ship hull vessel markers for MapLibre / Deck.gl IconLayer.
 *
 * Generates crisp top-down ship hull silhouettes with pointed bow, flared beam,
 * stern transom, bridge superstructure, and centerline keel.
 *
 * Deck.gl IconLayer's `getAngle` rotates each ship to its actual heading (0° = North).
 * Size: 64×64 px per icon cell in a 256×128 master SVG atlas.
 */

const ATLAS_CELL = 64; // px per icon cell

/**
 * Master multi-icon atlas containing distinct top-down ship hull silhouettes:
 * Row 0:
 * - ship-tanker (Crude Oil Tanker - Cyan #22D3EE)
 * - ship-bulk (Bulk Carrier - Sky Blue #38BDF8)
 * - ship-container (Container Ship - Teal #14B8A6)
 * - ship-other (Other / Support - Slate #94A3B8)
 * Row 1:
 * - ship-red (Dark / Suspicious Vessel - Alert Red #EF4444)
 * - ship-amber (Suspect Candidate - Warning Amber #F59E0B)
 * - ship-cyan (General Cyan Vessel)
 * - ship-teal (General Teal Traffic)
 */
export function getMasterShipAtlasDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128" viewBox="0 0 256 128">
    <!-- (0,0): Crude Tanker (Cyan) -->
    <g transform="translate(32,32)">
      <path
        d="M 0,-24 C 6,-19 12,-6 11,8 L 8,19 L -8,19 L -11,8 C -12,-6 -6,-19 0,-24 Z"
        fill="#22D3EE"
        stroke="#E2E8F0"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <rect x="-5" y="2" width="10" height="10" rx="1" fill="#0D1117" stroke="#22D3EE" stroke-width="0.8" />
      <circle cx="0" cy="7" r="1.2" fill="#22D3EE" />
      <line x1="0" y1="-20" x2="0" y2="-2" stroke="#0D1117" stroke-width="1.2" stroke-linecap="round" />
      <line x1="-5" y1="-8" x2="5" y2="-8" stroke="#0D1117" stroke-width="0.8" />
    </g>

    <!-- (64,0): Bulk Carrier (Sky Blue) -->
    <g transform="translate(96,32)">
      <path
        d="M 0,-23 C 8,-17 13,-4 12,9 L 9,19 L -9,19 L -12,9 C -13,-4 -8,-17 0,-23 Z"
        fill="#38BDF8"
        stroke="#E0F2FE"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <rect x="-6" y="3" width="12" height="9" rx="1" fill="#0D1117" stroke="#38BDF8" stroke-width="0.8" />
      <rect x="-4" y="-12" width="8" height="6" rx="0.5" fill="#0D1117" opacity="0.85" />
      <rect x="-4" y="-4" width="8" height="5" rx="0.5" fill="#0D1117" opacity="0.85" />
    </g>

    <!-- (128,0): Container Ship (Teal) -->
    <g transform="translate(160,32)">
      <path
        d="M 0,-25 C 5,-20 10,-8 9,8 L 7,20 L -7,20 L -9,8 C -10,-8 -5,-20 0,-25 Z"
        fill="#14B8A6"
        stroke="#CCFBF1"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <rect x="-5" y="4" width="10" height="9" rx="1" fill="#0D1117" stroke="#14B8A6" stroke-width="0.8" />
      <line x1="0" y1="-21" x2="0" y2="0" stroke="#0D1117" stroke-width="1.2" stroke-linecap="round" />
      <rect x="-4" y="-14" width="8" height="4" fill="#0D1117" opacity="0.8" />
      <rect x="-4" y="-8" width="8" height="4" fill="#0D1117" opacity="0.8" />
      <rect x="-4" y="-2" width="8" height="4" fill="#0D1117" opacity="0.8" />
    </g>

    <!-- (192,0): Other / Support / Tug (Slate) -->
    <g transform="translate(224,32)">
      <path
        d="M 0,-20 C 6,-15 9,-4 8,8 L 7,16 L -7,16 L -8,8 C -9,-4 -6,-15 0,-20 Z"
        fill="#94A3B8"
        stroke="#F1F5F9"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <rect x="-4" y="-2" width="8" height="9" rx="1" fill="#0D1117" stroke="#94A3B8" stroke-width="0.8" />
      <circle cx="0" cy="2" r="1.2" fill="#94A3B8" />
      <line x1="0" y1="-16" x2="0" y2="-5" stroke="#0D1117" stroke-width="1.2" stroke-linecap="round" />
    </g>

    <!-- (0,64): Dark / Suspicious Ship (Red) -->
    <g transform="translate(32,96)">
      <path
        d="M 0,-24 C 6,-19 12,-6 11,8 L 8,19 L -8,19 L -11,8 C -12,-6 -6,-19 0,-24 Z"
        fill="#EF4444"
        stroke="#FCA5A5"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <rect x="-5" y="2" width="10" height="10" rx="1" fill="#0D1117" stroke="#EF4444" stroke-width="1.0" />
      <circle cx="0" cy="7" r="1.5" fill="#EF4444" />
      <line x1="0" y1="-20" x2="0" y2="-2" stroke="#0D1117" stroke-width="1.4" stroke-linecap="round" />
    </g>

    <!-- (64,64): Amber Candidate Ship -->
    <g transform="translate(96,96)">
      <path
        d="M 0,-24 C 6,-19 12,-6 11,8 L 8,19 L -8,19 L -11,8 C -12,-6 -6,-19 0,-24 Z"
        fill="#F59E0B"
        stroke="#FDE68A"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <rect x="-5" y="2" width="10" height="10" rx="1" fill="#0D1117" stroke="#F59E0B" stroke-width="0.8" />
      <circle cx="0" cy="7" r="1.2" fill="#F59E0B" />
      <line x1="0" y1="-20" x2="0" y2="-2" stroke="#0D1117" stroke-width="1.2" stroke-linecap="round" />
    </g>

    <!-- (128,64): Cyan Default Ship -->
    <g transform="translate(160,96)">
      <path
        d="M 0,-24 C 6,-19 12,-6 11,8 L 8,19 L -8,19 L -11,8 C -12,-6 -6,-19 0,-24 Z"
        fill="#22D3EE"
        stroke="#E2E8F0"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <rect x="-5" y="2" width="10" height="10" rx="1" fill="#0D1117" stroke="#22D3EE" stroke-width="0.8" />
      <circle cx="0" cy="7" r="1.2" fill="#22D3EE" />
      <line x1="0" y1="-20" x2="0" y2="-2" stroke="#0D1117" stroke-width="1.2" stroke-linecap="round" />
    </g>

    <!-- (192,64): Teal Default Ship -->
    <g transform="translate(224,96)">
      <path
        d="M 0,-25 C 5,-20 10,-8 9,8 L 7,20 L -7,20 L -9,8 C -10,-8 -5,-20 0,-25 Z"
        fill="#14B8A6"
        stroke="#CCFBF1"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      <rect x="-5" y="4" width="10" height="9" rx="1" fill="#0D1117" stroke="#14B8A6" stroke-width="0.8" />
      <line x1="0" y1="-21" x2="0" y2="0" stroke="#0D1117" stroke-width="1.2" stroke-linecap="round" />
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Returns master atlas data URI (backward-compatible).
 */
export function getShipIconDataUri(color = "22D3EE"): string {
  return getMasterShipAtlasDataUri();
}

/**
 * Generates the suspect vessel halo icon data URI.
 * Subtle dashed ring around suspect vessel inside the matched hex.
 */
export function getSuspectHaloDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS_CELL}" height="${ATLAS_CELL}" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="22" fill="none" stroke="#22D3EE" stroke-width="1.2" stroke-opacity="0.65" stroke-dasharray="3 3" />
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SHIP_ICON_MAPPING = {
  "ship-tanker": {
    x: 0,
    y: 0,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
  "ship-bulk": {
    x: ATLAS_CELL,
    y: 0,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
  "ship-container": {
    x: ATLAS_CELL * 2,
    y: 0,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
  "ship-other": {
    x: ATLAS_CELL * 3,
    y: 0,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
  "ship-red": {
    x: 0,
    y: ATLAS_CELL,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
  "ship-amber": {
    x: ATLAS_CELL,
    y: ATLAS_CELL,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
  "ship-cyan": {
    x: ATLAS_CELL * 2,
    y: ATLAS_CELL,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
  "ship-teal": {
    x: ATLAS_CELL * 3,
    y: ATLAS_CELL,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
  // Default aliases
  ship: {
    x: 0,
    y: 0,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
};

export const HALO_ICON_MAPPING = {
  halo: {
    x: 0,
    y: 0,
    width: ATLAS_CELL,
    height: ATLAS_CELL,
    anchorX: ATLAS_CELL / 2,
    anchorY: ATLAS_CELL / 2,
    mask: false,
  },
};

export const SHIP_ICON_SIZE = 22; // default rendered pixels on map

