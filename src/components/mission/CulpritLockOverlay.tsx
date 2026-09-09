/**
 * Phase 5: CULPRIT_LOCK
 * Multi-factor attribution scoring HUD and final culprit identification.
 * Camera is locked onto the primary suspect vessel.
 */

import { useMission } from "@/lib/mission/missionState";

interface ScoreFactor {
  key: string;
  label: string;
  shortLabel: string;
  value: number; // 0-1
  displayPct: string;
  color: string;
  note: string;
}

const SCORE_FACTORS: ScoreFactor[] = [
  {
    key: "time",
    label: "Temporal Proximity",
    shortLabel: "S_time",
    value: 0.9444,
    displayPct: "94.4%",
    color: "#22D3EE",
    note: "T-9h speed anomaly within corridor",
  },
  {
    key: "dist",
    label: "Corridor Geometric Intersection",
    shortLabel: "S_dist",
    value: 1.0,
    displayPct: "100%",
    color: "#22D3EE",
    note: "H3 k=0 cell overlap confirmed",
  },
  {
    key: "type",
    label: "Vessel Profile Risk (Aframax crude)",
    shortLabel: "S_type",
    value: 0.95,
    displayPct: "95.0%",
    color: "#22D3EE",
    note: "Crude oil tanker — high prior probability",
  },
  {
    key: "dark",
    label: "AIS Gap Anomaly",
    shortLabel: "P_dark",
    value: 0.25,
    displayPct: "+25%",
    color: "#F59E0B",
    note: "3.4h blackout over discharge origin",
  },
];

const FINAL_SCORE = 0.912;
const CULPRIT_NAME = "MT IND_TANKER_412";
const CULPRIT_IMO = "9384124";
const CULPRIT_MMSI = "419000101";

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
          transform: `scaleX(${value})`,
          transition: `transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
        }}
      />
    </div>
  );
}

export function CulpritLockOverlay() {
  const { state } = useMission();

  if (state.currentStage !== "CULPRIT_LOCK") return null;

  const elapsed = state.stageElapsedMs;

  // Reveal each factor row sequentially
  const factorRevealMs = [0, 1200, 2400, 3600];
  const visibleFactors = SCORE_FACTORS.filter((_, i) => elapsed > (factorRevealMs[i] ?? 9999));

  // Final score rolls up from 0 to 91.2 after all factors shown (4800ms)
  const scoreRevealProgress = Math.min(1, Math.max(0, (elapsed - 5000) / 800));
  const displayScore = (FINAL_SCORE * scoreRevealProgress * 100).toFixed(1);

  // Culprit badge appears after score fully revealed (5800ms)
  const showCulprit = elapsed > 5800;

  // Targeting reticle pulses from the start
  const reticleOpacity = Math.min(1, elapsed / 500);

  return (
    <>
      {/* ── Targeting reticle (centered, overlaying map) ── */}
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
          {/* Top tick */}
          <line x1="50" y1="2" x2="50" y2="18" stroke="#EF4444" strokeWidth="1.5" />
          {/* Bottom tick */}
          <line x1="50" y1="82" x2="50" y2="98" stroke="#EF4444" strokeWidth="1.5" />
          {/* Left tick */}
          <line x1="2" y1="50" x2="18" y2="50" stroke="#EF4444" strokeWidth="1.5" />
          {/* Right tick */}
          <line x1="82" y1="50" x2="98" y2="50" stroke="#EF4444" strokeWidth="1.5" />
          {/* Center dot */}
          <circle cx="50" cy="50" r="3" fill="#EF4444" />
        </svg>
      </div>

      {/* ── Attribution scoring panel — right side ── */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 12,
          zIndex: 20,
          width: 300,
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
              color: "#22D3EE",
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
            XGBoost Ensemble v2.4  ·  MMSI 419000101
          </div>
        </div>

        {/* Score factors */}
        <div style={{ padding: "8px 12px" }}>
          {SCORE_FACTORS.map((factor, i) => {
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
                    color: "#3A5268",
                    marginTop: 1,
                    marginBottom: 3,
                  }}
                >
                  {factor.label}
                </div>
                <ScoreBar
                  value={isVisible ? (factor.key === "dark" ? 0.25 : factor.value) : 0}
                  color={factor.color}
                  delay={animDelay}
                />
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    color: factor.key === "dark" ? "#F59E0B" : "#3A5268",
                    marginTop: 3,
                  }}
                >
                  {factor.note}
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#1C2A38", mx: 12 }} />

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
                color: "#E2E8F0",
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
                background: scoreRevealProgress > 0.5 ? "#EF4444" : "#22D3EE",
                transformOrigin: "left center",
                transform: `scaleX(${FINAL_SCORE * scoreRevealProgress})`,
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
              ▶ CULPRIT IDENTIFIED
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
              {CULPRIT_NAME}
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
              <span>IMO: {CULPRIT_IMO}</span>
              <span style={{ color: "#3A5268" }}>·</span>
              <span>MMSI: {CULPRIT_MMSI}</span>
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
              Confidence: {(FINAL_SCORE * 100).toFixed(1)}%  ·  Score: 0.912 / 1.000
            </div>
          </div>
        )}
      </div>
    </>
  );
}
