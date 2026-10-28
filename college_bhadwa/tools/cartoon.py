"""Full-colour 2D cartoon renderer for the college bhadwa demo.

Same timeline and story beats as render.py, drawn as a coloured cartoon: thick dark
outlines, flat fills with soft cel shading and rim highlights (the "little 3D" look),
painted, slightly blurred backgrounds with perspective floors, ground shadows,
parallax camera and a vignette. No text on screen.

    python tools/cartoon.py stills 3.8,14.6      -> renders/cartoon_*.png
    python tools/cartoon.py video                -> renders/cartoon.mp4 (silent)
"""
import math
import os
import subprocess
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R  # noqa: E402  (timeline, word times, lip-sync envelope)
from render import add, back_out, clamp, dirv, ease, hn, lerp  # noqa: E402

ROOT = R.ROOT
W, H, FPS, SS = 1920, 1080, 24, 2
OUT = (40, 26, 34)
BGX, BGY = 240, 135  # backgrounds extend this far past the frame on each side (world px)


def mix(c, k, to=(0, 0, 0)):
    return tuple(int(lerp(a, b, k)) for a, b in zip(c, to))


def shade_of(c, k):
    return tuple(int(v * (1 - k) + w * k) for v, w in zip(c, (45, 25, 70)))


def light_of(c, k):
    return mix(c, k, (255, 250, 235))


# ---------------------------------------------------------------- geometry
def ell(c, rx, ry=None, rot=0.0, n=56):
    ry = rx if ry is None else ry
    cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = rx * math.cos(a), ry * math.sin(a)
        out.append((c[0] + x * cr - y * sr, c[1] + x * sr + y * cr))
    return out


def smooth(pts, closed=True, n=6):
    m = len(pts)
    out = []
    rng_ = range(m) if closed else range(m - 1)
    for i in rng_:
        p0 = pts[(i - 1) % m] if closed else pts[max(i - 1, 0)]
        p1, p2 = pts[i], pts[(i + 1) % m]
        p3 = pts[(i + 2) % m] if closed else pts[min(i + 2, m - 1)]
        for k in range(n):
            u = k / n
            u2, u3 = u * u, u * u * u
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3) for j in (0, 1)))
    if not closed:
        out.append(pts[-1])
    return out


def rpoly(pts, r=0.22):
    """Round the corners of a polygon."""
    m = len(pts)
    out = []
    for i in range(m):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % m]
        out.append((lerp(b[0], a[0], r), lerp(b[1], a[1], r)))
        out.append((lerp(b[0], c[0], r), lerp(b[1], c[1], r)))
    return smooth(out, True, 4)


def rot_pts(pts, c, deg):
    cr, sr = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    return [(c[0] + (x - c[0]) * cr - (y - c[1]) * sr, c[1] + (x - c[0]) * sr + (y - c[1]) * cr) for x, y in pts]


# ---------------------------------------------------------------- canvas
class Fr:
    def __init__(self, img, ox=0, oy=0):
        self.img = img
        self.z = 1.0
        self.f = (960.0, 540.0)
        self.shake = (0.0, 0.0)
        self.ox, self.oy = ox, oy

    def tp(self, p):
        return (((p[0] - self.f[0]) * self.z + 960 + self.shake[0] + self.ox) * SS,
                ((p[1] - self.f[1]) * self.z + 540 + self.shake[1] + self.oy) * SS)

    def _box(self, sp, extra):
        xs = [p[0] for p in sp]
        ys = [p[1] for p in sp]
        x0, y0 = int(min(xs) - extra), int(min(ys) - extra)
        x1, y1 = int(max(xs) + extra) + 1, int(max(ys) + extra) + 1
        iw, ih = self.img.size
        if x1 < 0 or y1 < 0 or x0 > iw or y0 > ih:
            return None
        return x0, y0, x1, y1, max(xs) - min(xs), max(ys) - min(ys)

    @staticmethod
    def _tube(d, lp, w):
        d.line(lp, fill=255, width=max(1, int(w)), joint="curve")
        r = w / 2
        for p in (lp[0], lp[-1]):
            d.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=255)

    def part(self, pts, fill, ow=3.6, shade=0.24, hi=0.16, tube=None, stripes=None, outline=OUT, sd=None):
        k = self.z * SS
        sp = [self.tp(p) for p in pts]
        tw = (tube or 0) * k
        owp = ow * k
        bx = self._box(sp, tw / 2 + owp + 2)
        if bx is None:
            return
        bw, bh = bx[4] + tw, bx[5] + tw
        d = int(sd * k) if sd else int(max(3, (0.28 * tw) if tube else 0.15 * min(bw, bh)))
        pad = int(tw / 2 + owp + d + 4)
        x0, y0 = int(min(p[0] for p in sp)) - pad, int(min(p[1] for p in sp)) - pad
        x1, y1 = int(max(p[0] for p in sp)) + pad, int(max(p[1] for p in sp)) + pad
        size = (x1 - x0, y1 - y0)
        lp = [(x - x0, y - y0) for x, y in sp]
        m = Image.new("L", size, 0)
        dm = ImageDraw.Draw(m)
        if tube:
            self._tube(dm, lp, tw)
        else:
            dm.polygon(lp, fill=255)
        if owp > 0:
            o = Image.new("L", size, 0)
            do = ImageDraw.Draw(o)
            if tube:
                self._tube(do, lp, tw + 2 * owp)
            else:
                do.polygon(lp, fill=255)
                do.line(lp + [lp[0], lp[1]], fill=255, width=max(1, int(2 * owp)), joint="curve")
            self.img.paste(outline, (x0, y0), o)
        self.img.paste(fill, (x0, y0), m)
        a = np.asarray(m) > 127
        if stripes:
            col, period, frac = stripes
            per = max(2, int(period * k))
            yy = (np.arange(size[1])[:, None] + y0) % per < per * frac
            st = Image.fromarray(((a & yy) * 255).astype(np.uint8))
            self.img.paste(col, (x0, y0), st)
        if shade > 0:
            dx, dy = int(d * 0.6), d
            sh = a & ~np.roll(a, (-dy, -dx), (0, 1))
            sm = Image.fromarray((sh * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(1, d * 0.4)))
            sm = Image.fromarray(np.minimum(np.asarray(sm), np.asarray(m)))
            self.img.paste(shade_of(fill, shade), (x0, y0), sm)
        if hi > 0:
            d2 = max(2, d // 2)
            hl = a & ~np.roll(a, (d2, int(d2 * 0.6)), (0, 1))
            hm = Image.fromarray((hl * 150).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(1, d2 * 0.5)))
            hm = Image.fromarray(np.minimum(np.asarray(hm), np.asarray(m)))
            self.img.paste(light_of(fill, hi * 2), (x0, y0), hm)

    def soft(self, pts, col, alpha, blur):
        k = self.z * SS
        sp = [self.tp(p) for p in pts]
        b = blur * k
        bx = self._box(sp, 3 * b + 2)
        if bx is None:
            return
        x0, y0, x1, y1 = bx[:4]
        m = Image.new("L", (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(m).polygon([(x - x0, y - y0) for x, y in sp], fill=int(255 * alpha))
        if b > 0.5:
            m = m.filter(ImageFilter.GaussianBlur(b))
        self.img.paste(col, (x0, y0), m)

    def line(self, pts, w, col=OUT):
        sp = [self.tp(p) for p in pts]
        ww = max(1, w * self.z * SS)
        d = ImageDraw.Draw(self.img)
        d.line(sp, fill=col, width=int(ww), joint="curve")
        r = ww / 2
        for p in (sp[0], sp[-1]):
            d.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=col)


# ---------------------------------------------------------------- characters
SKIN_B = (190, 128, 88)
BUNTY = dict(skin=SKIN_B, hair=(34, 26, 32), style="spiky", shirt=(250, 196, 50), stripes=((214, 92, 48), 26, 0.35),
             pants=(58, 72, 120), shoes=(236, 236, 236), stubble=True, chain=True)
GOLU = dict(skin=(234, 182, 140), hair=(28, 24, 32), style="neat", shirt=(60, 178, 170), pants=(130, 96, 70),
            shoes=(214, 64, 64), glasses=True, bag=(226, 92, 70), chubby=True)
CURLY = dict(skin=(205, 146, 104), hair=(118, 38, 52), style="curly", shirt=(240, 124, 150), pants=(64, 86, 140),
             shoes=(250, 250, 250))
CAPPY = dict(skin=(176, 118, 82), hair=(30, 24, 30), style="cap", cap=(72, 168, 96), shirt=(236, 236, 244),
             pants=(50, 50, 64), shoes=(250, 160, 40))
PINKY = dict(skin=(238, 192, 152), hair=(36, 26, 34), style="pony", shirt=(150, 102, 210), pants=(120, 170, 220),
             shoes=(250, 250, 250), lashes=True)


def brow(fr, p1, p2, th, col, arch=0.0):
    mid = ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 - arch)
    fr.part(smooth([p1, mid, p2], closed=False, n=5), col, ow=0, shade=0, hi=0, tube=th)


def eye(fr, e, rx, ry, pup, pr, lid=0.0, skin=(200, 150, 110), shine=True, low_lid=0.0):
    fr.part(ell(e, rx, ry), (255, 255, 255), ow=2.6, shade=0.08, hi=0)
    px = clamp(pup[0], -1, 1) * (rx - pr * 1.1)
    py = clamp(pup[1], -1, 1) * (ry - pr * 1.1)
    c = (e[0] + px, e[1] + py)
    fr.part(ell(c, pr), (30, 22, 30), ow=0, shade=0, hi=0)
    if shine:
        fr.part(ell((c[0] - pr * 0.35, c[1] - pr * 0.4), pr * 0.38), (255, 255, 255), ow=0, shade=0, hi=0)
    if lid > 0:
        yl = e[1] - ry + 2 * ry * lid
        pts = [p for p in ell(e, rx * 1.06, ry * 1.06, n=72) if p[1] <= yl]
        if len(pts) > 2:
            pts.sort(key=lambda p: math.atan2(p[1] - e[1], p[0] - e[0]))
            fr.part(pts + [(e[0] + rx * 1.06, yl), (e[0] - rx * 1.06, yl)] if False else pts, skin, ow=2.6, shade=0.12, hi=0)
            fr.line([(e[0] - rx * 1.0, yl), (e[0] + rx * 1.0, yl)], 3.2)
    if low_lid > 0:
        yl = e[1] + ry - 2 * ry * low_lid
        pts = [p for p in ell(e, rx * 1.06, ry * 1.06, n=72) if p[1] >= yl]
        if len(pts) > 2:
            pts.sort(key=lambda p: -math.atan2(p[1] - e[1], p[0] - e[0]))
            fr.part(pts, skin, ow=2.6, shade=0, hi=0)


def mouth_shape(fr, c, R, kind, open_=0.0, face=1, t=0.0):
    x, y = c
    if kind == "open":
        h = R * (0.08 + 0.26 * open_)
        wdt = R * 0.3
        fr.part(ell((x, y + h * 0.3), wdt, h), (110, 24, 36), ow=3.0, shade=0, hi=0)
        if h > R * 0.12:
            fr.part(ell((x, y + h * 0.95), wdt * 0.6, h * 0.45), (236, 110, 120), ow=0, shade=0.2, hi=0)
            fr.part(ell((x, y - h * 0.62), wdt * 0.75, h * 0.22), (255, 255, 255), ow=0, shade=0, hi=0)
    elif kind == "smile":
        fr.part(smooth([(x - R * 0.32, y - R * 0.06), (x, y + R * 0.06), (x + R * 0.32, y - R * 0.06),
                        (x + R * 0.2, y + R * 0.2), (x, y + R * 0.28), (x - R * 0.2, y + R * 0.2)], True, 5),
                (110, 24, 36), ow=3.0, shade=0, hi=0)
        fr.part(ell((x, y + R * 0.19), R * 0.13, R * 0.07), (236, 110, 120), ow=0, shade=0, hi=0)
        fr.part(smooth([(x - R * 0.26, y - R * 0.04), (x + R * 0.26, y - R * 0.04), (x, y + R * 0.06)], True, 4),
                (255, 255, 255), ow=0, shade=0, hi=0)
    elif kind == "grin":
        pts = smooth([(x - R * 0.42, y - R * 0.1), (x, y - R * 0.04), (x + R * 0.42, y - R * 0.1), (x + R * 0.3, y + R * 0.16),
                      (x, y + R * 0.24), (x - R * 0.3, y + R * 0.16)], True, 5)
        fr.part(pts, (255, 255, 255), ow=3.0, shade=0.1, hi=0)
        fr.line([(x - R * 0.36, y + R * 0.05), (x + R * 0.36, y + R * 0.05)], 2.5)
        for k in (-0.2, 0, 0.2):
            fr.line([(x + R * k, y - R * 0.06), (x + R * k, y + R * 0.2)], 2.2)
    elif kind == "smirk":
        fr.line(smooth([(x - R * 0.24, y + R * 0.02), (x + R * 0.04 * face, y + R * 0.1), (x + R * 0.28, y - R * 0.08)], False, 5), 4.2)
    elif kind == "frown":
        wob = math.sin(t * 30) * R * 0.015
        fr.line(smooth([(x - R * 0.2, y + R * 0.1), (x - R * 0.07, y - R * 0.02 + wob), (x + R * 0.07, y - R * 0.02 - wob),
                        (x + R * 0.2, y + R * 0.1)], False, 5), 4.2)
    elif kind == "flat":
        fr.line([(x - R * 0.16, y + R * 0.04), (x + R * 0.16, y + R * 0.04)], 4.2)
    elif kind == "wavy":
        fr.line(smooth([(x - R * 0.2, y + R * 0.04), (x - R * 0.07, y - R * 0.03), (x + R * 0.07, y + R * 0.08),
                        (x + R * 0.2, y)], False, 5), 4.0)
    elif kind == "O":
        fr.part(ell((x, y + R * 0.08), R * 0.12, R * 0.18), (110, 24, 36), ow=3.0, shade=0, hi=0)
        fr.part(ell((x, y + R * 0.18), R * 0.07, R * 0.06), (236, 110, 120), ow=0, shade=0, hi=0)


def draw_face(fr, sp, c, R, expr, face, look, mouth, tear, t, dad):
    x, y = c
    skin = sp["skin"]
    hair = sp["hair"]
    ex = 0.29 * R
    fo = face * 0.07 * R
    E = [(x - ex + fo, y - 0.0 * R), (x + ex + fo, y - 0.0 * R)]
    rx, ry = 0.23 * R, 0.29 * R
    pup = (look[0] + 0.25 * face, look[1])
    pr = 0.085 * R
    lid = 0.0
    brows = [(-0.08, 0.0), (-0.08, 0.0)]  # (tilt: + = inner end lower, raise)
    mk, mopen = "flat", 0.0
    if sp.get("stubble"):
        for i in range(26):
            a = math.radians(25 + 130 * (i / 25))
            rr = R * (0.72 + 0.12 * hn(i, 11))
            fr.part(ell((x + fo + rr * math.cos(a) * 0.95, y + rr * math.sin(a) * 0.95 + R * 0.05), R * 0.018), mix(skin, 0.45),
                    ow=0, shade=0, hi=0)
    for sx in (-1, 1):
        fr.soft(ell((x + fo + sx * 0.42 * R, y + 0.28 * R), 0.15 * R, 0.09 * R), (240, 110, 120), 0.35, 4)
    if expr == "neutral":
        mk = "flat"
    elif expr == "happy":
        mk, brows = "smile", [(-0.15, 0.06), (-0.15, 0.06)]
    elif expr == "sly":
        lid, mk, brows = 0.48, "smirk", [(0.05, 0.0), (-0.2, 0.08)]
    elif expr == "sad":
        rx, ry, pr = rx * 1.18, ry * 1.14, 0.19 * R
        mk, brows = "frown", [(-0.35, 0.05), (-0.35, 0.05)]
    elif expr == "angry":
        mk, mopen, brows, pr = ("open" if mouth > 0.06 else "grin"), mouth, [(0.4, -0.05), (0.4, -0.05)], 0.07 * R
        lid = 0.22
    elif expr == "shock":
        rx, ry, pr = rx * 1.15, ry * 1.18, 0.05 * R
        mk, brows = "O", [(-0.15, 0.14), (-0.15, 0.14)]
    elif expr == "blank":
        pr = 0.05 * R
        mk, brows = "flat", [(0.0, 0.02), (0.0, 0.02)]
    elif expr == "confused":
        mk, brows = "wavy", [(0.25, -0.02), (-0.2, 0.12)]
    elif expr == "smug":
        lid, mk, brows = 0.5, "smirk", [(-0.15, 0.1), (-0.15, 0.1)]
    elif expr == "creepy":
        wig = 0.07 * math.sin(t * 24)
        mk, brows, pr = "grin", [(-0.2, 0.1 + wig), (-0.2, 0.1 + wig)], 0.065 * R
        lid = 0.3
    for i, e in enumerate(E):
        eye(fr, e, rx, ry, pup, pr, lid=lid, skin=skin, shine=expr not in ("blank", "angry"))
        if expr == "sad":
            fr.part(ell((e[0] + pr * 0.5, e[1] + pr * 0.5), pr * 0.22), (255, 255, 255), ow=0, shade=0, hi=0)
    if expr == "happy":
        # squeezed happy eyes: cover whites with closed arcs
        for e in E:
            fr.part(ell(e, rx * 1.12, ry * 1.12), skin, ow=0, shade=0, hi=0)
            fr.line(smooth([(e[0] - rx, e[1] + ry * 0.2), (e[0], e[1] - ry * 0.5), (e[0] + rx, e[1] + ry * 0.2)], False, 5), 5)
    if sp.get("glasses") or dad > 0.5:
        for e in E:
            fr.part(ell(e, rx * 1.3, ry * 1.12), (210, 230, 250), ow=0, shade=0, hi=0) if False else None
            pts = ell(e, rx * 1.32, ry * 1.12)
            fr.line(pts + [pts[0]], 4.2, (30, 30, 40) if dad < 0.5 else (90, 50, 30))
        fr.line([(E[0][0] + rx * 1.3, E[0][1]), (E[1][0] - rx * 1.3, E[1][1])], 4.0)
    for i, e in enumerate(E):
        sx = -1 if i == 0 else 1
        tilt, raise_ = brows[i]
        top = e[1] - ry - 0.07 * R - raise_ * R
        inner = (e[0] - sx * rx * 0.9, top + tilt * R * 0.5)
        outer = (e[0] + sx * rx * 1.05, top - tilt * R * 0.25)
        brow(fr, inner, outer, 0.1 * R if expr != "angry" else 0.13 * R, hair, arch=0.05 * R)
    # nose
    fr.part(ell((x + face * 0.12 * R, y + 0.28 * R), 0.16 * R, 0.12 * R), skin, ow=3.0, shade=0.22, hi=0.1)
    mc = (x + face * 0.08 * R, y + 0.56 * R)
    if sp.get("style") == "spiky":
        if dad > 0.5:
            hx, hy = x + face * 0.1 * R, y + 0.44 * R
            fr.part(smooth([(hx, hy - 0.06 * R), (hx + 0.3 * R, hy - 0.08 * R), (hx + 0.5 * R, hy + 0.08 * R),
                            (hx + 0.28 * R, hy + 0.1 * R), (hx, hy + 0.06 * R), (hx - 0.28 * R, hy + 0.1 * R),
                            (hx - 0.5 * R, hy + 0.08 * R), (hx - 0.3 * R, hy - 0.08 * R)], True, 4), hair, ow=2.4, shade=0.1, hi=0.2)
            mc = (mc[0], mc[1] + 0.08 * R)
        else:
            for sx in (-1, 1):
                fr.line(smooth([(x + face * 0.1 * R + sx * 0.04 * R, y + 0.42 * R), (x + face * 0.1 * R + sx * 0.2 * R, y + 0.41 * R),
                                (x + face * 0.1 * R + sx * 0.32 * R, y + 0.5 * R)], False, 4), 3.6, hair)
    if tear > 0:
        e = E[0]
        ty = e[1] + ry + tear * 0.7 * R
        fr.part(smooth([(e[0], ty - 0.12 * R), (e[0] + 0.07 * R, ty), (e[0], ty + 0.06 * R), (e[0] - 0.07 * R, ty)], True, 4),
                (120, 190, 245), ow=2.4, shade=0.1, hi=0.3)
        fr.soft([(e[0] - 0.04 * R, e[1] + ry), (e[0] + 0.04 * R, e[1] + ry), (e[0] + 0.04 * R, ty), (e[0] - 0.04 * R, ty)],
                (140, 200, 250), 0.6, 1)
    mouth_shape(fr, mc, R, mk, mopen, face, t)


def hair_back(fr, sp, c, R, face):
    if sp["style"] == "pony":
        fr.part(ell((c[0] - face * 1.0 * R, c[1] + 0.2 * R), 0.32 * R, 0.62 * R, rot=face * 25), sp["hair"], shade=0.25)
        fr.part(ell((c[0] - face * 0.82 * R, c[1] - 0.35 * R), 0.13 * R, 0.13 * R), (240, 90, 140), ow=2.6)


def hair_front(fr, sp, c, R, face, t):
    x, y = c
    st, col = sp["style"], sp["hair"]
    if st == "spiky":
        pts = []
        for i in range(15):
            a = math.radians(lerp(195, -15, i / 14))
            rr = R * (1.02 if i % 2 == 0 else 1.32 + 0.08 * hn(i, 3))
            pts.append((x + rr * math.cos(a) * 0.95, y - rr * math.sin(a) * 1.0 - 0.05 * R))
        inner = [(x + 0.9 * R, y - 0.3 * R), (x + 0.45 * R, y - 0.62 * R), (x, y - 0.68 * R), (x - 0.45 * R, y - 0.6 * R),
                 (x - 0.9 * R, y - 0.28 * R)]
        fr.part(pts + inner, col, ow=3.4, shade=0.18, hi=0.3)
    elif st == "neat":
        pts = [(x - 0.98 * R, y - 0.05 * R)] + [(x + R * 1.04 * math.cos(math.radians(a)) * 0.93, y - R * 1.04 * math.sin(math.radians(a)))
                                                for a in range(190, -15, -15)] + [(x + 0.95 * R, y - 0.1 * R)]
        inner = [(x + 0.6 * R, y - 0.5 * R), (x + 0.1 * R * face, y - 0.62 * R), (x - 0.3 * R * face, y - 0.45 * R),
                 (x - 0.75 * R * face, y - 0.38 * R)]
        fr.part(smooth(pts + inner, True, 3), col, ow=3.4, shade=0.2, hi=0.35)
    elif st == "curly":
        for i in range(11):
            a = math.radians(lerp(200, -20, i / 10))
            fr.part(ell((x + 0.95 * R * math.cos(a), y - 0.95 * R * math.sin(a) - 0.1 * R), 0.3 * R), col, ow=3.0, shade=0.25, hi=0.3)
        for i in range(5):
            a = math.radians(lerp(150, 30, i / 4))
            fr.part(ell((x + 0.55 * R * math.cos(a), y - 0.8 * R * math.sin(a) - 0.15 * R), 0.3 * R), col, ow=3.0, shade=0.25, hi=0.3)
    elif st == "cap":
        cap = sp["cap"]
        dome = [(x - 1.0 * R, y - 0.2 * R)] + [(x + R * 1.02 * math.cos(math.radians(a)) * 0.98, y - 0.15 * R - R * 0.95 * math.sin(math.radians(a)))
                                               for a in range(180, -5, -15)] + [(x + 1.0 * R, y - 0.2 * R)]
        fr.part(dome, cap, ow=3.4, shade=0.25, hi=0.3)
        fr.part(rpoly([(x + face * 0.5 * R, y - 0.3 * R), (x + face * 1.55 * R, y - 0.25 * R), (x + face * 1.5 * R, y - 0.12 * R),
                       (x + face * 0.4 * R, y - 0.16 * R)]), mix(cap, 0.2), ow=3.0, shade=0.1)
        fr.part(ell((x, y - 1.12 * R), 0.1 * R), mix(cap, 0.2), ow=2.4)
    elif st == "pony":
        pts = [(x - 1.0 * R, y + 0.1 * R)] + [(x + R * 1.05 * math.cos(math.radians(a)) * 0.95, y - R * 1.05 * math.sin(math.radians(a)))
                                              for a in range(190, -15, -15)] + [(x + 1.0 * R, y + 0.1 * R)]
        inner = [(x + 0.7 * R, y - 0.35 * R), (x + 0.2 * R, y - 0.5 * R), (x - 0.1 * R, y - 0.4 * R), (x - 0.5 * R, y - 0.55 * R),
                 (x - 0.75 * R, y - 0.3 * R)]
        fr.part(smooth(pts + inner, True, 3), col, ow=3.4, shade=0.2, hi=0.35)


def char(fr, sp, x, gy, s=1.0, a1=(-14, -6), a2=(14, 6), l1=(-5, -2), l2=(5, 2), lean=0.0, face=1, expr="neutral",
         look=(0, 0), mouth=0.0, tear=0.0, dad=0.0, t=0.0, bob=0.0, hold=None, shadow=True, point=None):
    """Draw a character standing on y=gy. Limb angles: 0 = down, +90 = screen right."""
    R = 74 * s
    hip = (x, gy - 142 * s + bob)
    neck = (x + lean * s, gy - 262 * s + bob)
    head = (neck[0] + lean * 0.35 * s, neck[1] - R * 0.92)
    if shadow:
        fr.soft(ell((x, gy + 2 * s), 78 * s, 15 * s), (20, 10, 30), 0.32, 7 * s)
    for hx, l in ((x - 17 * s, l1), (x + 17 * s, l2)):
        h = (hx, hip[1])
        k = add(h, dirv(l[0]), 72 * s)
        f = add(k, dirv(l[1]), 70 * s)
        fr.part([h, k, f], sp["pants"], tube=31 * s)
        fr.part(ell((f[0] + face * 13 * s, f[1] - 3 * s), 27 * s, 14 * s), sp["shoes"], shade=0.2)
    hw = 44 if sp.get("chubby") else 36
    torso = rpoly([(neck[0] - 37 * s, neck[1] + 2 * s), (neck[0] + 37 * s, neck[1] + 2 * s),
                   (hip[0] + hw * s, hip[1] + 14 * s), (hip[0] - hw * s, hip[1] + 14 * s)], 0.25)
    fr.part(torso, sp["shirt"], stripes=sp.get("stripes"), shade=0.26)
    if sp.get("bag"):
        for sx in (-1, 1):
            fr.part([(neck[0] + sx * 24 * s, neck[1] + 4 * s), (lerp(neck[0], hip[0], 0.5) + sx * 30 * s, lerp(neck[1], hip[1], 0.7))],
                    sp["bag"], tube=10 * s, ow=2.5, shade=0.1, hi=0)
    fr.part([neck, (neck[0], neck[1] - 20 * s)], sp["skin"], tube=24 * s, shade=0.3)
    if sp.get("chain"):
        fr.line(smooth([(neck[0] - 20 * s, neck[1] + 2 * s), (neck[0], neck[1] + 26 * s), (neck[0] + 20 * s, neck[1] + 2 * s)], False, 5),
                5 * s, (240, 200, 60))
    hair_back(fr, sp, head, R, face)
    for sx in (-1, 1):
        fr.part(ell((head[0] + sx * 0.9 * R, head[1] + 0.08 * R), 0.2 * R, 0.25 * R), sp["skin"], shade=0.25)
    fr.part(ell(head, 0.93 * R, R), sp["skin"], shade=0.2, hi=0.12)
    hair_front(fr, sp, head, R, face, t)
    draw_face(fr, sp, head, R, expr, face, look, mouth, tear, t, dad)
    hands = []
    for sx, a in ((-1, a1), (1, a2)):
        sh = (neck[0] + sx * 30 * s, neck[1] + 18 * s)
        e = add(sh, dirv(a[0]), 66 * s)
        hd = add(e, dirv(a[1]), 60 * s)
        fr.part([sh, e], sp["shirt"], tube=27 * s, shade=0.2)
        fr.part([e, hd], sp["skin"], tube=19 * s, shade=0.25)
        hands.append(hd)
    if hold:
        for i, fn in hold.items():
            fn(hands[i])
    for i, hd in enumerate(hands):
        fr.part(ell(hd, 15 * s), sp["skin"], shade=0.25)
        if point == i:
            d = dirv((a1, a2)[i][1])
            fr.part([hd, add(hd, d, 30 * s)], sp["skin"], tube=10 * s, shade=0.2)
    return {"hands": hands, "head": head, "R": R, "hip": hip, "neck": neck}


def walk(t, speed=9.0, amp=24):
    p = math.sin(t * speed)
    return dict(l1=(amp * p, amp * p - 10), l2=(-amp * p, -amp * p - 10), a1=(-14 - amp * 0.7 * p, -6 - amp * 0.7 * p),
                a2=(14 + amp * 0.7 * p, 6 + amp * 0.7 * p), bob=-abs(math.cos(t * speed)) * 6)


# ---------------------------------------------------------------- props
def note(fr, c, rot=0.0, s=1.0):
    pts = rot_pts(rpoly([(c[0] - 48 * s, c[1] - 26 * s), (c[0] + 48 * s, c[1] - 26 * s), (c[0] + 48 * s, c[1] + 26 * s),
                         (c[0] - 48 * s, c[1] + 26 * s)], 0.12), c, rot)
    fr.part(pts, (140, 210, 120), ow=3.0, shade=0.15, hi=0.2)
    fr.part(rot_pts(rpoly([(c[0] - 38 * s, c[1] - 17 * s), (c[0] + 38 * s, c[1] - 17 * s), (c[0] + 38 * s, c[1] + 17 * s),
                           (c[0] - 38 * s, c[1] + 17 * s)], 0.1), c, rot), (110, 180, 100), ow=0, shade=0, hi=0)
    fr.part(ell(c, 12 * s), (230, 240, 200), ow=2.2, shade=0, hi=0)


def stack(fr, c, n, s=1.0):
    for i in range(n):
        note(fr, (c[0] + 3 * hn(i, 3) * s, c[1] - i * 10 * s), 6 * hn(i, 4), s)


def book(fr, c, s=1.0, rot=0.0):
    pages = rot_pts(rpoly([(c[0] - 50 * s, c[1] - 36 * s), (c[0] + 56 * s, c[1] - 36 * s), (c[0] + 56 * s, c[1] + 42 * s),
                           (c[0] - 50 * s, c[1] + 42 * s)], 0.08), c, rot)
    fr.part(pages, (250, 245, 230), ow=3.0, shade=0.1)
    cover = rot_pts(rpoly([(c[0] - 56 * s, c[1] - 40 * s), (c[0] + 50 * s, c[1] - 40 * s), (c[0] + 50 * s, c[1] + 36 * s),
                           (c[0] - 56 * s, c[1] + 36 * s)], 0.08), c, rot)
    fr.part(cover, (70, 120, 220), ow=3.4, shade=0.25, hi=0.3)
    fr.part(rot_pts([(c[0] - 30 * s, c[1] - 14 * s), (c[0] + 26 * s, c[1] - 14 * s), (c[0] + 26 * s, c[1] + 8 * s),
                     (c[0] - 30 * s, c[1] + 8 * s)], c, rot), (250, 210, 80), ow=2.4, shade=0, hi=0)


def razor(fr, c, s=1.0, rot=0.0):
    handle = rot_pts([(c[0], c[1] + 26 * s), (c[0], c[1] - 64 * s)], c, rot)
    fr.part(handle, (240, 100, 150), tube=15 * s, shade=0.25)
    head = rot_pts(rpoly([(c[0] - 38 * s, c[1] - 64 * s), (c[0] + 38 * s, c[1] - 64 * s), (c[0] + 38 * s, c[1] - 88 * s),
                          (c[0] - 38 * s, c[1] - 88 * s)], 0.2), c, rot)
    fr.part(head, (190, 205, 220), shade=0.25, hi=0.4)
    fr.line(rot_pts([(c[0] - 32 * s, c[1] - 83 * s), (c[0] + 32 * s, c[1] - 83 * s)], c, rot), 3 * s, (255, 255, 255))


def chappal(fr, c, s=1.0, rot=0.0):
    fr.part(ell(c, 30 * s, 66 * s, rot=rot), (70, 120, 220), ow=3.6, shade=0.2)
    fr.part(ell(c, 24 * s, 58 * s, rot=rot), (245, 245, 250), ow=0, shade=0.15, hi=0)
    fr.part(rot_pts(smooth([(c[0] - 26 * s, c[1] + 6 * s), (c[0], c[1] - 34 * s), (c[0] + 26 * s, c[1] + 6 * s)], False, 5), c, rot),
            (70, 120, 220), tube=9 * s, ow=2.4)


def heart(fr, c, s=1.0):
    pts = [(c[0] + s * 16 * math.sin(u) ** 3, c[1] - s * (13 * math.cos(u) - 5 * math.cos(2 * u) - 2 * math.cos(3 * u) - math.cos(4 * u)))
           for u in (2 * math.pi * i / 40 for i in range(40))]
    fr.part(pts, (240, 70, 90), ow=3.0, shade=0.2, hi=0.4)


def sweat(fr, c, s=1.0):
    fr.part(smooth([(c[0], c[1] - 20 * s), (c[0] + 11 * s, c[1] + 2 * s), (c[0], c[1] + 12 * s), (c[0] - 11 * s, c[1] + 2 * s)], True, 4),
            (130, 200, 250), ow=2.6, shade=0.15, hi=0.4)


def sparkle(fr, c, s=1.0):
    if s <= 0.02:
        return
    pts = []
    for i in range(8):
        a = math.radians(45 * i)
        rr = (40 if i % 2 == 0 else 11) * s
        pts.append((c[0] + rr * math.sin(a), c[1] - rr * math.cos(a)))
    fr.part(pts, (255, 236, 120), ow=3.0, shade=0.1, hi=0.3)


def arrow(fr, tip, ang, k, s=1.0):
    """Chunky 3D-ish arrow pointing along angle ang (deg, 0 = down)."""
    if k <= 0:
        return
    L = 230 * s * k
    d = dirv(ang)
    n = (d[1], -d[0])
    base = add(tip, d, -L)
    neck = add(tip, d, -70 * s)
    pts = [tip, add(neck, n, 60 * s), add(neck, n, 24 * s), add(base, n, 24 * s), add(base, n, -24 * s),
           add(neck, n, -24 * s), add(neck, n, -60 * s)]
    fr.part(pts, (236, 64, 70), ow=4.5, shade=0.3, hi=0.35)


def puff(fr, c, r, col=(250, 250, 250)):
    for dx, dy, k in ((-0.7, 0.1, 0.6), (0, -0.2, 0.8), (0.7, 0.05, 0.62), (0.2, 0.3, 0.6), (-0.3, 0.3, 0.55)):
        fr.part(ell((c[0] + dx * r, c[1] + dy * r), k * r), col, ow=3.0, shade=0.2, hi=0)


# ---------------------------------------------------------------- backgrounds
def vgrad(img, box, top, bot):
    x0, y0, x1, y1 = [int(v) for v in box]
    h = y1 - y0
    a = np.linspace(0, 1, h)[:, None, None]
    g = (np.array(top)[None, None, :] * (1 - a) + np.array(bot)[None, None, :] * a).astype(np.uint8)
    img.paste(Image.fromarray(np.repeat(g, x1 - x0, axis=1)), (x0, y0))


def new_bg():
    img = Image.new("RGB", ((W + 2 * BGX) * SS, (H + 2 * BGY) * SS), (0, 0, 0))
    return img, Fr(img, BGX, BGY)


def P(fr, x, y):
    p = fr.tp((x, y))
    return p


def bg_box(fr, x0, y0, x1, y1):
    a, b = fr.tp((x0, y0)), fr.tp((x1, y1))
    return a[0], a[1], b[0], b[1]


def tree(fr, x, gy, s=1.0, col=(90, 170, 80)):
    fr.part([(x, gy), (x - 4 * s, gy - 160 * s)], (130, 86, 54), tube=26 * s, shade=0.3)
    for dx, dy, r in ((-70, -170, 80), (60, -180, 84), (0, -250, 96), (-40, -120, 60), (50, -120, 62)):
        fr.part(ell((x + dx * s, gy + dy * s), r * s), col, ow=3.4, shade=0.3, hi=0.15, sd=30 * s)


def bg_campus():
    img, fr = new_bg()
    vgrad(img, (0, 0, img.size[0], fr.tp((0, 640))[1]), (96, 176, 236), (196, 232, 250))
    fr.soft(ell((1640, 170), 220), (255, 250, 210), 0.6, 60)
    fr.part(ell((1640, 170), 70), (255, 236, 150), ow=0, shade=0.1, hi=0)
    for cx, cy, r in ((300, 160, 70), (900, 110, 55), (1300, 230, 50), (1900, 120, 60)):
        puff(fr, (cx, cy), r)
    for i in range(14):
        x = -200 + i * 180
        fr.part(ell((x, 640), 140, 90 + 20 * hn(i, 1)), (110, 160, 120), ow=0, shade=0.2, hi=0)
    img2 = img.filter(ImageFilter.GaussianBlur(5))
    img.paste(img2)
    vgrad(img, (0, fr.tp((0, 620))[1], img.size[0], img.size[1]), (122, 196, 92), (76, 150, 64))
    # building
    fr.part(rpoly([(380, 860), (380, 330), (1540, 330), (1540, 860)], 0.01), (244, 226, 190), shade=0.12, sd=40)
    fr.part(rpoly([(380, 860), (380, 790), (1540, 790), (1540, 860)], 0.02), (190, 96, 70), shade=0.2, sd=12)
    fr.part(rpoly([(350, 340), (350, 300), (1570, 300), (1570, 340)], 0.05), (200, 90, 70), shade=0.2, sd=10)
    fr.part([(760, 300), (960, 170), (1160, 300)], (200, 90, 70), shade=0.25, sd=20)
    fr.part(ell((960, 255), 34), (255, 255, 250), ow=3.4, shade=0.15)
    fr.line([(960, 255), (960, 232)], 4)
    fr.line([(960, 255), (976, 262)], 4)
    for row, wy in enumerate((400, 590)):
        for i in range(8):
            wx = 450 + i * 140
            if 760 < wx < 1150:
                continue
            fr.part(rpoly([(wx, wy), (wx + 80, wy), (wx + 80, wy + 120), (wx, wy + 120)], 0.05), (110, 176, 226), ow=4, shade=0.3, hi=0.4)
            fr.line([(wx + 40, wy + 2), (wx + 40, wy + 118)], 4)
            fr.soft([(wx + 8, wy + 90), (wx + 50, wy + 10), (wx + 64, wy + 10), (wx + 22, wy + 90)], (255, 255, 255), 0.5, 1)
    for px in (790, 870, 1050, 1130):
        fr.part(rpoly([(px - 20, 820), (px - 20, 360), (px + 20, 360), (px + 20, 820)], 0.1), (252, 248, 240), shade=0.3, hi=0.2, sd=12)
    fr.part(smooth([(905, 820), (905, 640), (960, 590), (1015, 640), (1015, 820)], True, 3), (150, 92, 60), shade=0.3, sd=14)
    for k, sy in enumerate((862, 890)):
        fr.part(rpoly([(740 - 30 * k, sy - 2), (1180 + 30 * k, sy - 2), (1180 + 30 * k, sy + 26), (740 - 30 * k, sy + 26)], 0.05),
                (214, 210, 204), shade=0.2, sd=8)
    fr.part([(910, 916), (1010, 916), (1300, 1215), (620, 1215)], (230, 206, 160), shade=0.08, sd=30)
    tree(fr, 190, 900, 1.2)
    tree(fr, 1740, 900, 1.25, (80, 160, 78))
    for bx in (520, 1400):
        puff(fr, (bx, 880), 46, (90, 170, 80))
    return img.filter(ImageFilter.GaussianBlur(1.2))


def bg_corridor():
    img, fr = new_bg()
    vgrad(img, (0, 0, img.size[0], fr.tp((0, 560))[1]), (250, 236, 200), (240, 218, 176))
    vgrad(img, (0, fr.tp((0, 560))[1], img.size[0], fr.tp((0, 780))[1]), (78, 156, 160), (58, 126, 134))
    fr.part([(-300, 552), (2300, 552), (2300, 572), (-300, 572)], (60, 110, 116), ow=0, shade=0, hi=0)
    # floor tiles in perspective
    vp = (960, 380)
    ys = [780, 805, 840, 890, 960, 1060, 1215, 1500]
    xs = [-3600 + 300 * i for i in range(30)]

    def px(X, y):
        return vp[0] + (X - vp[0]) * (y - vp[1]) / (1215 - vp[1])
    for r in range(len(ys) - 1):
        for c in range(len(xs) - 1):
            y0, y1 = ys[r], ys[r + 1]
            q = [(px(xs[c], y0), y0), (px(xs[c + 1], y0), y0), (px(xs[c + 1], y1), y1), (px(xs[c], y1), y1)]
            col = (222, 204, 176) if (r + c) % 2 == 0 else (196, 172, 146)
            ImageDraw.Draw(img).polygon([fr.tp(p) for p in q], fill=col)
    fr.part([(-300, 776), (2300, 776), (2300, 790), (-300, 790)], (90, 70, 60), ow=0, shade=0, hi=0)
    # windows with sunlight
    for wx in (1180, 1620):
        fr.part(rpoly([(wx, 170), (wx + 300, 170), (wx + 300, 500), (wx, 500)], 0.03), (255, 255, 255), ow=4, shade=0.2, sd=10)
        vgrad(img, bg_box(fr, wx + 16, 186, wx + 284, 484), (120, 190, 240), (210, 238, 250))
        fr.line([(wx + 150, 186), (wx + 150, 484)], 8, (255, 255, 255))
        fr.line([(wx + 16, 335), (wx + 284, 335)], 8, (255, 255, 255))
        fr.soft([(wx + 40, 470), (wx + 120, 200), (wx + 150, 200), (wx + 70, 470)], (255, 255, 255), 0.4, 2)
        fr.soft([(wx + 16, 500), (wx + 284, 500), (wx + 520, 1215), (wx - 120, 1215)], (255, 244, 190), 0.22, 20)
    # notice board with colourful papers (no text, just scribbles)
    fr.part(rpoly([(560, 210), (900, 210), (900, 460), (560, 460)], 0.04), (196, 140, 84), ow=4, shade=0.2, sd=10)
    for i, (px_, py_, col) in enumerate(((600, 240, (255, 250, 230)), (720, 250, (255, 220, 120)), (820, 236, (180, 220, 250)),
                                         (640, 350, (250, 180, 200)), (770, 340, (200, 240, 180)))):
        pts = rot_pts([(px_, py_), (px_ + 80, py_), (px_ + 80, py_ + 90), (px_, py_ + 90)], (px_ + 40, py_ + 45), 6 * hn(i, 9))
        fr.part(pts, col, ow=2.4, shade=0.1, hi=0)
        for k in range(3):
            fr.line([(px_ + 12, py_ + 24 + 18 * k), (px_ + 68 - 14 * (k % 2), py_ + 24 + 18 * k)], 3, (150, 140, 150))
        fr.part(ell((px_ + 40, py_ + 8), 6), (230, 60, 60), ow=1.5, shade=0, hi=0)
    # pillar on the left
    fr.part(rpoly([(330, 1215), (330, -140), (470, -140), (470, 1215)], 0.01), (246, 230, 196), shade=0.3, hi=0.2, sd=26)
    fr.part(rpoly([(320, 790), (320, 690), (480, 690), (480, 790)], 0.03), (70, 130, 136), shade=0.25, sd=10)
    # water cooler
    fr.part(rpoly([(1010, 780), (1010, 560), (1090, 560), (1090, 780)], 0.1), (220, 224, 232), shade=0.3, hi=0.3, sd=14)
    fr.part(ell((1050, 520), 44, 52), (150, 210, 245), shade=0.3, hi=0.5, sd=12)
    return img.filter(ImageFilter.GaussianBlur(1.8))


def bg_courtyard():
    img, fr = new_bg()
    vgrad(img, (0, 0, img.size[0], fr.tp((0, 200))[1]), (110, 186, 240), (190, 228, 250))
    vgrad(img, (0, fr.tp((0, 140))[1], img.size[0], fr.tp((0, 660))[1]), (214, 120, 86), (186, 96, 70))
    d = ImageDraw.Draw(img)
    for r, y in enumerate(range(150, 660, 34)):
        a, b = fr.tp((-300, y)), fr.tp((2300, y))
        d.line([a, b], fill=(160, 80, 60), width=3 * SS)
        for x in range(-300 + (r % 2) * 40, 2300, 80):
            p, q = fr.tp((x, y)), fr.tp((x, y + 34))
            d.line([p, q], fill=(160, 80, 60), width=3 * SS)
    for i in range(6):
        wx = -60 + i * 380
        fr.part(rpoly([(wx, 220), (wx + 200, 220), (wx + 200, 480), (wx, 480)], 0.04), (250, 240, 220), ow=4, shade=0.15, sd=8)
        vgrad(img, bg_box(fr, wx + 14, 234, wx + 186, 466), (110, 170, 220), (60, 110, 170))
        fr.line([(wx + 100, 234), (wx + 100, 466)], 7, (250, 240, 220))
    fr.part([(-300, 640), (2300, 640), (2300, 668), (-300, 668)], (130, 120, 112), ow=0, shade=0, hi=0)
    vgrad(img, (0, fr.tp((0, 666))[1], img.size[0], img.size[1]), (214, 206, 190), (190, 180, 164))
    vp = (960, 260)
    for X in range(-3000, 5000, 260):
        fr.line([(vp[0] + (X - vp[0]) * (668 - vp[1]) / (1215 - vp[1]), 668), (X, 1215)], 2.5, (170, 160, 146))
    for y in (700, 760, 850, 980, 1160):
        fr.line([(-300, y), (2300, y)], 2.5, (170, 160, 146))
    tree(fr, 120, 700, 1.3)
    fr.part(rpoly([(1560, 640), (1860, 640), (1860, 600), (1560, 600)], 0.1), (170, 110, 70), shade=0.3, sd=8)
    for lx in (1590, 1830):
        fr.part([(lx, 640), (lx, 690)], (110, 70, 50), tube=12)
    fr.part(rpoly([(1700, 700), (1760, 700), (1780, 620), (1680, 620)], 0.1), (220, 120, 60), shade=0.3, sd=8)
    puff(fr, (1730, 590), 40, (90, 170, 80))
    return img.filter(ImageFilter.GaussianBlur(1.8))


def bg_gloom():
    img, fr = new_bg()
    vgrad(img, (0, 0, img.size[0], img.size[1]), (40, 52, 100), (14, 18, 40))
    fr.soft([(860, -200), (1060, -200), (1360, 1000), (560, 1000)], (180, 200, 255), 0.18, 30)
    fr.soft(ell((960, 990), 330, 60), (190, 210, 255), 0.35, 25)
    return img.filter(ImageFilter.GaussianBlur(2))


_BG_FUNCS = {"campus": bg_campus, "corridor": bg_corridor, "courtyard": bg_courtyard, "gloom": bg_gloom}
_bg_cache = {}


def get_bg(name):
    if name not in _bg_cache:
        if len(_bg_cache) >= 2:
            _bg_cache.pop(next(iter(_bg_cache)))
        _bg_cache[name] = _BG_FUNCS[name]()
    return _bg_cache[name]


def frame_with_bg(name, z, f, shake=(0, 0), par=0.65):
    """Place the cached background with a parallax-reduced zoom, then return a canvas over it."""
    bg = get_bg(name)
    zb = 1 + (z - 1) * par
    cx = SS * ((-960 - shake[0]) / zb + f[0] + BGX)
    cy = SS * ((-540 - shake[1]) / zb + f[1] + BGY)
    img = bg.transform((W * SS, H * SS), Image.AFFINE, (1 / zb, 0, cx, 0, 1 / zb, cy), resample=Image.BILINEAR)
    fr = Fr(img)
    fr.z, fr.f, fr.shake = z, f, shake
    return fr


_radial = None


def burst_frame(t, z, f, shake, strength=1.0):
    global _radial
    if _radial is None:
        yy, xx = np.mgrid[0:H * SS // 4, 0:W * SS // 4]
        cx, cy = 1230 * SS / 4, 420 * SS / 4
        r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (W * SS / 4)
        a = np.clip(r * 1.4, 0, 1)[..., None]
        c0, c1 = np.array((255, 190, 90)), np.array((150, 20, 40))
        _radial = Image.fromarray((c0 * (1 - a) + c1 * a).astype(np.uint8)).resize((W * SS, H * SS), Image.BILINEAR)
    img = _radial.copy()
    fr = Fr(img)
    fr.z, fr.f, fr.shake = z, f, shake
    m = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(m)
    c = (1230, 420)
    for i in range(22):
        a0 = math.radians(t * 18 + 360 * i / 22)
        a1 = math.radians(t * 18 + 360 * (i + 0.45) / 22)
        pts = [c, (c[0] + 3000 * math.cos(a0), c[1] + 3000 * math.sin(a0)), (c[0] + 3000 * math.cos(a1), c[1] + 3000 * math.sin(a1))]
        d.polygon([fr.tp(p) for p in pts], fill=int(70 * strength))
    img.paste((255, 230, 140), (0, 0), m)
    # flames along the floor
    for i in range(16):
        x = -100 + i * 140
        hgt = 120 + 60 * math.sin(t * 9 + i * 1.7)
        pts = smooth([(x - 70, 1000), (x - 30, 1000 - hgt * 0.6), (x + 10 * math.sin(t * 7 + i), 1000 - hgt),
                      (x + 40, 1000 - hgt * 0.5), (x + 70, 1000)], True, 4)
        fr.part(pts, (255, 120, 40), ow=0, shade=0.25, hi=0.3)
    fr.part([(-400, 1000), (2400, 1000), (2400, 1400), (-400, 1400)], (90, 24, 36), ow=0, shade=0, hi=0)
    return fr


_vig = None


def vignette(arr):
    global _vig
    if _vig is None:
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        _vig = (1 - 0.28 * np.clip(r - 0.55, 0, 1) ** 1.5)[..., None].astype(np.float32)
    return (arr.astype(np.float32) * _vig).astype(np.uint8)


# ---------------------------------------------------------------- scenes
T = R  # word timings


def sc_college(t):
    push = ease((t - (T.T_BHADWA - 0.5)) / 0.45)
    z = 1.0 + 0.05 * ease(t / 3) + 2.4 * push
    f = (960, lerp(560, 760, push))
    fr = frame_with_bg("campus", z, f, par=0.95)
    for i, (sx, d, sp) in enumerate(((560, 1, CURLY), (1380, -1, CAPPY), (760, 1, PINKY))):
        x = sx + d * t * 70
        char(fr, sp, x, 990 + 30 * i, 0.38, face=d, expr="happy", t=t, **walk(t + i * 0.7))
    return fr


def sc_intro_bhadwa(t):
    lt = t - (T.T_BHADWA - 0.15)
    fr = frame_with_bg("corridor", 1.32 + 0.06 * lt, (820, 640))
    look = (math.sin(lt * 7) * 1.0, 0)
    b = char(fr, BUNTY, 590, 960, 1.05, a1=(-110, -10), a2=(30, -25), l1=(10, -4), l2=(-12, 4), lean=-20, face=1,
             expr="sly", look=look, t=t)
    k = back_out((t - T.T_BHADWA) / 0.35)
    bob = 12 * math.sin(t * 12)
    head = b["head"]
    arrow(fr, (head[0] + 110 + bob, head[1] - 20 - bob * 0.5), -60, k, 1.0)
    return fr


def sc_udhar(t):
    fr = frame_with_bg("corridor", 1.25, (1010, 660))
    lt = t - T.T_JO
    bx = lerp(500, 800, ease(lt / 0.55))
    ask = ease((t - (T.T_PAISE1 - 0.1)) / 0.25)
    got = t > T.T_UDHAR + 0.55
    pose = walk(t) if lt < 0.55 else dict(a1=(-14, -6), a2=(lerp(14, 70, ask), lerp(6, 95, ask)))
    b = char(fr, BUNTY, bx, 960, 1.0, face=1, expr="happy" if got else ("sad" if ask > 0.5 else "sly"), t=t, **pose)
    give = ease((t - T.T_UDHAR) / 0.25)
    s = char(fr, GOLU, 1240, 960, 1.0, a1=(lerp(-14, -70, give), lerp(-6, -95, give)), face=-1, expr="neutral", look=(-0.6, 0))
    fly = clamp((t - T.T_UDHAR - 0.2) / 0.35)
    if give > 0.3:
        p0, p1 = s["hands"][0], b["hands"][1]
        x = lerp(p0[0], p1[0], ease(fly))
        y = lerp(p0[1], p1[1], ease(fly)) - math.sin(math.pi * fly) * 90
        note(fr, (x, y - 14), -20 * math.sin(math.pi * fly * 2), 0.9)
    return fr


def sc_majboori(t):
    lt = t - (T.T_APNI - 0.1)
    fr = frame_with_bg("gloom", 1.9 + 0.15 * ease(lt / 1.7), (960, 610), par=0.3)
    smirk = t > T.START["bhai"] - 0.42
    # rain behind
    for i in range(40):
        x = -100 + (i * 97) % 2200
        ph = (t * 1.6 + i * 0.137) % 1
        y = -100 + ph * 1300
        fr.line([(x, y), (x - 10, y + 50)], 3, (150, 170, 230))
    b = char(fr, BUNTY, 960, 1000, 1.0, a1=(-28, 128), a2=(28, -128), face=1, expr="sly" if smirk else "sad",
             look=(1.0, 0) if smirk else (0, 0.3), tear=0 if smirk else clamp(lt / 1.1), t=t)
    c = ((b["hands"][0][0] + b["hands"][1][0]) / 2, b["hands"][0][1])
    fr.part(ell(c, 18), BUNTY["skin"], shade=0.25)
    # dark raincloud right over his head
    cx, cy = 960 + 6 * math.sin(t * 3), 420
    for dx, dy, r in ((-80, 10, 55), (-25, -25, 70), (50, -8, 60), (100, 18, 46), (10, 28, 58)):
        fr.part(ell((cx + dx, cy + dy), r), (120, 128, 150), ow=3.4, shade=0.25, hi=0.1)
    for i in range(10):
        x = cx - 100 + i * 22
        ph = (t * 3 + i * 0.31) % 1
        y = cy + 60 + ph * 110
        fr.line([(x, y), (x - 4, y + 22)], 4, (130, 180, 250))
    return fr


def sc_bhai(t):
    fr = frame_with_bg("courtyard", 1.0, (960, 560))
    studs = [(260, CURLY), (580, PINKY), (1340, CAPPY), (1660, GOLU)]
    hug = ease((t - T.T_BHAI + 0.15) / 0.3)
    bx = lerp(960, 1340 - 125, hug)
    fl = [T.T_SABSE - 0.05 + i * 0.27 for i in range(4)]
    got = sum(1 for ft in fl if t > ft + 0.33)
    b = char(fr, BUNTY, bx, 960, 1.0, a1=(-55, -92), a2=(lerp(50, 104, hug), lerp(92, 78, hug)), face=1,
             expr="happy" if got else "sly", t=t, hold={0: lambda h: stack(fr, (h[0], h[1] - 16), got, 0.85)})
    cx = b["hands"][0]
    for i, (sx, sp) in enumerate(studs):
        give = ease((t - fl[i] + 0.2) / 0.2) * (1 - ease((t - fl[i] - 0.5) / 0.3))
        d = 1 if sx < bx else -1
        if d > 0:
            pose = dict(a2=(lerp(14, 75, give), lerp(6, 92, give)))
        else:
            pose = dict(a1=(lerp(-14, -75, give), lerp(-6, -92, give)))
        s = char(fr, sp, sx, 960, 0.94, face=d, expr="happy" if (i == 2 and hug > 0.5) else "neutral", t=t, **pose)
        fly = clamp((t - fl[i]) / 0.33)
        if 0 < fly < 1:
            p0 = s["hands"][1] if d > 0 else s["hands"][0]
            x = lerp(p0[0], cx[0], ease(fly))
            y = lerp(p0[1], cx[1] - 16, ease(fly)) - math.sin(math.pi * fly) * 130
            note(fr, (x, y), 30 * math.sin(fly * 6), 0.85)
    if hug > 0.6:
        k = clamp((t - T.T_BHAI - 0.1) / 0.6)
        for i, dx in enumerate((-40, 40, 0)):
            heart(fr, (1280 + dx, 470 - 110 * k - 40 * i), 2.4 * back_out(clamp(k * 2 - i * 0.3)))
    return fr


def sc_dene(t):
    fr = frame_with_bg("corridor", 1.25, (960, 660))
    lt = t - T.START["baap"]
    sx = lerp(280, 700, ease(lt / 0.55))
    up = ease((lt - 0.55) / 0.2)
    pose = walk(t) if lt < 0.55 else dict(a2=(lerp(14, 72, up), lerp(6, 96, up)))
    char(fr, GOLU, sx, 960, 1.0, face=1, expr="happy" if lt > 0.6 else "neutral", t=t, **pose)
    freeze = t > T.T_BAAT - 0.05
    hide = ease((t - T.T_BAAT - 0.35) / 0.3)
    b = char(fr, BUNTY, 1200, 960, 1.0, a1=(lerp(-50, 12, hide), lerp(-85, 30, hide)), face=-1,
             expr="blank" if freeze else "happy", t=t,
             hold={0: (lambda h: stack(fr, (h[0], h[1] - 16), 4, 0.85 * (1 - hide))) if hide < 1 else (lambda h: None)})
    if freeze:
        for i in range(2):
            k = clamp((t - T.T_BAAT - 0.1 - 0.25 * i) / 0.6)
            sweat(fr, (b["head"][0] + 90 + 22 * i, b["head"][1] - 50 + 70 * k), 1.5)
    return fr


def giant(fr, t, s, mouth=0.0, a1=(-14, -6), a2=(105, 140), shout=False, point=None):
    dad = 1.0 if s > 1.3 else 0.0
    hold = {1: lambda h: chappal(fr, (h[0] + 8, h[1] - 50 * s / 2), s / 2 * 1.2, 10 * math.sin(t * 9))} if dad else None
    b = char(fr, BUNTY, 1230, 1000, s, a1=a1, a2=a2, l1=(-14, -6), l2=(14, 6), face=-1, expr="angry", mouth=mouth, t=t,
             dad=dad, hold=hold, point=point)
    if shout and mouth > 0.25:
        hx, hy = b["head"][0] - b["R"] * 0.9, b["head"][1] + b["R"] * 0.45
        for a in (-125, -95, -65):
            d = dirv(a)
            fr.part([add((hx, hy), d, 14 + 16 * mouth), add((hx, hy), d, 50 + 50 * mouth)], (255, 250, 230), tube=9, ow=3)
    return b


def sc_baap(t):
    on = t > T.T_BAAP - 0.12
    sh = 20 * max(0, 1 - (t - T.T_BAAP) / 0.8) if on else 0
    shake = (sh * hn(int(t * FPS), 1), sh * hn(int(t * FPS), 2))
    if on:
        fr = burst_frame(t, 1.0, (960, 540), shake, 1.0)
    else:
        fr = frame_with_bg("corridor", 1.25, (960, 660))
    k = back_out((t - T.T_BAAP + 0.12) / 0.45)
    s = 1.0 + 1.0 * k if on else 1.0
    if not on:
        char(fr, GOLU, 700, 960, 1.0, a2=(72, 96), face=1, expr="happy", t=t)
        b = char(fr, BUNTY, 1200, 960, 1.0, a1=(12, 30), face=-1, expr="blank", t=t)
        sweat(fr, (b["head"][0] + 90, b["head"][1]), 1.5)
        return fr
    giant(fr, t, s, a1=(-50, 40) if s > 1.3 else (-14, -6), a2=(105, 140) if s > 1.3 else (14, 6))
    ss = lerp(1.0, 0.7, ease((t - T.T_BAAP) / 0.4))
    jit = 4 * hn(int(t * FPS), 5)
    st = char(fr, GOLU, 600 + jit, 1000, ss, a1=(-150, -170), a2=(150, 170), l1=(-4, 8), l2=(4, -8), face=1, expr="shock", t=t)
    for i in range(2):
        kk = ((t - T.T_BAAP - 0.2 * i) % 0.9) / 0.9
        sweat(fr, (st["head"][0] - 75 - 25 * i, st["head"][1] - 30 + 60 * kk), 1.3)
    return fr


def sc_rant(t):
    fr = burst_frame(t, 1.0 + 0.06 * ease((t - T.START["rant"]) / 3), (960, 540), (0, 0), 0.8)
    m = R.mouth_at(t)
    jab = 6 * math.sin(t * 30) if T.T_DEKHO < t < T.T_PADHAI - 0.3 else 0
    giant(fr, t, 2.0, mouth=m, a1=(-62 + jab, -82 + jab), shout=True, point=0)
    jit = 3 * hn(int(t * FPS), 5)
    st = char(fr, GOLU, 560 + jit, 1000, 0.7, a1=(10, 150), a2=(-10, -150), l1=(-4, 8), l2=(4, -8), face=1, expr="shock",
              look=(0.6, -1), t=t)
    for i in range(2):
        kk = ((t - 0.3 * i) % 0.8) / 0.8
        sweat(fr, (st["head"][0] - 70 - 22 * i, st["head"][1] - 25 + 55 * kk), 1.2)
    return fr


def sc_padhai(t):
    fr = burst_frame(t, 1.06, (960, 540), (0, 0), 0.6)
    m = R.mouth_at(t)
    giant(fr, t, 2.0, mouth=m, a1=(-55, -72), shout=True, point=0)
    k = back_out((t - T.T_PADHAI) / 0.3)
    char(fr, GOLU, 560, 1000, 0.7, a1=(-30, 120), a2=(30, -120), face=1, expr="sad", look=(0, 1), t=t,
         hold={0: (lambda h: book(fr, (560, h[1] - 6), 0.72 * k)) if k > 0 else (lambda h: None)})
    return fr


def sc_razor(t):
    fr = frame_with_bg("corridor", 1.28, (900, 660))
    lt = t - T.T_MEKO
    up = ease((lt + 0.1) / 0.35)
    down = t > T.T_JHAAT - 0.05
    b = char(fr, BUNTY, 1140, 960, 1.05, a1=(-14, -6) if not down else (-30, 10), a2=(lerp(14, 100, up), lerp(6, 150, up)),
             face=-1, expr="smug", look=(0, 1.2) if down else (0.4, -1), t=t,
             hold={1: lambda h: razor(fr, (h[0], h[1] + 4), 1.05, -12)})
    h = b["hands"][1]
    tk = clamp((t - T.T_MEKO - 0.25) / 0.45)
    if 0 < tk < 1:
        sparkle(fr, (h[0] + 34, h[1] - 100), 1.3 * math.sin(math.pi * tk))
    if down:
        for i in range(3):
            kk = clamp((t - T.T_JHAAT - 0.1 * i) / 0.3)
            sparkle(fr, (b["hip"][0] - 50 + 50 * i, b["hip"][1] + 20 - 15 * i), 0.7 * math.sin(math.pi * kk))
    char(fr, GOLU, 640, 960, 1.0, a1=(-30, 120), a2=(30, -120), face=1, expr="confused", look=(0.6, 0), t=t,
         hold={0: lambda hh: book(fr, (640, hh[1] - 6), 0.95)})
    return fr


def sc_madad(t):
    fr = frame_with_bg("corridor", 1.28, (900, 660))
    lt = t - (T.T_TU - 0.1)
    lean = ease(lt / 0.35)
    run_t = t - (R.END - 0.62)
    char(fr, BUNTY, lerp(1140, 1010, lean), 960, 1.05, a1=(lerp(-14, -78, lean), lerp(-6, -100, lean)), lean=-28 * lean,
         face=-1, expr="creepy" if run_t < 0.25 else "blank", t=t,
         hold={0: lambda h: razor(fr, (h[0] - 4, h[1] + 4), 1.05, -70)})
    shock = t > R.END - 1.0
    if shock:
        book(fr, (740, 950), 0.95, 8)
    if run_t < 0:
        jump = -40 * math.sin(math.pi * clamp((t - (R.END - 1.0)) / 0.25)) if shock else 0
        st = char(fr, GOLU, 640, 960 + jump, 1.0, a1=(-30, 120) if not shock else (-150, -170),
                  a2=(30, -120) if not shock else (150, 170), face=1, expr="shock" if shock else "confused", look=(0.6, 0), t=t,
                  hold=None if shock else {0: lambda hh: book(fr, (640, hh[1] - 6), 0.95)})
        if shock:
            for i in range(2):
                sweat(fr, (st["head"][0] - 85 - 25 * i, st["head"][1] - 20 + 10 * i), 1.5)
    else:
        x = 640 - 1800 * run_t
        for i in range(4):
            fr.part([(x + 120 + 40 * i, 760 + 40 * i), (x + 300 + 60 * i, 760 + 40 * i)], (255, 255, 255), tube=6, ow=2)
        char(fr, GOLU, x, 960, 1.0, lean=-30, face=-1, expr="shock", t=t, **walk(t, 26, 40))
        kk = clamp(run_t / 0.5)
        puff(fr, (720, 930), 40 * (0.6 + kk), (240, 236, 228))
    return fr


SCENES = [
    (R.T_BHADWA - 0.15, sc_college),
    (R.T_JO - 0.05, sc_intro_bhadwa),
    (R.T_APNI - 0.1, sc_udhar),
    (R.START["bhai"] - 0.05, sc_majboori),
    (R.START["baap"] - 0.1, sc_bhai),
    (R.T_TAB, sc_dene),
    (R.START["rant"], sc_baap),
    (R.T_PADHAI - 0.1, sc_rant),
    (R.T_MEKO - 0.1, sc_padhai),
    (R.T_TU - 0.1, sc_razor),
    (R.END + 1, sc_madad),
]


def render_frame(i):
    t = i / FPS
    for end, fn in SCENES:
        if t < end:
            fr = fn(t)
            break
    small = fr.img.resize((W, H), Image.LANCZOS)
    return vignette(np.asarray(small)).tobytes()


def main():
    os.makedirs(os.path.join(ROOT, "renders"), exist_ok=True)
    if sys.argv[1] == "stills":
        for ts in sys.argv[2].split(","):
            i = int(float(ts) * FPS)
            Image.frombytes("RGB", (W, H), render_frame(i)).save(os.path.join(ROOT, f"renders/cartoon_{float(ts):05.2f}.png"))
        return
    n = int(R.END * FPS)
    out = os.path.join(ROOT, "renders/cartoon.mp4")
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "17", "-preset", "medium",
                           "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    with Pool(os.cpu_count()) as pool:
        for k, buf in enumerate(pool.imap(render_frame, range(n), chunksize=6)):
            ff.stdin.write(buf)
            if k % 60 == 0:
                print(f"frame {k}/{n}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("wrote", out)


if __name__ == "__main__":
    main()
