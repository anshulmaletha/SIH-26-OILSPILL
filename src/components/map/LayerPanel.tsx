import { useState } from "react";
import { LAYER_META, type LayerId, TRACK_COLOR_OPTIONS } from "@/lib/map/config";
import type { VesselTrack } from "@/lib/contracts/p5";
import { OperationsPanel } from "@/components/ui/panel-system/OperationsPanel";
import { PanelHeader } from "@/components/ui/panel-system/PanelHeader";
import { PanelSection } from "@/components/ui/panel-system/PanelSection";
import { StatusBadge } from "@/components/ui/panel-system/StatusBadge";
import { MapLegend } from "./MapLegend";

const LAYER_TYPE_LABELS: Record<LayerId, string> = {
  "sar-raster":    "SAR",
  "slick-polygon": "SLICK",
  "h3-corridor":   "H3",
  "ais-tracks":    "AIS",
};

export interface LayerPanelProps {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  sarOpacity?: number | undefined;
  onChangeSarOpacity?: ((opacity: number) => void) | undefined;
  vessels?: VesselTrack[] | undefined;
  selectedTrackId?: string | undefined;
  onSelectTrackId?: ((id: string) => void) | undefined;
  selectedTrackColorId?: string | undefined;
  onSelectTrackColorId?: ((colorId: string) => void) | undefined;
  followTrack?: boolean | undefined;
  onToggleFollowTrack?: ((enabled: boolean) => void) | undefined;
}

// ── 1. Layer Controls Card ─────────────────────────────────────────────────────
export function LayerControlsCard({
  visibility,
  onToggle,
  sarOpacity = 0.55,
  onChangeSarOpacity,
}: {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  sarOpacity?: number | undefined;
  onChangeSarOpacity?: ((opacity: number) => void) | undefined;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <OperationsPanel
      variant="side"
      borderLeftAccent
      accentColor="cyan"
      className="w-[240px]"
    >
      <PanelHeader
        category="DISPLAY"
        title="LAYERS"
        onCollapse={() => setIsCollapsed(!isCollapsed)}
        isCollapsed={isCollapsed}
      />

      {!isCollapsed && (
        <div className="p-2.5 flex flex-col gap-1.5">
          {LAYER_META.map((meta) => {
            const active = visibility[meta.id];
            return (
              <button
                key={meta.id}
                type="button"
                onClick={() => onToggle(meta.id)}
                className="flex items-center justify-between p-1.5 rounded-xs border transition-all text-left cursor-pointer"
                style={{
                  background: active ? "rgba(34, 211, 238, 0.06)" : "#0A0E14",
                  borderColor: active ? "rgba(34, 211, 238, 0.3)" : "#1C2A38",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-xs"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-[10.5px] font-sans text-[#E2E8F0] font-medium">
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono text-[#5A7A94] uppercase">
                    {LAYER_TYPE_LABELS[meta.id]}
                  </span>
                  <StatusBadge
                    label={active ? "ON" : "OFF"}
                    variant={active ? "cyan" : "dim"}
                    size="sm"
                  />
                </div>
              </button>
            );
          })}

          {/* SAR Opacity Slider */}
          {visibility["sar-raster"] && onChangeSarOpacity && (
            <div className="mt-2 p-2 bg-[#0A0E14] border border-[#1C2A38] rounded-xs flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[8px] font-mono">
                <span className="text-[#5A7A94] uppercase tracking-wider">SAR BACKSCATTER OPACITY</span>
                <span className="text-[#22D3EE] font-bold">{Math.round(sarOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                className="scrubber"
                min={10}
                max={100}
                step={5}
                value={Math.round(sarOpacity * 100)}
                style={{
                  "--range-fill": `${Math.round(sarOpacity * 100)}%`,
                } as React.CSSProperties}
                onChange={(e) => onChangeSarOpacity(Number(e.target.value) / 100)}
              />
            </div>
          )}
        </div>
      )}
    </OperationsPanel>
  );
}

// ── 2. Track Selection Card ────────────────────────────────────────────────────
export function TrackSelectionCard({
  vessels = [],
  selectedTrackId = "all",
  onSelectTrackId,
  selectedTrackColorId = "cyan",
  onSelectTrackColorId,
  followTrack = false,
  onToggleFollowTrack,
}: {
  vessels?: VesselTrack[] | undefined;
  selectedTrackId?: string | undefined;
  onSelectTrackId?: ((id: string) => void) | undefined;
  selectedTrackColorId?: string | undefined;
  onSelectTrackColorId?: ((colorId: string) => void) | undefined;
  followTrack?: boolean | undefined;
  onToggleFollowTrack?: ((enabled: boolean) => void) | undefined;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const aisVessels = vessels.filter((v) => !v.isDarkVessel);

  return (
    <OperationsPanel
      variant="side"
      borderLeftAccent
      accentColor="cyan"
      className="w-[240px]"
    >
      <PanelHeader
        category="TRAJECTORY"
        title="TRACK SELECTION"
        statusText={`${aisVessels.length} TRACKS`}
        statusVariant="cyan"
        onCollapse={() => setIsCollapsed(!isCollapsed)}
        isCollapsed={isCollapsed}
      />

      {!isCollapsed && (
        <div className="p-2.5 flex flex-col gap-2.5">
          {/* Dropdown */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono text-[#5A7A94] uppercase tracking-wider">
              Active Focus Vessel
            </span>
            <select
              value={selectedTrackId}
              onChange={(e) => onSelectTrackId?.(e.target.value)}
              className="w-full bg-[#0A0E14] border border-[#1C2A38] rounded-xs px-2 py-1 text-[10.5px] font-sans text-[#E2E8F0] outline-none cursor-pointer"
            >
              <option value="all">All Tracks ({aisVessels.length})</option>
              {aisVessels.map((v) => (
                <option key={v.vesselId} value={v.vesselId}>
                  {v.vesselName}
                </option>
              ))}
            </select>
          </div>

          {/* Swatches */}
          {onSelectTrackColorId && (
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-mono text-[#5A7A94] uppercase tracking-wider">
                Trajectory Accent Color
              </span>
              <div className="flex items-center gap-1.5">
                {TRACK_COLOR_OPTIONS.map((c) => {
                  const isSelected = selectedTrackColorId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectTrackColorId(c.id)}
                      title={c.name}
                      style={{
                        width: 22,
                        height: 22,
                        background: c.hex,
                        border: isSelected ? "2px solid #E2E8F0" : "1px solid #1C2A38",
                        borderRadius: "2px",
                        cursor: "pointer",
                        opacity: isSelected ? 1 : 0.6,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Follow Track */}
          {onToggleFollowTrack && (
            <div className="flex items-center justify-between pt-2 border-t border-[#1C2A38]">
              <div>
                <span className="text-[10px] text-[#E2E8F0] font-medium block">Follow Track</span>
                <span className="text-[8px] font-mono text-[#5A7A94]">Auto-center camera</span>
              </div>
              <button
                type="button"
                onClick={() => onToggleFollowTrack(!followTrack)}
                className="px-2 py-1 rounded-xs border font-mono text-[8px] font-bold uppercase tracking-wider cursor-pointer"
                style={{
                  background: followTrack ? "rgba(34, 211, 238, 0.15)" : "#0A0E14",
                  borderColor: followTrack ? "#22D3EE" : "#1C2A38",
                  color: followTrack ? "#22D3EE" : "#5A7A94",
                }}
              >
                {followTrack ? "ENABLED" : "DISABLED"}
              </button>
            </div>
          )}
        </div>
      )}
    </OperationsPanel>
  );
}

// ── Combined Panel Stack ───────────────────────────────────────────────────────
export function LayerPanel(props: LayerPanelProps) {
  return (
    <div
      className="custom-scrollbar"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxHeight: "calc(100vh - 72px)",
        overflowY: "auto",
        paddingBottom: 16,
        paddingRight: 2,
      }}
    >
      <LayerControlsCard
        visibility={props.visibility}
        onToggle={props.onToggle}
        sarOpacity={props.sarOpacity ?? 0.55}
        onChangeSarOpacity={props.onChangeSarOpacity}
      />

      {props.visibility["ais-tracks"] && (
        <TrackSelectionCard
          vessels={props.vessels ?? []}
          selectedTrackId={props.selectedTrackId ?? "all"}
          onSelectTrackId={props.onSelectTrackId}
          selectedTrackColorId={props.selectedTrackColorId ?? "cyan"}
          onSelectTrackColorId={props.onSelectTrackColorId}
          followTrack={props.followTrack ?? false}
          onToggleFollowTrack={props.onToggleFollowTrack}
        />
      )}

      <MapLegend visibility={props.visibility} />
    </div>
  );
}

export default LayerPanel;
