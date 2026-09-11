# forward_forecast.py
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from opendrift.models.oceandrift import OceanDrift
from opendrift.readers import reader_netCDF_CF_generic
from run_mumbai_demo import seed_particles_in_polygon

def run_forward_spill_forecast():
    with open("sar_detection_output.json", "r") as f:
        sar_data = json.load(f)

    t0 = datetime.fromisoformat(sar_data["acquisition_time"].replace("Z", "")).replace(tzinfo=None)
    slick_poly = sar_data["polygons"][0]["geometry"]
    lons, lats = seed_particles_in_polygon(slick_poly, num_particles=500)

    o = OceanDrift(loglevel=20)

    r_hycom = reader_netCDF_CF_generic.Reader(
        'mumbai_hycom_currents.nc',
        standard_name_mapping={'water_u': 'x_sea_water_velocity', 'water_v': 'y_sea_water_velocity'}
    )
    r_era5 = reader_netCDF_CF_generic.Reader(
        'mumbai_era5_winds.nc',
        standard_name_mapping={'u10': 'x_wind', 'v10': 'y_wind'}
    )
    o.add_reader([r_hycom, r_era5])

    o.set_config('seed:wind_drift_factor', 0.03)
    o.set_config('environment:fallback:horizontal_diffusivity', 8.0)

    # Seed at T0
    o.seed_elements(lon=lons, lat=lats, time=t0, number=500)

    # Positive time step (+900s) for forward trajectory
    print("[*] Running Forward Forecast (+24 hours)...")
    o.run(
        duration=timedelta(hours=24),
        time_step=900,
        time_step_output=timedelta(hours=6)
    )

    times = pd.to_datetime(o.result.time.values).to_pydatetime()
    res_lons = o.result.lon.values
    res_lats = o.result.lat.values

    checkpoints_payload = {}
    checkpoint_keys = ["t0", "t_plus_6h", "t_plus_12h", "t_plus_18h", "t_plus_24h"]

    for idx, t in enumerate(times):
        key = checkpoint_keys[idx] if idx < len(checkpoint_keys) else f"step_{idx}"
        valid_particles = [
            {"lon": round(float(lo), 6), "lat": round(float(la), 6)}
            for lo, la in zip(res_lons[:, idx], res_lats[:, idx])
            if not np.ma.is_masked(lo) and not np.isnan(lo)
        ]
        checkpoints_payload[key] = {
            "timestamp": t.isoformat(),
            "particles": valid_particles
        }

    forward_payload = {
        "scene_id": sar_data["scene_id"],
        "forecast_type": "FORWARD_SPILL_RESPONSE",
        "checkpoints": checkpoints_payload
    }

    with open("forward_drift_particles.json", "w") as f:
        json.dump(forward_payload, f, indent=2)

    print("[OK] Saved forward_drift_particles.json for Spill Response UI.")

if __name__ == "__main__":
    run_forward_spill_forecast()