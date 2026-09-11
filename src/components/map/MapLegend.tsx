import { useState } from "react";
import { LAYER_META, type LayerId } from "@/lib/map/config";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";

interface MapLegendProps {
  visibility: Record<LayerId, boolean>;
}

const DENSITY_SWATCHES = [
  { opacity: 0.14, label: "Low" },
  { opacity: 0.31, label: "" },
  { opacity: 0.53, label: "" },
  { opacity: 0.72, label: "" },
  { opacity: 0.90, label: "Peak" },
];

function HexSwatch({ opacity, label }: { opacity: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg width="18" height="16" viewBox="-10 -9 20 18">
        <polygon
          points="9,0 4.5,-7.79 -4.5,-7.79 -9,0 -4.5,7.79 4.5,7.79"
          fill="#22D3EE"
          fillOpacity={opacity}
          stroke="#B4F0FF"
          strokeOpacity={0.85}
          strokeWidth="1"
        />
      </svg>
      {label && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "7px",
            color: "#3A5268",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function MapLegend({ visibility }: MapLegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const visible = LAYER_META.filter((m) => visibility[m.id]);
  if (visible.length === 0) return null;

  return (
    <OperationsPanel
      variant="side"
      borderLeftAccent
      accentColor="cyan"
      className="w-[240px]"
    >
      <PanelHeader
        category="MAP"
        title="LEGEND"
        statusText={`${visible.length} ACTIVE`}
        statusVariant="cyan"
        onCollapse={() => setIsCollapsed(!isCollapsed)}
        isCollapsed={isCollapsed}
      />

      {!isCollapsed && (
        <div className="p-2.5 flex flex-col gap-2">
          {/* Active Layer Swatches */}
          <div className="flex flex-col gap-1.5">
            {visible.map((meta) => (
              <div
                key={meta.id}
                className="flex items-center justify-between py-1 px-1.5 rounded-xs bg-[#0A0E14] border border-[#1C2A38]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-xs flex-shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-[10px] font-sans text-[#E2E8F0]">
                    {meta.label}
                  </span>
                </div>
                <span className="text-[8px] font-mono text-[#5A7A94] uppercase">
                  {meta.id === "sar-raster" ? "SAR" : meta.id === "slick-polygon" ? "POLY" : meta.id === "h3-corridor" ? "H3" : "AIS"}
                </span>
              </div>
            ))}
          </div>

          {/* H3 density row */}
          {visibility["h3-corridor"] && (
            <div className="pt-2 border-t border-[#1C2A38]">
              <span className="text-[7.5px] font-mono font-bold text-[#5A7A94] uppercase tracking-wider block mb-1.5">
                H3 Corridor Plume Density
              </span>
              <div className="flex items-end justify-between px-1">
                {DENSITY_SWATCHES.map((s, i) => (
                  <HexSwatch key={i} opacity={s.opacity} label={s.label} />
                ))}
              </div>
            </div>
          )}

          {/* Dark Vessel Alert Tag */}
          <div className="pt-2 border-t border-[#1C2A38] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
              <span className="text-[10px] font-sans font-semibold text-[#E2E8F0]">
                Dark Vessel Alert
              </span>
            </div>
            <StatusBadge label="CFAR RADAR" variant="red" size="sm" />
          </div>
        </div>
      )}
    </OperationsPanel>
  );
}

export default MapLegend;
