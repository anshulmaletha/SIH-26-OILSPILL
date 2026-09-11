import React, { useMemo } from "react";
import { useMission, STAGE_LABELS, STAGE_ORDER, MissionStage } from "@/lib/mission/missionState";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";

const SPEEDS: (1 | 2 | 4)[] = [1, 2, 4];
const FIRST_STAGE = STAGE_ORDER[0];
const LAST_STAGE = STAGE_ORDER[STAGE_ORDER.length - 1];

function formatZulu(date: Date | string | number): string {
  const d = new Date(date);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mon = months[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  return `${day}${mon}${yr} ${hh}:${mm}:${ss}Z`;
}

export const MissionStatusBar: React.FC = () => {
  const { state, dispatch } = useMission();

  const stageProgress = useMemo(() => {
    const STAGE_DURATION_MS = 6000;
    return Math.min(state.stageElapsedMs / STAGE_DURATION_MS, 1);
  }, [state.stageElapsedMs]);

  const isPrevDisabled =
    state.currentStage === FIRST_STAGE ||
    state.currentStage === ("STANDBY" as MissionStage);

  const isNextDisabled = state.currentStage === LAST_STAGE;

  if (!state.initiated) return null;

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "48px",
        zIndex: 30,
        backgroundColor: "#0D1117",
        borderBottom: "1px solid #1C2A38",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "16px",
        paddingRight: "16px",
        boxSizing: "border-box",
        userSelect: "none",
        boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
      }}
    >
      {/* ── LEFT SECTION: BRANDING & ACTIVE STAGE ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        {/* Tactical insignia icon */}
        <div
          style={{
            width: "26px",
            height: "26px",
            border: "1px solid #1C2A38",
            backgroundColor: "#111822",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            borderRadius: "2px",
          }}
        >
          <svg width="14" height="12" viewBox="0 0 16 14">
            <polygon points="8,2 14,12 2,12" stroke="#22D3EE" strokeWidth="1.4" fill="none" />
          </svg>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <span
            style={{
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontSize: "13px",
              fontWeight: 800,
              color: "#E2E8F0",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            SIH 26143
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "7.5px",
              color: "#5A7A94",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              lineHeight: 1,
            }}
          >
            MARITIME INTELLIGENCE
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            height: "22px",
            backgroundColor: "#1C2A38",
            marginLeft: "8px",
            marginRight: "8px",
            flexShrink: 0,
          }}
        />

        {/* Active Stage & Progress Bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10.5px",
                fontWeight: 700,
                color: "#22D3EE",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                lineHeight: 1,
              }}
            >
              {STAGE_LABELS[state.currentStage as MissionStage] ?? state.currentStage}
            </span>
          </div>

          <div
            style={{
              width: "140px",
              height: "2px",
              backgroundColor: "#1C2A38",
              borderRadius: "1px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${stageProgress * 100}%`,
                backgroundColor: "#22D3EE",
                transition: "width 0.25s linear",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── CENTER SECTION: MISSION TIME READOUT ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "7.5px",
            color: "#3A5268",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            lineHeight: 1,
            marginBottom: "2px",
          }}
        >
          MISSION TIMELINE (ZULU)
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11.5px",
            color: "#C8D8E8",
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "0.05em",
          }}
        >
          {formatZulu(state.simulatedTime)}
        </span>
      </div>

      {/* ── RIGHT SECTION: SPEED, AUTOPLAY, AND STEPPER ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
        {/* Speed buttons */}
        <div className="flex items-center border border-[#1C2A38] rounded-xs overflow-hidden">
          {SPEEDS.map((s) => {
            const isActive = state.playbackSpeed === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => dispatch({ type: "SET_SPEED", speed: s })}
                style={{
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "9px",
                  fontWeight: isActive ? 700 : 400,
                  cursor: "pointer",
                  backgroundColor: isActive ? "rgba(34, 211, 238, 0.15)" : "transparent",
                  color: isActive ? "#22D3EE" : "#5A7A94",
                  border: "none",
                  transition: "all 0.15s ease",
                  padding: 0,
                }}
              >
                {s}x
              </button>
            );
          })}
        </div>

        {/* AutoPlay toggle */}
        <button
          type="button"
          onClick={() => dispatch({ type: "TOGGLE_AUTOPLAY" })}
          style={{
            height: "26px",
            paddingLeft: "10px",
            paddingRight: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            fontWeight: 600,
            cursor: "pointer",
            borderRadius: "2px",
            backgroundColor: state.autoPlay ? "rgba(34, 211, 238, 0.12)" : "transparent",
            border: state.autoPlay ? "1px solid #22D3EE" : "1px solid #1C2A38",
            color: state.autoPlay ? "#22D3EE" : "#5A7A94",
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
          }}
        >
          {state.autoPlay ? "AUTO ▶" : "MANUAL ⏸"}
        </button>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "20px",
            backgroundColor: "#1C2A38",
            marginLeft: "4px",
            marginRight: "4px",
            flexShrink: 0,
          }}
        />

        {/* PREV button */}
        <button
          type="button"
          onClick={() => dispatch({ type: "PREV_STAGE" })}
          disabled={isPrevDisabled}
          aria-label="Previous mission stage"
          style={{
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            cursor: isPrevDisabled ? "not-allowed" : "pointer",
            borderRadius: "2px",
            backgroundColor: "#111822",
            border: "1px solid #1C2A38",
            color: isPrevDisabled ? "#2A3D4D" : "#5A7A94",
            transition: "all 0.15s ease",
            padding: 0,
            opacity: isPrevDisabled ? 0.3 : 1,
          }}
        >
          ◀
        </button>

        {/* NEXT button */}
        <button
          type="button"
          onClick={() => dispatch({ type: "NEXT_STAGE" })}
          disabled={isNextDisabled}
          aria-label="Next mission stage"
          style={{
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            cursor: isNextDisabled ? "not-allowed" : "pointer",
            borderRadius: "2px",
            backgroundColor: "#111822",
            border: isNextDisabled ? "1px solid #1C2A38" : "1px solid #22D3EE",
            color: isNextDisabled ? "#2A3D4D" : "#22D3EE",
            transition: "all 0.15s ease",
            padding: 0,
            opacity: isNextDisabled ? 0.3 : 1,
          }}
        >
          ▶
        </button>
      </div>
    </header>
  );
};

export default MissionStatusBar;
