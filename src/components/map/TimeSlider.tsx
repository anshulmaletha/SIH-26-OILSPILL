import { useEffect, useRef, useState } from "react";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";

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

export function TimeSlider({
  selectedHour,
  onSelectHour,
  detectionTimeIso = "2026-09-02T06:00:00Z",
}: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const currentHourRef = useRef(selectedHour);
  currentHourRef.current = selectedHour;

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

  const fillPercent = ((selectedHour + 24) / 24) * 100;

  return (
    <OperationsPanel
      variant="floating"
      borderLeftAccent
      accentColor="cyan"
      className="w-[360px]"
    >
      <PanelHeader
        category="Temporal Scrubber"
        title="OBSERVATION TIMELINE"
        subtitle={formattedUtc}
        statusText={`T = ${selectedHour}H`}
        statusVariant="cyan"
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleStepBack}
              disabled={selectedHour <= -24}
              className="w-5 h-5 flex items-center justify-center border border-[#1C2A38] bg-[#0A0E14] text-[#5A7A94] hover:text-[#22D3EE] rounded-xs text-[10px] cursor-pointer disabled:opacity-30"
              title="Step back 6h"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="h-5 px-2 flex items-center justify-center border rounded-xs font-mono text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-all"
              style={{
                borderColor: isPlaying ? "#22D3EE" : "#1C2A38",
                background: isPlaying ? "rgba(34, 211, 238, 0.15)" : "#0A0E14",
                color: isPlaying ? "#22D3EE" : "#5A7A94",
              }}
            >
              {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
            </button>
            <button
              type="button"
              onClick={handleStepForward}
              disabled={selectedHour >= 0}
              className="w-5 h-5 flex items-center justify-center border border-[#1C2A38] bg-[#0A0E14] text-[#5A7A94] hover:text-[#22D3EE] rounded-xs text-[10px] cursor-pointer disabled:opacity-30"
              title="Step forward 6h"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => { setIsPlaying(false); onSelectHour(0); }}
              className="w-5 h-5 flex items-center justify-center border border-[#1C2A38] bg-[#0A0E14] text-[#3A5268] hover:text-[#E2E8F0] rounded-xs text-[9px] cursor-pointer"
              title="Reset to T=0h"
            >
              ↺
            </button>
          </div>
        }
      />

      <div className="p-3 flex flex-col gap-2.5">
        {/* Step Buttons */}
        <div className="grid grid-cols-5 gap-1">
          {OBSERVATION_STEPS.map((step) => {
            const isActive = selectedHour === step.value;
            return (
              <button
                key={step.value}
                type="button"
                onClick={() => { setIsPlaying(false); onSelectHour(step.value); }}
                className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xs border transition-all cursor-pointer"
                style={{
                  borderColor: isActive ? "#22D3EE" : "#1C2A38",
                  backgroundColor: isActive ? "rgba(34, 211, 238, 0.12)" : "#0A0E14",
                  color: isActive ? "#22D3EE" : "#5A7A94",
                }}
              >
                <span className="font-mono text-[10px] font-bold leading-none mb-0.5">
                  {step.label}
                </span>
                <span className="text-[7px] truncate max-w-full font-sans">
                  {step.tag}
                </span>
              </button>
            );
          })}
        </div>

        {/* Scrubber Input */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[8px] font-mono">
            <span className="text-[#22D3EE] font-bold">
              CURRENT OFFSET: {selectedHour === 0 ? "0h (Detection)" : `${selectedHour}h`}
            </span>
            <span className="text-[#3A5268]">Scrub ←→</span>
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
    </OperationsPanel>
  );
}

export default TimeSlider;
