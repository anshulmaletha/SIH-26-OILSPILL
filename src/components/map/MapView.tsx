import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type IControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";

import { INITIAL_VIEW_STATE, LAYER_IDS, type LayerId } from "@/lib/map/config";
import { buildLayers } from "@/lib/map/layers";

export interface MapViewProps {
  visibility: Record<LayerId, boolean>;
}

/**
 * MapLibre basemap + deck.gl overlay (interleaved mode).
 * This module is browser-only — it is lazy-loaded behind <ClientOnly>.
 */
export default function MapView({ visibility }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const layers = useMemo(() => buildLayers(visibility), [visibility]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: (import.meta.env["VITE_MAP_STYLE_URL"] as string | undefined) ??
        "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
      zoom: INITIAL_VIEW_STATE.zoom,
      pitch: INITIAL_VIEW_STATE.pitch,
      bearing: INITIAL_VIEW_STATE.bearing,
    });
    map.addControl(new NavigationControl(), "top-right");
    map.addControl(new ScaleControl(), "bottom-right");

    // Attach the deck.gl overlay only after the map has fully loaded —
    // map.transform is not ready before that, and early sync crashes.
    map.on("load", () => {
      if (overlayRef.current) return;
      const overlay = new MapboxOverlay({ interleaved: false, layers });
      overlayRef.current = overlay;
      map.addControl(overlay as unknown as IControl);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      // Inline style wins over maplibre-gl.css (.maplibregl-map sets
      // position:relative), which loads after Tailwind in the lazy chunk.
      style={{ position: "absolute", inset: 0 }}
    />
  );
}

export const DEFAULT_VISIBILITY: Record<LayerId, boolean> = {
  [LAYER_IDS.sarRaster]: true,
  [LAYER_IDS.slickPolygon]: true,
  [LAYER_IDS.h3Corridor]: true,
  [LAYER_IDS.aisTracks]: true,
};
