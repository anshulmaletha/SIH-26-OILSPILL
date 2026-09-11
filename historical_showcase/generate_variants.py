import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from opendrift.models.oceandrift import OceanDrift
from opendrift.readers import reader_netCDF_CF_generic
from run_mumbai_demo import seed_particles_in_polygon

def run_custom_physics_variant(
    output_filename: str,
    variant_name: str,
    wind_drift_factor: float = 0.03,
    horizontal_diffusivity: float = 8.0,
    num_particles: int = 500
):
    print(f"\n========================================================")
    print(f"[*] Running: {variant_name}")
    print(f"[*] Config: wind_drift_factor={wind_drift_factor}, horizontal_diffusivity={horizontal_diffusivity} m^2/s")
    print(f"========================================================")

    # 1. Load SAR Slick GeoJSON
    with open("sar_detection_output.json", "r") as f:
        sar_data = json.load(f)

    t0 = datetime.fromisoformat(sar_data["acquisition_time"].replace("Z", "")).replace(tzinfo=None)
    slick_poly = sar_data["polygons"][0]["geometry"]
    lons, lats = seed_particles_in_polygon(slick_poly, num_particles=num_particles)

    # 2. Setup OpenDrift with Real NetCDF Readers
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

    # 3. Apply Variant Parameters
    o.set_config('seed:wind_drift_factor', wind_drift_factor)
    o.set_config('environment:fallback:horizontal_diffusivity', horizontal_diffusivity)

    # 4. Seed and Run Backward Integration (-24h)
    o.seed_elements(lon=lons, lat=lats, time=t0, number=num_particles)
    o.run(
        duration=timedelta(hours=24),
        time_step=-900,
        time_step_output=timedelta(hours=6)
    )

    # 5. Extract Checkpoints
    times = pd.to_datetime(o.result.time.values).to_pydatetime()
    res_lons = o.result.lon.values
    res_lats = o.result.lat.values

    checkpoint_keys = ["t0", "t_minus_6h", "t_minus_12h", "t_minus_18h", "t_minus_24h"]
    checkpoints_payload = {}

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
        
        avg_lon = np.mean([p["lon"] for p in valid_particles])
        avg_lat = np.mean([p["lat"] for p in valid_particles])
        print(f"  -> Checkpoint {key}: Centroid = ({avg_lat:.2f}° N, {avg_lon:.2f}° E), Particles = {len(valid_particles)}")

    # 6. Save Contract File
    output_payload = {
        "scene_id": sar_data["scene_id"],
        "acquisition_time": sar_data["acquisition_time"],
        "variant_type": variant_name,
        "drift_config": {
            "currents_source": "HYCOM",
            "wind_source": "ERA5",
            "wind_drift_factor": wind_drift_factor,
            "horizontal_diffusivity_m2s": horizontal_diffusivity,
            "particle_count": num_particles
        },
        "checkpoints": checkpoints_payload
    }

    with open(output_filename, "w") as f:
        json.dump(output_payload, f, indent=2)

    print(f"[OK] Saved {variant_name} -> {output_filename}\n")


def generate_all_variants():
    # Variant 1: High Turbulent Dispersion (Simulates rough/choppy sea turbulence)
    run_custom_physics_variant(
        output_filename="drift_particles_high_diffusivity.json",
        variant_name="HIGH_TURBULENCE_DIFFUSIVITY",
        wind_drift_factor=0.03,
        horizontal_diffusivity=20.0  # Increased from baseline 8.0
    )

    # Variant 2: Elevated Wind Shear (Simulates higher surface wind coupling)
    run_custom_physics_variant(
        output_filename="drift_particles_high_wind.json",
        variant_name="HIGH_WIND_COUPLING",
        wind_drift_factor=0.045,      # Increased from baseline 0.03 (4.5% wind drift)
        horizontal_diffusivity=8.0
    )

if __name__ == "__main__":
    generate_all_variants()