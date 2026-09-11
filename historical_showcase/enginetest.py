from datetime import datetime, timedelta
from opendrift.models.oceandrift import OceanDrift
from opendrift.readers import reader_constant

# 1. Initialize OpenDrift (Mode.Config)
o = OceanDrift(loglevel=20)

# 2. Add Readers
r_current = reader_constant.Reader({'x_sea_water_velocity': 0.2, 'y_sea_water_velocity': 0.0})
r_wind = reader_constant.Reader({'x_wind': 0.0, 'y_wind': 5.0})
o.add_reader([r_current, r_wind])

# 3. Configure Physics (MUST be done before seeding)
o.set_config('seed:wind_drift_factor', 0.03)
o.set_config('environment:fallback:horizontal_diffusivity', 5.0)

# 4. Seed Elements (Transitions to Mode.Ready)
t0 = datetime(2026, 5, 14, 12, 0, 0)
o.seed_elements(
    lon=[72.8, 72.81, 72.82], 
    lat=[18.9, 18.91, 18.92], 
    time=t0, 
    number=300
)

# 5. Run Backward Drift (Transitions to Mode.Run)
o.run(
    duration=timedelta(hours=24), 
    time_step=-900, 
    time_step_output=timedelta(hours=6)
)

times, _ = o.get_time_array()
print("Timesteps recorded:", [t.isoformat() for t in times])

import json
import numpy as np
import pandas as pd
# 1. Retrieve times and trajectory matrices
times = pd.to_datetime(o.result.time.values).to_pydatetime()
lons = o.result.lon.values  # Shape: (num_particles, num_timesteps)
lats = o.result.lat.values  # Shape: (num_particles, num_timesteps)

# 2. Map timesteps to the PRD contract checkpoint keys
# times are in reverse chronological order: [t0, -6h, -12h, -18h, -24h]
checkpoint_keys = ["t0", "t_minus_6h", "t_minus_12h", "t_minus_18h", "t_minus_24h"]

checkpoints_payload = {}
for idx, t in enumerate(times):
    key = checkpoint_keys[idx] if idx < len(checkpoint_keys) else f"step_{idx}"
    step_lons = lons[:, idx]
    step_lats = lats[:, idx]
    
    checkpoints_payload[key] = {
        "timestamp": t.isoformat(),
        "particles": [
            {"lon": round(float(lo), 6), "lat": round(float(la), 6)}
            for lo, la in zip(step_lons, step_lats)
            if not np.ma.is_masked(lo) and not np.isnan(lo)
        ]
    }

# 3. Assemble full P2 -> P4 data contract
drift_output = {
    "scene_id": "DEMO_TEST_SCENE_001",
    "drift_config": {
        "currents_source": "HYCOM",
        "wind_source": "ERA5",
        "wind_drift_factor": 0.03,
        "horizontal_diffusivity_m2s": 5.0,
        "particle_count": lons.shape[0]
    },
    "checkpoints": checkpoints_payload
}

# 4. Save to JSON
with open("drift_particles.json", "w") as f:
    json.dump(drift_output, f, indent=2)

print(f"[OK] Successfully generated drift_particles.json with {lons.shape[0]} particles per checkpoint.")