import { useState } from "react";
import type { VesselTrack } from "@/lib/contracts/p5";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { AlertCard } from "@/components/ui/panel-system/AlertCard";
import { MetricCard } from "@/components/ui/panel-system/MetricCard";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";

export interface DarkVesselAlertProps {
  vessels?: VesselTrack[];
  selectedVesselId?: string;
  onFocusVessel?: (vesselId: string) => void;
}

export function DarkVesselAlert({
  vessels = [],
  selectedVesselId,
  onFocusVessel,
}: DarkVesselAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const darkVessels = vessels.filter((v) => v.isDarkVessel && v.darkAnomaly);

  if (darkVessels.length === 0 || isDismissed) return null;

  return (
    <OperationsPanel
      variant="alert"
      accentColor="red"
      borderLeftAccent
      className="w-[280px]"
    >
      <PanelHeader
        category="WARNING"
        title="DARK VESSEL"
        statusText="HIGH RISK"
        statusVariant="red"
        onClose={() => setIsDismissed(true)}
      />

      <div className="p-3 flex flex-col gap-2.5">
        {darkVessels.map((vessel) => {
          const anomaly = vessel.darkAnomaly!;
          const pos = vessel.path?.[0];
          const latStr = pos ? `${Math.abs(pos[1]).toFixed(4)}°${pos[1] >= 0 ? "N" : "S"}` : "19.2800°N";
          const lngStr = pos ? `${Math.abs(pos[0]).toFixed(4)}°${pos[0] >= 0 ? "E" : "W"}` : "71.9000°E";

          return (
            <div key={vessel.vesselId} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] font-bold text-[#E2E8F0] tracking-wide">
                  {vessel.vesselName}
                </span>
                <span className="font-mono text-[9px] text-[#EF4444] font-semibold">
                  AIS INACTIVE
                </span>
              </div>

              {/* Coordinates */}
              <div className="font-mono text-[10px] text-[#88A2BC] bg-[#111822] px-2 py-1 rounded border border-[#1C2A38]">
                {latStr} · {lngStr}
              </div>

              {/* Metric Row */}
              <div className="flex items-center justify-between py-1 border-b border-[#1C2A38] text-[10px]">
                <span className="text-[#5A7A94] font-mono text-[9px] uppercase">AIS SIGNAL LOST</span>
                <span className="font-mono font-bold text-[#EF4444]">{anomaly.gapDurationHours.toFixed(1)} h</span>
              </div>

              {/* Action */}
              <button
                type="button"
                onClick={() => onFocusVessel?.(vessel.vesselId)}
                className="w-full py-1.5 px-3 rounded bg-[#EF4444]/15 hover:bg-[#EF4444]/25 border border-[#EF4444] text-[#EF4444] font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all mt-1"
              >
                INVESTIGATE TARGET →
              </button>
            </div>
          );
        })}
      </div>
    </OperationsPanel>
  );
}

export default DarkVesselAlert;
