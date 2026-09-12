/**
 * SIH 26143 — Mission State Machine
 *
 * Drives the 7-phase cinematic attribution experience.
 * Single source of truth for which phase is active, elapsed time,
 * autoplay, and playback speed.
 */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
  type Dispatch,
} from "react";

// ─── Stage Definition ────────────────────────────────────────────────────────

export type MissionStage =
  | "STANDBY"            // Waiting for operator to hit Start
  | "SAR_ACQUISITION"    // Satellite sweep + anomaly detection
  | "VALIDATION_AUDIT"   // Wind/algae lookalike discrimination
  | "AIS_SWARM"          // 400-vessel maritime traffic ingestion
  | "BACKTRACK_CORRIDOR" // Backward drift simulation, suspect narrowing
  | "CULPRIT_LOCK"       // Multi-factor scoring + culprit identification
  | "CONTAINMENT_ROOM"   // Forward drift + response operations (side panel)
  | "CASE_FILE";         // Forensic dossier generation

export const STAGE_ORDER: MissionStage[] = [
  "STANDBY",
  "SAR_ACQUISITION",
  "VALIDATION_AUDIT",
  "AIS_SWARM",
  "BACKTRACK_CORRIDOR",
  "CULPRIT_LOCK",
  "CONTAINMENT_ROOM",
  "CASE_FILE",
];

/** How long each stage auto-plays before advancing (ms). 0 = manual only. */
export const STAGE_DURATIONS_MS: Record<MissionStage, number> = {
  STANDBY: 0,
  SAR_ACQUISITION: 6000,
  VALIDATION_AUDIT: 8000,
  AIS_SWARM: 5000,
  BACKTRACK_CORRIDOR: 8000,
  CULPRIT_LOCK: 7000,
  CONTAINMENT_ROOM: 0,
  CASE_FILE: 0,
};

export const STAGE_LABELS: Record<MissionStage, string> = {
  STANDBY: "STANDBY",
  SAR_ACQUISITION: "01 · SAR ACQUISITION",
  VALIDATION_AUDIT: "02 · VALIDATION AUDIT",
  AIS_SWARM: "03 · AIS INGESTION",
  BACKTRACK_CORRIDOR: "04 · BACKTRACK CORRIDOR",
  CULPRIT_LOCK: "05 · CULPRIT LOCK",
  CONTAINMENT_ROOM: "06 · CONTAINMENT OPS",
  CASE_FILE: "07 · CASE FILE",
};

// ─── State & Actions ─────────────────────────────────────────────────────────

export type MissionScenario = "active" | "rejected_lookalike" | "no_candidates" | "kerala";

export interface MissionState {
  currentStage: MissionStage;
  autoPlay: boolean;
  playbackSpeed: 1 | 2 | 4;
  /** Elapsed ms since the current stage started */
  stageElapsedMs: number;
  /** Simulated mission time string, e.g. "2026-05-15T06:14:22Z" */
  simulatedTime: string;
  /** Whether the mission has been initiated (Start was clicked) */
  initiated: boolean;
  /** Active demonstration scenario */
  scenario: MissionScenario;
}

export type MissionAction =
  | { type: "INITIATE" }
  | { type: "SET_STAGE"; stage: MissionStage }
  | { type: "NEXT_STAGE" }
  | { type: "PREV_STAGE" }
  | { type: "TOGGLE_AUTOPLAY" }
  | { type: "SET_SPEED"; speed: 1 | 2 | 4 }
  | { type: "SET_SCENARIO"; scenario: MissionScenario }
  | { type: "RESET_MISSION" }
  | { type: "TICK"; deltaMs: number };

const MISSION_START_ISO = "2026-05-15T06:00:00Z";

function advanceSimulatedTime(current: string, deltaMs: number): string {
  const ms = new Date(current).getTime() + deltaMs;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function getStageIndex(stage: MissionStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function reducer(state: MissionState, action: MissionAction): MissionState {
  switch (action.type) {
    case "INITIATE":
      return {
        ...state,
        initiated: true,
        currentStage: "SAR_ACQUISITION",
        stageElapsedMs: 0,
      };

    case "SET_STAGE":
      return {
        ...state,
        currentStage: action.stage,
        stageElapsedMs: 0,
      };

    case "SET_SCENARIO":
      return {
        ...state,
        scenario: action.scenario,
        currentStage: "SAR_ACQUISITION",
        stageElapsedMs: 0,
        initiated: true,
        autoPlay: true,
      };

    case "RESET_MISSION":
      return {
        ...state,
        currentStage: "STANDBY",
        stageElapsedMs: 0,
        initiated: false,
        autoPlay: false,
      };

    case "NEXT_STAGE": {
      const idx = getStageIndex(state.currentStage);
      const next = STAGE_ORDER[idx + 1];
      if (!next) return state;
      return {
        ...state,
        currentStage: next,
        stageElapsedMs: 0,
      };
    }

    case "PREV_STAGE": {
      const idx = getStageIndex(state.currentStage);
      const prev = STAGE_ORDER[idx - 1];
      if (!prev) return state;
      return {
        ...state,
        currentStage: prev,
        stageElapsedMs: 0,
      };
    }

    case "TOGGLE_AUTOPLAY":
      return { ...state, autoPlay: !state.autoPlay };

    case "SET_SPEED":
      return { ...state, playbackSpeed: action.speed };

    case "TICK": {
      const scaled = action.deltaMs * state.playbackSpeed;
      const newElapsed = state.stageElapsedMs + scaled;
      const newTime = advanceSimulatedTime(state.simulatedTime, scaled);
      const duration = STAGE_DURATIONS_MS[state.currentStage];

      // Auto-advance if elapsed time exceeds stage duration (and autoplay is on)
      if (state.autoPlay && duration > 0 && newElapsed >= duration) {
        const idx = getStageIndex(state.currentStage);
        const next = STAGE_ORDER[idx + 1];
        if (next) {
          return {
            ...state,
            currentStage: next,
            stageElapsedMs: 0,
            simulatedTime: newTime,
          };
        }
      }

      return {
        ...state,
        stageElapsedMs: newElapsed,
        simulatedTime: newTime,
      };
    }

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface MissionContextValue {
  state: MissionState;
  dispatch: Dispatch<MissionAction>;
  /** Progress (0–1) through the current stage duration, for progress bars */
  stageProgress: number;
}

const MissionContext = createContext<MissionContextValue | null>(null);

export function MissionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    currentStage: "STANDBY",
    autoPlay: true,
    playbackSpeed: 1,
    stageElapsedMs: 0,
    simulatedTime: MISSION_START_ISO,
    initiated: false,
    scenario: "active",
  });

  // Tick loop: 16ms intervals (~60fps)
  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state.initiated) return;

    const tick = (now: number) => {
      const delta = lastTickRef.current ? now - lastTickRef.current : 16;
      lastTickRef.current = now;
      dispatch({ type: "TICK", deltaMs: Math.min(delta, 100) });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    };
  }, [state.initiated]);

  const duration = STAGE_DURATIONS_MS[state.currentStage];
  const stageProgress = duration > 0 ? Math.min(1, state.stageElapsedMs / duration) : 0;

  return (
    <MissionContext.Provider value={{ state, dispatch, stageProgress }}>
      {children}
    </MissionContext.Provider>
  );
}

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error("useMission must be used within MissionProvider");
  return ctx;
}
