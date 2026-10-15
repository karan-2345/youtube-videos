"""Word-by-word captions from config/timeline.json.

Writes captions/captions.ass (burned in: 2-3 words at a time, the word being
spoken in amber) and captions/captions.srt (sentence captions for the upload).
Each caption ends before the next begins (libass stacks overlapping events).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(os.path.join(ROOT, "config/timeline.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "captions")
os.makedirs(OUT, exist_ok=True)

AMBER = r"{\c&H48C0FC&}"   # #FCC048 in ASS BGR
WHITE = r"{\c&HFFFFFF&}"
MAX_WORDS, MAX_CHARS = 3, 25
HARD = {"a", "an", "the", "and", "or", "but", "so", "its", "their", "each", "it", "yet", "while", "until", "than", "if", "as", "that"}   # worst words to end a caption on
SOFT = {"to", "of", "in", "on", "at", "for", "with", "by", "from", "into", "is", "will", "be", "would", "does", "do", "can", "are", "was",
        "how", "when", "where", "only", "never", "always"}                                                                        # tolerable if the phrase needs them
FUNC = HARD | SOFT
Y = 1380


def ts(t):
    t = max(0.0, t)
    h, r = divmod(t, 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def srt_ts(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def cost(c, clause_end):
    n = len(c)
    text = " ".join(x["text"] for x in c)
    if len(text) > MAX_CHARS or n > 5:
        return 1e9
    base = {1: 3.0, 2: 0.8, 3: 0.0, 4: 0.6, 5: 2.0}[n]
    last = c[-1]["text"].lower().strip(".,?!;:")
    pen = 0.0 if clause_end else (6.0 if last in HARD else 2.5 if last in SOFT else 0.0)
    first = c[0]["text"].lower()
    bonus = -0.4 if first in FUNC and n > 1 else 0.0              # captions like to start at a phrase boundary
    return base + pen + bonus + max(0, len(text) - 21) * 0.25


def chunks(words):
    """Split a sentence at punctuation, then pick the cheapest 1-5 word groups (about three, phrase-friendly)."""
    clauses, cur = [], []
    for w in words:
        cur.append(w)
        if w["text"][-1] in ".,?:!;":
            clauses.append(cur); cur = []
    if cur:
        clauses.append(cur)
    out = []
    for cl in clauses:
        n = len(cl)
        best, prev = [1e18] * (n + 1), [0] * (n + 1)
        best[0] = 0
        for j in range(1, n + 1):
            for k in range(max(0, j - 5), j):
                v = best[k] + cost(cl[k:j], j == n)
                if v < best[j]:
                    best[j], prev[j] = v, k
        j, parts = n, []
        while j > 0:
            k = prev[j]; parts.append(cl[k:j]); j = k
        out += parts[::-1]
    return out


def build():
    all_chunks = []
    for s in TL["sentences"]:
        all_chunks += chunks(s["words"])
    events = []
    for i, c in enumerate(all_chunks):
        start = c[0]["start"] - 0.06
        nxt = all_chunks[i + 1][0]["start"] - 0.06 if i + 1 < len(all_chunks) else TL["duration"]
        end = min(nxt - 0.02, c[-1]["end"] + 0.45) if nxt - c[-1]["end"] > 0.05 else nxt - 0.02
        end = max(end, c[-1]["end"])
        end = min(end, nxt - 0.02)
        for j, w in enumerate(c):
            a = start if j == 0 else w["start"]
            b = c[j + 1]["start"] if j + 1 < len(c) else end
            parts = []
            for k, x in enumerate(c):
                parts.append((AMBER if k == j else WHITE) + x["text"])
            pop = r"{\fscx90\fscy90\t(0,110,\fscx100\fscy100)}" if j == 0 else ""
            events.append((a, b, pop + " ".join(parts)))
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter ExtraBold,76,&H00FFFFFF,&H00FFFFFF,&H90000000,&H00000000,0,0,0,0,100,100,0,0,1,5,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [head]
    for a, b, txt in events:
        if b - a < 0.01:
            continue
        lines.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{{\\pos(540,{Y})\\blur7}}{txt}\n")
    open(os.path.join(OUT, "captions.ass"), "w", encoding="utf-8").write("".join(lines))
    # sentence-level SRT for the upload
    srt = []
    for n, s in enumerate(TL["sentences"], 1):
        srt.append(f"{n}\n{srt_ts(s['start'])} --> {srt_ts(s['end'] + 0.3)}\n{s['display']}\n")
    open(os.path.join(OUT, "captions.srt"), "w", encoding="utf-8").write("\n".join(srt))
    print(f"{len(all_chunks)} caption chunks, {len(events)} karaoke events")
    for c in all_chunks:
        print("  ", " | ".join(x["text"] for x in c))


if __name__ == "__main__":
    build()
