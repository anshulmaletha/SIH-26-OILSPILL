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
  const isDark = state.theme === 'dark';

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
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
        borderBottom: isDark ? '1px solid #1E293B' : '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '16px',
        paddingRight: '16px',
        boxSizing: 'border-box',
        boxShadow: isDark ? '0 1px 4px 0 rgba(0, 0, 0, 0.4)' : '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        color: isDark ? '#F8FAFC' : '#0F172A',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* LEFT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {/* Triangle icon */}
        <div
          style={{
            width: '28px',
            height: '28px',
            border: isDark ? '1px solid #334155' : '1px solid #CBD5E1',
            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: '3px',
          }}
        >
          <svg width="16" height="14" viewBox="0 0 16 14">
            <polygon
              points="8,2 14,12 2,12"
              stroke={isDark ? '#F8FAFC' : '#0F172A'}
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </div>

        {/* Title block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span
            style={{
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '13px',
              fontWeight: 800,
              color: isDark ? '#F8FAFC' : '#0F172A',
              lineHeight: 1,
            }}
          >
            SIH 26143
          </span>
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: '8px',
              color: isDark ? '#94A3B8' : '#64748B',
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
            backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
            marginLeft: '12px',
            marginRight: '12px',
            flexShrink: 0,
          }}
        />

        {/* Stage label + progress bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: '11px',
              fontWeight: 700,
              color: isDark ? '#F8FAFC' : '#0F172A',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              lineHeight: 1,
            }}
          >
            {STAGE_LABELS[state.currentStage as MissionStage] ?? state.currentStage}
          </span>
          {/* Progress bar */}
          <div
            style={{
              width: '120px',
              height: '3px',
              backgroundColor: isDark ? '#334155' : '#E2E8F0',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${stageProgress * 100}%`,
                backgroundColor: isDark ? '#F8FAFC' : '#0F172A',
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
            backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
            marginLeft: '8px',
            marginRight: '8px',
            flexShrink: 0,
          }}
        />

        {/* Scenario Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: '8px',
              color: isDark ? '#94A3B8' : '#64748B',
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
              backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
              color: isDark ? '#F8FAFC' : '#0F172A',
              border: isDark ? '1px solid #334155' : '1px solid #CBD5E1',
              borderRadius: '3px',
              fontFamily: "ui-monospace, monospace",
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
            fontFamily: "ui-monospace, monospace",
            fontSize: '8px',
            color: isDark ? '#94A3B8' : '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            lineHeight: 1,
          }}
        >
          MISSION CLOCK
        </span>
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: '12px',
            fontWeight: 600,
            color: isDark ? '#F8FAFC' : '#0F172A',
            lineHeight: 1,
            letterSpacing: '0.05em',
          }}
        >
          {formatZulu(state.simulatedTime)}
        </span>
      </div>

      {/* RIGHT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Search Vessel trigger */}
        <button
          onClick={() => dispatch({ type: 'SET_SEARCH_OPEN', open: true })}
          style={{
            height: '28px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: "ui-monospace, monospace",
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '3px',
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
            border: isDark ? '1px solid #334155' : '1px solid #CBD5E1',
            color: isDark ? '#F8FAFC' : '#0F172A',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          title="Search Vessel by ID / Name (Ctrl+K)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>SEARCH VESSEL</span>
          <span
            style={{
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: '2px',
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              border: `1px solid ${isDark ? '#334155' : '#CBD5E1'}`,
              color: isDark ? '#94A3B8' : '#64748B',
            }}
          >
            ⌘K
          </span>
        </button>

        {/* Theme toggle button */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
          style={{
            height: '28px',
            paddingLeft: '8px',
            paddingRight: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontFamily: "ui-monospace, monospace",
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '3px',
            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
            border: isDark ? '1px solid #334155' : '1px solid #CBD5E1',
            color: isDark ? '#F8FAFC' : '#0F172A',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          <span>{isDark ? '☾ DARK' : '☀ LIGHT'}</span>
        </button>

        {/* Separator */}
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
            marginLeft: '2px',
            marginRight: '2px',
            flexShrink: 0,
          }}
        />

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
                fontFamily: "ui-monospace, monospace",
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                borderRadius: '3px',
                backgroundColor: isActive ? (isDark ? '#F8FAFC' : '#0F172A') : (isDark ? '#0F172A' : '#FFFFFF'),
                border: isActive ? (isDark ? '1px solid #F8FAFC' : '1px solid #0F172A') : (isDark ? '1px solid #334155' : '1px solid #CBD5E1'),
                color: isActive ? (isDark ? '#0F172A' : '#FFFFFF') : (isDark ? '#94A3B8' : '#64748B'),
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
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "ui-monospace, monospace",
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            borderRadius: '3px',
            backgroundColor: state.autoPlay ? (isDark ? '#F8FAFC' : '#0F172A') : (isDark ? '#0F172A' : '#FFFFFF'),
            border: state.autoPlay ? (isDark ? '1px solid #F8FAFC' : '1px solid #0F172A') : (isDark ? '1px solid #334155' : '1px solid #CBD5E1'),
            color: state.autoPlay ? (isDark ? '#0F172A' : '#FFFFFF') : (isDark ? '#94A3B8' : '#475569'),
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
            backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
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
            fontFamily: "ui-monospace, monospace",
            fontSize: '10px',
            cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
            borderRadius: '3px',
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            border: isDark ? '1px solid #334155' : '1px solid #CBD5E1',
            color: isPrevDisabled ? (isDark ? '#334155' : '#CBD5E1') : (isDark ? '#F8FAFC' : '#0F172A'),
            transition: 'all 0.15s ease',
            padding: 0,
            opacity: isPrevDisabled ? 0.35 : 1,
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
            fontFamily: "ui-monospace, monospace",
            fontSize: '10px',
            cursor: isNextDisabled ? 'not-allowed' : 'pointer',
            borderRadius: '3px',
            backgroundColor: isNextDisabled ? (isDark ? '#0F172A' : '#FFFFFF') : (isDark ? '#F8FAFC' : '#0F172A'),
            border: isNextDisabled ? (isDark ? '1px solid #334155' : '1px solid #CBD5E1') : (isDark ? '1px solid #F8FAFC' : '1px solid #0F172A'),
            color: isNextDisabled ? (isDark ? '#334155' : '#CBD5E1') : (isDark ? '#0F172A' : '#FFFFFF'),
            transition: 'all 0.15s ease',
            padding: 0,
            opacity: isNextDisabled ? 0.35 : 1,
          }}
        >
          ▶
        </button>
      </div>
    </div>
  );
};

export default MissionStatusBar;
