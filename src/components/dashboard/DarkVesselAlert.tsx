import { useState } from "react";
import {
  AlertOctagon,
  WifiOff,
  Crosshair,
  X,
  ChevronDown,
  ChevronUp,
  Radar,
  Clock,
  Navigation,
} from "lucide-react";
import type { VesselTrack } from "@/lib/contracts/p5";
import { Button } from "@/components/ui/button";

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

  if (darkVessels.length === 0 || isDismissed) {
    return null;
  }

  return (
    <div className="w-full max-w-xl rounded-2xl border-2 border-rose-500/70 bg-slate-950/95 p-3.5 shadow-2xl shadow-rose-950/50 backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 text-slate-100">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between border-b border-rose-900/60 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
            <AlertOctagon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                CRITICAL ALERT: Dark Vessel Detected
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.2 text-[9px] font-mono font-bold text-rose-300 border border-rose-500/40">
                <WifiOff className="h-2.5 w-2.5" />
                P5 Anomaly Flag
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {darkVessels.length} vessel{darkVessels.length > 1 ? "s" : ""} exhibiting deliberate AIS transponder blackout
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-6 w-6 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 cursor-pointer"
            title={isCollapsed ? "Expand Alert" : "Collapse Alert"}
          >
            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDismissed(true)}
            className="h-6 w-6 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 cursor-pointer"
            title="Dismiss Alert Banner"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Alert Content */}
      {!isCollapsed && (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          {darkVessels.map((vessel) => {
            const anomaly = vessel.darkAnomaly!;
            const isFocused = selectedVesselId === vessel.vesselId;

            return (
              <div
                key={vessel.vesselId}
                className={`rounded-xl border p-2.5 transition-all ${
                  isFocused
                    ? "border-rose-400 bg-rose-950/40 shadow-md ring-1 ring-rose-500/50"
                    : "border-rose-900/50 bg-rose-950/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-white">
                        {vessel.vesselName}
                      </span>
                      <span className="text-[10px] font-mono text-rose-300">
                        (MMSI: {vessel.mmsi})
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {vessel.vesselType} • Flag: {vessel.flag} • Dest: {vessel.destination}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => onFocusVessel?.(vessel.vesselId)}
                    className="h-7 gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-2.5 shadow-md shadow-rose-950/50 cursor-pointer"
                  >
                    <Crosshair className="h-3 w-3" />
                    <span>Focus on Map</span>
                  </Button>
                </div>

                {/* Telemetry Metrics */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono mb-2">
                  <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5">
                    <span className="text-slate-400 block text-[9px] flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 text-rose-400" />
                      Blackout Gap
                    </span>
                    <span className="font-bold text-rose-300">
                      {anomaly.gapDurationHours.toFixed(1)} Hours
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5">
                    <span className="text-slate-400 block text-[9px] flex items-center gap-1">
                      <Navigation className="h-2.5 w-2.5 text-amber-400" />
                      Corridor Match
                    </span>
                    <span className="font-bold text-amber-300">
                      {anomaly.spillCorridorIntersection ? "Confirmed (Origin)" : "No"}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5">
                    <span className="text-slate-400 block text-[9px] flex items-center gap-1">
                      <Radar className="h-2.5 w-2.5 text-cyan-400" />
                      Radar Correlated
                    </span>
                    <span className="font-bold text-cyan-300">
                      {anomaly.radarContactCorrelated ? "Yes (Coastal #4)" : "No"}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-rose-950/50 border border-rose-900/60 p-2 text-[10px] text-slate-300 leading-relaxed">
                  <strong className="text-rose-300">Forensic Intelligence Note: </strong>
                  {anomaly.notes}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
