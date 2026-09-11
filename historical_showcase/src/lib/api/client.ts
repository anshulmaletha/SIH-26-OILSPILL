/**
 * SIH 26143 — Frontend API Client
 * Connects React Mission Controller and overlays to the FastAPI Python backend.
 */

export const API_BASE =
  typeof window !== "undefined" && (window as any).__API_BASE__
    ? (window as any).__API_BASE__
    : import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface DetectionResult {
  scene_id: string;
  acquisition_time: string;
  polygons: Array<{
    polygon_id: string;
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    };
    confidence?: number;
    geometry_features: {
      area_km2: number;
      perimeter_km: number;
      major_axis_km: number;
      minor_axis_km: number;
      eccentricity: number;
      orientation_deg: number;
    };
    lookalike_filter: {
      wind_speed_ms: number;
      wind_gate_passed: boolean;
      damping_ratio: number;
      damping_gate_passed?: boolean;
      shape_gate_passed: boolean;
      final_decision: "confirmed" | "rejected";
      rejection_reason: string | null;
    };
  }>;
  filter_model?: string;
}

export interface CorridorResult {
  h3_resolution: number;
  scene_id: string;
  corridor: Record<
    string,
    {
      timestamp?: string;
      hex_ids: string[];
      particle_density: Record<string, number>;
    }
  >;
  drift_config: {
    currents_source: string;
    wind_source: string;
    wind_drift_factor: number;
    diffusion_coefficient?: number;
    particle_count?: number;
    current_forcing?: string;
  };
}

export interface CandidatesResult {
  candidates: Array<{
    vessel_id: string;
    vessel_name: string;
    vessel_type: string;
    flag: string;
    heading_deg: number;
    speed_knots_before: number;
    speed_knots_during: number;
    speed_dropped_during_transit: boolean;
    ais_gap_minutes: number;
    matches: Array<{
      hex_id: string;
      timestep: string;
      match_type: "primary" | "k_ring";
      k_ring: number;
      decay_weight: number;
    }>;
  }>;
  ais_query_bounds: {
    spatial: any;
    temporal: { start: string; end: string };
  };
}

export interface SuspectsResult {
  ranked_suspects: Array<{
    rank: number;
    vessel_id: string;
    vessel_name: string;
    vessel_type: string;
    flag: string;
    total_score: number;
    normalized_score: number;
    feature_breakdown: {
      corridor_overlap_score: number;
      heading_alignment_score: number;
      speed_anomaly_score: number;
      ais_gap_history_score: number;
    };
    weights_used: {
      corridor_overlap: number;
      heading_alignment: number;
      speed_anomaly: number;
      ais_gap_history: number;
    };
    assessment?: string;
  }>;
  dark_vessels: Array<{
    cfar_detection_id: string;
    position: { type: "Point"; coordinates: [number, number] };
    timestamp: string;
    ais_match_found: boolean;
    proximity_to_corridor?: string;
  }>;
  null_result: boolean;
  scoring_model?: string;
}

export interface DarkVesselsResult {
  timestamp: string;
  total_radar_detections: number;
  identified_vessels: Array<{
    cfar_id: string;
    vessel_id: string;
    vessel_name: string;
    distance_km: number;
    lat: number;
    lon: number;
  }>;
  dark_vessels: Array<{
    cfar_detection_id: string;
    position: { type: "Point"; coordinates: [number, number] };
    timestamp: string;
    ais_match_found: boolean;
    proximity_to_corridor?: string;
  }>;
}

export interface CaseFileMetadataResult {
  case_id: string;
  generated_at: string;
  scene_id: string;
  h3_resolution: number;
  processing_parameters: any;
  corridor: any;
  ais_query_bounds: any;
  ranked_suspects: any[];
  dark_vessels: any[];
  null_result: boolean;
  input_data_hash: string;
}

export interface AisTracksResult {
  vessels: Array<{
    vesselId: string;
    vesselName: string;
    mmsi: string;
    vesselType: string;
    flag: string;
    isCandidate: boolean;
    isDarkVessel: boolean;
    path: [number, number][];
    pings: Array<{
      timestamp: string;
      position: [number, number];
      sog: number;
      cog: number;
      hex_id: string;
    }>;
  }>;
  count: number;
}

export async function fetchDetection(scenario: string = "active"): Promise<DetectionResult> {
  const res = await fetch(`${API_BASE}/api/detection?scenario=${encodeURIComponent(scenario)}`);
  if (!res.ok) throw new Error(`Failed to fetch detection: ${res.statusText}`);
  return res.json();
}

export async function fetchCorridor(scenario: string = "active"): Promise<CorridorResult> {
  const res = await fetch(`${API_BASE}/api/corridor?scenario=${encodeURIComponent(scenario)}`);
  if (!res.ok) throw new Error(`Failed to fetch corridor: ${res.statusText}`);
  return res.json();
}

export async function fetchCandidates(scenario: string = "active"): Promise<CandidatesResult> {
  const res = await fetch(`${API_BASE}/api/candidates?scenario=${encodeURIComponent(scenario)}`);
  if (!res.ok) throw new Error(`Failed to fetch candidates: ${res.statusText}`);
  return res.json();
}

export async function fetchSuspects(scenario: string = "active"): Promise<SuspectsResult> {
  const res = await fetch(`${API_BASE}/api/suspects?scenario=${encodeURIComponent(scenario)}`);
  if (!res.ok) throw new Error(`Failed to fetch suspects: ${res.statusText}`);
  return res.json();
}

export async function fetchDarkVessels(): Promise<DarkVesselsResult> {
  const res = await fetch(`${API_BASE}/api/dark-vessels`);
  if (!res.ok) throw new Error(`Failed to fetch dark vessels: ${res.statusText}`);
  return res.json();
}

export async function fetchCaseFileMetadata(scenario: string = "active"): Promise<CaseFileMetadataResult> {
  const res = await fetch(`${API_BASE}/api/case-file/metadata?scenario=${encodeURIComponent(scenario)}`);
  if (!res.ok) throw new Error(`Failed to fetch case file metadata: ${res.statusText}`);
  return res.json();
}

export function getCaseFilePdfUrl(scenario: string = "active"): string {
  return `${API_BASE}/api/case-file?scenario=${encodeURIComponent(scenario)}`;
}

export async function fetchAisTracks(scenario: string = "active"): Promise<AisTracksResult> {
  const res = await fetch(`${API_BASE}/api/ais?scenario=${encodeURIComponent(scenario)}`);
  if (!res.ok) throw new Error(`Failed to fetch AIS tracks: ${res.statusText}`);
  return res.json();
}
