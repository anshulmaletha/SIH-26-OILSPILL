import { useEffect, useRef, useState } from "react";

interface TimeSliderProps {
  selectedHour: number;
  onSelectHour: (hour: number) => void;
  detectionTimeIso?: string;
}

const OBSERVATION_STEPS: { value: number; label: string; tag: string }[] = [
  { value: -24, label: "-24h", tag: "Release Origin" },
  { value: -18, label: "-18h", tag: "Early Plume" },
  { value: -12, label: "-12h", tag: "Mid Drift" },
  { value:  -6, label: "-6h",  tag: "Pre-Detection" },
  { value:   0, label: "0h",   tag: "SAR Scene" },
];

// Shared inline style helpers
const monoSm = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "10px",
} as const;

export function TimeSlider({
  selectedHour,
  onSelectHour,
  detectionTimeIso = "2026-09-02T06:00:00Z",
}: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  // Track current hour internally for the play interval (avoids stale closure)
  const currentHourRef = useRef(selectedHour);
  currentHourRef.current = selectedHour;

  // Auto-play: advances one step every 2500 ms (readable demo pace per spec)
  useEffect(() => {
    if (!isPlaying) return;

    const steps = [-24, -18, -12, -6, 0];
    const timer = setInterval(() => {
      const cur = currentHourRef.current;
      const currentIdx = steps.indexOf(cur);
      const nextIdx = currentIdx + 1 < steps.length ? currentIdx + 1 : 0;
      onSelectHour(steps[nextIdx]!);
    }, 2500);

    return () => clearInterval(timer);
  }, [isPlaying, onSelectHour]);

  // UTC timestamp for selected step
  const baseTime = new Date(detectionTimeIso).getTime();
  const currentStepTime = new Date(baseTime + selectedHour * 3600 * 1000);
  const formattedUtc = currentStepTime.toUTCString().replace("GMT", "UTC");

  const handleStepBack = () => {
    setIsPlaying(false);
    const steps = [-24, -18, -12, -6, 0];
    const prev = [...steps].reverse().find((s) => s < selectedHour);
    onSelectHour(prev !== undefined ? prev : -24);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    const steps = [-24, -18, -12, -6, 0];
    const next = steps.find((s) => s > selectedHour);
    onSelectHour(next !== undefined ? next : 0);
  };

  // Compute % fill for CSS range track gradient
  // Map selectedHour (-24 to 0) → 0–100%
  const fillPercent = ((selectedHour + 24) / 24) * 100;

  return (
    <div
      style={{
        width: 360,
        background: "#0D1117",
        border: "1px solid #1C2A38",
        borderRadius: "2px",
        padding: "10px 14px 12px",
        color: "#C8D8E8",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── Header row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #1C2A38",
          paddingBottom: 8,
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              ...monoSm,
              fontSize: "8px",
              color: "#3A5268",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontWeight: 700,
              marginBottom: 2,
            }}
          >
            Observation Timeline
          </div>
          <div style={{ ...monoSm, color: "#5A7A94", fontSize: "9px" }}>
            {formattedUtc}
          </div>
        </div>

        {/* Step + play controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {/* Step back */}
          <button
            type="button"
            onClick={handleStepBack}
            disabled={selectedHour <= -24}
            style={{
              width: 22,
              height: 22,
              border: "1px solid #1C2A38",
              background: "transparent",
              color: selectedHour <= -24 ? "#3A5268" : "#5A7A94",
              cursor: selectedHour <= -24 ? "default" : "pointer",
              borderRadius: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              padding: 0,
            }}
            title="Step back 6h"
          >
            ‹
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              height: 22,
              padding: "0 8px",
              border: `1px solid ${isPlaying ? "#22D3EE" : "#1C2A38"}`,
              background: isPlaying ? "#22D3EE18" : "transparent",
              color: isPlaying ? "#22D3EE" : "#5A7A94",
              cursor: "pointer",
              borderRadius: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              transition: "border-color 150ms, color 150ms, background 150ms",
            }}
          >
            {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
          </button>

          {/* Step forward */}
          <button
            type="button"
            onClick={handleStepForward}
            disabled={selectedHour >= 0}
            style={{
              width: 22,
              height: 22,
              border: "1px solid #1C2A38",
              background: "transparent",
              color: selectedHour >= 0 ? "#3A5268" : "#5A7A94",
              cursor: selectedHour >= 0 ? "default" : "pointer",
              borderRadius: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              padding: 0,
            }}
            title="Step forward 6h"
          >
            ›
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={() => { setIsPlaying(false); onSelectHour(0); }}
            style={{
              width: 22,
              height: 22,
              border: "1px solid #1C2A38",
              background: "transparent",
              color: "#3A5268",
              cursor: "pointer",
              borderRadius: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "9px",
              padding: 0,
            }}
            title="Reset to 0h"
          >
            ↺
          </button>
        </div>
      </div>

      {/* ── Quick-select step buttons ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 3,
          marginBottom: 10,
        }}
      >
        {OBSERVATION_STEPS.map((step) => {
          const isActive = selectedHour === step.value;
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => { setIsPlaying(false); onSelectHour(step.value); }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "5px 2px",
                border: `1px solid ${isActive ? "#22D3EE" : "#1C2A38"}`,
                background: isActive ? "#22D3EE14" : "transparent",
                color: isActive ? "#22D3EE" : "#5A7A94",
                cursor: "pointer",
                borderRadius: 0,
                transition: "border-color 150ms, color 150ms, background 150ms",
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  fontWeight: isActive ? 700 : 400,
                  lineHeight: 1.2,
                }}
              >
                {step.label}
              </span>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "7.5px",
                  color: isActive ? "#22D3EE99" : "#3A5268",
                  marginTop: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                {step.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Draggable scrubber — native range input for live drag ── */}
      <div style={{ position: "relative" }}>
        {/* Active step display */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 5,
          }}
        >
          <span style={{ ...monoSm, color: "#22D3EE", fontSize: "9px", fontWeight: 700 }}>
            T = {selectedHour === 0 ? "0h (Detection)" : `${selectedHour}h`}
          </span>
          <span style={{ ...monoSm, color: "#3A5268", fontSize: "9px" }}>
            Scrub ←→
          </span>
        </div>

        <input
          type="range"
          className="scrubber"
          min={-24}
          max={0}
          step={1}
          value={selectedHour}
          style={{
            "--range-fill": `${fillPercent}%`,
          } as React.CSSProperties}
          onChange={(e) => {
            setIsPlaying(false);
            onSelectHour(Number(e.target.value));
          }}
        />
      </div>
    </div>
  );
}
