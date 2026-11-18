"""
Day 21 · canopy height around the playgrounds (runs in GitHub Actions).

Meta / WRI High Resolution Canopy Height Maps (Tolan et al. 2024, ~1 m, CC BY 4.0), read as cloud-optimised GeoTIFFs over
HTTPS (only the windows we need), reprojected to a 1 m EPSG:25832 grid over the study box. Cells farther than 80 m from any
playground are set to 0 so the file compresses well.
  python pipeline/chm.py data/units_buf80.geojson out/chm_1m.tif
"""
import sys, math
import numpy as np
import geopandas as gpd
import rasterio
from rasterio.features import geometry_mask
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling

BASE = "https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/{}.tif"


def quadkey(x, y, z):
    q = ""
    for i in range(z, 0, -1):
        d = 0; m = 1 << (i - 1)
        if x & m: d += 1
        if y & m: d += 2
        q += str(d)
    return q


def tile(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def main(buf, dst):
    b = gpd.read_file(buf).set_crs(25832, allow_override=True)
    x0, y0, x1, y1 = [int(v) for v in b.total_bounds]
    W, H = x1 - x0, y1 - y0
    tr = from_origin(x0, y1, 1, 1)
    out = np.zeros((H, W), np.float32)
    ll = b.to_crs(4326).total_bounds
    tiles = {tile(lo, la, 9) for lo in (ll[0], ll[2]) for la in (ll[1], ll[3])}
    for tx, ty in sorted(tiles):
        u = BASE.format(quadkey(tx, ty, 9))
        print("tile", u, flush=True)
        try:
            with rasterio.open("/vsicurl/" + u) as s:
                print(s.crs, s.res, s.dtypes, flush=True)
                tmp = np.zeros_like(out)
                reproject(rasterio.band(s, 1), tmp, dst_transform=tr, dst_crs="EPSG:25832", resampling=Resampling.bilinear,
                          src_nodata=s.nodata, dst_nodata=0)
                out = np.maximum(out, np.nan_to_num(tmp))
        except Exception as e:
            print("fail", e)
    m = geometry_mask(b.geometry, (H, W), tr, invert=True)
    out[~m] = 0
    o8 = np.clip(np.round(out * 4), 0, 255).astype(np.uint8)        # 0.25 m steps
    with rasterio.open(dst, "w", driver="GTiff", width=W, height=H, count=1, dtype="uint8", crs="EPSG:25832", transform=tr,
                       compress="deflate", predictor=2, tiled=True) as d:
        d.write(o8, 1)
        d.update_tags(scale="0.25 m per unit", source="Meta/WRI High Resolution Canopy Height Maps v1 (CC BY 4.0)")
    print("canopy ≥ 3 m share in buffers:", round(float((out[m] >= 3).mean()), 3))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
