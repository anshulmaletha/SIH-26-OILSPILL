import { useState, useEffect, useRef } from "react";
import type { P3Output } from "@/lib/contracts/p3";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";
import { ConfidenceIndicator } from "@/components/ui/panel-system/ConfidenceIndicator";

export interface SuspectRankingTableProps {
  p3Data?: P3Output | undefined;
  selectedVesselId?: string | undefined;
  expandedVesselId?: string | undefined;
  onSelectVessel?: ((vesselId: string) => void) | undefined;
  onSetExpandedVessel?: ((vesselId: string | null) => void) | undefined;
  isLoading?: boolean | undefined;
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

  // Auto-scroll to selected vessel
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!selectedVesselId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-vessel-id="${selectedVesselId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedVesselId]);

  return (
    <OperationsPanel
      variant="side"
      borderLeftAccent
      accentColor="cyan"
      className="w-[300px]"
    >
      <PanelHeader
        category="ATTRIBUTION"
        title="SUSPECT RANKING"
        statusText={`${suspects.length} EVALUATED`}
        statusVariant="cyan"
        onCollapse={() => setIsCollapsed(!isCollapsed)}
        isCollapsed={isCollapsed}
      />

      {!isCollapsed && (
        <div
          className="custom-scrollbar"
          style={{
            padding: "8px",
            maxHeight: "440px",
            overflowY: "auto",
          }}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-5 h-5 border-2 border-[#22D3EE] border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-[10px] text-[#5A7A94]">
                Evaluating corridor overlap…
              </span>
            </div>
          ) : suspects.length === 0 ? (
            <div className="p-3 border border-[#F59E0B]/30 bg-[#F59E0B]/[0.05] rounded-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[8px] font-bold text-[#F59E0B] uppercase tracking-wider">
                  NULL RESULT · ZERO OVERLAP
                </span>
                <StatusBadge label="CLEARED" variant="emerald" size="sm" />
              </div>
              <p className="font-sans text-[10px] text-[#5A7A94] leading-relaxed m-0">
                All monitored AIS trajectories cleared — separation &gt;14.8 nm from backtracked origin.
              </p>
            </div>
          ) : (
            <ul ref={listRef} className="list-none m-0 p-0 flex flex-col gap-1.5">
              {suspects.map((suspect) => {
                const isSelected = selectedVesselId === suspect.vesselId;
                const isExpanded = expandedVesselId === suspect.vesselId;
                const scorePercent = Math.round(suspect.overallScore * 100);
                const rankVariant = suspect.rank === 1 ? "red" : suspect.rank === 2 ? "amber" : "dim";

                return (
                  <li
                    key={suspect.vesselId}
                    data-vessel-id={suspect.vesselId}
                    className="rounded-xs border border-[#1C2A38] bg-[#0A0E14] overflow-hidden transition-all"
                    style={{
                      borderColor: isSelected ? "#22D3EE" : "#1C2A38",
                      borderLeft: `3px solid ${suspect.rank === 1 ? "#EF4444" : suspect.rank === 2 ? "#F59E0B" : "#5A7A94"}`,
                    }}
                  >
                    {/* Header line */}
                    <div
                      onClick={() => onSelectVessel?.(suspect.vesselId)}
                      className="p-2.5 cursor-pointer hover:bg-[#111822]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <StatusBadge label={`#${suspect.rank}`} variant={rankVariant} size="sm" />
                          <span className="text-[11px] font-semibold text-[#E2E8F0] truncate font-sans">
                            {suspect.vesselName}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#22D3EE] flex-shrink-0">
                          {scorePercent}%
                        </span>
                      </div>

                      <div className="font-mono text-[8.5px] text-[#5A7A94] mb-2">
                        {suspect.mmsi ? `MMSI: ${suspect.mmsi}` : "SAR CFAR Target · No Broadcasted AIS"}
                      </div>

                      <ConfidenceIndicator
                        value={scorePercent}
                        showPercent={false}
                        color={suspect.rank === 1 ? "red" : "cyan"}
                        height={2}
                      />

                      {suspect.isDarkVessel && (
                        <div className="mt-2 p-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xs flex items-center gap-1.5">
                          <span className="text-[#F59E0B] text-[8px] font-mono font-bold uppercase tracking-wider">
                            ⚠ AIS Transponder Blackout Anomaly
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Features breakdown toggle */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#0D1117] border-t border-[#1C2A38]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetExpandedVessel?.(isExpanded ? null : suspect.vesselId);
                        }}
                        className="text-[8.5px] font-mono uppercase tracking-wider text-[#22D3EE] hover:underline bg-transparent border-none p-0 cursor-pointer"
                      >
                        {isExpanded ? "▲ HIDE FEATURE SCORES" : "▼ VIEW FEATURE SCORES"}
                      </button>
                      <span className="text-[8px] font-mono text-[#5A7A94]">
                        Conf {(suspect.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Feature score bars */}
                    {isExpanded && (
                      <div className="p-2.5 bg-[#080C12] border-t border-[#1C2A38] flex flex-col gap-2">
                        <ConfidenceIndicator
                          label="Corridor Geometric Overlap"
                          value={suspect.featureScores.trajectoryIntersection * 100}
                          color="cyan"
                          height={2}
                        />
                        <ConfidenceIndicator
                          label="Temporal Proximity Match"
                          value={suspect.featureScores.temporalProximity * 100}
                          color="cyan"
                          height={2}
                        />
                        <ConfidenceIndicator
                          label="Speed Drop Anomaly"
                          value={suspect.featureScores.speedAnomaly * 100}
                          color="amber"
                          height={2}
                        />
                        <ConfidenceIndicator
                          label="AIS Gap Blackout Score"
                          value={suspect.featureScores.aisGapScore * 100}
                          color="amber"
                          height={2}
                        />

                        <div className="pt-2 border-t border-[#1C2A38] text-[8.5px] font-sans text-[#5A7A94] leading-relaxed">
                          <strong className="text-[#C8D8E8] font-mono block mb-0.5">RECOMMENDATION:</strong>
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
      )}
    </OperationsPanel>
  );
}

export default SuspectRankingTable;
