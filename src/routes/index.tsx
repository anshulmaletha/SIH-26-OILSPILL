import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";

import { LayerPanel } from "@/components/map/LayerPanel";
import { TimeSlider } from "@/components/map/TimeSlider";
import { SuspectRankingTable } from "@/components/dashboard/SuspectRankingTable";
import { DarkVesselAlert } from "@/components/dashboard/DarkVesselAlert";
import { CaseFileExportButton } from "@/components/dashboard/CaseFileExportButton";
import {
  DEFAULT_VISIBILITY,
  type LayerId,
  TRACK_COLOR_OPTIONS,
} from "@/lib/map/config";
import { getOfflineScenario } from "@/lib/data/offlineDemoData";
import type { VesselTrack } from "@/lib/contracts/p5";

// MapLibre/Deck.gl are browser-only: lazy-load the map so SSR never touches it.
const MapView = lazy(() => import("@/components/map/MapView"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SIH 26143 — Maritime Intelligence" },
      {
        name: "description",
        content:
          "SIH 26143 — Geospatial maritime oil spill intelligence: SAR overlay, H3 density corridor, AIS vessel attribution.",
      },
      { property: "og:title", content: "SIH 26143" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [scenario, setScenario] = useState<"active" | "no_candidates">("active");
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [selectedHour, setSelectedHour] = useState<number>(0);
  const [sarOpacity, setSarOpacity] = useState<number>(0.30);

  // AIS track selection + follow
  const [selectedTrackId, setSelectedTrackId] = useState<string>("all");
  const [selectedTrackColorId, setSelectedTrackColorId] = useState<string>("cyan");
  const [followTrack, setFollowTrack] = useState<boolean>(false);

  /**
   * Two-way binding: selectedVesselId drives both the map highlight AND
   * the expanded row in the ranking panel.
   * - Clicking a vessel on the map → sets selectedTrackId AND expandedVesselId
   * - Clicking a ranking card → sets selectedTrackId AND expandedVesselId
   */
  const [expandedVesselId, setExpandedVesselId] = useState<string | null>(null);

  const toggleLayer = (id: LayerId) =>
    setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));

  // Handle vessel selection from map or ranking panel
  const handleSelectVessel = (vessel: VesselTrack | string) => {
    const vesselId = typeof vessel === "string" ? vessel : vessel.vesselId;
    setSelectedTrackId(vesselId);
    setExpandedVesselId(vesselId);
  };

  // Handle ranking panel row click (vesselId string)
  const handleRankingSelect = (vesselId: string) => {
    setSelectedTrackId(vesselId);
    setExpandedVesselId(vesselId);
    // Pulse highlight on map: follow mode briefly
    setFollowTrack(true);
    setTimeout(() => setFollowTrack(false), 1500);
  };

  const selectedTrackColor =
    TRACK_COLOR_OPTIONS.find((c) => c.id === selectedTrackColorId)?.rgb ??
    [34, 211, 238];

  const currentScenario = getOfflineScenario(scenario);
  const currentP1Data = currentScenario.p1Data;
  const currentP3Data = currentScenario.p3Data;
  const currentP4Data = currentScenario.p4Data;
  const currentP5Data = currentScenario.p5Data;

  // Primary suspect = rank #1 from P3 (gets halo ring on map)
  const primarySuspectVesselId = currentP3Data?.suspects?.[0]?.vesselId;

  return (
    <div
      className="dark"
      style={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        userSelect: "none",
        background: "#0A0E14",
        color: "#C8D8E8",
      }}
    >
      <h1 className="sr-only">SIH 26143 — Maritime Situation Dashboard</h1>

      {/* ── TOP COMMAND BAR ─────────────────────────────────────────────────── */}
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          height: 52,
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #1C2A38",
          background: "#0D1117",
          padding: "0 16px",
        }}
      >
        {/* Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              border: "1px solid #1C2A38",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#111822",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <polygon points="8,2 14,12 2,12" stroke="#22D3EE" strokeWidth="1.2" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: "#E2E8F0",
              }}
            >
              SIH 26143
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8px",
                color: "#3A5268",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {currentScenario.sector}
            </div>
          </div>
        </div>

        {/* Right section: KPI tags + controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* KPI badges — visible on wider screens */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>
            {/* SAR sensor */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                border: "1px solid #1C2A38",
                background: "#111822",
                color: "#5A7A94",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  background: "#22D3EE",
                  borderRadius: "50%",
                  animation: "pulse-ring-inner 1.8s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
              <span>SAR: Sentinel-1A</span>
            </div>

            {/* Slick extent — amber is appropriate: oil slick = caution hazard */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                border: "1px solid #1C2A38",
                background: "#111822",
                color: "#F59E0B",
              }}
            >
              <span>Slick: 4.38 km² (94%)</span>
            </div>

            {/* AIS tracks */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 8px",
                border: "1px solid #1C2A38",
                background: "#111822",
                color: "#22D3EE",
              }}
            >
              <span>
                AIS: {currentP5Data.vessels.filter(v => !v.isDarkVessel).length} Tracks
              </span>
            </div>
          </div>

          {/* Scenario switcher */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              border: "1px solid #1C2A38",
              background: "#0A0E14",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
            }}
          >
            <span style={{ color: "#3A5268", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Scenario
            </span>
            <select
              value={scenario}
              onChange={(e) => {
                const next = e.target.value as "active" | "no_candidates";
                setScenario(next);
                if (next === "no_candidates") {
                  setSelectedTrackId("all");
                  setFollowTrack(false);
                  setExpandedVesselId(null);
                }
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#C8D8E8",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "9px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="active">Incident #1 — Active Suspects</option>
              <option value="no_candidates">Incident #2 — No Candidates</option>
            </select>
          </div>

          {/* Case file export */}
          <CaseFileExportButton
            p1Data={currentP1Data}
            p3Data={currentP3Data}
            p4Data={currentP4Data}
            p5Data={currentP5Data}
          />
        </div>
      </header>

      {/* ── MAP + OVERLAYS ─────────────────────────────────────────────────── */}
      <ClientOnly
        fallback={
          <div
            style={{
              display: "flex",
              height: "100%",
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              color: "#3A5268",
              background: "#0A0E14",
            }}
          >
            Initializing geospatial renderer…
          </div>
        }
      >
        <Suspense
          fallback={
            <div
              style={{
                display: "flex",
                height: "100%",
                width: "100%",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                color: "#3A5268",
                background: "#0A0E14",
              }}
            >
              Initializing geospatial renderer…
            </div>
          }
        >
          <MapView
            visibility={visibility}
            p1Data={currentP1Data}
            p4Data={currentP4Data}
            p5Data={currentP5Data}
            relativeHour={selectedHour}
            sarOpacity={sarOpacity}
            selectedTrackId={selectedTrackId}
            selectedTrackColor={selectedTrackColor as [number, number, number]}
            followTrack={followTrack}
            theme="dark"
            primarySuspectVesselId={primarySuspectVesselId}
            onSelectVessel={(vessel) => handleSelectVessel(vessel)}
          />
        </Suspense>

        {/* ── Left control dock ── */}
        <div style={{ position: "absolute", left: 12, top: 64, zIndex: 10 }}>
          <LayerPanel
            visibility={visibility}
            onToggle={toggleLayer}
            sarOpacity={sarOpacity}
            onChangeSarOpacity={setSarOpacity}
            vessels={currentP5Data.vessels}
            selectedTrackId={selectedTrackId}
            onSelectTrackId={setSelectedTrackId}
            selectedTrackColorId={selectedTrackColorId}
            onSelectTrackColorId={setSelectedTrackColorId}
            followTrack={followTrack}
            onToggleFollowTrack={setFollowTrack}
          />
        </div>

        {/* ── Dark vessel alert — top center ── */}
        <div
          style={{
            position: "absolute",
            top: 64,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            width: "100%",
            maxWidth: 480,
            padding: "0 16px",
            pointerEvents: "auto",
          }}
        >
          <DarkVesselAlert
            vessels={currentP5Data.vessels}
            selectedVesselId={selectedTrackId}
            onFocusVessel={(vesselId) => {
              setSelectedTrackId(vesselId);
              setExpandedVesselId(vesselId);
              setFollowTrack(true);
            }}
          />
        </div>

        {/* ── Suspect ranking — top right ── */}
        <div style={{ position: "absolute", top: 64, right: 12, zIndex: 10 }}>
          <SuspectRankingTable
            p3Data={currentP3Data}
            selectedVesselId={selectedTrackId}
            expandedVesselId={expandedVesselId ?? undefined}
            onSelectVessel={handleRankingSelect}
            onSetExpandedVessel={setExpandedVesselId}
          />
        </div>

        {/* ── Time slider — bottom right ── */}
        <div style={{ position: "absolute", bottom: 20, right: 12, zIndex: 10 }}>
          <TimeSlider
            selectedHour={selectedHour}
            onSelectHour={setSelectedHour}
          />
        </div>
      </ClientOnly>
    </div>
  );
}
