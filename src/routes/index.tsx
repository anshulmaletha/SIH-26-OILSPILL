import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";

import { LayerPanel } from "@/components/map/LayerPanel";
import { MapLegend } from "@/components/map/MapLegend";
import { DEFAULT_VISIBILITY } from "@/components/map/MapView";
import type { LayerId } from "@/lib/map/config";

// MapLibre/Deck.gl are browser-only: lazy-load the map so SSR never touches it.
const MapView = lazy(() => import("@/components/map/MapView"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maritime Situation Dashboard" },
      {
        name: "description",
        content:
          "Map dashboard for maritime monitoring: SAR raster, oil slick polygons, H3 corridors, and AIS vessel tracks.",
      },
      { property: "og:title", content: "Maritime Situation Dashboard" },
      {
        property: "og:description",
        content:
          "Map dashboard for maritime monitoring: SAR raster, oil slick polygons, H3 corridors, and AIS vessel tracks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);

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
          <MapView visibility={visibility} />
        </Suspense>
        <LayerPanel visibility={visibility} onToggle={toggle} />
        <MapLegend visibility={visibility} />
      </ClientOnly>
    </div>
  );
}
