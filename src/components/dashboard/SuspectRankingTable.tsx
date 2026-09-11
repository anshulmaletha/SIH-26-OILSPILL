import { useState, useEffect, useRef } from "react";
import type { P3Output } from "@/lib/contracts/p3";
import { Panel, PanelHeader, ScoreBar, T } from "@/components/ui/PanelKit";

export interface SuspectRankingTableProps {
  p3Data?: P3Output;
  selectedVesselId?: string;
  expandedVesselId?: string;
  onSelectVessel?: (vesselId: string) => void;
  onSetExpandedVessel?: (vesselId: string | null) => void;
  isLoading?: boolean;
}

function RankBadge({ rank }: { rank: number }) {
  const isTop = rank === 1;
  const isSecond = rank === 2;
  const color = isTop ? T.sky : isSecond ? T.amber : T.midText;
  const bg = isTop ? "rgba(56,189,248,0.1)" : isSecond ? "rgba(245,158,11,0.1)" : T.bgElevated;

  return (
    <span style={{
      fontFamily: T.fontMono, fontSize: 10, color, background: bg,
      border: `1px solid ${color}55`, padding: "2px 6px", borderRadius: 2,
      fontWeight: 700, flexShrink: 0
    }}>
      #{rank}
    </span>
  );
}

export function SuspectRankingTable({
  p3Data,
  selectedVesselId,
  expandedVesselId,
  onSelectVessel,
  onSetExpandedVessel,
  isLoading = false,
}: SuspectRankingTableProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const suspects = p3Data?.suspects || [];

  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!selectedVesselId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-vessel-id="${selectedVesselId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedVesselId]);

  return (
    <Panel style={{ width: 300 }}>
      <PanelHeader
        label={`Suspect Ranking (${suspects.length})`}
        color={T.dimText}
        compact
        right={
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ background: 'none', border: 'none', color: T.dimText, cursor: 'pointer', fontSize: 10 }}
          >
            {isCollapsed ? "▼" : "▲"}
          </button>
        }
      />

      <div style={{ maxHeight: isCollapsed ? 0 : 500, overflow: "hidden", transition: "max-height 220ms ease" }}>
        <div className="custom-scrollbar" style={{ padding: "8px 10px", maxHeight: 450, overflowY: "auto" }}>
          {isLoading ? (
            <div style={{ padding: "24px 0", textAlign: "center", fontFamily: T.fontMono, fontSize: 11, color: T.dimText, animation: "pulse-ring-inner 1s infinite" }}>
              Evaluating corridor overlap…
            </div>
          ) : suspects.length === 0 ? (
            <div style={{ border: `1px solid ${T.amber}44`, background: `${T.amber}0A`, padding: 12, borderRadius: 2 }}>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.amber, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Null Result · 0 Overlaps
              </div>
              <div style={{ fontFamily: T.fontSans, fontSize: 12, color: T.brightText, fontWeight: 600, marginBottom: 4 }}>
                No Suspect Identified
              </div>
              <p style={{ fontFamily: T.fontSans, fontSize: 11, color: T.midText, lineHeight: 1.5, margin: 0 }}>
                All monitored AIS trajectories cleared — separation &gt;14.8 nm from backtracked origin.
              </p>
            </div>
          ) : (
            <ul ref={listRef} style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {suspects.map((suspect) => {
                const isSelected = selectedVesselId === suspect.vesselId;
                const isExpanded = expandedVesselId === suspect.vesselId;
                const scorePercent = suspect.overallScore; // 0 to 1

                return (
                  <li
                    key={suspect.vesselId}
                    data-vessel-id={suspect.vesselId}
                    style={{
                      marginBottom: 6,
                      border: `1px solid ${isSelected ? T.sky : T.border}`,
                      background: isSelected ? "rgba(56,189,248,0.05)" : T.bgPanel,
                      borderRadius: 2,
                      overflow: "hidden",
                      transition: "border-color 200ms, background 200ms",
                    }}
                  >
                    <div onClick={() => onSelectVessel?.(suspect.vesselId)} style={{ padding: "10px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <RankBadge rank={suspect.rank} />
                        <span style={{ fontFamily: T.fontSans, fontSize: 12, color: T.brightText, fontWeight: 600, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {suspect.vesselName}
                        </span>
                        <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.sky, fontWeight: 700 }}>
                          {Math.round(scorePercent * 100)}%
                        </span>
                      </div>

                      <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.midText, marginBottom: 8 }}>
                        {suspect.mmsi ? `MMSI ${suspect.mmsi}` : "SAR-only · No MMSI"}
                      </div>

                      {suspect.isDarkVessel && (
                        <div style={{ display: "inline-block", background: "rgba(245,158,11,0.1)", border: `1px solid rgba(245,158,11,0.4)`, padding: "3px 6px", borderRadius: 2, marginBottom: 8 }}>
                          <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.amber, textTransform: "uppercase" }}>
                            ⚠ AIS Transponder Gap Anomaly
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: `1px solid ${T.border}`, padding: "6px 10px", display: "flex", justifyContent: "space-between", background: T.bgHeader }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSetExpandedVessel?.(isExpanded ? null : suspect.vesselId); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: T.fontMono, fontSize: 10, color: T.sky, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        {isExpanded ? "▲ Hide Scores" : "▼ Feature Scores"}
                      </button>
                      <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.dimText }}>Conf {(suspect.confidence * 100).toFixed(0)}%</span>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "10px", background: T.bgElevated, borderTop: `1px solid ${T.border}`, animation: "fadeIn 0.2s ease" }}>
                        <ScoreBar label="Corridor Overlap" value={suspect.featureScores.trajectoryIntersection} />
                        <ScoreBar label="Temporal Match" value={suspect.featureScores.temporalProximity} />
                        <ScoreBar label="Speed Anomaly" value={suspect.featureScores.speedAnomaly} />
                        <ScoreBar label="AIS Gap Score" value={suspect.featureScores.aisGapScore} />
                        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, marginTop: 8, fontFamily: T.fontSans, fontSize: 11, color: T.bodyText, lineHeight: 1.4 }}>
                          {suspect.recommendation}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default SuspectRankingTable;
