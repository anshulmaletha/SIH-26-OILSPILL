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
  BASEMAP_STYLES.dark;

/** Initial camera: Mumbai Offshore Corridor AOI — slick centroid 71.85°E, 19.35°N. */
export const INITIAL_VIEW_STATE = {
  longitude: 71.85,
  latitude: 19.35,
  zoom: 7.5,
  pitch: 45,
  bearing: -15,
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
    color: "#6B7F94",   // slate-ish, neutral — informational
  },
  {
    id: LAYER_IDS.slickPolygon,
    label: "Slick Polygon",
    description: "Detected oil slick extent (P1)",
    color: "#F59E0B",   // amber — caution: oil spill hazard boundary
  },
  {
    id: LAYER_IDS.h3Corridor,
    label: "H3 Corridor",
    description: "Particle-density hex corridor (P4)",
    color: "#22D3EE",   // cyan — primary data layer
  },
  {
    id: LAYER_IDS.aisTracks,
    label: "AIS Tracks",
    description: "Vessel tracks & interpolated positions (P5)",
    color: "#22D3EE",   // cyan — same accent family, distinguishable by context
  },
];

export const DEFAULT_VISIBILITY: Record<LayerId, boolean> = {
  [LAYER_IDS.sarRaster]: true,
  [LAYER_IDS.slickPolygon]: true,
  [LAYER_IDS.h3Corridor]: true,
  [LAYER_IDS.aisTracks]: true,
};

export interface TrackColorOption {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

/**
 * Restricted to 4 cyan-family shades only.
 * Pink / orange / purple are banned from the live map per design spec.
 */
export const TRACK_COLOR_OPTIONS: TrackColorOption[] = [
  { id: "cyan",      name: "Cyan",       hex: "#22D3EE", rgb: [34, 211, 238] },
  { id: "cyan-dim",  name: "Cyan (dim)", hex: "#0E7490", rgb: [14, 116, 144] },
  { id: "teal",      name: "Teal",       hex: "#14B8A6", rgb: [20, 184, 166] },
  { id: "white",     name: "White",      hex: "#E2E8F0", rgb: [226, 232, 240] },
];
