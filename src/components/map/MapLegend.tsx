import { useState } from "react";
import { LAYER_META, type LayerId } from "@/lib/map/config";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapLegendProps {
  visibility: Record<LayerId, boolean>;
}

export function MapLegend({ visibility }: MapLegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const visible = LAYER_META.filter((m) => visibility[m.id]);
  if (visible.length === 0) return null;

  return (
    <div className="w-72 sm:w-80 rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden flex flex-col text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-3.5 py-2.5 bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/30">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Map Legend
              </span>
              <span className="text-[10px] font-mono text-primary font-bold">
                ({visible.length} Active)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Symbology & Density Color Ramp
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          title={isCollapsed ? "Expand Map Legend" : "Collapse Map Legend"}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="p-3 space-y-2.5 animate-in fade-in duration-200">
          {/* Layer Swatches */}
          <ul className="space-y-1.5 text-xs">
            {visible.map((meta) => (
              <li key={meta.id} className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm shadow-xs"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-foreground text-[11px] font-medium truncate">
                  {meta.label}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {meta.id === "sar-raster" ? "Radar Scene" : meta.id === "slick-polygon" ? "Polygon" : meta.id === "h3-corridor" ? "H3 Hex" : "Vessels"}
                </span>
              </li>
            ))}
          </ul>

          {/* H3 Density Ramp if H3 corridor is visible */}
          {visibility["h3-corridor"] && (
            <div className="mt-2.5 border-t border-border/60 pt-2">
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground mb-1 font-medium">
                <span>Low Density</span>
                <span className="text-rose-500 font-bold">Critical Plume</span>
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
      )}
    </div>
  );
}
