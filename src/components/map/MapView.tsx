import { MapboxOverlay } from "@deck.gl/mapbox";
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type IControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

import { INITIAL_VIEW_STATE, type LayerId, BASEMAP_STYLES, type ThemeMode } from "@/lib/map/config";
import { buildLayers } from "@/lib/map/layers";
import type { P1Output } from "@/lib/contracts/p1";
import type { P4Output } from "@/lib/contracts/p4";
import type { P5Output, VesselTrack } from "@/lib/contracts/p5";
import { DEFAULT_P1_DATA } from "@/lib/adapters/p1Adapter";
import { DEFAULT_P4_DATA } from "@/lib/adapters/p4Adapter";
import { DEFAULT_P5_DATA, getVesselPositionsAtHour } from "@/lib/adapters/p5Adapter";
import type { MapTooltipInfo } from "@/lib/map/types";

export interface MapViewProps {
  visibility: Record<LayerId, boolean>;
  p1Data?: P1Output;
  p4Data?: P4Output;
  p5Data?: P5Output;
  relativeHour?: number;
  sarOpacity?: number;
  selectedTrackId?: string;
  selectedTrackColor?: [number, number, number];
  followTrack?: boolean;
  theme?: ThemeMode;
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
  selectedTrackId = "all",
  selectedTrackColor = [34, 197, 94],
  followTrack = false,
  theme = "dark",
  onSelectVessel,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [tooltip, setTooltip] = useState<MapTooltipInfo | null>(null);

  const styleUrl = BASEMAP_STYLES[theme] ?? BASEMAP_STYLES.dark;

  const layers = useMemo(
    () =>
      buildLayers({
        visibility,
        p1Data,
        p4Data,
        p5Data,
        relativeHour,
        sarOpacity,
        selectedTrackId,
        selectedTrackColor,
        followTrack,
        onHover: (info) => setTooltip(info),
        onSelectVessel,
      }),
    [
      visibility,
      p1Data,
      p4Data,
      p5Data,
      relativeHour,
      sarOpacity,
      selectedTrackId,
      selectedTrackColor,
      followTrack,
      onSelectVessel,
    ]
  );

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
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

  // Update style when theme changes
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(styleUrl);
  }, [styleUrl]);

  // Update deck.gl overlay layers
  useEffect(() => {
    overlayRef.current?.setProps({ layers });
  }, [layers]);

  // Follow Selected Track Camera Movement
  useEffect(() => {
    if (!mapRef.current || !followTrack || selectedTrackId === "all") return;

    const positions = getVesselPositionsAtHour(p5Data, relativeHour);
    const target = positions.find((p) => p.vessel.vesselId === selectedTrackId);

    if (target && target.currentPosition) {
      mapRef.current.flyTo({
        center: target.currentPosition,
        zoom: Math.max(12, mapRef.current.getZoom()),
        essential: true,
        duration: 900,
      });
    }
  }, [followTrack, selectedTrackId, relativeHour, p5Data]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ position: "absolute", inset: 0 }}
    >
      {/* Polished Glass Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30 rounded-xl border border-border/80 bg-card/95 px-3.5 py-2.5 text-xs shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y + 14,
            maxWidth: "260px",
          }}
        >
          <div className="font-bold text-foreground truncate border-b border-border/80 pb-1 mb-1.5 flex items-center justify-between">
            <span className="truncate">{tooltip.title}</span>
            <span className="ml-1 text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-primary/20 text-primary font-bold">
              {tooltip.type}
            </span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            {tooltip.items.map((item, idx) => (
              <div key={idx} className="flex justify-between gap-3">
                <span className="text-muted-foreground font-medium">{item.label}:</span>
                <span className="font-semibold text-foreground truncate">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
