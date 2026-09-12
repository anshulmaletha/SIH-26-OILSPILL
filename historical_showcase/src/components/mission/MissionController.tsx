/**
 * SIH 26143 — MissionController
 *
 * Master orchestrator for the 7-phase cinematic attribution experience.
 * - Wraps MapView (never unmounts it)
 * - Issues camera flyTo commands on stage transitions
 * - Renders phase-appropriate overlays on top of the map
 * - Manages layer opacity/visibility per stage
 */

import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useCallback, useState, useMemo } from "react";
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

function getStageCameras(scenario: string): Partial<Record<MissionStage, CameraConfig>> {
  const isKerala = scenario === "kerala";
  
  if (isKerala) {
    // Normal north-up top-down view centered on the validation bounding box (~9.3N, 76.4E)
    // with 0 pitch/bearing explicitly to avoid weird interpolations from Mumbai 3D views.
    return {
      STANDBY: { center: [76.4, 9.3], zoom: 7.5, pitch: 0, bearing: 0, duration: 1500 },
      SAR_ACQUISITION: { center: [76.4, 9.3], zoom: 8, pitch: 0, bearing: 0, duration: 2500 },
      VALIDATION_AUDIT: { center: [76.4, 9.3], zoom: 8, pitch: 0, bearing: 0, duration: 2000 },
      AIS_SWARM: { center: [76.4, 9.3], zoom: 8, pitch: 0, bearing: 0, duration: 2000 },
      BACKTRACK_CORRIDOR: { center: [76.4, 9.3], zoom: 8, pitch: 0, bearing: 0, duration: 2500 },
      CULPRIT_LOCK: { center: [76.136, 9.3125], zoom: 10, pitch: 0, bearing: 0, duration: 2000 },
      CONTAINMENT_ROOM: { center: [76.4, 9.3], zoom: 8, pitch: 0, bearing: 0, duration: 2000 },
      CASE_FILE: { center: [76.4, 9.3], zoom: 7.5, pitch: 0, bearing: 0, duration: 1500 },
    };
  }

  return {
    STANDBY: { center: [72.0, 19.2], zoom: 7, pitch: 0, bearing: 0, duration: 1500 },
    SAR_ACQUISITION: { center: [71.855, 19.352], zoom: 11, pitch: 30, bearing: 0, duration: 2500 },
    VALIDATION_AUDIT: { center: [71.858, 19.354], zoom: 13, pitch: 45, bearing: 0, duration: 2000 },
    AIS_SWARM: { center: [72.0, 19.1], zoom: 8, pitch: 0, bearing: 0, duration: 2000 },
    BACKTRACK_CORRIDOR: { center: [71.5, 19.5], zoom: 9.5, pitch: 20, bearing: -10, duration: 2500 },
    CULPRIT_LOCK: { center: [71.2, 19.65], zoom: 12.5, pitch: 50, bearing: 0, duration: 2000 },
    CONTAINMENT_ROOM: { center: [72.3, 19.1], zoom: 9, pitch: 20, bearing: 0, duration: 2000 },
    CASE_FILE: { center: [72.0, 19.2], zoom: 8, pitch: 0, bearing: 0, duration: 1500 },
  };
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

    fetchCorridor(state.scenario)
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
      fetchAisTracks(state.scenario)
        .then((ais) => {
          if (mounted) setP5Data(convertAisResponseToP5(ais));
        })
        .catch((err) => console.warn("API fetchAisTracks error:", err));
    }

    return () => {
      mounted = false;
    };
  }, [state.scenario]);

  const prevScenarioRef = useRef<string | null>(null);

  // Trigger camera flyTo on stage or scenario change
  const prevCamRef = useRef<CameraConfig | null>(null);

  useEffect(() => {
    if (prevStageRef.current === currentStage && prevScenarioRef.current === state.scenario) return;
    prevStageRef.current = currentStage;
    prevScenarioRef.current = state.scenario;

    const cam = getStageCameras(state.scenario)[currentStage];
    if (!cam || !mapRef.current) return;

    // Skip if identical to previous camera config (fixes redundant zooming)
    const pCam = prevCamRef.current;
    if (
      pCam &&
      pCam.center[0] === cam.center[0] &&
      pCam.center[1] === cam.center[1] &&
      pCam.zoom === cam.zoom &&
      pCam.pitch === cam.pitch &&
      pCam.bearing === cam.bearing
    ) {
      return;
    }
    prevCamRef.current = cam;

    if (state.scenario === "kerala") {
      // Execute only once after flyTo ends to prevent spam
      mapRef.current.once("moveend", () => {
        console.log(`[Regression Check] Kerala Scenario Camera Settled => Center: ${cam.center}, Zoom: ${cam.zoom}, Bearing: ${cam.bearing}, Pitch: ${cam.pitch}`);
      });
    }

    // Small delay to let the map settle before flying
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
  }, [currentStage, state.scenario]);

  // Derive map display options from current stage
  const isKerala = state.scenario === "kerala";
  const sarSlickVisible = isKerala 
    ? (currentStage !== "STANDBY" && (currentStage !== "SAR_ACQUISITION" || state.stageElapsedMs > 3500)) 
    : currentStage !== "STANDBY";

  const visibility = useMemo(() => {
    const base = { ...DEFAULT_VISIBILITY };
    switch (currentStage) {
      case "STANDBY":
        return { ...base, "slick-polygon": false, "sar-raster": false, "ais-tracks": false, "h3-corridor": false };
      case "SAR_ACQUISITION":
        return { ...base, "slick-polygon": sarSlickVisible, "sar-raster": true, "ais-tracks": false, "h3-corridor": false };
      case "VALIDATION_AUDIT":
        return { ...base, "slick-polygon": true, "sar-raster": true, "ais-tracks": false, "h3-corridor": false };
      case "AIS_SWARM":
        return { ...base, "slick-polygon": true, "sar-raster": false, "ais-tracks": true, "h3-corridor": isKerala };
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
  }, [currentStage, sarSlickVisible]);

  const sarOpacity = getSarOpacity(currentStage, state.stageElapsedMs);

  // Primary suspect from scored suspect list
  const primarySuspect = p3Data.suspects.find((s) => s.isPrimarySuspect)?.vesselId;

  // In backtrack stage, only show candidates at full opacity; in culprit lock, isolate primary suspect
  const selectedTrackId =
    currentStage === "CULPRIT_LOCK"
      ? (primarySuspect ?? "none")
      : "all";

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

  // Relative hour for the map
  // For Kerala, AIS_SWARM is "Bi-Directional Drift Modeling", where we backtrack to -48h.
  // We use a sweep down to -48 over 5000ms.
  const relativeHour =
    state.scenario === "kerala" && currentStage === "AIS_SWARM"
      ? Math.round(-48 * Math.min(1, state.stageElapsedMs / 5000))
      : state.scenario === "kerala" && (currentStage === "BACKTRACK_CORRIDOR" || currentStage === "CULPRIT_LOCK" || currentStage === "CASE_FILE")
        ? -48
        : currentStage === "BACKTRACK_CORRIDOR"
          ? Math.round(-12 * Math.min(1, state.stageElapsedMs / 5000))
          : currentStage === "CULPRIT_LOCK"
            ? -9
            : 0;

  // Map ref callback so we can issue flyTo
  const handleMapReady = useCallback((map: MapLibreMap) => {
    mapRef.current = map;
    // Initial fly on first mount
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

  return (
    <div
      className="dark"
      style={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        userSelect: "none",
        background: "#05070A",
        color: "#C8D8E8",
      }}
    >
      <h1 className="sr-only">SIH 26143 — Maritime Situation Dashboard</h1>

      {/* ── Status bar (shown after initiation, replaces old header) ── */}
      <MissionStatusBar />

      {/* ── Map + all overlays ── */}
      <ClientOnly
        fallback={
          <MapLoadFallback />
        }
      >
        <Suspense fallback={<MapLoadFallback />}>
          <MapView
            visibility={visibility}
            p1Data={p1Data}
            p4Data={p4Data}
            p5Data={p5Data}
            relativeHour={relativeHour}
            sarOpacity={sarOpacity}
            selectedTrackId={selectedTrackId}
            selectedTrackColor={[34, 211, 238]}
            followTrack={currentStage === "CULPRIT_LOCK"}
            theme="dark"
            primarySuspectVesselId={primarySuspect}
            onSelectVessel={() => {}}
            missionStage={currentStage}
            stageElapsedMs={state.stageElapsedMs}
            scenario={state.scenario}
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
        <CaseFileOverlay p1Data={p1Data} p3Data={p3Data} />

        {/* ── Telemetry terminal (always visible after initiation) ── */}
        <TelemetryTerminal />
      </ClientOnly>
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
        color: "#3A5268",
        background: "#05070A",
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
