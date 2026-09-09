import cdsapi

def download_demo_era5():
    client = cdsapi.Client()
    client.retrieve(
        'reanalysis-era5-single-levels',
        {
            'product_type': 'reanalysis',
            'variable': ['10m_u_component_of_wind', '10m_v_component_of_wind'],
            'year': '2026',
            'month': '05',
            'day': ['14', '15'],
            'time': [f"{h:02d}:00" for h in range(24)],
            'area': [20.00, 70.50, 18.20, 73.00],  # [North, West, South, East]
            'format': 'netcdf',
        },
        'mumbai_era5_winds.nc'
    )
    print("[OK] Downloaded ERA5 slice: mumbai_era5_winds.nc")

if __name__ == "__main__":
    download_demo_era5()