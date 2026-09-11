import React, { useState } from "react";
import { LAYER_META, type LayerId, TRACK_COLOR_OPTIONS } from "@/lib/map/config";
import type { VesselTrack } from "@/lib/contracts/p5";
import { MapLegend } from "./MapLegend";
import { Panel, PanelHeader, T } from "@/components/ui/PanelKit";

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
    <Panel style={{ width: 260, marginBottom: 12 }}>
      <PanelHeader
        label="Map Layers"
        color={T.dimText}
        compact
        right={
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ background: 'none', border: 'none', color: T.dimText, cursor: 'pointer', fontSize: 10 }}
          >
            {isCollapsed ? "▼" : "▲"}
          </button>
        }
      />
      
      {!isCollapsed && (
        <div style={{ padding: "10px 14px", animation: "fadeIn 0.2s ease" }}>
          {LAYER_META.map((meta) => {
            const active = visibility[meta.id];
            const metaColor = meta.color === '#22D3EE' ? T.sky : meta.color;
            
            return (
              <div key={meta.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: metaColor, flexShrink: 0 }} />
                  <span style={{ fontFamily: T.fontSans, fontSize: 12, color: active ? T.brightText : T.dimText, transition: "color 0.2s" }}>
                    {meta.label}
                  </span>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: T.fontMono, fontSize: 9, color: active ? T.sky : T.dimText, textTransform: "uppercase" }}>
                    {LAYER_TYPE_LABELS[meta.id]}
                  </span>
                  
                  <label className="toggle-switch">
                    <input type="checkbox" checked={active} onChange={() => onToggle(meta.id)} />
                    <span className="toggle-track" />
                  </label>
                </div>
              </div>
            );
          })}
          
          {visibility["sar-raster"] && onChangeSarOpacity && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.midText }}>SAR Opacity</span>
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.sky }}>
                  {Math.round(sarOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                className="scrubber"
                min={0} max={1} step={0.05}
                value={sarOpacity}
                onChange={(e) => onChangeSarOpacity(parseFloat(e.target.value))}
                style={{ "--range-fill": `${sarOpacity * 100}%` } as any}
              />
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export function VesselSelectionCard({
  vessels = [],
  selectedTrackId,
  onSelectTrackId,
  selectedTrackColorId,
  onSelectTrackColorId,
  followTrack,
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
  if (!vessels.length) return null;

  return (
    <Panel style={{ width: 260, marginBottom: 12 }}>
      <PanelHeader
        label="Simulated Traffic"
        color={T.dimText}
        compact
        right={
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ background: 'none', border: 'none', color: T.dimText, cursor: 'pointer', fontSize: 10 }}
          >
            {isCollapsed ? "▼" : "▲"}
          </button>
        }
      />

      {!isCollapsed && (
        <div style={{ padding: "10px 14px", animation: "fadeIn 0.2s ease" }}>
          <select
            value={selectedTrackId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (onSelectTrackId) onSelectTrackId(val === "" ? "" : val);
            }}
            style={{
              width: "100%",
              background: T.bgElevated,
              border: `1px solid ${T.border}`,
              color: T.brightText,
              padding: "6px 8px",
              fontFamily: T.fontSans,
              fontSize: 11,
              borderRadius: 2,
              outline: "none",
              marginBottom: 10,
              cursor: "pointer",
            }}
          >
            <option value="">-- ALL TARGETS --</option>
            {vessels.map(v => (
              <option key={v.id} value={v.id}>{v.name} ({v.typeLabel})</option>
            ))}
          </select>

          {selectedTrackId && onSelectTrackColorId && TRACK_COLOR_OPTIONS && (
            <div style={{ marginBottom: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TRACK_COLOR_OPTIONS.map((tc) => (
                <button
                  key={tc.id}
                  onClick={() => onSelectTrackColorId(tc.id)}
                  style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: tc.color, border: "none", cursor: "pointer",
                    boxShadow: selectedTrackColorId === tc.id ? `0 0 0 2px ${T.bgPanel}, 0 0 0 3px ${T.sky}` : "none",
                  }}
                  title={tc.label}
                />
              ))}
            </div>
          )}

          {selectedTrackId && onToggleFollowTrack && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.midText }}>Lock Camera</span>
              <label className="toggle-switch emerald">
                <input type="checkbox" checked={followTrack ?? false} onChange={(e) => onToggleFollowTrack(e.target.checked)} />
                <span className="toggle-track" />
              </label>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export function LayerPanel({
  visibility,
  onToggle,
  sarOpacity,
  onChangeSarOpacity,
  vessels,
  selectedTrackId,
  onSelectTrackId,
  selectedTrackColorId,
  onSelectTrackColorId,
  followTrack,
  onToggleFollowTrack,
}: LayerPanelProps) {
  return (
    <div style={{ position: "absolute", top: 80, left: 12, zIndex: 10, display: "flex", flexDirection: "column" }}>
      <LayerControlsCard
        visibility={visibility}
        onToggle={onToggle}
        sarOpacity={sarOpacity}
        onChangeSarOpacity={onChangeSarOpacity}
      />
      <VesselSelectionCard
        vessels={vessels}
        selectedTrackId={selectedTrackId}
        onSelectTrackId={onSelectTrackId}
        selectedTrackColorId={selectedTrackColorId}
        onSelectTrackColorId={onSelectTrackColorId}
        followTrack={followTrack}
        onToggleFollowTrack={onToggleFollowTrack}
      />
      <MapLegend />
    </div>
  );
}

export default LayerPanel;
