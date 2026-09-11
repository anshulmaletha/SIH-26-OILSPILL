import React, { useState, useEffect } from 'react';
import { useMission } from '@/lib/mission/missionState';
import { fetchCorridor, fetchDetection, type CorridorResult, type DetectionResult } from '@/lib/api/client';
import { Panel, PanelHeader, DataRow, SectionLabel, T } from '@/components/ui/PanelKit';

const BOOM_SVG_ID = '__boom-anim-kf-v2__';
if (typeof document !== 'undefined' && !document.getElementById(BOOM_SVG_ID)) {
  const style = document.createElement('style');
  style.id = BOOM_SVG_ID;
  style.textContent = `
    @keyframes boom-draw-v2 { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
    @keyframes teal-pulse-v2 { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  `;
  document.head.appendChild(style);
}

export function ContainmentRoom() {
  const { state } = useMission();
  const [corridorData, setCorridorData] = useState<CorridorResult | null>(null);
  const [detectionData, setDetectionData] = useState<DetectionResult | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCorridor()
      .then((d) => { if (mounted) setCorridorData(d); })
      .catch(() => {});
    fetchDetection(state.scenario)
      .then((d) => { if (mounted) setDetectionData(d); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [state.scenario]);

  if (state.currentStage !== 'CONTAINMENT_ROOM') return null;
  const elapsed = state.stageElapsedMs;

  const showStats = elapsed > 1500;
  const showPhysics = elapsed > 2500;
  const showVessels = elapsed > 3500;
  const showBoom = elapsed > 800;

  // Real data
  const poly = detectionData?.polygons?.[0];
  const area = poly?.geometry_features?.area_km2 ?? 4.82;
  const lf = poly?.lookalike_filter;
  const windSpeed = lf?.wind_speed_ms ?? 3.8;
  const isRejected = lf?.final_decision === 'rejected';

  const driftConfig = corridorData?.drift_config;
  const windSource = driftConfig?.wind_source ?? 'ECMWF ERA5';
  const currentsSource = driftConfig?.currents_source ?? 'HYCOM Global';
  const windFactor = driftConfig?.wind_drift_factor ?? 0.03;
  const currentSpeed = 0.45; // Approx baseline
  const driftVelocity = (currentSpeed + (windSpeed * windFactor)).toFixed(2);

  return (
    <>
      {/* ── CONTAINMENT BOOM SVG (Center screen overlay) ── */}
      {showBoom && !isRejected && (
        <div style={{ position: 'absolute', top: '48%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 10 }}>
          <svg width="220" height="220" viewBox="0 0 220 220" style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.4))' }}>
            {/* Inner fill */}
            <path d="M 40,110 Q 110,30 180,110 Q 110,190 40,110" fill="rgba(16,185,129,0.06)" />
            {/* Outer animated stroke */}
            <path
              d="M 40,110 Q 110,30 180,110 Q 110,190 40,110"
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeDasharray="100"
              strokeDashoffset="100"
              style={{ animation: 'boom-draw-v2 2s ease-out forwards' }}
            />
            {/* Intersecting cross */}
            <line x1="110" y1="40" x2="110" y2="180" stroke="rgba(16,185,129,0.3)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="40" y1="110" x2="180" y2="110" stroke="rgba(16,185,129,0.3)" strokeWidth="1" strokeDasharray="4 4" />
            {/* Boom anchors */}
            <circle cx="40" cy="110" r="4" fill="#10B981" style={{ animation: 'teal-pulse-v2 1.5s infinite' }} />
            <circle cx="180" cy="110" r="4" fill="#10B981" style={{ animation: 'teal-pulse-v2 1.5s infinite 0.5s' }} />
          </svg>
          <div style={{ position: 'absolute', top: '25%', left: '105%', fontFamily: T.fontMono, fontSize: 10, color: '#10B981', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            [OPR] ALPHA-BOOM DEPLOYED
          </div>
        </div>
      )}

      {/* ── Containment Strategy Panel (Right side) ── */}
      <div className="panel-slide-in" style={{ position: 'absolute', top: 80, right: 12, zIndex: 20, width: 335 }}>
        <Panel accentColor={isRejected ? '#F59E0B' : '#10B981'}>
          <PanelHeader
            label={isRejected ? "NO CONTAINMENT REQUIRED" : "CONTAINMENT STRATEGY"}
            color={isRejected ? '#F59E0B' : '#10B981'}
            sub={isRejected ? "Target classified as natural biogenic film" : "Coast Guard Operation Room Link"}
            live={!isRejected}
          />

          {isRejected ? (
             <div style={{ padding: '14px', backgroundColor: 'rgba(245,158,11,0.05)' }}>
               <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.amber, fontWeight: 700, marginBottom: 7 }}>
                 SAR AUDIT FAILED — NO SLICK PRESENT
               </div>
               <div style={{ fontFamily: T.fontSans, fontSize: 11, color: T.bodyText, lineHeight: 1.5 }}>
                 Because the SAR phase rejected this anomaly as a natural look-alike (biogenic film),
                 no physical containment or cleanup operation is necessary. Coast Guard units stand down.
               </div>
             </div>
          ) : (
            <div style={{ padding: '12px 14px' }}>
              {showStats && (
                <div style={{ marginBottom: 16 }}>
                  <SectionLabel>Slick Extent</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, padding: '8px', borderRadius: 2 }}>
                      <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 4 }}>Total Area</div>
                      <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 700, color: T.brightText }}>{area.toFixed(2)} <span style={{ fontSize: 10, color: T.midText }}>km²</span></div>
                    </div>
                    <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, padding: '8px', borderRadius: 2 }}>
                      <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 4 }}>Est. Volume</div>
                      <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 700, color: T.brightText }}>{(area * 0.45).toFixed(1)} <span style={{ fontSize: 10, color: T.midText }}>bbl</span></div>
                    </div>
                  </div>
                </div>
              )}

              {showPhysics && (
                <div style={{ marginBottom: 16 }}>
                  <SectionLabel>Forward Drift Physics</SectionLabel>
                  <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 2, padding: '4px 0' }}>
                    <DataRow label="Wind Source" value={windSource} mono={false} />
                    <DataRow label="Currents Source" value={currentsSource} mono={false} />
                    <DataRow label="Wind Drift Factor" value={`${(windFactor * 100).toFixed(1)}%`} />
                    <DataRow label="Current Drift Vel." value={`${driftVelocity} m/s`} valueColor={T.sky} borderBottom={false} />
                  </div>
                </div>
              )}

              {showVessels && (
                <div>
                  <SectionLabel>Deployed Response Units</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { name: 'ICGS SANKALP (CG 46)', role: 'Command & Skimming', eta: 'T-15m' },
                      { name: 'CG DO-228', role: 'Aerial Dispersant', eta: 'On Scene' },
                    ].map((v, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgElevated, border: `1px solid ${T.border}`, padding: '6px 10px', borderRadius: 2, animation: 'fadeIn 0.3s ease forwards', animationDelay: `${i * 100}ms` }}>
                        <div>
                          <div style={{ fontFamily: T.fontSans, fontSize: 11, fontWeight: 600, color: T.brightText }}>{v.name}</div>
                          <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.midText, marginTop: 2 }}>{v.role}</div>
                        </div>
                        <div style={{ fontFamily: T.fontMono, fontSize: 10, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 2 }}>
                          {v.eta}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
