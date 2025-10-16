import pathlib
import numpy as np
import xarray as xr
import rioxarray  

nc = pathlib.Path("/Users/huikyole/JPL_Google/ARSET/NEX-GDDP-CMIP6/GISS-E2-1-G/historical/r1i1p1f2/pr/pr_day_GISS-E2-1-G_historical_r1i1p1f2_gn_2014_v2.0.nc")
out_dir = pathlib.Path("Missions/Test/Data/precip")
out_dir.mkdir(parents=True, exist_ok=True)
target = out_dir / "pr_2014-01-01_mm_per_day.tif"

ds = xr.open_dataset(nc, decode_times=True)
precip = ds["pr"].sel(time="2014-01-01") * 86400.0            # kg m-2 s-1 → mm/day
precip = precip.where(np.isfinite(precip), np.nan)

# wrap 0-360 longitudes to -180-180
precip = precip.assign_coords(lon=((precip.lon + 180) % 360) - 180)
precip = precip.sortby("lon")

if precip.lat[0] < precip.lat[-1]:
    precip = precip.sel(lat=slice(None, None, -1))

precip.rio.set_spatial_dims("lon", "lat", inplace=True)
precip.rio.write_crs("EPSG:4326", inplace=True)
precip.rio.write_nodata(np.nan, inplace=True)
precip.rio.to_raster(target, dtype="float32", compress="deflate")

