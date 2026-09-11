import datetime
import json
import numpy as np
import pandas as pd
from h3_utils import H3_RESOLUTION, point_to_hex

np.random.seed(42)

SCENE_T0 = datetime.datetime.fromisoformat("2026-05-15T06:00:00+00:00")
START_TIME = SCENE_T0 - datetime.timedelta(hours=24)
INTERVAL_MINUTES = 5

# Generate 5-minute discrete time steps (289 steps across 24h)
timestamps = [START_TIME + datetime.timedelta(minutes=5 * i) for i in range(289)]

records = []

# 1. CULPRIT: IND_TANKER_412 (MMSI: 419000101)
# Transits SE across corridor. Dumps oil at T-12h (19.65N, 71.20E) with speed drop.
start_lat, start_lon = 20.10, 70.80
end_lat, end_lon = 19.10, 71.90
t_discharge = SCENE_T0 - datetime.timedelta(hours=12)

for i, t in enumerate(timestamps):
    progress = i / (len(timestamps) - 1)
    lat = start_lat + (end_lat - start_lat) * progress + np.random.normal(0, 0.002)
    lon = start_lon + (end_lon - start_lon) * progress + np.random.normal(0, 0.002)
    
    # Speed anomaly during the 45-minute discharge window around T-12h
    if abs((t - t_discharge).total_seconds()) <= 22.5 * 60:
        sog = float(np.random.uniform(3.8, 4.3))  # Pumping speed
    else:
        sog = float(np.random.uniform(13.8, 14.5))  # Normal transit speed
        
    cog = 135.0  # Heading SE
    records.append({
        "vessel_id": "MMSI_419000101",
        "vessel_name": "IND_TANKER_412",
        "timestamp": t.isoformat(),
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "sog": round(sog, 2),
        "cog": cog
    })

# 2. INNOCENT VESSEL: CONTAINER_EXPRESS (MMSI: 419000202)
# Transits southern edge at normal high speed, well outside the slick backtrack
start_lat_inn, start_lon_inn = 18.30, 70.60
end_lat_inn, end_lon_inn = 18.40, 72.80

for i, t in enumerate(timestamps):
    progress = i / (len(timestamps) - 1)
    lat = start_lat_inn + (end_lat_inn - start_lat_inn) * progress
    lon = start_lon_inn + (end_lon_inn - start_lon_inn) * progress
    sog = float(np.random.uniform(18.0, 19.0))
    cog = 85.0
    records.append({
        "vessel_id": "MMSI_419000202",
        "vessel_name": "CONTAINER_EXPRESS",
        "timestamp": t.isoformat(),
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "sog": round(sog, 2),
        "cog": cog
    })

# Convert to DataFrame
df = pd.DataFrame(records)

# Convert lat/lon to H3 Resolution 7 index using consolidated h3_utils
df["hex_id"] = df.apply(lambda r: point_to_hex(r["lat"], r["lon"], H3_RESOLUTION), axis=1)

# Export standardized formats
df.to_csv("standardized_ais_indexed.csv", index=False)

# Prepare dictionary lookup structure for P4: {(hex_id, timestamp): [vessel_ids]}
ais_lookup = {}
for _, row in df.iterrows():
    key = f"{row['hex_id']}_{row['timestamp']}"
    if key not in ais_lookup:
        ais_lookup[key] = []
    ais_lookup[key].append({
        "vessel_id": row["vessel_id"],
        "vessel_name": row["vessel_name"],
        "lat": row["lat"],
        "lon": row["lon"],
        "sog": row["sog"],
        "cog": row["cog"]
    })

with open("ais_lookup_index.json", "w") as f:
    json.dump(ais_lookup, f, indent=2)

print(f"Generated {len(df)} indexed AIS records across {len(ais_lookup)} unique hex-time buckets.")