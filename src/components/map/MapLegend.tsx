import { LAYER_META, type LayerId } from "@/lib/map/config";
import { Info } from "lucide-react";

interface MapLegendProps {
  visibility: Record<LayerId, boolean>;
}

export function MapLegend({ visibility }: MapLegendProps) {
  const visible = LAYER_META.filter((m) => visibility[m.id]);
  if (visible.length === 0) return null;

  return (
    <div className="w-64 rounded-2xl border border-slate-800/90 bg-slate-950/85 p-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2.5">
        <div className="flex items-center gap-1.5 text-slate-200">
          <Info className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">
            Map Legend
          </span>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 font-semibold">
          {visible.length} Active
        </span>
      </div>

      {/* Layer Swatches */}
      <ul className="space-y-1.5 text-xs">
        {visible.map((meta) => (
          <li key={meta.id} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-xs"
              style={{ backgroundColor: meta.color }}
            />
            <span className="text-slate-200 text-[11px] font-medium truncate">
              {meta.label}
            </span>
          </li>
        ))}
      </ul>

      {/* H3 Density Ramp if H3 corridor is visible */}
      {visibility["h3-corridor"] && (
        <div className="mt-3 border-t border-slate-800/80 pt-2.5">
          <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-1">
            <span>Low Density</span>
            <span className="text-rose-400 font-semibold">Critical Plume</span>
          </div>
          <div
            className="h-2.5 w-full rounded-md shadow-inner"
            style={{
              background: "linear-gradient(to right, #22d3ee, #f59e0b, #f97316, #f43f5e)",
            }}
          />
        </div>
      )}
    </div>
  );
}
