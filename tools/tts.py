"""
tools/tts.py -- synthesize the narration and measure the timeline every scene syncs to.

For each render scene:
  audio/tts/<scene>.wav          voice track: head silence + beats + tail
  renders/cache/timings.json     exact start/end of every beat, sentence and caption

Sentences are synthesized one at a time (natural prosody, exact boundaries) and
cached by (voice, speed, text), so editing one line re-synthesizes one line.

Captions show the narration verbatim. Pronunciation fixes (SPEECH_FIXES) change
only what the voice hears, never what the captions say.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import textwrap
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import style  # noqa: E402

NARRATION = ROOT / "renders" / "cache" / "narration.json"
TIMINGS = ROOT / "renders" / "cache" / "timings.json"
OUT = ROOT / "audio" / "tts"
CACHE = OUT / "cache"
SR = 24_000                 # Kokoro's native rate
SENTENCE_GAP_S = style.SENTENCE_GAP_S   # silence between sentences inside a beat
TRIM_DB = -45.0             # silence threshold for trimming synth padding
KEEP_S = 0.03               # keep this much of the natural onset/decay

_ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen " \
        "fifteen sixteen seventeen eighteen nineteen".split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def _two_digits(n: int) -> str:
    if n < 20:
        return _ONES[n]
    t, o = divmod(n, 10)
    return _TENS[t] + ("" if o == 0 else "-" + _ONES[o])


def _year(m: re.Match) -> str:
    """'1945' -> 'nineteen forty-five' (espeak would say 'nineteen hundred forty-five')."""
    y = m.group(2)
    hi, lo = int(y[:2]), int(y[2:])
    if hi == 20 and lo < 10:                      # 2004 -> 'two thousand four'
        return f"{m.group(1)}two thousand" + ("" if lo == 0 else f" {_ONES[lo]}")
    tail = "hundred" if lo == 0 else (f"oh {_ONES[lo]}" if lo < 10 else _two_digits(lo))
    return f"{m.group(1)}{_two_digits(hi)} {tail}"


def _pairs(m: re.Match) -> str:
    """Any bare four-digit number, read in pairs the way people read a calculator: '6174' -> 'sixty-one
    seventy-four', '0226' -> 'oh two twenty-six', '6200' -> 'sixty-two hundred'. Years read the same way
    ('2026' -> 'twenty twenty-six'). Numbers written with a comma ('8,991') are left to the phonemizer."""
    y = m.group(2)
    hi, lo = int(y[:2]), int(y[2:])
    head = f"oh {_ONES[hi]}" if y[0] == "0" else _two_digits(hi)
    tail = "hundred" if lo == 0 else (f"oh {_ONES[lo]}" if lo < 10 else _two_digits(lo))
    return f"{m.group(1)}{head} {tail}"


def _decade(m: re.Match) -> str:
    """'2030s' -> 'twenty thirties'."""
    return f"{_two_digits(int(m.group(1)))} {_TENS[int(m.group(2))][:-1]}ies"


def _clock(m: re.Match) -> str:
    """'4:50' -> 'four fifty' (the phonemizer keeps the colon)."""
    h, mi = int(m.group(1)), int(m.group(2))
    return f"{_two_digits(h)} " + ("o'clock" if mi == 0 else (f"oh {_ONES[mi]}" if mi < 10 else _two_digits(mi)))


def _decimal(m: re.Match) -> str:
    """'0.25' -> 'zero point two five'. The phonemizer reads the point as a full stop ('zero. two'), which
    sounds robotic; narration.py already rejects decimals in the script, so this is only a safety net."""
    whole = int(m.group(1).replace(",", ""))
    head = _two_digits(whole) if whole < 100 else m.group(1)
    return f"{head} point " + " ".join(_ONES[int(d)] for d in m.group(2))


SPEECH_FIXES = [
    (re.compile(r"\b(\d[\d,]*)\.(\d+)\b"), _decimal),
    (re.compile(r"\b(\d{1,2}):(\d{2})\b"), _clock),
    # any bare four-digit number (not "8,991", not "1940s"); group 1 keeps the preceding character
    (re.compile(r"(^|[\s(])(\d{4})(?![\d,.]\d|s\b)"), _pairs),
    (re.compile(r"\b(19|20)([1-9])0s\b"), _decade),
]

# Names the phonemizer gets wrong: spoken from IPA (captions keep the spelling). "'s" adds /z/.
IPA_FIXES = {
    "Lichess": "lˈiːtʃɛs",         # LEE-chess (libre chess), as the site says it; espeak says LITCH-ess
}
_IPA_RE = re.compile(r"\b(" + "|".join(IPA_FIXES) + r")('s)?\b")


def speech_text(text: str) -> str:
    for pat, rep in SPEECH_FIXES:
        text = pat.sub(rep, text)
    return text


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])", text.strip())
    return [p for p in parts if p]


def _trim(x: np.ndarray) -> np.ndarray:
    thr = 10 ** (TRIM_DB / 20) * max(np.abs(x).max(), 1e-9)
    idx = np.flatnonzero(np.abs(x) > thr)
    if idx.size == 0:
        return x
    k = int(KEEP_S * SR)
    return x[max(idx[0] - k, 0): min(idx[-1] + k, len(x))]


class Voice:
    def __init__(self):
        self._k = None

    def synth(self, text: str) -> np.ndarray:
        spoken = speech_text(text)
        key = hashlib.sha1(f"{style.VOICE}|{style.VOICE_SPEED}|{spoken}".encode()).hexdigest()[:16]
        path = CACHE / f"{key}.wav"
        if path.exists():
            return sf.read(path, dtype="float32")[0]
        if self._k is None:
            from kokoro_onnx import Kokoro
            self._k = Kokoro(str(ROOT / "assets/models/kokoro-v1.0.onnx"),
                             str(ROOT / "assets/models/voices-v1.0.bin"))
        if _IPA_RE.search(spoken):
            audio, sr = self._k.create(self._phonemes(spoken), voice=style.VOICE, speed=style.VOICE_SPEED,
                                       lang=style.VOICE_LANG, is_phonemes=True)
        else:
            audio, sr = self._k.create(spoken, voice=style.VOICE, speed=style.VOICE_SPEED, lang=style.VOICE_LANG)
        assert sr == SR
        audio = _trim(np.asarray(audio, dtype=np.float32))
        sf.write(path, audio, SR)
        return audio

    def _phonemes(self, text: str) -> str:
        """Phonemize the text around IPA_FIXES names, splicing in the fixed IPA for each name."""
        out, pos = [], 0
        for m in _IPA_RE.finditer(text):
            chunk = text[pos:m.start()].strip()
            if chunk:
                out.append(self._k.tokenizer.phonemize(chunk, style.VOICE_LANG))
            out.append(IPA_FIXES[m.group(1)] + ("z" if m.group(2) else ""))
            pos = m.end()
        tail = text[pos:].strip()
        if tail:
            out.append(self._k.tokenizer.phonemize(tail, style.VOICE_LANG))
        return " ".join(x.strip() for x in out if x.strip())


def _fits(text: str, width: int, lines: int) -> bool:
    return len(textwrap.wrap(text, width)) <= lines


def _pack_cards(sentence: str, width: int, lines: int) -> list[str]:
    """Greedy packing of clauses (split after , : ;) into cards that fit width x lines.
    A clause too long for one card is packed word by word instead."""
    clauses = [c for c in re.split(r"(?<=[,:;])\s+", sentence) if c]
    cards: list[str] = []
    cur = ""
    for clause in clauses:
        trial = f"{cur} {clause}".strip()
        if _fits(trial, width, lines):
            cur = trial
            continue
        if cur:
            cards.append(cur)
            cur = ""
        if _fits(clause, width, lines):
            cur = clause
        else:  # long clause: fall back to word packing
            for word in clause.split():
                trial = f"{cur} {word}".strip()
                if _fits(trial, width, lines):
                    cur = trial
                else:
                    cards.append(cur)
                    cur = word
    if cur:
        cards.append(cur)
    return cards


def caption_chunks(sentence: str, start: float, end: float) -> list[dict]:
    """Split a sentence into caption cards of <= max_lines x max_chars, timed by character share."""
    width, lines = style.CAPTION["max_chars_per_line"], style.CAPTION["max_lines"]
    cards = _pack_cards(sentence, width, lines)
    total = sum(len(c) for c in cards)
    out, t = [], start
    for c in cards:
        d = (end - start) * len(c) / total
        out.append({"text": c, "lines": textwrap.wrap(c, width), "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    return out


def build(only: set[str] | None = None):
    sections = json.loads(NARRATION.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    voice = Voice()
    timings = json.loads(TIMINGS.read_text()) if TIMINGS.exists() else {}

    scenes: dict[str, list] = {}
    for sec in sections:
        for b in sec["beats"]:
            scenes.setdefault(b["scene"], []).append(b)

    for scene, beats in scenes.items():
        if only and scene not in only:
            continue
        chunks = [np.zeros(int(style.SCENE_HEAD_S * SR), np.float32)]
        t = style.SCENE_HEAD_S
        beat_rows, captions = {}, []
        for i, b in enumerate(beats):
            if b.get("lead"):
                chunks.append(np.zeros(int(b["lead"] * SR), np.float32))
                t += b["lead"]
            b_start = t
            sents = []
            for j, s in enumerate(split_sentences(b["text"])):
                a = voice.synth(s)
                sents.append({"text": s, "start": round(t, 3), "end": round(t + len(a) / SR, 3)})
                captions += caption_chunks(s, t, t + len(a) / SR)
                chunks.append(a)
                t += len(a) / SR
                if j < len(split_sentences(b["text"])) - 1:
                    chunks.append(np.zeros(int(SENTENCE_GAP_S * SR), np.float32))
                    t += SENTENCE_GAP_S
            beat_rows[b["id"]] = {"start": round(b_start, 3), "end": round(t, 3), "sentences": sents}
            gap = b["pause_after"] + (style.BEAT_GAP_S if i < len(beats) - 1 else 0.0)
            chunks.append(np.zeros(int(gap * SR), np.float32))
            t += gap
        chunks.append(np.zeros(int(style.SCENE_TAIL_S * SR), np.float32))
        t += style.SCENE_TAIL_S
        audio = np.concatenate(chunks)
        sf.write(OUT / f"{scene}.wav", audio, SR)
        timings[scene] = {"duration": round(len(audio) / SR, 3), "beats": beat_rows, "captions": captions}
        print(f"  {scene:24s} {len(audio) / SR:6.1f} s  ({len(beats)} beats)")

    for scene, dur in style.VISUAL_ONLY.items():          # silent, fixed-length scenes (e.g. the title card)
        if only and scene not in only:
            continue
        sf.write(OUT / f"{scene}.wav", np.zeros(int(dur * SR), np.float32), SR)
        timings[scene] = {"duration": dur, "beats": {}, "captions": []}
        print(f"  {scene:24s} {dur:6.1f} s  (visual only)")

    TIMINGS.write_text(json.dumps(timings, indent=1))
    return timings


if __name__ == "__main__":
    build(set(sys.argv[1:]) or None)
