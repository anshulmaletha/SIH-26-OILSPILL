import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type IControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

import { INITIAL_VIEW_STATE, type LayerId } from "@/lib/map/config";
import { buildLayers } from "@/lib/map/layers";
import type { P1Output } from "@/lib/contracts/p1";
import type { P4Output } from "@/lib/contracts/p4";
import type { P5Output, VesselTrack } from "@/lib/contracts/p5";
import { DEFAULT_P1_DATA } from "@/lib/adapters/p1Adapter";
import { DEFAULT_P4_DATA } from "@/lib/adapters/p4Adapter";
import { DEFAULT_P5_DATA } from "@/lib/adapters/p5Adapter";
import type { MapTooltipInfo } from "@/lib/map/types";

export interface MapViewProps {
  visibility: Record<LayerId, boolean>;
  p1Data?: P1Output;
  p4Data?: P4Output;
  p5Data?: P5Output;
  relativeHour?: number;
  sarOpacity?: number;
  selectedVesselId?: string | null;
  onSelectVessel?: (vessel: VesselTrack) => void;
}

/**
 * MapLibre basemap + deck.gl overlay (interleaved mode).
 * Browser-only — lazy-loaded behind <ClientOnly>.
 */
export default function MapView({
  visibility,
  p1Data = DEFAULT_P1_DATA,
  p4Data = DEFAULT_P4_DATA,
  p5Data = DEFAULT_P5_DATA,
  relativeHour = 0,
  sarOpacity = 0.55,
  selectedVesselId,
  onSelectVessel,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [tooltip, setTooltip] = useState<MapTooltipInfo | null>(null);

  const layers = useMemo(
    () =>
      buildLayers({
        visibility,
        p1Data,
        p4Data,
        p5Data,
        relativeHour,
        sarOpacity,
        selectedVesselId,
        onHover: (info) => setTooltip(info),
        onSelectVessel,
      }),
    [visibility, p1Data, p4Data, p5Data, relativeHour, sarOpacity, selectedVesselId, onSelectVessel]
  );

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
      style={{ position: "absolute", inset: 0 }}
    >
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg border border-border/80 bg-card/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-md"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y + 14,
            maxWidth: "240px",
          }}
        >
          <div className="font-bold text-foreground truncate border-b border-border/60 pb-1 mb-1">
            {tooltip.title}
          </div>
          <div className="space-y-0.5 font-mono text-[11px]">
            {tooltip.items.map((item, idx) => (
              <div key={idx} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{item.label}:</span>
                <span className="font-semibold text-foreground truncate">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
