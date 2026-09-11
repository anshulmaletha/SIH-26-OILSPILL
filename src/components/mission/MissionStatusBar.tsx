import React, { useMemo } from 'react';
import { useMission, STAGE_LABELS, STAGE_ORDER, MissionStage } from '@/lib/mission/missionState';

const SPEEDS: (1 | 2 | 4)[] = [1, 2, 4];

const FIRST_STAGE = STAGE_ORDER[0];
const LAST_STAGE = STAGE_ORDER[STAGE_ORDER.length - 1];

function formatZulu(date: Date | string | number): string {
  const d = new Date(date);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const mon = months[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  return `${day}${mon}${yr} ${hh}:${mm}:${ss}Z`;
}

const MissionStatusBar: React.FC = () => {
  const { state, dispatch } = useMission();

  const currentStageIndex = STAGE_ORDER.indexOf(state.currentStage as MissionStage);
  const stageProgress = useMemo(() => {
    // Compute progress 0-1 from stageElapsedMs assuming each stage lasts ~6000ms for visual
    const STAGE_DURATION_MS = 6000;
    return Math.min(state.stageElapsedMs / STAGE_DURATION_MS, 1);
  }, [state.stageElapsedMs]);

  const isPrevDisabled =
    state.currentStage === FIRST_STAGE ||
    state.currentStage === 'STANDBY' as MissionStage;

  const isNextDisabled = state.currentStage === LAST_STAGE;

  if (!state.initiated) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '52px',
        zIndex: 25,
        backgroundColor: '#0D1117',
        borderBottom: '1px solid #1C2A38',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '16px',
        paddingRight: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* LEFT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {/* Triangle icon */}
        <div
          style={{
            width: '28px',
            height: '28px',
            border: '1px solid #1C2A38',
            backgroundColor: '#111822',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: '2px',
          }}
        >
          <svg width="16" height="14" viewBox="0 0 16 14">
            <polygon
              points="8,2 14,12 2,12"
              stroke="#22D3EE"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </div>

        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: 800,
              color: '#E2E8F0',
              lineHeight: 1,
            }}
          >
            SIH 26143
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '8px',
              color: '#3A5268',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              lineHeight: 1,
            }}
          >
            MARITIME INTELLIGENCE PLATFORM
          </span>
        </div>

        {/* Vertical separator */}
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: '#1C2A38',
            marginLeft: '12px',
            marginRight: '12px',
            flexShrink: 0,
          }}
        />

        {/* Stage label + progress bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: '#22D3EE',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              lineHeight: 1,
            }}
          >
            {STAGE_LABELS[state.currentStage as MissionStage] ?? state.currentStage}
          </span>
          {/* Progress bar */}
          <div
            style={{
              width: '120px',
              height: '2px',
              backgroundColor: '#1C2A38',
              borderRadius: '1px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${stageProgress * 100}%`,
                backgroundColor: '#22D3EE',
                transition: 'width 0.3s linear',
              }}
            />
          </div>
        </div>

        {/* Vertical separator */}
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: '#1C2A38',
            marginLeft: '8px',
            marginRight: '8px',
            flexShrink: 0,
          }}
        />

        {/* Scenario Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '8px',
              color: '#5A7A94',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              lineHeight: 1,
            }}
          >
            SCENARIO
          </span>
          <select
            value={state.scenario}
            onChange={(e) => dispatch({ type: 'SET_SCENARIO', scenario: e.target.value as any })}
            style={{
              backgroundColor: '#111822',
              color: '#22D3EE',
              border: '1px solid #1C2A38',
              borderRadius: '2px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              padding: '2px 6px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="active">Mumbai Offshore (Attributed)</option>
            <option value="rejected_lookalike">Look-Alike Rejection Test</option>
            <option value="no_candidates">Uncorrelated Sector (Null-Result)</option>
          </select>
        </div>
      </div>

      {/* CENTER SECTION */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '8px',
            color: '#3A5268',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}
        >
          MISSION CLOCK
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            color: '#C8D8E8',
            lineHeight: 1,
            letterSpacing: '0.05em',
          }}
        >
          {formatZulu(state.simulatedTime)}
        </span>
      </div>

      {/* RIGHT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Speed buttons */}
        {SPEEDS.map((s) => {
          const isActive = state.playbackSpeed === s;
          return (
            <button
              key={s}
              onClick={() => dispatch({ type: 'SET_SPEED', speed: s })}
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                cursor: 'pointer',
                borderRadius: '2px',
                backgroundColor: isActive ? 'rgba(34,211,238,0.08)' : 'transparent',
                border: isActive ? '1px solid #22D3EE' : '1px solid #1C2A38',
                color: isActive ? '#22D3EE' : '#3A5268',
                transition: 'all 0.15s ease',
                padding: 0,
              }}
            >
              {s}x
            </button>
          );
        })}

        {/* AutoPlay toggle */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_AUTOPLAY' })}
          style={{
            height: '28px',
            paddingLeft: '8px',
            paddingRight: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            cursor: 'pointer',
            borderRadius: '2px',
            backgroundColor: state.autoPlay ? 'rgba(34,211,238,0.08)' : 'transparent',
            border: state.autoPlay ? '1px solid #22D3EE' : '1px solid #1C2A38',
            color: state.autoPlay ? '#22D3EE' : '#5A7A94',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {state.autoPlay ? 'AUTO ▶' : 'MANUAL'}
        </button>

        {/* Separator */}
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: '#1C2A38',
            marginLeft: '2px',
            marginRight: '2px',
            flexShrink: 0,
          }}
        />

        {/* PREV button */}
        <button
          onClick={() => dispatch({ type: 'PREV_STAGE' })}
          disabled={isPrevDisabled}
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
            borderRadius: '2px',
            backgroundColor: '#111822',
            border: '1px solid #1C2A38',
            color: isPrevDisabled ? '#1C2A38' : '#5A7A94',
            transition: 'all 0.15s ease',
            padding: 0,
            opacity: isPrevDisabled ? 0.4 : 1,
          }}
        >
          ◀
        </button>

        {/* NEXT button */}
        <button
          onClick={() => dispatch({ type: 'NEXT_STAGE' })}
          disabled={isNextDisabled}
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            cursor: isNextDisabled ? 'not-allowed' : 'pointer',
            borderRadius: '2px',
            backgroundColor: '#111822',
            border: isNextDisabled ? '1px solid #1C2A38' : '1px solid #22D3EE',
            color: isNextDisabled ? '#1C2A38' : '#22D3EE',
            transition: 'all 0.15s ease',
            padding: 0,
            opacity: isNextDisabled ? 0.4 : 1,
          }}
        >
          ▶
        </button>
      </div>
    </div>
  );
};

export default MissionStatusBar;
