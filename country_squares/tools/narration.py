"""
tools/narration.py -- render the narration source into narration.md + narration.json.

Source: config/narration.src.md
  ## S03 · Title          a narration section (maps to one storyboard scene)
  @scene S03a_Orbits      following beats play over this render scene
  @pause 1.5              silence (seconds) after the previous beat
  @lead 2.5               silence (seconds) before the next beat (picture-only moment)
  any other line          one beat = one sentence group = one sync point
  {{fact.key|filters}}    a number, pulled from config/facts.py

Filters (applied left to right; the last may be a Python format spec):
  round:N floor:N ceil:N   round to N decimals (N may be negative)
  mul:K  abs               arithmetic
  pct                      0.424 -> "42 percent"
  sigwords:N               2.54e11 -> "300 billion" (N significant figures)
  ord                      18 -> "18th"
  word                     4 -> "four" (whole numbers 0-20)
  frac                     12 -> "a twelfth" (2-20)
  mixed                    2.44 -> "two and a half" (nearest half, 0-20)
  clock                    11.02 -> "11:02" (facts store clock times as h.mm)
  <spec>                   any format spec, e.g. ,.0f   (default: the fact's own)

Lint: a digit anywhere outside {{...}} and @directives is an error. Every
number the viewer hears must come from facts.py. Proper names that contain a
digit (NAMES, e.g. "1915 Canakkale") are not numbers and are exempt.
A decimal point in the rendered text is also an error: the voice reads "0.2" as
"zero. two", so the script says numbers the way a person would ("two and a
half", "40 centimeters") instead.
"""

from __future__ import annotations

import json
import math
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402
from config.facts import F  # noqa: E402

SRC = ROOT / "config" / "narration.src.md"
OUT_MD = ROOT / "narration.md"
OUT_JSON = ROOT / "renders" / "cache" / "narration.json"
NAMES: list[str] = []
DECIMAL = re.compile(r"\d\.\d")
TOKEN = re.compile(r"\{\{\s*([a-z0-9_.]+)\s*((?:\|[^}]*)?)\}\}")

WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
         "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]

ORDS = ["", "", "half", "third", "quarter", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh",
        "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth",
        "twentieth"]

SCALES = [(1e18, "billion billion"), (1e12, "trillion"), (1e9, "billion"),
          (1e6, "million"), (1e3, "thousand")]


def _sigwords(v: float, n: int) -> str:
    v = float(f"{v:.{n}g}")
    for scale, word in SCALES:
        if abs(v) >= scale:
            return f"{_plain(v / scale)} {word}"
    return _plain(v)


def _plain(m: float) -> str:
    """300.0 -> '300', 2.5 -> '2.5' (never scientific notation)."""
    return f"{m:,.0f}" if abs(m - round(m)) < 1e-9 else f"{m:,.6g}"


def render_token(key: str, filters: str) -> str:
    if key not in F:
        raise KeyError(f"unknown fact '{key}'")
    v = F[key]
    rounded = None
    for flt in [x.strip() for x in filters.split("|") if x.strip()]:
        name, _, arg = flt.partition(":")
        if name == "round":
            v = round(v, int(arg))
            rounded = max(int(arg), 0)
            continue
        elif name == "floor":
            q = 10 ** int(arg)
            v = math.floor(v * q) / q
        elif name == "ceil":
            q = 10 ** int(arg)
            v = math.ceil(v * q) / q
        elif name == "mul":
            v = v * float(arg)
        elif name == "abs":
            v = abs(v)
        elif name == "pct":
            return f"{v * 100:.0f} percent"
        elif name == "sigwords":
            return _sigwords(v, int(arg))
        elif name == "word":
            n = int(round(v))
            if abs(v - n) > 1e-9 or not 0 <= n < len(WORDS):
                raise KeyError(f"'{key}' = {v} can't be written as a word")
            return WORDS[n]
        elif name == "mixed":
            halves = int(round(v * 2))
            whole, half = divmod(halves, 2)
            if not 0 <= whole < len(WORDS):
                raise KeyError(f"'{key}' = {v} is too big for 'mixed'")
            if not half:
                return WORDS[whole]
            return "half a" if whole == 0 else f"{WORDS[whole]} and a half"
        elif name == "frac":
            n = int(round(v))
            if not 2 <= n < len(ORDS):
                raise KeyError(f"'{key}' = {v} can't be written as a fraction word")
            return "a half" if n == 2 else f"a {ORDS[n]}"
        elif name == "clock":
            h = int(v)
            return f"{h}:{round((v - h) * 100):02d}"
        elif name == "ord":
            n = int(round(v))
            suf = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
            return f"{n}{suf}"
        else:
            return format(v, flt)
    if rounded is not None:
        return format(v, f",.{rounded}f")
    return format(v, F.fact(key).fmt)


@dataclass
class Beat:
    id: str
    scene: str            # render scene this beat plays over
    source: str
    text: str
    words: int
    pause_after: float = 0.0
    facts: list = field(default_factory=list)
    lead: float = 0.0     # silence before this beat


@dataclass
class Section:
    id: str
    title: str
    beats: list


def parse(path: Path = SRC):
    sections: list[Section] = []
    errors: list[str] = []
    scene = None
    lead = 0.0
    for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith(">") or line.startswith("<!--"):
            continue
        if line.startswith("## "):
            sid, _, title = line[3:].partition("·")
            sections.append(Section(sid.strip(), title.strip(), []))
            continue
        if line.startswith("#"):
            continue
        if line.startswith("@scene"):
            scene = line.split()[1]
            continue
        if line.startswith("@lead"):
            lead += float(line.split()[1])
            continue
        if line.startswith("@pause"):
            if sections and sections[-1].beats:
                sections[-1].beats[-1].pause_after += float(line.split()[1])
            continue
        if not sections or scene is None:
            errors.append(f"line {n}: beat before any '## section' / '@scene'")
            continue
        stripped = TOKEN.sub("", line)
        for name in NAMES:
            stripped = stripped.replace(name, "")
        if re.search(r"\d", stripped):
            errors.append(f"line {n}: hard-coded digit outside a fact token: {line!r}")
        try:
            text = TOKEN.sub(lambda m: render_token(m.group(1), m.group(2)), line)
        except KeyError as e:
            errors.append(f"line {n}: {e}")
            continue
        if DECIMAL.search(text):
            errors.append(f"line {n}: decimal number in the narration (say it as words): {text!r}")
        sec = sections[-1]
        beat_id = f"{sec.id}.{len(sec.beats) + 1:02d}"
        facts = [m.group(1) for m in TOKEN.finditer(line)]
        sec.beats.append(Beat(beat_id, scene, line, text, len(text.split()), 0.0, facts, lead))
        lead = 0.0
    return sections, errors


def estimate(sec: Section) -> dict:
    words = sum(b.words for b in sec.beats)
    speech = words / style.EST_WPM * 60
    sents = sum(max(len(re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])", b.text.strip())) - 1, 0) for b in sec.beats)
    pauses = (sum(b.pause_after + b.lead for b in sec.beats) + style.BEAT_GAP_S * max(len(sec.beats) - 1, 0)
              + style.SENTENCE_GAP_S * sents)
    total = speech + pauses + style.SCENE_HEAD_S + style.SCENE_TAIL_S
    return {"words": words, "speech": speech, "pauses": pauses, "total": total}


def _mmss(s: float) -> str:
    s = int(round(s))
    return f"{s // 60}:{s % 60:02d}"


def write(sections):
    est = [estimate(s) for s in sections]
    total_words = sum(e["words"] for e in est)
    total_s = sum(e["total"] for e in est)
    out: list[str] = []
    w = out.append
    w("# Narration: every country as a square (vertical Short)\n")
    w("> **Generated file.** Edit `config/narration.src.md`, then run `python build.py narration`. "
      "Every number is filled in from `config/facts.py` (see the table at the end).\n")
    w(f"**Voice:** Kokoro `{style.VOICE}` at speed {style.VOICE_SPEED} (≈{style.EST_WPM} wpm). "
      f"**Script:** {total_words:,} words. **Estimated runtime:** {_mmss(total_s)} "
      f"(speech, beat gaps, scripted pauses, and scene heads/tails). The real timing comes from "
      "the synthesized audio. Scenes are built to the measured beat times, not to this estimate.\n")
    w("| # | Section | Render scenes | Words | Est. |")
    w("|---|---|---|---:|---:|")
    t = 0.0
    for s, e in zip(sections, est):
        scenes = ", ".join(dict.fromkeys(b.scene for b in s.beats))
        w(f"| {s.id} | {s.title} | {scenes} | {e['words']} | {_mmss(t)}–{_mmss(t + e['total'])} |")
        t += e["total"]
    w("")
    for s, e in zip(sections, est):
        w(f"## {s.id} · {s.title}\n")
        w(f"*{e['words']} words, ~{e['total']:.0f} s*\n")
        current = None
        for b in s.beats:
            if b.scene != current:
                w(f"**▸ `{b.scene}`**\n")
                current = b.scene
            pause = f" *(pause {b.pause_after:g} s)*" if b.pause_after else ""
            lead = f"*(picture only {b.lead:g} s)* " if b.lead else ""
            w(f"- `{b.id}` {lead}{b.text}{pause}")
        w("")
    w("## Numbers in this script\n")
    w("| Beat | Fact | Value used | Unit |")
    w("|---|---|---|---|")
    for s in sections:
        for b in s.beats:
            for m in TOKEN.finditer(b.source):
                key = m.group(1)
                w(f"| `{b.id}` | `{key}` | {render_token(key, m.group(2))} | {F.fact(key).unit} |")
    OUT_MD.write_text("\n".join(out) + "\n", encoding="utf-8")
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps([{**asdict(s), "estimate": e} for s, e in zip(sections, est)],
                                   indent=1), encoding="utf-8")
    return total_words, total_s


def main():
    sections, errors = parse()
    if errors:
        print("narration lint FAILED:")
        for e in errors:
            print("  " + e)
        return 1
    words, secs = write(sections)
    print(f"narration.md written: {len(sections)} sections, {words} words, est. {_mmss(secs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
