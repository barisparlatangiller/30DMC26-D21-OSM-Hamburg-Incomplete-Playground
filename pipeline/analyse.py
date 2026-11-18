"""
Day 21 · The Incomplete Playground · step 2: what the map knows, what we can infer, what nobody wrote down.

Units
  · every OSM playground in Altona + Eimsbüttel (area or point), with access class public / school-kita / private
  · every official public playground of the Grünanlagen register (gruen_art = Spielplätze) that has no OSM playground within 10 m
Match OSM ↔ register with a 10 m buffer; OSM-only public playgrounds get a context (school/kita grounds, park, other).

Five questions per playground, each answered as  known (a tag in OSM) · inferred (from nearby mapped things) · NULL:
  shade   known: shade=* / covered=*            inferred: simulated shade share, 15 July (11, 13, 15, 17 h CEST)
  trees   known: a mapped tree inside or ≤ 20 m (street-tree register, OSM trees, tree rows, woods)
  seats   known: bench / picnic table inside or bench=yes      inferred: a bench ≤ 20 m outside
  access  known: wheelchair=*
  equip   known: playground:*=* tags or ≥ 1 equipment feature inside
Score: known 1 · inferred 0.5 · NULL 0 (max 5).

Shade: 1 m height grid around each playground (+70 m) from buildings (LoD2 height if present in build/lod2.parquet, else
OSM height / building:levels × 3 m + roof, else a type default) and tree crowns (register crown diameter; OSM crown or 7 m;
height ≈ 1.3 × crown + 3 m). A ground cell is shaded if anything along the line towards the sun rises above the sun ray.
  python pipeline/analyse.py
Output build/units.parquet · build/shade_polys.parquet · build/trees_near.parquet · build/stats.json
"""
import json, math, time
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd
import shapely
from shapely.geometry import box, Point
import rasterio.features as rf
from rasterio.transform import from_origin
import pvlib

B = Path("build"); I = Path("input")
R20 = 20.0
PUBLIC = {None, "yes", "public", "permissive"}
TIMES = ["11:00", "13:00", "15:00", "17:00"]
HDEF = {"house": 8, "detached": 8, "semidetached_house": 8, "terrace": 9, "bungalow": 4, "garage": 3, "garages": 3, "shed": 2.5,
        "carport": 2.5, "roof": 4, "hut": 3, "kiosk": 3, "apartments": 15, "residential": 14, "commercial": 15, "office": 18,
        "retail": 8, "industrial": 9, "warehouse": 9, "school": 12, "kindergarten": 6, "church": 18, "hospital": 18,
        "university": 15, "service": 4, "greenhouse": 3, "train_station": 10}


def tags(s):
    return json.loads(s) if isinstance(s, str) else {}


def _num(v, levels=False):
    if v is None or (isinstance(v, float) and np.isnan(v)) or str(v).strip() == "":
        return None
    try:
        return float(str(v).lower().replace("m", "").replace(",", ".").split(";")[0])
    except ValueError:
        return None


def bheight(r):
    v = _num(r.get("lod2_h"))
    if v:
        return v
    v = _num(r.get("height"))
    if v:
        return v
    lv = _num(r.get("levels"))
    if lv is not None:
        return lv * 3.0 + (_num(r.get("roof_levels")) or 0) * 2.0 + 1.0
    return float(HDEF.get(r.get("building"), 10))


def load_trees(study):
    t = np.fromfile(I / "d13_trees.bin", dtype=[("lon", "<f4"), ("lat", "<f4"), ("r", "<u2")])
    st = gpd.GeoDataFrame({"crown": t["r"] / 10 * 2, "src": "register"}, geometry=gpd.points_from_xy(t["lon"], t["lat"]), crs=4326).to_crs(25832)
    st = st[st.intersects(study)]
    o = gpd.read_parquet(B / "osm_tree.parquet")
    o = o[o.intersects(study)]
    tg = [tags(x) for x in o.tags]
    def num(d, k):
        try:
            return float(str(d.get(k, "")).replace("m", "").replace(",", "."))
        except ValueError:
            return np.nan
    o = gpd.GeoDataFrame({"crown": [num(d, "diameter_crown") for d in tg], "h_tag": [num(d, "height") for d in tg], "src": "osm"},
                         geometry=o.geometry.values, crs=25832)
    # drop OSM trees that duplicate a register tree (≤ 3 m)
    j = gpd.sjoin_nearest(o, st[["geometry"]], max_distance=3, how="left")
    dup = j.index_right.notna().groupby(level=0).any()
    o = o[~dup.reindex(o.index, fill_value=False).values]
    o["crown"] = o.crown.where(o.crown.between(1, 30), 7.0)
    T = pd.concat([st, o], ignore_index=True)
    T["h"] = np.where(T.get("h_tag").notna() & T.get("h_tag").between(2, 40), T.get("h_tag"), np.clip(1.3 * T.crown + 3, 5, 28))
    return gpd.GeoDataFrame(T[["crown", "h", "src", "geometry"]], geometry="geometry", crs=25832)


def sun():
    tt = pd.DatetimeIndex([f"2026-07-15 {h}" for h in TIMES], tz="Europe/Berlin")
    sp = pvlib.solarposition.get_solarposition(tt, 53.57, 9.95)
    return [(float(a), float(e)) for a, e in zip(sp.azimuth, sp.apparent_elevation)]


def shade_window(geom, bld, trees, suns):
    x0, y0, x1, y1 = geom.buffer(70).bounds
    x0, y0 = math.floor(x0), math.floor(y0)
    W, H = int(math.ceil(x1 - x0)), int(math.ceil(y1 - y0))
    tr = from_origin(x0, y0 + H, 1, 1)
    win = box(x0, y0, x0 + W, y0 + H)
    dsm = np.zeros((H, W), np.float32)
    bb = bld.iloc[bld.sindex.query(win)]
    if len(bb):
        dsm = rf.rasterize(((g, h) for g, h in zip(bb.geometry, bb.h)), out_shape=(H, W), transform=tr, fill=0, dtype="float32",
                           merge_alg=rf.MergeAlg.replace)
    inb = dsm > 0
    tt = trees.iloc[trees.sindex.query(win)]
    if len(tt):
        tdsm = rf.rasterize(((p.buffer(c / 2, 8), h) for p, c, h in zip(tt.geometry, tt.crown, tt.h)), out_shape=(H, W), transform=tr,
                            fill=0, dtype="float32")
        dsm = np.maximum(dsm, tdsm)
    pm = rf.rasterize([(geom, 1)], out_shape=(H, W), transform=tr, fill=0, dtype="uint8").astype(bool) & ~inb
    if pm.sum() == 0:
        pm = rf.rasterize([(geom.buffer(1.5), 1)], out_shape=(H, W), transform=tr, fill=0, dtype="uint8").astype(bool) & ~inb
    out = []
    for az, el in suns:
        dx, dy = math.sin(math.radians(az)), math.cos(math.radians(az))     # towards the sun, east / north
        tn = math.tan(math.radians(el))
        sh = np.zeros((H, W), bool)
        for k in range(1, 70):
            ox, oy = int(round(dx * k)), int(round(-dy * k))                  # row axis points south
            if abs(ox) >= W or abs(oy) >= H:
                break
            src = dsm[max(0, oy):H + min(0, oy), max(0, ox):W + min(0, ox)]
            tgt = (slice(max(0, -oy), H - max(0, oy)), slice(max(0, -ox), W - max(0, ox)))
            sh[tgt] |= src > k * tn
        sh |= (dsm > 0) & ~inb                                                 # under a crown
        out.append(sh)
    fr = [float((s & pm).sum() / max(pm.sum(), 1)) for s in out]
    s15 = out[TIMES.index("15:00")] & pm
    polys = [shapely.geometry.shape(g) for g, v in rf.shapes(s15.astype("uint8"), mask=s15, transform=tr) if v == 1]
    poly = shapely.union_all(polys).simplify(0.6) if polys else None
    return fr, poly


def main():
    t0 = time.time()
    bz = gpd.read_parquet(B / "osm_bezirk.parquet")
    study = bz.union_all()
    pg = gpd.read_parquet(B / "osm_playground.parquet")
    pg = pg[pg.representative_point().within(study)].reset_index(drop=True)
    pg["t"] = [tags(x) for x in pg.tags]
    pg["bezirk"] = [bz.name.iloc[int(np.argmax([b.contains(p) for b in bz.geometry]))] for p in pg.representative_point()]
    pg["is_point"] = pg.geom_type == "Point"
    pg["geometry"] = gpd.GeoSeries(np.where(pg.is_point, pg.geometry.buffer(8), pg.geometry), index=pg.index, crs=25832)
    pg = pg.set_geometry("geometry")
    sch = gpd.read_parquet(B / "osm_school.parquet")
    pg["in_school"] = pg.representative_point().apply(lambda p: bool(len(sch.sindex.query(p, predicate="within"))))
    acc = [d.get("access") for d in pg.t]
    pg["cls"] = np.where(pg.in_school, "school", np.where([a in PUBLIC for a in acc], "public", "private"))
    # register
    gr = gpd.read_file(I / "gruenanlagen.json").set_crs(25832, allow_override=True)   # file is 25832, GeoJSON reader assumes 4326
    reg = gr[(gr.gruen_art == "Spielplätze") & gr.bezirk.isin(["Altona", "Eimsbüttel"])].reset_index(drop=True)
    parks = gr[gr.gruen_art.isin(["Parkanlagen", "Allgemeines Grün"])]
    osmparks = gpd.read_parquet(B / "osm_park.parquet")
    hit = gpd.sjoin(pg[["geometry"]], gpd.GeoDataFrame(geometry=reg.geometry.buffer(10), crs=25832), predicate="intersects")
    pg["reg"] = hit.groupby(level=0).index_right.first().reindex(pg.index)
    rp = pg.representative_point()
    inpark = gpd.sjoin(gpd.GeoDataFrame(geometry=rp), pd.concat([parks[["geometry"]], osmparks[["geometry"]]]), predicate="within")
    pg["in_park"] = pg.index.isin(inpark.index)
    pg["status"] = np.select([pg.reg.notna(), pg.cls == "school", pg.cls == "private", pg.in_park], ["both", "school", "private", "osm_park"], "osm_other")
    matched = set(pg.reg.dropna().astype(int))
    miss = reg[~reg.index.isin(matched)].copy()
    print(f"OSM {len(pg)} ({pg.cls.value_counts().to_dict()}), register {len(reg)}, register without OSM {len(miss)}", flush=True)
    # helper layers
    eq = gpd.read_parquet(B / "osm_equipment.parquet")
    seat = gpd.read_parquet(B / "osm_seat.parquet")
    trees = load_trees(study.buffer(200))
    rows = gpd.read_parquet(B / "osm_treerow.parquet"); woods = gpd.read_parquet(B / "osm_wood.parquet")
    bld = gpd.read_parquet(B / "osm_building.parquet")
    if (B / "lod2.parquet").exists():
        l2 = gpd.read_parquet(B / "lod2.parquet")
        bld = l2.rename(columns={"h": "lod2_h"})
        for c in ["height", "levels", "roof_levels", "building"]:
            bld[c] = None
        print("buildings: LoD2", len(bld))
    bld["h"] = [bheight(r) for r in bld.to_dict("records")]
    bld = bld[bld.h > 1.5].reset_index(drop=True)
    print(f"trees {len(trees)} ({trees.src.value_counts().to_dict()}), buildings {len(bld)}  [{time.time() - t0:.0f} s]", flush=True)
    suns = sun()
    print("sun", suns)

    U = []
    def common(g, t):
        d = {}
        z = g.buffer(R20)
        d["n_trees"] = int(len(trees.sindex.query(z, predicate="intersects")) + len(rows.sindex.query(z, predicate="intersects"))
                           + len(woods.sindex.query(z, predicate="intersects")))
        si = seat.sindex.query(g.buffer(1), predicate="intersects"); so = seat.sindex.query(z, predicate="intersects")
        d["n_seats_in"], d["n_seats_20"] = int(len(si)), int(len(set(so) - set(si)))
        ei = eq.sindex.query(g.buffer(1), predicate="intersects")
        d["equip_list"] = sorted({tags(eq.tags.iloc[i]).get("playground", "?") for i in ei})
        d["n_equip"] = int(len(ei))
        return d
    for i, r in pg.iterrows():
        t = r.t; g = r.geometry
        d = {"id": f"osm:{r.osm}", "osm": r.osm, "bezirk": r.bezirk, "cls": r.cls, "status": r.status, "is_point": bool(r.is_point),
             "name": t.get("name"), "geometry": g, "area": round(g.area) if not r.is_point else None}
        d.update(common(g, t))
        ptags = {k: v for k, v in t.items() if k.startswith("playground:")}
        d["shade_tag"] = t.get("shade") or t.get("covered")
        d["wheelchair"] = t.get("wheelchair")
        d["s_shade"] = 2 if d["shade_tag"] else 1
        d["s_trees"] = 2 if d["n_trees"] else 0
        d["s_seats"] = 2 if (d["n_seats_in"] or t.get("bench") == "yes") else (1 if d["n_seats_20"] else 0)
        d["s_access"] = 2 if d["wheelchair"] else 0
        d["s_equip"] = 2 if (ptags or d["n_equip"]) else 0
        d["equip_list"] = sorted(set(d["equip_list"]) | {k.split(":", 1)[1] for k, v in ptags.items() if v not in ("no",)})
        d["extra"] = {k: t[k] for k in ["surface", "min_age", "max_age", "operator", "opening_hours", "lit", "check_date", "description", "access"] if k in t}
        d["reg_id"] = reg.idnr.iloc[int(r.reg)] if pd.notna(r.reg) else None
        d["reg_name"] = reg.belegenheit.iloc[int(r.reg)] if pd.notna(r.reg) else None
        U.append(d)
    for _, r in miss.iterrows():
        g = r.geometry
        d = {"id": f"reg:{r.idnr}", "osm": None, "bezirk": r.bezirk, "cls": "public", "status": "register_only", "is_point": False,
             "name": None, "geometry": g, "area": round(g.area), "reg_id": r.idnr, "reg_name": r.belegenheit, "extra": {},
             "shade_tag": None, "wheelchair": None}
        d.update(common(g, {}))
        d.update({"s_shade": 1, "s_trees": 0, "s_seats": 0, "s_access": 0, "s_equip": 0})
        U.append(d)
    U = gpd.GeoDataFrame(U, geometry="geometry", crs=25832)
    print(f"units {len(U)}  [{time.time() - t0:.0f} s]", flush=True)
    # shade
    SH, PO = [], []
    for k, (g, cls) in enumerate(zip(U.geometry, U.cls)):
        fr, poly = shade_window(g, bld, trees, suns)
        SH.append(fr); PO.append(poly)
        if k % 100 == 0:
            print(f"  shade {k}/{len(U)}  [{time.time() - t0:.0f} s]", flush=True)
    SH = np.array(SH)
    for j, h in enumerate(TIMES):
        U[f"sh_{h[:2]}"] = np.round(SH[:, j], 3)
    U["sh_mean"] = np.round(SH.mean(1), 3)
    w = {2: 1.0, 1: 0.5, 0: 0.0}
    U["score"] = sum(U[c].map(w) for c in ["s_shade", "s_trees", "s_seats", "s_access", "s_equip"])
    U["known"] = sum((U[c] == 2).astype(int) for c in ["s_shade", "s_trees", "s_seats", "s_access", "s_equip"])
    U["extra"] = U.extra.apply(lambda d: json.dumps(d, ensure_ascii=False))
    U["equip_list"] = U.equip_list.apply(lambda l: ",".join(l))
    U.to_parquet(B / "units.parquet")
    gpd.GeoDataFrame({"id": U.id}, geometry=PO, crs=25832).dropna().to_parquet(B / "shade_polys.parquet")
    near = trees.iloc[np.unique(np.concatenate([trees.sindex.query(g.buffer(60)) for g in U.geometry]))]
    near.to_parquet(B / "trees_near.parquet")
    pub = U[U.cls == "public"]
    st = {"n_osm": int((U.status != "register_only").sum()), "cls": U[U.status != "register_only"].cls.value_counts().to_dict(),
          "status": U.status.value_counts().to_dict(), "n_register": int(len(reg)), "register_matched": int(len(matched)),
          "register_only": int(len(miss)), "sun": suns, "times": TIMES,
          "public_known_share": {c: round(float((pub[c] == 2).mean()), 3) for c in ["s_shade", "s_trees", "s_seats", "s_access", "s_equip"]},
          "public_seat_inferred": round(float((pub.s_seats == 1).mean()), 3),
          "public_score_mean": round(float(pub.score.mean()), 2), "public_known_hist": pub.known.value_counts().sort_index().to_dict(),
          "public_points": int(pub.is_point.sum()), "public_named": round(float(pub.name.notna().mean()), 3),
          "public_shade15_median": round(float(pub.sh_15.median()), 3),
          "public_shade15_lt20": int((pub.sh_15 < 0.2).sum()), "public_no_tree_20m": int((pub.n_trees == 0).sum()),
          "by_bezirk": {b: {"public": int(((U.bezirk == b) & (U.cls == "public")).sum()),
                            "score": round(float(pub[pub.bezirk == b].score.mean()), 2)} for b in ["Altona", "Eimsbüttel"]},
          "trees": trees.src.value_counts().to_dict(), "buildings": int(len(bld)), "lod2": bool((B / "lod2.parquet").exists())}
    (B / "stats.json").write_text(json.dumps(st, indent=1, ensure_ascii=False, default=int))
    print(json.dumps(st, indent=1, ensure_ascii=False, default=int))
    print(f"done {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
