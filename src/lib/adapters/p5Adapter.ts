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
  timeWindowStart: "2026-05-14T18:00:00Z",
  timeWindowEnd: "2026-05-15T06:00:00Z",
  totalVesselsMonitored: 6,
  candidatesIdentified: 5,
  darkVesselsDetected: 4,
  generatedAt: "2026-05-15T06:30:00Z",
  vessels: [
    {
      // IND_TANKER_412 — MMSI 419000101 — primary suspect
      vesselId: AIS_TRACKS[0]?.vesselId || "mmsi-419000101",
      vesselName: AIS_TRACKS[0]?.vesselName || "IND_TANKER_412",
      mmsi: "419000101",
      flag: "India",
      vesselType: "Crude Oil Tanker",
      lengthMeters: 245,
      beamMeters: 42,
      draughtMeters: 14.5,
      destination: "NHAVA SHEVA PORT",
      isCandidate: true,
      isDarkVessel: false,
      path: AIS_TRACKS[0]?.path || [
        [70.8, 20.1],
        [71.2, 19.65],
        [71.55, 19.4],
        [71.75, 19.25],
        [71.9, 19.1],
      ],
      pings: [
        { timestamp: "2026-05-14T18:00:00Z", relativeHour: -12, position: [70.8, 20.1], sogKnots: 14.2, cogDegrees: 135, headingDegrees: 135, navStatus: "Underway" },
        { timestamp: "2026-05-14T21:00:00Z", relativeHour: -9, position: [71.2, 19.65], sogKnots: 4.1, cogDegrees: 135, headingDegrees: 135, navStatus: "Underway" },
        { timestamp: "2026-05-15T00:00:00Z", relativeHour: -6, position: [71.55, 19.4], sogKnots: 13.8, cogDegrees: 135, headingDegrees: 135, navStatus: "Underway" },
        { timestamp: "2026-05-15T03:00:00Z", relativeHour: -3, position: [71.75, 19.25], sogKnots: 14.0, cogDegrees: 135, headingDegrees: 135, navStatus: "Underway" },
        { timestamp: "2026-05-15T06:00:00Z", relativeHour: 0, position: [71.9, 19.1], sogKnots: 13.9, cogDegrees: 135, headingDegrees: 135, navStatus: "Underway" },
      ],
    },
    {
      // Dark vessel 1 — SAR-only detection — no AIS record
      vesselId: "dark-vessel-cfar-002",
      vesselName: "DARK VESSEL-01 (CFAR_DARK_002)",
      mmsi: "N/A (RADAR CONTACT ONLY)",
      flag: "Unknown",
      vesselType: "Crude Tanker (SAR Target)",
      lengthMeters: 175,
      beamMeters: 28,
      draughtMeters: 9.8,
      destination: "Unreported Transit",
      isCandidate: true,
      isDarkVessel: true,
      darkAnomaly: {
        gapStartTimestamp: "2026-05-14T16:00:00Z",
        gapEndTimestamp: "2026-05-15T06:00:00Z",
        gapDurationHours: 14.0,
        lastKnownPosition: [71.9, 19.28],
        reappearancePosition: [71.9, 19.28],
        estimatedTransitSpeedKnots: 0,
        spillCorridorIntersection: true,
        radarContactCorrelated: true,
        notes: "Rendezvous behavior with another dark contact & 14h continuous AIS blackout correlated with Sentinel-1A SAR detection at plume origin.",
      },
      path: [
        [71.55, 19.55],
        [71.72, 19.42],
        [71.84, 19.33],
        [71.9, 19.28],
      ],
      pings: [
        { timestamp: "2026-05-14T16:00:00Z", relativeHour: -14, position: [71.9, 19.28], sogKnots: 0, cogDegrees: 142, headingDegrees: 142, navStatus: "AIS Blackout" },
      ],
    },
    {
      // Dark vessel 2 — Northern Sector route deviation
      vesselId: "dark-vessel-north-003",
      vesselName: "DARK VESSEL-02 (NORTH SECTOR)",
      mmsi: "N/A (RADAR CONTACT ONLY)",
      flag: "Panama (Suspected)",
      vesselType: "Chemical / Products Tanker",
      lengthMeters: 160,
      beamMeters: 26,
      draughtMeters: 8.5,
      destination: "HAZIRA OFFSHORE",
      isCandidate: true,
      isDarkVessel: true,
      darkAnomaly: {
        gapStartTimestamp: "2026-05-15T02:00:00Z",
        gapEndTimestamp: "2026-05-15T06:00:00Z",
        gapDurationHours: 4.0,
        lastKnownPosition: [71.30, 20.35],
        reappearancePosition: [71.45, 19.95],
        estimatedTransitSpeedKnots: 5.4,
        spillCorridorIntersection: true,
        radarContactCorrelated: true,
        notes: "Route deviation from historical corridor with 4h transponder shutdown along northern feeder lane.",
      },
      path: [
        [71.30, 20.35],
        [71.38, 20.15],
        [71.42, 20.02],
        [71.45, 19.95],
      ],
      pings: [
        { timestamp: "2026-05-15T02:00:00Z", relativeHour: -4, position: [71.45, 19.95], sogKnots: 5.4, cogDegrees: 198, headingDegrees: 198, navStatus: "Intermittent AIS" },
      ],
    },
    {
      // Dark vessel 3 — Southern TSS separation corridor
      vesselId: "dark-vessel-south-004",
      vesselName: "DARK VESSEL-03 (SOUTH TSS)",
      mmsi: "N/A (RADAR CONTACT ONLY)",
      flag: "Liberia (Suspected)",
      vesselType: "Heavy Bulk Carrier",
      lengthMeters: 225,
      beamMeters: 36,
      draughtMeters: 12.0,
      destination: "MUMBAI OUTER ANCHORAGE",
      isCandidate: true,
      isDarkVessel: true,
      darkAnomaly: {
        gapStartTimestamp: "2026-05-14T21:00:00Z",
        gapEndTimestamp: "2026-05-15T06:00:00Z",
        gapDurationHours: 9.0,
        lastKnownPosition: [72.70, 18.45],
        reappearancePosition: [72.25, 18.65],
        estimatedTransitSpeedKnots: 6.8,
        spillCorridorIntersection: false,
        radarContactCorrelated: true,
        notes: "Loitering pattern detected near shipping lane with nighttime 90° heading shift and 9h AIS blackout traversing outer TSS.",
      },
      path: [
        [72.70, 18.45],
        [72.52, 18.52],
        [72.38, 18.59],
        [72.25, 18.65],
      ],
      pings: [
        { timestamp: "2026-05-14T21:00:00Z", relativeHour: -9, position: [72.25, 18.65], sogKnots: 6.8, cogDegrees: 285, headingDegrees: 285, navStatus: "Abrupt Deviation" },
      ],
    },
    {
      // Dark vessel 4 — Western offshore boundary
      vesselId: "dark-vessel-west-005",
      vesselName: "DARK VESSEL-04 (WEST OFFSHORE)",
      mmsi: "N/A (RADAR CONTACT ONLY)",
      flag: "Unknown",
      vesselType: "Product Tanker",
      lengthMeters: 180,
      beamMeters: 30,
      draughtMeters: 9.2,
      destination: "UNREPORTED",
      isCandidate: true,
      isDarkVessel: true,
      darkAnomaly: {
        gapStartTimestamp: "2026-05-14T08:00:00Z",
        gapEndTimestamp: "2026-05-15T06:00:00Z",
        gapDurationHours: 22.0,
        lastKnownPosition: [70.70, 19.85],
        reappearancePosition: [70.95, 19.55],
        estimatedTransitSpeedKnots: 4.2,
        spillCorridorIntersection: true,
        radarContactCorrelated: true,
        notes: "AIS gap exceeds 6h threshold (22h total blackout) coinciding with backtracked drift corridor origin.",
      },
      path: [
        [70.70, 19.85],
        [70.82, 19.72],
        [70.90, 19.62],
        [70.95, 19.55],
      ],
      pings: [
        { timestamp: "2026-05-14T08:00:00Z", relativeHour: -22, position: [70.95, 19.55], sogKnots: 4.2, cogDegrees: 155, headingDegrees: 155, navStatus: "AIS Blackout" },
      ],
    },
    {
      // CONTAINER_EXPRESS — MMSI 419000202 — cleared (total_score: 0.184 from case_file_output.json)
      vesselId: AIS_TRACKS[1]?.vesselId || "mmsi-419000202",
      vesselName: AIS_TRACKS[1]?.vesselName || "CONTAINER_EXPRESS",
      mmsi: "419000202",
      flag: "Panama",
      vesselType: "Container Ship",
      lengthMeters: 300,
      beamMeters: 45,
      draughtMeters: 13.2,
      destination: "MUNDRA PORT",
      isCandidate: false,
      isDarkVessel: false,
      path: AIS_TRACKS[1]?.path || [
        [70.6, 18.3],
        [71.3, 18.33],
        [71.9, 18.36],
        [72.4, 18.38],
        [72.8, 18.4],
      ],
      pings: [
        { timestamp: "2026-05-14T18:00:00Z", relativeHour: -12, position: [70.6, 18.3], sogKnots: 18.5, cogDegrees: 85, headingDegrees: 85, navStatus: "Underway" },
        { timestamp: "2026-05-14T21:00:00Z", relativeHour: -9, position: [71.3, 18.33], sogKnots: 18.8, cogDegrees: 85, headingDegrees: 85, navStatus: "Underway" },
        { timestamp: "2026-05-15T00:00:00Z", relativeHour: -6, position: [71.9, 18.36], sogKnots: 18.6, cogDegrees: 85, headingDegrees: 85, navStatus: "Underway" },
        { timestamp: "2026-05-15T03:00:00Z", relativeHour: -3, position: [72.4, 18.38], sogKnots: 18.4, cogDegrees: 85, headingDegrees: 85, navStatus: "Underway" },
        { timestamp: "2026-05-15T06:00:00Z", relativeHour: 0, position: [72.8, 18.4], sogKnots: 18.7, cogDegrees: 85, headingDegrees: 85, navStatus: "Underway" },
      ],
    },
  ],
};

export const EMPTY_P5_DATA: P5Output = {
  timeWindowStart: "2026-05-14T06:00:00Z",
  timeWindowEnd: "2026-05-15T06:00:00Z",
  totalVesselsMonitored: 0,
  candidatesIdentified: 0,
  darkVesselsDetected: 0,
  generatedAt: "2026-05-15T06:30:00Z",
  vessels: [],
};

export function convertAisResponseToP5(data: any): P5Output {
  if (!data || !Array.isArray(data.vessels) || data.vessels.length === 0) {
    return DEFAULT_P5_DATA;
  }

  const baseT0 = new Date("2026-05-15T06:00:00Z").getTime();
  let candidateCount = 0;
  let darkCount = 0;

  const vessels: VesselTrack[] = data.vessels.map((v: any) => {
    if (v.isCandidate) candidateCount++;
    if (v.isDarkVessel) darkCount++;

    const pings: VesselPing[] = (v.pings || []).map((p: any) => {
      const pingTime = new Date(p.timestamp).getTime();
      const relHour = Math.round((pingTime - baseT0) / 3600000);
      return {
        timestamp: p.timestamp,
        relativeHour: isNaN(relHour) ? 0 : relHour,
        position: p.position as [number, number],
        sogKnots: p.sog ?? 0,
        cogDegrees: p.cog ?? 0,
        headingDegrees: p.cog ?? 0,
        navStatus: v.isDarkVessel ? "Unknown" : "Underway",
      };
    });

    return {
      vesselId: v.vesselId,
      vesselName: v.vesselName,
      mmsi: v.mmsi || "",
      flag: v.flag || "Unknown",
      vesselType: v.vesselType || "Cargo",
      lengthMeters: v.isDarkVessel ? 0 : (v.isCandidate ? 245 : 300),
      beamMeters: v.isDarkVessel ? 0 : (v.isCandidate ? 42 : 45),
      draughtMeters: v.isDarkVessel ? 0 : 14.5,
      destination: v.isDarkVessel ? "Unknown" : (v.isCandidate ? "NHAVA SHEVA PORT" : "MUNDRA PORT"),
      isCandidate: !!v.isCandidate,
      isDarkVessel: !!v.isDarkVessel,
      path: v.path || (pings.map((p) => p.position)),
      pings,
    };
  });

  return {
    timeWindowStart: "2026-05-14T06:00:00Z",
    timeWindowEnd: "2026-05-15T06:00:00Z",
    totalVesselsMonitored: vessels.length,
    candidatesIdentified: candidateCount,
    darkVesselsDetected: darkCount,
    generatedAt: "2026-05-15T06:30:00Z",
    vessels,
  };
}

export function getVesselPositionsAtHour(p5: P5Output, relativeHour: number): ActiveVesselPosition[] {
  const vessels = p5?.vessels || DEFAULT_P5_DATA.vessels;
  if (!vessels || vessels.length === 0) return [];

  return vessels.map((vessel) => {
    if (vessel.pings && vessel.pings.length > 0) {
      const sorted = [...vessel.pings].sort((a, b) => a.relativeHour - b.relativeHour);

      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;

      if (relativeHour <= first.relativeHour) {
        return {
          vessel,
          currentPosition: first.position,
          heading: first.headingDegrees || first.cogDegrees || 0,
          speedKnots: first.sogKnots || 0,
          isInterpolated: relativeHour !== first.relativeHour,
        };
      }

      if (relativeHour >= last.relativeHour) {
        return {
          vessel,
          currentPosition: last.position,
          heading: last.headingDegrees || last.cogDegrees || 0,
          speedKnots: last.sogKnots || 0,
          isInterpolated: relativeHour !== last.relativeHour,
        };
      }

      let p1 = first;
      let p2 = last;
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i]!;
        const b = sorted[i + 1]!;
        if (a.relativeHour <= relativeHour && b.relativeHour >= relativeHour) {
          p1 = a;
          p2 = b;
          break;
        }
      }

      const timeSpan = p2.relativeHour - p1.relativeHour;
      const t = timeSpan > 0 ? (relativeHour - p1.relativeHour) / timeSpan : 0;

      const lng = p1.position[0] + t * (p2.position[0] - p1.position[0]);
      const lat = p1.position[1] + t * (p2.position[1] - p1.position[1]);
      const speed = p1.sogKnots + t * (p2.sogKnots - p1.sogKnots);
      
      const h1 = p1.headingDegrees || p1.cogDegrees || 0;
      const h2 = p2.headingDegrees || p2.cogDegrees || h1;
      let diff = (h2 - h1) % 360;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      let interpHeading = (h1 + diff * t) % 360;
      if (interpHeading < 0) interpHeading += 360;

      return {
        vessel,
        currentPosition: [lng, lat],
        heading: Number(interpHeading.toFixed(1)),
        speedKnots: Number(speed.toFixed(1)),
        isInterpolated: t > 0 && t < 1,
      };
    }

    const path = vessel.path || [];
    if (path.length === 0) {
      return {
        vessel,
        currentPosition: [71.85, 19.35],
        heading: 90,
        speedKnots: 12.0,
        isInterpolated: true,
      };
    }

    const norm = Math.max(0, Math.min(1, (relativeHour + 24) / 24));
    const exactIndex = norm * (path.length - 1);
    const i1 = Math.floor(exactIndex);
    const i2 = Math.min(path.length - 1, Math.ceil(exactIndex));
    const t = exactIndex - i1;

    const pt1 = path[i1] ?? path[0] ?? [71.85, 19.35];
    const pt2 = path[i2] ?? pt1;
    const interpPos: [number, number] = [
      pt1[0] + t * (pt2[0] - pt1[0]),
      pt1[1] + t * (pt2[1] - pt1[1]),
    ];

    return {
      vessel,
      currentPosition: interpPos,
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
