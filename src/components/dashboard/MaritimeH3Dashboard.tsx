import React, { useState, useEffect, useRef } from "react";
import type { IncidentScenario } from "@/lib/data/offlineDemoData";
import { OperationsPanel, PanelHeader, PanelSection, MetricRow, MetricCard, StatusBadge } from "@/components/ui/panel-system";

interface MaritimeH3DashboardProps {
  currentScenario?: IncidentScenario;
  onSwitchToClassic?: () => void;
}

// 5 discrete timestep definitions — matches p5Adapter/p4Adapter observation window
const TIME_TICKS = [
  { label: "t0",   offsetHour: "0h",   date: "2026-05-15 06:00 UTC", tag: "SAR Scene",        idx: 0 },
  { label: "-6h",  offsetHour: "-6h",  date: "2026-05-15 00:00 UTC", tag: "Pre-Detection",    idx: 1 },
  { label: "-12h", offsetHour: "-12h", date: "2026-05-14 18:00 UTC", tag: "Mid Drift",        idx: 2 },
  { label: "-18h", offsetHour: "-18h", date: "2026-05-14 12:00 UTC", tag: "Drift Checkpoint", idx: 3 },
  { label: "-24h", offsetHour: "-24h", date: "2026-05-14 06:00 UTC", tag: "Release Origin",   idx: 4 },
];

// Candidate vessels — from case_file_output.json / p3Adapter defaults
const CANDIDATES = [
  { name: "IND_TANKER_412",    mmsi: "419000101", score: 0.912, isConfirmed: true },
  { name: "CONTAINER_EXPRESS", mmsi: "419000202", score: 0.184, isConfirmed: false },
];

// Hex cluster definitions per timestep (matching p4Adapter corridor centers)
// Each step has its own cluster — they don't blend or smear
type HexCell = { cx: number; cy: number; density: number; isMatch?: boolean };

const CLUSTER_T0: HexCell[] = [
  { cx: 408, cy: 261, density: 0.55 }, { cx: 456, cy: 261, density: 0.82, isMatch: true },
  { cx: 504, cy: 261, density: 0.68 }, { cx: 552, cy: 261, density: 0.35 },
  { cx: 432, cy: 220, density: 0.52 }, { cx: 480, cy: 220, density: 0.38 },
  { cx: 384, cy: 302, density: 0.42 }, { cx: 432, cy: 302, density: 0.72 },
  { cx: 480, cy: 302, density: 0.60 }, { cx: 528, cy: 302, density: 0.32 },
  { cx: 408, cy: 343, density: 0.38 }, { cx: 456, cy: 343, density: 0.50 },
];

const CLUSTER_NEG6: HexCell[] = [
  { cx: 350, cy: 240, density: 0.75 }, { cx: 398, cy: 240, density: 0.90, isMatch: true },
  { cx: 446, cy: 240, density: 0.65 }, { cx: 374, cy: 199, density: 0.50 },
  { cx: 422, cy: 199, density: 0.40 }, { cx: 350, cy: 281, density: 0.55 },
  { cx: 398, cy: 281, density: 0.70 }, { cx: 446, cy: 281, density: 0.45 },
];

const CLUSTER_NEG12: HexCell[] = [
  { cx: 190, cy: 175, density: 0.95, isMatch: true }, { cx: 238, cy: 175, density: 0.75 },
  { cx: 166, cy: 134, density: 0.62 }, { cx: 214, cy: 134, density: 0.58 },
  { cx: 262, cy: 134, density: 0.40 }, { cx: 166, cy: 216, density: 0.72 },
  { cx: 214, cy: 216, density: 0.60 }, { cx: 262, cy: 216, density: 0.35 },
];

const CLUSTER_NEG18: HexCell[] = [
  { cx: 250, cy: 300, density: 0.85, isMatch: true }, { cx: 298, cy: 300, density: 0.65 },
  { cx: 226, cy: 259, density: 0.55 }, { cx: 274, cy: 259, density: 0.70 },
  { cx: 226, cy: 341, density: 0.50 }, { cx: 274, cy: 341, density: 0.40 },
];

const CLUSTER_NEG24: HexCell[] = [
  { cx: 155, cy: 380, density: 0.90, isMatch: true }, { cx: 203, cy: 380, density: 0.68 },
  { cx: 131, cy: 339, density: 0.52 }, { cx: 179, cy: 339, density: 0.75 },
  { cx: 227, cy: 339, density: 0.45 }, { cx: 155, cy: 421, density: 0.55 },
  { cx: 203, cy: 421, density: 0.40 },
];

const CLUSTERS = [CLUSTER_T0, CLUSTER_NEG6, CLUSTER_NEG12, CLUSTER_NEG18, CLUSTER_NEG24];

// Map density to discrete opacity step (0.30/0.50/0.70/0.90)
function densityAlpha(d: number): number {
  if (d > 0.75) return 0.90;
  if (d > 0.50) return 0.70;
  if (d > 0.25) return 0.50;
  return 0.30;
}

// SVG flat-top hexagon at center (cx, cy) with r=20
function Hex({ cx, cy, density, isMatch }: HexCell) {
  const r = 20;
  const points = [
    [cx + r, cy],
    [cx + r / 2, cy - r * 0.866],
    [cx - r / 2, cy - r * 0.866],
    [cx - r, cy],
    [cx - r / 2, cy + r * 0.866],
    [cx + r / 2, cy + r * 0.866],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  return (
    <polygon
      points={points}
      fill="#22D3EE"
      fillOpacity={densityAlpha(density)}
      stroke="#22D3EE"
      strokeOpacity={isMatch ? 1 : 0.55}
      strokeWidth={isMatch ? 2 : 1}
    />
  );
}

export function MaritimeH3Dashboard({
  onSwitchToClassic,
}: MaritimeH3DashboardProps) {
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [utcTime, setUtcTime] = useState<string>("--:--:-- UTC");

  // Live UTC clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, "0");
      const m = String(now.getUTCMinutes()).padStart(2, "0");
      const s = String(now.getUTCSeconds()).padStart(2, "0");
      setUtcTime(`${h}:${m}:${s} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-play: step forward every 2500ms, loop back
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSelectedStep((prev) => (prev + 1) % TIME_TICKS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const activeTick = TIME_TICKS[selectedStep]!;
  const activeCluster = CLUSTERS[selectedStep] ?? CLUSTER_T0;

  // Slider fill percent (step 0 = 0%, step 4 = 100%)
  const fillPercent = (selectedStep / (TIME_TICKS.length - 1)) * 100;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        background: "#0A0E14",
        color: "#C8D8E8",
        fontFamily: "'Inter', 'Space Grotesk', sans-serif",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* ── TOP STATUS BAR ─────────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 44,
          padding: "0 16px",
          background: "#0D1117",
          borderBottom: "1px solid #1C2A38",
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Branding mark */}
          <div
            style={{
              width: 20,
              height: 20,
              border: "1px solid #22D3EE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <polygon points="7,1 13,10 1,10" stroke="#22D3EE" strokeWidth="1.2" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#E2E8F0",
            }}
          >
            Maritime Intelligence — H3 Vessel Match
          </span>
          <span
            style={{
              border: "1px solid #22D3EE",
              color: "#22D3EE",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "8px",
              padding: "1px 5px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
            }}
          >
            Operational
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22D3EE",
                display: "inline-block",
                animation: "pulse-ring-inner 1.8s ease-in-out infinite",
              }}
            />
            <span style={{ color: "#22D3EE" }}>LIVE AUDIT GRID</span>
          </div>
          <span style={{ color: "#5A7A94" }}>AOI: MUMBAI OFFSHORE (71.85°E, 19.35°N)</span>
          <span style={{ color: "#C8D8E8", fontWeight: 700 }}>{utcTime}</span>

          {onSwitchToClassic && (
            <button
              type="button"
              onClick={onSwitchToClassic}
              style={{
                padding: "2px 8px",
                fontSize: "8px",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                border: "1px solid #1C2A38",
                background: "#111822",
                color: "#5A7A94",
                cursor: "pointer",
                borderRadius: 0,
              }}
            >
              Map View ↗
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN 3-COLUMN WORKSPACE ─────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "200px 1fr 200px",
          overflow: "hidden",
        }}
      >
        {/* ── LEFT PANEL ── */}
        <OperationsPanel
          variant="side"
          borderLeftAccent
          accentColor="cyan"
          className="rounded-none border-t-0 border-l-0 border-b-0 h-full overflow-y-auto"
        >
          <PanelHeader
            category="ATTRIBUTION"
            title="VESSEL MATCH"
            statusText="CONFIRMED"
            statusVariant="cyan"
          />

          <PanelSection title="Target Vessel Metadata">
            <MetricRow label="Name" value="IND_TANKER_412" mono highlight />
            <MetricRow label="MMSI" value="419 000 101" mono />
            <MetricRow
              label="Status"
              value="MATCHED"
              badge={<StatusBadge label="CONFIRMED" variant="cyan" size="sm" />}
            />
            <MetricRow label="H3 Index" value="8742da54effffff" mono highlight subtext="Resolution 7 hex cell" />
          </PanelSection>

          <PanelSection title="Cell Centroid Coordinates">
            <div className="p-2 rounded-xs bg-[#0A0E14] border border-[#1C2A38]">
              <div className="text-[7.5px] font-mono text-[#5A7A94] uppercase tracking-wider mb-1">
                {activeTick.label} — {activeTick.tag}
              </div>
              <div className="text-[11px] font-mono font-bold text-[#E2E8F0] leading-tight">
                19.3512° N<br />71.8540° E
              </div>
            </div>
          </PanelSection>

          <PanelSection title="k-Ring Expansion Decay">
            {[
              { k: "k=0 (origin)", wPct: "100%", color: "cyan" as const },
              { k: "k=1", wPct: "50%", color: "dim" as const },
              { k: "k=2", wPct: "33%", color: "dim" as const },
            ].map((r) => (
              <MetricRow
                key={r.k}
                label={r.k}
                value={r.wPct}
                color={r.color}
              />
            ))}
            <div className="text-[7.5px] font-mono text-[#3A5268] mt-1.5">
              1/(1+k) spatial confidence falloff
            </div>
          </PanelSection>

          <PanelSection title="Audit Configuration" borderBottom={false}>
            <MetricRow label="Timestep Δ" value="6 h" />
            <MetricRow label="Active Cells" value={`${activeCluster.length} cells`} />
            <MetricRow label="Audit Mode" value="Discrete" highlight />
          </PanelSection>
        </OperationsPanel>

        {/* ── CENTER — SVG HEX MAP ── */}
        <main
          style={{
            position: "relative",
            background: "#0A0E14",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Timestep label */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              border: "1px solid #22D3EE",
              background: "#0D1117",
              padding: "3px 8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "8px",
              textTransform: "uppercase",
              color: "#22D3EE",
              letterSpacing: "0.08em",
              zIndex: 5,
            }}
          >
            {activeTick.label} — {activeTick.tag}
          </div>

          <svg
            style={{ width: "100%", height: "100%", maxHeight: "100%", display: "block" }}
            viewBox="0 0 680 520"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Coordinate grid — very dim */}
            <g opacity={0.3}>
              {[104, 208, 312, 416].map((y) => (
                <line key={y} x1={0} y1={y} x2={680} y2={y} stroke="#1A2530" strokeWidth={0.5} />
              ))}
              {[136, 272, 408, 544].map((x) => (
                <line key={x} x1={x} y1={0} x2={x} y2={520} stroke="#1A2530" strokeWidth={0.5} />
              ))}
              <text x={6} y={100} fill="#2A4055" fontSize={8} fontFamily="JetBrains Mono, monospace">19.7°N</text>
              <text x={6} y={204} fill="#2A4055" fontSize={8} fontFamily="JetBrains Mono, monospace">19.5°N</text>
              <text x={6} y={308} fill="#2A4055" fontSize={8} fontFamily="JetBrains Mono, monospace">19.3°N</text>
              <text x={6} y={412} fill="#2A4055" fontSize={8} fontFamily="JetBrains Mono, monospace">19.1°N</text>
              <text x={140} y={512} fill="#2A4055" fontSize={8} fontFamily="JetBrains Mono, monospace">71.2°E</text>
              <text x={276} y={512} fill="#2A4055" fontSize={8} fontFamily="JetBrains Mono, monospace">71.4°E</text>
              <text x={412} y={512} fill="#2A4055" fontSize={8} fontFamily="JetBrains Mono, monospace">71.6°E</text>
              <text x={548} y={512} fill="#2A4055" fontSize={8} fontFamily="JetBrains Mono, monospace">71.8°E</text>
            </g>

            {/* Active hex cluster for selected timestep */}
            <g>
              {activeCluster.map((cell, i) => (
                <Hex key={i} {...cell} />
              ))}
            </g>

            {/* Vessel marker — triangular ship silhouette */}
            {selectedStep === 0 && (() => {
              const matchCell = activeCluster.find((c) => c.isMatch);
              if (!matchCell) return null;
              return (
                <g transform={`translate(${matchCell.cx}, ${matchCell.cy})`}>
                  <polygon
                    points="0,-10 7,6 -7,6"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                  <circle cx={0} cy={1} r={2} fill="#22D3EE" />
                </g>
              );
            })()}

            {/* Match cell callout — points to matched hex */}
            {(() => {
              const matchCell = activeCluster.find((c) => c.isMatch);
              if (!matchCell) return null;
              const calloutY = Math.min(matchCell.cy + 80, 490);
              return (
                <g>
                  <line
                    x1={matchCell.cx} y1={matchCell.cy + 22}
                    x2={matchCell.cx} y2={calloutY - 5}
                    stroke="#22D3EE" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5}
                  />
                  <rect
                    x={matchCell.cx - 75} y={calloutY - 4}
                    width={150} height={22}
                    fill="#0D1117" stroke="#22D3EE" strokeWidth={0.8}
                  />
                  <text
                    x={matchCell.cx} y={calloutY + 6}
                    fill="#22D3EE" fontSize={8} fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                  >
                    {activeTick.tag} · match hex
                  </text>
                  <text
                    x={matchCell.cx} y={calloutY + 16}
                    fill="#5A7A94" fontSize={7.5} fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                  >
                    density {(activeCluster.find(c => c.isMatch)?.density ?? 0).toFixed(2)}
                  </text>
                </g>
              );
            })()}
          </svg>

          {/* Bottom attribution */}
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "8px",
              color: "#3A5268",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              whiteSpace: "nowrap",
            }}
          >
            IND_TANKER_412 | MMSI 419 000 101 | ▲ ACTIVE MATCH
          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <OperationsPanel
          variant="side"
          borderLeftAccent
          accentColor="cyan"
          className="w-80 flex flex-col gap-4 overflow-y-auto custom-scrollbar p-3 text-[11px] rounded-none border-y-0 border-r-0 border-l border-border-tactical"
        >
          <PanelHeader
            title="Correlation Matrix"
            category="H3 DENSITY"
            live
          />

          {/* Match density legend — 5 discrete hex swatches */}
          <PanelSection title="Match Density">
            <div className="flex items-end justify-between px-1 py-1">
              {[
                { op: 0.30, label: "Low" },
                { op: 0.50, label: "" },
                { op: 0.70, label: "" },
                { op: 0.90, label: "" },
                { op: 1.00, label: "High" },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <svg width="18" height="16" viewBox="-10 -9 20 18">
                    <polygon
                      points="9,0 4.5,-7.79 -4.5,-7.79 -9,0 -4.5,7.79 4.5,7.79"
                      fill="#22D3EE"
                      fillOpacity={s.op}
                      stroke="#22D3EE"
                      strokeOpacity={0.7}
                      strokeWidth="1"
                    />
                  </svg>
                  {s.label && (
                    <span className="font-mono text-[7px] text-text-dim uppercase tracking-wider">
                      {s.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between font-mono text-[8px] text-text-dim mt-1.5 pt-1 border-t border-border-tactical/40">
              <span>Low</span>
              <span className="text-accent-cyan">Cyan · Discrete H3</span>
              <span>High</span>
            </div>
          </PanelSection>

          {/* Candidate matches */}
          <PanelSection title="Candidate Matches">
            <div className="space-y-2">
              {CANDIDATES.map((cand) => (
                <div
                  key={cand.mmsi}
                  className={`p-2.5 rounded border transition-all ${
                    cand.isConfirmed
                      ? 'border-accent-cyan bg-accent-cyan/10 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                      : 'border-border-tactical bg-surface-elevated/40 hover:border-border-tactical-accent'
                  }`}
                >
                  <div className="flex justify-between items-baseline mb-1">
                    <span
                      className={`text-[11px] truncate ${
                        cand.isConfirmed ? 'font-bold text-white' : 'text-text-primary'
                      }`}
                    >
                      {cand.name}
                    </span>
                    <span className="font-mono text-xs font-bold text-accent-cyan ml-2 flex-shrink-0">
                      {(cand.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[9px] text-text-dim mb-1.5">
                    <span>MMSI {cand.mmsi}</span>
                    {cand.isConfirmed && (
                      <span className="px-1.5 py-0.5 text-[8px] bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40 rounded font-semibold uppercase">
                        Target Match
                      </span>
                    )}
                  </div>
                  <div className="h-1 bg-surface-base rounded-full overflow-hidden border border-border-tactical/40">
                    <div
                      className="h-full bg-accent-cyan transition-all duration-300"
                      style={{
                        width: `${cand.score * 100}%`,
                        opacity: cand.isConfirmed ? 1 : 0.45,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </PanelSection>

          {/* Cluster stats */}
          <PanelSection title="Cluster Stats" className="mt-auto">
            <div className="space-y-1">
              <MetricRow
                label="Peak Cell Density"
                value={(activeCluster.find(c => c.isMatch)?.density ?? 0).toFixed(2)}
                highlight
                color="cyan"
              />
              <MetricRow
                label="Active H3 Cells"
                value={activeCluster.length}
                color="default"
              />
              <MetricRow
                label="Attribution Confidence"
                value="91.2% Conf"
                highlight
                color="emerald"
              />
            </div>
          </PanelSection>
        </OperationsPanel>
      </div>

      {/* ── BOTTOM TIME SLIDER ─────────────────────────────────────────────── */}
      <footer className="relative z-20 flex-shrink-0">
        <OperationsPanel
          variant="compact"
          showCornerBrackets={false}
          className="h-[72px] rounded-none border-x-0 border-b-0 border-t border-border-tactical px-5 flex items-center gap-4 bg-surface-panel/95 backdrop-blur-md"
        >
          {/* Timestep label */}
          <div className="font-mono text-[9px] text-text-muted uppercase tracking-widest whitespace-nowrap">
            TIMESTEP
          </div>

          {/* Play/pause */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`h-7 px-3.5 border font-mono text-[9px] uppercase tracking-wider whitespace-nowrap transition-all rounded ${
              isPlaying
                ? 'border-accent-cyan bg-accent-cyan/20 text-accent-cyan shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : 'border-border-tactical bg-surface-elevated/40 text-text-muted hover:border-border-tactical-accent hover:text-white'
            }`}
          >
            {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
          </button>

          {/* Scrubber track + tick buttons */}
          <div className="flex-1 relative">
            {/* Tick buttons */}
            <div className="absolute -top-5 left-0 right-0 flex justify-between">
              {TIME_TICKS.map((tick) => (
                <button
                  key={tick.label}
                  type="button"
                  onClick={() => { setIsPlaying(false); setSelectedStep(tick.idx); }}
                  className={`bg-transparent border-0 cursor-pointer font-mono text-[9px] px-1 transition-colors ${
                    selectedStep === tick.idx
                      ? 'text-accent-cyan font-bold drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]'
                      : 'text-text-dim hover:text-text-muted'
                  }`}
                >
                  {tick.label}
                </button>
              ))}
            </div>

            {/* Draggable scrubber */}
            <input
              type="range"
              className="scrubber"
              min={0}
              max={TIME_TICKS.length - 1}
              step={1}
              value={selectedStep}
              style={{
                "--range-fill": `${fillPercent}%`,
                width: "100%",
              } as React.CSSProperties}
              onChange={(e) => {
                setIsPlaying(false);
                setSelectedStep(Number(e.target.value));
              }}
            />
          </div>

          {/* Active step readout */}
          <div className="text-right font-mono text-[10px] whitespace-nowrap min-w-[120px] pl-3 border-l border-border-tactical">
            <div className="text-accent-cyan font-bold uppercase tracking-wider">
              {activeTick.label} ACTIVE
            </div>
            <div className="text-text-dim text-[9px] mt-0.5">{activeTick.date}</div>
          </div>
        </OperationsPanel>
      </footer>
    </div>
  );
}
