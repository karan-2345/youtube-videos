"""
tools/upload.py -- titles, description, caption and sources for YouTube Shorts and Instagram Reels
-> renders/final/upload.md. Every number comes from config/facts.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config.facts import F, load_countries  # noqa: E402

FINAL = ROOT / "renders" / "final"


def write() -> Path:
    meta = json.loads((ROOT / "data/countries.json").read_text(encoding="utf-8"))["meta"]
    rows = load_countries()
    top = ", ".join(f"{r['name']} {r['area']:,.0f} km²" for r in rows[:6])
    tail = ", ".join(f"{r['name']} {r['area']:,.2f}".rstrip("0").rstrip(".") + " km²" for r in rows[-6:])
    n = int(F["n.countries"])
    text = f"""# Upload notes: Every country as a square

## Titles (pick one)

1. Every country as a perfect square
2. What if every country were a square?
3. All {n} countries as squares, from Russia to Vatican City

## YouTube Shorts description

Every country squeezed into a perfect square with the same area, then lined up from biggest to smallest.
Russia's square is {F['side.ru']:,.0f} km wide; Vatican City's is {F['side.va_m']:,.0f} m. Where is yours?

Areas: CIA World Factbook, final edition ("Area: total", land + inland water). Countries: the {F['n.members']:.0f} UN
member states plus the {F['n.observers']:.0f} UN observer states (the Holy See and Palestine). Map: Natural Earth,
Equal Earth projection (equal-area, so the squares are to scale with the map). Flags: flag-icons (MIT).

#geography #maps #countries #flags #shorts

## Instagram Reels caption

Every country as a perfect square, biggest to smallest. Russia's square is {F['side.ru']:,.0f} km wide, Vatican
City's is {F['side.va_m']:,.0f} m. Where does yours stand? 🌍

#geography #maps #countries #flags #reels

## Pinned comment

Squares by "total area" (land + inland water) from the CIA World Factbook's final edition. Morocco is counted
without Western Sahara; Taiwan, Kosovo and territories like Greenland are not among the {n}. Full table and sources
in the project's facts.md.

## The numbers on screen

- Largest six: {top}
- Smallest six: {tail}
- Russia vs Canada: +{F['x.ru_ca']:.0%} area. Canada / US / China within {F['x.ca_cn']:.1%}.
- First six: {F['x.top6']:.1%} of the {n} countries' combined area ({F['a.all']:,.0f} km²).
- India (#{F['rank.in']:.0f}): Russia is {F['x.ru_in']:.2f}x its area. Malawi (#{F['rank.mw']:.0f}, the middle):
  Russia's square is {F['x.ru_mw_side']:.2f}x as wide.
- Vatican City: {F['side.va_m']:.0f} m square, {F['va.walk_min']:.1f} min at 5 km/h; Russia holds it
  {F['x.ru_va']:,.0f} times.

## Sources

- CIA World Factbook, final edition (discontinued February 2026), via the factbook.json mirror,
  commit `{meta['factbook'][:12]}`. Public domain.
- Natural Earth 1:50m Admin 0 Countries (public domain), sha256 `{meta['natural_earth_sha256'][:12]}`.
- Šavrič, Patterson & Jenny (2018), The Equal Earth map projection, IJGIS 33(3).
- flag-icons 7.6.0 by Panayiotis Lipiridis (MIT licence).
- Voice: Kokoro (Apache-2.0), voice af_heart. Music and sound effects: synthesized for this video.
"""
    FINAL.mkdir(parents=True, exist_ok=True)
    out = FINAL / "upload.md"
    out.write_text(text, encoding="utf-8")
    print(f"  {out.relative_to(ROOT)}")
    return out


if __name__ == "__main__":
    write()
