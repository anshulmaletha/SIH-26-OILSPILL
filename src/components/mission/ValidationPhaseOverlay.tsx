import React from "react";
import { useMission } from "@/lib/mission/missionState";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { PanelSection } from "@/components/ui/panel-system/PanelSection";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";
import { ConfidenceIndicator } from "@/components/ui/panel-system/ConfidenceIndicator";

type CheckStatus = "pending" | "active" | "complete";

interface CheckItemProps {
  status: CheckStatus;
  title: string;
  result: string;
  subtext?: string;
  showProgress?: boolean;
}

const CheckItem: React.FC<CheckItemProps> = ({
  status,
  title,
  result,
  subtext,
  showProgress = false,
}) => {
  const badgeMap = {
    pending: <StatusBadge label="PENDING" variant="dim" size="sm" />,
    active: <StatusBadge label="EVALUATING" variant="amber" pulse size="sm" />,
    complete: <StatusBadge label="PASSED" variant="emerald" size="sm" />,
  };

  return (
    <div className="flex flex-col py-2 border-b border-[#111822] last:border-b-0">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "10px",
            color: "#C8D8E8",
            fontWeight: 500,
          }}
        >
          {title}
        </span>
        {badgeMap[status]}
      </div>

      {status !== "pending" && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            color: status === "complete" ? "#22D3EE" : "#5A7A94",
            lineHeight: 1.3,
          }}
        >
          {result}
        </div>
      )}

      {subtext && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "8px",
            color: "#3A5268",
            marginTop: "2px",
          }}
        >
          {subtext}
        </div>
      )}

      {showProgress && status === "active" && (
        <div className="h-1 bg-[#1C2A38] mt-2 overflow-hidden rounded-xs">
          <div className="h-full bg-[#F59E0B] w-3/5 animate-pulse" />
        </div>
      )}
    </div>
  );
};

export const ValidationPhaseOverlay: React.FC = () => {
  const { state } = useMission();
  const isActive = state.currentStage === "VALIDATION_AUDIT";
  const elapsed = state.stageElapsedMs ?? 0;

  if (!isActive) return null;

  const getCheckStatus = (showAt: number, completeAt: number): CheckStatus => {
    if (elapsed < showAt) return "pending";
    if (elapsed >= completeAt) return "complete";
    return "active";
  };

  const check1Status = getCheckStatus(500, 2500);
  const check2Status = getCheckStatus(2500, 4500);
  const check3Status = getCheckStatus(4500, 6500);

  const showDiagnostic = elapsed > 6000;
  const showBadge = elapsed > 7000;
  const confPct = showDiagnostic ? Math.min(((elapsed - 6000) / 1000) * 94.8, 94.8) : 0;

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
          right: 14,
          width: 300,
          maxHeight: "calc(100vh - 200px)",
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
            category="02 · VALIDATION"
            title="DETECTION AUDIT"
            statusText={check3Status === "complete" ? "DISCRIMINATED" : "AUDITING"}
            statusVariant={check3Status === "complete" ? "emerald" : "amber"}
          />

          <PanelSection title="Environmental Discrimination Checks">
            {elapsed >= 500 && (
              <CheckItem
                status={check1Status}
                title="ERA5 Surface Wind Analysis"
                result="6.6 m/s WSW (Above 3.0 m/s calm threshold)"
                subtext="Rules out calm-water lookalike slick"
                showProgress
              />
            )}

            {elapsed >= 2500 && (
              <CheckItem
                status={check2Status}
                title="MODIS Chlorophyll-a / Algal Index"
                result="0.21 mg/m³ — Negative surfactant"
                subtext="Rules out biogenic algal bloom film"
                showProgress
              />
            )}

            {elapsed >= 4500 && (
              <CheckItem
                status={check3Status}
                title="GEBCO Bathymetric Wave Check"
                result="Depth 62m — No internal wave reflection"
                subtext="Rules out bathymetric radar artifact"
                showProgress
              />
            )}
          </PanelSection>

          {showDiagnostic && (
            <PanelSection title="Discrimination Confidence" borderBottom={false}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ConfidenceIndicator
                  label="Classification Confidence"
                  value={confPct}
                  color="cyan"
                  height={4}
                />

                {showBadge && (
                  <div
                    style={{
                      marginTop: 4,
                      padding: "12px 14px",
                      background: "rgba(34,211,238,0.06)",
                      border: "1px solid rgba(34,211,238,0.25)",
                      borderRadius: 2,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {/* Prominent result block */}
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#22D3EE",
                        fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: "0.04em",
                        lineHeight: 1.2,
                      }}
                    >
                      CRUDE PETROLEUM SLICK
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#10B981",
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      CONFIRMED
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "#22D3EE",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600,
                        }}
                      >
                        {confPct.toFixed(1)}%
                      </span>
                      <StatusBadge label="VERIFIED" variant="emerald" size="sm" />
                    </div>
                  </div>
                )}
              </div>
            </PanelSection>
          )}
        </OperationsPanel>
      </div>
    </div>
  );
};

export default ValidationPhaseOverlay;
