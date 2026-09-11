import React, { useState, useEffect, useRef } from 'react';
import { useMission, MissionStage } from '@/lib/mission/missionState';
import { fetchAisTracks, fetchCandidates, type AisTracksResult, type CandidatesResult } from '@/lib/api/client';
import { Panel, PanelHeader, T } from '@/components/ui/PanelKit';

const DOTS_STYLE_ID = 'ais-dots-style-v2';
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

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const AISSwarmOverlay: React.FC = () => {
  const { state } = useMission();
  const [displayCount, setDisplayCount] = useState(0);
  const [aisData, setAisData] = useState<AisTracksResult | null>(null);
  const [candidatesData, setCandidatesData] = useState<CandidatesResult | null>(null);
  const rafRef = useRef<number | null>(null);

  // Fetch real data once per scenario
  useEffect(() => {
    let mounted = true;
    fetchAisTracks()
      .then((d) => { if (mounted) setAisData(d); })
      .catch(() => {});
    fetchCandidates(state.scenario)
      .then((d) => { if (mounted) setCandidatesData(d); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [state.scenario]);

  // Animated count
  useEffect(() => {
    if (state.currentStage !== ('AIS_SWARM' as MissionStage)) {
      setDisplayCount(0);
      return;
    }
    const totalRecords = aisData?.count ?? 578;
    const COUNT_ANIM_DURATION_MS = 3500;
    const progress = Math.min(state.stageElapsedMs / COUNT_ANIM_DURATION_MS, 1);
    setDisplayCount(Math.round(easeOutCubic(progress) * totalRecords));
  }, [state.stageElapsedMs, state.currentStage, aisData]);

  useEffect(() => {
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, []);

  if (state.currentStage !== ('AIS_SWARM' as MissionStage)) return null;

  const showBreakdown = state.stageElapsedMs > 1800;
  const showStatus    = state.stageElapsedMs > 3000;

  // Real query time window from candidates or defaults
  const qb = (candidatesData as any)?.ais_query_bounds;
  const tempStart = qb?.temporal?.start ?? '2026-05-14T06:00Z';
  const tempEnd   = qb?.temporal?.end   ?? '2026-05-15T06:00Z';

  const candidates = candidatesData?.candidates ?? [];
  const topCandidates = [...candidates]
    .sort((a, b) => b.ais_gap_minutes - a.ais_gap_minutes)
    .slice(0, 3);

  const metrics = [
    { label: 'Total AIS Records',  value: String(aisData?.count ?? 578) },
    { label: 'Candidate Matches',  value: String(candidates.length) },
    { label: 'Query Window',       value: 'T−24h → T±0' },
    { label: 'Spatial Index',      value: 'Uber H3 Res-7' },
  ];

  return (
    <div
      className="panel-slide-in-left"
      style={{ position: 'absolute', top: '80px', left: '12px', zIndex: 15, width: '315px' }}
    >
      <Panel>
        <PanelHeader
          label="AIS Corridor Telemetry"
          live
          sub={`Window: ${tempStart.slice(0, 16)}Z → ${tempEnd.slice(0, 16)}Z`}
        />

        <div style={{ padding: '12px 14px' }}>
          {/* Rolling counter */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontFamily: T.fontMono,
                fontSize: 38,
                fontWeight: 700,
                color: T.brightText,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {String(displayCount).padStart(3, '0')}
            </div>
            <div
              style={{
                fontFamily: T.fontSans,
                fontSize: 10,
                color: T.midText,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: 5,
              }}
            >
              Indexed AIS broadcast records
            </div>
          </div>

          {/* Metrics */}
          {showBreakdown && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginBottom: 10 }}>
              {metrics.map((m, i) => (
                <div
                  key={m.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderBottom: i < metrics.length - 1 ? `1px solid ${T.bgElevated}` : 'none',
                    animation: 'fadeIn 0.3s ease forwards',
                    animationDelay: `${i * 80}ms`,
                    opacity: 0,
                  }}
                >
                  <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.midText }}>{m.label}</span>
                  <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.bodyText }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Top candidates from API */}
          {showBreakdown && topCandidates.length > 0 && (
            <div>
              <div
                style={{
                  fontFamily: T.fontSans,
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.dimText,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 7,
                }}
              >
                Top AIS Candidates
              </div>
              {topCandidates.map((c, i) => (
                <div
                  key={c.vessel_id}
                  style={{
                    padding: '6px 9px',
                    marginBottom: 4,
                    backgroundColor: T.bgElevated,
                    border: `1px solid ${T.border}`,
                    borderRadius: 2,
                    animation: 'fadeIn 0.3s ease forwards',
                    animationDelay: `${i * 100 + 200}ms`,
                    opacity: 0,
                  }}
                >
                  <div style={{ fontFamily: T.fontSans, fontSize: 11, fontWeight: 600, color: T.brightText, marginBottom: 2 }}>
                    {c.vessel_name}
                  </div>
                  <div
                    style={{
                      fontFamily: T.fontMono,
                      fontSize: 10,
                      color: T.midText,
                      display: 'flex',
                      gap: 8,
                    }}
                  >
                    <span>{c.vessel_type}</span>
                    <span style={{ color: T.dimText }}>·</span>
                    <span style={{ color: c.ais_gap_minutes > 60 ? '#F59E0B' : T.midText }}>
                      {c.ais_gap_minutes}m gap
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Status */}
          {showStatus && (
            <div
              style={{
                backgroundColor: 'rgba(56,189,248,0.04)',
                border: '1px solid rgba(56,189,248,0.13)',
                padding: '7px 10px',
                marginTop: 8,
                borderRadius: 2,
              }}
            >
              <span
                className="ais-dots"
                style={{ fontFamily: T.fontMono, fontSize: 10, color: T.sky, textTransform: 'uppercase', letterSpacing: '0.07em' }}
              >
                H3 Spatial-Temporal Hash Lookup Ready
              </span>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
};

export default AISSwarmOverlay;
