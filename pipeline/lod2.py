"""
Day 21 · LoD2-DE Hamburg → building footprints with height for Altona + Eimsbüttel (runs in GitHub Actions).

Streams every CityGML file in the zip, keeps buildings (and building parts) whose ground surface lies in the study box,
and writes footprint (GroundSurface, else the 2D hull of all surfaces) + height (measuredHeight, else max z − min z).
  python pipeline/lod2.py lod2.zip out.parquet
"""
import sys, zipfile, io
from lxml import etree
import geopandas as gpd
from shapely.geometry import Polygon, MultiPoint
from shapely.ops import unary_union

X0, Y0, X1, Y1 = 547000, 5930000, 568000, 5947500          # EPSG:25832, Altona + Eimsbüttel with margin
NS_B = ["Building", "BuildingPart"]


def coords(el):
    out = []
    for pl in el.iter("{*}posList"):
        v = [float(x) for x in pl.text.split()]
        out.append([(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v) - 2, 3)])
    return out


def main(src, dst):
    rows = []
    z = zipfile.ZipFile(src)
    names = [n for n in z.namelist() if n.lower().endswith((".gml", ".xml"))]
    print(len(names), "files")
    for k, n in enumerate(names):
        with z.open(n) as fh:
            for _, el in etree.iterparse(fh, events=("end",), tag=["{*}Building"], huge_tree=True):
                parts = [el] + list(el.iter("{*}BuildingPart"))
                for b in parts:
                    gs = [c for g in b.iter("{*}GroundSurface") for c in coords(g)]
                    allc = [c for c in coords(b)]
                    if not allc:
                        continue
                    xs = [p[0] for r in allc for p in r]; ys = [p[1] for r in allc for p in r]
                    if not (X0 < min(xs) and max(xs) < X1 and Y0 < min(ys) and max(ys) < Y1):
                        continue
                    if b is el and len(parts) > 1 and not gs:
                        continue
                    try:
                        fp = unary_union([Polygon([(p[0], p[1]) for p in r]).buffer(0) for r in gs]) if gs else \
                            MultiPoint([(p[0], p[1]) for r in allc for p in r]).convex_hull
                    except Exception:
                        continue
                    mh = b.find("{*}measuredHeight")
                    zs = [p[2] for r in allc for p in r]
                    h = float(mh.text) if mh is not None and mh.text else max(zs) - min(zs)
                    rows.append({"gid": b.get("{http://www.opengis.net/gml}id"), "h": round(h, 1), "zmin": round(min(zs), 1), "geometry": fp})
                el.clear()
        if k % 20 == 0:
            print(k, n, len(rows), flush=True)
    g = gpd.GeoDataFrame(rows, geometry="geometry", crs=25832)
    g = g[g.area > 2]
    g.to_parquet(dst)
    print(len(g), "buildings", g.h.describe().round(1).to_dict())


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
