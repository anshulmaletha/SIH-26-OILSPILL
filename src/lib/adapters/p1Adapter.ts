import type { P1Output, SlickPolygonData, SarRasterData } from "../contracts/p1";
import { SAR_RASTER_PATCH, SLICK_POLYGONS } from "../map/data/sampleData";

export interface GeoJsonPolygonFeature {
  type: "Feature";
  properties: {
    id: string;
    sceneId: string;
    confidence: number;
    areaKm2: number;
    thicknessCategory: string;
    estimatedVolumeM3?: number;
  };
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
}

export function formatSlickAsGeoJson(slick: SlickPolygonData): GeoJsonPolygonFeature {
  return {
    type: "Feature",
    properties: {
      id: slick.id,
      sceneId: slick.sceneId,
      confidence: slick.confidence,
      areaKm2: slick.areaKm2,
      thicknessCategory: slick.thicknessCategory,
      estimatedVolumeM3: slick.estimatedVolumeM3,
    },
    geometry: {
      type: "Polygon",
      coordinates: [slick.coordinates],
    },
  };
}

/** Fallback sample data when P1 output is not yet pushed */
export const DEFAULT_P1_DATA: P1Output = {
  sarScene: {
    sceneId: "S1A_IW_GRDH_1SDV_20260902T055812_SINGAPORE",
    satellite: "Sentinel-1A",
    acquisitionTime: "2026-09-02T05:58:12Z",
    polarization: "VV",
    resolutionMeters: 10,
    bounds: SAR_RASTER_PATCH.bounds,
    meanBackscatterDb: -18.6,
  },
  slicks: SLICK_POLYGONS.map((s) => ({
    id: s.id,
    sceneId: "S1A_IW_GRDH_1SDV_20260902T055812_SINGAPORE",
    detectionTime: "2026-09-02T06:00:00Z",
    confidence: s.confidence,
    areaKm2: 4.38,
    estimatedVolumeM3: 650,
    thicknessCategory: "heavy_crude",
    centroid: [103.84, 1.15],
    coordinates: s.ring,
    boundingExtent: [103.8, 1.12, 103.88, 1.19],
  })),
  processedAt: "2026-09-02T06:15:00Z",
  modelConfidence: 0.94,
};

export function parseP1Payload(raw: unknown): P1Output {
  if (!raw || typeof raw !== "object") return DEFAULT_P1_DATA;
  const p1 = raw as Partial<P1Output>;
  if (!p1.sarScene || !Array.isArray(p1.slicks)) return DEFAULT_P1_DATA;
  return p1 as P1Output;
}

export function getPrimarySlick(p1: P1Output): SlickPolygonData | null {
  if (!p1.slicks || p1.slicks.length === 0) return null;
  return p1.slicks.reduce((max, curr) => (curr.areaKm2 > max.areaKm2 ? curr : max), p1.slicks[0]);
}

export function getSarBoundingBox(sar: SarRasterData): [minLng: number, minLat: number, maxLng: number, maxLat: number] {
  return sar.bounds;
}
