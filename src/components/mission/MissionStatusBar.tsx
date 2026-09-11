import React, { useMemo } from 'react';
import { useMission, STAGE_LABELS, STAGE_ORDER, MissionStage } from '@/lib/mission/missionState';
import { T } from '@/components/ui/PanelKit';

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

export interface MissionStatusBarProps {
  relativeHour?: number;
}

const MissionStatusBar: React.FC<MissionStatusBarProps> = ({ relativeHour }) => {
  const { state, dispatch } = useMission();

  // Baseline SAR Detection timestamp: 15 MAY 2026 06:00:00Z
  const T0_TIMESTAMP = useMemo(() => new Date('2026-05-15T06:00:00Z').getTime(), []);
  const activeZuluTimestamp = useMemo(() => {
    if (relativeHour === undefined) return state.simulatedTime;
    return T0_TIMESTAMP + relativeHour * 3600 * 1000;
  }, [relativeHour, state.simulatedTime, T0_TIMESTAMP]);

  const currentStageIndex = STAGE_ORDER.indexOf(state.currentStage as MissionStage);
  const stageProgress = useMemo(() => {
    const STAGE_DURATION_MS = 6000;
    return Math.min(state.stageElapsedMs / STAGE_DURATION_MS, 1);
  }, [state.stageElapsedMs]);

  const isPrevDisabled =
    state.currentStage === FIRST_STAGE ||
    state.currentStage === 'STANDBY' as MissionStage;

  const isNextDisabled = state.currentStage === LAST_STAGE;

  if (!state.initiated) return null;

  const stageNum = Math.max(0, currentStageIndex);
  const totalStages = STAGE_ORDER.length - 1; // exclude STANDBY

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        zIndex: 25,
        backgroundColor: T.bgPanel,
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '16px',
        paddingRight: '16px',
        boxSizing: 'border-box',
      }}
    >
      {/* LEFT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {/* Logo mark */}
        <div
          style={{
            width: '30px',
            height: '30px',
            border: `1px solid ${T.border}`,
            backgroundColor: T.bgElevated,
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
              stroke={T.sky}
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </div>

        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{
              fontFamily: T.fontSans,
              fontSize: '13px',
              fontWeight: 700,
              color: T.brightText,
              lineHeight: 1,
            }}
          >
            SIH 26143
          </span>
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: '9px',
              color: T.dimText,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              lineHeight: 1,
            }}
          >
            MARITIME INTELLIGENCE
          </span>
        </div>

        {/* Vertical separator */}
        <div style={{ width: '1px', height: '26px', backgroundColor: T.border, flexShrink: 0 }} />

        {/* Stage label + progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: '11px',
                color: T.sky,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                lineHeight: 1,
              }}
            >
              {STAGE_LABELS[state.currentStage as MissionStage] ?? state.currentStage}
            </span>
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: '9px',
                color: T.midText,
                backgroundColor: T.bgElevated,
                border: `1px solid ${T.border}`,
                padding: '1px 5px',
                borderRadius: 2,
                lineHeight: 1.4,
              }}
            >
              {stageNum} / {totalStages}
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              width: '130px',
              height: '2px',
              backgroundColor: T.border,
              borderRadius: '1px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${stageProgress * 100}%`,
                backgroundColor: T.sky,
                transition: 'width 0.3s linear',
              }}
            />
          </div>
        </div>

        {/* Vertical separator */}
        <div style={{ width: '1px', height: '26px', backgroundColor: T.border, flexShrink: 0 }} />

        {/* Scenario Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span
            style={{
              fontFamily: T.fontMono,
              fontSize: '9px',
              color: T.midText,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              lineHeight: 1,
            }}
          >
            Scenario
          </span>
          <select
            value={state.scenario}
            onChange={(e) => dispatch({ type: 'SET_SCENARIO', scenario: e.target.value as any })}
            style={{
              backgroundColor: T.bgElevated,
              color: T.sky,
              border: `1px solid ${T.border}`,
              borderRadius: '2px',
              fontFamily: T.fontMono,
              fontSize: '10px',
              padding: '2px 6px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="active">Mumbai Offshore (Attributed)</option>
            <option value="rejected_lookalike">Look-Alike Rejection</option>
            <option value="no_candidates">Null-Result (No Suspect)</option>
          </select>
        </div>
      </div>

      {/* CENTER — Mission Clock */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <span
          style={{
            fontFamily: T.fontMono,
            fontSize: '9px',
            color: T.dimText,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}
        >
          Mission Clock
        </span>
        <span
          style={{
            fontFamily: T.fontMono,
            fontSize: '13px',
            color: T.bodyText,
            lineHeight: 1,
            letterSpacing: '0.04em',
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
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: T.fontMono,
                fontSize: '10px',
                cursor: 'pointer',
                borderRadius: '2px',
                backgroundColor: isActive ? 'rgba(56,189,248,0.08)' : 'transparent',
                border: isActive ? `1px solid ${T.sky}` : `1px solid ${T.border}`,
                color: isActive ? T.sky : T.midText,
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
            height: '30px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: T.fontMono,
            fontSize: '10px',
            cursor: 'pointer',
            borderRadius: '2px',
            backgroundColor: state.autoPlay ? 'rgba(56,189,248,0.08)' : 'transparent',
            border: state.autoPlay ? `1px solid ${T.sky}` : `1px solid ${T.border}`,
            color: state.autoPlay ? T.sky : T.midText,
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {state.autoPlay ? '> AUTO' : 'MANUAL'}
        </button>

        {/* Separator */}
        <div style={{ width: '1px', height: '26px', backgroundColor: T.border, flexShrink: 0 }} />

        {/* PREV button */}
        <button
          onClick={() => dispatch({ type: 'PREV_STAGE' })}
          disabled={isPrevDisabled}
          style={{
            height: '30px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: T.fontMono,
            fontSize: '10px',
            cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
            borderRadius: '2px',
            backgroundColor: T.bgElevated,
            border: `1px solid ${T.border}`,
            color: isPrevDisabled ? T.border : T.midText,
            transition: 'all 0.15s ease',
            opacity: isPrevDisabled ? 0.4 : 1,
            gap: 5,
            whiteSpace: 'nowrap',
          }}
        >
          PREV
        </button>

        {/* NEXT button */}
        <button
          onClick={() => dispatch({ type: 'NEXT_STAGE' })}
          disabled={isNextDisabled}
          style={{
            height: '30px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: T.fontMono,
            fontSize: '10px',
            cursor: isNextDisabled ? 'not-allowed' : 'pointer',
            borderRadius: '2px',
            backgroundColor: isNextDisabled ? T.bgElevated : 'rgba(56,189,248,0.08)',
            border: isNextDisabled ? `1px solid ${T.border}` : `1px solid ${T.sky}`,
            color: isNextDisabled ? T.border : T.sky,
            transition: 'all 0.15s ease',
            opacity: isNextDisabled ? 0.4 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          NEXT
        </button>
      </div>
    </div>
  );
};

export default MissionStatusBar;
