"""Diwali affiliate Short: 1080x1920, 30 fps, ~22 s.

Every visual is drawn in code (no stock footage, no copyrighted assets).
Usage:  python render.py            -> out/diwali_deals.mp4
        python render.py still 5.0  -> out/still_5.0.png
"""
import math, os, subprocess, sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

W, H, FPS = 1080, 1920, 30
DUR = 22.0
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

INTER = "/usr/share/fonts/opentype/inter/"
F_BLACK = INTER + "InterDisplay-Black.otf"
F_BOLD = INTER + "InterDisplay-Bold.otf"
F_SEMI = INTER + "Inter-SemiBold.otf"
F_DEVA = "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"

GOLD = (255, 200, 70)
SAFFRON = (255, 140, 30)
CREAM = (255, 244, 220)
PINK = (255, 70, 140)
TEAL = (40, 220, 200)

# ---------------------------------------------------------------- script
# (start, end, kind, payload)
ITEMS = [
    ("LED Fairy Lights", "Balcony + windows = instant glow", "lights"),
    ("Clay Diya Set", "Traditional, reusable, eco-friendly", "diyas"),
    ("Rangoli Kit", "Colours + stencils, 10-min design", "rangoli"),
    ("Akash Kandil", "Hanging lantern for the entrance", "lantern"),
    ("Gift Hampers", "Dry fruits & sweets for family", "gift"),
]
T_HOOK = (0.0, 2.6)
T_INTRO = (2.6, 4.6)
ITEM_LEN = 2.6
T_ITEMS0 = 4.6
T_CTA = (T_ITEMS0 + ITEM_LEN * len(ITEMS), DUR)  # 17.6 -> 22


def ease_out_back(x):
    x = min(max(x, 0), 1)
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def ease_out(x):
    x = min(max(x, 0), 1)
    return 1 - (1 - x) ** 3


def clamp01(x):
    return min(max(x, 0.0), 1.0)


# ---------------------------------------------------------------- caches
_font_cache = {}


def font(path, size):
    k = (path, size)
    if k not in _font_cache:
        _font_cache[k] = ImageFont.truetype(path, size)
    return _font_cache[k]


_text_cache = {}


def text_img(s, path, size, fill, stroke=0, stroke_fill=(0, 0, 0), shadow=True):
    """Pre-rendered RGBA text with soft drop shadow."""
    k = (s, path, size, fill, stroke, stroke_fill, shadow)
    if k in _text_cache:
        return _text_cache[k]
    f = font(path, size)
    l, t, r, b = f.getbbox(s, stroke_width=stroke)
    pad = 30
    w, h = r - l + pad * 2, b - t + pad * 2
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((pad - l + 4, pad - t + 8), s, font=f, fill=(20, 0, 10, 200),
                                stroke_width=stroke, stroke_fill=(20, 0, 10, 200))
        img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(img)
    d.text((pad - l, pad - t), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    _text_cache[k] = img
    return img


def paste_center(base, img, cx, cy, scale=1.0, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01:
        return
    if abs(scale - 1) > 1e-3:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BILINEAR)
    if alpha < 0.999:
        a = img.getchannel("A").point(lambda v: int(v * alpha))
        img = img.copy()
        img.putalpha(a)
    base.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))


# ---------------------------------------------------------------- background
def make_bg():
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((x - W / 2) / W) ** 2 + ((y - H * 0.42) / H) ** 2 * 0.6)
    t = np.clip(d / 0.75, 0, 1)[..., None]
    inner = np.array([120, 20, 70], np.float32)
    outer = np.array([18, 4, 30], np.float32)
    rgb = inner * (1 - t) + outer * t
    return Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")


BG = make_bg()

rng = random.Random(7)
BOKEH = [dict(x=rng.uniform(0, W), y=rng.uniform(0, H), r=rng.uniform(10, 40), sp=rng.uniform(15, 50),
              ph=rng.uniform(0, 6.28), c=rng.choice([GOLD, SAFFRON, PINK, CREAM])) for _ in range(38)]

# Fireworks: (time, x, y, color)
FIREWORKS = [(0.15, 300, 520, GOLD), (0.55, 800, 380, PINK), (1.2, 560, 300, TEAL),
             (17.7, 260, 420, GOLD), (18.1, 820, 560, PINK), (18.6, 540, 300, SAFFRON),
             (19.6, 300, 650, TEAL), (20.3, 780, 330, GOLD), (21.0, 520, 520, PINK)]
FW_PARTS = []
for i, (ft, fx, fy, fc) in enumerate(FIREWORKS):
    r2 = random.Random(100 + i)
    parts = [(r2.uniform(0, 6.283), r2.uniform(260, 520)) for _ in range(70)]
    FW_PARTS.append(parts)


def draw_background(t):
    frame = BG.copy()
    glow = Image.new("RGB", (W // 4, H // 4), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    over = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    # bokeh drifting up
    for b in BOKEH:
        y = (b["y"] - b["sp"] * t) % (H + 100) - 50
        x = b["x"] + 20 * math.sin(t * 0.7 + b["ph"])
        a = int(40 + 35 * math.sin(t * 2 + b["ph"]))
        r = b["r"]
        od.ellipse((x - r, y - r, x + r, y + r), fill=b["c"] + (a,))
    # fireworks
    for (ft, fx, fy, fc), parts in zip(FIREWORKS, FW_PARTS):
        age = t - ft
        if 0 <= age < 1.6:
            k = ease_out(age / 1.1)
            fade = clamp01(1 - age / 1.6)
            for ang, sp in parts:
                px = fx + math.cos(ang) * sp * k
                py = fy + math.sin(ang) * sp * k + 120 * age * age
                rr = 5 * fade + 1
                od.ellipse((px - rr, py - rr, px + rr, py + rr), fill=fc + (int(255 * fade),))
                gx, gy = px / 4, py / 4
                gd.ellipse((gx - 3, gy - 3, gx + 3, gy + 3), fill=tuple(int(c * fade) for c in fc))
            if age < 0.25:  # flash
                fl = 1 - age / 0.25
                gd.ellipse((fx / 4 - 30, fy / 4 - 30, fx / 4 + 30, fy / 4 + 30),
                           fill=tuple(int(c * fl * 0.8) for c in fc))
    frame.alpha_composite(over)
    return frame, glow, gd


def add_glow(frame, glow):
    g = glow.filter(ImageFilter.GaussianBlur(7)).resize((W, H), Image.BILINEAR)
    rgb = ImageChops.add(frame.convert("RGB"), g)
    return rgb.convert("RGBA")


# ---------------------------------------------------------------- illustrations
def flame(d, gd, cx, cy, s, t, seed=0):
    fl = 1 + 0.12 * math.sin(t * 17 + seed) + 0.07 * math.sin(t * 29 + seed * 2)
    sway = 6 * s * math.sin(t * 9 + seed)
    h = 70 * s * fl
    w = 22 * s
    pts = []
    for i in range(25):
        a = i / 24 * math.pi * 2
        # teardrop
        y = -math.cos(a)
        x = math.sin(a) * (1 - y) * 0.5 * 1.4
        yy = cy - (y + 1) / 2 * h
        xx = cx + x * w + sway * (y + 1) / 2
        pts.append((xx, yy))
    d.polygon(pts, fill=SAFFRON + (255,))
    inner = [(cx + (px - cx) * 0.55, cy - (cy - py) * 0.7) for px, py in pts]
    d.polygon(inner, fill=(255, 240, 150, 255))
    gx, gy = cx / 4, (cy - h * 0.4) / 4
    r = 18 * s * fl
    gd.ellipse((gx - r, gy - r, gx + r, gy + r), fill=(255, 150, 40))


def diya(d, gd, cx, cy, s, t, seed=0):
    # bowl
    w, h = 120 * s, 55 * s
    d.chord((cx - w, cy - h, cx + w, cy + h * 1.4), 0, 180, fill=(170, 70, 25, 255))
    d.chord((cx - w * 0.92, cy - h * 0.85, cx + w * 0.92, cy + h * 1.15), 0, 180, fill=(205, 95, 35, 255))
    # rim
    d.ellipse((cx - w, cy - h * 0.35, cx + w, cy + h * 0.35), fill=(225, 120, 50, 255))
    d.ellipse((cx - w * 0.8, cy - h * 0.22, cx + w * 0.8, cy + h * 0.22), fill=(110, 40, 15, 255))
    # spout
    d.polygon([(cx + w * 0.7, cy - h * 0.2), (cx + w * 1.35, cy - h * 0.55), (cx + w * 0.9, cy + h * 0.3)],
              fill=(225, 120, 50, 255))
    # dots pattern
    for i in range(7):
        a = math.pi * (0.15 + 0.7 * i / 6)
        px = cx - math.cos(a) * w * 0.8
        py = cy + math.sin(a) * h * 0.9
        d.ellipse((px - 6 * s, py - 6 * s, px + 6 * s, py + 6 * s), fill=GOLD + (255,))
    flame(d, gd, cx + w * 1.15, cy - h * 0.45, s, t, seed)


def ill_lights(d, gd, t, cx, cy, k):
    cols = [GOLD, PINK, TEAL, SAFFRON, (140, 120, 255)]
    for row in range(3):
        y0 = cy - 220 + row * 200
        sag = 120
        n = 13
        pts = []
        for i in range(n):
            u = i / (n - 1)
            x = 80 + u * (W - 160)
            y = y0 + sag * 4 * u * (1 - u) + 10 * math.sin(t * 2 + row)
            pts.append((x, y))
        d.line(pts, fill=(60, 90, 50, 255), width=5)
        for i, (x, y) in enumerate(pts):
            if i / n > k * 1.3:
                continue
            c = cols[(i + row) % len(cols)]
            on = 0.55 + 0.45 * math.sin(t * 6 + i * 1.7 + row * 2)
            col = tuple(int(v * (0.5 + 0.5 * on)) for v in c)
            d.rounded_rectangle((x - 13, y + 4, x + 13, y + 46), 12, fill=col + (255,))
            d.rectangle((x - 7, y - 4, x + 7, y + 8), fill=(80, 80, 80, 255))
            gx, gy = x / 4, (y + 25) / 4
            r = 10 * on
            gd.ellipse((gx - r, gy - r, gx + r, gy + r), fill=tuple(int(v * on) for v in c))


def ill_diyas(d, gd, t, cx, cy, k):
    for i, dx in enumerate((-290, 0, 290)):
        a = clamp01(k * 3 - i)
        if a <= 0:
            continue
        s = 1.05 * ease_out_back(a)
        diya(d, gd, cx + dx - 30, cy + 60 + (-30 if i == 1 else 0), s, t, seed=i * 3)


def ill_rangoli(d, gd, t, cx, cy, k):
    rot = t * 0.4
    rings = [(330, 16, PINK), (270, 12, SAFFRON), (210, 10, TEAL), (150, 8, GOLD), (90, 6, (150, 90, 255))]
    for j, (R, n, c) in enumerate(rings):
        if k * 6 < j:
            continue
        sc = ease_out_back(clamp01(k * 6 - j))
        R *= sc
        for i in range(n):
            a = rot * (1 if j % 2 else -1) + i * 2 * math.pi / n
            px, py = cx + math.cos(a) * R * 0.75, cy + math.sin(a) * R * 0.75
            pr = R * 0.32
            # petal: ellipse oriented outward, approximated by polygon
            pts = []
            for m in range(16):
                b = m / 16 * 2 * math.pi
                ex, ey = math.cos(b) * pr, math.sin(b) * pr * 0.45
                pts.append((px + ex * math.cos(a) - ey * math.sin(a), py + ex * math.sin(a) + ey * math.cos(a)))
            d.polygon(pts, fill=c + (255,), outline=CREAM + (255,))
    d.ellipse((cx - 50, cy - 50, cx + 50, cy + 50), fill=CREAM + (255,))
    flame(d, gd, cx, cy + 10, 0.9, t, 5)


def ill_lantern(d, gd, t, cx, cy, k):
    sw = math.radians(8 * math.sin(t * 2.2))
    top = (cx, cy - 300)
    L = 330
    pcx = top[0] + math.sin(sw) * L
    pcy = top[1] + math.cos(sw) * L
    d.line([top, (pcx, pcy - 170)], fill=CREAM + (255,), width=4)
    s = ease_out_back(clamp01(k * 2))
    R = 240 * s
    # star lantern: 8-point star
    pts = []
    for i in range(16):
        a = i * math.pi / 8 + sw
        r = R if i % 2 == 0 else R * 0.55
        pts.append((pcx + math.sin(a) * r, pcy - math.cos(a) * r))
    d.polygon(pts, fill=(230, 40, 90, 255), outline=GOLD + (255,), width=6)
    inner = [(pcx + (x - pcx) * 0.55, pcy + (y - pcy) * 0.55) for x, y in pts]
    d.polygon(inner, fill=(255, 180, 60, 255))
    d.ellipse((pcx - R * 0.15, pcy - R * 0.15, pcx + R * 0.15, pcy + R * 0.15), fill=(255, 245, 190, 255))
    # tassels
    for i in range(-2, 3):
        x0 = pcx + i * 26 * s
        y0 = pcy + R * 0.6
        d.line([(x0, y0), (x0 + 10 * math.sin(t * 3 + i), y0 + 150 * s)], fill=GOLD + (255,), width=6)
    gd.ellipse((pcx / 4 - 45 * s, pcy / 4 - 45 * s, pcx / 4 + 45 * s, pcy / 4 + 45 * s), fill=(200, 90, 40))


def ill_gift(d, gd, t, cx, cy, k):
    s = ease_out_back(clamp01(k * 2))
    bw, bh = 300 * s, 240 * s
    by = cy + 120
    hop = abs(math.sin(t * 4)) * 40 * s
    d.rectangle((cx - bw, by - bh, cx + bw, by + bh * 0.6), fill=(200, 20, 70, 255))
    d.rectangle((cx - 35 * s, by - bh, cx + 35 * s, by + bh * 0.6), fill=GOLD + (255,))
    ly = by - bh - hop
    d.rectangle((cx - bw * 1.08, ly - 70 * s, cx + bw * 1.08, ly), fill=(225, 40, 90, 255))
    d.rectangle((cx - 35 * s, ly - 70 * s, cx + 35 * s, ly), fill=GOLD + (255,))
    # bow
    for sg in (-1, 1):
        d.ellipse((cx + sg * 110 * s - 80 * s, ly - 170 * s, cx + sg * 110 * s + 80 * s, ly - 60 * s),
                  outline=GOLD + (255,), width=int(max(1, 26 * s)))
    d.ellipse((cx - 30 * s, ly - 120 * s, cx + 30 * s, ly - 60 * s), fill=GOLD + (255,))
    # sparkles
    for i in range(8):
        a = i * math.pi / 4 + t
        r = 380 * s + 20 * math.sin(t * 5 + i)
        px, py = cx + math.cos(a) * r, by - bh / 2 + math.sin(a) * r * 0.8
        z = 14 + 8 * math.sin(t * 7 + i)
        d.polygon([(px, py - z), (px + z * 0.3, py), (px, py + z), (px - z * 0.3, py)], fill=CREAM + (255,))
        d.polygon([(px - z, py), (px, py + z * 0.3), (px + z, py), (px, py - z * 0.3)], fill=CREAM + (255,))
        gd.ellipse((px / 4 - 4, py / 4 - 4, px / 4 + 4, py / 4 + 4), fill=(200, 180, 120))


ILL = dict(lights=ill_lights, diyas=ill_diyas, rangoli=ill_rangoli, lantern=ill_lantern, gift=ill_gift)


# ---------------------------------------------------------------- UI pieces
def pill(frame, s, cx, cy, fill, txt_fill=(30, 5, 20), size=46, scale=1.0, alpha=1.0, path=F_BOLD):
    ti = text_img(s, path, size, txt_fill, shadow=False)
    pw, ph = ti.width + 20, ti.height - 10
    p = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    ImageDraw.Draw(p).rounded_rectangle((0, 0, pw - 1, ph - 1), ph // 2, fill=fill)
    p.alpha_composite(ti, ((pw - ti.width) // 2, (ph - ti.height) // 2))
    paste_center(frame, p, cx, cy, scale, alpha)


def disclosure(frame):
    pill(frame, "#ad  affiliate links", W - 230, 90, (0, 0, 0, 120), txt_fill=(255, 255, 255, 230), size=30,
         path=F_SEMI)


def progress(frame, t):
    d = ImageDraw.Draw(frame)
    d.rectangle((0, H - 10, W * t / DUR, H), fill=GOLD + (255,))


# ---------------------------------------------------------------- scenes
def scene_hook(frame, d, gd, t):
    lt = t - T_HOOK[0]
    s1 = ease_out_back(lt / 0.5)
    paste_center(frame, text_img("शुभ दीपावली", F_DEVA, 120, GOLD), W / 2, 380, s1)
    paste_center(frame, text_img("DIWALI", F_BLACK, 230, CREAM, 6, (150, 20, 60)), W / 2, 640,
                 ease_out_back((lt - 0.2) / 0.5))
    paste_center(frame, text_img("SHOPPING", F_BLACK, 150, GOLD, 5, (150, 20, 60)), W / 2, 840,
                 ease_out_back((lt - 0.35) / 0.5))
    paste_center(frame, text_img("abhi se shuru!", F_BOLD, 90, CREAM), W / 2, 1000,
                 ease_out_back((lt - 0.55) / 0.5))
    pill(frame, "Dhanteras 6 Nov  •  Diwali 8 Nov", W / 2, 1150, GOLD + (255,), size=48,
         scale=ease_out_back((lt - 0.8) / 0.5))
    diya(d, gd, W / 2 - 40, 1500, 1.5, t)


def scene_intro(frame, d, gd, t):
    lt = t - T_INTRO[0]
    paste_center(frame, text_img("5 cheezein jo", F_BOLD, 100, CREAM), W / 2, 640, ease_out_back(lt / 0.4))
    paste_center(frame, text_img("ghar ko", F_BLACK, 150, GOLD, 4, (150, 20, 60)), W / 2, 800,
                 ease_out_back((lt - 0.15) / 0.4))
    paste_center(frame, text_img("ROSHAN", F_BLACK, 220, CREAM, 6, (200, 60, 20)), W / 2, 990,
                 ease_out_back((lt - 0.3) / 0.4))
    paste_center(frame, text_img("kar dengi", F_BOLD, 100, CREAM), W / 2, 1170, ease_out_back((lt - 0.45) / 0.4))
    for i, dx in enumerate((-330, -110, 110, 330)):
        diya(d, gd, W / 2 + dx - 25, 1500, 0.7 * ease_out_back((lt - 0.5 - i * 0.1) / 0.4), t, i)


def scene_item(frame, d, gd, t, idx):
    lt = t - (T_ITEMS0 + idx * ITEM_LEN)
    name, sub, ill = ITEMS[idx]
    k = clamp01(lt / 0.9)
    # slide-in
    slide = (1 - ease_out(lt / 0.35)) * W
    # number badge
    pill(frame, f"#{idx + 1}", W / 2 + slide, 260, GOLD + (255,), size=90, path=F_BLACK,
         scale=ease_out_back(lt / 0.4))
    # illustration
    ILL[ill](d, gd, t, W / 2 + slide, 760, k)
    paste_center(frame, text_img(name, F_BLACK, 112, CREAM, 5, (150, 20, 60)), W / 2 + slide * 0.5, 1250,
                 ease_out_back((lt - 0.15) / 0.4))
    paste_center(frame, text_img(sub, F_SEMI, 52, GOLD), W / 2, 1375, 1.0, clamp01((lt - 0.4) / 0.3))
    pill(frame, "Link in bio  ↗", W / 2, 1510, (255, 255, 255, 230), size=50,
         scale=ease_out_back((lt - 0.6) / 0.4))


def scene_cta(frame, d, gd, t):
    lt = t - T_CTA[0]
    paste_center(frame, text_img("Saare LINKS", F_BLACK, 150, CREAM, 6, (150, 20, 60)), W / 2, 560,
                 ease_out_back(lt / 0.45))
    paste_center(frame, text_img("BIO mein", F_BLACK, 190, GOLD, 6, (150, 20, 60)), W / 2, 760,
                 ease_out_back((lt - 0.15) / 0.45))
    bob = 25 * math.sin(lt * 6)
    paste_center(frame, text_img("↑", F_BLACK, 200, CREAM), W / 2, 330 + bob, ease_out_back((lt - 0.3) / 0.4))
    pill(frame, "Best Diwali deals, ek jagah", W / 2, 960, GOLD + (255,), size=56,
         scale=ease_out_back((lt - 0.45) / 0.45))
    paste_center(frame, text_img("SAVE karo  •  SHARE karo", F_BOLD, 70, CREAM), W / 2, 1110, 1.0,
                 clamp01((lt - 0.9) / 0.4))
    paste_center(frame, text_img("FOLLOW for daily deals", F_BOLD, 62, GOLD), W / 2, 1210, 1.0,
                 clamp01((lt - 1.3) / 0.4))
    for i, dx in enumerate((-300, 0, 300)):
        diya(d, gd, W / 2 + dx - 30, 1520, 0.9, t, i)
    paste_center(frame, text_img("Happy Diwali!", F_DEVA, 90, CREAM), W / 2, 1740, 1.0, clamp01((lt - 1.8) / 0.5))


def render_frame(t):
    frame, glow, gd = draw_background(t)
    d = ImageDraw.Draw(frame)
    if t < T_HOOK[1]:
        scene_hook(frame, d, gd, t)
    elif t < T_INTRO[1]:
        scene_intro(frame, d, gd, t)
    elif t < T_CTA[0]:
        scene_item(frame, d, gd, t, int((t - T_ITEMS0) // ITEM_LEN))
    else:
        scene_cta(frame, d, gd, t)
    frame = add_glow(frame, glow)
    disclosure(frame)
    progress(frame, t)
    # quick white flash on each cut
    cuts = [T_INTRO[0], T_CTA[0]] + [T_ITEMS0 + i * ITEM_LEN for i in range(len(ITEMS))]
    for c in cuts:
        if 0 <= t - c < 0.12:
            a = int(160 * (1 - (t - c) / 0.12))
            frame.alpha_composite(Image.new("RGBA", (W, H), (255, 240, 210, a)))
    return frame.convert("RGB")


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "still":
        for tt in sys.argv[2:]:
            render_frame(float(tt)).save(os.path.join(OUT, f"still_{tt}.png"))
        return
    audio = os.path.join(OUT, "music.wav")
    if not os.path.exists(audio):
        subprocess.check_call([sys.executable, os.path.join(HERE, "music.py")])
    dst = os.path.join(OUT, "diwali_deals.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-i", audio, "-c:v", "libx264", "-preset", "medium", "-crf", "18",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", dst]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(DUR * FPS)
    for i in range(n):
        p.stdin.write(render_frame(i / FPS).tobytes())
        if i % 60 == 0:
            print(f"frame {i}/{n}", flush=True)
    p.stdin.close()
    p.wait()
    print("wrote", dst)


if __name__ == "__main__":
    main()
