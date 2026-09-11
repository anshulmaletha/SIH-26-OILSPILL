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
  { hour: 0,  lat: 19.350, lng: 71.853, areaKm2: 4.82, label: "T+0h  · Initial Detection (19.35°N, 71.85°E)" },
  { hour: 6,  lat: 19.340, lng: 71.881, areaKm2: 5.4,  label: "T+6h  · OpenDrift Forward (19.34°N, 71.88°E)" },
  { hour: 12, lat: 19.336, lng: 71.917, areaKm2: 6.8,  label: "T+12h · Advection Plume (19.34°N, 71.92°E)" },
  { hour: 18, lat: 19.323, lng: 71.949, areaKm2: 8.5,  label: "T+18h · Dispersion Plume (19.32°N, 71.95°E)" },
  { hour: 24, lat: 19.324, lng: 71.950, areaKm2: 10.2, label: "T+24h · Coastal Approach (19.32°N, 71.95°E)" },
];

const OPERATIONAL_SECTORS = [
  { id: "A", name: "Offshore Advection Axis (71.85°–71.95°E)", status: "ACTIVE PLUME", color: "#10B981" },
  { id: "B", name: "Outer Anchorage Buffer (~45 km offshore)", status: "INTERCEPT LINE", color: "#F59E0B" },
  { id: "C", name: "Mumbai Coastal Approach Corridor", status: "MONITORING", color: "#5A7A94" },
];

const RECOVERY_ZONES = [
  { id: "Z1", name: "Primary Plume Centroid", lat: "19.34°N", lng: "71.88°E", rate: "OpenDrift Particle Core" },
  { id: "Z2", name: "Downwind Dispersion Zone", lat: "19.33°N", lng: "71.92°E", rate: "ERA5 Wind Drift Axis" },
  { id: "Z3", name: "Coastal Defense Perimeter", lat: "19.32°N", lng: "71.95°E", rate: "T+24h Intercept Line" },
];

export function ContainmentRoom() {
  const { state, dispatch } = useMission();

  if (state.currentStage !== "CONTAINMENT_ROOM") return null;

  const elapsed = state.stageElapsedMs;

  // Forward clock progress: T+0 to T+24 shown over 20s
  const forwardHours = Math.min(24, Math.round((elapsed / 20000) * 24));
  const currentDrift = DRIFT_PROJECTIONS.reduce((prev, curr) =>
    Math.abs(curr.hour - forwardHours) < Math.abs(prev.hour - forwardHours) ? curr : prev
  );

  // Response readiness indicator
  const responseProgress = Math.min(100, Math.round(elapsed / 200));

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
          width: 350,
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
                ■ SPILL RESPONSE SIMULATION
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: "#2D6A5A",
                  marginTop: 2,
                }}
              >
                OpenDrift Forward Advection (ERA5 Atmospheric Forcing)
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

          {/* Advection & response metrics */}
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
              ADVECTION & BUFFER DYNAMICS
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#10B981",
                }}
              >
                ~0.45 km/h
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2D6A5A" }}>
                Eastward drift velocity (ERA5 3.8 m/s wind)
              </span>
            </div>
            <div style={{ height: 4, background: "#1C3830", marginTop: 6, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  background: "#10B981",
                  width: `${responseProgress}%`,
                  transition: "width 0.3s linear",
                }}
              />
            </div>
          </section>

          {/* Operational sectors */}
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
              OPERATIONAL RESPONSE SECTORS
            </div>
            {OPERATIONAL_SECTORS.map((sector) => (
              <div
                key={sector.id}
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
                    Sector {sector.id}:
                  </span>
                  <span
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 10,
                      color: "#C8D8E8",
                      marginLeft: 6,
                    }}
                  >
                    {sector.name}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    color: sector.color,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {sector.status}
                </span>
              </div>
            ))}
          </section>

          {/* Intercept zones */}
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
              PHYSICAL INTERCEPT &amp; MONITORING ZONES
            </div>
            {RECOVERY_ZONES.map((z) => (
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

          {/* Coastal proximity advisory */}
          {forwardHours >= 18 && (
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
                ℹ COASTAL PROXIMITY ADVISORY
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: "#8A6A2A",
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                At T+24h, advection centroid reaches [19.324°N, 71.950°E].
                <br />
                Estimated shore distance: ~45 km to Mumbai coastline.
                <br />
                Clear window for maritime containment operations.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
