import { useState } from "react";
import { Layers, ChevronUp, ChevronDown, Radar, Flame, Hexagon, Ship, Sliders } from "lucide-react";
import { LAYER_META, type LayerId } from "@/lib/map/config";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface LayerPanelProps {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  sarOpacity?: number;
  onChangeSarOpacity?: (opacity: number) => void;
}

const LAYER_ICONS: Record<LayerId, typeof Layers> = {
  "sar-raster": Radar,
  "slick-polygon": Flame,
  "h3-corridor": Hexagon,
  "ais-tracks": Ship,
};

export function LayerPanel({
  visibility,
  onToggle,
  sarOpacity = 0.55,
  onChangeSarOpacity,
}: LayerPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="w-80 rounded-2xl border border-slate-800/90 bg-slate-950/85 shadow-2xl shadow-black/60 backdrop-blur-xl transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Maritime Layers
            </h2>
            <p className="text-[10px] text-slate-400">
              P1, P4 & P5 Cross-Pipeline Overlays
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
          title={isCollapsed ? "Expand Layer Panel" : "Collapse Layer Panel"}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="p-3.5 space-y-3 animate-in fade-in duration-200">
          <ul className="space-y-1.5">
            {LAYER_META.map((meta) => {
              const active = visibility[meta.id];
              const Icon = LAYER_ICONS[meta.id] ?? Layers;

              return (
                <li key={meta.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(meta.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-200 cursor-pointer ${
                      active
                        ? "border-slate-700/80 bg-slate-900/70 hover:bg-slate-850"
                        : "border-transparent bg-transparent opacity-60 hover:opacity-90 hover:bg-slate-900/30"
                    }`}
                  >
                    {/* Layer Icon + Swatch Indicator */}
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all"
                      style={{
                        backgroundColor: active ? `${meta.color}20` : "rgba(100, 116, 139, 0.1)",
                        color: active ? meta.color : "#94a3b8",
                        border: `1px solid ${active ? `${meta.color}50` : "rgba(100, 116, 139, 0.2)"}`,
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Meta Label & Description */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-100">
                        {meta.label}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {meta.description}
                      </span>
                    </span>

                    {/* Custom Toggle Switch */}
                    <span
                      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200 ${
                        active ? "bg-cyan-500" : "bg-slate-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200 ${
                          active ? "translate-x-3.5 left-0" : "left-0.5"
                        }`}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* SAR Opacity Control Slider */}
          {visibility["sar-raster"] && onChangeSarOpacity && (
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5 pt-2">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                  <Sliders className="h-3 w-3 text-cyan-400" />
                  <span>SAR Raster Opacity</span>
                </div>
                <span className="font-mono text-xs font-bold text-cyan-300">
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
      )}
    </div>
  );
}
