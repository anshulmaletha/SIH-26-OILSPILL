import { useState } from "react";
import { LAYER_META, type LayerId } from "@/lib/map/config";
import { Panel, PanelHeader, T } from "@/components/ui/PanelKit";

interface MapLegendProps {
  visibility: Record<LayerId, boolean>;
}

export function MapLegend({ visibility }: MapLegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const visible = LAYER_META.filter((m) => visibility[m.id]);
  if (visible.length === 0) return null;

  return (
    <Panel style={{ width: 260 }}>
      <PanelHeader
        label={`Legend (${visible.length})`}
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
          {/* Swatches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {visible.map((meta) => {
              const metaColor = meta.color === '#22D3EE' ? T.sky : meta.color;
              return (
                <div key={meta.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, background: metaColor }} />
                    <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.brightText }}>
                      {meta.label}
                    </span>
                  </div>
                  <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.dimText, textTransform: "uppercase" }}>
                    {meta.id === "sar-raster" ? "SAR" : meta.id === "slick-polygon" ? "POLY" : meta.id === "h3-corridor" ? "H3" : "AIS"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* H3 Corridor Gradient (replaces the discrete swatches) */}
          {visibility["h3-corridor"] && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10, marginBottom: 12 }}>
              <div style={{ fontFamily: T.fontSans, fontSize: 10, color: T.midText, marginBottom: 6 }}>
                Trajectory Intersection Density
              </div>
              <div style={{ height: 6, background: `linear-gradient(to right, ${T.sky}22, ${T.sky})`, borderRadius: 1, marginBottom: 4 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.fontMono, fontSize: 9, color: T.dimText }}>
                <span>Low Probability</span>
                <span style={{ color: T.sky }}>Peak Convergence</span>
              </div>
            </div>
          )}

          {/* Special states */}
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, background: T.red, borderRadius: '50%' }} />
                <span style={{ fontFamily: T.fontSans, fontSize: 11, color: T.brightText }}>
                  Dark Vessel Anomaly
                </span>
              </div>
              <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.red }}>CFAR</span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export default MapLegend;
