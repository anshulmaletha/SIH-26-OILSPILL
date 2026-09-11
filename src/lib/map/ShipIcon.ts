/**
 * ShipIcon — High-Contrast Naval Ship Vessel Markers for MapLibre / Deck.gl IconLayer.
 *
 * Generates crisp, clearly visible top-down ship hull silhouettes:
 * - Pointed razor bow at front
 * - Flared wide cargo hull in the middle
 * - Blunt/flat stern transom at back
 * - Elevated navigation bridge superstructure & wheelhouse
 * - Centerline keel and deck cargo hatches
 * - High-contrast contrasting outline ensuring immediate visibility on dark maps
 *
 * Deck.gl IconLayer's `getAngle` rotates each ship to its actual heading (0° = North).
 * Master atlas dimensions: 512×256 px (128×128 px per cell).
 */

const ATLAS_CELL = 128; // px per icon cell in 512x256 atlas

/**
 * Master multi-icon atlas containing distinct top-down ship hull silhouettes:
 * Row 0:
 * - ship-tanker (Crude Oil Tanker - Vibrant Electric Cyan #22D3EE)
 * - ship-bulk (Bulk Carrier - Sky Blue #38BDF8)
 * - ship-container (Container Ship - Bright Teal #14B8A6)
 * - ship-other (Other / Support / Tug - Slate Blue #94A3B8)
 * Row 1:
 * - ship-red (Dark / Suspicious Vessel - Alert Red #EF4444)
 * - ship-amber (Suspect Candidate - Warning Amber #F59E0B)
 * - ship-cyan (General Cyan Vessel)
 * - ship-teal (General Teal Traffic)
 */
export function getMasterShipAtlasDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256" viewBox="0 0 512 256">
    <defs>
      <!-- Drop shadow filter for maximum vessel pop against dark water -->
      <filter id="ship-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.95" />
      </filter>
    </defs>

    <!-- (0,0): Crude Oil Tanker (Electric Cyan #22D3EE) -->
    <g transform="translate(64,64)" filter="url(#ship-shadow)">
      <!-- Outer Hull Silhouette -->
      <path
        d="M 0,-52 C 14,-42 24,-12 23,24 L 18,48 L -18,48 L -23,24 C -24,-12 -14,-42 0,-52 Z"
        fill="#22D3EE"
        stroke="#FFFFFF"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <!-- Dark Inset Deck -->
      <path
        d="M 0,-44 C 10,-35 17,-10 16,22 L 13,42 L -13,42 L -16,22 C -17,-10 -10,-35 0,-44 Z"
        fill="#09131D"
        stroke="#22D3EE"
        stroke-width="1.2"
      />
      <!-- Forward Keel Line -->
      <line x1="0" y1="-40" x2="0" y2="8" stroke="#22D3EE" stroke-width="2.2" stroke-linecap="round" />
      <!-- Cargo Oil Manifolds / Tank Hatches -->
      <rect x="-8" y="-24" width="16" height="6" rx="1.5" fill="#22D3EE" opacity="0.85" />
      <rect x="-8" y="-12" width="16" height="6" rx="1.5" fill="#22D3EE" opacity="0.85" />
      <rect x="-8" y="0" width="16" height="6" rx="1.5" fill="#22D3EE" opacity="0.85" />
      <!-- Aft Bridge Superstructure -->
      <rect x="-10" y="18" width="20" height="18" rx="2.5" fill="#22D3EE" stroke="#FFFFFF" stroke-width="1.2" />
      <!-- Wheelhouse Windows -->
      <rect x="-7" y="22" width="14" height="4" rx="1" fill="#09131D" />
      <!-- Navigation Radar Mast -->
      <circle cx="0" cy="30" r="2.2" fill="#FFFFFF" />
    </g>

    <!-- (128,0): Bulk Carrier (Sky Blue #38BDF8) -->
    <g transform="translate(192,64)" filter="url(#ship-shadow)">
      <!-- Broad Heavy Hull -->
      <path
        d="M 0,-50 C 18,-38 27,-8 25,26 L 19,48 L -19,48 L -25,26 C -27,-8 -18,-38 0,-50 Z"
        fill="#38BDF8"
        stroke="#FFFFFF"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <!-- Inset Deck -->
      <path
        d="M 0,-42 C 13,-32 20,-6 18,24 L 14,42 L -14,42 L -18,24 C -20,-6 -13,-32 0,-42 Z"
        fill="#09131D"
        stroke="#38BDF8"
        stroke-width="1.2"
      />
      <!-- Large Ore / Cargo Holds -->
      <rect x="-10" y="-28" width="20" height="9" rx="1.5" fill="#38BDF8" opacity="0.9" />
      <rect x="-10" y="-14" width="20" height="9" rx="1.5" fill="#38BDF8" opacity="0.9" />
      <rect x="-10" y="0" width="20" height="9" rx="1.5" fill="#38BDF8" opacity="0.9" />
      <!-- Aft Bridge Superstructure -->
      <rect x="-11" y="18" width="22" height="18" rx="2.5" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.2" />
      <rect x="-8" y="22" width="16" height="4" rx="1" fill="#09131D" />
      <circle cx="0" cy="30" r="2.2" fill="#FFFFFF" />
    </g>

    <!-- (256,0): Container Ship (Bright Teal #14B8A6) -->
    <g transform="translate(320,64)" filter="url(#ship-shadow)">
      <!-- Sleek Streamlined Fast Hull -->
      <path
        d="M 0,-54 C 12,-44 22,-14 21,24 L 16,48 L -16,48 L -21,24 C -22,-14 -12,-44 0,-54 Z"
        fill="#14B8A6"
        stroke="#FFFFFF"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <!-- Inset Deck -->
      <path
        d="M 0,-46 C 8,-36 15,-10 14,22 L 11,42 L -11,42 L -14,22 C -15,-10 -8,-36 0,-46 Z"
        fill="#09131D"
        stroke="#14B8A6"
        stroke-width="1.2"
      />
      <!-- Container Tier Bays -->
      <rect x="-9" y="-32" width="18" height="6" rx="1" fill="#14B8A6" opacity="0.9" />
      <rect x="-9" y="-23" width="18" height="6" rx="1" fill="#14B8A6" opacity="0.9" />
      <rect x="-9" y="-14" width="18" height="6" rx="1" fill="#14B8A6" opacity="0.9" />
      <rect x="-9" y="-5" width="18" height="6" rx="1" fill="#14B8A6" opacity="0.9" />
      <!-- Bridge Structure (Mid-Aft) -->
      <rect x="-9" y="16" width="18" height="18" rx="2" fill="#14B8A6" stroke="#FFFFFF" stroke-width="1.2" />
      <rect x="-6" y="20" width="12" height="4" rx="1" fill="#09131D" />
      <circle cx="0" cy="28" r="2.2" fill="#FFFFFF" />
    </g>

    <!-- (384,0): Other / Support / OSV (Slate Blue #94A3B8) -->
    <g transform="translate(448,64)" filter="url(#ship-shadow)">
      <!-- Compact Service Hull -->
      <path
        d="M 0,-46 C 14,-34 20,-8 18,22 L 15,44 L -15,44 L -18,22 C -20,-8 -14,-34 0,-46 Z"
        fill="#94A3B8"
        stroke="#FFFFFF"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <!-- Inset Deck -->
      <path
        d="M 0,-38 C 9,-28 14,-6 12,18 L 10,38 L -10,38 L -12,18 C -14,-6 -9,-28 0,-38 Z"
        fill="#09131D"
        stroke="#94A3B8"
        stroke-width="1.2"
      />
      <!-- Forward Wheelhouse (Tug/OSV Style) -->
      <rect x="-8" y="-18" width="16" height="18" rx="2" fill="#94A3B8" stroke="#FFFFFF" stroke-width="1.2" />
      <rect x="-5" y="-14" width="10" height="4" rx="1" fill="#09131D" />
      <circle cx="0" cy="-6" r="2" fill="#FFFFFF" />
      <!-- Open Aft Working Deck / Tow Winch -->
      <circle cx="0" cy="18" r="4.5" fill="#94A3B8" />
      <line x1="-7" y1="28" x2="7" y2="28" stroke="#94A3B8" stroke-width="2" />
    </g>

    <!-- (0,128): Dark / Suspicious Vessel (Alert Red #EF4444) -->
    <g transform="translate(64,192)" filter="url(#ship-shadow)">
      <!-- Warning Red Outer Hull -->
      <path
        d="M 0,-52 C 14,-42 24,-12 23,24 L 18,48 L -18,48 L -23,24 C -24,-12 -14,-42 0,-52 Z"
        fill="#EF4444"
        stroke="#FCA5A5"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <!-- Dark Red Deck -->
      <path
        d="M 0,-44 C 10,-35 17,-10 16,22 L 13,42 L -13,42 L -16,22 C -17,-10 -10,-35 0,-44 Z"
        fill="#1A0707"
        stroke="#EF4444"
        stroke-width="1.5"
      />
      <!-- Centerline & Alert Crossbars -->
      <line x1="0" y1="-40" x2="0" y2="8" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" />
      <line x1="-8" y1="-18" x2="8" y2="-18" stroke="#EF4444" stroke-width="2" />
      <line x1="-8" y1="-4" x2="8" y2="-4" stroke="#EF4444" stroke-width="2" />
      <!-- Aft Bridge Superstructure -->
      <rect x="-10" y="18" width="20" height="18" rx="2.5" fill="#EF4444" stroke="#FCA5A5" stroke-width="1.4" />
      <rect x="-7" y="22" width="14" height="4" rx="1" fill="#1A0707" />
      <circle cx="0" cy="30" r="2.5" fill="#FFFFFF" />
    </g>

    <!-- (128,128): Amber Candidate Ship (Warning Amber #F59E0B) -->
    <g transform="translate(192,192)" filter="url(#ship-shadow)">
      <path
        d="M 0,-52 C 14,-42 24,-12 23,24 L 18,48 L -18,48 L -23,24 C -24,-12 -14,-42 0,-52 Z"
        fill="#F59E0B"
        stroke="#FEF3C7"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <path
        d="M 0,-44 C 10,-35 17,-10 16,22 L 13,42 L -13,42 L -16,22 C -17,-10 -10,-35 0,-44 Z"
        fill="#140D04"
        stroke="#F59E0B"
        stroke-width="1.2"
      />
      <line x1="0" y1="-40" x2="0" y2="8" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" />
      <rect x="-8" y="-18" width="16" height="6" rx="1" fill="#F59E0B" opacity="0.85" />
      <rect x="-8" y="-4" width="16" height="6" rx="1" fill="#F59E0B" opacity="0.85" />
      <rect x="-10" y="18" width="20" height="18" rx="2.5" fill="#F59E0B" stroke="#FEF3C7" stroke-width="1.2" />
      <rect x="-7" y="22" width="14" height="4" rx="1" fill="#140D04" />
      <circle cx="0" cy="30" r="2.2" fill="#FFFFFF" />
    </g>

    <!-- (256,128): Cyan General Vessel -->
    <g transform="translate(320,192)" filter="url(#ship-shadow)">
      <path
        d="M 0,-52 C 14,-42 24,-12 23,24 L 18,48 L -18,48 L -23,24 C -24,-12 -14,-42 0,-52 Z"
        fill="#22D3EE"
        stroke="#FFFFFF"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <path
        d="M 0,-44 C 10,-35 17,-10 16,22 L 13,42 L -13,42 L -16,22 C -17,-10 -10,-35 0,-44 Z"
        fill="#09131D"
        stroke="#22D3EE"
        stroke-width="1.2"
      />
      <line x1="0" y1="-40" x2="0" y2="8" stroke="#22D3EE" stroke-width="2.2" stroke-linecap="round" />
      <rect x="-10" y="18" width="20" height="18" rx="2.5" fill="#22D3EE" stroke="#FFFFFF" stroke-width="1.2" />
      <circle cx="0" cy="30" r="2.2" fill="#FFFFFF" />
    </g>

    <!-- (384,128): Teal General Vessel -->
    <g transform="translate(448,192)" filter="url(#ship-shadow)">
      <path
        d="M 0,-52 C 14,-42 24,-12 23,24 L 18,48 L -18,48 L -23,24 C -24,-12 -14,-42 0,-52 Z"
        fill="#14B8A6"
        stroke="#CCFBF1"
        stroke-width="2.5"
        stroke-linejoin="round"
      />
      <path
        d="M 0,-44 C 10,-35 17,-10 16,22 L 13,42 L -13,42 L -16,22 C -17,-10 -10,-35 0,-44 Z"
        fill="#09131D"
        stroke="#14B8A6"
        stroke-width="1.2"
      />
      <line x1="0" y1="-40" x2="0" y2="8" stroke="#14B8A6" stroke-width="2.2" stroke-linecap="round" />
      <rect x="-10" y="18" width="20" height="18" rx="2.5" fill="#14B8A6" stroke="#CCFBF1" stroke-width="1.2" />
      <circle cx="0" cy="30" r="2.2" fill="#FFFFFF" />
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS_CELL}" height="${ATLAS_CELL}" viewBox="0 0 128 128">
    <circle cx="64" cy="64" r="48" fill="none" stroke="#22D3EE" stroke-width="2.5" stroke-opacity="0.75" stroke-dasharray="6 6" />
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

/** Default rendered pixels on map — large & crisp enough to immediately read as a ship */
export const SHIP_ICON_SIZE = 30;

