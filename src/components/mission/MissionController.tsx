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

  useEffect(() => {
    const offline = getOfflineScenario(state.scenario);
    setP1Data(offline.p1Data);
    setP3Data(offline.p3Data);
    setP4Data(offline.p4Data);
    setP5Data(offline.p5Data);

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

  // Trigger camera flyTo on stage change
  useEffect(() => {
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
  const primarySuspect = p3Data.suspects.find((s) => s.isPrimarySuspect)?.vesselId || p3Data.suspects[0]?.vesselId;

  // In backtrack stage, only show candidates at full opacity; in culprit lock, isolate primary suspect
  const selectedTrackId =
    currentStage === "CULPRIT_LOCK"
      ? (primarySuspect ?? "none")
      : "all";

  // Swarm vessels generated once & memoized so all vessels are present & interactive across all stages
  const swarmVessels = useMemo(() => {
    return generateSwarmVessels().map((v) => {
      if (state.scenario === "no_candidates") {
        return { ...v, isCandidate: false, suspicionLevel: "none" as const };
      }
      return v;
    });
  }, [state.scenario]);

  // Determine the "swarm phase" for color assignment
  const swarmPhase =
    currentStage === "BACKTRACK_CORRIDOR" ? "backtrack" : "swarm";

  // Relative hour for the map
  const relativeHour =
    currentStage === "BACKTRACK_CORRIDOR"
      ? Math.round(-12 * Math.min(1, state.stageElapsedMs / 5000))
      : currentStage === "CULPRIT_LOCK"
        ? -9
        : 0;

  // Map ref callback so we can issue flyTo
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
            followTrack={false}
            theme="dark"
            primarySuspectVesselId={primarySuspect}
            onSelectVessel={() => {}}
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
