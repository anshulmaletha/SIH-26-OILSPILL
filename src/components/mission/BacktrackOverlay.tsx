import { useState, useEffect } from 'react';
import { useMission } from '@/lib/mission/missionState';
import { fetchSuspects, fetchCorridor, type SuspectsResult, type CorridorResult } from '@/lib/api/client';
import { T } from '@/components/ui/PanelKit';

const CLOCK_HOURS = [0, -6, -12, -24];

const RISK_THEME = {
  high:     { bg: '#EF444410', border: '#EF444430', dot: '#EF4444', label: 'HIGH' },
  moderate: { bg: '#F59E0B10', border: '#F59E0B30', dot: '#F59E0B', label: 'MODERATE' },
  low:      { bg: '#38BDF808', border: '#38BDF820', dot: '#5C7A94', label: 'LOW' },
} as const;

function getRiskLevel(normalizedScore: number): keyof typeof RISK_THEME {
  if (normalizedScore >= 0.6) return 'high';
  if (normalizedScore >= 0.3) return 'moderate';
  return 'low';
}

export interface BacktrackOverlayProps {
  relativeHour?: number;
  onHourChange?: (hour: number) => void;
}

export function BacktrackOverlay({ relativeHour = 0, onHourChange }: BacktrackOverlayProps) {
  const { state } = useMission();
  const [suspectsData, setSuspectsData] = useState<SuspectsResult | null>(null);
  const [corridorData, setCorridorData] = useState<CorridorResult | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchSuspects(state.scenario)
      .then((d) => { if (mounted) setSuspectsData(d); })
      .catch(() => {});
    fetchCorridor()
      .then((d) => { if (mounted) setCorridorData(d); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [state.scenario]);

  if (state.currentStage !== 'BACKTRACK_CORRIDOR') return null;

  const isNullResult = state.scenario === 'no_candidates' || suspectsData?.null_result === true;
  const elapsed = state.stageElapsedMs;

  // Real ranked suspects from API
  const rankedSuspects = suspectsData?.ranked_suspects ?? [];

  // Synced clock hour from props
  const clockHour = relativeHour;

  const visibleSuspects = isNullResult
    ? (elapsed > 4000 ? 1 : 0)
    : Math.min(rankedSuspects.length, elapsed > 4500 ? Math.ceil((elapsed - 4500) / 600) : 0);

  // Real drift config from corridor API
  const driftConfig = corridorData?.drift_config;
  const driftSources = driftConfig
    ? `${driftConfig.currents_source} · wind factor ${driftConfig.wind_drift_factor}`
    : 'HYCOM currents · ERA5 wind forcing';

  return (
    <>
      {/* ── Backward time clock — top center ── */}
      <div
        style={{
          position: 'absolute',
          top: 70,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          background: T.bgPanel,
          border: `1px solid ${T.border}`,
          padding: '8px 20px',
          fontFamily: T.fontMono,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderRadius: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: T.midText, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            BACKTRACK
          </span>
          <span
            style={{
              fontSize: 10,
              color: '#F59E0B',
              fontWeight: 700,
              letterSpacing: '0.05em',
              animation: 'pulse-ring-inner 1s ease-in-out infinite',
            }}
          >
            ◀◀ REWINDING
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: T.sky, letterSpacing: '-0.02em' }}>
            T{clockHour === 0 ? '0' : clockHour > 0 ? `+${clockHour.toFixed(1)}` : `${clockHour.toFixed(1)}`}h
          </span>
        </div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {CLOCK_HOURS.map((h) => {
            const isMatch = Math.abs(clockHour - h) < 3;
            return (
              <button
                key={h}
                onClick={() => onHourChange?.(h)}
                style={{
                  fontSize: 9,
                  padding: '2px 7px',
                  background: isMatch ? '#38BDF825' : T.bgElevated,
                  border: `1px solid ${isMatch ? '#38BDF8' : T.border}`,
                  color: isMatch ? T.sky : T.dimText,
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
              >
                T{h}h
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bottom notice ── */}
      {elapsed > 4000 && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            fontFamily: T.fontMono,
            fontSize: 10,
            color: T.midText,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            textAlign: 'center',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {isNullResult ? (
            <span style={{ color: T.sky }}>0 corridor intersections · Judicial restraint invoked</span>
          ) : (
            <>
              Drift model: <span style={{ color: T.bodyText }}>{driftSources}</span>
            </>
          )}
        </div>
      )}

      {/* ── Suspect narrowing panel — right side ── */}
      {visibleSuspects > 0 && (
        <div
          className="panel-slide-in"
          style={{
            position: 'absolute',
            top: 80,
            right: 12,
            zIndex: 20,
            width: 335,
            background: T.bgPanel,
            border: `1px solid ${T.border}`,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '10px 14px',
              borderBottom: `1px solid ${T.border}`,
              backgroundColor: T.bgHeader,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontFamily: T.fontSans,
                fontSize: 11,
                fontWeight: 600,
                color: isNullResult ? T.midText : T.sky,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              {isNullResult ? 'NULL RESULT — No Corridor Intersection' : 'CORRIDOR SUSPECT TARGETS'}
            </span>
            {!isNullResult && (
              <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.midText }}>
                {Math.min(visibleSuspects, rankedSuspects.length)} / {rankedSuspects.length}
              </span>
            )}
          </div>

          {/* Null result */}
          {isNullResult ? (
            <div style={{ padding: '14px', backgroundColor: 'rgba(56,189,248,0.03)' }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.sky, fontWeight: 700, marginBottom: 6 }}>
                ✓ JUDICIAL RESTRAINT ENFORCED
              </div>
              <div style={{ fontFamily: T.fontSans, fontSize: 11, color: T.bodyText, lineHeight: 1.5 }}>
                Zero AIS tracks intersected the backward particle advection corridor above minimum confidence
                threshold. System correctly declines to nominate an innocent vessel.
              </div>
            </div>
          ) : (
            /* Real API suspect rows */
            rankedSuspects.slice(0, visibleSuspects).map((s, i) => {
              const level = getRiskLevel(s.normalized_score);
              const theme = RISK_THEME[level];
              return (
                <div
                  key={s.vessel_id}
                  style={{
                    padding: '10px 14px',
                    borderBottom: `1px solid #0F1925`,
                    background: theme.bg,
                    borderLeft: `3px solid ${theme.dot}`,
                    animation: 'fadeIn 0.3s ease forwards',
                    animationDelay: `${i * 60}ms`,
                    opacity: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: T.fontSans, fontSize: 12, fontWeight: 600, color: T.brightText }}>
                      {s.vessel_name}
                    </span>
                    <span
                      style={{
                        fontFamily: T.fontMono,
                        fontSize: 9,
                        color: theme.dot,
                        border: `1px solid ${theme.border}`,
                        background: theme.bg,
                        padding: '1px 6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderRadius: 2,
                      }}
                    >
                      {theme.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: T.fontMono,
                      fontSize: 10,
                      color: T.midText,
                      display: 'flex',
                      gap: 8,
                      marginBottom: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{s.vessel_type}</span>
                    <span style={{ color: T.dimText }}>·</span>
                    <span>{s.flag}</span>
                    <span style={{ color: T.dimText }}>·</span>
                    <span style={{ color: T.bodyText }}>Score: {(s.normalized_score * 100).toFixed(0)}%</span>
                  </div>
                  {s.assessment && (
                    <div
                      style={{
                        fontFamily: T.fontSans,
                        fontSize: 10,
                        color: level === 'high' ? '#FCA5A5' : T.midText,
                        lineHeight: 1.4,
                      }}
                    >
                      {s.assessment}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
