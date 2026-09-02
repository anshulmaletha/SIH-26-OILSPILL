import { useEffect, useState } from "react";
import { Clock, Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Activity } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface TimeSliderProps {
  selectedHour: number;
  onSelectHour: (hour: number) => void;
  detectionTimeIso?: string;
}

const OBSERVATION_STEPS: { value: number; label: string; tag: string }[] = [
  { value: -24, label: "-24h", tag: "Release Origin" },
  { value: -18, label: "-18h", tag: "Early Plume" },
  { value: -12, label: "-12h", tag: "Mid Drift" },
  { value: -6, label: "-6h", tag: "Pre-Detection" },
  { value: 0, label: "0h", tag: "SAR Scene" },
];

export function TimeSlider({
  selectedHour,
  onSelectHour,
  detectionTimeIso = "2026-09-02T06:00:00Z",
}: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-play animation timer for demo presentations
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      onSelectHour((prev: number) => {
        if (prev >= 0) return -24;
        const next = prev + 6;
        return next > 0 ? 0 : next;
      });
    }, 1300);

    return () => clearInterval(timer);
  }, [isPlaying, onSelectHour]);

  // Compute calculated UTC timestamp
  const baseTime = new Date(detectionTimeIso).getTime();
  const currentStepTime = new Date(baseTime + selectedHour * 3600 * 1000);
  const formattedUtc = currentStepTime.toUTCString().replace("GMT", "UTC");

  const handleStepBack = () => {
    const steps = [-24, -18, -12, -6, 0];
    const prev = [...steps].reverse().find((s) => s < selectedHour);
    onSelectHour(prev !== undefined ? prev : -24);
  };

  const handleStepForward = () => {
    const steps = [-24, -18, -12, -6, 0];
    const next = steps.find((s) => s > selectedHour);
    onSelectHour(next !== undefined ? next : 0);
  };

  return (
    <div className="w-full max-w-xl rounded-2xl border border-cyan-500/25 bg-slate-950/85 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl transition-all duration-300">
      {/* Top Bar: Title, UTC Timestamp & Controls */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-xs">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Observation Timeline
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.2 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-500/30">
                <Activity className="h-2.5 w-2.5 animate-pulse text-cyan-400" />
                {selectedHour === 0 ? "T = 0h (Detection)" : `T = ${selectedHour}h`}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              {formattedUtc}
            </p>
          </div>
        </div>

        {/* Playback Button Group */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStepBack}
            disabled={selectedHour <= -24}
            className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
            title="Step back 6 hours"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant={isPlaying ? "default" : "outline"}
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`h-7 gap-1.5 px-2.5 text-xs font-semibold shadow-xs transition-all ${
              isPlaying
                ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold"
                : "border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3 w-3 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current" />
                <span>Play Demo</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleStepForward}
            disabled={selectedHour >= 0}
            className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
            title="Step forward 6 hours"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsPlaying(false);
              onSelectHour(0);
            }}
            className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
            title="Reset to 0h"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Quick Select Buttons Grid */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {OBSERVATION_STEPS.map((step) => {
          const isSelected = selectedHour === step.value;
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                onSelectHour(step.value);
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-200 font-bold shadow-md shadow-cyan-500/10 scale-[1.02]"
                  : "border-slate-800/80 bg-slate-900/50 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span className="font-mono text-xs font-bold">{step.label}</span>
              <span className="text-[9px] opacity-75 truncate max-w-full font-medium">
                {step.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* Smooth Scrubber Slider */}
      <div className="px-1.5">
        <Slider
          value={[selectedHour]}
          min={-24}
          max={0}
          step={1}
          onValueChange={(val) => {
            setIsPlaying(false);
            if (val[0] !== undefined) onSelectHour(val[0]);
          }}
          className="cursor-pointer"
        />
      </div>
    </div>
  );
}
