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

function ScoreBar({ value, color = "#0F172A", delay, isDark = false }: { value: number; color?: string; delay: number; isDark?: boolean }) {
  return (
    <div
      style={{
        height: 3,
        background: isDark ? "#1E293B" : "#E2E8F0",
        marginTop: 4,
        position: "relative",
        borderRadius: 1,
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
          transition: `transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
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

  // Real computed values from scoring engine or fallback defaults
  const totalScorePct = primary ? primary.total_score : 65.72;
  const normalizedScore = primary ? primary.normalized_score : 0.6572;
  const culpritName = primary ? primary.vessel_name : "IND_TANKER_412";
  const culpritMmsi = primary ? primary.vessel_id.replace("MMSI_", "") : "419000101";
  const culpritFlag = primary ? primary.flag : "India (IND)";

  const factors: ScoreFactor[] = [
    {
      key: "corr",
      label: "Corridor Overlap (w=0.40)",
      shortLabel: "w1 · S_corr",
      value: fb ? fb.corridor_overlap_score : 0.1429,
      displayPct: `${((fb ? fb.corridor_overlap_score : 0.1429) * 100).toFixed(1)}%`,
      color: "#0F172A",
      note: "Lagrangian particle dispersion intersection",
    },
    {
      key: "head",
      label: "Heading Alignment (w=0.25)",
      shortLabel: "w2 · S_head",
      value: fb ? fb.heading_alignment_score : 1.0,
      displayPct: `${((fb ? fb.heading_alignment_score : 1.0) * 100).toFixed(1)}%`,
      color: "#0F172A",
      note: "Alignment with SAR slick orientation axis (135°)",
    },
    {
      key: "speed",
      label: "Speed Anomaly (w=0.20)",
      shortLabel: "w3 · S_speed",
      value: fb ? fb.speed_anomaly_score : 1.0,
      displayPct: `${((fb ? fb.speed_anomaly_score : 1.0) * 100).toFixed(1)}%`,
      color: "#0F172A",
      note: "Speed drop from 14.2 to 3.8 kts during corridor transit",
    },
    {
      key: "gap",
      label: "AIS Gap History (w=0.15)",
      shortLabel: "w4 · S_gap",
      value: fb ? fb.ais_gap_history_score : 1.0,
      displayPct: `${((fb ? fb.ais_gap_history_score : 1.0) * 100).toFixed(1)}%`,
      color: "#DC2626",
      note: "3.4h transponder blackout over corridor",
    },
  ];

  // Reveal each factor row sequentially
  const factorRevealMs = [0, 1200, 2400, 3600];

  // Final score rolls up after all factors shown
  const isScoreCalculated = elapsed >= 4800;
  const scoreRevealProgress = Math.min(1, Math.max(0, (elapsed - 4800) / 800));
  const displayScore = isNullResult ? "0.0" : (totalScorePct * scoreRevealProgress).toFixed(1);

  // Culprit badge appears after score fully revealed
  const showCulprit = elapsed > 5600 && !isNullResult;
  const isDark = state.theme === "dark";

  return (
    <>
      {/* ── Attribution scoring panel — right side ── */}
      <div
        style={{
          position: "absolute",
          top: 72,
          right: 16,
          zIndex: 20,
          width: 320,
          background: isDark ? "#0F172A" : "#FFFFFF",
          border: `1px solid ${isDark ? "#1E293B" : "#CBD5E1"}`,
          borderRadius: 2,
          boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            padding: "10px 12px",
            borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
            background: isDark ? "#1E293B" : "#F8FAFC",
          }}
        >
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 9,
              color: isNullResult ? "#DC2626" : (isDark ? "#F8FAFC" : "#0F172A"),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
            }}
          >
            ATTRIBUTION SCORING
          </div>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 8.5,
              color: isDark ? "#94A3B8" : "#64748B",
              marginTop: 2,
            }}
          >
            {suspectsData?.scoring_model || "Weighted Linear Attribution Model"} {isNullResult ? "· RESTRICTION ACTIVE" : `· MMSI ${culpritMmsi}`}
          </div>
        </div>

        {/* Null Result scenario */}
        {isNullResult ? (
          <div style={{ padding: "14px 12px" }}>
            <div
              style={{
                backgroundColor: isDark ? "#281216" : "#FEF2F2",
                border: `1px solid ${isDark ? "#7F1D1D" : "#FECACA"}`,
                padding: "10px 12px",
                borderRadius: "2px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 9,
                  color: "#DC2626",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                NO SUSPECT CORRELATED — RESTRICTION ENFORCED
              </div>
              <div
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: 10,
                  color: isDark ? "#FCA5A5" : "#991B1B",
                  lineHeight: 1.4,
                }}
              >
                All monitored AIS tracks remained clear of the backward dispersion corridor.
                Under evidentiary standards, the system exercises judicial restraint and assigns zero false culpability.
              </div>
            </div>

            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                color: isDark ? "#94A3B8" : "#64748B",
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
              const isCalculated = elapsed >= (factorRevealMs[i] ?? 0);
              const animDelay = (factorRevealMs[i] ?? 0) + 200;
              const factorColor = factor.color === "#0F172A" ? (isDark ? "#F8FAFC" : "#0F172A") : factor.color;

              return (
                <div
                  key={factor.key}
                  style={{
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 9,
                        color: isDark ? "#94A3B8" : "#64748B",
                      }}
                    >
                      {factor.shortLabel}
                    </span>
                    <span
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 10,
                        fontWeight: 700,
                        color: isCalculated ? factorColor : (isDark ? "#64748B" : "#94A3B8"),
                      }}
                    >
                      {isCalculated ? factor.displayPct : "Evaluating…"}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: 10,
                      color: isDark ? "#F8FAFC" : "#0F172A",
                      marginTop: 1,
                      marginBottom: 3,
                      fontWeight: 500,
                    }}
                  >
                    {factor.label}
                  </div>
                  <ScoreBar
                    value={isCalculated ? factor.value : 0}
                    color={factorColor}
                    delay={animDelay}
                    isDark={isDark}
                  />
                  <div
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 8,
                      color: factor.key === "gap" ? "#DC2626" : (isDark ? "#94A3B8" : "#64748B"),
                      marginTop: 3,
                    }}
                  >
                    {isCalculated ? factor.note : "Awaiting input telemetry…"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: isDark ? "#1E293B" : "#E2E8F0" }} />

        {/* Final score */}
        <div
          style={{
            padding: "10px 12px",
            background: isDark ? "#1E293B" : "#F8FAFC",
            borderTop: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
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
                fontFamily: "ui-monospace, monospace",
                fontSize: 9,
                color: isDark ? "#94A3B8" : "#64748B",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              ATTRIBUTION SCORE
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: isScoreCalculated ? 24 : 14,
                fontWeight: 700,
                color: isNullResult ? (isDark ? "#94A3B8" : "#64748B") : (isDark ? "#F8FAFC" : "#0F172A"),
                letterSpacing: "-0.02em",
              }}
            >
              {isScoreCalculated ? `${displayScore}%` : "Computing…"}
            </span>
          </div>
          <div
            style={{
              height: 3,
              background: isDark ? "#334155" : "#E2E8F0",
              marginTop: 6,
              position: "relative",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: isNullResult ? (isDark ? "#94A3B8" : "#64748B") : (scoreRevealProgress > 0.5 ? "#DC2626" : (isDark ? "#F8FAFC" : "#0F172A")),
                transformOrigin: "left center",
                transform: `scaleX(${isScoreCalculated ? (isNullResult ? 0 : normalizedScore * scoreRevealProgress) : 0})`,
                transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>

        {/* Culprit identification badge */}
        {showCulprit && (
          <div
            style={{
              padding: "10px 12px",
              borderTop: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
              background: isDark ? "#0F172A" : "#FFFFFF",
              borderLeft: "3px solid #DC2626",
            }}
          >
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                color: "#DC2626",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              PRIMARY NOMINATED SUSPECT
            </div>
            <div
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: 13,
                fontWeight: 700,
                color: isDark ? "#F8FAFC" : "#0F172A",
                letterSpacing: "-0.01em",
              }}
            >
              {culpritName}
            </div>
            <div
              style={{
                marginTop: 3,
                display: "flex",
                gap: 8,
                fontFamily: "ui-monospace, monospace",
                fontSize: 9,
                color: isDark ? "#94A3B8" : "#64748B",
              }}
            >
              <span>Flag: {culpritFlag}</span>
              <span style={{ color: isDark ? "#334155" : "#CBD5E1" }}>·</span>
              <span>MMSI: {culpritMmsi}</span>
            </div>
            <div
              style={{
                marginTop: 6,
                padding: "4px 8px",
                background: isDark ? "#1E293B" : "#F1F5F9",
                border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                borderRadius: 2,
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                color: isDark ? "#F8FAFC" : "#0F172A",
              }}
            >
              Attribution: {totalScorePct.toFixed(1)}% · Normalized Score: {normalizedScore.toFixed(3)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
