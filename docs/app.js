/* Day 21 · The Incomplete Playground · Hamburg Altona + Eimsbüttel */
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const Q = ["shade", "trees", "seats", "access", "equip"];
const QC = { shade: [79, 127, 140], trees: [108, 154, 88], seats: [196, 138, 66], access: [125, 109, 176], equip: [208, 103, 79] };
const QI = { shade: "☂", trees: "♣", seats: "▬", access: "♿", equip: "◭" };
const RAMP_K = ["#efe1cb", "#d8e6dc", "#aed0c3", "#7cb0a3", "#4b897f", "#2a625b"];
const RAMP_S = [[0, "#f2cc63"], [0.25, "#dcc78c"], [0.5, "#a3b5a6"], [0.75, "#65858f"], [1, "#384f5e"]];
const RAMP_C = [[0, "#efefe6"], [0.08, "#d5e3c6"], [0.2, "#a6c78f"], [0.4, "#6e9a5c"], [0.7, "#456f3b"]];
const S = { lang: "en", mode: "story", colour: "known", hour: "15", vis: { public: 1, register_only: 1, school: 1, private: 0, rings: 1, trees: 1, ghost: 1, shadow: 1, things: 1 }, sel: null, step: 0, zoom: 12 };
try { const l = localStorage.getItem("d21lang"); if (l) S.lang = l; } catch (e) {}
let map, overlay, U, P, ST, TREES, TH, BYID = {};

// ---------------- text ----------------
const T = {
  en: {
    title: "The Incomplete Playground", sub: "What does the map know about Hamburg's playgrounds?", story: "Story", explore: "Explore",
    fiveq: "Five questions, five answers", st2: "In the map", st1: "Inferred", colourby: "Colour playgrounds by",
    c_known: "What the map knows", c_shade: "Shade", c_canopy: "Unmapped trees", show: "Show",
    l_public: "Public playgrounds", l_reg: "Official, not in OSM", l_school: "School & kita grounds", l_private: "Private (housing estates)",
    l_rings: "Answer rings", l_trees: "Mapped trees (3D)", l_ghost: "Tree canopy the map doesn't know", l_shadow: "Shade at 15:00 (15 July)", l_things: "Benches & equipment",
    h_method: "Method", h_limits: "Limits", h_sources: "Sources", dl: "⬇ List of playgrounds to check on site (CSV)", skip: "Explore the map yourself →",
    q: { shade: "Shade", trees: "Trees", seats: "Seating", access: "Wheelchair", equip: "Equipment" },
    k1: "public playgrounds in Altona + Eimsbüttel", k2: "of the official ones are on the map", k3: "answer none of the five questions", k4: "have shade tagged",
    r_known: ["knows nothing", "knows 5/5"], r_shade: ["sunny", "in shade"], r_canopy: ["map knows the trees", "many unmapped trees"],
    status: { both: "In OpenStreetMap and in the official register", osm_other: "In OpenStreetMap only (not in the register)", osm_park: "In OpenStreetMap, inside a park",
      school: "School or kita grounds", private: "Private playground (housing estate)", register_only: "Official playground, not mapped as one in OpenStreetMap" },
    unnamed: "Unnamed playground", point: "mapped as a point only", area: "m²",
    ev: {
      shade2: v => `Tagged: shade=${v}`,
      shade1: (a, b) => `No shade tag. Simulated: <b>${a}</b> of the playground is in shade at 15:00 on 15 July (only <b>${b}</b> if just the mapped trees and buildings count).`,
      shade1n: a => `No shade tag. Simulated: <b>${a}</b> in shade at 15:00 on 15 July.`,
      trees2: n => `${n} mapped tree${n === 1 ? "" : "s"} (or tree rows / woods) inside or within 20 m.`,
      trees0: "No mapped tree inside or within 20 m.", can: a => ` Satellite canopy covers <b>${a}</b> of that area.`,
      seats2: n => `${n} bench${n === 1 ? "" : "es"} / picnic table${n === 1 ? "" : "s"} mapped inside.`, seats1: n => `None inside, but ${n} mapped within 20 m.`, seats0: "No bench mapped inside or within 20 m.",
      access2: v => `Tagged: wheelchair=${v}`, access0: "No wheelchair tag.", equip2: l => `Mapped: ${l}`, equip0: "No equipment mapped (no playground=* features or tags)."
    },
    osm: "Open in OpenStreetMap", edit: "Check / edit (iD)", tipk: (n) => `knows ${n}/5`
  },
  tr: {
    title: "Eksik Oyun Parkı", sub: "Harita, Hamburg'un oyun parkları hakkında ne biliyor?", story: "Hikâye", explore: "Keşfet",
    fiveq: "Beş soru, beş cevap", st2: "Haritada var", st1: "Tahmin", colourby: "Oyun parklarını renklendir",
    c_known: "Haritanın bildiği", c_shade: "Gölge", c_canopy: "Haritada olmayan ağaçlar", show: "Göster",
    l_public: "Kamuya açık oyun parkları", l_reg: "Resmi listede var, OSM'de yok", l_school: "Okul ve kreş bahçeleri", l_private: "Özel (site içi)",
    l_rings: "Cevap halkaları", l_trees: "Haritadaki ağaçlar (3B)", l_ghost: "Haritanın bilmediği ağaç örtüsü", l_shadow: "15:00'te gölge (15 Temmuz)", l_things: "Banklar ve ekipman",
    h_method: "Yöntem", h_limits: "Sınırlar", h_sources: "Kaynaklar", dl: "⬇ Yerinde kontrol edilecek parklar listesi (CSV)", skip: "Haritayı kendin keşfet →",
    q: { shade: "Gölge", trees: "Ağaç", seats: "Oturma", access: "Erişilebilirlik", equip: "Ekipman" },
    k1: "kamuya açık oyun parkı (Altona + Eimsbüttel)", k2: "resmi parkların haritadaki oranı", k3: "beş sorunun hiçbirini cevaplamıyor", k4: "gölge etiketi olan",
    r_known: ["hiçbir şey bilmiyor", "5/5 biliyor"], r_shade: ["güneşli", "gölgede"], r_canopy: ["ağaçları biliyor", "çok ağaç eksik"],
    status: { both: "OpenStreetMap'te ve resmi listede var", osm_other: "Sadece OpenStreetMap'te var (resmi listede yok)", osm_park: "OpenStreetMap'te, bir parkın içinde",
      school: "Okul ya da kreş bahçesi", private: "Özel oyun parkı (site içi)", register_only: "Resmi oyun parkı, OpenStreetMap'te oyun parkı olarak çizilmemiş" },
    unnamed: "İsimsiz oyun parkı", point: "sadece nokta olarak çizilmiş", area: "m²",
    ev: {
      shade2: v => `Etiket: shade=${v}`,
      shade1: (a, b) => `Gölge etiketi yok. Hesap: 15 Temmuz saat 15:00'te parkın <b>${a}</b> kısmı gölgede (yalnızca haritadaki ağaç ve binalar sayılırsa <b>${b}</b>).`,
      shade1n: a => `Gölge etiketi yok. Hesap: 15 Temmuz 15:00'te <b>${a}</b> gölgede.`,
      trees2: n => `İçinde ya da 20 m çevresinde haritada ${n} ağaç (ya da ağaç dizisi / koru) var.`,
      trees0: "İçinde ya da 20 m çevresinde haritada ağaç yok.", can: a => ` Uydu verisine göre bu alanın <b>${a}</b> kısmını ağaç örtüyor.`,
      seats2: n => `İçinde ${n} bank / piknik masası var.`, seats1: n => `İçinde yok, ama 20 m çevresinde ${n} bank var.`, seats0: "İçinde ya da 20 m çevresinde bank yok.",
      access2: v => `Etiket: wheelchair=${v}`, access0: "Erişilebilirlik (wheelchair) etiketi yok.", equip2: l => `Haritada: ${l}`, equip0: "Ekipman çizilmemiş (playground=* nesnesi ya da etiketi yok)."
    },
    osm: "OpenStreetMap'te aç", edit: "Kontrol et / düzenle (iD)", tipk: (n) => `${n}/5 biliyor`
  }
};
const EQ = { en: { swing: "swing", slide: "slide", sandpit: "sandpit", climbingframe: "climbing frame", springy: "springy", seesaw: "seesaw", roundabout: "roundabout", structure: "play structure", basketswing: "basket swing", playhouse: "playhouse", water: "water play", zipwire: "zip wire", table: "table", sand: "sand" },
  tr: { swing: "salıncak", slide: "kaydırak", sandpit: "kum havuzu", climbingframe: "tırmanma", springy: "yaylı oyuncak", seesaw: "tahterevalli", roundabout: "döner tabla", structure: "oyun kulesi", basketswing: "kuş yuvası salıncak", playhouse: "oyun evi", water: "su oyunu", zipwire: "teleferik", table: "masa", sand: "kum" } };
const t = k => T[S.lang][k];
const pct = v => v == null || isNaN(v) ? "–" : Math.round(v * 100) + "%";

function textBlocks() {
  const s = ST, en = S.lang === "en";
  const sh = s.public_shade15_median, shm = s.public_shade15_map_median, can = (s.canopy || {});
  T.en.method = `<p>Every playground in OpenStreetMap (<code>leisure=playground</code>, Geofabrik extract of 16 Nov 2026) inside the boroughs Altona and Eimsbüttel, plus every playground of the city's register of public green spaces (<i>Verzeichnis der öffentlichen Grünanlagen</i>, <code>gruen_art = Spielplätze</code>) that has no OSM playground within 10 m.</p>
<p>Each playground answers five questions. <b>In the map</b>: a tag or a mapped feature says it (shade=*/covered=*; a mapped tree inside or ≤ 20 m; a bench inside; wheelchair=*; playground=* equipment). <b>Inferred</b>: only nearby things hint at it (a bench ≤ 20 m outside; shade from a simulation). <b>NULL</b>: nothing.</p>
<p>Shade: 1 m height grid from OSM buildings (height, or building:levels × 3 m) and tree crowns (street-tree register crown diameter, OSM trees), plus the satellite canopy height map where it is ≥ 2.5 m. A cell is shaded when something along the line to the sun rises above the sun ray (15 July 2026, 11/13/15/17 h CEST). Unmapped canopy: canopy ≥ 3 m within 20 m that no mapped crown covers.</p>`;
  T.tr.method = `<p>Altona ve Eimsbüttel bezirklerindeki OpenStreetMap'te kayıtlı tüm oyun parkları (<code>leisure=playground</code>, 16 Kasım 2026 tarihli Geofabrik verisi). Bunlara ek olarak, şehrin kamu yeşil alanları kataloğunda (<i>Verzeichnis der öffentlichen Grünanlagen</i>, <code>gruen_art = Spielplätze</code>) olup 10 m içinde OSM karşılığı bulunmayan oyun parkları.</p>
<p>Her park beş soruya cevap verir. <b>Haritada var</b>: bir etiket ya da çizilmiş bir nesne bunu söylüyor (shade=*/covered=*; içinde ya da ≤ 20 m'de çizilmiş bir ağaç; içinde bir bank; wheelchair=*; playground=* ekipman). <b>Tahmin</b>: sadece yakındaki nesneler ipucu veriyor (dışarıda ≤ 20 m'de bank; gölge simülasyonu). <b>NULL</b>: hiçbir bilgi yok.</p>
<p>Gölge: OSM binaları (height ya da building:levels × 3 m), ağaç taçları (sokak ağacı kataloğu, OSM ağaçları) ve ≥ 2,5 m olan yerlerde uydu tabanlı ağaç yüksekliği haritasından 1 m'lik bir yükseklik ızgarası. Güneşe doğru giden hatta güneş ışınının üstüne çıkan bir şey varsa hücre gölgede sayılır (15 Temmuz 2026, 11/13/15/17 CEST). Haritada olmayan ağaç örtüsü: 20 m içinde, hiçbir çizilmiş tacın örtmediği ≥ 3 m'lik örtü.</p>`;
  T.en.limits = `<p><b>A missing tag is not a missing swing.</b> NULL means the map does not say it, not that the thing is absent. Only verified, on-site information belongs in OpenStreetMap; the CSV is a list of places to check, not a list of edits.</p>
<p>Being near a tree does not prove shade. The simulation treats crowns as solid and buildings as flat-roofed blocks, ignores terrain and leaf density, and uses one summer day. The satellite canopy map (≈1 m, AI-derived) can miss young trees and merge neighbours.</p>
<p>The official register and OSM define a playground differently (the register lists a playground inside a park as part of the park; OSM maps school and kita grounds, which the register does not). Matching uses a 10 m buffer.</p>`;
  T.tr.limits = `<p><b>Eksik etiket, eksik salıncak demek değildir.</b> NULL, haritanın bu konuda bir şey söylemediği anlamına gelir; o şeyin orada olmadığı anlamına gelmez. OpenStreetMap'e yalnızca yerinde doğrulanmış bilgi eklenmelidir. CSV dosyası bir düzenleme listesi değil, yerinde kontrol edilecek yerlerin listesidir.</p>
<p>Ağaca yakın olmak gölgeyi kanıtlamaz. Simülasyon tacı katı bir cisim, binaları düz çatılı bloklar olarak alır; arazi eğimini ve yaprak yoğunluğunu yok sayar ve tek bir yaz gününe bakar. Uydu tabanlı ağaç örtüsü haritası (≈1 m, yapay zekâ ile üretilmiş) genç ağaçları kaçırabilir ve yan yana ağaçları birleştirebilir.</p>
<p>Resmi liste ile OSM oyun parkını farklı tanımlar: resmi liste park içindeki oyun alanını parkın parçası sayar, OSM ise resmi listede olmayan okul ve kreş bahçelerini de çizer. Eşleştirme 10 m'lik tamponla yapıldı.</p>`;
  const src = `<p>OpenStreetMap contributors, ODbL — Geofabrik Hamburg extract, 16 Nov 2026.<br>
FHH, BUKEA — Verzeichnis der öffentlichen Grünanlagen (Digitaler Grünplan), Datenlizenz Deutschland – Namensnennung 2.0.<br>
FHH, BUKEA — Straßenbaumkataster Hamburg (street trees), DL-DE-BY-2.0.<br>
Meta & World Resources Institute — High Resolution Canopy Height Maps (Tolan et al. 2024), CC BY 4.0.<br>
FHH — Hamburgs 100 beliebteste Spielplätze (only used to check names).<br>
Basemap: OpenFreeMap © OpenMapTiles © OpenStreetMap. Sun position: pvlib.</p>`;
  T.en.sources = src; T.tr.sources = src;
}

// ---------------- data ----------------
const cat = p => p.status === "register_only" ? "register_only" : p.cls;
async function load() {
  const j = u => fetch(u).then(r => r.json());
  [U, ST, TH] = await Promise.all([j("data/units.geojson"), j("data/stats.json"), j("data/things.json")]);
  const tb = await fetch("data/trees.bin").then(r => r.arrayBuffer());
  const f = new Float32Array(tb), n = f.length / 5;
  TREES = { n, pos: new Float32Array(n * 3), sc: new Float32Array(n * 3), tpos: new Float32Array(n * 3), tsc: new Float32Array(n * 3), col: new Uint8Array(n * 4) };
  for (let i = 0; i < n; i++) {
    const lon = f[5 * i], lat = f[5 * i + 1], cr = f[5 * i + 2], h = f[5 * i + 3], osm = f[5 * i + 4] > 0.5;
    const rz = Math.min(cr * 0.45, h * 0.42), cz = h - rz, trunk = Math.max(1, cz - rz * 0.6);
    TREES.pos.set([lon, lat, cz], 3 * i); TREES.sc.set([cr / 2, cr / 2, rz], 3 * i);
    TREES.tpos.set([lon, lat, trunk / 2], 3 * i); TREES.tsc.set([Math.max(0.18, cr * 0.03), Math.max(0.18, cr * 0.03), trunk / 2], 3 * i);
    TREES.col.set(osm ? [132, 168, 104, 255] : [92, 136, 76, 255], 4 * i);
  }
  for (const ft of U.features) { const p = ft.properties; p.cat = cat(p); BYID[p.id] = ft; }
  P = { type: "FeatureCollection", features: U.features.map(ft => ({ type: "Feature", properties: ft.properties, geometry: { type: "Point", coordinates: [ft.properties.lon, ft.properties.lat] } })) };
  textBlocks();
}

// ---------------- meshes + ring icons ----------------
const SPHERE = (() => { const P = [], I = [], LA = 7, LO = 12;
  for (let a = 0; a <= LA; a++) { const th = Math.PI * a / LA; for (let o = 0; o <= LO; o++) { const f = 2 * Math.PI * o / LO; P.push(Math.sin(th) * Math.cos(f), Math.sin(th) * Math.sin(f), Math.cos(th)); } }
  for (let a = 0; a < LA; a++) for (let o = 0; o < LO; o++) { const p = a * (LO + 1) + o, q = p + LO + 1; I.push(p, q, p + 1, q, q + 1, p + 1); }
  return { attributes: { positions: { value: new Float32Array(P), size: 3 }, normals: { value: new Float32Array(P), size: 3 } }, indices: { value: new Uint16Array(I), size: 1 } }; })();
const CYL = (() => { const P = [], N = [], I = [], n = 8;
  for (let k = 0; k <= n; k++) { const f = 2 * Math.PI * k / n, x = Math.cos(f), y = Math.sin(f); P.push(x, y, -1, x, y, 1); N.push(x, y, 0, x, y, 0); }
  for (let k = 0; k < n; k++) { const a = 2 * k; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  return { attributes: { positions: { value: new Float32Array(P), size: 3 }, normals: { value: new Float32Array(N), size: 3 } }, indices: { value: new Uint16Array(I), size: 1 } }; })();

const ICACHE = {};
function arc(cx, cy, r, a0, a1) {
  const p = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function ringIcon(q, known, reg, sel) {
  const key = q + known + (reg ? "r" : "") + (sel ? "s" : "");
  if (ICACHE[key]) return ICACHE[key];
  let body = `<circle cx="48" cy="48" r="44" fill="rgba(255,253,249,${sel ? 0.98 : 0.88})" stroke="${sel ? "#2b2723" : "rgba(80,70,60,.25)"}" stroke-width="${sel ? 3 : 1}"/>`;
  for (let i = 0; i < 5; i++) {
    const a0 = -Math.PI / 2 + i * 2 * Math.PI / 5 + 0.13, a1 = a0 + 2 * Math.PI / 5 - 0.26, s = +q[i], c = QC[Q[i]];
    if (s === 2) body += `<path d="${arc(48, 48, 33, a0, a1)}" stroke="rgb(${c})" stroke-width="13" fill="none" stroke-linecap="butt"/>`;
    else if (s === 1) body += `<path d="${arc(48, 48, 33, a0, a1)}" stroke="rgba(${c},.42)" stroke-width="13" fill="none"/><path d="${arc(48, 48, 33, a0, a1)}" stroke="rgb(${c})" stroke-width="13" fill="none" stroke-dasharray="2.5 3.5"/>`;
    else body += `<path d="${arc(48, 48, 38.5, a0, a1)}" stroke="#a49c91" stroke-width="1.6" fill="none" stroke-dasharray="3 3"/><path d="${arc(48, 48, 27.5, a0, a1)}" stroke="#a49c91" stroke-width="1.6" fill="none" stroke-dasharray="3 3"/>`;
  }
  body += reg ? `<circle cx="48" cy="48" r="17" fill="#fff" stroke="#d0644f" stroke-width="2.5" stroke-dasharray="4 3"/><text x="48" y="56" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="22" fill="#d0644f">?</text>`
    : `<circle cx="48" cy="48" r="17" fill="${RAMP_K[known]}"/><text x="48" y="54.5" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="17" fill="${known >= 3 ? "#fff" : "#4a433c"}">${known}</text>`;
  return ICACHE[key] = { url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${body}</svg>`), width: 96, height: 96, anchorY: 48 };
}

// ---------------- map layers ----------------
function fillExpr() {
  const base = ["match", ["get", "cat"], "school", "#d4dce7", "private", "#dcd8d1", "register_only", "rgba(0,0,0,0)"];
  if (S.colour === "known") return [...base, ["match", ["get", "known"], 0, RAMP_K[0], 1, RAMP_K[1], 2, RAMP_K[2], 3, RAMP_K[3], 4, RAMP_K[4], RAMP_K[5]]];
  if (S.colour === "shade") return [...base, ["interpolate", ["linear"], ["coalesce", ["get", "sh_" + S.hour], 0], ...RAMP_S.flat()]];
  return [...base, ["interpolate", ["linear"], ["coalesce", ["get", "unmapped_20"], 0], ...RAMP_C.flat()]];
}
function visFilter() {
  const cats = ["public", "register_only", "school", "private"].filter(c => S.vis[c]);
  return ["in", ["get", "cat"], ["literal", cats]];
}
function addLayers() {
  const firstSym = map.getStyle().layers.find(l => l.type === "symbol")?.id;
  map.addSource("bz", { type: "geojson", data: "data/bezirke.geojson" });
  map.addLayer({ id: "bz", type: "line", source: "bz", paint: { "line-color": "#9d9284", "line-width": 1.4, "line-dasharray": [3, 2], "line-opacity": 0.8 } }, firstSym);
  map.addSource("u", { type: "geojson", data: U, promoteId: "id" });
  map.addLayer({ id: "u-fill", type: "fill", source: "u", filter: visFilter(), paint: { "fill-color": fillExpr(), "fill-opacity": 0.92 } }, firstSym);
  map.addSource("ghost", { type: "geojson", data: "data/ghost.geojson" });
  map.addLayer({ id: "ghost", type: "fill", source: "ghost", minzoom: 13.5, paint: { "fill-color": "#e6f0dc", "fill-opacity": 0.9 } }, firstSym);
  map.addLayer({ id: "ghost-l", type: "line", source: "ghost", minzoom: 14.5, paint: { "line-color": "#7fa06e", "line-width": 1.2, "line-dasharray": [2, 2] } }, firstSym);
  map.addSource("shade", { type: "geojson", data: "data/shade.geojson" });
  map.addLayer({ id: "shade", type: "fill", source: "shade", minzoom: 14, paint: { "fill-color": "#33495a", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.38] } }, firstSym);
  map.addLayer({ id: "u-line", type: "line", source: "u", filter: ["all", visFilter(), ["!=", ["get", "cat"], "register_only"]],
    paint: { "line-color": ["case", ["boolean", ["feature-state", "sel"], false], "#2b2723", "rgba(70,60,50,.45)"], "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 3, 0.8] } }, firstSym);
  map.addLayer({ id: "u-reg", type: "line", source: "u", filter: ["all", visFilter(), ["==", ["get", "cat"], "register_only"]],
    paint: { "line-color": "#d0644f", "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 3.4, 2], "line-dasharray": [2, 1.5] } }, firstSym);
  map.addSource("pts", { type: "geojson", data: P });
  map.addLayer({ id: "dots", type: "circle", source: "pts", maxzoom: 14.6, filter: visFilter(), paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 12, 3.4, 14, 5.5],
    "circle-color": fillExpr(), "circle-stroke-color": ["match", ["get", "cat"], "register_only", "#d0644f", "rgba(70,60,50,.55)"],
    "circle-stroke-width": ["match", ["get", "cat"], "register_only", 1.8, 0.6], "circle-opacity": ["interpolate", ["linear"], ["zoom"], 14, 1, 14.6, 0] } });
  map.addSource("lod2", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "b3d", type: "fill-extrusion", source: "lod2", minzoom: 14,
    paint: { "fill-extrusion-color": ["interpolate", ["linear"], ["get", "h"], 0, "#ebe6de", 30, "#d9d2c8"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0,
      "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.6, 0.78], "fill-extrusion-vertical-gradient": true } });
  map.addLayer({ id: "ghost3d", type: "fill-extrusion", source: "ghost", minzoom: 15, paint: { "fill-extrusion-color": "#d9ead0", "fill-extrusion-base": 4, "fill-extrusion-height": 11,
    "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.8, 0.38] } });
  for (const l of map.getStyle().layers) if (l.type === "fill-extrusion" && !["b3d", "ghost3d"].includes(l.id)) map.setLayoutProperty(l.id, "visibility", "none");
  const lazy = () => { if (map.getZoom() >= 13.2 && !S.bLoaded) { S.bLoaded = true; map.getSource("lod2").setData("data/buildings.geojson"); } };
  map.on("moveend", lazy); lazy();
}
function restyle() {
  if (!map.getLayer("u-fill")) return;
  map.setPaintProperty("u-fill", "fill-color", fillExpr());
  map.setPaintProperty("dots", "circle-color", fillExpr());
  map.setPaintProperty("u-fill", "fill-opacity", S.colour === "shade" && S.vis.shadow ? 0.6 : 0.92);
  const f = visFilter();
  map.setFilter("u-fill", f); map.setFilter("dots", f);
  map.setFilter("u-line", ["all", f, ["!=", ["get", "cat"], "register_only"]]);
  map.setFilter("u-reg", ["all", f, ["==", ["get", "cat"], "register_only"]]);
  for (const [id, k] of [["ghost", "ghost"], ["ghost-l", "ghost"], ["ghost3d", "ghost"], ["shade", "shadow"]]) map.setLayoutProperty(id, "visibility", S.vis[k] ? "visible" : "none");
  ramp(); deckLayers();
}
function deckLayers() {
  if (!overlay) return;
  const z = S.zoom, L = [];
  const tf = Math.max(0, Math.min(1, (z - 14.8) / 0.8));
  if (S.vis.trees && tf > 0) {
    L.push(new deck.SimpleMeshLayer({ id: "trunks", data: { length: TREES.n }, getPosition: (_, { index: i }) => [TREES.tpos[3 * i], TREES.tpos[3 * i + 1], TREES.tpos[3 * i + 2]],
      getScale: (_, { index: i }) => [TREES.tsc[3 * i], TREES.tsc[3 * i + 1], TREES.tsc[3 * i + 2]], mesh: CYL, getColor: [112, 88, 66, 255], opacity: tf, material: { ambient: 0.6, diffuse: 0.5, shininess: 0 } }));
    L.push(new deck.SimpleMeshLayer({ id: "crowns", data: { length: TREES.n }, getPosition: (_, { index: i }) => [TREES.pos[3 * i], TREES.pos[3 * i + 1], TREES.pos[3 * i + 2]],
      getScale: (_, { index: i }) => [TREES.sc[3 * i], TREES.sc[3 * i + 1], TREES.sc[3 * i + 2]], mesh: SPHERE, opacity: tf * 0.95,
      getColor: (_, { index: i }) => [TREES.col[4 * i], TREES.col[4 * i + 1], TREES.col[4 * i + 2], 255], material: { ambient: 0.55, diffuse: 0.6, shininess: 8 } }));
  }
  if (S.vis.things && z >= 16) {
    L.push(new deck.ScatterplotLayer({ id: "seats", data: TH.seat, getPosition: d => [d[0], d[1], 0.6], getRadius: 1.3, radiusMinPixels: 3, getFillColor: [196, 138, 66, 255], getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 1, stroked: true }));
    L.push(new deck.ScatterplotLayer({ id: "equip", data: TH.equipment, getPosition: d => [d[0], d[1], 0.6], getRadius: 1.5, radiusMinPixels: 3.5, getFillColor: [208, 103, 79, 255], getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 1, stroked: true, pickable: true }));
  }
  if (S.vis.rings && z >= 14.3) {
    const data = U.features.filter(f => (f.properties.cat === "public" && S.vis.public) || (f.properties.cat === "register_only" && S.vis.register_only) || (S.sel && f.properties.id === S.sel));
    const sz = Math.min(64, Math.max(26, 26 + (z - 14.3) * 14)) * (S.ringK || 1);
    L.push(new deck.IconLayer({ id: "rings", data, pickable: true, billboard: true, sizeUnits: "pixels", getSize: f => f.properties.id === S.sel ? sz * 1.35 : sz,
      getPosition: f => [f.properties.lon, f.properties.lat, 2], getIcon: f => ringIcon(f.properties.q, f.properties.known, f.properties.cat === "register_only", f.properties.id === S.sel),
      opacity: Math.min(1, (z - 14.3) / 0.4), updateTriggers: { getIcon: [S.sel], getSize: [S.sel, sz] }, parameters: { depthTest: false } }));
  }
  overlay.setProps({ layers: L });
}

// ---------------- panel ----------------
function kpis() {
  const F = U.features.map(f => f.properties).filter(p => p.cls === "public");
  const zero = F.filter(p => p.known === 0).length, shadeTag = F.filter(p => p.q[0] === "2").length;
  $("#kpi").innerHTML = [[F.length, t("k1")], [pct(ST.register_matched / ST.n_register), t("k2")], [pct(zero / F.length), t("k3")], [shadeTag ? pct(shadeTag / F.length) : "0", t("k4")]]
    .map(([b, s]) => `<div class="k"><b>${b}</b><span>${s}</span></div>`).join("");
  $("#qbars").innerHTML = Q.map((q, i) => {
    const k = F.filter(p => p.q[i] === "2").length / F.length, f = F.filter(p => p.q[i] === "1").length / F.length;
    return `<div class="qb"><span class="ic" style="background:rgb(${QC[q]})">${QI[q]}</span><span>${t("q")[q]}</span>
      <span class="bar"><i style="width:${k * 100}%;background:rgb(${QC[q]})"></i><i style="width:${f * 100}%;background:repeating-linear-gradient(135deg,rgb(${QC[q]}) 0 2px,rgba(${QC[q]},.25) 2px 4px)"></i></span><span class="v">${pct(k)}</span></div>`;
  }).join("");
}
function ramp() {
  let g, lab;
  if (S.colour === "known") { g = `linear-gradient(90deg,${RAMP_K.join(",")})`; lab = t("r_known"); }
  else if (S.colour === "shade") { g = `linear-gradient(90deg,${RAMP_S.map(r => r[1]).join(",")})`; lab = t("r_shade"); }
  else { g = `linear-gradient(90deg,${RAMP_C.map(r => r[1]).join(",")})`; lab = t("r_canopy"); }
  $("#ramp").innerHTML = `<span>${lab[0]}</span><i class="r" style="background:${g}"></i><span>${lab[1]}</span>`;
  $("#hours").classList.toggle("hide", S.colour !== "shade");
}
function eqText(l) { return l.split(",").filter(Boolean).map(x => EQ[S.lang][x] || x.replace(/_/g, " ")).join(", "); }
function card(id) {
  const ft = BYID[id];
  if (!ft) { $("#card").classList.add("hide"); return; }
  const p = ft.properties, E = t("ev"), reg = p.cat === "register_only";
  const nm = p.name || (p.reg_name ? (S.lang === "en" ? "Playground " : "Oyun parkı ") + p.reg_name : t("unnamed"));
  const ev = {
    shade: +p.q[0] === 2 ? E.shade2(p.shade_tag) : (p.shm_15 != null && p.can_in != null ? E.shade1(pct(p.sh_15), pct(p.shm_15)) : E.shade1n(pct(p.sh_15))),
    trees: (+p.q[1] === 2 ? E.trees2(p.n_trees) : E.trees0) + (p.can_20 != null ? E.can(pct(p.can_20)) : ""),
    seats: +p.q[2] === 2 ? E.seats2(p.n_seats_in || 1) : +p.q[2] === 1 ? E.seats1(p.n_seats_20) : E.seats0,
    access: +p.q[3] === 2 ? E.access2(p.wheelchair) : E.access0,
    equip: +p.q[4] === 2 ? E.equip2(eqText(p.equip_list || "")) : E.equip0
  };
  const badge = s => s === 2 ? `<span class="badge b2">${t("st2")}</span>` : s === 1 ? `<span class="badge b1">${t("st1")}</span>` : `<span class="badge b0">NULL</span>`;
  const osm = p.osm ? `https://www.openstreetmap.org/${{ n: "node", w: "way", r: "relation" }[p.osm[0]]}/${p.osm.slice(1)}` : null;
  $("#card").innerHTML = `<button class="x" aria-label="close">×</button><h4>${nm}</h4>
    <div class="st">${t("status")[p.status]} · ${p.bezirk}${p.area ? " · " + p.area.toLocaleString() + " " + t("area") : ""}${p.is_point ? " · " + t("point") : ""}</div>
    ${Q.map((q, i) => `<div class="q"><span class="ic" style="color:rgb(${QC[q]});font-weight:700">${QI[q]}</span><div><b>${t("q")[q]}</b>${badge(+p.q[i])}<div class="ev">${ev[q]}</div></div></div>`).join("")}
    <div class="links">${osm ? `<a href="${osm}" target="_blank" rel="noopener">${t("osm")}</a>` : ""}<a href="https://www.openstreetmap.org/edit?editor=id#map=19/${p.lat}/${p.lon}" target="_blank" rel="noopener">${t("edit")}</a></div>`;
  $("#card").classList.remove("hide");
  $("#card .x").onclick = () => select(null);
}
function select(id, fly) {
  if (S.sel) map.setFeatureState({ source: "u", id: S.sel }, { sel: false });
  S.sel = id;
  if (id) { map.setFeatureState({ source: "u", id }, { sel: true }); card(id); if (S.mode === "explore") $("#card").scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  else $("#card").classList.add("hide");
  if (id && fly) { const p = BYID[id].properties; map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 17.4), pitch: 50, duration: 1600 }); }
  deckLayers();
}
function lang(l) {
  S.lang = l; try { localStorage.setItem("d21lang", l); } catch (e) {}
  document.documentElement.lang = l;
  $$("#langs button").forEach(b => b.classList.toggle("on", b.dataset.l === l));
  $$("[data-t]").forEach(el => { const v = T[l][el.dataset.t]; if (typeof v === "string") el.innerHTML = v; });
  kpis(); ramp(); if (S.sel) card(S.sel); if (S.mode === "story") go(S.step, true);
}

// ---------------- story ----------------
function steps() {
  const s = ST, en = S.lang === "en", F = U.features.map(f => f.properties).filter(p => p.cls === "public");
  const zero = F.filter(p => p.known === 0).length, n = F.length;
  const ghostPick = s.story?.ghost, shadePick = s.story?.shade || "osm:w137037907";
  const sh = pct(s.public_shade15_median), shm = pct(s.public_shade15_map_median), un = s.public_unmapped_canopy_gt10;
  const notree = F.filter(p => p.q[1] === "0").length;
  const K = (c, l) => `<span><i class="sw" style="background:${c}"></i>${l}</span>`;
  return [
    { v: { center: [9.885, 53.588], zoom: 11.6, pitch: 0, bearing: 0 }, colour: "known", vis: { rings: 1, trees: 0, ghost: 0, shadow: 0 },
      kick: en ? "Hamburg · Altona + Eimsbüttel" : "Hamburg · Altona + Eimsbüttel",
      title: en ? "The map knows where children play" : "Harita çocukların nerede oynadığını biliyor",
      text: en ? `OpenStreetMap has <b>${s.n_osm}</b> playgrounds in these two boroughs, <b>${n}</b> of them public. <b>${pct(s.register_matched / s.n_register)}</b> of the city's official playgrounds are on it.`
        : `OpenStreetMap'te bu iki bezirkte <b>${s.n_osm}</b> oyun parkı var, bunların <b>${n}</b> tanesi kamuya açık. Şehrin resmi oyun parklarının <b>${pct(s.register_matched / s.n_register)}</b> kadarı haritada.` },
    { v: { center: [9.955, 53.572], zoom: 14.7, pitch: 35, bearing: -10 }, colour: "known", vis: { rings: 1, trees: 0, ghost: 0, shadow: 0 },
      kick: en ? "Five questions" : "Beş soru",
      title: en ? "…but rarely what is there" : "…ama içinde ne olduğunu nadiren biliyor",
      text: en ? `Each ring asks five questions: shade, trees, seating, wheelchair access, equipment. Full = a tag says it. Dashed = nothing. <b>${pct(zero / n)}</b> of the public playgrounds answer none of them. Not one has shade tagged.`
        : `Her halka beş soru soruyor: gölge, ağaç, oturma, erişilebilirlik, ekipman. Dolu dilim = bir etiket bunu söylüyor. Kesik çizgi = hiçbir bilgi yok. Kamuya açık parkların <b>${pct(zero / n)}</b> kadarı hiçbir soruya cevap vermiyor. Hiçbirinde gölge etiketi yok.`,
      key: Q.map(q => K(`rgb(${QC[q]})`, T[S.lang].q[q])).join("") },
    { sel: "osm:w137037881", z: 17.7, pitch: 55, bearing: 25, colour: "known", vis: { rings: 1, trees: 1, ghost: 0, shadow: 0, things: 1 },
      kick: en ? "Eimsbüttel · a full record" : "Eimsbüttel · eksiksiz bir kayıt",
      title: en ? "What a well-mapped playground looks like" : "İyi haritalanmış bir oyun parkı",
      text: en ? "Name, equipment, benches, trees, wheelchair access: somebody walked here and wrote it down. Few playgrounds get this." : "Adı, ekipmanı, bankları, ağaçları, erişilebilirliği: biri buraya gelmiş ve not etmiş. Bunu çok az park alıyor." },
    { sel: "osm:w32634922", z: 17.7, pitch: 50, bearing: -20, colour: "known", vis: { rings: 1, trees: 1, ghost: 0, shadow: 0, things: 1 },
      kick: en ? "Altona · an empty record" : "Altona · boş bir kayıt",
      title: en ? "leisure=playground. That's all." : "leisure=playground. O kadar.",
      text: en ? "An official city playground, on the map as an outline with one tag. Is there shade? A bench? A ramp? The map does not say. That is not the same as \"no\"." : "Resmi bir şehir oyun parkı; haritada tek etiketli bir çizgi olarak duruyor. Gölge var mı? Bank? Rampa? Harita söylemiyor. Bu, \"yok\" demekle aynı şey değil." },
    { sel: ghostPick, z: 17.4, pitch: 50, bearing: 15, colour: "canopy", vis: { rings: 1, trees: 1, ghost: 1, shadow: 0 },
      kick: en ? "Satellite vs. map" : "Uydu ve harita",
      title: en ? "Trees the map doesn't know" : "Haritanın bilmediği ağaçlar",
      text: en ? `Green 3D trees are in the map. Pale dashed patches are canopy a satellite sees but no mapped tree explains. <b>${notree}</b> public playgrounds have no mapped tree within 20 m; at <b>${un ?? "–"}</b>, unmapped canopy covers more than a tenth of the surroundings.`
        : `Yeşil 3B ağaçlar haritada var. Soluk, kesik çizgili lekeler ise uydunun gördüğü ama haritadaki hiçbir ağacın açıklamadığı örtü. <b>${notree}</b> kamu parkının 20 m çevresinde haritada tek ağaç yok; <b>${un ?? "–"}</b> parkta haritada olmayan ağaç örtüsü çevrenin onda birinden fazlasını kaplıyor.`,
      key: K("#5c884c", en ? "mapped tree" : "haritadaki ağaç") + `<span><i class="sw ghost"></i>${en ? "unmapped canopy" : "haritada olmayan örtü"}</span>` },
    { sel: shadePick, z: 17.3, pitch: 45, bearing: -30, colour: "shade", hour: "15", vis: { rings: 0, trees: 1, ghost: 1, shadow: 1 },
      kick: en ? "15 July, 15:00" : "15 Temmuz, 15:00",
      title: en ? "Where is the shade at 3 pm?" : "Saat 15:00'te gölge nerede?",
      text: en ? `Dark patches: shade from buildings and canopy on a July afternoon. Counting only what the map knows, the typical public playground is <b>${shm}</b> shaded; adding the satellite canopy, <b>${sh}</b>. The map underestimates shade because it misses trees.`
        : `Koyu alanlar: bir temmuz öğleden sonrasında binaların ve ağaçların gölgesi. Sadece haritanın bildiklerini sayınca tipik bir kamu parkının <b>${shm}</b> kadarı gölgede; uydu ağaç örtüsü eklenince <b>${sh}</b>. Harita ağaçları kaçırdığı için gölgeyi olduğundan az gösteriyor.`,
      key: `<span><i class="sw shd"></i>${en ? "shade at 15:00" : "15:00 gölgesi"}</span>` },
    { sel: "reg:006475", z: 16.9, pitch: 40, bearing: 0, colour: "known", vis: { rings: 1, trees: 1, ghost: 0, shadow: 0 },
      kick: en ? "Invisible" : "Görünmez",
      title: en ? `${s.register_only} official playgrounds the map doesn't know` : `Haritanın bilmediği ${s.register_only} resmi oyun parkı`,
      text: en ? "The red dashed outlines are in the city's register of public playgrounds, but OpenStreetMap has no playground there. Some are mapped as part of a park, some may have changed, some are simply missing."
        : "Kırmızı kesik çizgili alanlar şehrin resmi oyun parkı listesinde var, ama OpenStreetMap'te orada oyun parkı yok. Bazıları park olarak çizilmiş, bazıları değişmiş olabilir, bazıları ise sadece eksik.",
      key: `<span><i class="sw reg"></i>${en ? "official, not in OSM" : "resmi, OSM'de yok"}</span>` },
    { v: { center: [9.905, 53.585], zoom: 12.4, pitch: 20, bearing: 0 }, colour: "known", vis: { rings: 1, trees: 0, ghost: 0, shadow: 0 },
      kick: en ? "What can be done" : "Ne yapılabilir",
      title: en ? "A missing tag is not a missing swing" : "Eksik etiket, eksik salıncak demek değil",
      text: en ? "Every NULL is a question someone could answer on a walk past the playground. The download below lists them, worst first. Only add what you have seen yourself."
        : "Her NULL, parkın önünden geçen birinin cevaplayabileceği bir soru. Aşağıdaki liste bunları en eksikten başlayarak sıralıyor. Yalnızca kendi gözünle gördüğünü ekle.",
      key: `<a href="data/to_check.csv" download>${t("dl")}</a>` }
  ];
}
function go(i, quick) {
  const st = steps(); S.step = Math.max(0, Math.min(st.length - 1, i));
  const s = st[S.step];
  $("#s-kick").textContent = s.kick; $("#s-title").innerHTML = s.title; $("#s-text").innerHTML = s.text; $("#s-key").innerHTML = s.key || "";
  $("#s-dots").innerHTML = st.map((_, k) => `<i class="${k === S.step ? "on" : ""}" data-k="${k}"></i>`).join("");
  $$("#s-dots i").forEach(d => d.onclick = () => go(+d.dataset.k));
  $("#s-prev").disabled = S.step === 0; $("#s-next").disabled = S.step === st.length - 1;
  Object.assign(S.vis, { public: 1, register_only: 1, school: 1, private: 0, things: 1 }, s.vis);
  S.colour = s.colour; if (s.hour) S.hour = s.hour;
  syncControls();
  let v = s.v;
  if (s.sel && BYID[s.sel]) { const p = BYID[s.sel].properties; v = { center: [p.lon, p.lat], zoom: s.z, pitch: s.pitch, bearing: s.bearing }; }
  select(s.sel && BYID[s.sel] ? s.sel : null);
  if (!quick && v) map.flyTo({ ...v, duration: 2600, essential: true });
  restyle();
}
function syncControls() {
  $$("#colour button").forEach(b => b.classList.toggle("on", b.dataset.c === S.colour));
  $$("#hours button").forEach(b => b.classList.toggle("on", b.dataset.h === S.hour));
  $$("[data-s]").forEach(c => c.checked = !!S.vis[c.dataset.s]);
}
function pad() {
  const mob = innerWidth < 760;
  map.setPadding(mob ? { left: 0, right: 0, top: S.mode === "story" ? 180 : 0, bottom: innerHeight * 0.46 } : { left: 410, right: S.mode === "story" ? 400 : 0, top: 0, bottom: 0 });
}
function setMode(m) {
  if (m === "explore" && S.mode === "story") { Object.assign(S.vis, { public: 1, register_only: 1, school: 1, private: 0, rings: 1, trees: 1, ghost: 1, shadow: 1, things: 1 }); syncControls(); }
  S.mode = m; pad();
  $("#m-story").classList.toggle("on", m === "story"); $("#m-explore").classList.toggle("on", m === "explore");
  $("#story").classList.toggle("hide", m !== "story");
  if (m === "story") go(S.step);
}

// ---------------- init ----------------
async function init() {
  map = new maplibregl.Map({ container: "map", style: "https://tiles.openfreemap.org/styles/positron", center: [9.885, 53.588], zoom: 11.6, maxPitch: 70, attributionControl: { compact: true }, hash: false, antialias: true });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  await Promise.all([load(), new Promise(r => map.on("load", r))]);
  addLayers();
  overlay = new deck.MapboxOverlay({ interleaved: true, layers: [] });
  map.addControl(overlay);
  map.on("zoom", () => { const z = map.getZoom(); if (Math.floor(z * 5) !== Math.floor(S.zoom * 5)) { S.zoom = z; deckLayers(); } else S.zoom = z; });
  const tip = $("#tip");
  const show = (x, y, p) => { if (!p) { tip.style.display = "none"; return; } tip.innerHTML = `<b>${p.name || p.reg_name || t("unnamed")}</b><br>${t("status")[p.status]}${p.cls === "public" ? " · " + t("tipk")(p.known) : ""}`; tip.style.left = x + 12 + "px"; tip.style.top = y + 12 + "px"; tip.style.display = "block"; };
  map.on("mousemove", e => {
    const di = overlay.pickObject({ x: e.point.x, y: e.point.y, radius: 4, layerIds: ["rings"] });
    if (di?.object) { show(e.point.x, e.point.y, di.object.properties); map.getCanvas().style.cursor = "pointer"; return; }
    const f = map.queryRenderedFeatures(e.point, { layers: ["u-fill", "dots"] })[0];
    map.getCanvas().style.cursor = f ? "pointer" : ""; show(e.point.x, e.point.y, f?.properties);
  });
  map.on("click", e => {
    const di = overlay.pickObject({ x: e.point.x, y: e.point.y, radius: 4, layerIds: ["rings"] });
    const id = di?.object?.properties.id || map.queryRenderedFeatures(e.point, { layers: ["u-fill", "dots"] })[0]?.properties.id;
    if (id) { if (S.mode === "story") setMode("explore"); select(id, map.getZoom() < 16); }
  });
  $$("#langs button").forEach(b => b.onclick = () => lang(b.dataset.l));
  $("#m-story").onclick = () => setMode("story"); $("#m-explore").onclick = () => setMode("explore");
  $("#s-prev").onclick = () => go(S.step - 1); $("#s-next").onclick = () => go(S.step + 1); $("#s-skip").onclick = () => setMode("explore");
  $$("#colour button").forEach(b => b.onclick = () => { S.colour = b.dataset.c; syncControls(); restyle(); });
  $$("#hours button").forEach(b => b.onclick = () => { S.hour = b.dataset.h; syncControls(); restyle(); });
  $$("[data-s]").forEach(c => c.onchange = () => { S.vis[c.dataset.s] = c.checked ? 1 : 0; restyle(); });
  document.addEventListener("keydown", e => { if (S.mode !== "story") return; if (e.key === "ArrowRight") go(S.step + 1); if (e.key === "ArrowLeft") go(S.step - 1); });
  lang(S.lang);
  const qs = new URLSearchParams(location.search);
  if (qs.get("film")) { document.body.classList.add("film"); S.mode = "film"; S.ringK = 1.55; map.setPadding({ left: 0, right: 0, top: 380, bottom: 150 });
    const c = document.createElement("div"); c.id = "cap"; document.body.appendChild(c);
    window.Film = { map: () => map, S, restyle, deckLayers, select, BYID, ST: () => ST, U: () => U, ringIcon, QC, Q, T };
    window.READY = true; return; }
  if (qs.get("mode") === "explore") { setMode("explore"); restyle(); } else setMode("story");
  if (qs.get("step")) go(+qs.get("step"));
  addEventListener("resize", pad);
  window.Film = { go, select, setMode, map: () => map, S, restyle, steps };
  window.READY = true;
}
init();
