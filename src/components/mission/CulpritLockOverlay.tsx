import React from "react";
import { useMission } from "@/lib/mission/missionState";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { MetricRow } from "@/components/ui/panel-system/MetricRow";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";
import { ConfidenceIndicator } from "@/components/ui/panel-system/ConfidenceIndicator";
import { CollapsibleSection } from "@/components/ui/panel-system/CollapsibleSection";

interface ScoreFactor {
  key: string;
  label: string;
  shortLabel: string;
  value: number; // 0-1
  displayPct: string;
  color: "cyan" | "emerald" | "amber" | "red";
  note: string;
}

const SCORE_FACTORS: ScoreFactor[] = [
  {
    key: "time",
    label: "Temporal Proximity",
    shortLabel: "S_time",
    value: 0.9444,
    displayPct: "94.4%",
    color: "cyan",
    note: "T-9h speed drop within spill temporal window",
  },
  {
    key: "dist",
    label: "Corridor Geometric Intersection",
    shortLabel: "S_dist",
    value: 1.0,
    displayPct: "100.0%",
    color: "cyan",
    note: "H3 k=0 cell corridor overlap confirmed",
  },
  {
    key: "type",
    label: "Vessel Profile Risk (Aframax crude)",
    shortLabel: "S_type",
    value: 0.95,
    displayPct: "95.0%",
    color: "cyan",
    note: "Crude oil tanker -- highest prior probability",
  },
  {
    key: "dark",
    label: "AIS Transponder Gap Anomaly",
    shortLabel: "P_dark",
    value: 0.25,
    displayPct: "+25.0%",
    color: "amber",
    note: "3.4h transponder blackout over origin corridor",
  },
];

const FINAL_SCORE = 0.912;
const CULPRIT_NAME = "MT IND_TANKER_412";
const CULPRIT_IMO = "9384124";
const CULPRIT_MMSI = "419000101";

// Keep these constants available for downstream consumers (Case File etc.)
export { CULPRIT_NAME, CULPRIT_IMO, CULPRIT_MMSI, FINAL_SCORE, SCORE_FACTORS };

const WHY_ITEMS = [
  "Temporal match · 3.4h AIS gap at spill time",
  "Corridor intersection confirmed",
  "Crude tanker — highest risk profile",
  "AIS blackout over origin point",
];

export const CulpritLockOverlay: React.FC = () => {
  const { state } = useMission();

  if (state.currentStage !== "CULPRIT_LOCK") return null;

  const elapsed = state.stageElapsedMs;

  const factorRevealMs = [0, 1000, 2000, 3000];
  const visibleFactors = SCORE_FACTORS.filter((_, i) => elapsed > (factorRevealMs[i] ?? 9999));

  const scoreRevealProgress = Math.min(1, Math.max(0, (elapsed - 4200) / 800));
  const displayScore = (FINAL_SCORE * scoreRevealProgress * 100).toFixed(1);
  const showCulprit = elapsed > 5000;
  const reticleOpacity = Math.min(1, elapsed / 400);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      {/* ── 1. TARGETING RETICLE OVER PRIMARY SUSPECT ───────── */}
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

        {/* Crosshair SVG */}
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ position: "relative" }}>
          <line x1="50" y1="2" x2="50" y2="18" stroke="#EF4444" strokeWidth="1.5" />
          <line x1="50" y1="82" x2="50" y2="98" stroke="#EF4444" strokeWidth="1.5" />
          <line x1="2" y1="50" x2="18" y2="50" stroke="#EF4444" strokeWidth="1.5" />
          <line x1="82" y1="50" x2="98" y2="50" stroke="#EF4444" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="3" fill="#EF4444" />
        </svg>

        <div
          style={{
            position: "absolute",
            top: 104,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          <StatusBadge label="TARGET LOCKED" variant="red" pulse />
        </div>
      </div>

      {/* ── 2. RIGHT SIDE: ATTRIBUTION SCORING PANEL ────────── */}
      <div
        style={{
          position: "absolute",
          top: 64,
          right: 14,
          width: 310,
          maxHeight: "calc(100vh - 200px)",
          display: "flex",
          flexDirection: "column",
          pointerEvents: "auto",
        }}
      >
        <OperationsPanel
          variant="side"
          borderLeftAccent
          accentColor="red"
          style={{ maxHeight: "100%", overflowY: "auto" }}
        >
          <PanelHeader
            category="05 · ATTRIBUTION"
            title="CULPRIT IDENTIFIED"
            statusText={showCulprit ? "TARGET LOCKED" : "EVALUATING"}
            statusVariant={showCulprit ? "red" : "amber"}
          />

          {/* ── PRIMARY METRIC BLOCK ── */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #1C2A38",
            }}
          >
            {/* Vessel name */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                color: "#E2E8F0",
                marginBottom: 6,
              }}
            >
              {showCulprit ? CULPRIT_NAME : "···"}
            </div>

            {/* Big score number */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 34,
                fontWeight: 800,
                color: "#EF4444",
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {displayScore}%
            </div>

            {/* Label */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#5A7A94",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              ATTRIBUTION CONFIDENCE
            </div>
          </div>

          {/* ── WHY THIS VESSEL? CHECKLIST ── */}
          {showCulprit && (
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #1C2A38",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: "#5A7A94",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                WHY THIS VESSEL?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {WHY_ITEMS.map((item) => (
                  <div
                    key={item}
                    style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "flex-start" }}
                  >
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11,
                        color: "#10B981",
                        lineHeight: 1.2,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        color: "#C8D8E8",
                        lineHeight: 1.4,
                      }}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SCORE BREAKDOWN (collapsible) ── */}
          <CollapsibleSection label="Score Breakdown">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {visibleFactors.map((factor) => (
                <MetricRow
                  key={factor.key}
                  label={factor.label}
                  value={factor.displayPct}
                  color={factor.color}
                />
              ))}
            </div>

            {/* Overall score bar */}
            <div style={{ marginTop: 10 }}>
              <ConfidenceIndicator
                value={FINAL_SCORE * scoreRevealProgress * 100}
                showPercent={false}
                color={scoreRevealProgress > 0.5 ? "red" : "cyan"}
                height={4}
              />
            </div>
          </CollapsibleSection>
        </OperationsPanel>
      </div>
    </div>
  );
};

export default CulpritLockOverlay;
