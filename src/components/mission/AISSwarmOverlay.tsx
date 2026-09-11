import React, { useState, useEffect, useRef } from "react";
import { useMission } from "@/lib/mission/missionState";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { PanelSection } from "@/components/ui/panel-system/PanelSection";
import { MetricRow } from "@/components/ui/panel-system/MetricRow";
import { MetricCard } from "@/components/ui/panel-system/MetricCard";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";
import { CollapsibleSection } from "@/components/ui/panel-system/CollapsibleSection";

const VESSEL_TYPES: { label: string; count: number; pct: string; color: "cyan" | "emerald" | "amber" | "dim" }[] = [
  { label: "Crude Oil Tankers", count: 127, pct: "30.8%", color: "amber" },
  { label: "Bulk Carriers", count: 98, pct: "23.8%", color: "dim" },
  { label: "Container Ships", count: 84, pct: "20.4%", color: "dim" },
  { label: "Service / Other", count: 103, pct: "25.0%", color: "cyan" },
];

const TOTAL_VESSELS = 412;
const COUNT_ANIM_DURATION_MS = 3500;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export const AISSwarmOverlay: React.FC = () => {
  const { state } = useMission();
  const isActive = state.currentStage === "AIS_SWARM";
  const [displayCount, setDisplayCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setDisplayCount(0);
      return;
    }

    const elapsed = state.stageElapsedMs;
    const progress = Math.min(elapsed / COUNT_ANIM_DURATION_MS, 1);
    const target = Math.round(easeOutCubic(progress) * TOTAL_VESSELS);
    setDisplayCount(target);
  }, [state.stageElapsedMs, isActive]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!isActive) return null;

  const showBreakdown = state.stageElapsedMs > 1800;
  const showStatus = state.stageElapsedMs > 3000;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
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
            category="03 · AIS ANALYSIS"
            title="VESSEL TRACKING"
            statusText={showStatus ? "INDEXED" : "INGESTING"}
            statusVariant={showStatus ? "cyan" : "amber"}
          />

          {/* Primary metric block */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #1C2A38",
            }}
          >
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: "#22D3EE",
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {String(displayCount).padStart(3, "0")}
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#5A7A94",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginTop: 4,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              VESSELS ANALYZED
            </div>
          </div>

          {/* Supporting block — 2 items, visible after breakdown phase */}
          {showBreakdown && (
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #1C2A38",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <MetricRow
                label="Crude Tankers"
                value={127}
                unit="30.8%"
                color="amber"
              />
              <MetricRow
                label="AIS Anomalies"
                value={1}
                color="red"
              />
            </div>
          )}

          {/* Collapsible: Fleet Breakdown + Spatial Pipeline */}
          <CollapsibleSection label="Fleet Breakdown">
            {VESSEL_TYPES.map((v) => (
              <MetricRow
                key={v.label}
                label={v.label}
                value={v.count}
                unit={`(${v.pct})`}
                color={v.color}
              />
            ))}

            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                }}
              >
                <span style={{ color: "#5A7A94" }}>H3 Hex Indexing (Res 7):</span>
                {showStatus ? (
                  <StatusBadge label="READY" variant="emerald" size="sm" />
                ) : (
                  <StatusBadge label="PROCESSING" variant="amber" pulse size="sm" />
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                }}
              >
                <span style={{ color: "#5A7A94" }}>Trajectory Discretization:</span>
                <span style={{ color: "#E2E8F0", fontWeight: 600 }}>1-Hour Interpolation</span>
              </div>
            </div>
          </CollapsibleSection>
        </OperationsPanel>
      </div>
    </div>
  );
};

export default AISSwarmOverlay;
