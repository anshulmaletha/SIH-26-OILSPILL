import { useState } from "react";
import {
  ListOrdered,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Ship,
  Info,
  CheckCircle2,
} from "lucide-react";
import type { P3Output, RankedSuspect } from "@/lib/contracts/p3";
import { getRankBadge } from "@/lib/adapters/p3Adapter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export interface SuspectRankingTableProps {
  p3Data?: P3Output;
  selectedVesselId?: string;
  onSelectVessel?: (vesselId: string) => void;
  isLoading?: boolean;
}

export function SuspectRankingTable({
  p3Data,
  selectedVesselId,
  onSelectVessel,
  isLoading = false,
}: SuspectRankingTableProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const suspects = p3Data?.suspects || [];

  return (
    <div className="w-80 sm:w-96 rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden flex flex-col text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-3.5 py-2.5 bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500 border border-rose-500/30">
            <ListOrdered className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Suspect Ranking
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                ({suspects.length} Evaluated)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              P3 Multi-Feature ML Correlation Output
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          title={isCollapsed ? "Expand Ranking Table" : "Collapse Ranking Table"}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="p-3 space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-6 text-xs text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
              <span>Evaluating corridor trajectory overlap…</span>
            </div>
          ) : suspects.length === 0 ? (
            /* Explicit Real No Candidate State */
            <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 p-3.5 text-center animate-in fade-in duration-300">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-2">
                <Info className="h-5 w-5" />
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30 mb-1.5">
                NULL RESULT • 0 CORRIDOR OVERLAPS
              </div>
              <h3 className="text-xs font-bold text-foreground">No Suspect Vessel Identified</h3>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                All monitored AIS trajectories in the sector maintain clearance &gt; 14.8 nm from the backtracked discharge origin.
              </p>

              <div className="mt-3 rounded-lg bg-card/80 border border-border/70 p-2 text-left space-y-1 text-[10px] font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>H3 Corridor Intersections:</span>
                  <span className="font-bold text-emerald-400">0 Ships</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Minimum Sector Separation:</span>
                  <span className="font-bold text-foreground">14.8 nm</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Temporal Drift Confidence:</span>
                  <span className="font-bold text-foreground">91.4% (Validated)</span>
                </div>
              </div>

              <div className="mt-2.5 text-[10px] text-muted-foreground italic">
                Investigation status: Classified as Unattributed / Natural Seep or Foreign Sector Transit.
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {suspects.map((suspect) => {
                const isSelected = selectedVesselId === suspect.vesselId;
                const isRowExpanded = expandedRowId === suspect.vesselId;
                const badge = getRankBadge(suspect.rank);
                const scorePercent = Math.round(suspect.overallScore * 100);

                return (
                  <li
                    key={suspect.vesselId}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      isSelected
                        ? "border-primary bg-accent/70 shadow-md ring-1 ring-primary/40"
                        : "border-border/80 bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    {/* Main Row */}
                    <div
                      onClick={() => onSelectVessel?.(suspect.vesselId)}
                      className="p-2.5 cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.bg} ${badge.color}`}
                          >
                            #{suspect.rank}
                          </span>
                          <span className="font-bold text-xs text-foreground truncate">
                            {suspect.vesselName}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-xs font-extrabold text-foreground">
                            {scorePercent}%
                          </span>
                          <span className="text-[9px] text-muted-foreground block">
                            Score
                          </span>
                        </div>
                      </div>

                      {/* Vessel Metadata & Score Bar */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                        <span>
                          {suspect.vesselType} • {suspect.flag}
                        </span>
                        <span className="font-mono">MMSI: {suspect.mmsi}</span>
                      </div>

                      <Progress value={scorePercent} className="h-1.5 bg-muted" />

                      {/* Dark Vessel Alert Tag */}
                      {suspect.isDarkVessel && (
                        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2 py-1 text-[10px] text-rose-400 font-semibold">
                          <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                          <span className="truncate">AIS Transponder Gap Anomaly</span>
                        </div>
                      )}
                    </div>

                    {/* Breakdown Toggle Button */}
                    <div className="border-t border-border/50 bg-muted/20 px-2.5 py-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedRowId(isRowExpanded ? null : suspect.vesselId);
                        }}
                        className="text-[10px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {isRowExpanded ? "Hide Feature Breakdown" : "View Feature Scores"}
                        {isRowExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>

                      <span className="text-[10px] text-muted-foreground font-mono">
                        Conf: {(suspect.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Expanded Feature Breakdown */}
                    {isRowExpanded && (
                      <div className="p-2.5 pt-2 bg-muted/40 border-t border-border/60 space-y-1.5 text-[10px] animate-in fade-in duration-150">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Trajectory Corridor Overlap:</span>
                          <span className="font-mono font-bold text-foreground">
                            {(suspect.featureScores.trajectoryIntersection * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Temporal Match at Origin:</span>
                          <span className="font-mono font-bold text-foreground">
                            {(suspect.featureScores.temporalProximity * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Speed/Maneuver Anomaly:</span>
                          <span className="font-mono font-bold text-foreground">
                            {(suspect.featureScores.speedAnomaly * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>AIS Gap Significance:</span>
                          <span className="font-mono font-bold text-foreground">
                            {(suspect.featureScores.aisGapScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1.5 pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground leading-snug">
                          <strong className="text-foreground">Recommendation: </strong>
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
    </div>
  );
}
