/**
 * SIH 26143 — MissionController
 *
 * Master orchestrator for the Maritime Intelligence Platform.
 * Layout:
 *   [NavySidebar (86px)] | [Map Viewport with Floating VesselsPanel & SlickPhysicsControl] | [Optional Details Drawer]
 */

import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useCallback, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import {
  MissionProvider,
  useMission,
  type MissionStage,
} from "@/lib/mission/missionState";
import {
  generateSwarmVessels,
  type SwarmVessel,
} from "@/lib/mission/swarmData";
import { getOfflineScenario } from "@/lib/data/offlineDemoData";
import { DEFAULT_VISIBILITY, type LayerId } from "@/lib/map/config";
import type { P1Output } from "@/lib/contracts/p1";
import type { P3Output } from "@/lib/contracts/p3";
import type { P4Output } from "@/lib/contracts/p4";
import type { P5Output } from "@/lib/contracts/p5";
import { convertDetectionResponseToP1 } from "@/lib/adapters/p1Adapter";
import { convertSuspectsResponseToP3 } from "@/lib/adapters/p3Adapter";
import { convertCorridorResponseToP4 } from "@/lib/adapters/p4Adapter";
import { convertAisResponseToP5 } from "@/lib/adapters/p5Adapter";
import {
  fetchDetection,
  fetchCorridor,
  fetchSuspects,
  fetchAisTracks,
} from "@/lib/api/client";

// Layout components matching the uploaded reference UI
import { NavySidebar, type NavTabId } from "@/components/layout/NavySidebar";
import { VesselsFloatingPanel } from "@/components/layout/VesselsFloatingPanel";
import { SlickPhysicsControl } from "@/components/map/SlickPhysicsControl";
import { SuspiciousVesselTracker } from "@/components/dashboard/SuspiciousVesselTracker";
import { DEFAULT_WIND, DEFAULT_CURRENT } from "@/lib/physics/slickPhysics";

// Mission overlay components
import { StandbyScreen } from "./StandbyScreen";
import { SARPhaseOverlay } from "./SARPhaseOverlay";
import { ValidationPhaseOverlay } from "./ValidationPhaseOverlay";
import AISSwarmOverlay from "./AISSwarmOverlay";
import { BacktrackOverlay } from "./BacktrackOverlay";
import { CulpritLockOverlay } from "./CulpritLockOverlay";
import { ContainmentRoom } from "./ContainmentRoom";
import { CaseFileOverlay } from "./CaseFileOverlay";
import TelemetryTerminal from "./TelemetryTerminal";
import MissionStatusBar from "./MissionStatusBar";

const MapView = lazy(() => import("@/components/map/MapView"));

// ─── Camera choreography ─────────────────────────────────────────────────────

type CameraConfig = {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing?: number;
  duration: number;
};

const STAGE_CAMERAS: Partial<Record<MissionStage, CameraConfig>> = {
  STANDBY: {
    center: [72.0, 19.2],
    zoom: 7,
    pitch: 0,
    bearing: 0,
    duration: 1500,
  },
  SAR_ACQUISITION: {
    center: [71.855, 19.352],
    zoom: 11,
    pitch: 30,
    bearing: 0,
    duration: 2500,
  },
  VALIDATION_AUDIT: {
    center: [71.858, 19.354],
    zoom: 13,
    pitch: 45,
    bearing: 0,
    duration: 2000,
  },
  AIS_SWARM: {
    center: [72.0, 19.1],
    zoom: 8,
    pitch: 0,
    bearing: 0,
    duration: 2000,
  },
  BACKTRACK_CORRIDOR: {
    center: [71.5, 19.5],
    zoom: 9.5,
    pitch: 20,
    bearing: -10,
    duration: 2500,
  },
  CULPRIT_LOCK: {
    center: [71.2, 19.65],
    zoom: 12.5,
    pitch: 50,
    bearing: 0,
    duration: 2000,
  },
  CONTAINMENT_ROOM: {
    center: [72.3, 19.1],
    zoom: 9,
    pitch: 20,
    bearing: 0,
    duration: 2000,
  },
  CASE_FILE: {
    center: [72.0, 19.2],
    zoom: 8,
    pitch: 0,
    bearing: 0,
    duration: 1500,
  },
};

// ─── Layer visibility per stage ───────────────────────────────────────────────

function getLayerVisibility(stage: MissionStage): Record<LayerId, boolean> {
  const base = { ...DEFAULT_VISIBILITY };

  switch (stage) {
    case "STANDBY":
      return { ...base, "slick-polygon": false, "sar-raster": false, "ais-tracks": false, "h3-corridor": false };
    case "SAR_ACQUISITION":
      return { ...base, "slick-polygon": true, "sar-raster": true, "ais-tracks": false, "h3-corridor": false };
    case "VALIDATION_AUDIT":
      return { ...base, "slick-polygon": true, "sar-raster": true, "ais-tracks": false, "h3-corridor": false };
    case "AIS_SWARM":
      return { ...base, "slick-polygon": true, "sar-raster": false, "ais-tracks": true, "h3-corridor": false };
    case "BACKTRACK_CORRIDOR":
      return { ...base, "slick-polygon": true, "sar-raster": false, "ais-tracks": true, "h3-corridor": true };
    case "CULPRIT_LOCK":
      return { ...base, "slick-polygon": false, "sar-raster": false, "ais-tracks": true, "h3-corridor": true };
    case "CONTAINMENT_ROOM":
      return { ...base, "slick-polygon": true, "sar-raster": false, "ais-tracks": false, "h3-corridor": false };
    case "CASE_FILE":
      return { ...base, "slick-polygon": true, "sar-raster": false, "ais-tracks": false, "h3-corridor": false };
    default:
      return base;
  }
}

// ─── SAR opacity per stage ────────────────────────────────────────────────────

function getSarOpacity(stage: MissionStage, elapsedMs: number): number {
  switch (stage) {
    case "SAR_ACQUISITION":
      return Math.min(0.65, (elapsedMs / 3000) * 0.65);
    case "VALIDATION_AUDIT":
      return 0.65;
    case "AIS_SWARM":
      return 0.3;
    default:
      return 0.2;
  }
}

// ─── Inner controller (inside provider) ──────────────────────────────────────

function MissionControllerInner() {
  const { state, dispatch } = useMission();
  const { currentStage } = state;

  const mapRef = useRef<MapLibreMap | null>(null);
  const prevStageRef = useRef<MissionStage | null>(null);

  const [p1Data, setP1Data] = useState<P1Output>(() => getOfflineScenario(state.scenario).p1Data);
  const [p3Data, setP3Data] = useState<P3Output>(() => getOfflineScenario(state.scenario).p3Data);
  const [p4Data, setP4Data] = useState<P4Output>(() => getOfflineScenario(state.scenario).p4Data);
  const [p5Data, setP5Data] = useState<P5Output>(() => getOfflineScenario(state.scenario).p5Data);

  const [activeNavTab, setActiveNavTab] = useState<NavTabId>('vessels');
  const [showVesselsPanel, setShowVesselsPanel] = useState<boolean>(true);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState<boolean>(false);
  const [selectedVessel, setSelectedVessel] = useState<any>(null);

  // Dynamic physics & forcing state
  const [customHour, setCustomHour] = useState<number>(0);
  const [windSpeed, setWindSpeed] = useState<number>(DEFAULT_WIND.speedMs);
  const [windHeading, setWindHeading] = useState<number>(DEFAULT_WIND.headingDeg);
  const [currentSpeed, setCurrentSpeed] = useState<number>(DEFAULT_CURRENT.speedMs);
  const [currentHeading, setCurrentHeading] = useState<number>(DEFAULT_CURRENT.headingDeg);

  useEffect(() => {
    // 1. Immediately sync baseline offline cache for the scenario
    const offline = getOfflineScenario(state.scenario);
    setP1Data(offline.p1Data);
    setP3Data(offline.p3Data);
    setP4Data(offline.p4Data);
    setP5Data(offline.p5Data);

    // 2. Concurrently fetch live data from Python backend
    let mounted = true;

    fetchDetection(state.scenario)
      .then((det) => {
        if (mounted) setP1Data(convertDetectionResponseToP1(det));
      })
      .catch((err) => console.warn("API fetchDetection error:", err));

    fetchCorridor()
      .then((corr) => {
        if (mounted) setP4Data(convertCorridorResponseToP4(corr));
      })
      .catch((err) => console.warn("API fetchCorridor error:", err));

    fetchSuspects(state.scenario)
      .then((susp) => {
        if (mounted) setP3Data(convertSuspectsResponseToP3(susp));
      })
      .catch((err) => console.warn("API fetchSuspects error:", err));

    if (state.scenario !== "no_candidates") {
      fetchAisTracks()
        .then((ais) => {
          if (mounted) setP5Data(convertAisResponseToP5(ais));
        })
        .catch((err) => console.warn("API fetchAisTracks error:", err));
    }

    return () => {
      mounted = false;
    };
  }, [state.scenario]);

  // Trigger camera flyTo & automatic time progression on stage change
  useEffect(() => {
    // 1. Stage-driven relative hour progression (backtrack -> culprit lock -> forward containment forecast)
    switch (currentStage) {
      case "STANDBY":
      case "SAR_ACQUISITION":
      case "VALIDATION_AUDIT":
      case "AIS_SWARM":
        setCustomHour(0); // T0 SAR Detection
        break;
      case "BACKTRACK_CORRIDOR":
        setCustomHour(-18); // Backtrack into past towards origin
        break;
      case "CULPRIT_LOCK":
        setCustomHour(-9); // Suspect transponder blackout intersection
        break;
      case "CONTAINMENT_ROOM":
        setCustomHour(12); // Forward forecast (+12h) for containment & boom ops
        break;
      case "CASE_FILE":
        setCustomHour(24); // Complete forward forecast (+24h) case file
        break;
    }

    // 2. Camera choreography flyTo
    if (prevStageRef.current === currentStage) return;
    prevStageRef.current = currentStage;

    const cam = STAGE_CAMERAS[currentStage];
    if (!cam || !mapRef.current) return;

    const tid = setTimeout(() => {
      mapRef.current?.flyTo({
        center: cam.center,
        zoom: cam.zoom,
        pitch: cam.pitch,
        bearing: cam.bearing ?? 0,
        duration: cam.duration,
        essential: true,
      });
    }, 200);

    return () => clearTimeout(tid);
  }, [currentStage]);

  // Derive map display options from current stage
  const visibility = getLayerVisibility(currentStage);
  const sarOpacity = getSarOpacity(currentStage, state.stageElapsedMs);

  // Primary suspect from scored suspect list
  const primarySuspect = p3Data.suspects.find((s) => s.isPrimarySuspect)?.vesselId;

  const selectedTrackId =
    currentStage === "CULPRIT_LOCK"
      ? (primarySuspect ?? "none")
      : (selectedVessel?.id ?? "all");

  // Swarm vessels for full AIS maritime tracking & interactivity
  const swarmVessels = generateSwarmVessels().map((v) => {
    if (state.scenario === "no_candidates") {
      return { ...v, isCandidate: false, suspicionLevel: "none" as const };
    }
    return v;
  });

  // Determine the "swarm phase" for color assignment
  const swarmPhase =
    currentStage === "BACKTRACK_CORRIDOR" ? "backtrack" : "swarm";

  // Relative hour for the map (driven directly by custom physics control, strictly clamped [-24, 24])
  const relativeHour = Math.max(-24, Math.min(24, customHour));

  // Map ref callback
  const handleMapReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
    const cam = STAGE_CAMERAS[currentStage] ?? STAGE_CAMERAS.STANDBY!;
    map.flyTo({
      center: cam.center,
      zoom: cam.zoom,
      pitch: cam.pitch,
      bearing: cam.bearing ?? 0,
      duration: cam.duration,
      essential: true,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle vessel click from floating panel or map
  const handleSelectVesselFromPanel = (vessel: any) => {
    if (!vessel) return;
    setSelectedVessel(vessel);
    const pos =
      vessel.position ||
      (vessel.path && vessel.path[vessel.path.length - 1]) ||
      (vessel.pings && vessel.pings[0]?.position);
    if (mapRef.current && pos) {
      mapRef.current.flyTo({
        center: pos,
        zoom: 11.5,
        duration: 1500,
        essential: true,
      });
    }
  };

  const handleOpenDetails = (vessel: any) => {
    setSelectedVessel(vessel);
    setShowDetailsDrawer(true);
  };

  return (
    <div
      className="dark"
      style={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        userSelect: "none",
        background: "#080C14",
        color: "#EDF2F7",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <h1 className="sr-only">Maritime Intelligence — Vessel Fleet & Oil Spill Detection</h1>

      {/* ── 1. LEFT ROYAL NAVY SIDEBAR (86px) ── */}
      <NavySidebar
        activeTab={activeNavTab}
        onTabChange={(tab) => {
          setActiveNavTab(tab);
          if (tab === 'vessels') {
            setShowVesselsPanel(true);
          } else if (tab === 'map') {
            setShowVesselsPanel(false);
          }
        }}
      />

      {/* ── 2. CENTER MAP VIEWPORT ── */}
      <main
        style={{
          flex: 1,
          height: "100%",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#06090E",
        }}
      >
        {/* Floating White Vessels Card (matching reference image) */}
        {showVesselsPanel && (
          <VesselsFloatingPanel
            swarmVessels={swarmVessels}
            selectedVesselId={selectedVessel?.id}
            onSelectVessel={handleSelectVesselFromPanel}
            onOpenDetails={handleOpenDetails}
            onClose={() => setShowVesselsPanel(false)}
          />
        )}

        {/* Quick button to restore Vessels Panel if closed */}
        {!showVesselsPanel && (
          <button
            onClick={() => setShowVesselsPanel(true)}
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              zIndex: 35,
              backgroundColor: '#FFFFFF',
              color: '#072454',
              border: 'none',
              borderRadius: 12,
              padding: '10px 18px',
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            }}
          >
            🚢 Open Vessels List
          </button>
        )}

        {/* Floating Dynamic Oil Slick Physics HUD */}
        <SlickPhysicsControl
          relativeHour={relativeHour}
          onHourChange={(h) => setCustomHour(h)}
          windSpeed={windSpeed}
          onWindSpeedChange={(s) => setWindSpeed(s)}
          windHeading={windHeading}
          onWindHeadingChange={(hd) => setWindHeading(hd)}
          currentSpeed={currentSpeed}
          onCurrentSpeedChange={(cs) => setCurrentSpeed(cs)}
          currentHeading={currentHeading}
          onCurrentHeadingChange={(ch) => setCurrentHeading(ch)}
        />

        {/* Floating Mission Control HUD Status Bar */}
        {state.initiated && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 25 }}>
            <MissionStatusBar />
          </div>
        )}

        {/* Mapbox / Deck.gl Viewport */}
        <ClientOnly fallback={<MapLoadFallback />}>
          <Suspense fallback={<MapLoadFallback />}>
            <MapView
              visibility={visibility}
              p1Data={p1Data}
              p4Data={p4Data}
              p5Data={p5Data}
              relativeHour={relativeHour}
              windSpeedMs={windSpeed}
              windHeadingDeg={windHeading}
              currentSpeedMs={currentSpeed}
              currentHeadingDeg={currentHeading}
              sarOpacity={sarOpacity}
              selectedTrackId={selectedTrackId}
              selectedTrackColor={[56, 189, 248]}
              followTrack={false}
              theme="dark"
              primarySuspectVesselId={primarySuspect}
              onSelectVessel={handleSelectVesselFromPanel}
              missionStage={currentStage}
              swarmVessels={swarmVessels}
              swarmPhase={swarmPhase}
              onMapReady={handleMapReady}
            />
          </Suspense>

          {/* ── Phase overlays ── */}
          <StandbyScreen />
          <SARPhaseOverlay />
          <ValidationPhaseOverlay />
          <AISSwarmOverlay />
          <BacktrackOverlay />
          <CulpritLockOverlay />
          <ContainmentRoom />
          <CaseFileOverlay />

          {/* ── Telemetry terminal ── */}
          <TelemetryTerminal />
        </ClientOnly>
      </main>

      {/* ── 3. RIGHT DETAILS DRAWER (Optional on Details click) ── */}
      {showDetailsDrawer && (
        <SuspiciousVesselTracker
          onSelectVesselOnMap={(coords) => {
            if (mapRef.current) {
              mapRef.current.flyTo({ center: coords, zoom: 11.5, duration: 1500, essential: true });
            }
          }}
          onClose={() => setShowDetailsDrawer(false)}
        />
      )}
    </div>
  );
}

function MapLoadFallback() {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "11px",
        color: "#5C7A94",
        background: "#080C14",
      }}
    >
      Initializing geospatial renderer…
    </div>
  );
}

// ─── Public export — wrapped in provider ─────────────────────────────────────

export function MissionController() {
  return (
    <MissionProvider>
      <MissionControllerInner />
    </MissionProvider>
  );
}

export default MissionController;
