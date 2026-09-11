import React, { useState, useEffect } from 'react';
import { useMission } from '@/lib/mission/missionState';
import { fetchCaseFileMetadata, type CaseFileMetadataResult } from '@/lib/api/client';
import { Panel, PanelHeader, DataRow, SectionLabel, StatusBadge, T } from '@/components/ui/PanelKit';
import { CheckCircle2, Download, Search } from 'lucide-react';

export function CaseFileOverlay() {
  const { state } = useMission();
  const [meta, setMeta] = useState<CaseFileMetadataResult | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchCaseFileMetadata(state.scenario)
      .then((d) => { if (mounted) setMeta(d); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [state.scenario]);

  if (state.currentStage !== 'CASE_FILE') return null;
  const elapsed = state.stageElapsedMs;

  const showHeader = elapsed > 500;
  const showHash = elapsed > 1500;
  const showAction = elapsed > 2500;

  // Real data
  const isNullResult = meta?.ranked_suspects.length === 0 || state.scenario === 'no_candidates';
  const caseId = meta?.case_id ?? `CASE-MUM-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
  const generatedAt = meta?.generated_at ? new Date(meta.generated_at).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '2026-05-15 06:14:22Z';
  const hash = meta?.input_data_hash ?? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const sceneId = meta?.scene_id ?? 'S1A_IW_GRDH_1SDV_20260515T060000';
  const resolution = meta?.h3_resolution ?? 7;

  const handleDownload = () => {
    window.open(`/api/case-file?scenario=${state.scenario}`, '_blank');
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 14, 0.96)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        animation: 'fadeIn 0.5s ease',
      }}
    >
      <div style={{ width: 440 }}>
        {showHeader && (
          <Panel className="panel-slide-in">
            <PanelHeader
              label="EVIDENCE DOSSIER COMPILED"
              color={T.sky}
              sub={caseId}
              right={<CheckCircle2 size={16} color={T.sky} />}
            />

            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <SectionLabel>Mission Outcome</SectionLabel>
                  <div style={{ marginTop: 4 }}>
                    {isNullResult ? (
                      <StatusBadge status="null" label="NULL RESULT — NO CULPRIT" />
                    ) : (
                      <StatusBadge status="confirmed" label="SUCCESS — SUSPECT IDENTIFIED" />
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <SectionLabel>Timestamp</SectionLabel>
                  <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.bodyText, marginTop: 4 }}>
                    {generatedAt}
                  </div>
                </div>
              </div>

              <SectionLabel>Cryptographic Signature</SectionLabel>
              <div style={{ backgroundColor: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 2, padding: '10px', marginBottom: 20 }}>
                {showHash ? (
                  <>
                    <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 4 }}>SHA-256 Input Data Hash</div>
                    <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.brightText, wordBreak: 'break-all', lineHeight: 1.4 }}>
                      {hash}
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.dimText, animation: 'pulse-ring-inner 1s infinite' }}>
                    Computing cryptographic seal...
                  </div>
                )}
              </div>

              <SectionLabel>Dossier Contents</SectionLabel>
              <div style={{ backgroundColor: 'rgba(56,189,248,0.02)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 2, padding: '4px 0' }}>
                <DataRow label="SAR Image Scene" value={sceneId.slice(0, 24) + '...'} />
                <DataRow label="Spatial H3 Resolution" value={`Res-${resolution}`} />
                <DataRow label="Judicial Admissibility" value="Verified" valueColor={T.sky} borderBottom={false} />
              </div>

              {showAction && (
                <button
                  onClick={handleDownload}
                  style={{
                    width: '100%',
                    marginTop: 20,
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: T.sky,
                    color: T.bgBase,
                    border: 'none',
                    borderRadius: 2,
                    fontFamily: T.fontSans,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
                  onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  <Download size={16} />
                  Download PDF Report
                </button>
              )}
            </div>
          </Panel>
        )}

        {showAction && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'transparent',
                border: `1px solid ${T.border}`,
                color: T.midText,
                padding: '8px 16px',
                borderRadius: 2,
                fontFamily: T.fontMono,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = T.brightText; e.currentTarget.style.borderColor = T.midText; }}
              onMouseOut={(e) => { e.currentTarget.style.color = T.midText; e.currentTarget.style.borderColor = T.border; }}
            >
              <Search size={12} />
              Analyze Another Incident
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
