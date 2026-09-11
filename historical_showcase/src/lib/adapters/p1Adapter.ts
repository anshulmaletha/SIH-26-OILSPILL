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
      ...(slick.estimatedVolumeM3 !== undefined ? { estimatedVolumeM3: slick.estimatedVolumeM3 } : {}),
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
    // scene_id from sar_detection_output.json
    sceneId: "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI",
    satellite: "Sentinel-1A",
    // acquisition_time from sar_detection_output.json
    acquisitionTime: "2026-05-15T06:00:00Z",
    polarization: "VV",
    resolutionMeters: 10,
    bounds: SAR_RASTER_PATCH.bounds,
    meanBackscatterDb: -18.6,
  },
  slicks: SLICK_POLYGONS.map((s) => ({
    id: s.id,
    sceneId: "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI",
    detectionTime: "2026-05-15T06:00:00Z",
    // NOTE: confidence is ABSENT in sar_detection_output.json at polygon level (confirmed defect).
    // sampleData.ts supplies 0.88 as default to avoid silent 0/undefined in UI display.
    confidence: s.confidence,
    // area_km2 from sar_detection_output.json → geometry_features.area_km2
    areaKm2: 4.82,
    estimatedVolumeM3: 650,
    thicknessCategory: "heavy_crude",
    // centroid computed from polygon average: (71.835+71.86+71.87+71.845)/4 ≈ 71.8525, (19.36+19.37+19.34+19.33)/4 ≈ 19.35
    centroid: [71.8525, 19.35],
    coordinates: s.ring,
    // boundingExtent derived from polygon coordinates in sar_detection_output.json
    boundingExtent: [71.835, 19.33, 71.87, 19.37],
  })),
  processedAt: "2026-05-15T06:15:00Z",
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
  const first = p1.slicks[0]!;
  return p1.slicks.reduce((max, curr) => (curr.areaKm2 > max.areaKm2 ? curr : max), first) ?? null;
}

export function getSarBoundingBox(sar: SarRasterData): [minLng: number, minLat: number, maxLng: number, maxLat: number] {
  return sar.bounds;
}

export function convertDetectionResponseToP1(data: any): P1Output {
  if (!data || !Array.isArray(data.polygons) || data.polygons.length === 0) {
    return DEFAULT_P1_DATA;
  }

  const slicks: SlickPolygonData[] = data.polygons.map((p: any, idx: number) => {
    const coords: [number, number][] = p.geometry?.coordinates?.[0] || SLICK_POLYGONS[0]?.ring || [];
    let sumLng = 0, sumLat = 0;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

    for (const [lng, lat] of coords) {
      sumLng += lng;
      sumLat += lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const count = coords.length || 1;
    const centroid: [number, number] = [Number((sumLng / count).toFixed(4)), Number((sumLat / count).toFixed(4))];

    return {
      id: p.polygon_id || `poly-${idx + 1}`,
      sceneId: data.scene_id || "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI",
      detectionTime: data.acquisition_time || "2026-05-15T06:00:00Z",
      confidence: p.confidence ?? (p.lookalike_filter?.final_decision === "confirmed" ? 0.94 : 0.32),
      areaKm2: p.geometry_features?.area_km2 ?? 4.82,
      estimatedVolumeM3: 650,
      thicknessCategory: "heavy_crude",
      centroid,
      coordinates: coords,
      boundingExtent: [minLng, minLat, maxLng, maxLat],
    };
  });

  return {
    sarScene: {
      sceneId: data.scene_id || "S1A_IW_GRDH_1SDV_20260515T060000_MUMBAI",
      satellite: "Sentinel-1A",
      acquisitionTime: data.acquisition_time || "2026-05-15T06:00:00Z",
      polarization: "VV",
      resolutionMeters: 10,
      bounds: SAR_RASTER_PATCH.bounds,
      meanBackscatterDb: -18.6,
    },
    slicks,
    processedAt: "2026-05-15T06:15:00Z",
    modelConfidence: slicks[0]?.confidence ?? 0.94,
  };
}
