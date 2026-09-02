import { Clock, History } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export type ObservationHour = -24 | -18 | -12 | -6 | 0;

interface TimeSliderProps {
  selectedHour: number;
  onSelectHour: (hour: number) => void;
}

const OBSERVATION_STEPS: { value: number; label: string; description: string }[] = [
  { value: -24, label: "-24h", description: "Discharge Origin" },
  { value: -18, label: "-18h", description: "Early Drift" },
  { value: -12, label: "-12h", description: "Mid Corridor" },
  { value: -6, label: "-6h", description: "Pre-Detection" },
  { value: 0, label: "0h", description: "SAR Detection" },
];

export function TimeSlider({ selectedHour, onSelectHour }: TimeSliderProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/90 p-3.5 shadow-xl backdrop-blur-md max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-primary">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Observation Time
            </span>
            <p className="text-[10px] text-muted-foreground">
              Backtrack corridor progression driving H3 density & AIS positions
            </p>
          </div>
        </div>

        {/* Selected Pill */}
        <div className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 border border-primary/30">
          <History className="h-3 w-3 text-primary" />
          <span className="font-mono text-xs font-bold text-primary">
            {selectedHour === 0 ? "0h (Detection)" : `${selectedHour}h`}
          </span>
        </div>
      </div>

      {/* Segmented Quick Select Buttons */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {OBSERVATION_STEPS.map((step) => {
          const isSelected = selectedHour === step.value;
          return (
            <button
              key={step.value}
              type="button"
              onClick={() => onSelectHour(step.value)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-center transition-all ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="font-mono text-xs font-semibold">{step.label}</span>
              <span className="text-[9px] opacity-80 truncate max-w-full">
                {step.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Smooth Range Slider */}
      <div className="px-1">
        <Slider
          value={[selectedHour]}
          min={-24}
          max={0}
          step={1}
          onValueChange={(val) => {
            if (val[0] !== undefined) onSelectHour(val[0]);
          }}
          className="cursor-pointer"
        />
      </div>
    </div>
  );
}
