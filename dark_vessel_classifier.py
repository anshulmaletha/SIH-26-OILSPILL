import json
import math
import os
from h3_utils import H3_RESOLUTION, point_to_hex, latlon_to_h3

T0_TIMESTAMP = "2026-05-15T06:00:00Z"
AIS_LOOKUP_PATH = "ais_lookup_index.json" if os.path.exists("ais_lookup_index.json") else os.path.join("output_fixtures", "ais_lookup_index.json")
OUTPUT_PATH = os.path.join("output_fixtures", "dark_vessel_output.json") if os.path.exists("output_fixtures") else "dark_vessel_output.json"

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def run_dark_vessel_classification(cfar_detections, ais_lookup_file, distance_threshold_km=2.5):
    # Fallback to local ais_lookup_index.json if specified file not found
    if not os.path.exists(ais_lookup_file) and os.path.exists("ais_lookup_index.json"):
        ais_lookup_file = "ais_lookup_index.json"

    with open(ais_lookup_file, "r") as f:
        ais_lookup = json.load(f)

    # Extract all AIS broadcasts active at T0 (supporting both Z and +00:00 suffix)
    t0_variants = (
        T0_TIMESTAMP,
        T0_TIMESTAMP.replace("Z", "+00:00"),
        T0_TIMESTAMP.replace("+00:00", "Z"),
    )
    ais_at_t0 = []
    for key, vessel_list in ais_lookup.items():
        if any(key.endswith(f"_{variant}") for variant in t0_variants):
            ais_at_t0.extend(vessel_list)

    identified_vessels = []
    dark_vessels = []

    for cfar in cfar_detections:
        c_id = cfar["cfar_id"]
        c_lat = cfar["lat"]
        c_lon = cfar["lon"]

        matched_ais = None
        min_dist = float("inf")

        for ais in ais_at_t0:
            dist = haversine_km(c_lat, c_lon, ais["lat"], ais["lon"])
            if dist <= distance_threshold_km and dist < min_dist:
                min_dist = dist
                matched_ais = ais

        if matched_ais:
            identified_vessels.append({
                "cfar_id": c_id,
                "vessel_id": matched_ais["vessel_id"],
                "vessel_name": matched_ais["vessel_name"],
                "distance_km": round(min_dist, 3),
                "lat": c_lat,
                "lon": c_lon
            })
        else:
            hex_id = latlon_to_h3(c_lat, c_lon, H3_RESOLUTION)
            dark_vessels.append({
                "cfar_detection_id": c_id,
                "position": {
                    "type": "Point",
                    "coordinates": [round(c_lon, 5), round(c_lat, 5)]
                },
                "timestamp": T0_TIMESTAMP,
                "ais_match_found": False,
                "proximity_to_corridor": hex_id
            })

    output_payload = {
        "timestamp": T0_TIMESTAMP,
        "total_radar_detections": len(cfar_detections),
        "identified_vessels": identified_vessels,
        "dark_vessels": dark_vessels
    }

    out_dir = os.path.dirname(OUTPUT_PATH)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output_payload, f, indent=2)

    return output_payload

MOCK_CFAR_HITS = [
    {"cfar_id": "CFAR_RADAR_001", "lat": 19.10, "lon": 71.90},
    {"cfar_id": "CFAR_DARK_002", "lat": 19.28, "lon": 71.90}
]
mock_cfar_hits = MOCK_CFAR_HITS

if __name__ == "__main__":
    result = run_dark_vessel_classification(MOCK_CFAR_HITS, AIS_LOOKUP_PATH)
    
    print("[+] Classification Complete:")
    print(f"  - Identified Ships (Radar + AIS): {len(result['identified_vessels'])}")
    print(f"  - Dark Vessels (Radar ONLY, No AIS): {len(result['dark_vessels'])}")
    print(f"[+] Saved to: {OUTPUT_PATH}")