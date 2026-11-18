# The Incomplete Playground · Hamburg

**#30DayMapChallenge 2026 · Day 21 · OpenStreetMap**

**What does the map know about Hamburg's playgrounds?**

👉 **Live map:** https://barisparlatangiller.github.io/30DMC26-D21-OSM-Hamburg-Incomplete-Playground/

OpenStreetMap knows where children play in Altona and Eimsbüttel: 85% of the city's official public playgrounds are on it. It rarely knows what is there. Every playground answers five questions — **shade, trees, seating, wheelchair access, equipment** — as *in the map* (a tag or a mapped feature), *inferred* (only nearby things hint at it) or *NULL*.

- 672 public playgrounds (635 in OSM + 37 official ones with no OSM playground)
- 39% answer none of the five questions; none has shade tagged
- Shade on a July afternoon (15:00): about 1% if you only count what the map knows, about 58% with satellite canopy and LoD2 buildings — the map misses most trees
- `docs/data/to_check.csv`: playgrounds to check on site, worst first. **A missing tag is not a missing swing** — only add what you have verified yourself.

## Data
- OpenStreetMap contributors (ODbL), Geofabrik Hamburg extract 2026-11-16
- FHH/BUKEA: Verzeichnis der öffentlichen Grünanlagen (gruen_art = Spielplätze), Straßenbaumkataster — DL-DE-BY-2.0
- FHH/LGV: 3D-Gebäudemodell LoD2-DE Hamburg (2026-04-28) — DL-DE-BY-2.0
- Meta & WRI: High Resolution Canopy Height Maps (Tolan et al. 2024) — CC BY 4.0

## Pipeline
`.github/workflows/fetch.yml` (LoD2 + canopy, pushed to branch `fetched`) → `pipeline/extract.py` → `pipeline/analyse.py` (matching, five questions, shade simulation for 15 July 11/13/15/17 h) → `pipeline/build_web.py` → `docs/`.
