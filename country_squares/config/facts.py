"""
config/facts.py -- the single source of truth for every number in the Short.

Rules
  * An INPUT is a published value or a design choice, and carries a source tag ([CIA], [NE], [WALK], ...; listed in
    research/notes.md).
  * Everything else is COMPUTED here from data/countries.json (tools/build_data.py), never typed in.
  * Scenes, narration and captions read values from here; nothing is duplicated.

    python -m config.facts          -> facts.md (every fact, its source, and the checks)
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "countries.json"


# ==========================================================================
# Registry
# ==========================================================================

@dataclass
class Fact:
    key: str
    value: float
    unit: str
    desc: str
    kind: str          # "input" | "computed"
    fmt: str = ",.4g"
    source: str = ""
    section: str = ""


class Facts:
    def __init__(self):
        self._d: dict[str, Fact] = {}
        self._section = ""
        self.checks: list[tuple[str, bool, str]] = []

    def section(self, name):
        self._section = name

    def input(self, key, value, unit, desc, source, fmt=",.4g"):
        return self._add(Fact(key, float(value), unit, desc, "input", fmt, source, self._section))

    def calc(self, key, value, unit, desc, fmt=",.4g"):
        return self._add(Fact(key, float(value), unit, desc, "computed", fmt, "", self._section))

    def check(self, name, ok, detail=""):
        self.checks.append((name, bool(ok), detail))

    def _add(self, fact):
        assert fact.key not in self._d, f"duplicate fact {fact.key}"
        assert math.isfinite(fact.value), f"{fact.key} is not finite"
        self._d[fact.key] = fact
        return fact.value

    def __getitem__(self, key) -> float:
        return self._d[key].value

    def __contains__(self, key):
        return key in self._d

    def fact(self, key) -> Fact:
        return self._d[key]

    def items(self):
        return self._d.items()


def load_countries() -> list[dict]:
    return json.loads(DATA.read_text(encoding="utf-8"))["countries"]


# ISO codes of the countries the narration names (facts are keyed by them: a.ru, side.va, ...)
NAMED = ["ru", "ca", "us", "cn", "br", "au", "in", "mw", "mt", "li", "sm", "tv", "nr", "mc", "va"]


def build() -> Facts:
    F = Facts()
    rows = load_countries()
    by = {r["iso"]: r for r in rows}
    n = len(rows)

    F.section("The queue")
    F.calc("n.countries", n, "countries", "UN member states + UN observer states", ",.0f")
    F.calc("n.members", sum(r["un"] == "member" for r in rows), "countries", "UN member states", ",.0f")
    F.calc("n.observers", sum(r["un"] == "observer" for r in rows), "countries", "the Holy See and Palestine", ",.0f")
    total = F.calc("a.all", sum(r["area"] for r in rows), "km²", "the 195 areas added up", ",.0f")

    F.section("Areas (CIA World Factbook, final edition, 'Area: total')")
    for iso in NAMED:
        r = by[iso]
        F.input(f"a.{iso}", r["area"], "km²", f"{r['name']}: {r['area_text']}" +
                (f" (the {r['basis']} figure)" if r["basis"] != "total" else ""), "[CIA]", ",.6g")
        F.calc(f"rank.{iso}", r["rank"], "", f"{r['name']}'s place in the queue", ",.0f")
        F.calc(f"side.{iso}", math.sqrt(r["area"]), "km", f"side of {r['name']}'s square", ",.4g")
    F.calc("side.va_m", F["side.va"] * 1000, "m", "side of Vatican City's square, in metres", ",.0f")

    F.section("Comparisons")
    F.calc("x.ru_ca", F["a.ru"] / F["a.ca"] - 1, "", "how much bigger Russia's square is than Canada's (area)", ".3f")
    F.calc("x.ca_cn", F["a.ca"] / F["a.cn"] - 1, "", "Canada vs China, the spread of places 2-4 (area)", ".4f")
    F.calc("x.top6", sum(r["area"] for r in rows[:6]) / total, "", "share of the queue's area in the first six", ".4f")
    F.calc("x.ru_in", F["a.ru"] / F["a.in"], "x", "Russia's area / India's", ".3f")
    F.calc("rank.median", (n + 1) / 2, "", "the middle of the queue", ",.0f")
    F.calc("x.ru_mw_side", F["side.ru"] / F["side.mw"], "x", "Russia's square is this many times as wide as Malawi's",
           ".3f")
    F.calc("x.ru_va", F["a.ru"] / F["a.va"], "x", "Vatican Cities that fit in Russia (area)", ",.0f")
    F.calc("x.ru_va_side", F["side.ru"] / F["side.va"], "x", "Russia's square is this many times as wide as Vatican "
           "City's (the camera's zoom)", ",.0f")
    F.input("walk.kmh", 5.0, "km/h", "a typical walking pace", "[WALK]", ".1f")
    F.calc("va.walk_min", F["side.va"] / F["walk.kmh"] * 60, "min", "walking across Vatican City's square", ".2f")

    # ------------------------------------------------------------------ checks
    F.check("195 countries = 193 UN members + 2 UN observer states",
            (n, F["n.members"], F["n.observers"]) == (195, 193, 2), f"{n} = {F['n.members']:.0f} + {F['n.observers']:.0f}")
    top = [r["name"] for r in rows[:6]]
    F.check("the first six: Russia, Canada, United States, China, Brazil, Australia",
            top == ["Russia", "Canada", "United States", "China", "Brazil", "Australia"], ", ".join(top))
    F.check("India is 7th", F["rank.in"] == 7, f"{F['rank.in']:.0f}")
    F.check("Malawi is the middle (98th of 195)", rows[int(F["rank.median"]) - 1]["iso"] == "mw",
            rows[int(F["rank.median"]) - 1]["name"])
    last = [r["name"] for r in rows[-9:]]
    F.check("the last nine end Liechtenstein, San Marino, Tuvalu, Nauru, Monaco, Vatican City",
            last[-6:] == ["Liechtenstein", "San Marino", "Tuvalu", "Nauru", "Monaco", "Vatican City"], ", ".join(last))
    F.check("Canada, the US and China within 5% of each other (said: 'within about 4 percent')",
            0.035 <= F["x.ca_cn"] < 0.045, f"{F['x.ca_cn']:.2%}")
    F.check("San Marino, Tuvalu and Nauru: squares less than eight kilometres wide",
            max(F["side.sm"], F["side.tv"], F["side.nr"]) < 8 and math.ceil(F["side.sm"]) == 8,
            f"{F['side.sm']:.2f} / {F['side.tv']:.2f} / {F['side.nr']:.2f} km")
    F.check("Monaco's square is about one and a half kilometres wide (1.25-1.75)", 1.25 <= F["side.mc"] < 1.75,
            f"{F['side.mc']:.2f} km")
    F.check("Russia holds more than 'five times' India", 5 <= F["x.ru_in"] < 6, f"{F['x.ru_in']:.2f}")
    F.check("Malawi's square is about a twelfth as wide as Russia's (11.5-12.5)", 11.5 <= F["x.ru_mw_side"] < 12.5,
            f"{F['x.ru_mw_side']:.2f}")
    F.check("Vatican City walk rounds to eight minutes", round(F["va.walk_min"]) == 8, f"{F['va.walk_min']:.2f} min")
    sorted_ok = all(a["area"] >= b["area"] for a, b in zip(rows, rows[1:]))
    F.check("the queue is sorted by area", sorted_ok)
    return F


F = build()


def write_md(path: Path = ROOT / "facts.md"):
    meta = json.loads(DATA.read_text(encoding="utf-8"))["meta"]
    out = ["# Facts: every country as a square\n",
           "> **Generated file** (`python -m config.facts`). Inputs carry a source tag (research/notes.md); everything "
           "else is computed in `config/facts.py` from `data/countries.json`.\n",
           f"Factbook mirror commit `{meta['factbook'][:12]}`; Natural Earth 1:50m sha256 "
           f"`{meta['natural_earth_sha256'][:12]}`.\n"]
    sec = None
    for k, f in F.items():
        if f.section != sec:
            sec = f.section
            out += [f"\n## {sec}\n", "| Key | Value | Unit | What | Source |", "|---|---:|---|---|---|"]
        out.append(f"| `{k}` | {format(f.value, f.fmt)} | {f.unit} | {f.desc} | {f.source or 'computed'} |")
    ok = all(c[1] for c in F.checks)
    out += [f"\n## Checks: {sum(c[1] for c in F.checks)}/{len(F.checks)} pass\n", "| | Check | Result |", "|---|---|---|"]
    out += [f"| {'PASS' if c[1] else '**FAIL**'} | {c[0]} | {c[2]} |" for c in F.checks]
    out += ["\n## The queue\n", "| # | Country | Area (km²) | Square side | Factbook text |", "|---:|---|---:|---:|---|"]
    for r in load_countries():
        side = f"{r['side']:,.1f} km" if r["side"] >= 1 else f"{r['side'] * 1000:,.0f} m"
        out.append(f"| {r['rank']} | {r['name']} | {r['area']:,.2f} | {side} | {r['area_text']}"
                   + (f" ({r['basis']})" if r['basis'] != 'total' else "") + " |")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")
    return ok


if __name__ == "__main__":
    ok = write_md()
    for name, passed, detail in F.checks:
        print(f"  {'PASS' if passed else 'FAIL'}  {name}  [{detail}]")
    print(f"facts.md written; checks {'PASS' if ok else 'FAIL'}")
    raise SystemExit(0 if ok else 1)
