import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from shapely.geometry import shape, Point
from opendrift.models.oceandrift import OceanDrift
from opendrift.readers import reader_netCDF_CF_generic, reader_constant

def seed_particles_in_polygon(geojson_geom: dict, num_particles: int = 1000):
    poly = shape(geojson_geom)
    min_lon, min_lat, max_lon, max_lat = poly.bounds
    seeded_lons, seeded_lats = [], []
    
    while len(seeded_lons) < num_particles:
        batch_size = (num_particles - len(seeded_lons)) * 2
        rand_lons = np.random.uniform(min_lon, max_lon, batch_size)
        rand_lats = np.random.uniform(min_lat, max_lat, batch_size)
        for lon, lat in zip(rand_lons, rand_lats):
            if poly.contains(Point(lon, lat)):
                seeded_lons.append(lon)
                seeded_lats.append(lat)
                if len(seeded_lons) == num_particles:
                    break
    return seeded_lons, seeded_lats

def run_backtracking(
    sar_geojson_path: str,
    hycom_path: str = None,
    era5_path: str = None,
    output_path: str = "drift_particles.json",
    num_particles: int = 1000
):
    with open(sar_geojson_path, "r") as f:
        sar_data = json.load(f)

    # 1. Parse observation time and slick geometry
    target_poly = sar_data["polygons"][0]
    t0 = datetime.fromisoformat(sar_data["acquisition_time"].replace("Z", "+00:00"))
    lons, lats = seed_particles_in_polygon(target_poly["geometry"], num_particles)

    # 2. Configure OpenDrift
    o = OceanDrift(loglevel=20)
    
    if hycom_path and era5_path:
        r_hycom = reader_netCDF_CF_generic.Reader(hycom_path)
        r_era5 = reader_netCDF_CF_generic.Reader(era5_path)
        o.add_reader([r_hycom, r_era5])
    else:
        # Fallback constant readers for synthetic testing
        o.add_reader([
            reader_constant.Reader({'x_sea_water_velocity': 0.15, 'y_sea_water_velocity': -0.05}),
            reader_constant.Reader({'x_wind': 1.5, 'y_wind': 4.0})
        ])

    o.set_config('seed:wind_drift_factor', 0.03)
    o.set_config('environment:fallback:horizontal_diffusivity', 5.0)

    # 3. Seed elements at observation time
    o.seed_elements(lon=lons, lat=lats, time=t0, number=num_particles)

    # 4. Run backward simulation (-24h, checkpointed every 6h)
    o.run(
        duration=timedelta(hours=24),
        time_step=-900,
        time_step_output=timedelta(hours=6)
    )

    # 5. Extract results via Xarray
    times = pd.to_datetime(o.result.time.values).to_pydatetime()
    res_lons = o.result.lon.values
    res_lats = o.result.lat.values

    checkpoint_keys = ["t0", "t_minus_6h", "t_minus_12h", "t_minus_18h", "t_minus_24h"]
    checkpoints_payload = {}

    for idx, t in enumerate(times):
        key = checkpoint_keys[idx] if idx < len(checkpoint_keys) else f"step_{idx}"
        step_lons = res_lons[:, idx]
        step_lats = res_lats[:, idx]
        
        checkpoints_payload[key] = {
            "timestamp": t.isoformat(),
            "particles": [
                {"lon": round(float(lo), 6), "lat": round(float(la), 6)}
                for lo, la in zip(step_lons, step_lats)
                if not np.ma.is_masked(lo) and not np.isnan(lo)
            ]
        }

    # 6. Export contract for P4
    output_payload = {
        "scene_id": sar_data.get("scene_id", "UNKNOWN_SCENE"),
        "acquisition_time": sar_data["acquisition_time"],
        "drift_config": {
            "currents_source": "HYCOM" if hycom_path else "SYNTHETIC_CONSTANT",
            "wind_source": "ERA5" if era5_path else "SYNTHETIC_CONSTANT",
            "wind_drift_factor": 0.03,
            "horizontal_diffusivity_m2s": 5.0,
            "particle_count": num_particles
        },
        "checkpoints": checkpoints_payload
    }

    with open(output_path, "w") as f:
        json.dump(output_payload, f, indent=2)

    print(f"[OK] Backtracking complete -> exported to {output_path}")


def bin_particles_to_h3_corridor(
    drift_data: dict,
    h3_resolution: int = 7
) -> dict:
    """
    P2 -> P4 Data Adapter:
    Converts raw Lagrangian drift particle clouds (drift_particles.json)
    into the PRD §7.2 Stage 2 hex-binned origin corridor schema.
    
    Args:
        drift_data: Parsed dictionary from drift_particles.json.
        h3_resolution: H3 resolution level (default 7).
        
    Returns:
        dict strictly conforming to PRD §7.2 schema.
    """
    import h3
    checkpoints = drift_data.get("checkpoints", {})
    corridor = {}

    for cp_key, cp_val in checkpoints.items():
        particles = cp_val.get("particles", [])
        density_map = {}

        for p in particles:
            lat = p.get("lat")
            lon = p.get("lon")
            if lat is None or lon is None:
                continue

            if hasattr(h3, 'latlng_to_cell'):
                cell = h3.latlng_to_cell(lat, lon, h3_resolution)
            else:
                cell = h3.geo_to_h3(lat, lon, h3_resolution)

            density_map[cell] = density_map.get(cell, 0) + 1

        corridor[cp_key] = {
            "hex_ids": sorted(list(density_map.keys())),
            "particle_density": density_map
        }

    drift_cfg = drift_data.get("drift_config", {})
    return {
        "h3_resolution": h3_resolution,
        "scene_id": drift_data.get("scene_id", "UNKNOWN_SCENE"),
        "corridor": corridor,
        "drift_config": {
            "currents_source": drift_cfg.get("currents_source", "HYCOM"),
            "wind_source": drift_cfg.get("wind_source", "ERA5"),
            "wind_drift_factor": drift_cfg.get("wind_drift_factor", 0.03),
            "diffusion_coefficient": drift_cfg.get("horizontal_diffusivity_m2s", 8.0),
            "particle_count": drift_cfg.get("particle_count", 500)
        }
    }


def convert_drift_particles_file(
    input_path: str = "drift_particles.json",
    output_path: str = "h3_corridor_output.json",
    h3_resolution: int = 7
) -> dict:
    """Convenience utility to convert drift_particles.json file to PRD §7.2 JSON file."""
    with open(input_path, "r", encoding="utf-8") as f:
        raw_drift = json.load(f)

    binned = bin_particles_to_h3_corridor(raw_drift, h3_resolution=h3_resolution)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(binned, f, indent=2)

    print(f"[OK] Converted {input_path} -> {output_path} ({len(binned['corridor'])} timesteps binned into H3 res {h3_resolution})")
    return binned