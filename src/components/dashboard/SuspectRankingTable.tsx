import { useState, useEffect, useRef } from "react";
import type { P3Output, RankedSuspect } from "@/lib/contracts/p3";

export interface SuspectRankingTableProps {
  p3Data?: P3Output | undefined;
  selectedVesselId?: string | undefined;
  expandedVesselId?: string | undefined;
  onSelectVessel?: ((vesselId: string) => void) | undefined;
  onSetExpandedVessel?: ((vesselId: string | null) => void) | undefined;
  isLoading?: boolean | undefined;
}

// Rank badge — #1 gets cyan (primary), others amber (caution) or neutral
function RankBadge({ rank }: { rank: number }) {
  const color =
    rank === 1 ? "#22D3EE" :
    rank === 2 ? "#F59E0B" :   // amber = caution rank
    "#5A7A94";
  const bg =
    rank === 1 ? "#22D3EE18" :
    rank === 2 ? "#F59E0B14" :
    "#5A7A9414";

  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "9px",
        color,
        background: bg,
        border: `1px solid ${color}55`,
        padding: "1px 5px",
        borderRadius: 0,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      #{rank}
    </span>
  );
}

// Animated score bar that fills from 0 → value on mount/expand
function ScoreBar({
  value,
  label,
  animate,
}: {
  value: number;
  label: string;
  animate: boolean;
}) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (animate) {
      // Tiny delay so transition is visible
      const t = setTimeout(() => setWidth(value * 100), 30);
      return () => clearTimeout(t);
    } else {
      setWidth(0);
      return undefined;
    }
  }, [animate, value]);

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "9px",
            color: "#5A7A94",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            color: "#C8D8E8",
            fontWeight: 600,
          }}
        >
          {Math.round(value * 100)}%
        </span>
      </div>
      <div
        style={{
          height: 2,
          background: "#1C2A38",
          borderRadius: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${width}%`,
            background: "#22D3EE",
            borderRadius: 0,
            transition: "width 500ms cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
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
    <div
      style={{
        width: 280,
        background: "#0D1117",
        border: "1px solid #1C2A38",
        borderRadius: "2px",
        color: "#C8D8E8",
        fontFamily: "'Inter', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "#0A0E14",
          borderBottom: "1px solid #1C2A38",
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "8px",
              color: "#3A5268",
              textTransform: "uppercase" as const,
              letterSpacing: "0.12em",
              fontWeight: 700,
            }}
          >
            Suspect Ranking
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "8px",
              color: "#22D3EE",
              marginLeft: 6,
            }}
          >
            {suspects.length} evaluated
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#3A5268",
            padding: "0 2px",
            fontSize: "10px",
          }}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          maxHeight: isCollapsed ? 0 : 420,
          overflow: "hidden",
          transition: "max-height 220ms ease",
        }}
      >
        <div
          className="custom-scrollbar"
          style={{
            padding: "8px",
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 0",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "1.5px solid #22D3EE",
                  borderTop: "1.5px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  color: "#3A5268",
                }}
              >
                Evaluating corridor overlap…
              </span>
            </div>
          ) : suspects.length === 0 ? (
            /* No-candidate state */
            <div
              style={{
                border: "1px solid #F59E0B44",
                background: "#F59E0B0A",
                padding: "12px",
                borderRadius: "2px",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "8px",
                  color: "#F59E0B",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 6,
                }}
              >
                Null Result · 0 Corridor Overlaps
              </div>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11px",
                  color: "#C8D8E8",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                No Suspect Identified
              </div>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "10px",
                  color: "#5A7A94",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                All monitored AIS trajectories cleared — separation &gt;14.8 nm from backtracked origin.
              </p>
            </div>
          ) : (
            <ul ref={listRef} style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {suspects.map((suspect) => {
                const isSelected = selectedVesselId === suspect.vesselId;
                const isExpanded = expandedVesselId === suspect.vesselId;
                const scorePercent = Math.round(suspect.overallScore * 100);

                return (
                  <li
                    key={suspect.vesselId}
                    data-vessel-id={suspect.vesselId}
                    style={{
                      marginBottom: 5,
                      border: `1px solid ${isSelected ? "#22D3EE" : "#1C2A38"}`,
                      background: isSelected ? "#22D3EE0A" : "#0A0E14",
                      borderRadius: "2px",
                      overflow: "hidden",
                      transition: "border-color 200ms, background 200ms",
                    }}
                  >
                    {/* Main row — click to select vessel */}
                    <div
                      onClick={() => onSelectVessel?.(suspect.vesselId)}
                      style={{
                        padding: "8px 8px 6px",
                        cursor: "pointer",
                      }}
                    >
                      {/* Name + rank + score */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <RankBadge rank={suspect.rank} />
                        <span
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "11px",
                            color: "#E2E8F0",
                            fontWeight: 600,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {suspect.vesselName}
                        </span>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "11px",
                            color: "#22D3EE",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {scorePercent}%
                        </span>
                      </div>

                      {/* MMSI only (no flag/type per spec — those go in the export) */}
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "9px",
                          color: "#3A5268",
                          marginBottom: 5,
                        }}
                      >
                        {suspect.mmsi ? `MMSI ${suspect.mmsi}` : "SAR-only · No MMSI"}
                      </div>

                      {/* Score bar */}
                      <div
                        style={{
                          height: 2,
                          background: "#1C2A38",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${scorePercent}%`,
                            background: "#22D3EE",
                            transition: "width 400ms ease",
                          }}
                        />
                      </div>

                      {/* Dark vessel anomaly tag — amber (caution) */}
                      {suspect.isDarkVessel && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            marginTop: 5,
                            padding: "3px 6px",
                            background: "#F59E0B10",
                            border: "1px solid #F59E0B44",
                            borderRadius: "2px",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: "8px",
                              color: "#F59E0B",
                              textTransform: "uppercase" as const,
                              letterSpacing: "0.08em",
                            }}
                          >
                            ⚠ AIS Transponder Gap Anomaly
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Expand/collapse toggle */}
                    <div
                      style={{
                        borderTop: "1px solid #1C2A38",
                        padding: "4px 8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#0D1117",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetExpandedVessel?.(isExpanded ? null : suspect.vesselId);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "8.5px",
                          color: "#22D3EE",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {isExpanded ? "▲ Hide Scores" : "▼ Feature Scores"}
                      </button>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "8px",
                          color: "#3A5268",
                        }}
                      >
                        Conf {(suspect.confidence * 100).toFixed(0)}%
                      </span>
                    </div>

                    {/* Accordion — feature score breakdown, animated bars */}
                    <div
                      style={{
                        maxHeight: isExpanded ? 200 : 0,
                        overflow: "hidden",
                        transition: "max-height 300ms cubic-bezier(0.4,0,0.2,1)",
                      }}
                    >
                      <div
                        style={{
                          padding: "8px 8px 6px",
                          borderTop: "1px solid #1C2A38",
                          background: "#080C12",
                        }}
                      >
                        <ScoreBar
                          label="Corridor Overlap"
                          value={suspect.featureScores.trajectoryIntersection}
                          animate={isExpanded}
                        />
                        <ScoreBar
                          label="Temporal Match"
                          value={suspect.featureScores.temporalProximity}
                          animate={isExpanded}
                        />
                        <ScoreBar
                          label="Speed Anomaly"
                          value={suspect.featureScores.speedAnomaly}
                          animate={isExpanded}
                        />
                        <ScoreBar
                          label="AIS Gap Score"
                          value={suspect.featureScores.aisGapScore}
                          animate={isExpanded}
                        />
                        <div
                          style={{
                            borderTop: "1px solid #1C2A38",
                            paddingTop: 5,
                            marginTop: 5,
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "9px",
                            color: "#5A7A94",
                            lineHeight: 1.5,
                          }}
                        >
                          {suspect.recommendation}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
