"""Equal Earth must preserve area on the WGS84 ellipsoid, and the map shapes must agree with the Factbook areas."""

import json
import math
import sys
from pathlib import Path

import pytest
from pyproj import Geod

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import geo  # noqa: E402
from config.facts import F, load_countries  # noqa: E402

WGS84 = Geod(ellps="WGS84")


def _cell(lon0, lat0, d=1.0, k=40):
    """A d x d degree cell, densified so projected straight edges follow the curved parallels."""
    ring = [(lon0 + d * i / k, lat0) for i in range(k)] + [(lon0 + d, lat0 + d * i / k) for i in range(k)]
    ring += [(lon0 + d - d * i / k, lat0 + d) for i in range(k)] + [(lon0, lat0 + d - d * i / k) for i in range(k)]
    return ring


@pytest.mark.parametrize("lat", [-55, -30, 0, 20, 45, 60, 75, 83])
def test_equal_area_against_geodesic(lat):
    ring = _cell(37.0, lat)
    lons, lats = zip(*ring)
    true, _ = WGS84.polygon_area_perimeter(lons, lats)
    proj = geo.ring_area(geo.project_ring(ring))
    assert proj == pytest.approx(abs(true) / 1e6, rel=2e-4)


def test_authalic_radius():
    assert geo.R_AUTHALIC == pytest.approx(6371.0072, abs=1e-3)


def test_square_ring_has_the_right_area():
    sq = geo.square_ring(10, -5, 3.0, 64)
    assert geo.ring_area(sq) == pytest.approx(9.0, rel=1e-9)
    assert geo.signed_area(sq) > 0                        # clockwise on screen, like every morph outline


def test_morph_rings_are_clockwise_and_divisible_by_four():
    for r in load_countries():
        m = r["map"]["main"]
        assert len(m) % 4 == 0
        assert geo.signed_area([tuple(p) for p in m]) > 0, r["name"]


# Known differences between the Natural Earth outline and the Factbook's total, all explained in research/notes.md
SHAPE_EXCEPTIONS = {
    "Norway": "the outline includes Svalbard and Jan Mayen; the Factbook total does not",
}


def test_map_outlines_match_factbook_areas():
    bad = []
    for r in load_countries():
        if r["area"] < 100_000 or r["name"] in SHAPE_EXCEPTIONS:
            continue
        if not 0.85 <= r["map_area"] / r["area"] <= 1.15:
            bad.append((r["name"], round(r["map_area"] / r["area"], 3)))
    assert not bad


def test_queue_is_sorted_and_ranked():
    rows = load_countries()
    assert [r["rank"] for r in rows] == list(range(1, 196))
    assert all(a["area"] >= b["area"] for a, b in zip(rows, rows[1:]))


def test_every_country_has_a_flag():
    flags = ROOT / "scenes" / "web" / "node_modules" / "flag-icons" / "flags" / "1x1"
    if not flags.exists():
        pytest.skip("npm install in scenes/web first")
    missing = [r["name"] for r in load_countries() if not (flags / f"{r['iso']}.svg").exists()]
    assert not missing


def test_all_fact_checks_pass():
    failed = [c for c in F.checks if not c[1]]
    assert not failed
