/** Shared geospatial placeholder types (browser-safe, no deck.gl imports). */

export type LngLat = [longitude: number, latitude: number];

export interface AisTrack {
  vesselId: string;
  vesselName: string;
  /** Ordered track positions. */
  path: LngLat[];
}

export interface SlickPolygon {
  id: string;
  confidence: number;
  /** Linear ring (closed). */
  ring: LngLat[];
}

export interface SarRasterPatch {
  /** [minLng, minLat, maxLng, maxLat] bounds the raster image is drawn into. */
  bounds: [number, number, number, number];
}
