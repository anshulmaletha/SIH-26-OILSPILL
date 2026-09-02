import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";

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
          "Map dashboard for maritime monitoring: SAR raster overlay, oil slick polygons, time-animated H3 corridor, and AIS vessel tracks.",
      },
      { property: "og:title", content: "Maritime Situation Dashboard" },
      {
        property: "og:description",
        content:
          "Map dashboard for maritime monitoring: SAR raster overlay, oil slick polygons, time-animated H3 corridor, and AIS vessel tracks.",
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
    <div className="dark relative h-screen w-screen overflow-hidden bg-background">
      <h1 className="sr-only">Maritime Situation Dashboard</h1>
      <ClientOnly
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading map…
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading map…
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

        {/* Top-Left Layer Control Panel */}
        <LayerPanel
          visibility={visibility}
          onToggle={toggle}
          sarOpacity={sarOpacity}
          onChangeSarOpacity={setSarOpacity}
        />

        {/* Bottom-Left Map Legend */}
        <MapLegend visibility={visibility} />

        {/* Bottom-Right Observation Time Slider */}
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
