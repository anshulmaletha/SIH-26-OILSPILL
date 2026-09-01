import { LAYER_META, type LayerId } from "@/lib/map/config";

interface MapLegendProps {
  visibility: Record<LayerId, boolean>;
}

export function MapLegend({ visibility }: MapLegendProps) {
  const visible = LAYER_META.filter((m) => visibility[m.id]);
  if (visible.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-4 z-10 rounded-lg border border-border bg-card/90 px-3 py-2 shadow-lg backdrop-blur-md">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Legend
      </p>
      <ul className="space-y-1">
        {visible.map((meta) => (
          <li key={meta.id} className="flex items-center gap-2 text-xs text-foreground">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: meta.color }}
            />
            {meta.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
