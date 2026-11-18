"""
Day 21 · The Incomplete Playground · step 1: OpenStreetMap → layers for Altona + Eimsbüttel.

Reads the Hamburg extract (Geofabrik, 2026-11-16) once with pyosmium and keeps, inside the two boroughs (+150 m):
  playgrounds (leisure=playground, nodes + areas, all tags) · equipment (playground=*) · benches / picnic tables ·
  trees (natural=tree) · tree rows · woods · buildings (footprint, height, building:levels, roof:levels) ·
  schools / kindergartens · parks · shelters.
  python pipeline/extract.py
Output build/osm_*.parquet (EPSG:25832)
"""
import json
from pathlib import Path

import osmium
import geopandas as gpd
from shapely import wkb
from shapely.geometry import Point, box

P = Path("input/hamburg.osm.pbf")
B = Path("build"); B.mkdir(exist_ok=True)
BBOX = (9.72, 53.53, 10.01, 53.68)
fab = osmium.geom.WKBFactory()
L = {k: [] for k in ["bezirk", "playground", "equipment", "seat", "tree", "treerow", "wood", "building", "school", "park", "shelter"]}


def inb(x, y):
    return BBOX[0] < x < BBOX[2] and BBOX[1] < y < BBOX[3]


class H(osmium.SimpleHandler):
    def node(self, n):
        t = n.tags
        if not n.location.valid() or not inb(n.location.lon, n.location.lat):
            return
        g = Point(n.location.lon, n.location.lat)
        d = None
        if t.get("leisure") == "playground":
            d = "playground"
        elif "playground" in t:
            d = "equipment"
        elif t.get("amenity") == "bench" or t.get("leisure") == "picnic_table" or t.get("leisure") == "bench":
            d = "seat"
        elif t.get("natural") == "tree":
            d = "tree"
        elif t.get("amenity") == "shelter":
            d = "shelter"
        if d:
            L[d].append({"osm": f"n{n.id}", "tags": json.dumps(dict(t), ensure_ascii=False), "geometry": g})

    def way(self, w):
        t = w.tags
        if t.get("natural") == "tree_row" or ("playground" in t and t.get("leisure") != "playground" and not w.is_closed()) \
                or (t.get("amenity") == "bench"):
            try:
                g = wkb.loads(fab.create_linestring(w), hex=True)
            except Exception:
                return
            x, y = g.representative_point().coords[0]
            if inb(x, y):
                d = "treerow" if t.get("natural") == "tree_row" else ("seat" if t.get("amenity") == "bench" else "equipment")
                L[d].append({"osm": f"w{w.id}", "tags": json.dumps(dict(t), ensure_ascii=False), "geometry": g})

    def area(self, a):
        t = a.tags
        d = None
        if t.get("leisure") == "playground":
            d = "playground"
        elif t.get("boundary") == "administrative" and t.get("admin_level") == "9" and t.get("name") in ("Altona", "Eimsbüttel"):
            d = "bezirk"
        elif "building" in t and t.get("building") != "no":
            d = "building"
        elif "playground" in t:
            d = "equipment"
        elif t.get("amenity") in ("school", "kindergarten"):
            d = "school"
        elif t.get("leisure") == "park":
            d = "park"
        elif t.get("natural") == "wood" or t.get("landuse") == "forest":
            d = "wood"
        elif t.get("amenity") == "shelter":
            d = "shelter"
        if not d:
            return
        try:
            g = wkb.loads(fab.create_multipolygon(a), hex=True)
        except Exception:
            return
        x, y = g.representative_point().coords[0]
        if d != "bezirk" and not inb(x, y):
            return
        if d == "building":
            L[d].append({"osm": f"{'w' if a.from_way() else 'r'}{a.orig_id()}", "building": t.get("building"),
                         "height": t.get("height"), "levels": t.get("building:levels"), "roof_levels": t.get("roof:levels"),
                         "min_level": t.get("building:min_level"), "geometry": g})
        else:
            L[d].append({"osm": f"{'w' if a.from_way() else 'r'}{a.orig_id()}", "tags": json.dumps(dict(t), ensure_ascii=False), "geometry": g})


def main():
    H().apply_file(str(P), locations=True, idx="flex_mem")
    for k, v in L.items():
        g = gpd.GeoDataFrame(v, geometry="geometry", crs=4326).to_crs(25832)
        if k == "bezirk":
            g["name"] = [json.loads(x)["name"] for x in g.tags]
        g.to_parquet(B / f"osm_{k}.parquet")
        print(k, len(g))


if __name__ == "__main__":
    main()
