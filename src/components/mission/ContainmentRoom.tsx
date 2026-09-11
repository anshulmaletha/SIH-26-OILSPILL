import React from "react";
import { useMission } from "@/lib/mission/missionState";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { PanelSection } from "@/components/ui/panel-system/PanelSection";
import { MetricRow } from "@/components/ui/panel-system/MetricRow";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";
import { ConfidenceIndicator } from "@/components/ui/panel-system/ConfidenceIndicator";
import { AlertCard } from "@/components/ui/panel-system/AlertCard";
import { PanelFooter } from "@/components/ui/panel-system/PanelFooter";
import { CollapsibleSection } from "@/components/ui/panel-system/CollapsibleSection";

interface DriftProjection {
  hour: number;
  lat: number;
  lng: number;
  areaKm2: number;
  label: string;
}

const DRIFT_PROJECTIONS: DriftProjection[] = [
  { hour: 0,  lat: 19.35, lng: 71.85, areaKm2: 14.2,  label: "T+0h  · Detected position" },
  { hour: 6,  lat: 19.18, lng: 72.05, areaKm2: 18.4,  label: "T+6h  · Active drift" },
  { hour: 12, lat: 19.05, lng: 72.22, areaKm2: 28.1,  label: "T+12h · Expanding plume" },
  { hour: 24, lat: 18.90, lng: 72.50, areaKm2: 44.8,  label: "T+24h · Coastal approach" },
  { hour: 48, lat: 18.75, lng: 72.75, areaKm2: 72.3,  label: "T+48h · Mangrove threat" },
];

const BOOM_SECTORS: { id: string; name: string; status: string; variant: "emerald" | "amber" | "dim" }[] = [
  { id: "A", name: "Dharamtar Inlet", status: "RECOMMENDED", variant: "emerald" },
  { id: "B", name: "Alibag Coastal", status: "STANDBY", variant: "amber" },
  { id: "C", name: "Elephanta Channel", status: "PLANNED", variant: "dim" },
];

const SKIMMER_ZONES = [
  { id: "Z1", name: "Primary Recovery", lat: "19.10°N", lng: "72.20°E", rate: "180 t/day" },
  { id: "Z2", name: "Secondary Zone", lat: "18.95°N", lng: "72.40°E", rate: "120 t/day" },
  { id: "Z3", name: "Coastal Buffer", lat: "18.85°N", lng: "72.60°E", rate: "80 t/day" },
];

export const ContainmentRoom: React.FC = () => {
  const { state, dispatch } = useMission();

  if (state.currentStage !== "CONTAINMENT_ROOM") return null;

  const elapsed = state.stageElapsedMs;

  const forwardHours = Math.min(48, Math.round((elapsed / 30000) * 48));
  const currentDrift = DRIFT_PROJECTIONS.reduce((prev, curr) =>
    Math.abs(curr.hour - forwardHours) < Math.abs(prev.hour - forwardHours) ? curr : prev
  );

  const containEff = Math.min(67, Math.round(elapsed / 450));

  return (
    <div
      style={{
        position: "absolute",
        top: 52,
        right: 0,
        bottom: 0,
        zIndex: 25,
        width: 360,
        pointerEvents: "auto",
      }}
    >
      <OperationsPanel
        variant="drawer"
        borderLeftAccent
        accentColor="emerald"
        style={{
          height: "100%",
          borderRadius: 0,
          borderTop: "none",
          borderRight: "none",
          borderBottom: "none",
          backgroundColor: "#080B0F",
        }}
      >
        <PanelHeader
          category="06 · RESPONSE"
          title="INCIDENT CONTAINMENT"
          statusText="ACTIVE OPS"
          statusVariant="emerald"
          action={
            <button
              type="button"
              onClick={() => dispatch({ type: "NEXT_STAGE" })}
              className="px-2 py-1 rounded-xs bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/25 text-[8.5px] font-mono font-bold tracking-wider cursor-pointer uppercase transition-all"
            >
              CASE FILE →
            </button>
          }
        />

        {/* Scrollable body */}
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* ── PRIMARY METRIC BLOCK ── */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #1C2A38",
            }}
          >
            {/* Current drift hour — big number */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 30,
                fontWeight: 800,
                color: "#10B981",
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              T+{forwardHours}h
            </div>

            {/* Current drift step label */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: "#5A7A94",
                marginBottom: 6,
              }}
            >
              {currentDrift.label}
            </div>

            {/* Plume area */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#E2E8F0",
                marginBottom: 8,
              }}
            >
              Plume Area:{" "}
              <strong style={{ color: "#E2E8F0" }}>{currentDrift.areaKm2} km²</strong>
            </div>

            {/* Progress bar */}
            <ConfidenceIndicator
              value={(forwardHours / 48) * 100}
              showPercent={false}
              color="emerald"
              height={3}
            />
          </div>

          {/* ── CONTAINMENT ASSETS (Boom sectors) ── */}
          <PanelSection title="CONTAINMENT ASSETS">
            <div className="flex flex-col gap-1.5">
              {BOOM_SECTORS.map((boom) => (
                <div
                  key={boom.id}
                  className="flex items-center justify-between p-2 rounded-xs bg-[#0A0E14] border border-[#1C2A38]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold text-[#22D3EE]">
                      Sector {boom.id}
                    </span>
                    <span className="text-[10px] text-[#E2E8F0] font-medium">{boom.name}</span>
                  </div>
                  <StatusBadge label={boom.status} variant={boom.variant} size="sm" />
                </div>
              ))}
            </div>
          </PanelSection>

          {/* ── ECOLOGICAL ALERT (appears at T+18h) ── */}
          {forwardHours >= 18 && (
            <div className="p-3">
              <AlertCard
                severity="warning"
                category="Ecological Risk Alert"
                title="Mangrove Zone Impact Threat"
                description="Projected shoreline contact near Dharamtar inlet at T+31h. Prioritize boom placement to protect coastal wetlands."
              />
            </div>
          )}

          {/* ── SKIMMER SUMMARY ROW ── */}
          <div style={{ padding: "8px 14px", borderTop: "1px solid #1C2A38" }}>
            <MetricRow
              label="Skimmer Capacity"
              value="380 t/day"
              unit="3 units active"
              color="emerald"
            />
          </div>

          {/* ── SKIMMER ZONE DETAILS (collapsible) ── */}
          <CollapsibleSection label="Skimmer Zone Details">
            <div className="flex flex-col gap-1.5">
              {SKIMMER_ZONES.map((z) => (
                <div
                  key={z.id}
                  className="flex items-center justify-between p-2 rounded-xs bg-[#0A0E14] border border-[#1C2A38]"
                >
                  <div>
                    <span className="text-[10px] text-[#E2E8F0] font-semibold block">{z.name}</span>
                    <span className="text-[8px] font-mono text-[#5A7A94]">
                      {z.lat} · {z.lng}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-mono font-bold text-[#10B981]">{z.rate}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        <PanelFooter
          note="Incident Command System (ICS) · DG Shipping Response Level 2"
        />
      </OperationsPanel>
    </div>
  );
};

export default ContainmentRoom;
