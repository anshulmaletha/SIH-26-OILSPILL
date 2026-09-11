import json
import os
import h3
from datetime import datetime

def build_mocks():
    # Load original analytical validation report
    with open("../validation_report_kerala_msc_elsa3.json", "r") as f:
        kerala_data = json.load(f)
        
    scene_id = "S1A_IW_GRDH_1SDV_20250527T060000_KERALA"
    
    # 1. SAR Detection Output (Format for the UI)
    # Slick polygon near the drift-adjusted observation point (~2 days after sinking)
    # Wreck: 9.3125N, 76.136E. Drift ~3km/h SSE for ~48h => ~144km SSE
    # Observation location estimated around 8.025N, 76.675E
    sar_out = {
        "scene_id": scene_id,
        "acquisition_time": kerala_data["case_metadata"]["observation_date_utc"],
        "polygons": [
            {
                "polygon_id": "slick_kerala_01",
                "geometry": {
                    "type": "Polygon",
                    # Irregular polygon near SAR observation point (~8.02N, 76.67E)
                    "coordinates": [[
                        [76.660, 8.040], [76.680, 8.035],
                        [76.690, 8.020], [76.685, 8.010],
                        [76.675, 8.005], [76.665, 8.010],
                        [76.655, 8.020], [76.650, 8.030],
                        [76.660, 8.040]
                    ]]
                }
            }
        ]
    }
    
    with open("sar_detection_output_kerala.json", "w") as f:
        json.dump(sar_out, f, indent=2)
    print(f"[INFO] SAR detection polygon centered near 8.025°N, 76.675°E (drift-adjusted observation point)")

    # 2. H3 Corridor Output
    corridor_out = {
        "h3_resolution": 7,
        "scene_id": scene_id,
        "corridor": {}
    }
    
    for ts in kerala_data["corridor"]["timesteps"]:
        # Recompute REAL H3 hex instead of the offline placeholder
        lat = ts["centroid_lat"]
        lon = ts["centroid_lon"]
        hex_id = h3.latlng_to_cell(lat, lon, 7)
        
        # PHYSICS FIX: Corridor width GROWS with time distance from observation.
        # Stochastic diffusion means uncertainty increases as we integrate further.
        # k=1 at T0, k=2 at T-12h, k=3 at T-24h, etc.
        hours_back = ts["t_minus_hours"]
        k = 1 + int(hours_back / 12)
        hex_ring = h3.grid_disk(hex_id, k)
        
        t_key = "t0" if ts["t_minus_hours"] == 0 else f"t_minus_{int(ts['t_minus_hours'])}h"
        
        # density mock: center hex is densest, outer hexes decrease
        density = {h: max(10, 150 - k * 20) for h in hex_ring}
        density[hex_id] = 150 
        
        corridor_out["corridor"][t_key] = {
            "hex_ids": list(hex_ring),
            "particle_density": density
        }
        print(f"  [CORRIDOR] {t_key}: T-{hours_back}h, k-ring={k}, hex_count={len(hex_ring)}")
        
    with open("h3_corridor_output_kerala.json", "w") as f:
        json.dump(corridor_out, f, indent=2)
        
    # 3. Case File Output
    case_out = {
        "case_id": "CASE-2025-KERALA-MSC-ELSA-3",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "scene_id": scene_id,
        "h3_resolution": 7,
        "processing_parameters": {
            "segmentation_model_version": "Analytical-Validation-Model",
            "drift_config": {
                "currents_source": "Analytical Constant 3km/h",
                "wind_source": "Estimated 8.5m/s",
                "wind_drift_factor": 0.03
            }
        },
        "corridor": corridor_out["corridor"],
        "suspect_vessels": [
            {
                "mmsi": "123456789",
                "vessel_name": kerala_data["case_metadata"]["vessel_name"],
                "flag": kerala_data["case_metadata"]["flag_state"],
                "type": kerala_data["case_metadata"]["vessel_type"],
                "final_score": 98.5,
                "confidence_band": "HIGH",
                "corridor_match_score": 40.0,
                "heading_alignment_score": 30.0,
                "speed_anomaly_score": 20.0,
                "ais_gap_score": 8.5
            }
        ]
    }
    
    with open("case_file_output_kerala.json", "w") as f:
        json.dump(case_out, f, indent=2)
        
    print(f"[INFO] Corridor generated using ANALYTICAL constant-velocity drift (3 km/h SSE)")
    print(f"[INFO] NetCDF files NOT loaded — k_case_study/ datasets exist but require OpenDrift")
    print("Successfully generated Kerala mock JSONs.")

if __name__ == "__main__":
    build_mocks()
