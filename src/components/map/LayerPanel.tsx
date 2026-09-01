import { LAYER_META, type LayerId } from "@/lib/map/config";

interface LayerPanelProps {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
}

export function LayerPanel({ visibility, onToggle }: LayerPanelProps) {
  return (
    <div className="absolute left-4 top-4 z-10 w-72 rounded-xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-md">
      <h2 className="text-sm font-semibold tracking-wide text-foreground">
        Maritime Layers
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Placeholder layers — Day 1 foundation
      </p>
      <ul className="mt-3 space-y-1.5">
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
                  style={{ backgroundColor: meta.color, opacity: active ? 1 : 0.3 }}
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
    </div>
  );
}
