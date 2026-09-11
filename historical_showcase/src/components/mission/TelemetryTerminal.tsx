import React, { useRef, useEffect } from 'react';
import { useMission } from '@/lib/mission/missionState';
import { getVisibleLogs, levelColor } from '@/lib/mission/telemetryLog';

// Blinking cursor keyframes injected once
const BLINK_STYLE_ID = 'telemetry-blink-style';
if (typeof document !== 'undefined' && !document.getElementById(BLINK_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = BLINK_STYLE_ID;
  style.textContent = `
    @keyframes telemetry-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    .telemetry-blink {
      animation: telemetry-blink 1s step-end infinite;
    }
    @keyframes telemetry-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .telemetry-pulse {
      animation: telemetry-pulse 1.4s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

const TelemetryTerminal: React.FC = () => {
  const { state } = useMission();
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines = getVisibleLogs(state.currentStage, state.stageElapsedMs);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  if (!state.initiated) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '12px',
        zIndex: 15,
        width: '420px',
        height: '200px',
        backgroundColor: 'rgba(5, 7, 10, 0.88)',
        border: '1px solid #1C2A38',
        borderLeft: '2px solid #22D3EE',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: '24px',
          minHeight: '24px',
          borderBottom: '1px solid #1C2A38',
          paddingLeft: '8px',
          paddingRight: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
      >
        {/* Left: pulsing dot + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            className="telemetry-pulse"
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#22D3EE',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '9px',
              color: '#22D3EE',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              lineHeight: 1,
            }}
          >
            TELEMETRY FEED
          </span>
        </div>

        {/* Right: LIVE indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '8px',
              color: '#EF4444',
              lineHeight: 1,
              letterSpacing: '0.05em',
            }}
          >
            LIVE
          </span>
        </div>
      </div>

      {/* Scrollable log area */}
      <div
        ref={scrollRef}
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 8px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      >
        {lines.map((line, idx) => {
          const isLast = idx === lines.length - 1;
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              {/* Timestamp */}
              <span
                style={{
                  color: '#3A5268',
                  flexShrink: 0,
                  marginRight: '8px',
                  userSelect: 'none',
                }}
              >
                {line.timestamp}
              </span>
              {/* Message */}
              <span
                style={{
                  color: levelColor(line.level),
                  wordBreak: 'break-word',
                  flex: 1,
                }}
              >
                {line.message}
                {isLast && (
                  <span
                    className="telemetry-blink"
                    style={{
                      color: '#22D3EE',
                      marginLeft: '2px',
                    }}
                  >
                    _
                  </span>
                )}
              </span>
            </div>
          );
        })}

        {/* Show cursor alone if no lines */}
        {lines.length === 0 && (
          <div style={{ display: 'flex' }}>
            <span
              className="telemetry-blink"
              style={{ color: '#22D3EE' }}
            >
              _
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TelemetryTerminal;
