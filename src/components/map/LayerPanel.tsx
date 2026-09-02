import { useState } from "react";
import {
  Layers,
  ChevronUp,
  ChevronDown,
  Radar,
  Flame,
  Hexagon,
  Ship,
  Sliders,
  Compass,
  Palette,
  Crosshair,
} from "lucide-react";
import { LAYER_META, type LayerId, TRACK_COLOR_OPTIONS } from "@/lib/map/config";
import type { VesselTrack } from "@/lib/contracts/p5";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const LAYER_ICONS: Record<LayerId, typeof Layers> = {
  "sar-raster": Radar,
  "slick-polygon": Flame,
  "h3-corridor": Hexagon,
  "ais-tracks": Ship,
};

export interface LayerPanelProps {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  sarOpacity?: number;
  onChangeSarOpacity?: (opacity: number) => void;
  vessels?: VesselTrack[];
  selectedTrackId?: string;
  onSelectTrackId?: (id: string) => void;
  selectedTrackColorId?: string;
  onSelectTrackColorId?: (colorId: string) => void;
  followTrack?: boolean;
  onToggleFollowTrack?: (enabled: boolean) => void;
}

/**
 * 1. Independent Collapsible Layer Controls Card
 */
export function LayerControlsCard({
  visibility,
  onToggle,
  sarOpacity = 0.55,
  onChangeSarOpacity,
}: {
  visibility: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  sarOpacity?: number;
  onChangeSarOpacity?: (opacity: number) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="w-72 sm:w-80 rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden flex flex-col text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-3.5 py-2.5 bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary border border-primary/30">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Layer Controls
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Geospatial Overlays (P1 • P4 • P5)
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          title={isCollapsed ? "Expand Layer Controls" : "Collapse Layer Controls"}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="p-3 space-y-2.5 animate-in fade-in duration-200">
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
                    className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-200 cursor-pointer ${
                      active
                        ? "border-border bg-accent/60 hover:bg-accent"
                        : "border-transparent bg-transparent opacity-60 hover:opacity-90 hover:bg-muted/40"
                    }`}
                  >
                    {/* Layer Icon Swatch */}
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
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {meta.label}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>

                    {/* Toggle Switch */}
                    <span
                      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200 ${
                        active ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-primary-foreground transition-transform duration-200 ${
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
            <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 text-foreground font-semibold text-[11px]">
                  <Sliders className="h-3 w-3 text-primary" />
                  <span>SAR Raster Opacity</span>
                </div>
                <span className="font-mono text-xs font-bold text-primary">
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

/**
 * 2. Independent Collapsible Track Selection Card
 */
export function TrackSelectionCard({
  vessels = [],
  selectedTrackId = "all",
  onSelectTrackId,
  selectedTrackColorId = "green",
  onSelectTrackColorId,
  followTrack = false,
  onToggleFollowTrack,
}: {
  vessels?: VesselTrack[];
  selectedTrackId?: string;
  onSelectTrackId?: (id: string) => void;
  selectedTrackColorId?: string;
  onSelectTrackColorId?: (colorId: string) => void;
  followTrack?: boolean;
  onToggleFollowTrack?: (enabled: boolean) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="w-72 sm:w-80 rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden flex flex-col text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 px-3.5 py-2.5 bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
            <Compass className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Track Selection
            </h2>
            <p className="text-[10px] text-muted-foreground">
              AIS Trajectory & Follow Controls
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          title={isCollapsed ? "Expand Track Selection" : "Collapse Track Selection"}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="p-3 space-y-3 animate-in fade-in duration-200">
          {/* Path / Vessel Dropdown Selector */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Active Path / Vessel
            </label>
            <select
              value={selectedTrackId}
              onChange={(e) => onSelectTrackId?.(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">○ All Monitored Tracks ({vessels.length})</option>
              {vessels.map((v) => (
                <option key={v.vesselId} value={v.vesselId}>
                  {v.vesselName} ({v.vesselType})
                </option>
              ))}
            </select>
          </div>

          {/* Color Customizer */}
          {onSelectTrackColorId && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Palette className="h-3 w-3 text-primary" />
                  <span>Path Color</span>
                </label>
                <span className="text-[10px] font-mono text-foreground font-semibold uppercase">
                  {TRACK_COLOR_OPTIONS.find((c) => c.id === selectedTrackColorId)?.name ?? "Green"}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {TRACK_COLOR_OPTIONS.map((c) => {
                  const isSelected = selectedTrackColorId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectTrackColorId(c.id)}
                      className={`h-6 rounded-md transition-all flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? "ring-2 ring-primary ring-offset-1 scale-110 shadow-sm"
                          : "opacity-75 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    >
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white shadow-xs" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Follow Path Toggle */}
          {onToggleFollowTrack && (
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <Crosshair className={`h-3.5 w-3.5 ${followTrack ? "text-primary animate-spin" : "text-muted-foreground"}`} />
                <div>
                  <span className="text-xs font-semibold text-foreground block leading-tight">
                    Follow Selected Track
                  </span>
                  <span className="text-[9px] text-muted-foreground block">
                    Auto-center camera on vessel position
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleFollowTrack(!followTrack)}
                className={`relative h-4 w-8 shrink-0 rounded-full transition-colors duration-200 cursor-pointer ${
                  followTrack ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-primary-foreground transition-transform duration-200 ${
                    followTrack ? "translate-x-4 left-0.5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Combined Left Control Stack with both independent collapsible cards
 */
export function LayerPanel(props: LayerPanelProps) {
  return (
    <div className="flex flex-col gap-2.5 max-h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar pr-1">
      <LayerControlsCard
        visibility={props.visibility}
        onToggle={props.onToggle}
        sarOpacity={props.sarOpacity}
        onChangeSarOpacity={props.onChangeSarOpacity}
      />

      {props.visibility["ais-tracks"] && (
        <TrackSelectionCard
          vessels={props.vessels}
          selectedTrackId={props.selectedTrackId}
          onSelectTrackId={props.onSelectTrackId}
          selectedTrackColorId={props.selectedTrackColorId}
          onSelectTrackColorId={props.onSelectTrackColorId}
          followTrack={props.followTrack}
          onToggleFollowTrack={props.onToggleFollowTrack}
        />
      )}
    </div>
  );
}
