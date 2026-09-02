import type { P5Output, VesselTrack, VesselPing } from "../contracts/p5";
import { AIS_TRACKS } from "../map/data/sampleData";

export interface ActiveVesselPosition {
  vessel: VesselTrack;
  currentPosition: [longitude: number, latitude: number];
  heading: number;
  speedKnots: number;
  isInterpolated: boolean;
}

/** Fallback dataset for P5 AIS vessel tracks and pings */
export const DEFAULT_P5_DATA: P5Output = {
  timeWindowStart: "2026-09-01T06:00:00Z",
  timeWindowEnd: "2026-09-02T06:00:00Z",
  totalVesselsMonitored: 3,
  candidatesIdentified: 2,
  darkVesselsDetected: 0,
  generatedAt: "2026-09-02T06:30:00Z",
  vessels: [
    {
      vesselId: AIS_TRACKS[0]?.vesselId || "mmsi-5630001",
      vesselName: AIS_TRACKS[0]?.vesselName || "MV Meridian Star",
      mmsi: "5630001",
      flag: "Panama",
      vesselType: "Crude Oil Tanker",
      lengthMeters: 245,
      beamMeters: 42,
      draughtMeters: 14.5,
      destination: "SINGAPORE ANCHORAGE",
      isCandidate: true,
      isDarkVessel: false,
      path: AIS_TRACKS[0]?.path || [
        [103.68, 1.05],
        [103.74, 1.09],
        [103.82, 1.13],
        [103.9, 1.17],
        [103.98, 1.22],
      ],
      pings: [
        { timestamp: "2026-09-01T06:00:00Z", relativeHour: -24, position: [103.68, 1.05], sogKnots: 13.8, cogDegrees: 62, headingDegrees: 64, navStatus: "Underway" },
        { timestamp: "2026-09-01T12:00:00Z", relativeHour: -18, position: [103.74, 1.09], sogKnots: 11.2, cogDegrees: 65, headingDegrees: 66, navStatus: "Underway" },
        { timestamp: "2026-09-01T18:00:00Z", relativeHour: -12, position: [103.82, 1.13], sogKnots: 12.5, cogDegrees: 60, headingDegrees: 61, navStatus: "Underway" },
        { timestamp: "2026-09-02T00:00:00Z", relativeHour: -6, position: [103.90, 1.17], sogKnots: 10.4, cogDegrees: 58, headingDegrees: 59, navStatus: "Underway" },
        { timestamp: "2026-09-02T06:00:00Z", relativeHour: 0, position: [103.98, 1.22], sogKnots: 0.8, cogDegrees: 45, headingDegrees: 50, navStatus: "At anchor" },
      ],
    },
    {
      vesselId: AIS_TRACKS[1]?.vesselId || "mmsi-5630002",
      vesselName: AIS_TRACKS[1]?.vesselName || "ST Aurora",
      mmsi: "5630002",
      flag: "Singapore",
      vesselType: "Chemical Tanker",
      lengthMeters: 180,
      beamMeters: 28,
      draughtMeters: 9.2,
      destination: "PASIR GUDANG",
      isCandidate: true,
      isDarkVessel: false,
      path: AIS_TRACKS[1]?.path || [
        [103.97, 1.08],
        [103.9, 1.11],
        [103.84, 1.16],
        [103.76, 1.2],
        [103.7, 1.25],
      ],
      pings: [
        { timestamp: "2026-09-01T06:00:00Z", relativeHour: -24, position: [103.97, 1.08], sogKnots: 13.5, cogDegrees: 295, headingDegrees: 295, navStatus: "Underway" },
        { timestamp: "2026-09-01T12:00:00Z", relativeHour: -18, position: [103.90, 1.11], sogKnots: 13.2, cogDegrees: 295, headingDegrees: 295, navStatus: "Underway" },
        { timestamp: "2026-09-01T18:00:00Z", relativeHour: -12, position: [103.84, 1.16], sogKnots: 13.0, cogDegrees: 290, headingDegrees: 290, navStatus: "Underway" },
        { timestamp: "2026-09-02T00:00:00Z", relativeHour: -6, position: [103.76, 1.20], sogKnots: 12.8, cogDegrees: 290, headingDegrees: 290, navStatus: "Underway" },
        { timestamp: "2026-09-02T06:00:00Z", relativeHour: 0, position: [103.70, 1.25], sogKnots: 12.5, cogDegrees: 290, headingDegrees: 290, navStatus: "Underway" },
      ],
    },
    {
      vesselId: AIS_TRACKS[2]?.vesselId || "mmsi-5630003",
      vesselName: AIS_TRACKS[2]?.vesselName || "Pacific Kestrel",
      mmsi: "5630003",
      flag: "Liberia",
      vesselType: "Bulk Carrier",
      lengthMeters: 220,
      beamMeters: 32,
      draughtMeters: 11.8,
      destination: "SHANGHAI",
      isCandidate: false,
      isDarkVessel: false,
      path: AIS_TRACKS[2]?.path || [
        [103.8, 1.28],
        [103.82, 1.22],
        [103.83, 1.16],
        [103.85, 1.1],
      ],
      pings: [
        { timestamp: "2026-09-01T06:00:00Z", relativeHour: -24, position: [103.8, 1.28], sogKnots: 11.0, cogDegrees: 160, headingDegrees: 160, navStatus: "Underway" },
        { timestamp: "2026-09-01T12:00:00Z", relativeHour: -18, position: [103.82, 1.22], sogKnots: 11.2, cogDegrees: 160, headingDegrees: 160, navStatus: "Underway" },
        { timestamp: "2026-09-01T18:00:00Z", relativeHour: -12, position: [103.83, 1.16], sogKnots: 11.1, cogDegrees: 165, headingDegrees: 165, navStatus: "Underway" },
        { timestamp: "2026-09-02T00:00:00Z", relativeHour: -6, position: [103.85, 1.10], sogKnots: 11.4, cogDegrees: 165, headingDegrees: 165, navStatus: "Underway" },
        { timestamp: "2026-09-02T06:00:00Z", relativeHour: 0, position: [103.85, 1.10], sogKnots: 0.0, cogDegrees: 0, headingDegrees: 165, navStatus: "At anchor" },
      ],
    },
  ],
};

export function getVesselPositionsAtHour(p5: P5Output, relativeHour: number): ActiveVesselPosition[] {
  const vessels = p5?.vessels || DEFAULT_P5_DATA.vessels;
  if (!vessels || vessels.length === 0) return [];

  return vessels.map((vessel) => {
    if (vessel.pings && vessel.pings.length > 0) {
      let closest = vessel.pings[0];
      let minDiff = Math.abs(closest.relativeHour - relativeHour);

      for (const ping of vessel.pings) {
        const diff = Math.abs(ping.relativeHour - relativeHour);
        if (diff < minDiff) {
          minDiff = diff;
          closest = ping;
        }
      }

      return {
        vessel,
        currentPosition: closest.position,
        heading: closest.headingDegrees || closest.cogDegrees || 0,
        speedKnots: closest.sogKnots || 0,
        isInterpolated: minDiff > 0.5,
      };
    }

    const path = vessel.path || [];
    const index = Math.min(
      path.length - 1,
      Math.max(0, Math.floor(((relativeHour + 24) / 24) * (path.length - 1)))
    );
    const pos = path[index] || [0, 0];

    return {
      vessel,
      currentPosition: pos,
      heading: 90,
      speedKnots: 12.0,
      isInterpolated: true,
    };
  });
}

export function parseP5Payload(raw: unknown): P5Output {
  if (!raw || typeof raw !== "object") return DEFAULT_P5_DATA;
  const p5 = raw as Partial<P5Output>;
  if (!p5.vessels || !Array.isArray(p5.vessels)) return DEFAULT_P5_DATA;
  return p5 as P5Output;
}
