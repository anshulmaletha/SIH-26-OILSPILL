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

  const showBreakdown = state.stageElapsedMs > 1800;
  const showStatus = state.stageElapsedMs > 3000;

  return (
    <div
      style={{
        position: 'absolute',
        top: '80px',
        left: '12px',
        zIndex: 15,
        width: '300px',
        backgroundColor: '#0D1117',
        border: '1px solid #1C2A38',
        borderRadius: '2px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #1C2A38',
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            color: '#22D3EE',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            lineHeight: 1,
            marginBottom: '3px',
          }}
        >
          AIS CORRIDOR TELEMETRY
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '8px',
            color: '#5A7A94',
            lineHeight: 1,
          }}
        >
          Window: 2026-05-14T06:00Z → 2026-05-15T06:00Z (T-24h)
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '10px 12px' }}>
        {/* Rolling records counter */}
        <div style={{ marginBottom: '8px' }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '32px',
              fontWeight: 700,
              color: '#E2E8F0',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {String(displayCount).padStart(3, '0')}
          </div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '8px',
              color: '#5A7A94',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: '4px',
              lineHeight: 1.3,
            }}
          >
            INDEXED AIS BROADCAST RECORDS (standardized_ais_indexed.csv)
          </div>
        </div>

        {/* Query metrics breakdown */}
        {showBreakdown && (
          <div style={{ marginTop: '8px' }}>
            {AIS_QUERY_METRICS.map((m, i) => (
              <div
                key={m.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '3px',
                  paddingBottom: '3px',
                  borderBottom: i < AIS_QUERY_METRICS.length - 1 ? '1px solid #111822' : 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '9px',
                    color: '#5A7A94',
                  }}
                >
                  {m.label}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '9px',
                    color: '#C8D8E8',
                  }}
                >
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Status badge */}
        {showStatus && (
          <div
            style={{
              backgroundColor: 'rgba(34,211,238,0.03)',
              border: '1px solid rgba(34,211,238,0.13)',
              padding: '6px 10px',
              marginTop: '8px',
              borderRadius: '2px',
            }}
          >
            <span
              className="ais-dots"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '8px',
                color: '#22D3EE',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
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
