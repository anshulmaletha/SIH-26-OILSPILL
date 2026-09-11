import netCDF4
import os

files = ['../k_case_study/data_0.nc', '../k_case_study/u3z_2025.nc4', '../k_case_study/v3z_2025.nc4']

for f_path in files:
    if not os.path.exists(f_path):
        print(f"Missing {f_path}")
        continue
    
    try:
        ds = netCDF4.Dataset(f_path, 'r')
        print(f"--- File: {os.path.basename(f_path)} ---")
        print("Variables:", list(ds.variables.keys()))
        
        # Look for latitude, longitude, and time
        lat_key = next((k for k in ds.variables.keys() if 'lat' in k.lower()), None)
        lon_key = next((k for k in ds.variables.keys() if 'lon' in k.lower()), None)
        time_key = next((k for k in ds.variables.keys() if 'time' in k.lower()), None)
        
        if lat_key:
            lats = ds.variables[lat_key][:]
            print(f"Latitudes: min={lats.min():.2f}, max={lats.max():.2f}")
        if lon_key:
            lons = ds.variables[lon_key][:]
            print(f"Longitudes: min={lons.min():.2f}, max={lons.max():.2f}")
        if time_key:
            times = ds.variables[time_key]
            # Try to get units
            units = times.units if hasattr(times, 'units') else 'unknown units'
            print(f"Time length: {len(times[:])} ({units})")
            print(f"Time bounds: {times[0]} to {times[-1]}")
        ds.close()
    except Exception as e:
        print(f"Error reading {f_path}: {e}")
