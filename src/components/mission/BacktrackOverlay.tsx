import React from "react";
import { useMission } from "@/lib/mission/missionState";
import { getCandidateVessels } from "@/lib/mission/swarmData";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { PanelSection } from "@/components/ui/panel-system/PanelSection";
import { MetricRow } from "@/components/ui/panel-system/MetricRow";
import { MetricCard } from "@/components/ui/panel-system/MetricCard";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";
import { CollapsibleSection } from "@/components/ui/panel-system/CollapsibleSection";

const CLOCK_HOURS = [0, -6, -12, -24];

const SUSPECT_LABELS = [
  { id: "cand-001", name: "MT IND_TANKER_412", type: "Crude Oil Tanker", flag: "IND", level: "high" as const, note: "AIS gap 3.4h · Speed drop detected" },
  { id: "cand-002", name: "DARK VESSEL (CFAR_002)", type: "Unknown (SAR-only)", flag: "—", level: "high" as const, note: "No AIS · Corridor intersection" },
  { id: "cand-003", name: "MT ARABIAN_VENTURE", type: "Crude Oil Tanker", flag: "PAN", level: "moderate" as const, note: "Outer corridor boundary" },
  { id: "cand-004", name: "MV COASTAL_SPIRIT", type: "Bulk Carrier", flag: "SGP", level: "moderate" as const, note: "Moderate overlap score" },
  { id: "cand-005", name: "TUG HARBOUR_QUEEN", type: "Service Vessel", flag: "IND", level: "low" as const, note: "Anchored — low speed" },
  { id: "cand-006", name: "CS PACIFIC_BRIDGE", type: "Container Ship", flag: "PAN", level: "low" as const, note: "Incompatible speed 18.5kts" },
];

export const BacktrackOverlay: React.FC = () => {
  const { state } = useMission();

  if (state.currentStage !== "BACKTRACK_CORRIDOR") return null;

  const elapsed = state.stageElapsedMs;
  const candidates = getCandidateVessels();

  // Clock animation: starts at T=0, rewinds to T-24 over 5s
  const clockProgress = Math.min(1, elapsed / 5000);
  const clockHour = Math.round(-24 * clockProgress);

  // Stagger reveal of suspects
  const visibleSuspects = Math.min(
    SUSPECT_LABELS.length,
    elapsed > 4000 ? Math.ceil((elapsed - 4000) / 450) : 0
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      {/* ── 1. TOP CENTER: BACKWARD DRIFT CLOCK ──────────────── */}
      <div
        style={{
          position: "absolute",
          top: 68,
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "auto",
        }}
      >
        <OperationsPanel
          variant="compact"
          style={{
            padding: "8px 16px",
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            background: "rgba(13, 17, 23, 0.95)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "8.5px",
                color: "#5A7A94",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              SIMULATION
            </span>
            <StatusBadge label="◀◀ REWINDING" variant="amber" pulse size="sm" />
          </div>

          <div className="flex items-baseline gap-1">
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 22,
                fontWeight: 700,
                color: "#22D3EE",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              T{clockHour === 0 ? "±0" : clockHour}h
            </span>
          </div>

          {/* Timeline Hour Marks */}
          <div className="flex items-center gap-1">
            {CLOCK_HOURS.map((h) => {
              const reached = clockHour <= h;
              return (
                <div
                  key={h}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "8px",
                    padding: "2px 5px",
                    borderRadius: "1px",
                    background: reached ? "rgba(34,211,238,0.15)" : "#111822",
                    border: `1px solid ${reached ? "rgba(34,211,238,0.4)" : "#1C2A38"}`,
                    color: reached ? "#22D3EE" : "#3A5268",
                  }}
                >
                  T{h}h
                </div>
              );
            })}
          </div>
        </OperationsPanel>
      </div>

      {/* ── 2. LEFT SIDE: DRIFT SIMULATION PHYSICS HUD ──────── */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 14,
          width: 280,
          maxHeight: "calc(100vh - 270px)",
          display: "flex",
          flexDirection: "column",
          pointerEvents: "auto",
        }}
      >
        <OperationsPanel
          variant="side"
          borderLeftAccent
          accentColor="cyan"
          style={{ maxHeight: "100%", overflowY: "auto" }}
        >
          <PanelHeader
            category="04 · BACKTRACK"
            title="DRIFT ANALYSIS"
            statusText="RUNNING"
            statusVariant="cyan"
          />

          {/* Primary block: conclusion */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #1C2A38",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#E2E8F0",
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              SOURCE CORRIDOR
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#10B981",
                fontFamily: "'JetBrains Mono', monospace",
                marginTop: 4,
                letterSpacing: "0.06em",
              }}
            >
              HIGH CONFIDENCE
            </div>
          </div>

          {/* Supporting block: 2 environment rows */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid #1C2A38",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <MetricRow label="Current" value="0.28 m/s SE" color="cyan" />
            <MetricRow label="Wind" value="6.6 m/s SW" color="cyan" />
          </div>

          {/* Collapsible: Simulation Details */}
          <CollapsibleSection label="Simulation Details">
            <MetricRow label="Wind Drift" value="3.0%" subtext="Empirical oil law" />
            <MetricRow label="Particles" value="1,000 pts" />
            <MetricRow label="Cleared" value="406 / 412 vessels" color="emerald" />
          </CollapsibleSection>
        </OperationsPanel>
      </div>

      {/* ── 3. BOTTOM CENTER: DIMMING NOTICE ─────────────────── */}
      {elapsed > 4000 && (
        <div
          style={{
            position: "absolute",
            bottom: 75,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: "#5A7A94",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            textAlign: "center",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {(candidates.length === 0 ? 0 : 412 - candidates.length).toLocaleString()} vessels cleared ·{" "}
          <span style={{ color: "#F59E0B" }}>
            {Math.min(candidates.length, visibleSuspects)} suspects highlighted
          </span>
        </div>
      )}

      {/* ── 4. RIGHT SIDE: SUSPECT NARROWING PANEL ──────────── */}
      {visibleSuspects > 0 && (
        <div
          style={{
            position: "absolute",
            top: 64,
            right: 14,
            width: 300,
            maxHeight: "calc(100vh - 220px)",
            display: "flex",
            flexDirection: "column",
            pointerEvents: "auto",
          }}
        >
          <OperationsPanel
            variant="side"
            borderLeftAccent
            accentColor="amber"
            style={{ maxHeight: "100%", overflowY: "auto" }}
          >
            <PanelHeader
              category="Corridor Intersection"
              title="SUSPECT VESSELS"
              statusText={`${visibleSuspects} / 412`}
              statusVariant="amber"
            />

            <div
              className="custom-scrollbar"
              style={{
                maxHeight: "calc(100vh - 290px)",
                overflowY: "auto",
                padding: "8px 10px",
              }}
            >
              {SUSPECT_LABELS.slice(0, visibleSuspects).map((s) => {
                const badgeVariant = s.level === "high" ? "red" : s.level === "moderate" ? "amber" : "dim";
                const accentBorder = s.level === "high" ? "#EF4444" : s.level === "moderate" ? "#F59E0B" : "#5A7A94";

                return (
                  <div
                    key={s.id}
                    style={{
                      padding: 8,
                      marginBottom: 6,
                      borderRadius: 2,
                      border: "1px solid #1C2A38",
                      borderLeft: `3px solid ${accentBorder}`,
                      background: "rgba(10, 14, 20, 0.80)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#E2E8F0",
                      }}
                    >
                      {s.name}
                    </span>
                    <StatusBadge label={s.level.toUpperCase()} variant={badgeVariant} size="sm" />
                  </div>
                );
              })}
            </div>
          </OperationsPanel>
        </div>
      )}
    </div>
  );
};

export default BacktrackOverlay;
