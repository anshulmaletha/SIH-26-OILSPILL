import React, { useState, useEffect } from 'react';
import { useMission } from '@/lib/mission/missionState';
import { fetchDetection, type DetectionResult } from '@/lib/api/client';

const SAR_KF_ID = '__sar-phase-kf-v2__';
if (typeof document !== 'undefined' && !document.getElementById(SAR_KF_ID)) {
  const s = document.createElement('style');
  s.id = SAR_KF_ID;
  s.textContent = `
    @keyframes radar-sweep-rotate-v2 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes pulse-ring-v2 { 0% { opacity: 0.5; } 100% { opacity: 1; } }
    @keyframes scanline-flash-v2 { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
  `;
  document.head.appendChild(s);
}

export const SARPhaseOverlay: React.FC = () => {
  const { state } = useMission();
  const isActive = state.currentStage === 'SAR_ACQUISITION';
  const elapsed = state.stageElapsedMs ?? 0;

  const [detData, setDetData] = useState<DetectionResult | null>(null);

  useEffect(() => {
    if (!isActive) return;
    let mounted = true;
    fetchDetection(state.scenario)
      .then((d) => { if (mounted) setDetData(d); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [isActive, state.scenario]);

  if (!isActive) return null;

  const scanPct = Math.min(elapsed / 3000, 1);
  const showScanLine = elapsed < 3000;
  const showAnomalyLock = elapsed > 3500;
  const showAlertBox = elapsed > 4000;

  // Extract real values from API or sensible defaults
  const poly = detData?.polygons?.[0];
  const lf = poly?.lookalike_filter;
  const area = poly?.geometry_features?.area_km2 ?? 4.82;
  const conf = poly?.confidence ? (poly.confidence * 100).toFixed(1) : '94.0';
  const sceneId = detData?.scene_id ?? 'S1A_IW_GRDH_1SDV_20260515T060000';
  const dampingRatio = lf?.damping_ratio?.toFixed(2) ?? '3.82';
  const isRejected = lf?.final_decision === 'rejected';
  const classification = isRejected ? 'BIOGENIC FILM (REJECTED)' : 'CRUDE PETROLEUM SLICK';
  const classColor = isRejected ? '#F59E0B' : '#38BDF8';

  // Compute centroid from polygon
  let centroid = '19.350°N  71.853°E';
  if (poly?.geometry?.coordinates?.[0]) {
    const coords = poly.geometry.coordinates[0] as number[][];
    const avgLon = coords.reduce((s: number, c: number[]) => s + c[0]!, 0) / coords.length;
    const avgLat = coords.reduce((s: number, c: number[]) => s + c[1]!, 0) / coords.length;
    centroid = `${Math.abs(avgLat).toFixed(3)}°${avgLat >= 0 ? 'N' : 'S'}  ${Math.abs(avgLon).toFixed(3)}°${avgLon >= 0 ? 'E' : 'W'}`;
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 500,
        overflow: 'hidden',
      }}
    >
      {/* ── 1. RADAR SWEEP ── */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 180,
          height: 180,
          border: '2px dashed rgba(56,189,248,0.22)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'conic-gradient(transparent 270deg, rgba(56,189,248,0.12) 360deg)',
            animation: 'radar-sweep-rotate-v2 3s linear infinite',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: '#38BDF8',
            zIndex: 1,
          }}
        />
      </div>

      {/* Radar label */}
      <div
        style={{
          position: 'absolute',
          top: 268,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: '#38BDF8',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          opacity: 0.65,
        }}
      >
        SAR RADAR SWEEP
      </div>

      {/* ── 2. SCANLINE ── */}
      {showScanLine && (
        <>
          <div
            style={{
              position: 'absolute',
              top: `${scanPct * 100}vh`,
              left: 0,
              right: 0,
              height: 1,
              background: 'rgba(56,189,248,0.18)',
              animation: 'scanline-flash-v2 0.4s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: `${scanPct * 100}vh`,
              background: 'rgba(56,189,248,0.022)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: `calc(${scanPct * 100}vh - 14px)`,
              right: 16,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: '#38BDF8',
              letterSpacing: '0.1em',
              opacity: 0.9,
            }}
          >
            ▶ SCANNING
          </div>
        </>
      )}

      {/* ── 3. ANOMALY LOCK ── */}
      {showAnomalyLock && (
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '55%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              border: '1px solid #EF4444',
              borderRadius: '50%',
              animation: 'pulse-ring-v2 1.5s ease-in-out infinite alternate',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <div style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 1, height: 5, backgroundColor: '#EF4444' }} />
            <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 1, height: 5, backgroundColor: '#EF4444' }} />
            <div style={{ position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)', width: 5, height: 1, backgroundColor: '#EF4444' }} />
            <div style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)', width: 5, height: 1, backgroundColor: '#EF4444' }} />
          </div>
        </div>
      )}

      {/* ── 4. ALERT BOX (real API data) ── */}
      {showAlertBox && (
        <div
          style={{
            position: 'absolute',
            top: '42%',
            left: 'calc(55% + 42px)',
            background: '#0C1220',
            border: '1px solid #EF4444',
            borderLeft: '3px solid #EF4444',
            padding: '10px 14px',
            fontFamily: "'JetBrains Mono', monospace",
            minWidth: 248,
            zIndex: 501,
            borderRadius: 2,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#EF4444',
              letterSpacing: '0.08em',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            ANOMALY DETECTED
          </div>
          <div style={{ fontSize: 10, color: '#A8BDD0', lineHeight: 1.85 }}>
            <div>Scene: <span style={{ color: '#EDF2F7' }}>{sceneId.slice(0, 28)}</span></div>
            <div>Centroid: <span style={{ color: '#EDF2F7' }}>{centroid}</span></div>
            <div>σ° = <span style={{ color: '#EDF2F7' }}>{dampingRatio} dB</span>&nbsp;&nbsp;|&nbsp;&nbsp;Area: <span style={{ color: '#EDF2F7' }}>{area.toFixed(2)} km²</span></div>
            <div>Confidence: <span style={{ color: '#EDF2F7' }}>{conf}%</span></div>
            <div style={{ color: classColor, marginTop: 5, fontWeight: 600 }}>
              {classification}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SARPhaseOverlay;
