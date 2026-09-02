import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";
import { ShieldAlert, Radio, Flame, Ship, Clock } from "lucide-react";

import { LayerPanel } from "@/components/map/LayerPanel";
import { MapLegend } from "@/components/map/MapLegend";
import { TimeSlider } from "@/components/map/TimeSlider";
import { DEFAULT_VISIBILITY, type LayerId } from "@/lib/map/config";
import { DEFAULT_P1_DATA } from "@/lib/adapters/p1Adapter";
import { DEFAULT_P4_DATA } from "@/lib/adapters/p4Adapter";
import { DEFAULT_P5_DATA } from "@/lib/adapters/p5Adapter";

// MapLibre/Deck.gl are browser-only: lazy-load the map so SSR never touches it.
const MapView = lazy(() => import("@/components/map/MapView"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maritime Situation Dashboard | SIH-26 Oil Spill Explorer" },
      {
        name: "description",
        content:
          "Geospatial intelligence dashboard for maritime oil spill monitoring: SAR radar overlay, slick polygon segmentation, time-animated H3 density corridor, and AIS vessel tracks.",
      },
      { property: "og:title", content: "Maritime Situation Dashboard" },
      {
        property: "og:description",
        content:
          "Geospatial intelligence dashboard for maritime oil spill monitoring: SAR radar overlay, slick polygon segmentation, time-animated H3 density corridor, and AIS vessel tracks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [sarOpacity, setSarOpacity] = useState<number>(0.55);

  const toggle = (id: LayerId) =>
    setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="dark relative h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none text-slate-100">
      <h1 className="sr-only">Maritime Situation Dashboard</h1>

      {/* Top Command Status Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex h-14 items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-4 backdrop-blur-xl shadow-lg shadow-black/40">
        {/* Brand & Incident Info */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-xs">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white sm:text-base">
                SIH-26 Oil Spill Intelligence
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-cyan-400 border border-cyan-500/20">
                P6 Dashboard
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Singapore Strait Sector • 103.85°E, 1.18°N • Sentinel-1 SAR Mission
            </p>
          </div>
        </div>

        {/* Live Telemetry KPI Badges */}
        <div className="hidden md:flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-slate-300">
            <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span>SAR: Sentinel-1A (VV)</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-amber-300">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>Slick: 4.38 km² (94%)</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-emerald-300">
            <Ship className="h-3.5 w-3.5 text-emerald-400" />
            <span>AIS: 3 Tracks</span>
          </div>
        </div>
      </header>

      <ClientOnly
        fallback={
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400 bg-slate-950">
            Initializing geospatial renderer…
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400 bg-slate-950">
              Initializing geospatial renderer…
            </div>
          }
        >
          <MapView
            visibility={visibility}
            p1Data={DEFAULT_P1_DATA}
            p4Data={DEFAULT_P4_DATA}
            p5Data={DEFAULT_P5_DATA}
            relativeHour={selectedHour}
            sarOpacity={sarOpacity}
          />
        </Suspense>

        {/* Floating Layer Control Panel (Top Left) */}
        <div className="absolute left-4 top-18 z-10">
          <LayerPanel
            visibility={visibility}
            onToggle={toggle}
            sarOpacity={sarOpacity}
            onChangeSarOpacity={setSarOpacity}
          />
        </div>

        {/* Floating Map Legend (Bottom Left) */}
        <div className="absolute bottom-6 left-4 z-10">
          <MapLegend visibility={visibility} />
        </div>

        {/* Observation Time Slider (Bottom Right) */}
        <div className="absolute bottom-6 right-4 z-10">
          <TimeSlider
            selectedHour={selectedHour}
            onSelectHour={setSelectedHour}
          />
        </div>
      </ClientOnly>
    </div>
  );
}
