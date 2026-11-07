"""
tools/build_data.py -- the country table and the map shapes every scene draws.

    python tools/build_data.py extract --factbook <clone of github.com/factbook/factbook.json>
        -> research/sources/factbook_areas.json  (area lines of every Factbook entry, verbatim, + the commit)
    python tools/build_data.py build
        -> data/countries.json  (the 195 countries: Factbook area, rank, flag code, map shapes in Equal Earth km)

Which countries: the 193 UN member states plus the two UN observer states (the Holy See and Palestine), the usual
"195 countries" (research/notes.md FLAG 1). Membership is read from each entry's "International organization
participation" line ("UN" vs "UN (observer)"), not typed in. Palestine has no single Factbook entry: it is the West
Bank plus the Gaza Strip.

Areas: the Factbook's "Area: total" (land + inland water), the CIA's last edition (the Factbook was discontinued in
February 2026; the mirror keeps its final data). Shapes: Natural Earth 1:50m admin-0 countries (public domain),
projected with Equal Earth (an equal-area projection, so a square of the right area on the map is the right area on
the globe). Shapes are only for the map: every size in the Short comes from the Factbook area.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import geo  # noqa: E402

FB_OUT = ROOT / "research" / "sources" / "factbook_areas.json"
NE_PATH = ROOT / "assets" / "downloads" / "ne_50m_admin_0_countries.geojson"
NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"
OUT = ROOT / "data" / "countries.json"

# On-screen names. The Factbook's "conventional short form" is kept in the table as fb_name; these are only the
# ones that read badly in a label (or are "none": the UAE and Micronesia have no conventional short form).
DISPLAY = {
    "vt": "Vatican City", "cg": "DR Congo", "cf": "Congo", "bf": "Bahamas", "ga": "Gambia", "fm": "Micronesia",
    "ae": "UAE", "dr": "Dominican Republic", "iv": "Côte d'Ivoire", "vc": "St Vincent & Grenadines",
    "sc": "St Kitts & Nevis", "ac": "Antigua & Barbuda", "tp": "São Tomé & Príncipe", "td": "Trinidad & Tobago",
    "bk": "Bosnia & Herzegovina", "st": "Saint Lucia",
    "bm": "Myanmar", "tu": "Türkiye",            # the names the UN uses (the Factbook keeps "Burma", "Turkey")
}
# Area corrections (research/notes.md). Since 2021 the Factbook's Morocco total (716,550 sq km) includes Western
# Sahara, which it also lists as its own entry (266,000 sq km) and which the UN lists as a non-self-governing
# territory. The Short counts Morocco without it, the same way the map draws it.
AREA_MINUS = {"mo": "wi"}
# ... and Natural Earth's default Morocco outline includes the part of Western Sahara west of the berm, so the map
# cuts it at Western Sahara's northern border, the parallel 27°40' N (research/notes.md FLAG 3)
NE_SPLIT = {"MAR": (27 + 40 / 60, "Western Sahara (west of the berm)")}
TLD_TO_ISO = {"uk": "gb"}            # the only member whose internet code is not its ISO 3166 alpha-2 code
# Natural Earth features drawn as part of a counted country (the Factbook counts them inside it)
NE_MERGE = {"SOL": "so", "CYN": "cy"}                # Somaliland -> Somalia, Northern Cyprus -> Cyprus

AREA_RE = re.compile(r"^\s*([\d,]*\.?\d+)\s*(million)?\s*sq km")


def parse_area(text: str | None) -> float | None:
    if not text:
        return None
    m = AREA_RE.match(text)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    return v * 1e6 if m.group(2) else v


# ------------------------------------------------------------------------------------------------ extract
def extract(repo: Path):
    commit = subprocess.run(["git", "-C", str(repo), "log", "-1", "--format=%H %cI"], capture_output=True,
                            text=True, check=True).stdout.split()
    rows = []
    for f in sorted(repo.glob("*/*.json")):
        if f.parent.name in ("meta", "oceans", "world"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        area = {k.strip(): v.get("text") for k, v in d.get("Geography", {}).get("Area", {}).items()
                if isinstance(v, dict)}
        gov = d.get("Government", {})
        name = gov.get("Country name", {}).get("conventional short form", {}).get("text")
        orgs = gov.get("International organization participation", {}).get("text", "")
        tld = d.get("Communications", {}).get("Internet country code", {}).get("text", "")
        rows.append({
            "code": f.stem, "region": f.parent.name, "name": name,
            "area_total": area.get("total"), "area_land": area.get("land"), "area_water": area.get("water"),
            "un": ("observer" if re.search(r"\bUN \(observer\)", orgs) else
                   "member" if re.search(r"\bUN\b(?! \()", orgs.replace("UN Security Council", "")) else None),
            "dependency": "Dependency status" in gov,
            "tld": (re.search(r"\.([a-z]{2})\b", tld) or re.match("()", "")).group(1),
        })
    FB_OUT.parent.mkdir(parents=True, exist_ok=True)
    FB_OUT.write_text(json.dumps({"source": "https://github.com/factbook/factbook.json", "commit": commit[0],
                                  "commit_date": commit[1], "entries": rows}, indent=1, ensure_ascii=False),
                      encoding="utf-8")
    print(f"{FB_OUT.relative_to(ROOT)}: {len(rows)} entries, commit {commit[0][:8]} ({commit[1]})")


# ------------------------------------------------------------------------------------------------ build
def countries() -> list[dict]:
    """The 195 rows: name, Factbook code(s), ISO code, area (km²), and the area text it was read from."""
    fb = json.loads(FB_OUT.read_text(encoding="utf-8"))
    out = []
    for e in fb["entries"]:
        if e["un"] is None or e["code"] == "ee":          # ee = the European Union (a UN observer, not a country)
            continue
        area = parse_area(e["area_total"])
        basis = "total"
        if not area:                                       # the Holy See: "total: 0 sq km" (rounded), land 0.44
            area, basis = parse_area(e["area_land"]), "land"
        if e["code"] in AREA_MINUS:
            other = next(o for o in fb["entries"] if o["code"] == AREA_MINUS[e["code"]])
            area -= parse_area(other["area_total"])
            basis = f"total minus {other['name']} ({other['area_total']})"
        iso = TLD_TO_ISO.get(e["tld"], e["tld"])
        name = html.unescape(e["name"])
        out.append({"name": DISPLAY.get(e["code"], name), "fb_name": name, "fb": [e["code"]],
                    "iso": iso, "area": area, "basis": basis, "area_text": e["area_total"], "un": e["un"]})
    parts = [e for e in fb["entries"] if e["code"] in ("we", "gz")]        # Palestine = West Bank + Gaza Strip
    out.append({"name": "Palestine", "fb_name": "West Bank + Gaza Strip", "fb": ["we", "gz"], "iso": "ps",
                "area": sum(parse_area(p["area_total"]) for p in parts), "basis": "total",
                "area_text": " + ".join(p["area_total"] for p in parts), "un": "observer"})
    out.sort(key=lambda r: -r["area"])
    for i, r in enumerate(out, 1):
        r["rank"] = i
    return out


def four_colour(nbr: dict[int, set[int]]) -> dict[int, int]:
    """Backtracking DSATUR: always colour the node with the most distinct neighbour colours next. Within the colours a
    node may take, it prefers the one used least so far, so the four tones come out evenly."""
    col: dict[int, int] = {}
    count = [0, 0, 0, 0]
    sys.setrecursionlimit(10_000)

    def pick():
        free = [i for i in nbr if i not in col]
        return max(free, key=lambda i: (len({col[j] for j in nbr[i] if j in col}), len(nbr[i]), -i))

    def solve():
        if len(col) == len(nbr):
            return True
        i = pick()
        used = {col[j] for j in nbr[i] if j in col}
        for c in sorted((c for c in range(4) if c not in used), key=lambda c: (count[c], c)):
            col[i] = c
            count[c] += 1
            if solve():
                return True
            count[c] -= 1
            del col[i]
        return False

    assert solve(), "no four-colouring"
    return col


def _split_at_lat(rings, lat):
    """Outer rings split at a parallel: (the parts north of it, the parts south of it)."""
    from shapely.geometry import Polygon, box
    from shapely.ops import unary_union
    shape = unary_union([Polygon(r) for r in rings])
    north = shape.intersection(box(-180, lat, 180, 90))
    south = shape.difference(box(-180, lat, 180, 90))
    out = []
    for part in (north, south):
        geoms = getattr(part, "geoms", [part])
        out.append([list(g.exterior.coords) for g in geoms if g.area > 0])
    return out


def _rings(geom) -> list[list[list[float]]]:
    """Outer rings only (lon, lat). Natural Earth's countries have no holes that matter at this scale."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [p[0] for p in polys]


def build():
    rows = countries()
    assert len(rows) == 195, len(rows)
    by_iso = {r["iso"]: r for r in rows}
    if not NE_PATH.exists():
        NE_PATH.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["curl", "-sS", "-L", "-o", str(NE_PATH), NE_URL], check=True)
    ne_bytes = NE_PATH.read_bytes()
    ne = json.loads(ne_bytes)

    shapes: dict[str, list] = {r["iso"]: [] for r in rows}
    ghosts = []                                           # land that is not one of the 195 (Greenland, Taiwan, ...)
    for f in ne["features"]:
        p = f["properties"]
        iso = NE_MERGE.get(p["ADM0_A3"]) or (p["ISO_A2_EH"] or "").lower()
        if p["ADM0_A3"] == "ATA":                         # Antarctica: below the map's crop
            continue
        lonlat = _rings(f["geometry"])
        if p["ADM0_A3"] in NE_SPLIT:                      # Natural Earth's Morocco runs into Western Sahara
            lat, other = NE_SPLIT[p["ADM0_A3"]]
            keep, cut = _split_at_lat(lonlat, lat)
            ghosts.append({"name": other, "rings": [geo.project_ring(r) for r in cut]})
            lonlat = keep
        rings = [geo.project_ring(r) for r in lonlat]
        if iso in shapes and p["TYPE"] != "Dependency":
            shapes[iso] += rings
        else:
            ghosts.append({"name": p["ADMIN"], "rings": rings})

    missing = [r["name"] for r in rows if not shapes[r["iso"]]]
    assert not missing, f"no Natural Earth shape for {missing}"

    for r in rows:
        rings = shapes[r["iso"]]
        areas = [geo.ring_area(x) for x in rings]
        r["map_area"] = round(sum(areas), 1)               # projected area (km²) of the full-detail shape
        main = max(range(len(rings)), key=lambda i: areas[i])
        cx, cy = geo.centroid(rings[main])
        r["map"] = {
            "center": [round(cx, 2), round(cy, 2)],        # the square's centre on the map: the main part's centroid
            "main": geo.morph_ring(rings[main], (cx, cy)),
            "parts": [{"ring": geo.simplify(rings[i], geo.MAP_TOL_KM), "c": [round(v, 2) for v in geo.centroid(rings[i])]}
                      for i in range(len(rings)) if i != main and areas[i] >= geo.MIN_PART_KM2],
        }
        r["side"] = math.sqrt(r["area"])
    # one of four tones per country, neighbours apart: adjacency from the outlines (touching within ~10 km), then
    # a four-colouring (DSATUR order, backtracking)
    from shapely.geometry import Polygon
    from shapely.strtree import STRtree
    polys = [Polygon(max(shapes[r["iso"]], key=geo.ring_area)).buffer(10) for r in rows]
    tree = STRtree(polys)
    nbr = {i: set() for i in range(len(rows))}
    for i, pg in enumerate(polys):
        for j in tree.query(pg, predicate="intersects"):
            if j != i:
                nbr[i].add(int(j))
                nbr[int(j)].add(i)
    colour = four_colour(nbr)
    for i, r in enumerate(rows):
        r["mapcolor"] = colour[i]
        r["neighbours"] = sorted(rows[j]["iso"] for j in nbr[i])
    clash = [(rows[i]["name"], rows[j]["name"]) for i in nbr for j in nbr[i] if rows[i]["mapcolor"] == rows[j]["mapcolor"]]
    assert not clash, clash

    OUT.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "factbook": json.loads(FB_OUT.read_text(encoding="utf-8"))["commit"],
        "natural_earth_sha256": hashlib.sha256(ne_bytes).hexdigest(),
        "projection": "Equal Earth, sphere of the authalic radius (km); y grows southward (screen axes)",
        "bounds": geo.map_bounds(),
    }
    ghosts = [{"name": g["name"], "rings": [geo.simplify(x, geo.MAP_TOL_KM) for x in g["rings"]
                                            if geo.ring_area(x) >= geo.MIN_PART_KM2]} for g in ghosts]
    ghosts = [g for g in ghosts if g["rings"]]
    OUT.write_text(json.dumps({"meta": meta, "countries": rows, "ghosts": ghosts}, separators=(",", ":"),
                              ensure_ascii=False), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(rows)} countries, {len(ghosts)} other land shapes, "
          f"{OUT.stat().st_size / 1e6:.2f} MB")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["extract", "build"])
    ap.add_argument("--factbook", type=Path)
    a = ap.parse_args()
    if a.cmd == "extract":
        extract(a.factbook)
    else:
        build()


if __name__ == "__main__":
    main()
