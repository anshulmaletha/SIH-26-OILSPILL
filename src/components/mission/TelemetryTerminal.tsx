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

function getLevelColor(level: string, isDark: boolean): string {
  if (isDark) {
    switch (level) {
      case "ok":   return "#4ADE80";
      case "warn": return "#FBBF24";
      case "crit": return "#F87171";
      case "data": return "#F1F5F9";
      default:     return "#94A3B8";
    }
  }
  switch (level) {
    case "ok":   return "#15803D";
    case "warn": return "#B45309";
    case "crit": return "#DC2626";
    case "data": return "#0F172A";
    default:     return "#475569";
  }
}

const TelemetryTerminal: React.FC = () => {
  const { state } = useMission();
  const isDark = state.theme === "dark";
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
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
        border: isDark ? '1px solid #1E293B' : '1px solid #E2E8F0',
        borderLeft: isDark ? '3px solid #F8FAFC' : '3px solid #0F172A',
        borderRadius: '3px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.08)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: '26px',
          minHeight: '26px',
          borderBottom: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
          backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
          paddingLeft: '10px',
          paddingRight: '10px',
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
              backgroundColor: isDark ? '#F8FAFC' : '#0F172A',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: '9px',
              fontWeight: 700,
              color: isDark ? '#F8FAFC' : '#0F172A',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
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
              backgroundColor: '#DC2626',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: '8px',
              fontWeight: 700,
              color: '#DC2626',
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
          padding: '8px 10px',
          fontFamily: "ui-monospace, monospace",
          fontSize: '9.5px',
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
                  color: isDark ? '#64748B' : '#94A3B8',
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
                  color: getLevelColor(line.level, isDark),
                  wordBreak: 'break-word',
                  flex: 1,
                }}
              >
                {line.message}
                {isLast && (
                  <span
                    className="telemetry-blink"
                    style={{
                      color: isDark ? '#F8FAFC' : '#0F172A',
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
              style={{ color: isDark ? '#F8FAFC' : '#0F172A' }}
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
