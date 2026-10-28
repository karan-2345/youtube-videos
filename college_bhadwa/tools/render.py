"""Hand-drawn stick-figure animation for the college bhadwa demo.

Every frame is a pure function of time. Lines are re-jittered every 3 frames
("line boil") so it reads as hand drawn. No text anywhere on screen.

    python tools/render.py stills 3.5,9.9,14.6     -> renders/still_*.png
    python tools/render.py video                   -> renders/video.mp4 (silent)
"""
import json
import math
import os
import subprocess
import sys
import wave
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, SS, FPS = 1920, 1080, 2, 24
INK = (30, 28, 30)
PAPER = (250, 248, 241)
GREEN = (126, 196, 112)
RED = (226, 72, 64)
BLUE = (120, 170, 225)
SKY = (205, 225, 245)
ORANGE = (245, 160, 60)
GREY = (200, 200, 205)
BROWN = (150, 95, 55)

# ---------------------------------------------------------------- timeline
LINES = {m["key"]: m for m in json.load(open(os.path.join(ROOT, "audio/lines.json"), encoding="utf-8"))}
START = {"intro": 0.25, "bhai": 8.35, "baap": 11.8, "rant": 15.5}
END = START["rant"] + LINES["rant"]["dur"] + 0.5


def W_(key, word, n=0):
    """Absolute time of the nth occurrence of a spoken word."""
    hits = [w["start"] for w in LINES[key]["words"] if w["text"] == word]
    return START[key] + hits[n]


T_BHADWA = W_("intro", "भड़वा")
T_JO = W_("intro", "जो")
T_PAISE1 = W_("intro", "पैसे")
T_UDHAR = W_("intro", "उधार")
T_APNI = W_("intro", "अपनी")
T_SABSE = W_("bhai", "सबसे")
T_BHAI = W_("bhai", "भाई")
T_BAAT = W_("baap", "बात")
T_TAB = W_("baap", "तब")
T_BAAP = W_("baap", "बाप")
T_DEKHO = W_("rant", "देखो")
T_PAISE_R = W_("rant", "पैसे", 1)
T_PADHAI = W_("rant", "पढ़ाई")
T_MEKO = W_("rant", "मेको")
T_JHAAT = W_("rant", "झाट")
T_TU = W_("rant", "तू")

# Mouth openness for the bhadwa while he speaks his rant, from the clip's loudness.
def _envelope():
    with wave.open(os.path.join(ROOT, "audio/rant.wav")) as w:
        sr = w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop = sr // FPS
    rms = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2)) for i in range(0, len(a), hop)])
    return np.clip(rms / (np.percentile(rms, 90) + 1e-6), 0, 1)


ENV = _envelope()


def mouth_at(t):
    i = int((t - START["rant"]) * FPS)
    return float(ENV[i]) if 0 <= i < len(ENV) else 0.0


# ---------------------------------------------------------------- helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def back_out(x):
    x = clamp(x)
    c = 1.9
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


def lerp(a, b, x):
    return a + (b - a) * x


def hn(*k):
    h = (hash(k) * 2654435761) & 0xFFFFFFFF
    return h / 2 ** 31 - 1.0


def dirv(a):
    r = math.radians(a)
    return math.sin(r), math.cos(r)


def add(p, v, s=1.0):
    return p[0] + v[0] * s, p[1] + v[1] * s


class Canvas:
    def __init__(self, frame):
        self.img = Image.new("RGB", (W * SS, H * SS), PAPER)
        self.d = ImageDraw.Draw(self.img)
        self.frame = frame
        self.boil = frame // 3
        self.sid = 0
        self.z = 1.0
        self.f = (960.0, 540.0)
        self.shake = (0.0, 0.0)

    def tp(self, p):
        return (((p[0] - self.f[0]) * self.z + 960 + self.shake[0]) * SS,
                ((p[1] - self.f[1]) * self.z + 540 + self.shake[1]) * SS)

    def _wob(self, pts, amp, seg=32):
        self.sid += 1
        out, k = [], 0
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            n = max(1, int(math.dist(a, b) / seg))
            for j in range(n):
                x, y = lerp(a[0], b[0], j / n), lerp(a[1], b[1], j / n)
                out.append((x + amp * hn(self.boil, self.sid, k, 0), y + amp * hn(self.boil, self.sid, k, 1)))
                k += 1
        b = pts[-1]
        out.append((b[0] + amp * hn(self.boil, self.sid, k, 0), b[1] + amp * hn(self.boil, self.sid, k, 1)))
        return out

    def _stroke(self, wpts, w, col):
        sp = [self.tp(p) for p in wpts]
        ww = max(2, int(w * self.z * SS))
        if len(sp) > 1:
            self.d.line(sp, fill=col, width=ww, joint="curve")
        r = ww / 2
        for p in (sp[0], sp[-1]):
            self.d.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=col)

    def line(self, pts, w=6, col=INK, t=1.0, amp=2.0):
        if t <= 0:
            return
        wp = self._wob(pts, amp / max(self.z, 1))
        if t < 1:
            seg = [math.dist(wp[i], wp[i + 1]) for i in range(len(wp) - 1)]
            total, acc = sum(seg) * t, 0.0
            cut = [wp[0]]
            for i, s in enumerate(seg):
                if acc + s >= total:
                    cut.append(add(wp[i], ((wp[i + 1][0] - wp[i][0]), (wp[i + 1][1] - wp[i][1])), (total - acc) / max(s, 1e-6)))
                    break
                acc += s
                cut.append(wp[i + 1])
            wp = cut
        self._stroke(wp, w, col)

    def ellipse(self, c, rx, ry=None, w=6, col=INK, fill=None, rot=0.0, t=1.0, amp=0.035):
        ry = rx if ry is None else ry
        self.sid += 1
        n = max(18, int(max(rx, ry) * 0.45 * self.z))
        a0 = hn(self.boil, self.sid, 99) * math.pi
        cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        pts = []
        for i in range(n + 2):
            a = a0 + 2 * math.pi * i / n * 1.04
            k = 1 + amp * hn(self.boil, self.sid, i % n)
            x, y = rx * k * math.cos(a), ry * k * math.sin(a)
            pts.append((c[0] + x * cr - y * sr, c[1] + x * sr + y * cr))
        if fill is not None:
            self.d.polygon([self.tp(p) for p in pts[:n]], fill=fill)
        if w > 0 and t > 0:
            m = max(2, int(len(pts) * t))
            self._stroke(pts[:m], w, col)

    def poly(self, pts, fill=None, w=6, col=INK, amp=2.0, closed=True):
        wp = self._wob(list(pts) + ([pts[0]] if closed else []), amp / max(self.z, 1))
        if fill is not None:
            self.d.polygon([self.tp(p) for p in wp], fill=fill)
        if w > 0:
            self._stroke(wp, w, col)

    def dot(self, c, r, col=INK):
        p = self.tp(c)
        rr = r * self.z * SS
        self.d.ellipse((p[0] - rr, p[1] - rr, p[0] + rr, p[1] + rr), fill=col)

    def arc(self, c, r, a0, a1, w=6, col=INK, n=10):
        pts = [(c[0] + r * math.cos(math.radians(lerp(a0, a1, i / n))),
                c[1] + r * math.sin(math.radians(lerp(a0, a1, i / n)))) for i in range(n + 1)]
        self.line(pts, w, col, amp=0.8)


def bezier(p0, p1, p2, n=16):
    return [((1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0],
             (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]) for u in (i / n for i in range(n + 1))]


# ---------------------------------------------------------------- faces
def face(cv, c, r, kind="neutral", look=(0, 0), mouth=0.0, t=0.0, tear=0.0):
    x, y = c
    ex = 0.32 * r
    eyes = [(x - ex + look[0] * 0.1 * r, y - 0.04 * r + look[1] * 0.1 * r),
            (x + ex + look[0] * 0.1 * r, y - 0.04 * r + look[1] * 0.1 * r)]
    my = y + 0.42 * r
    if kind in ("neutral", "blank", "confused"):
        er = 0.075 * r if kind != "blank" else 0.05 * r
        for e in eyes:
            cv.dot(e, er)
        if kind == "confused":
            cv.line([(eyes[0][0] - 0.12 * r, eyes[0][1] - 0.3 * r), (eyes[0][0] + 0.12 * r, eyes[0][1] - 0.36 * r)], 0.07 * r)
            cv.line([(x - 0.18 * r, my), (x - 0.06 * r, my - 0.05 * r), (x + 0.06 * r, my + 0.03 * r), (x + 0.18 * r, my - 0.03 * r)], 0.06 * r)
        else:
            cv.line([(x - 0.14 * r, my), (x + 0.14 * r, my)], 0.06 * r)
    elif kind == "happy":
        for e in eyes:
            cv.arc((e[0], e[1] + 0.06 * r), 0.11 * r, 200, 340, 0.06 * r)
        cv.arc((x, my - 0.12 * r), 0.2 * r, 20, 160, 0.065 * r)
    elif kind == "sly":
        for e in eyes:
            cv.dot((e[0], e[1] + 0.03 * r), 0.07 * r)
            cv.line([(e[0] - 0.13 * r, e[1] - 0.04 * r), (e[0] + 0.13 * r, e[1] - 0.02 * r)], 0.06 * r)
        cv.line(bezier((x - 0.2 * r, my), (x + 0.05 * r, my + 0.1 * r), (x + 0.24 * r, my - 0.1 * r)), 0.06 * r)
    elif kind == "sad":
        for i, e in enumerate(eyes):
            cv.ellipse(e, 0.17 * r, w=0.05 * r, fill=(255, 255, 255))
            cv.dot((e[0] + 0.02 * r, e[1] + 0.04 * r), 0.1 * r)
            cv.dot((e[0] - 0.03 * r, e[1] - 0.01 * r), 0.035 * r, (255, 255, 255))
            sx = -1 if i == 0 else 1
            cv.line([(e[0] - sx * 0.04 * r, e[1] - 0.32 * r), (e[0] + sx * 0.18 * r, e[1] - 0.22 * r)], 0.06 * r)
        cv.arc((x, my + 0.12 * r), 0.13 * r, 205, 335, 0.06 * r)
        if tear > 0:
            ty = eyes[0][1] + 0.2 * r + tear * 0.6 * r
            cv.ellipse((eyes[0][0] - 0.05 * r, ty), 0.05 * r, 0.075 * r, w=0.025 * r, fill=BLUE)
    elif kind == "angry":
        for i, e in enumerate(eyes):
            cv.dot((e[0], e[1] + 0.03 * r), 0.075 * r)
            sx = 1 if i == 0 else -1  # inner end low
            cv.line([(e[0] - sx * 0.2 * r, e[1] - 0.34 * r), (e[0] + sx * 0.16 * r, e[1] - 0.16 * r)], 0.09 * r)
        if mouth > 0.08:
            h = 0.06 * r + 0.24 * r * mouth
            cv.ellipse((x, my + 0.02 * r), 0.2 * r, h, w=0.06 * r, fill=(120, 30, 35))
        else:
            cv.poly([(x - 0.2 * r, my - 0.04 * r), (x + 0.2 * r, my - 0.04 * r), (x + 0.2 * r, my + 0.06 * r),
                     (x - 0.2 * r, my + 0.06 * r)], fill=(255, 255, 255), w=0.05 * r, amp=0.6)
            cv.line([(x - 0.2 * r, my + 0.01 * r), (x + 0.2 * r, my + 0.01 * r)], 0.03 * r)
    elif kind == "shock":
        for e in eyes:
            cv.ellipse(e, 0.15 * r, w=0.05 * r, fill=(255, 255, 255))
            cv.dot(e, 0.04 * r)
        cv.ellipse((x, my + 0.04 * r), 0.09 * r, 0.13 * r, w=0.06 * r, fill=(120, 30, 35))
    elif kind == "creepy":
        wig = math.sin(t * 22) * 0.07 * r
        for i, e in enumerate(eyes):
            cv.dot(e, 0.075 * r)
            sx = -1 if i == 0 else 1
            cv.arc((e[0], e[1] - 0.2 * r - wig - 0.05 * r), 0.15 * r, 205, 335, 0.06 * r)
        cv.poly([(x - 0.28 * r, my - 0.06 * r), (x + 0.28 * r, my - 0.06 * r), (x + 0.16 * r, my + 0.14 * r),
                 (x - 0.16 * r, my + 0.14 * r)], fill=(255, 255, 255), w=0.06 * r, amp=0.6)
        cv.line([(x - 0.24 * r, my + 0.02 * r), (x + 0.24 * r, my + 0.02 * r)], 0.03 * r)
    elif kind == "smug":
        for e in eyes:
            cv.arc((e[0], e[1] - 0.02 * r), 0.1 * r, 20, 160, 0.06 * r)
            cv.line([(e[0] - 0.12 * r, e[1] - 0.24 * r), (e[0] + 0.12 * r, e[1] - 0.28 * r)], 0.06 * r)
        cv.line(bezier((x - 0.2 * r, my), (x + 0.05 * r, my + 0.12 * r), (x + 0.24 * r, my - 0.08 * r)), 0.06 * r)
    return eyes


# ---------------------------------------------------------------- characters
def figure(cv, x, gy, s=1.0, a1=(-18, -8), a2=(18, 8), l1=(-10, -4), l2=(10, 4), lean=0.0,
           kind="S1", face_kind="neutral", look=(0, 0), mouth=0.0, t=0.0, tear=0.0, dad=0.0, w=7):
    """Stick figure standing on ground y=gy. Arm/leg angles: 0 = down, +90 = screen right."""
    lw = w * s
    hip = (x, gy - 118 * s)
    neck = (x + lean * s, gy - 252 * s)
    r = 60 * s
    head = (neck[0] + lean * 0.25 * s, neck[1] - r * 0.92)
    sh = (lerp(neck[0], hip[0], 0.12), lerp(neck[1], hip[1], 0.12))
    hands = []
    for a in (a1, a2):
        e = add(sh, dirv(a[0]), 64 * s)
        h = add(e, dirv(a[1]), 58 * s)
        cv.line([sh, e, h], lw)
        hands.append(h)
    for l in (l1, l2):
        k = add(hip, dirv(l[0]), 62 * s)
        f = add(k, dirv(l[1]), 62 * s)
        cv.line([hip, k, f], lw)
    cv.line([neck, hip], lw)
    # hair behind the head outline
    if kind == "S4":
        cv.ellipse((head[0] + 0.95 * r, head[1] - 0.1 * r), 0.32 * r, 0.5 * r, w=lw * 0.8, fill=INK, rot=-20)
    cv.ellipse(head, r, w=lw, fill=PAPER)
    if kind == "B":
        pts = []
        for i in range(13):
            th = math.radians(lerp(165, 15, i / 12))
            rr = r * (1.0 if i % 2 == 0 else 1.32 + 0.06 * hn(i, 7))
            pts.append((head[0] + rr * math.cos(th), head[1] - rr * math.sin(th)))
        cv.line(pts, lw * 0.85)
        if dad < 0.5:
            for sx in (-1, 1):
                cv.line(bezier((head[0] + sx * 0.04 * r, head[1] + 0.25 * r), (head[0] + sx * 0.2 * r, head[1] + 0.22 * r),
                               (head[0] + sx * 0.36 * r, head[1] + 0.33 * r), 6), lw * 0.55)
    elif kind == "S1":
        cv.poly([(head[0] - 0.95 * r, head[1] - 0.25 * r), (head[0] - 0.7 * r, head[1] - 0.8 * r),
                 (head[0] + 0.1 * r, head[1] - 1.02 * r), (head[0] + 0.8 * r, head[1] - 0.7 * r),
                 (head[0] + 0.98 * r, head[1] - 0.25 * r), (head[0] + 0.2 * r, head[1] - 0.5 * r)],
                fill=INK, w=lw * 0.6, amp=1.2)
    elif kind == "S2":
        for i in range(7):
            th = math.radians(lerp(160, 20, i / 6))
            cv.ellipse((head[0] + r * 0.95 * math.cos(th), head[1] - r * 0.95 * math.sin(th)), 0.2 * r, w=lw * 0.6, fill=INK)
    elif kind == "S3":
        cv.poly([(head[0] - 0.98 * r, head[1] - 0.2 * r), (head[0] - 0.75 * r, head[1] - 0.75 * r),
                 (head[0], head[1] - 1.02 * r), (head[0] + 0.75 * r, head[1] - 0.75 * r),
                 (head[0] + 0.98 * r, head[1] - 0.2 * r)], fill=BLUE, w=lw * 0.8, amp=1.2)
        cv.line([(head[0] + 0.6 * r, head[1] - 0.25 * r), (head[0] + 1.55 * r, head[1] - 0.15 * r)], lw * 1.2)
    elif kind == "S4":
        cv.poly([(head[0] - 1.0 * r, head[1] + 0.1 * r), (head[0] - 0.8 * r, head[1] - 0.72 * r),
                 (head[0], head[1] - 1.03 * r), (head[0] + 0.8 * r, head[1] - 0.72 * r),
                 (head[0] + 1.0 * r, head[1] + 0.1 * r), (head[0] + 0.4 * r, head[1] - 0.55 * r),
                 (head[0] - 0.4 * r, head[1] - 0.55 * r)], fill=INK, w=lw * 0.6, amp=1.2)
    eyes = face(cv, head, r, face_kind, look, mouth, t, tear)
    if kind == "S1" or dad > 0.5:
        gr = 0.2 * r
        for e in eyes:
            cv.ellipse(e, gr, w=lw * 0.55)
        cv.line([(eyes[0][0] + gr, eyes[0][1]), (eyes[1][0] - gr, eyes[1][1])], lw * 0.5)
    if kind == "B" and dad > 0.5:
        hx, hy = head[0], head[1] + 0.27 * r
        cv.poly([(hx, hy - 0.04 * r), (hx + 0.2 * r, hy - 0.08 * r), (hx + 0.42 * r, hy + 0.02 * r),
                 (hx + 0.48 * r, hy + 0.16 * r), (hx + 0.25 * r, hy + 0.1 * r), (hx, hy + 0.08 * r),
                 (hx - 0.25 * r, hy + 0.1 * r), (hx - 0.48 * r, hy + 0.16 * r), (hx - 0.42 * r, hy + 0.02 * r),
                 (hx - 0.2 * r, hy - 0.08 * r)], fill=INK, w=lw * 0.4, amp=0.8)
    return {"hands": hands, "head": head, "r": r, "hip": hip, "neck": neck}


def walk(t, speed=9.0, amp=28):
    p = t * speed
    return dict(l1=(amp * math.sin(p), amp * math.sin(p) - 8), l2=(-amp * math.sin(p), -amp * math.sin(p) + 8),
                a1=(-18 - amp * 0.6 * math.sin(p), -10 - amp * 0.6 * math.sin(p)),
                a2=(18 + amp * 0.6 * math.sin(p), 10 + amp * 0.6 * math.sin(p)))


# ---------------------------------------------------------------- props
def note(cv, c, rot=0.0, s=1.0):
    hw, hh = 46 * s, 25 * s
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    pts = [(c[0] + x * cr - y * sr, c[1] + x * sr + y * cr) for x, y in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]
    cv.poly(pts, fill=GREEN, w=4.5 * s, amp=1.0)
    cv.ellipse(c, 11 * s, w=3.5 * s)


def stack(cv, c, n, s=1.0):
    for i in range(n):
        note(cv, (c[0] + 3 * hn(i, 3) * s, c[1] - i * 9 * s), 6 * hn(i, 4), s)


def book(cv, c, s=1.0, rot=0.0):
    hw, hh = 52 * s, 38 * s
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    T = lambda x, y: (c[0] + x * cr - y * sr, c[1] + x * sr + y * cr)
    cv.poly([T(-hw, -hh), T(hw, -hh), T(hw, hh), T(-hw, hh)], fill=BLUE, w=5 * s, amp=1.0)
    cv.line([T(0, -hh), T(0, hh)], 4 * s)
    for k in (-0.6, -0.3):
        cv.line([T(-hw * 0.8, hh * k), T(-hw * 0.2, hh * k)], 3 * s)


def razor(cv, c, s=1.0, rot=0.0):
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    T = lambda x, y: (c[0] + x * cr - y * sr, c[1] + x * sr + y * cr)
    cv.line([T(0, 20 * s), T(0, -62 * s)], 12 * s, (110, 110, 120))
    cv.line([T(0, 20 * s), T(0, -62 * s)], 4 * s)
    cv.poly([T(-34 * s, -62 * s), T(34 * s, -62 * s), T(34 * s, -84 * s), T(-34 * s, -84 * s)], fill=SKY, w=5 * s, amp=0.8)
    cv.line([T(-30 * s, -78 * s), T(30 * s, -78 * s)], 3 * s)


def chappal(cv, c, s=1.0, rot=0.0):
    cv.ellipse(c, 26 * s, 62 * s, w=5 * s, fill=BROWN, rot=rot)
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    T = lambda x, y: (c[0] + x * cr - y * sr, c[1] + x * sr + y * cr)
    cv.line([T(-24 * s, 5 * s), T(0, -30 * s), T(24 * s, 5 * s)], 7 * s, (60, 60, 60))


def heart(cv, c, s=1.0):
    pts = []
    for i in range(24):
        u = 2 * math.pi * i / 24
        pts.append((c[0] + s * 16 * math.sin(u) ** 3, c[1] - s * (13 * math.cos(u) - 5 * math.cos(2 * u) - 2 * math.cos(3 * u) - math.cos(4 * u))))
    cv.poly(pts, fill=RED, w=4, amp=0.5)


def sweat(cv, c, s=1.0):
    cv.poly([(c[0], c[1] - 18 * s), (c[0] + 9 * s, c[1]), (c[0] + 6 * s, c[1] + 9 * s), (c[0] - 6 * s, c[1] + 9 * s),
             (c[0] - 9 * s, c[1])], fill=BLUE, w=3.5, amp=0.6)


def sparkle(cv, c, s=1.0):
    for a in (0, 90):
        d = dirv(a)
        cv.line([add(c, d, -34 * s), add(c, d, 34 * s)], 5 * s)
    for a in (45, 135):
        d = dirv(a)
        cv.line([add(c, d, -16 * s), add(c, d, 16 * s)], 4 * s)


def cloud(cv, c, s, t):
    for i in range(14):
        x = c[0] + (-110 + (i * 37) % 220) * s
        ph = (t * 2.6 + i * 0.37) % 1
        y = c[1] + 40 * s + ph * 120 * s
        cv.line([(x, y), (x - 6 * s, y + 26 * s)], 4 * s, BLUE)
    for dx, dy, rr in ((-75, 10, 52), (-20, -25, 66), (50, -10, 58), (100, 18, 44), (10, 28, 55)):
        cv.ellipse((c[0] + dx * s, c[1] + dy * s), rr * s, w=0, fill=(150, 155, 168))
    for dx, dy, rr in ((-75, 10, 52), (-20, -25, 66), (50, -10, 58), (100, 18, 44)):
        cv.ellipse((c[0] + dx * s, c[1] + dy * s), rr * s, w=5 * s, t=0.55)


def dust(cv, c, k):
    for i in range(6):
        a = math.radians(180 + i * 36)
        p = (c[0] + math.cos(a) * 70 * k, c[1] - abs(math.sin(a)) * 40 * k)
        cv.ellipse(p, (24 + 10 * i % 3) * (1.2 - 0.6 * k), w=4, fill=(225, 222, 215))


def burst(cv, c, col_a, col_b, rot, n=20):
    for i in range(n):
        a0 = math.radians(rot + 360 * i / n)
        a1 = math.radians(rot + 360 * (i + 0.5) / n)
        R = 2600
        pts = [c, (c[0] + R * math.cos(a0), c[1] + R * math.sin(a0)), (c[0] + R * math.cos(a1), c[1] + R * math.sin(a1))]
        cv.d.polygon([cv.tp(p) for p in pts], fill=col_a)
    _ = col_b


def ground(cv, y=905, x0=-200, x1=2120):
    cv.line([(x0, y), (x1, y)], 6)
    for gx in (240, 1650):
        cv.line([(gx, y), (gx + 6, y - 22), (gx + 14, y), (gx + 22, y - 18), (gx + 28, y)], 4)


def tint(cv, col):
    cv.d.rectangle((0, 0, W * SS, H * SS), fill=col)


# ---------------------------------------------------------------- scenes
def sc_college(cv, t):
    # Building draws itself, then a quick push in toward the entrance.
    rv = lambda a, b: clamp((t - a) / (b - a))
    push = ease((t - (T_BHADWA - 0.45)) / 0.4)
    cv.z = 1.0 + 0.06 * ease(t / 3) + 2.0 * push
    cv.f = (960, lerp(540, 720, push))
    ground(cv, 875)
    cv.line([(560, 820), (1360, 820)], 6, t=rv(0.0, 0.3))
    cv.line([(560, 820), (560, 390), (1360, 390), (1360, 820)], 6, t=rv(0.0, 0.5))
    cv.poly([(520, 390), (960, 205), (1400, 390)], fill=(240, 226, 200) if t > 0.6 else None, w=0) if t > 0.6 else None
    cv.line([(520, 390), (960, 205), (1400, 390), (520, 390)], 6, t=rv(0.2, 0.7))
    for i, px in enumerate((640, 760, 1160, 1280)):
        cv.line([(px - 18, 410), (px - 18, 800)], 5, t=rv(0.4 + 0.08 * i, 0.8 + 0.08 * i))
        cv.line([(px + 18, 410), (px + 18, 800)], 5, t=rv(0.45 + 0.08 * i, 0.85 + 0.08 * i))
    cv.poly([(890, 820), (890, 640), (1030, 640), (1030, 820)], fill=(180, 120, 80) if t > 0.9 else None, w=0) if t > 0.9 else None
    cv.line([(890, 820), (890, 640), (1030, 640), (1030, 820)], 6, t=rv(0.6, 0.95))
    for k, sy in enumerate((842, 862)):
        cv.line([(540 - 20 * k, sy), (1380 + 20 * k, sy)], 5, t=rv(0.7, 1.0))
    if t > 0.8:
        cv.ellipse((960, 315), 42, w=6, fill=(255, 255, 255), t=rv(0.8, 1.1))
        a = t * 90
        cv.line([(960, 315), add((960, 315), dirv(180 + a), 28)], 5)
        cv.line([(960, 315), add((960, 315), dirv(180 + a * 0.1), 18)], 5)
    if t > 1.0:
        cv.line([(960, 205), (960, 95)], 5, t=rv(1.0, 1.2))
        wv = math.sin(t * 7) * 10
        if t > 1.15:
            cv.poly([(960, 98), (1010, 92 + wv), (1060, 104 + wv * 0.6), (1010, 120 + wv), (960, 132)], fill=ORANGE, w=5)
    for tx in (300, 1620):
        if t > 0.9:
            cv.line([(tx, 875), (tx, 720)], 8, BROWN, t=rv(0.9, 1.1))
        if t > 1.05:
            for dx, dy, rr in ((-45, -10, 60), (40, -20, 62), (0, -70, 70)):
                cv.ellipse((tx + dx, 700 + dy), rr * ease(rv(1.05, 1.35)), w=6, fill=GREEN)
    # tiny students walking in
    for i, (sx, d) in enumerate(((150, 1), (1800, -1), (420, 1))):
        if t > 0.5 + 0.3 * i:
            x = sx + d * (t - 0.5 - 0.3 * i) * 90
            figure(cv, x, 905, 0.32, **walk(t + i), kind=("S2", "S3", "S4")[i], w=9)


def sc_intro_bhadwa(cv, t):
    lt = t - (T_BHADWA - 0.15)
    cv.z = 1.3 + 0.06 * lt
    cv.f = (900, 640)
    ground(cv)
    # wall corner he leans on
    cv.line([(700, 905), (700, 300)], 7)
    cv.line([(560, 905), (560, 300)], 7)
    for by in (380, 470, 560, 650, 740, 830):
        cv.line([(560, by), (700, by)], 4)
    look = (math.sin(lt * 7) * 1.4, 0)
    b = figure(cv, 810, 905, 1.12, a1=(-35, -20), a2=(28, -30), l1=(-22, 15), l2=(8, 2), lean=-26,
               kind="B", face_kind="sly", look=look, t=t)
    # big red arrow pointing at him
    k = ease((t - T_BHADWA) / 0.3)
    if k > 0:
        head = b["head"]
        tip = (head[0] + 95, head[1] - 40)
        pts = bezier((1500, 230), (1350, 520), tip, 18)
        cv.line(pts, 10, RED, t=k)
        if k > 0.95:
            v = (tip[0] - pts[-3][0], tip[1] - pts[-3][1])
            a = math.degrees(math.atan2(v[0], v[1]))
            cv.line([add(tip, dirv(a + 150), 46), tip, add(tip, dirv(a - 150), 46)], 10, RED)


def sc_udhar(cv, t):
    ground(cv)
    cv.z, cv.f = 1.28, (1010, 650)
    lt = t - T_JO
    bx = lerp(520, 800, ease(lt / 0.55))
    pose = walk(t) if lt < 0.55 else {}
    ask = ease((t - (T_PAISE1 - 0.1)) / 0.25)
    if lt >= 0.55:
        pose = dict(a1=(-20, -10), a2=(lerp(18, 72, ask), lerp(8, 92, ask)))
    got = t > T_UDHAR + 0.55
    b = figure(cv, bx, 905, 1.0, **pose, kind="B", face_kind="happy" if got else ("sad" if ask > 0.5 else "sly"), t=t)
    give = ease((t - T_UDHAR) / 0.25)
    s = figure(cv, 1220, 905, 1.0, a1=(lerp(-18, -70, give), lerp(-8, -95, give)), a2=(18, 8),
               kind="S1", face_kind="neutral", look=(-1, 0))
    fly = clamp((t - T_UDHAR - 0.2) / 0.35)
    if give > 0.3:
        p0, p1 = s["hands"][0], b["hands"][1]
        x = lerp(p0[0], p1[0], ease(fly))
        y = lerp(p0[1], p1[1], ease(fly)) - math.sin(math.pi * fly) * 90
        note(cv, (x, y - 12), -20 * math.sin(math.pi * fly * 2), 1.0)


def sc_majboori(cv, t):
    lt = t - (T_APNI - 0.1)
    tint(cv, (232, 238, 247))
    cv.z = 2.0 + 0.15 * ease(lt / 1.7)
    cv.f = (960, 560)
    ground(cv)
    smirk = t > START["bhai"] - 0.42
    b = figure(cv, 960, 905, 1.0, a1=(-28, 128), a2=(28, -128), kind="B",
               face_kind="sly" if smirk else "sad", look=(1.3, 0) if smirk else (0, 0.4),
               tear=clamp(lt / 1.2) if not smirk else 0, t=t)
    cv.ellipse((960, b["hands"][0][1] - 2), 13, w=6, fill=PAPER)
    cloud(cv, (960, 345), 0.9, t)


def sc_bhai(cv, t):
    ground(cv)
    cv.z, cv.f = 0.98, (960, 560)
    studs = [(270, "S2"), (560, "S4"), (1340, "S3"), (1640, "S1")]
    hug = ease((t - T_BHAI + 0.15) / 0.3)
    bx = lerp(960, 1340 - 118, hug)
    fl_times = [T_SABSE - 0.05 + i * 0.27 for i in range(4)]
    received = sum(1 for ft in fl_times if t > ft + 0.33)
    a2 = (lerp(55, 108, hug), lerp(92, 80, hug))
    b = figure(cv, bx, 905, 1.0, a1=(-55, -92), a2=a2, kind="B",
               face_kind="happy" if received else "sly", t=t)
    cx = b["hands"][0]
    stack(cv, (cx[0], cx[1] - 14), received, 0.85)
    for i, (sx, kind) in enumerate(studs):
        give = ease((t - fl_times[i] + 0.2) / 0.2) * (1 - ease((t - fl_times[i] - 0.5) / 0.3))
        d = -1 if sx > bx else 1
        s = figure(cv, sx, 905, 0.92, a1=((-18, -8) if d > 0 else (lerp(-18, -75, give), lerp(-8, -90, give))),
                   a2=((lerp(18, 75, give), lerp(8, 90, give)) if d > 0 else (18, 8)),
                   kind=kind, face_kind="happy" if (i == 2 and hug > 0.5) else "neutral", look=(-d * -1, 0))
        fly = clamp((t - fl_times[i]) / 0.33)
        if 0 < fly < 1:
            p0 = s["hands"][1] if d > 0 else s["hands"][0]
            x = lerp(p0[0], cx[0], ease(fly))
            y = lerp(p0[1], cx[1] - 14, ease(fly)) - math.sin(math.pi * fly) * 120
            note(cv, (x, y), 30 * math.sin(fly * 6), 0.85)
    if hug > 0.6:
        k = clamp((t - T_BHAI - 0.1) / 0.6)
        for i, dx in enumerate((-30, 40, 0)):
            heart(cv, (1280 + dx, 520 - 120 * k - 40 * i), 2.2 * back_out(clamp(k * 2 - i * 0.3)))


def sc_dene(cv, t):
    ground(cv)
    cv.z, cv.f = 1.28, (950, 650)
    lt = t - START["baap"]
    sx = lerp(300, 720, ease(lt / 0.55))
    pose = walk(t) if lt < 0.55 else dict(a2=(lerp(18, 75, ease((lt - 0.55) / 0.2)), lerp(8, 95, ease((lt - 0.55) / 0.2))))
    figure(cv, sx, 905, 1.0, **pose, kind="S1", face_kind="happy" if lt > 0.6 else "neutral")
    freeze = t > T_BAAT - 0.05
    hide = ease((t - T_BAAT - 0.35) / 0.3)
    b = figure(cv, 1180, 905, 1.0, a1=(lerp(-50, 10, hide), lerp(-85, 30, hide)), a2=(18, 8), kind="B",
               face_kind="blank" if freeze else "happy", t=t)
    hand = b["hands"][0]
    if hide < 1:
        stack(cv, (hand[0], hand[1] - 14), 4, 0.85 * (1 - hide))
    if freeze:
        for i in range(2):
            k = clamp((t - T_BAAT - 0.1 - 0.25 * i) / 0.6)
            sweat(cv, (b["head"][0] + 75 + 20 * i, b["head"][1] - 40 + 70 * k), 1.6)


def giant_b(cv, t, s, mouth=0.0, a1=(-25, -15), a2=(105, 140), shout=False):
    b = figure(cv, 1230, 925, s, a1=a1, a2=a2, l1=(-16, -8), l2=(16, 8), kind="B", face_kind="angry",
               mouth=mouth, t=t, dad=1.0 if s > 1.3 else 0.0, w=7)
    if s > 1.3:
        h = b["hands"][1]
        chappal(cv, (h[0] + 6, h[1] - 40 * s / 2), s / 2 * 1.25, 10 * math.sin(t * 9))
    if shout and mouth > 0.25:
        hx, hy = b["head"][0] - b["r"] * 0.7, b["head"][1] + b["r"] * 0.45
        for i, a in enumerate((-125, -95, -65)):
            d = dirv(a)
            cv.line([add((hx, hy), d, 10 + 14 * mouth), add((hx, hy), d, 40 + 40 * mouth)], 7)
    return b


def sc_baap(cv, t):
    k = back_out((t - T_BAAP + 0.12) / 0.45)
    on = t > T_BAAP - 0.12
    if on:
        tint(cv, (255, 236, 220))
        burst(cv, (1230, 420), (250, 200, 180), None, t * 20)
    sh = 18 * max(0, 1 - (t - T_BAAP) / 0.8) if on else 0
    cv.shake = (sh * hn(cv.frame, 1), sh * hn(cv.frame, 2))
    cv.z, cv.f = 1.0, (960, 560)
    ground(cv, 925)
    s = 1.0 + 1.05 * k if on else 1.0
    giant_b(cv, t, s, a1=(-50, 40) if s > 1.3 else (-18, -8), a2=(105, 140) if s > 1.3 else (18, 8))
    ss = lerp(1.0, 0.72, ease((t - T_BAAP) / 0.4)) if on else 1.0
    jit = 4 * hn(cv.frame, 5) if on else 0
    stud = figure(cv, 600 + jit, 925, ss, a2=(60, 120) if on else (75, 95), kind="S1",
                  face_kind="shock" if on else "happy", l1=(-6, 6), l2=(6, -6))
    if on:
        for i in range(2):
            kk = clamp((t - T_BAAP - 0.2 * i) % 0.9 / 0.9)
            sweat(cv, (stud["head"][0] - 60 - 25 * i, stud["head"][1] - 30 + 60 * kk), 1.2)


def sc_rant(cv, t):
    tint(cv, (255, 240, 228))
    burst(cv, (1230, 420), (252, 218, 202), None, t * 12)
    cv.z = 1.0 + 0.08 * ease((t - START["rant"]) / 3)
    cv.f = (960, 540)
    ground(cv, 925)
    m = mouth_at(t)
    jab = 6 * math.sin(t * 30) if T_DEKHO < t < T_PADHAI - 0.3 else 0
    b = giant_b(cv, t, 2.05, mouth=m, a1=(-62 + jab, -82 + jab), shout=True)
    h = b["hands"][0]
    d = dirv(-82 + jab)
    cv.line([h, add(h, d, 34)], 9)
    jit = 3 * hn(cv.frame, 5)
    stud = figure(cv, 560 + jit, 925, 0.72, a1=(10, 150), a2=(-10, -150), l1=(-6, 6), l2=(6, -6),
                  kind="S1", face_kind="shock", look=(1, -1))
    for i in range(2):
        kk = clamp((t - 0.3 * i) % 0.8 / 0.8)
        sweat(cv, (stud["head"][0] - 55 - 22 * i, stud["head"][1] - 25 + 55 * kk), 1.1)


def sc_padhai(cv, t):
    tint(cv, (255, 244, 234))
    burst(cv, (1230, 420), (253, 228, 214), None, t * 12)
    cv.z, cv.f = 1.08, (960, 540)
    ground(cv, 925)
    m = mouth_at(t)
    b = giant_b(cv, t, 2.05, mouth=m, a1=(-55, -72), shout=True)
    h = b["hands"][0]
    cv.line([h, add(h, dirv(-72), 34)], 9)
    k = back_out((t - T_PADHAI) / 0.3)
    stud = figure(cv, 560, 925, 0.72, a1=(-30, 120), a2=(30, -120), kind="S1", face_kind="sad", look=(0, 1.2))
    if k > 0:
        hh = stud["hands"][0]
        book(cv, (560, hh[1] - 8), 0.75 * k)


def sc_razor(cv, t):
    cv.z, cv.f = 1.28, (900, 640)
    ground(cv)
    lt = t - T_MEKO
    raise_ = ease((lt + 0.1) / 0.35)
    down = t > T_JHAAT - 0.05
    b = figure(cv, 1130, 905, 1.1, a1=(-18, -8) if not down else (-30, 10),
               a2=(lerp(18, 100, raise_), lerp(8, 150, raise_)), kind="B",
               face_kind="smug", look=(0, 1.6) if down else (0.6, -0.8), t=t)
    h = b["hands"][1]
    razor(cv, (h[0], h[1] + 4), 1.05, -12)
    tk = clamp((t - T_MEKO - 0.25) / 0.45)
    if 0 < tk < 1:
        sparkle(cv, (h[0] + 30, h[1] - 95), 1.4 * math.sin(math.pi * tk))
    if down:
        for i in range(3):
            kk = clamp((t - T_JHAAT - 0.1 * i) / 0.25)
            sparkle(cv, (b["hip"][0] - 50 + 50 * i, b["hip"][1] + 20 - 15 * i), 0.8 * math.sin(math.pi * kk))
    stud = figure(cv, 640, 905, 1.0, a1=(-30, 120), a2=(30, -120), kind="S1", face_kind="confused", look=(1, 0))
    book(cv, (640, stud["hands"][0][1] - 8), 0.95)


def sc_madad(cv, t):
    cv.z, cv.f = 1.28, (900, 640)
    ground(cv)
    lt = t - (T_TU - 0.1)
    lean = ease(lt / 0.35)
    run_t = t - (END - 0.62)
    b = figure(cv, lerp(1130, 1000, lean), 905, 1.1, a1=(lerp(-18, -78, lean), lerp(-8, -100, lean)), a2=(18, 8),
               lean=-30 * lean, kind="B", face_kind="creepy" if run_t < 0.25 else "blank", t=t)
    h = b["hands"][0]
    razor(cv, (h[0] - 4, h[1] + 4), 1.05, -70)
    shock = t > END - 1.0
    if run_t < 0:
        jump = -40 * math.sin(math.pi * clamp((t - (END - 1.0)) / 0.25)) if shock else 0
        stud = figure(cv, 640, 905 + jump, 1.0, a1=(-30, 120) if not shock else (-150, -170),
                      a2=(30, -120) if not shock else (150, 170), kind="S1",
                      face_kind="shock" if shock else "confused", look=(1, 0))
        if not shock:
            book(cv, (640, stud["hands"][0][1] - 8), 0.95)
        else:
            for i in range(2):
                sweat(cv, (stud["head"][0] - 70 - 25 * i, stud["head"][1] - 20 + 10 * i), 1.5)
    else:
        x = 640 - 1800 * run_t
        figure(cv, x, 905, 1.0, **walk(t, 26, 45), lean=-28, kind="S1", face_kind="shock")
        dust(cv, (700, 900), clamp(run_t / 0.4))
    if shock:
        book(cv, (720, 885), 0.95, 8)


SCENES = [
    (T_BHADWA - 0.15, sc_college),
    (T_JO - 0.05, sc_intro_bhadwa),
    (T_APNI - 0.1, sc_udhar),
    (START["bhai"] - 0.05, sc_majboori),
    (START["baap"] - 0.1, sc_bhai),
    (T_TAB, sc_dene),
    (START["rant"], sc_baap),
    (T_PADHAI - 0.1, sc_rant),
    (T_MEKO - 0.1, sc_padhai),
    (T_TU - 0.1, sc_razor),
    (END + 1, sc_madad),
]


def render_frame(i):
    t = i / FPS
    cv = Canvas(i)
    for end, fn in SCENES:
        if t < end:
            fn(cv, t)
            break
    return cv.img.resize((W, H), Image.LANCZOS).tobytes()


def main():
    os.makedirs(os.path.join(ROOT, "renders"), exist_ok=True)
    if sys.argv[1] == "stills":
        for ts in sys.argv[2].split(","):
            i = int(float(ts) * FPS)
            Image.frombytes("RGB", (W, H), render_frame(i)).save(os.path.join(ROOT, f"renders/still_{float(ts):05.2f}.png"))
        return
    n = int(END * FPS)
    out = os.path.join(ROOT, "renders/video.mp4")
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "17",
                           "-preset", "medium", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for k, buf in enumerate(pool.imap(render_frame, range(n), chunksize=4)):
            ff.stdin.write(buf)
            if k % 60 == 0:
                print(f"frame {k}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("wrote", out, f"{n / FPS:.2f}s")


if __name__ == "__main__":
    main()
