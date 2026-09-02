import { LAYER_META, type LayerId } from "@/lib/map/config";

interface MapLegendProps {
  visibility: Record<LayerId, boolean>;
}

export function MapLegend({ visibility }: MapLegendProps) {
  const visible = LAYER_META.filter((m) => visibility[m.id]);
  if (visible.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-4 z-10 rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md max-w-xs">
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Map Legend
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {visible.length} Active
        </span>
      </div>

      <ul className="space-y-1.5 text-xs">
        {visible.map((meta) => (
          <li key={meta.id} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: meta.color }}
            />
            <span className="text-foreground text-[11px] font-medium truncate">
              {meta.label}
            </span>
          </li>
        ))}
      </ul>

      {/* H3 Density Ramp if H3 corridor is visible */}
      {visibility["h3-corridor"] && (
        <div className="mt-2.5 border-t border-border/60 pt-2">
          <div className="flex justify-between text-[9px] font-mono text-muted-foreground mb-1">
            <span>Low Plume Density</span>
            <span>Critical</span>
          </div>
          <div
            className="h-2 w-full rounded-sm"
            style={{
              background: "linear-gradient(to right, #22d3ee, #f59e0b, #f97316, #f43f5e)",
            }}
          />
        </div>
      )}
    </div>
  );
}
