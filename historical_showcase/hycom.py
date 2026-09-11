import xarray as xr
from datetime import datetime

def download_demo_hycom():
    hycom_url = "https://tds.hycom.org/thredds/dodsC/GLBv0.08/expt_93.0"
    print(f"[*] Subsetting HYCOM currents from OPeNDAP...")
    
    # 1. Disable automatic decoding to bypass the 'tau' variable
    ds = xr.open_dataset(hycom_url, decode_times=False)

    # 2. Slice spatial bounds, surface depth, and the latest 8 timesteps (covering the 24-36h demo window)
    subset = ds[['water_u', 'water_v']].sel(
        lat=slice(18.20, 20.00),
        lon=slice(70.50, 73.00)
    ).isel(
        depth=0,
        time=slice(-8, None)  # Pulls the most recent slices up to T0
    )
    subset.to_netcdf('mumbai_hycom_currents.nc')
    print("[OK] Saved HYCOM surface currents: mumbai_hycom_currents.nc")

if __name__ == "__main__":
    download_demo_hycom()