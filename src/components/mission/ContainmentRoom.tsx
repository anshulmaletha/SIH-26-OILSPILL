/**
 * Phase 6: CONTAINMENT_ROOM
 *
 * A side panel (right edge) that slides in over the map, keeping the map
 * fully visible with forward drift rendered on it.
 * Distinct cyan/emerald tactical color scheme for "response operations" mode.
 */

import { useMission } from "@/lib/mission/missionState";

interface DriftProjection {
  hour: number;
  lat: number;
  lng: number;
  areaKm2: number;
  label: string;
}

const DRIFT_PROJECTIONS: DriftProjection[] = [
  { hour: 0,  lat: 19.35, lng: 71.85, areaKm2: 14.2,  label: "T+0h  · Detected position" },
  { hour: 6,  lat: 19.18, lng: 72.05, areaKm2: 18.4,  label: "T+6h  · Active drift" },
  { hour: 12, lat: 19.05, lng: 72.22, areaKm2: 28.1,  label: "T+12h · Expanding plume" },
  { hour: 24, lat: 18.90, lng: 72.50, areaKm2: 44.8,  label: "T+24h · Coastal approach" },
  { hour: 48, lat: 18.75, lng: 72.75, areaKm2: 72.3,  label: "T+48h · Mangrove threat" },
];

const BOOM_SECTORS = [
  { id: "A", name: "Dharamtar Inlet", status: "RECOMMENDED", color: "#10B981" },
  { id: "B", name: "Alibag Coastal", status: "STANDBY", color: "#F59E0B" },
  { id: "C", name: "Elephanta Channel", status: "PLANNED", color: "#5A7A94" },
];

const SKIMMER_ZONES = [
  { id: "Z1", name: "Primary Recovery", lat: "19.10°N", lng: "72.20°E", rate: "180 t/day" },
  { id: "Z2", name: "Secondary Zone", lat: "18.95°N", lng: "72.40°E", rate: "120 t/day" },
  { id: "Z3", name: "Coastal Buffer", lat: "18.85°N", lng: "72.60°E", rate: "80 t/day" },
];

export function ContainmentRoom() {
  const { state, dispatch } = useMission();

  if (state.currentStage !== "CONTAINMENT_ROOM") return null;

  const elapsed = state.stageElapsedMs;

  // Forward clock progress: T+0 to T+48 shown over 30s interaction time
  const forwardHours = Math.min(48, Math.round((elapsed / 30000) * 48));
  const currentDrift = DRIFT_PROJECTIONS.reduce((prev, curr) =>
    Math.abs(curr.hour - forwardHours) < Math.abs(prev.hour - forwardHours) ? curr : prev
  );

  // Containment efficiency (improves as booms are "deployed")
  const containEff = Math.min(67, Math.round(elapsed / 450));

  return (
    <>
      {/* ── Side panel (right edge) ── */}
      <div
        style={{
          position: "absolute",
          top: 52,
          right: 0,
          bottom: 0,
          zIndex: 25,
          width: 340,
          background: "#080B0F",
          borderLeft: "1px solid #1C3830",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Panel header — distinct teal/emerald for "response mode" */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #1C3830",
            background: "#0A1A14",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#10B981",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                ■ RESPONSE OPERATIONS
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: "#2D6A5A",
                  marginTop: 2,
                }}
              >
                INCIDENT RESPONSE &amp; CONTAINMENT CENTRE
              </div>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "NEXT_STAGE" })}
              style={{
                background: "transparent",
                border: "1px solid #1C3830",
                color: "#5A7A94",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                padding: "4px 8px",
                cursor: "pointer",
              }}
              title="Proceed to Case File"
            >
              CASE FILE →
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
          className="custom-scrollbar"
        >
          {/* Forward drift clock */}
          <section>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#2D6A5A",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 6,
              }}
            >
              FORWARD DRIFT TIMELINE
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "#10B981",
                  letterSpacing: "-0.02em",
                }}
              >
                T+{forwardHours}h
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#2D6A5A" }}>
                {currentDrift.areaKm2} km²
              </span>
            </div>

            {/* Timeline bar */}
            <div style={{ height: 2, background: "#1C3830", marginBottom: 6, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  background: "#10B981",
                  width: `${(forwardHours / 48) * 100}%`,
                  transition: "width 0.5s linear",
                }}
              />
            </div>

            {/* Drift checkpoints */}
            {DRIFT_PROJECTIONS.map((p) => (
              <div
                key={p.hour}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 8px",
                  marginBottom: 2,
                  background: forwardHours >= p.hour ? "#10B98108" : "transparent",
                  border: `1px solid ${forwardHours >= p.hour ? "#10B98120" : "#1C3830"}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: forwardHours >= p.hour ? "#10B981" : "#2D6A5A",
                  }}
                >
                  {p.label}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: p.hour >= 48 ? "#F59E0B" : "#5A7A94",
                  }}
                >
                  {p.areaKm2} km²
                </span>
              </div>
            ))}
          </section>

          {/* Containment gauge */}
          <section>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#2D6A5A",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 6,
              }}
            >
              CONTAINMENT EFFICIENCY
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 28,
                  fontWeight: 700,
                  color: containEff > 50 ? "#10B981" : "#F59E0B",
                }}
              >
                {containEff}%
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2D6A5A" }}>
                at T+24h with boom deployment
              </span>
            </div>
            <div style={{ height: 4, background: "#1C3830", marginTop: 6, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  background: containEff > 50 ? "#10B981" : "#F59E0B",
                  width: `${containEff}%`,
                  transition: "width 0.3s linear",
                }}
              />
            </div>
          </section>

          {/* Boom barriers */}
          <section>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#2D6A5A",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 6,
              }}
            >
              BOOM BARRIER DEPLOYMENT
            </div>
            {BOOM_SECTORS.map((boom) => (
              <div
                key={boom.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 8px",
                  marginBottom: 4,
                  border: "1px solid #1C3830",
                  background: "#0A1A14",
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9,
                      color: "#5A7A94",
                    }}
                  >
                    Sector {boom.id}:
                  </span>
                  <span
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 10,
                      color: "#C8D8E8",
                      marginLeft: 6,
                    }}
                  >
                    {boom.name}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    color: boom.color,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {boom.status}
                </span>
              </div>
            ))}
          </section>

          {/* Skimmer zones */}
          <section>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: "#2D6A5A",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 6,
              }}
            >
              SKIMMER DEPLOYMENT ZONES
            </div>
            {SKIMMER_ZONES.map((z) => (
              <div
                key={z.id}
                style={{
                  padding: "6px 8px",
                  marginBottom: 4,
                  border: "1px solid #1C3830",
                  background: "#0A1A14",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "#C8D8E8" }}>
                    {z.name}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#10B981" }}>
                    {z.rate}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    color: "#2D6A5A",
                  }}
                >
                  {z.lat}  {z.lng}
                </div>
              </div>
            ))}
          </section>

          {/* Coastal impact warning */}
          {forwardHours >= 24 && (
            <div
              style={{
                padding: "8px 10px",
                border: "1px solid #F59E0B30",
                background: "#F59E0B08",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  color: "#F59E0B",
                  fontWeight: 700,
                }}
              >
                ⚠ COASTAL IMPACT WARNING
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: "#8A6A2A",
                  marginTop: 4,
                }}
              >
                Mangrove ecosystem threatened at T+31h.
                <br />
                Priority: Dharamtar inlet boom deployment.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
