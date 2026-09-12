/**
 * Browser-safe map configuration.
 * No maplibre/deck.gl imports here — this module is imported by SSR routes.
 *
 * Palette: single cyan accent (#22D3EE) for all data/UI.
 * Amber ONLY for caution states. Red ONLY for dark vessel alert.
 * No pink / magenta / orange anywhere.
 */

export const BASEMAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const;

export type ThemeMode = "dark" | "light";

export const MAP_STYLE_URL =
  (import.meta.env["VITE_MAP_STYLE_URL"] as string | undefined) ??
  BASEMAP_STYLES.light;

/** Initial camera: Flat top-down nautical chart view — still, fixed at AOI center. */
export const INITIAL_VIEW_STATE = {
  longitude: 72.15,
  latitude: 19.15,
  zoom: 8.2,
  pitch: 0,
  bearing: 0,
} as const;

export const LAYER_IDS = {
  sarRaster: "sar-raster",
  slickPolygon: "slick-polygon",
  h3Corridor: "h3-corridor",
  aisTracks: "ais-tracks",
} as const;

export type LayerId = (typeof LAYER_IDS)[keyof typeof LAYER_IDS];

export interface LayerMeta {
  id: LayerId;
  label: string;
  description: string;
  /** Swatch color (hex) used in legend and panel. */
  color: string;
}

export const LAYER_META: LayerMeta[] = [
  {
    id: LAYER_IDS.sarRaster,
    label: "SAR Raster",
    description: "Sentinel-1A backscatter scene (P1)",
    color: "#64748B",   // neutral slate
  },
  {
    id: LAYER_IDS.slickPolygon,
    label: "Slick Polygon",
    description: "Detected oil slick extent (P1)",
    color: "#0F172A",   // crisp high-contrast black/charcoal
  },
  {
    id: LAYER_IDS.h3Corridor,
    label: "H3 Corridor",
    description: "Particle-density hex corridor (P4)",
    color: "#475569",   // dark slate
  },
  {
    id: LAYER_IDS.aisTracks,
    label: "AIS Tracks",
    description: "Vessel tracks & positions (P5)",
    color: "#0F172A",   // crisp black/charcoal
  },
];

export const DEFAULT_VISIBILITY: Record<LayerId, boolean> = {
  [LAYER_IDS.sarRaster]: true,
  [LAYER_IDS.slickPolygon]: true,
  [LAYER_IDS.h3Corridor]: false,
  [LAYER_IDS.aisTracks]: true,
};

export interface TrackColorOption {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

/**
 * Minimal monochrome / high-contrast color palette.
 */
export const TRACK_COLOR_OPTIONS: TrackColorOption[] = [
  { id: "black",     name: "Black",      hex: "#0F172A", rgb: [15, 23, 42] },
  { id: "charcoal",  name: "Charcoal",   hex: "#334155", rgb: [51, 65, 85] },
  { id: "slate",     name: "Slate",      hex: "#64748B", rgb: [100, 116, 139] },
  { id: "gray",      name: "Muted Gray", hex: "#94A3B8", rgb: [148, 163, 184] },
];
