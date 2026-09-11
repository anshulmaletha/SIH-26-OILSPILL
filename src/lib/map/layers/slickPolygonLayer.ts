import { GeoJsonLayer } from "@deck.gl/layers";
import { LAYER_IDS } from "../config";
import type { SlickPolygonData } from "../../contracts/p1";
import type { MapTooltipInfo } from "../types";
import { generateOrganicSlick, DEFAULT_WIND, DEFAULT_CURRENT } from "../../physics/slickPhysics";

export function createSlickPolygonLayer(
  slicks: SlickPolygonData[],
  visible: boolean,
  onHover?: (info: MapTooltipInfo | null) => void,
  relativeHour: number = 0,
  windSpeedMs: number = DEFAULT_WIND.speedMs,
  windHeadingDeg: number = DEFAULT_WIND.headingDeg,
  currentSpeedMs: number = DEFAULT_CURRENT.speedMs,
  currentHeadingDeg: number = DEFAULT_CURRENT.headingDeg
) {
  // Generate multi-layer organic polygons with dynamic physics
  const features = slicks.flatMap((slick) => {
    // Generate organic shape for this slick based on wind & ocean current
    const baseCentroid: [number, number] = slick.centroid || [71.853, 19.352];
    const dynamicState = generateOrganicSlick(
      baseCentroid,
      relativeHour,
      { speedMs: windSpeedMs, headingDeg: windHeadingDeg },
      { speedMs: currentSpeedMs, headingDeg: currentHeadingDeg },
      slick.areaKm2 || 4.82
    );

    // 1. Outer Sheen / Iridescent halo feature
    const sheenFeature = {
      type: "Feature" as const,
      properties: {
        ...slick,
        isSheen: true,
        dynamicState,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [dynamicState.sheenPolygon],
      },
    };

    // 2. Heavy Crude Dense Core feature
    const coreFeature = {
      type: "Feature" as const,
      properties: {
        ...slick,
        isSheen: false,
        dynamicState,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [dynamicState.corePolygon],
      },
    };

    return { sheenFeature, coreFeature };
  });

  const sheenFeatures = features.map((f) => f.sheenFeature);
  const coreFeatures = features.map((f) => f.coreFeature);

  const hoverHandler = (info: any) => {
    if (!onHover) return;
    if (!info.object) {
      onHover(null);
      return;
    }
    const p = info.object.properties;
    const dyn = p.dynamicState;

    onHover({
      x: info.x,
      y: info.y,
      type: "slick",
      title: `Oil Slick (${p.id || 'INC-2026-MUM-001'})`,
      items: [
        { label: "Confidence", value: `${((p.confidence || 0.94) * 100).toFixed(1)}%` },
        { label: "Active Area", value: `${dyn ? dyn.areaKm2.toFixed(2) : p.areaKm2.toFixed(2)} km²` },
        { label: "Dimensions", value: dyn ? `${dyn.majorAxisKm} × ${dyn.minorAxisKm} km` : "4.21 × 1.15 km" },
        { label: "Net Drift Vel.", value: dyn ? `${dyn.netDriftSpeedMs} m/s @ ${dyn.netDriftHeadingDeg}°` : "0.52 m/s" },
        { label: "Forcing (Wind)", value: dyn ? `${dyn.windSpeedMs} m/s` : "3.8 m/s" },
        { label: "Category", value: p.thicknessCategory ? p.thicknessCategory.replace("_", " ").toUpperCase() : "HEAVY CRUDE" },
      ],
    });
  };

  // Outer iridescent sheen halo layer (rendered beneath core, no depth test)
  const sheenLayer = new GeoJsonLayer({
    id: `${LAYER_IDS.slickPolygon}-sheen`,
    visible,
    data: { type: "FeatureCollection", features: sheenFeatures },
    filled: true,
    stroked: true,
    getFillColor: [56, 189, 248, 55],       // Translucent iridescent sky-blue sheen
    getLineColor: [56, 189, 248, 160],      // Subtle outer sheen boundary
    getLineWidth: 1.5,
    lineWidthUnits: "pixels",
    pickable: true,
    parameters: { depthTest: false },       // Completely prevents Z-fighting & flickering
    onHover: hoverHandler,
  });

  // Inner dense crude oil core layer (rendered directly on top, no depth test)
  const coreLayer = new GeoJsonLayer({
    id: `${LAYER_IDS.slickPolygon}-core`,
    visible,
    data: { type: "FeatureCollection", features: coreFeatures },
    filled: true,
    stroked: true,
    getFillColor: [217, 130, 10, 210],      // Rich opaque crude amber/brown oil body
    getLineColor: [245, 158, 11, 255],      // Crisp glowing amber outline
    getLineWidth: 2.0,
    lineWidthUnits: "pixels",
    pickable: true,
    parameters: { depthTest: false },       // Completely prevents Z-fighting & flickering
    onHover: hoverHandler,
  });

  return [sheenLayer, coreLayer];
}
