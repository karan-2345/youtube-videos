"""
config/events.py -- on-screen event times, shared by the scenes (scenes/3d/export.py) and the SFX cue sheet
(tools/sfx.py), so every sound lands on the thing it belongs to.

Times are seconds from the start of the scene, derived from the TTS timings (renders/cache/timings.json).
Only sentence boundaries are measured; a phrase inside a sentence is placed by its share of the SPOKEN text
(tools/tts.speech_text), the same rule the captions use (good to about a word). Spoken, not written, because this
Short's numbers are much longer said than written ('197,281' is nine spoken words).
"""

from __future__ import annotations


def _spoken_len(text: str) -> int:
    from tools.tts import speech_text
    return len(speech_text(" " + text)) - 1


def at(timing: dict, beat: str, phrase: str | None = None, offset: float = 0.0, end: bool = False) -> float:
    """Scene time of a beat's start (or end), or of `phrase` inside it, plus `offset`."""
    b = timing["beats"][beat]
    if phrase is None:
        return (b["end"] if end else b["start"]) + offset
    for s in b["sentences"]:
        i = s["text"].find(phrase)
        if i >= 0:
            share = _spoken_len(s["text"][:i]) / max(1, _spoken_len(s["text"]))
            return s["start"] + (s["end"] - s["start"]) * share + offset
    raise KeyError(f"{phrase!r} not found in beat {beat}")


def resolve(timing: dict, anchors: dict) -> dict:
    """{key: (beat, phrase or None, offset) | (beat, None, offset, 'end') | number} -> {key: seconds}."""
    out = {}
    for k, v in anchors.items():
        if isinstance(v, (int, float)):
            out[k] = float(v)
        else:
            beat, phrase, off, *rest = v
            out[k] = round(at(timing, beat, phrase, off, end=bool(rest and rest[0] == "end")), 3)
    out["end"] = timing["duration"]
    return out


# Scene anchors go here once the TTS is measured (STOP 2): {key: (beat, phrase, offset)}.
