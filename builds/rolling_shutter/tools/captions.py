"""tools/captions.py -- word captions (the pipeline burns them in): Inter ExtraBold, up to 3 words, current word in the
white (amber is reserved for the scan line), centred at y = 1590 (inside the middle 3:4). Text is the narration verbatim. Also writes captions.srt.
Word times: each sentence is measured; words inside it are placed by their share of the spoken characters."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from tts import spoken  # noqa: E402

INK, ACC, Y, SIZE = "A9ADB0", "EAF1F4", 1590, 66      # ASS colours are BGR. Current word white, others grey: amber is kept for the scan line


def ts_ass(t):
    cs = int(round(t * 100)); h, cs = divmod(cs, 360000); m, cs = divmod(cs, 6000); s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def ts_srt(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def words(sent):
    toks = sent["text"].split()
    lens = [len(spoken(w)) + 1 for w in toks]
    tot, t, out = sum(lens), sent["start"], []
    for w, n in zip(toks, lens):
        d = (sent["end"] - sent["start"]) * n / tot
        out.append({"w": w, "start": t, "end": t + d}); t += d
    return out


def groups(ws, max_words=3, max_chars=18):
    out, cur = [], []
    for w in ws:
        if cur and (len(cur) == max_words or sum(len(x["w"]) + 1 for x in cur) + len(w["w"]) > max_chars):
            out.append(cur); cur = []
        cur.append(w)
        if w["w"].endswith((",", ".", "?", "!", ";", ":")):
            out.append(cur); cur = []
    if cur: out.append(cur)
    return out


def main():
    tim = json.loads((ROOT / "cache/timings.json").read_text())
    ev, srt = [], []
    for i, s in enumerate(tim["sentences"], 1):
        srt.append(f"{i}\n{ts_srt(s['start'])} --> {ts_srt(s['end'])}\n{s['text']}\n")
        gs = groups(words(s))
        for gi, g in enumerate(gs):
            g_end = gs[gi + 1][0]["start"] if gi + 1 < len(gs) else g[-1]["end"] + 0.2
            for wi, w in enumerate(g):
                t1 = g[wi + 1]["start"] if wi + 1 < len(g) else g_end
                txt = " ".join(("{\\c&H" + ACC + "&}" + x["w"] + "{\\c&H" + INK + "&}") if j == wi else x["w"] for j, x in enumerate(g))
                pop = "{\\fscx90\\fscy90\\t(0,80,\\fscx100\\fscy100)}" if wi == 0 else ""
                ev.append(f"Dialogue: 0,{ts_ass(w['start'])},{ts_ass(t1)},Cap,,0,0,0,,{{\\pos(540,{Y})}}{pop}{txt}")
    ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter ExtraBold,{SIZE},&H00{INK},&H00FFFFFF,&H000E0D0D,&H90000000,0,0,0,0,100,100,0,0,1,5,2,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(ev) + "\n"
    (ROOT / "cache/captions.ass").write_text(ass, encoding="utf-8")
    (ROOT / "captions.srt").write_text("\n".join(srt), encoding="utf-8")
    # check: the caption words are the narration, verbatim
    cap = " ".join(w["w"] for s in tim["sentences"] for w in words(s))
    assert cap == " ".join(s["text"] for s in tim["sentences"])
    print(f"{len(ev)} caption events, {len(srt)} srt cues; text verbatim: OK")


if __name__ == "__main__":
    main()
