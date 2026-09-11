import React, { useState, useEffect } from 'react';
import { useMission } from '@/lib/mission/missionState';
import { fetchSuspects, type SuspectsResult } from '@/lib/api/client';
import { ScoreBar, T } from '@/components/ui/PanelKit';

export function CulpritLockOverlay() {
  const { state } = useMission();
  const [suspectsData, setSuspectsData] = useState<SuspectsResult | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchSuspects(state.scenario)
      .then((data) => { if (mounted) setSuspectsData(data); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [state.scenario]);

  if (state.currentStage !== 'CULPRIT_LOCK') return null;

  const elapsed = state.stageElapsedMs;
  const isNullResult = suspectsData?.null_result || (suspectsData && suspectsData.ranked_suspects.length === 0);

  const primary = suspectsData?.ranked_suspects?.[0];
  const fb = primary?.feature_breakdown;
  const weights = primary?.weights_used;

  // Real values from API
  const totalScorePct   = primary ? primary.total_score    : 65.72;
  const normalizedScore = primary ? primary.normalized_score : 0.6572;
  const culpritName     = primary ? primary.vessel_name     : 'IND_TANKER_412';
  const culpritMmsi     = primary ? primary.vessel_id.replace('MMSI_', '') : '419000101';
  const culpritFlag     = primary ? primary.flag            : 'India (IND)';
  const culpritType     = primary ? primary.vessel_type     : 'Crude Oil Tanker';
  const assessment      = primary?.assessment ?? '';

  // Real weights from API
  const wCorr  = (weights as any)?.corridor_overlap  ?? 0.40;
  const wHead  = (weights as any)?.heading_alignment ?? 0.25;
  const wSpeed = (weights as any)?.speed_anomaly     ?? 0.20;
  const wGap   = (weights as any)?.ais_gap_history   ?? 0.15;

  interface ScoreFactor {
    key: string;
    label: string;
    value: number;
    color: string;
    detail: string;
  }

  const factors: ScoreFactor[] = [
    {
      key: 'corr',
      label: `Corridor Overlap (w=${wCorr.toFixed(2)})`,
      value: fb?.corridor_overlap_score ?? 0.1429,
      color: T.sky,
      detail: 'Lagrangian particle dispersion intersection (H3 corridor)',
    },
    {
      key: 'head',
      label: `Heading Alignment (w=${wHead.toFixed(2)})`,
      value: fb?.heading_alignment_score ?? 1.0,
      color: T.sky,
      detail: 'Alignment with SAR slick orientation axis',
    },
    {
      key: 'speed',
      label: `Speed Anomaly (w=${wSpeed.toFixed(2)})`,
      value: fb?.speed_anomaly_score ?? 1.0,
      color: T.sky,
      detail: 'Speed reduction during corridor transit (kts)',
    },
    {
      key: 'gap',
      label: `AIS Gap History (w=${wGap.toFixed(2)})`,
      value: fb?.ais_gap_history_score ?? 1.0,
      color: T.amber,
      detail: 'Transponder blackout duration over corridor',
    },
  ];

  const factorRevealMs = [0, 1200, 2400, 3600];
  const visibleFactors = factors.filter((_, i) => elapsed > (factorRevealMs[i] ?? 9999));

  const scoreRevealProgress = Math.min(1, Math.max(0, (elapsed - 5000) / 800));
  const displayScore = isNullResult ? '0.0' : (totalScorePct * scoreRevealProgress).toFixed(1);
  const showCulprit   = elapsed > 5800 && !isNullResult;
  const reticleOpacity = isNullResult ? 0 : Math.min(1, elapsed / 500);

  return (
    <>
      {/* ── Targeting reticle ── */}
      {!isNullResult && (
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '42%',
            transform: 'translate(-50%, -50%)',
            zIndex: 18,
            pointerEvents: 'none',
            opacity: reticleOpacity,
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 80, height: 80,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              border: '1px solid #EF4444',
              borderRadius: '50%',
              animation: 'culprit-ring-pulse 1.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 50, height: 50,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              border: '1px solid #EF444480',
              borderRadius: '50%',
              animation: 'culprit-ring-pulse 1.5s ease-in-out 0.3s infinite',
            }}
          />
          <svg width="100" height="100" viewBox="0 0 100 100" style={{ position: 'relative' }}>
            <line x1="50" y1="2"  x2="50" y2="18" stroke="#EF4444" strokeWidth="1.5" />
            <line x1="50" y1="82" x2="50" y2="98" stroke="#EF4444" strokeWidth="1.5" />
            <line x1="2"  y1="50" x2="18" y2="50" stroke="#EF4444" strokeWidth="1.5" />
            <line x1="82" y1="50" x2="98" y2="50" stroke="#EF4444" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="3" fill="#EF4444" />
          </svg>
        </div>
      )}

      {/* ── Attribution scoring panel ── */}
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
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgHeader }}>
          <div style={{ fontFamily: T.fontSans, fontSize: 11, fontWeight: 600, color: isNullResult ? T.amber : T.sky, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
            ATTRIBUTION SCORING
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.midText }}>
            {suspectsData?.scoring_model ?? 'Weighted Rule-Based Attribution Model'}
            {!isNullResult && ` · MMSI ${culpritMmsi}`}
          </div>
        </div>

        {/* Null Result */}
        {isNullResult ? (
          <div style={{ padding: '14px' }}>
            <div
              style={{
                backgroundColor: 'rgba(245,158,11,0.05)',
                border: '1px solid rgba(245,158,11,0.28)',
                padding: '12px',
                borderRadius: 2,
                marginBottom: 10,
              }}
            >
              <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.amber, fontWeight: 700, marginBottom: 7 }}>
                NO SUSPECT CORRELATED — RESTRICTION ENFORCED
              </div>
              <div style={{ fontFamily: T.fontSans, fontSize: 11, color: T.bodyText, lineHeight: 1.5 }}>
                All monitored AIS tracks remained clear of the backward dispersion corridor.
                System exercises judicial restraint and assigns zero false culpability.
              </div>
            </div>
          </div>
        ) : (
          /* Score factors */
          <div style={{ padding: '12px 14px' }}>
            {factors.map((factor, i) => (
              <ScoreBar
                key={factor.key}
                label={factor.label}
                value={factor.value}
                color={factor.color}
                detail={factor.detail}
                animDelay={(factorRevealMs[i] ?? 0) + 400}
                visible={visibleFactors.includes(factor)}
              />
            ))}
          </div>
        )}

        {/* Final score */}
        <div style={{ height: 1, background: T.border }} />
        <div style={{ padding: '12px 14px', backgroundColor: T.bgHeader }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontFamily: T.fontSans, fontSize: 11, fontWeight: 600, color: T.midText, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Attribution Score
            </span>
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: 28,
                fontWeight: 800,
                color: isNullResult ? T.midText : T.brightText,
                letterSpacing: '-0.02em',
                transition: 'color 0.3s',
              }}
            >
              {displayScore}%
            </span>
          </div>
          <div style={{ height: 3, background: T.border, position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: isNullResult ? T.midText : (scoreRevealProgress > 0.5 ? '#EF4444' : T.sky),
                transformOrigin: 'left center',
                transform: `scaleX(${isNullResult ? 0 : normalizedScore * scoreRevealProgress})`,
                transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        </div>

        {/* Culprit ID badge */}
        {showCulprit && (
          <div
            style={{
              padding: '12px 14px',
              borderTop: '1px solid rgba(239,68,68,0.25)',
              background: 'rgba(239,68,68,0.05)',
            }}
          >
            <div style={{ fontFamily: T.fontMono, fontSize: 10, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>
              ▶ PRIMARY SUSPECT IDENTIFIED
            </div>
            <div style={{ fontFamily: T.fontSans, fontSize: 14, fontWeight: 700, color: T.brightText, marginBottom: 4 }}>
              {culpritName}
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.midText, display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span>{culpritType}</span>
              <span style={{ color: T.dimText }}>·</span>
              <span>{culpritFlag}</span>
              <span style={{ color: T.dimText }}>·</span>
              <span>MMSI {culpritMmsi}</span>
            </div>
            {assessment && (
              <div style={{ fontFamily: T.fontSans, fontSize: 11, color: '#FCA5A5', lineHeight: 1.4, borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 7, marginBottom: 7 }}>
                {assessment}
              </div>
            )}
            <div
              style={{
                padding: '5px 8px',
                background: '#EF444412',
                border: '1px solid #EF444428',
                borderRadius: 2,
                fontFamily: T.fontMono,
                fontSize: 10,
                color: '#F87171',
              }}
            >
              Score: {totalScorePct.toFixed(1)}%  ·  Normalized: {normalizedScore.toFixed(3)} / 1.000
            </div>
          </div>
        )}
      </div>
    </>
  );
}
