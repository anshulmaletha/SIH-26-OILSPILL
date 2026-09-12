/**
 * Phase 4: BACKTRACK_CORRIDOR
 * Shows the backward drift clock, H3 corridor highlighting, and suspect narrowing.
 * The actual vessel dimming/highlighting is handled by MapView layer props.
 * This overlay shows the time clock and suspect list panel.
 */

import { useMission } from "@/lib/mission/missionState";
import { getCandidateVessels } from "@/lib/mission/swarmData";

const CLOCK_HOURS = [0, -6, -12, -24];

const SUSPECT_COLORS: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  high: {
    bg: "#FEF2F2",
    border: "#FECACA",
    dot: "#DC2626",
    label: "HIGH",
  },
  moderate: {
    bg: "#FFFBEB",
    border: "#FDE68A",
    dot: "#D97706",
    label: "MODERATE",
  },
  low: {
    bg: "#F8FAFC",
    border: "#E2E8F0",
    dot: "#64748B",
    label: "LOW",
  },
};

const SUSPECT_LABELS = [
  { id: "cand-001", name: "MT IND_TANKER_412", type: "Crude Oil Tanker", flag: "India (IND)", note: "Corridor overlap (k-ring 6/8) · Speed drop 14.2→3.8 kts · 3.4h AIS blackout", level: "high" as const },
  { id: "cand-002", name: "DARK VESSEL (CFAR_DARK_002)", type: "Unknown (SAR Radar Echo)", flag: "—", note: "0 AIS broadcasts within 2.5 km of slick head · SAR contact", level: "high" as const },
  { id: "cand-006", name: "CONTAINER_EXPRESS", type: "Container Ship", flag: "Singapore (SGP)", note: "Speed steady 18.5 kts · Cleared (0 corridor intersection)", level: "low" as const },
];

export function BacktrackOverlay() {
  const { state } = useMission();

  if (state.currentStage !== "BACKTRACK_CORRIDOR") return null;

  const isNullResult = state.scenario === "no_candidates";
  const activeSuspects = isNullResult ? [] : (getCandidateVessels().length > 0 ? getCandidateVessels() : SUSPECT_LABELS);
  const elapsed = state.stageElapsedMs;

  // Clock animation: starts at T=0, winds to T-24 over 5s
  const clockProgress = Math.min(1, elapsed / 5000);
  const clockHour = Math.round(-24 * clockProgress);

  // How many suspects are visible (revealed after backward simulation reaches corridor)
  const isSimulationRunning = elapsed < 3500;
  const visibleSuspects = isNullResult
    ? (elapsed > 4000 ? 1 : 0)
    : (isSimulationRunning ? 0 : Math.min(activeSuspects.length, Math.ceil((elapsed - 3500) / 700)));

  const isDark = state.theme === "dark";

  return (
    <>
      {/* ── Backward time clock — top center ── */}
      <div
        style={{
          position: "absolute",
          top: 68,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          background: isDark ? "#0F172A" : "#FFFFFF",
          border: `1px solid ${isDark ? "#1E293B" : "#CBD5E1"}`,
          borderRadius: 2,
          padding: "6px 16px",
          boxShadow: isDark ? "0 2px 10px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.06)",
          fontFamily: "ui-monospace, monospace",
          display: "flex",
          alignItems: "center",
          gap: 12,
          pointerEvents: "none",
        }}
      >
        {/* Rewinding label */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: isDark ? "#94A3B8" : "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            LAGRANGIAN REWIND
          </span>
          <span
            style={{
              fontSize: 8.5,
              color: isDark ? "#F8FAFC" : "#0F172A",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            ◀◀ T-24H WINDOW
          </span>
        </div>

        {/* Clock display */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: isDark ? "#F8FAFC" : "#0F172A", letterSpacing: "-0.02em" }}>
            T{clockHour === 0 ? "±0" : clockHour}h
          </span>
        </div>

        {/* Timeline ticks */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {CLOCK_HOURS.map((h) => (
            <div
              key={h}
              style={{
                fontSize: 8,
                padding: "2px 5px",
                background: clockHour <= h ? (isDark ? "#F8FAFC" : "#0F172A") : (isDark ? "#1E293B" : "#F1F5F9"),
                border: `1px solid ${clockHour <= h ? (isDark ? "#F8FAFC" : "#0F172A") : (isDark ? "#334155" : "#E2E8F0")}`,
                color: clockHour <= h ? (isDark ? "#0F172A" : "#FFFFFF") : (isDark ? "#94A3B8" : "#64748B"),
                borderRadius: 1,
              }}
            >
              T{h}h
            </div>
          ))}
        </div>
      </div>

      {/* ── Suspect narrowing panel — right side ── */}
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
        {/* Header */}
        <div
          style={{
            padding: "8px 12px",
            background: isDark ? "#1E293B" : "#F8FAFC",
            borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 9,
              color: isDark ? "#F8FAFC" : "#0F172A",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {isNullResult ? "CORRIDOR CANDIDATES (NULL-RESULT)" : "CORRIDOR SUSPECT TARGETS"}
          </span>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 8.5, color: isDark ? "#94A3B8" : "#64748B" }}>
            {isNullResult ? "0 Intersections" : (isSimulationRunning ? "Advecting…" : `${Math.min(visibleSuspects, activeSuspects.length)} / ${activeSuspects.length}`)}
          </span>
        </div>

        {isSimulationRunning && !isNullResult ? (
          <div style={{ padding: "12px", background: isDark ? "#0F172A" : "#FFFFFF" }}>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 8.5, color: isDark ? "#94A3B8" : "#64748B", lineHeight: 1.4 }}>
              Simulating reverse ocean drift (OpenDrift + ERA5 winds)…
            </div>
            <div style={{ marginTop: 6, height: 2, backgroundColor: isDark ? "#1E293B" : "#E2E8F0", borderRadius: 1, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (elapsed / 3500) * 100)}%`, backgroundColor: isDark ? "#F8FAFC" : "#0F172A" }} />
            </div>
          </div>
        ) : isNullResult ? (
          <div style={{ padding: "12px", backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }}>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 700, marginBottom: 4 }}>
              ✓ JUDICIAL RESTRAINT ENFORCED
            </div>
            <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontSize: 9.5, color: isDark ? "#94A3B8" : "#64748B", lineHeight: 1.4 }}>
              Zero AIS tracks intersected the backward particle advection corridor above minimum confidence threshold. System declines to nominate an innocent vessel.
            </div>
          </div>
        ) : (
          /* Suspect rows */
          activeSuspects.slice(0, visibleSuspects).map((s) => {
            const theme = SUSPECT_COLORS[s.level] ?? SUSPECT_COLORS['low']!;
            const rowBg = isDark
              ? (s.level === "high" ? "#281216" : s.level === "moderate" ? "#2A2415" : "#1E293B")
              : theme.bg;

            return (
              <div
                key={s.id}
                style={{
                  padding: "8px 12px",
                  borderBottom: `1px solid ${isDark ? "#1E293B" : "#E2E8F0"}`,
                  background: rowBg,
                  borderLeft: `3px solid ${theme.dot}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: 11,
                      fontWeight: 700,
                      color: isDark ? "#F8FAFC" : "#0F172A",
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 8,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: "2px",
                      background: isDark ? "#0F172A" : "#FFFFFF",
                      border: `1px solid ${theme.border}`,
                      color: theme.dot,
                    }}
                  >
                    {theme.label}
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 8.5,
                    color: isDark ? "#94A3B8" : "#64748B",
                    marginTop: 2,
                  }}
                >
                  {s.type} · {s.flag}
                </div>

                <div
                  style={{
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: 8.5,
                    color: isDark ? "#CBD5E1" : "#334155",
                    marginTop: 4,
                    lineHeight: 1.3,
                  }}
                >
                  {s.note}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
