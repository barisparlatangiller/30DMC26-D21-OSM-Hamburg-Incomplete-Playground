"""
Day 21 · The Incomplete Playground · step 3: web data.
  python pipeline/build_web.py
Output docs/data/units.geojson · shade.geojson · ghost.geojson · trees.bin (+ trees.json) · things.json · bezirke.geojson ·
       stats.json · to_check.csv
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd

B, W = Path("build"), Path("docs/data")
W.mkdir(parents=True, exist_ok=True)
Q = ["s_shade", "s_trees", "s_seats", "s_access", "s_equip"]


def tags(s):
    return json.loads(s) if isinstance(s, str) else {}


def to_geojson(g, path, prec=6):
    g = g.to_crs(4326)
    g["geometry"] = g.geometry.set_precision(10 ** -prec)
    path.write_text(g.to_json(drop_id=True, separators=(",", ":")))


def main():
    U = gpd.read_parquet(B / "units.parquet")
    st = json.loads((B / "stats.json").read_text())
    c = U.geometry.representative_point().to_crs(4326)
    keep = ["id", "osm", "bezirk", "cls", "status", "is_point", "name", "reg_name", "area", "n_trees", "n_seats_in", "n_seats_20",
            "n_equip", "equip_list", "shade_tag", "wheelchair", "score", "known", "extra"] + Q + \
           [k for k in ["sh_11", "sh_13", "sh_15", "sh_17", "sh_mean", "shm_15", "can_in", "can_20", "map_20", "unmapped_20"] if k in U]
    g = U[keep + ["geometry"]].copy()
    g["q"] = g[Q].astype(int).astype(str).agg("".join, axis=1)          # e.g. "12020": shade inferred, trees known, …
    g = g.drop(columns=Q)
    g["lon"], g["lat"] = c.x.round(6).values, c.y.round(6).values
    g["geometry"] = g.geometry.simplify(0.5)
    for col in ["name", "reg_name", "shade_tag", "wheelchair", "equip_list"]:
        g[col] = g[col].where(g[col].notna() & (g[col] != ""), None)
    to_geojson(g, W / "units.geojson")
    print("units", len(g), round((W / "units.geojson").stat().st_size / 1e6, 2), "MB")
    if (B / "shade_polys.parquet").exists():
        s = gpd.read_parquet(B / "shade_polys.parquet")
        to_geojson(s, W / "shade.geojson")
    if (B / "ghost_canopy.parquet").exists():
        s = gpd.read_parquet(B / "ghost_canopy.parquet")
        s["geometry"] = s.geometry.simplify(1.0)
        to_geojson(s, W / "ghost.geojson")
    t = gpd.read_parquet(B / "trees_near.parquet").to_crs(4326)
    T = np.zeros(len(t), dtype=[("lon", "<f4"), ("lat", "<f4"), ("crown", "<f4"), ("h", "<f4"), ("src", "<f4")])
    T["lon"], T["lat"] = t.geometry.x.values, t.geometry.y.values
    T["crown"], T["h"], T["src"] = t.crown.values, t.h.values, (t.src == "osm").astype(float).values
    T.tofile(W / "trees.bin")
    (W / "trees.json").write_text(json.dumps({"n": len(t), "fields": ["lon", "lat", "crown", "h", "src(0 register,1 osm)"]}))
    # benches + equipment near units
    buf = gpd.GeoDataFrame(geometry=U.geometry.buffer(25), crs=25832)
    th = {}
    for k in ["seat", "equipment"]:
        o = gpd.read_parquet(B / f"osm_{k}.parquet")
        o = o[o.intersects(buf.union_all())]
        p = o.geometry.representative_point().to_crs(4326)
        th[k] = [[round(x, 6), round(y, 6), (tags(tt).get("playground") or tags(tt).get("amenity") or tags(tt).get("leisure") or "")]
                 for x, y, tt in zip(p.x, p.y, o.tags)]
    (W / "things.json").write_text(json.dumps(th, separators=(",", ":")))
    # LoD2 buildings (real heights, the ones used for shade) within 80 m of every playground
    if (B / "lod2.parquet").exists():
        lb = gpd.read_parquet(B / "lod2.parquet")
        lb = lb[lb.intersects(U.geometry.buffer(80).union_all())].copy()
        lb["geometry"] = lb.geometry.simplify(0.6)
        lb["h"] = lb.h.round(1)
        to_geojson(lb[["h", "geometry"]], W / "buildings.geojson")
        print("buildings", len(lb), round((W / "buildings.geojson").stat().st_size / 1e6, 1), "MB")
    bz = gpd.read_parquet(B / "osm_bezirk.parquet")[["name", "geometry"]]
    bz["geometry"] = bz.geometry.simplify(10)
    to_geojson(bz, W / "bezirke.geojson", 5)
    st["story"] = {"ghost": "osm:w137433774", "shade": "osm:w32791029"}
    (W / "stats.json").write_text(json.dumps(st, ensure_ascii=False, separators=(",", ":")))
    # list to check on site (public playgrounds, ranked by how little the map knows, largest first)
    L = U[U.cls == "public"].copy()
    L["missing"] = L.apply(lambda r: ", ".join(n for n, q in zip(["shade", "trees", "seating", "wheelchair", "equipment"], [r[k] for k in Q]) if q < 2), axis=1)
    L["osm_link"] = L.osm.apply(lambda o: None if not isinstance(o, str) else f"https://www.openstreetmap.org/{ {'n': 'node', 'w': 'way', 'r': 'relation'}[o[0]] }/{o[1:]}")
    L["lon"], L["lat"] = c[L.index].x.round(6), c[L.index].y.round(6)
    L["note"] = np.where(L.status == "register_only", "not mapped as leisure=playground — check on site", np.where(L.is_point, "mapped as a point only", ""))
    L = L.sort_values(["known", "area"], ascending=[True, False])
    L[["id", "bezirk", "name", "reg_name", "status", "known", "missing", "note", "area", "lat", "lon", "osm_link"]].to_csv(W / "to_check.csv", index=False)
    print("to_check", len(L))


if __name__ == "__main__":
    main()
