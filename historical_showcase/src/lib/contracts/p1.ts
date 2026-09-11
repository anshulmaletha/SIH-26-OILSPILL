/**
 * P1 Contract: SAR Scene & Oil Slick Segmentation
 * Owner: P1 (SAR / U-Net / CFAR)
 */

export interface SarRasterData {
  sceneId: string;
  satellite: "Sentinel-1A" | "Sentinel-1B" | "RADARSAT-2" | "TerraSAR-X" | "Simulated-SAR";
  acquisitionTime: string;
  polarization: "VV" | "VH" | "HH" | "HV";
  resolutionMeters: number;
  /** [minLng, minLat, maxLng, maxLat] bounding box */
  bounds: [number, number, number, number];
  /** Direct image URL or base64 data URI if available */
  imageUrl?: string;
  /** Average backscatter intensity in dB (e.g. -15.4 dB) */
  meanBackscatterDb?: number;
}

export interface SlickPolygonData {
  id: string;
  sceneId: string;
  detectionTime: string;
  confidence: number; // 0.0 to 1.0
  areaKm2: number;
  estimatedVolumeM3?: number;
  thicknessCategory: "sheen" | "rainbow" | "metallic" | "true_color" | "heavy_crude";
  centroid: [longitude: number, latitude: number];
  /** Polygon coordinates: [ [lng, lat], ... ] (linear ring) */
  coordinates: [number, number][];
  boundingExtent: [minLng: number, minLat: number, maxLng: number, maxLat: number];
}

export interface P1Output {
  sarScene: SarRasterData;
  slicks: SlickPolygonData[];
  processedAt: string;
  modelConfidence: number;
}
