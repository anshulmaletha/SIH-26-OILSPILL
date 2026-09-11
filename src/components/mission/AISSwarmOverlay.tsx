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

const VESSEL_TYPES: { label: string; count: number }[] = [
  { label: 'Crude Tanker', count: 127 },
  { label: 'Bulk Carrier', count: 98 },
  { label: 'Container', count: 84 },
  { label: 'Other', count: 103 },
];

const TOTAL_VESSELS = 412;
const COUNT_ANIM_DURATION_MS = 4000; // 0ms -> 412 at 4000ms

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const AISSwarmOverlay: React.FC = () => {
  const { state } = useMission();

  // Animated vessel count
  const [displayCount, setDisplayCount] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.currentStage !== ('AIS_SWARM' as MissionStage)) {
      setDisplayCount(0);
      startTimeRef.current = null;
      return;
    }

    const elapsed = state.stageElapsedMs;
    const progress = Math.min(elapsed / COUNT_ANIM_DURATION_MS, 1);
    const target = Math.round(easeOutCubic(progress) * TOTAL_VESSELS);
    setDisplayCount(target);
  }, [state.stageElapsedMs, state.currentStage]);

  // Cleanup raf on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (state.currentStage !== ('AIS_SWARM' as MissionStage)) return null;

  const showBreakdown = state.stageElapsedMs > 2000;
  const showStatus = state.stageElapsedMs > 3500;

  return (
    <div
      style={{
        position: 'absolute',
        top: '80px',
        left: '12px',
        zIndex: 15,
        width: '280px',
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
          AIS MARITIME TRAFFIC
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '8px',
            color: '#5A7A94',
            lineHeight: 1,
          }}
        >
          Temporal corridor T-24h — T=0h
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '10px 12px' }}>
        {/* Rolling vessel counter */}
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
            ACTIVE VESSELS IN TEMPORAL CORRIDOR
          </div>
        </div>

        {/* Vessel type breakdown */}
        {showBreakdown && (
          <div style={{ marginTop: '8px' }}>
            {VESSEL_TYPES.map((v, i) => (
              <div
                key={v.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '3px',
                  paddingBottom: '3px',
                  borderBottom: '1px solid #111822',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '9px',
                    color: '#5A7A94',
                  }}
                >
                  {v.label}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '10px',
                    color: '#C8D8E8',
                  }}
                >
                  {v.count}
                </span>
              </div>
            ))}
            {/* Dynamic Dark Vessel Count from existing detection pipeline */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '3px',
                paddingBottom: '3px',
              }}
            >
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '9px',
                  color: '#EF4444',
                  fontWeight: 600,
                }}
              >
                Dark Vessels (CFAR)
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  color: '#EF4444',
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
              H3 SPATIAL-TEMPORAL INDEXING
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AISSwarmOverlay;
