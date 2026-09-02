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
      {/* Polished Glass Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30 rounded-xl border border-slate-700/80 bg-slate-950/95 px-3.5 py-2.5 text-xs shadow-2xl shadow-black/80 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y + 14,
            maxWidth: "260px",
          }}
        >
          <div className="font-bold text-slate-100 truncate border-b border-slate-800/80 pb-1 mb-1.5 flex items-center justify-between">
            <span className="truncate">{tooltip.title}</span>
            <span className="ml-1 text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              {tooltip.type}
            </span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {tooltip.items.map((item, idx) => (
              <div key={idx} className="flex justify-between gap-3">
                <span className="text-slate-400 font-medium">{item.label}:</span>
                <span className="font-semibold text-slate-200 truncate">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
