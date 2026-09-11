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
    bg: "#EF444410",
    border: "#EF444430",
    dot: "#EF4444",
    label: "HIGH",
  },
  moderate: {
    bg: "#F59E0B10",
    border: "#F59E0B30",
    dot: "#F59E0B",
    label: "MODERATE",
  },
  low: {
    bg: "#22D3EE08",
    border: "#22D3EE20",
    dot: "#5A7A94",
    label: "LOW",
  },
};

const SUSPECT_LABELS = [
  { id: "cand-001", name: "MT IND_TANKER_412", type: "Crude Oil Tanker", flag: "IND", note: "AIS gap 3.4h · Speed drop detected" },
  { id: "cand-002", name: "DARK VESSEL (CFAR_002)", type: "Unknown (SAR-only)", flag: "—", note: "No AIS · Corridor intersection" },
  { id: "cand-003", name: "MT ARABIAN_VENTURE", type: "Crude Oil Tanker", flag: "PAN", note: "Outer corridor boundary" },
  { id: "cand-004", name: "MV COASTAL_SPIRIT", type: "Bulk Carrier", flag: "SGP", note: "Moderate overlap score" },
  { id: "cand-005", name: "TUG HARBOUR_QUEEN", type: "Service Vessel", flag: "IND", note: "Anchored — low speed" },
  { id: "cand-006", name: "CS PACIFIC_BRIDGE", type: "Container Ship", flag: "PAN", note: "Incompatible speed 18.5kts" },
];

export function BacktrackOverlay() {
  const { state } = useMission();

  if (state.currentStage !== "BACKTRACK_CORRIDOR") return null;

  const elapsed = state.stageElapsedMs;
  const candidates = getCandidateVessels();

  // Clock animation: starts at T=0, winds to T-24 over 5s
  const clockProgress = Math.min(1, elapsed / 5000);
  const clockHour = Math.round(-24 * clockProgress);

  // How many suspects are visible (stagger reveal)
  const visibleSuspects = Math.min(
    SUSPECT_LABELS.length,
    elapsed > 5000 ? Math.ceil((elapsed - 5000) / 400) : 0
  );

  return (
    <>
      {/* ── Backward time clock — top center ── */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          background: "#0D1117",
          border: "1px solid #1C2A38",
          padding: "8px 20px",
          fontFamily: "'JetBrains Mono', monospace",
          display: "flex",
          alignItems: "center",
          gap: 12,
          pointerEvents: "none",
        }}
      >
        {/* Rewinding label */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, color: "#5A7A94", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            BACKTRACK
          </span>
          <span
            style={{
              fontSize: 9,
              color: "#F59E0B",
              fontWeight: 700,
              letterSpacing: "0.05em",
              animation: "pulse-ring-inner 1s ease-in-out infinite",
            }}
          >
            ◀◀ REWINDING
          </span>
        </div>

        {/* Clock display */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#22D3EE", letterSpacing: "-0.02em" }}>
            T{clockHour === 0 ? "±0" : clockHour}h
          </span>
        </div>

        {/* Timeline ticks */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {CLOCK_HOURS.map((h) => (
            <div
              key={h}
              style={{
                fontSize: 8,
                padding: "2px 6px",
                background: clockHour <= h ? "#22D3EE15" : "#111822",
                border: `1px solid ${clockHour <= h ? "#22D3EE40" : "#1C2A38"}`,
                color: clockHour <= h ? "#22D3EE" : "#3A5268",
              }}
            >
              T{h}h
            </div>
          ))}
        </div>
      </div>

      {/* ── Dimming notice — bottom center ── */}
      {elapsed > 4000 && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
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
          }}
        >
          {(candidates.length === 0 ? 0 : 412 - candidates.length).toLocaleString()} vessels cleared ·{" "}
          <span style={{ color: "#F59E0B" }}>
            {Math.min(candidates.length, visibleSuspects)} suspects highlighted
          </span>
        </div>
      )}

      {/* ── Suspect narrowing panel — right side ── */}
      {visibleSuspects > 0 && (
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
          {/* Header */}
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #1C2A38",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#22D3EE",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              SUSPECT VESSELS
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#5A7A94" }}>
              {Math.min(visibleSuspects, SUSPECT_LABELS.length)} / 412
            </span>
          </div>

          {/* Suspect rows */}
          {SUSPECT_LABELS.slice(0, visibleSuspects).map((s, i) => {
            const cand = candidates.find((c) => c.id === s.id);
            const level = cand?.suspicionLevel ?? "none";
            const theme = SUSPECT_COLORS[level] ?? SUSPECT_COLORS["low"]!;

            return (
              <div
                key={s.id}
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #111822",
                  background: theme.bg,
                  borderLeft: `3px solid ${theme.dot}`,
                  animation: `fadeIn 0.3s ease forwards`,
                  animationDelay: `${i * 0.05}s`,
                  opacity: 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#C8D8E8",
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 8,
                      color: theme.dot,
                      border: `1px solid ${theme.border}`,
                      background: theme.bg,
                      padding: "1px 5px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {theme.label}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    color: "#5A7A94",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <span>{s.type}</span>
                  <span style={{ color: "#3A5268" }}>·</span>
                  <span>{s.flag}</span>
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    color: level === "high" ? "#EF4444" : level === "moderate" ? "#F59E0B" : "#3A5268",
                  }}
                >
                  {s.note}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
