"""Build the narration: parse config/narration.md, synthesize each sentence with
Kokoro af_heart (speed 0.86), join with the channel's pauses, and write
audio/narration.wav plus config/timeline.json (word times, events, sections).

    python tools/voice.py            # build
    python tools/voice.py --report   # just print pace from an existing timeline
"""
import json
import os
import re
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import facts  # noqa: E402
from tools import tts  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "config/narration.md")
OUT_WAV = os.path.join(ROOT, "audio/narration.wav")
OUT_JSON = os.path.join(ROOT, "config/timeline.json")

HEAD = 0.45        # title is already on screen; voice starts almost at once in a Short
TAIL = 2.2         # hold the last picture
GAP_SENT = 0.55     # between sentences
GAP_SECTION = 1.2  # between sections (picture-only moment at each cut)

TOKEN_RE = re.compile(r"\{#(\w+)\}|\[([^|\]]+)\|([^\]]+)\]|\{\{(\w+)\}\}|(\s+)|([^\s\[\{]+)")


def parse():
    sections, cur = [], None
    for raw in open(SRC, encoding="utf-8"):
        line = raw.rstrip("\n")
        if not line.strip() or (line.startswith("#") and not line.startswith("## ")):
            continue
        if line.startswith("## "):
            cur = {"name": line[3:].strip(), "sentences": []}
            sections.append(cur)
            continue
        if line.startswith("@pause"):
            cur["sentences"][-1]["pause_after"] = float(line.split()[1])
            continue
        segs, pending, glue = [], [], False
        for m in TOKEN_RE.finditer(line):
            ev, disp, spk, key, ws, word = m.groups()
            if ev:
                pending.append(ev)
                continue
            if ws:
                glue = False
                continue
            if key:
                disp, spk = facts.SAY[key]
            elif word is not None:
                if segs and glue and not any(c.isalnum() for c in word[:1]):
                    segs[-1]["display"] += word  # punctuation right after a [x|y] or {{k}}
                    segs[-1]["spoken"] += word
                    continue
                disp = spk = word
            segs.append({"display": disp, "spoken": spk, "events": pending})
            pending = []
            glue = True
        cur["sentences"].append({"segments": segs})
    return sections


def align(segs, words):
    """Give each display segment the time span of the TTS words it produced."""
    spoken, spans, pos = "", [], 0
    for s in segs:
        if spoken:
            spoken += " "
        spans.append((len(spoken), len(spoken) + len(s["spoken"])))
        spoken += s["spoken"]
    low = spoken.lower()
    for s in segs:
        s["start"] = s["end"] = None
    for w in words:
        i = low.find(w["text"].lower(), pos)
        if i < 0:
            print("  !! could not place TTS word", repr(w["text"]), "in", repr(spoken))
            continue
        pos = i + len(w["text"])
        for s, (a, b) in zip(segs, spans):
            if a <= i < b:
                s["start"] = w["start"] if s["start"] is None else min(s["start"], w["start"])
                s["end"] = w["end"] if s["end"] is None else max(s["end"], w["end"])
                break
    # segments with no alnum (should not happen) inherit neighbours
    for k, s in enumerate(segs):
        if s["start"] is None:
            prev = segs[k - 1]["end"] if k else 0.0
            s["start"] = s["end"] = prev
    return spoken


def build():
    sections = parse()
    pieces, t = [], HEAD
    pieces.append(np.zeros(int(HEAD * tts.SR), np.float32))
    timeline = {"sections": [], "sentences": [], "events": {}, "words": []}
    flat = [(si, s) for si, sec in enumerate(sections) for s in sec["sentences"]]
    for n, (si, sent) in enumerate(flat):
        sec = sections[si]
        if not timeline["sections"] or timeline["sections"][-1]["name"] != sec["name"]:
            timeline["sections"].append({"name": sec["name"], "start": round(t, 3)})
        spoken = " ".join(s["spoken"] for s in sent["segments"])
        audio, words, _ = tts.synth(spoken)
        audio, words = tts.trim(audio, words)
        align(sent["segments"], words)
        dur = len(audio) / tts.SR
        entry = {"section": sec["name"], "start": round(t, 3), "end": round(t + dur, 3),
                 "display": " ".join(s["display"] for s in sent["segments"]), "spoken": spoken, "words": []}
        for s in sent["segments"]:
            w = {"text": s["display"], "start": round(t + s["start"], 3), "end": round(t + s["end"], 3)}
            entry["words"].append(w)
            timeline["words"].append({**w, "section": sec["name"]})
            for ev in s["events"]:
                timeline["events"][ev] = w["start"]
        timeline["sentences"].append(entry)
        pieces.append(audio)
        t += dur
        last = n == len(flat) - 1
        if last:
            gap = TAIL
        else:
            next_new_section = flat[n + 1][0] != si
            gap = sent.get("pause_after", GAP_SECTION if next_new_section else GAP_SENT)
            if next_new_section:
                gap = max(gap, GAP_SECTION)
        pieces.append(np.zeros(int(round(gap * tts.SR)), np.float32))
        t += gap
        print(f"  {entry['start']:6.2f}-{entry['end']:6.2f}  {entry['display']}")
    total = sum(len(p) for p in pieces) / tts.SR
    for k, sec in enumerate(timeline["sections"]):
        sec["end"] = timeline["sections"][k + 1]["start"] if k + 1 < len(timeline["sections"]) else round(total, 3)
    timeline["duration"] = round(total, 3)
    audio = np.concatenate(pieces)
    sf.write(OUT_WAV, audio, tts.SR, subtype="PCM_24")
    json.dump(timeline, open(OUT_JSON, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    report(timeline)


def report(tl=None):
    tl = tl or json.load(open(OUT_JSON, encoding="utf-8"))
    n_spoken = sum(len(s["spoken"].split()) for s in tl["sentences"])
    speech = sum(s["end"] - s["start"] for s in tl["sentences"])
    print(f"duration {tl['duration']:.1f} s | spoken words {n_spoken} | overall {n_spoken / tl['duration'] * 60:.0f} wpm"
          f" | while talking {n_spoken / speech * 60:.0f} wpm")
    print("sections:", ", ".join(f"{s['name']} {s['start']:.1f}-{s['end']:.1f}" for s in tl["sections"]))


if __name__ == "__main__":
    if "--report" in sys.argv:
        report()
    else:
        build()
