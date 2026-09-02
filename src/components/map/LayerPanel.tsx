import { Layers, X } from "lucide-react";
import { LAYER_META, type LayerId } from "@/lib/map/config";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface LayerPanelProps {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  sarOpacity?: number;
  onChangeSarOpacity?: (opacity: number) => void;
  onClose?: () => void;
}

export function LayerPanel({
  visibility,
  onToggle,
  sarOpacity = 0.55,
  onChangeSarOpacity,
  onClose,
}: LayerPanelProps) {
  return (
    <div className="absolute left-4 top-4 z-10 w-72 rounded-xl border border-border/80 bg-card/90 p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-wide text-foreground">
            Maritime Layers
          </h2>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Day 2 pipeline integrations (P1, P4, P5)
      </p>

      <ul className="space-y-1.5">
        {LAYER_META.map((meta) => {
          const active = visibility[meta.id];
          return (
            <li key={meta.id}>
              <button
                type="button"
                onClick={() => onToggle(meta.id)}
                aria-pressed={active}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-accent"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: meta.color,
                    opacity: active ? 1 : 0.3,
                    boxShadow: active ? `0 0 8px ${meta.color}80` : "none",
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {meta.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {meta.description}
                  </span>
                </span>
                <span
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                    active ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-primary-foreground transition-transform ${
                      active ? "translate-x-4.5 left-0" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* SAR Opacity Slider */}
      {visibility["sar-raster"] && onChangeSarOpacity && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
              SAR Raster Opacity
            </span>
            <span className="font-mono text-xs font-bold text-foreground">
              {Math.round(sarOpacity * 100)}%
            </span>
          </div>
          <Slider
            value={[sarOpacity * 100]}
            min={10}
            max={100}
            step={5}
            onValueChange={(val) => {
              if (val[0] !== undefined) onChangeSarOpacity(val[0] / 100);
            }}
          />
        </div>
      )}
    </div>
  );
}
