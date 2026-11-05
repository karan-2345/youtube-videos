"""tools/tts.py -- Kokoro af_heart @ 0.95 (kokoro-onnx), one sentence at a time, cached.

Writes audio/voice.wav (24 kHz mono) and cache/timings.json: every sentence's start/end on the global timeline.
Gaps: 0.4 s between sentences, 0.8 s between sections, plus scripted @pause. No silence is padded to a length.
Speech-only fixes (what the voice hears; the script and captions are never changed): decimals, years.
"""
import hashlib, json, re, sys, time
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
SR = 24_000
VOICE, SPEED, LANG = "af_heart", 0.95, "en-us"
SENT_GAP, SECTION_GAP, HEAD, TAIL = 0.4, 0.8, 0.6, 0.0
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen " \
       "seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def two(n):
    return ONES[n] if n < 20 else TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])


def year(m):
    y = m.group(0)
    hi, lo = int(y[:2]), int(y[2:])
    if hi == 20 and lo < 10:
        return "two thousand" + ("" if lo == 0 else " and " + ONES[lo])
    return f"{two(hi)} {two(lo)}"


FIXES = [(re.compile(r"\b(\d+)\.(\d+)\b"), lambda m: f"{two(int(m.group(1)))} point " + " ".join(ONES[int(d)] for d in m.group(2))),
         (re.compile(r"\b(19|20)\d\d\b"), year)]


def spoken(s):
    for p, f in FIXES:
        s = p.sub(f, s)
    return s


def load_script():
    rows, pauses = [], {}
    for line in (ROOT / "config/narration.txt").read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        if line.startswith("@pause"):
            _, sid, sec = line.split()
            pauses[sid] = float(sec)
            continue
        sid, text = line.split(" ", 1)
        rows.append({"id": sid, "section": sid.split(".")[0], "text": text})
    return rows, pauses


def trim(x, db=-45, keep=0.03):
    thr = 10 ** (db / 20) * np.abs(x).max()
    idx = np.flatnonzero(np.abs(x) > thr)
    k = int(keep * SR)
    return x[max(idx[0] - k, 0): idx[-1] + k]


def main():
    rows, pauses = load_script()
    cache = ROOT / "cache/tts"
    cache.mkdir(parents=True, exist_ok=True)
    k = None
    chunks, t, out = [np.zeros(int(HEAD * SR), np.float32)], HEAD, []
    t0 = time.perf_counter()
    for i, r in enumerate(rows):
        sp = spoken(r["text"])
        key = hashlib.sha1(f"{VOICE}|{SPEED}|{sp}".encode()).hexdigest()[:16]
        p = cache / f"{key}.wav"
        if p.exists():
            a = sf.read(p, dtype="float32")[0]
        else:
            if k is None:
                from kokoro_onnx import Kokoro
                k = Kokoro(str(ROOT / "models/kokoro-v1.0.onnx"), str(ROOT / "models/voices-v1.0.bin"))
            a, sr = k.create(sp, voice=VOICE, speed=SPEED, lang=LANG)
            a = trim(np.asarray(a, np.float32))
            sf.write(p, a, SR)
        d = len(a) / SR
        words = r["text"].split()
        out.append({**r, "spoken": sp, "start": round(t, 3), "end": round(t + d, 3), "words": len(words)})
        chunks.append(a)
        t += d
        gap = pauses.get(r["id"], 0.0)
        if i + 1 < len(rows):
            gap += SECTION_GAP if rows[i + 1]["section"] != r["section"] else SENT_GAP
        chunks.append(np.zeros(int(round(gap * SR)), np.float32))
        t += round(gap * SR) / SR
    audio = np.concatenate(chunks)
    (ROOT / "audio").mkdir(exist_ok=True)
    sf.write(ROOT / "audio/voice.wav", audio, SR)
    dur = len(audio) / SR
    secs = {}
    for r in out:
        s = secs.setdefault(r["section"], {"start": r["start"], "end": r["end"]})
        s["end"] = r["end"]
    (ROOT / "cache/timings.json").write_text(json.dumps({"duration": dur, "sentences": out, "sections": secs}, indent=1))
    for r in out:
        print(f"  {r['id']}  {r['start']:7.2f} - {r['end']:7.2f}  ({r['end'] - r['start']:5.2f} s)  {r['spoken'][:60]}")
    nw = sum(r["words"] for r in out)
    print(f"voice: {dur:.2f} s ({dur // 60:.0f}:{dur % 60:05.2f}), {nw} words, synth {time.perf_counter() - t0:.0f} s")


if __name__ == "__main__":
    main()
