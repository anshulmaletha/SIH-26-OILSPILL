import React, { useState, useEffect, useRef } from 'react';
import { useMission, MissionStage } from '@/lib/mission/missionState';

// Inject loading-dots keyframes once
const DOTS_STYLE_ID = 'ais-dots-style';
if (typeof document !== 'undefined' && !document.getElementById(DOTS_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = DOTS_STYLE_ID;
  style.textContent = `
    @keyframes ais-dots {
      0%   { content: '.'; }
      33%  { content: '..'; }
      66%  { content: '...'; }
      100% { content: '.'; }
    }
    .ais-dots::after {
      content: '.';
      animation: ais-dots 1.2s step-end infinite;
    }
  `;
  document.head.appendChild(style);
}

const AIS_QUERY_METRICS = [
  { label: 'Sampling Epochs', value: '289 (5-min intervals)' },
  { label: 'Geographic Bounds', value: '70.5°–73.0°E, 18.0°–20.5°N' },
  { label: 'Spatial Index', value: 'Uber H3 Resolution 7' },
  { label: 'Corridor Traffic', value: 'Active Telemetry + Load Test' },
];

const TOTAL_AIS_RECORDS = 578;
const COUNT_ANIM_DURATION_MS = 3500; // 0 -> 578 at 3500ms

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const AISSwarmOverlay: React.FC = () => {
  const { state } = useMission();

  // Animated vessel count
  const [displayCount, setDisplayCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.currentStage !== ('AIS_SWARM' as MissionStage)) {
      setDisplayCount(0);
      return;
    }

    const elapsed = state.stageElapsedMs;
    const progress = Math.min(elapsed / COUNT_ANIM_DURATION_MS, 1);
    const target = Math.round(easeOutCubic(progress) * TOTAL_AIS_RECORDS);
    setDisplayCount(target);
  }, [state.stageElapsedMs, state.currentStage]);

  // Cleanup raf on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (state.currentStage !== ('AIS_SWARM' as MissionStage)) return null;

  const isDark = state.theme === "dark";
  const showBreakdown = state.stageElapsedMs > 1800;
  const showStatus = state.stageElapsedMs > 3000;

  return (
    <div
      style={{
        position: 'absolute',
        top: '76px',
        left: '14px',
        zIndex: 15,
        width: '310px',
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
        border: isDark ? '1px solid #1E293B' : '1px solid #E2E8F0',
        borderTop: isDark ? '3px solid #F8FAFC' : '3px solid #0F172A',
        borderRadius: '4px',
        boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
          backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: '9.5px',
            fontWeight: 700,
            color: isDark ? '#F8FAFC' : '#0F172A',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            lineHeight: 1,
            marginBottom: '3px',
          }}
        >
          AIS CORRIDOR TELEMETRY
        </div>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: '8.5px',
            color: isDark ? '#94A3B8' : '#64748B',
            lineHeight: 1,
          }}
        >
          Window: 2026-05-14T06:00Z → 2026-05-15T06:00Z (T-24h)
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px' }}>
        {/* Rolling records counter */}
        <div style={{ marginBottom: '10px' }}>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: '34px',
              fontWeight: 700,
              color: isDark ? '#F8FAFC' : '#0F172A',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {String(displayCount).padStart(3, '0')}
          </div>
          <div
            style={{
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSize: '8.5px',
              color: isDark ? '#94A3B8' : '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: '4px',
              lineHeight: 1.3,
            }}
          >
            INDEXED AIS BROADCAST RECORDS (standardized_ais_indexed.csv)
          </div>
        </div>

        {/* Query metrics breakdown */}
        {showBreakdown && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {AIS_QUERY_METRICS.map((m, i) => (
              <div
                key={m.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '3px',
                  paddingBottom: '3px',
                  borderBottom: i < AIS_QUERY_METRICS.length - 1 ? (isDark ? '1px solid #1E293B' : '1px solid #F1F5F9') : 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '9.5px',
                    color: isDark ? '#94A3B8' : '#64748B',
                  }}
                >
                  {m.label}
                </span>
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: '9.5px',
                    fontWeight: 600,
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  }}
                >
                  {m.value}
                </span>
              </div>
            ))}
            {/* Dynamic Dark Vessel Count from existing detection pipeline */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '4px',
                paddingBottom: '2px',
              }}
            >
              <span
                style={{
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '9.5px',
                  color: '#DC2626',
                  fontWeight: 600,
                }}
              >
                Dark Vessels (CFAR)
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: '11px',
                  color: '#DC2626',
                  fontWeight: 700,
                }}
              >
                4
              </span>
            </div>
          </div>
        )}

        {/* Status badge */}
        {showStatus && (
          <div
            style={{
              backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
              border: isDark ? '1px solid #334155' : '1px solid #CBD5E1',
              padding: '6px 10px',
              marginTop: '10px',
              borderRadius: '3px',
            }}
          >
            <span
              className="ais-dots"
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: '8.5px',
                fontWeight: 600,
                color: isDark ? '#F8FAFC' : '#0F172A',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              H3 SPATIAL-TEMPORAL HASH LOOKUP READY
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AISSwarmOverlay;
