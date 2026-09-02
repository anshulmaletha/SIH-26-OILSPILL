import type { VesselTrack } from "../contracts/p5";
import type { SlickPolygonData } from "../contracts/p1";
import type { H3CellDensity } from "../contracts/p4";
import type { Particle } from "../contracts/p2";

export type LngLat = [longitude: number, latitude: number];

export interface MapTooltipInfo {
  x: number;
  y: number;
  type: "vessel" | "slick" | "h3cell" | "particle" | "dark_gap";
  title: string;
  items: Array<{ label: string; value: string | number }>;
  vesselData?: VesselTrack;
}
