/**
 * Browser-safe map configuration.
 * No maplibre/deck.gl imports here — this module is imported by SSR routes.
 */

export const BASEMAP_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
} as const;

export type ThemeMode = "dark" | "light";

export const MAP_STYLE_URL =
  (import.meta.env["VITE_MAP_STYLE_URL"] as string | undefined) ??
  BASEMAP_STYLES.dark;

/** Initial camera: Singapore Strait — a busy AIS / maritime monitoring region. */
export const INITIAL_VIEW_STATE = {
  longitude: 103.85,
  latitude: 1.18,
  zoom: 10.5,
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
    description: "Synthetic aperture radar backscatter scene (P1 integration)",
    color: "#9ca3af",
  },
  {
    id: LAYER_IDS.slickPolygon,
    label: "Slick Polygon",
    description: "Detected oil slick extent polygon (P1 integration)",
    color: "#f59e0b",
  },
  {
    id: LAYER_IDS.h3Corridor,
    label: "H3 Corridor",
    description: "H3 hexagon corridor cells with particle density styling (P4 integration)",
    color: "#ec4899",
  },
  {
    id: LAYER_IDS.aisTracks,
    label: "AIS Tracks",
    description: "Vessel tracks and interpolated positions (P5 integration)",
    color: "#4ade80",
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

export const TRACK_COLOR_OPTIONS: TrackColorOption[] = [
  { id: "green", name: "Green", hex: "#22c55e", rgb: [34, 197, 94] },
  { id: "blue", name: "Blue", hex: "#38bdf8", rgb: [56, 189, 248] },
  { id: "pink", name: "Pink", hex: "#ec4899", rgb: [236, 72, 153] },
  { id: "orange", name: "Orange", hex: "#f97316", rgb: [249, 115, 22] },
  { id: "purple", name: "Purple", hex: "#a855f7", rgb: [168, 85, 247] },
  { id: "amber", name: "Amber", hex: "#fbbf24", rgb: [251, 191, 36] },
];
