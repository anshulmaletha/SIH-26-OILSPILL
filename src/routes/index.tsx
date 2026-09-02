import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState, useEffect } from "react";
import { ShieldAlert, Radio, Flame, Ship, Sun, Moon } from "lucide-react";

import { LayerPanel } from "@/components/map/LayerPanel";
import { TimeSlider } from "@/components/map/TimeSlider";
import {
  DEFAULT_VISIBILITY,
  type LayerId,
  type ThemeMode,
  TRACK_COLOR_OPTIONS,
} from "@/lib/map/config";
import { DEFAULT_P1_DATA } from "@/lib/adapters/p1Adapter";
import { DEFAULT_P4_DATA } from "@/lib/adapters/p4Adapter";
import { DEFAULT_P5_DATA } from "@/lib/adapters/p5Adapter";
import { Button } from "@/components/ui/button";

// MapLibre/Deck.gl are browser-only: lazy-load the map so SSR never touches it.
const MapView = lazy(() => import("@/components/map/MapView"));

const THEME_STORAGE_KEY = "sih_theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SIH 26143" },
      {
        name: "description",
        content:
          "SIH 26143 - Geospatial maritime oil spill intelligence platform: SAR radar overlay, slick polygon segmentation, time-animated H3 density corridor, and AIS vessel tracks.",
      },
      { property: "og:title", content: "SIH 26143" },
      {
        property: "og:description",
        content:
          "SIH 26143 - Geospatial maritime oil spill intelligence platform: SAR radar overlay, slick polygon segmentation, time-animated H3 density corridor, and AIS vessel tracks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [sarOpacity, setSarOpacity] = useState<number>(0.55);

  // AIS Track Selection & Follow State
  const [selectedTrackId, setSelectedTrackId] = useState<string>("all");
  const [selectedTrackColorId, setSelectedTrackColorId] = useState<string>("green");
  const [followTrack, setFollowTrack] = useState<boolean>(false);

  // Initialize theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
        if (saved === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      } else {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_STORAGE_KEY, next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  const toggleLayer = (id: LayerId) =>
    setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  // Get RGB tuple for the chosen track color
  const selectedTrackColor =
    TRACK_COLOR_OPTIONS.find((c) => c.id === selectedTrackColorId)?.rgb ?? [34, 197, 94];

  return (
    <div
      className={`relative h-screen w-screen overflow-hidden font-sans select-none transition-colors duration-300 ${
        theme === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      <h1 className="sr-only">SIH 26143 - Maritime Situation Dashboard</h1>

      {/* Top Command Status Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-card/90 px-4 backdrop-blur-xl shadow-lg">
        {/* Project Branding & Sector Info */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30 shadow-xs">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-foreground">
                SIH 26143
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Maritime Oil Spill Intelligence Platform • Singapore Strait Sector (103.85°E, 1.18°N)
            </p>
          </div>
        </div>

        {/* Live Telemetry KPI Badges & Theme Switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 font-mono text-xs">
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-foreground">
              <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              <span>SAR: Sentinel-1A (VV)</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-amber-500 font-semibold">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span>Slick: 4.38 km² (94%)</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-emerald-500 font-semibold">
              <Ship className="h-3.5 w-3.5 text-emerald-500" />
              <span>AIS: 3 Tracks</span>
            </div>
          </div>

          {/* Theme Mode Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="h-8 gap-1.5 rounded-lg border-border bg-background px-2.5 text-xs font-semibold hover:bg-accent cursor-pointer shadow-xs"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-700" />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </Button>
        </div>
      </header>

      <ClientOnly
        fallback={
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground bg-background">
            Initializing geospatial renderer…
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground bg-background">
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
            selectedTrackId={selectedTrackId}
            selectedTrackColor={selectedTrackColor}
            followTrack={followTrack}
            theme={theme}
          />
        </Suspense>

        {/* Floating Left Control Dock (Top Left) */}
        <div className="absolute left-4 top-16 z-10">
          <LayerPanel
            visibility={visibility}
            onToggle={toggleLayer}
            sarOpacity={sarOpacity}
            onChangeSarOpacity={setSarOpacity}
            vessels={DEFAULT_P5_DATA.vessels}
            selectedTrackId={selectedTrackId}
            onSelectTrackId={setSelectedTrackId}
            selectedTrackColorId={selectedTrackColorId}
            onSelectTrackColorId={setSelectedTrackColorId}
            followTrack={followTrack}
            onToggleFollowTrack={setFollowTrack}
          />
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
