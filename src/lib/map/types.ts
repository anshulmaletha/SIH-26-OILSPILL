import type { VesselTrack } from "../contracts/p5";

export type LngLat = [longitude: number, latitude: number];

export interface MapTooltipInfo {
  x: number;
  y: number;
  type: "vessel" | "slick" | "h3cell" | "particle" | "dark_gap" | "dark-vessel";
  title: string;
  items: Array<{ label: string; value: string | number }>;
  vesselData?: VesselTrack;
}

export interface SarRasterPatch {
  bounds: [number, number, number, number];
}

export interface SlickPolygon {
  id: string;
  confidence: number;
  ring: [number, number][];
}

export interface AisTrack {
  vesselId: string;
  vesselName: string;
  path: [number, number][];
}

