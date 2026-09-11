/**
 * P3 Data Contract — Feature Scoring & Suspect Ranking
 * Standardized interface for P3 ML / Rule-based scoring output.
 */

export interface FeatureScores {
  /** Overlap degree with the OpenDrift/H3 backtracked corridor (0.0 to 1.0) */
  trajectoryIntersection: number;
  /** Proximity in time to the estimated discharge event (0.0 to 1.0) */
  temporalProximity: number;
  /** Speed anomaly or maneuvering deviation (0.0 to 1.0) */
  speedAnomaly: number;
  /** AIS transponder deliberate shutdown gap score (0.0 to 1.0) */
  aisGapScore: number;
}

export interface RankedSuspect {
  rank: number;
  vesselId: string;
  vesselName: string;
  mmsi: string;
  vesselType: string;
  flag: string;
  /** Overall normalized likelihood score (0.0 to 1.0) */
  overallScore: number;
  confidence: number;
  featureScores: FeatureScores;
  isDarkVessel: boolean;
  isPrimarySuspect: boolean;
  recommendation: string;
}

export interface P3Output {
  incidentId: string;
  generatedAt: string;
  totalSuspectsEvaluated: number;
  algorithmVersion: string;
  suspects: RankedSuspect[];
}
