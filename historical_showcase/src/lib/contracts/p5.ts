/**
 * P5 Contract: AIS Telemetry, Dark Vessel Detection & Case Export
 * Owner: P5 (AIS / Dark Vessel / Case File Export)
 */

export interface VesselPing {
  timestamp: string;
  relativeHour: number; // e.g. -24 to 0
  position: [longitude: number, latitude: number];
  sogKnots: number;
  cogDegrees: number;
  headingDegrees: number;
  navStatus: string;
}

export interface DarkVesselAnomaly {
  gapStartTimestamp: string;
  gapEndTimestamp: string;
  gapDurationHours: number;
  lastKnownPosition: [longitude: number, latitude: number];
  reappearancePosition: [longitude: number, latitude: number];
  estimatedTransitSpeedKnots: number;
  spillCorridorIntersection: boolean;
  radarContactCorrelated: boolean;
  notes: string;
}

export interface VesselTrack {
  vesselId: string;
  vesselName: string;
  mmsi: string;
  imo?: string;
  callsign?: string;
  flag: string;
  vesselType: string;
  lengthMeters: number;
  beamMeters: number;
  draughtMeters: number;
  destination: string;
  eta?: string;
  isCandidate: boolean;
  isDarkVessel: boolean;
  darkAnomaly?: DarkVesselAnomaly;
  /** Full historical path during observation window */
  path: [longitude: number, latitude: number][];
  pings: VesselPing[];
}

export interface CaseFileMetadata {
  caseId: string;
  incidentName: string;
  creationDate: string;
  leadInvestigator: string;
  status: "Draft" | "Under Review" | "Finalized" | "Forwarded to Port Authority";
  jurisdiction: string;
  executiveSummary: string;
}

export interface P5Output {
  timeWindowStart: string;
  timeWindowEnd: string;
  totalVesselsMonitored: number;
  candidatesIdentified: number;
  darkVesselsDetected: number;
  vessels: VesselTrack[];
  generatedAt: string;
}
