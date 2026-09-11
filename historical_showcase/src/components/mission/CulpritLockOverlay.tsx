/**
 * Phase 5: CULPRIT_LOCK
 * Multi-factor attribution scoring HUD and final culprit identification.
 * Camera is locked onto the primary suspect vessel.
 */

import React, { useState, useEffect } from "react";
import { useMission } from "@/lib/mission/missionState";
import { fetchSuspects, type SuspectsResult } from "@/lib/api/client";

interface ScoreFactor {
  key: string;
  label: string;
  shortLabel: string;
  value: number; // 0-1
  displayPct: string;
  color: string;
  note: string;
}

function ScoreBar({ value, color, delay }: { value: number; color: string; delay: number }) {
  return (
    <div
      style={{
        height: 2,
        background: "#1C2A38",
        marginTop: 4,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          transformOrigin: "left center",
          transform: `scaleX(${Math.max(0, Math.min(1, value))})`,
          transition: `transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
        }}
      />
    </div>
  );
}

export function CulpritLockOverlay() {
  const { state } = useMission();
  const [suspectsData, setSuspectsData] = useState<SuspectsResult | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchSuspects(state.scenario)
      .then((data) => {
        if (mounted) setSuspectsData(data);
      })
      .catch((err) => {
        console.warn("Could not fetch suspects from API:", err);
      });
    return () => {
      mounted = false;
    };
  }, [state.scenario]);

  if (state.currentStage !== "CULPRIT_LOCK") return null;

  const elapsed = state.stageElapsedMs;
  const isNullResult = suspectsData?.null_result || (suspectsData && suspectsData.ranked_suspects.length === 0);

  const primary = suspectsData?.ranked_suspects?.[0];
  const fb = primary?.feature_breakdown;

  // Real computed values from scoring engine or fallback defaults.
  // Kerala's static case file uses a flatter schema (mmsi/final_score) than
  // the live Mumbai scoring engine (vessel_id/total_score/normalized_score),
  // so fall back across both shapes rather than assuming vessel_id exists.
  const totalScorePct = primary ? (primary.total_score ?? primary.final_score ?? 0) : 65.72;
  const normalizedScore = primary
    ? (primary.normalized_score ?? (typeof primary.final_score === "number" ? primary.final_score / 100 : 0))
    : 0.6572;
  const culpritName = primary ? primary.vessel_name : "IND_TANKER_412";
  const culpritMmsi = primary
    ? String(primary.vessel_id ?? primary.mmsi ?? "").replace("MMSI_", "")
    : "419000101";
  const culpritFlag = primary ? primary.flag : "India (IND)";

  const factors: ScoreFactor[] = [
    {
      key: "corr",
      label: "Corridor Overlap (w=0.40)",
      shortLabel: "w1 · S_corr",
      value: fb ? fb.corridor_overlap_score : 0.1429,
      displayPct: `${((fb ? fb.corridor_overlap_score : 0.1429) * 100).toFixed(1)}%`,
      color: "#22D3EE",
      note: "Lagrangian particle dispersion intersection",
    },
    {
      key: "head",
      label: "Heading Alignment (w=0.25)",
      shortLabel: "w2 · S_head",
      value: fb ? fb.heading_alignment_score : 1.0,
      displayPct: `${((fb ? fb.heading_alignment_score : 1.0) * 100).toFixed(1)}%`,
      color: "#22D3EE",
      note: "Alignment with SAR slick orientation axis (135°)",
    },
    {
      key: "speed",
      label: "Speed Anomaly (w=0.20)",
      shortLabel: "w3 · S_speed",
      value: fb ? fb.speed_anomaly_score : 1.0,
      displayPct: `${((fb ? fb.speed_anomaly_score : 1.0) * 100).toFixed(1)}%`,
      color: "#22D3EE",
      note: "Speed drop from 14.2 to 3.8 kts during corridor transit",
    },
    {
      key: "gap",
      label: "AIS Gap History (w=0.15)",
      shortLabel: "w4 · S_gap",
      value: fb ? fb.ais_gap_history_score : 1.0,
      displayPct: `${((fb ? fb.ais_gap_history_score : 1.0) * 100).toFixed(1)}%`,
      color: "#F59E0B",
      note: "3.4h transponder blackout over corridor",
    },
  ];

  // Reveal each factor row sequentially
  const factorRevealMs = [0, 1200, 2400, 3600];
  const visibleFactors = factors.filter((_, i) => elapsed > (factorRevealMs[i] ?? 9999));

  // Final score rolls up after all factors shown
  const scoreRevealProgress = Math.min(1, Math.max(0, (elapsed - 5000) / 800));
  const displayScore = isNullResult ? "0.0" : (totalScorePct * scoreRevealProgress).toFixed(1);

  // Culprit badge appears after score fully revealed
  const showCulprit = elapsed > 5800 && !isNullResult;

  // Targeting reticle pulses only if candidate exists
  const reticleOpacity = isNullResult ? 0 : Math.min(1, elapsed / 500);

  return (
    <>
      {/* ── Center target crosshair — left side ── */}
      {!isNullResult && state.scenario !== "kerala" && (
        <div
          style={{
            position: "absolute",
            top: "45%",
            left: "42%",
            transform: "translate(-50%, -50%)",
            zIndex: 18,
            pointerEvents: "none",
            opacity: reticleOpacity,
          }}
        >
          {/* Outer ring */}
          <div
            style={{
              position: "absolute",
              width: 80,
              height: 80,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              border: "1px solid #EF4444",
              borderRadius: "50%",
              animation: "culprit-ring-pulse 1.5s ease-in-out infinite",
            }}
          />
          {/* Inner ring */}
          <div
            style={{
              position: "absolute",
              width: 50,
              height: 50,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              border: "1px solid #EF444480",
              borderRadius: "50%",
              animation: "culprit-ring-pulse 1.5s ease-in-out 0.3s infinite",
            }}
          />
          {/* Crosshair lines */}
          <svg width="100" height="100" viewBox="0 0 100 100" style={{ position: "relative" }}>
            <line x1="50" y1="2" x2="50" y2="18" stroke="#EF4444" strokeWidth="1.5" />
            <line x1="50" y1="82" x2="50" y2="98" stroke="#EF4444" strokeWidth="1.5" />
            <line x1="2" y1="50" x2="18" y2="50" stroke="#EF4444" strokeWidth="1.5" />
            <line x1="82" y1="50" x2="98" y2="50" stroke="#EF4444" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="3" fill="#EF4444" />
          </svg>
        </div>
      )}

      {/* ── Attribution scoring panel — right side ── */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 12,
          zIndex: 20,
          width: 320,
          background: "#0D1117",
          border: "1px solid #1C2A38",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid #1C2A38",
            background: "#111822",
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: isNullResult ? "#F59E0B" : "#22D3EE",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            ATTRIBUTION SCORING
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8,
              color: "#5A7A94",
              marginTop: 2,
            }}
          >
            {suspectsData?.scoring_model || "Weighted Rule-Based Attribution Model"} {isNullResult ? "· RESTRICTION ACTIVE" : `· MMSI ${culpritMmsi}`}
          </div>
        </div>

        {/* Kerala Historical Validation scenario */}
        {state.scenario === "kerala" ? (
          <div style={{ padding: "14px 12px" }}>
            <div
              style={{
                backgroundColor: "rgba(34,211,238,0.06)",
                border: "1px solid rgba(34,211,238,0.3)",
                padding: "10px 12px",
                borderRadius: "2px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: "#22D3EE",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                Vessel Status: MSC Elsa 3
              </div>
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 10,
                  color: "#E2E8F0",
                  lineHeight: 1.5,
                }}
              >
                Confirmed sunk, historical record match. No suspect ranking applicable.
              </div>
            </div>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 10,
                color: "#5A7A94",
                lineHeight: 1.4,
              }}
            >
              This stage validates the backward drift corridor prediction error against the documented wreck coordinates. Attribution modeling is bypassed.
            </div>
          </div>
        ) : isNullResult ? (
          <div style={{ padding: "14px 12px" }}>
            <div
              style={{
                backgroundColor: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.3)",
                padding: "10px 12px",
                borderRadius: "2px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: "#F59E0B",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 6,
                }}
              >
                NO SUSPECT CORRELATED — RESTRICTION ENFORCED
              </div>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  color: "#C8D8E8",
                  lineHeight: 1.4,
                }}
              >
                All monitored AIS tracks remained clear of the backward dispersion corridor.
                Under evidentiary standards, the system exercises judicial restraint and assigns zero false culpability.
              </div>
            </div>

            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#5A7A94",
                lineHeight: 1.5,
              }}
            >
              Status: UNCORRELATED OBSERVATION
              <br />
              Action: Retain corridor parameters for dark vessel cross-referencing.
            </div>
          </div>
        ) : (
          /* Normal Scored Factors */
          <div style={{ padding: "8px 12px" }}>
            {factors.map((factor, i) => {
              const isVisible = visibleFactors.includes(factor);
              const animDelay = (factorRevealMs[i] ?? 0) + 400;

              return (
                <div
                  key={factor.key}
                  style={{
                    marginBottom: 10,
                    opacity: isVisible ? 1 : 0,
                    transition: "opacity 0.4s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        color: "#5A7A94",
                      }}
                    >
                      {factor.shortLabel}
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        fontWeight: 700,
                        color: factor.color,
                      }}
                    >
                      {factor.displayPct}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 9,
                      color: "#C8D8E8",
                      marginTop: 1,
                      marginBottom: 3,
                    }}
                  >
                    {factor.label}
                  </div>
                  <ScoreBar
                    value={isVisible ? factor.value : 0}
                    color={factor.color}
                    delay={animDelay}
                  />
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 8,
                      color: factor.key === "gap" ? "#F59E0B" : "#5A7A94",
                      marginTop: 3,
                    }}
                  >
                    {factor.note}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "#1C2A38" }} />

        {/* Final score */}
        <div
          style={{
            padding: "10px 12px",
            borderTop: "1px solid #1C2A38",
            background: "#111822",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#5A7A94",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              ATTRIBUTION SCORE
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 26,
                fontWeight: 800,
                color: isNullResult ? "#5A7A94" : "#E2E8F0",
                letterSpacing: "-0.02em",
                transition: "color 0.3s",
              }}
            >
              {displayScore}%
            </span>
          </div>
          <div
            style={{
              height: 3,
              background: "#1C2A38",
              marginTop: 6,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: isNullResult ? "#3A5268" : (scoreRevealProgress > 0.5 ? "#EF4444" : "#22D3EE"),
                transformOrigin: "left center",
                transform: `scaleX(${isNullResult ? 0 : normalizedScore * scoreRevealProgress})`,
                transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>

        {/* Culprit identification badge */}
        {showCulprit && (
          <div
            style={{
              padding: "10px 12px",
              borderTop: "1px solid #EF444430",
              background: "#EF444408",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#EF4444",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 6,
              }}
            >
              ▶ PRIMARY SUSPECT IDENTIFIED
            </div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "#E2E8F0",
                letterSpacing: "-0.01em",
              }}
            >
              {culpritName}
            </div>
            <div
              style={{
                marginTop: 4,
                display: "flex",
                gap: 8,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#5A7A94",
              }}
            >
              <span>Flag: {culpritFlag}</span>
              <span style={{ color: "#3A5268" }}>·</span>
              <span>MMSI: {culpritMmsi}</span>
            </div>
            <div
              style={{
                marginTop: 6,
                padding: "4px 8px",
                background: "#EF444415",
                border: "1px solid #EF444430",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#F87171",
              }}
            >
              Total Score: {totalScorePct.toFixed(1)}%  ·  Normalized: {normalizedScore.toFixed(3)} / 1.000
            </div>
          </div>
        )}
      </div>
    </>
  );
}
