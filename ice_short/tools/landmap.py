"""
tools/landmap.py -- the globe's land texture: world-atlas land-50m (Natural Earth via world-atlas, ISC licence)
rasterised to an equirectangular map. R = land (antialiased), G = land blurred (shallow sea / coast glow),
B = a little relief noise. Writes assets/land.png (4096 x 2048).   python3 -m tools.landmap
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
W, H, SS = 4096, 2048, 2


def arcs_of(topo):
    sx, sy = topo["transform"]["scale"]; tx, ty = topo["transform"]["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def ring(arcs, idx):
    pts = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def main():
    topo = json.loads((ROOT / "assets" / "land-50m.json").read_text())
    arcs = arcs_of(topo)
    img = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(img)
    geoms = topo["objects"]["land"]["geometries"]
    for g in geoms:
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        for poly in polys:
            for k, r in enumerate(poly):
                pts = ring(arcs, r)
                # unwrap rings that cross the antimeridian, then draw them at -360, 0 and +360
                lons, prev, off = [], None, 0.0
                for lon, lat in pts:
                    if prev is not None and abs(lon - prev) > 180:
                        off += -360 if lon - prev > 0 else 360
                    lons.append(lon + off); prev = lon
                if pts and max(lons) - min(lons) > 350:          # Antarctica: close it along the bottom edge
                    lons2 = lons + [lons[-1], lons[0]]; lats2 = [la for _, la in pts] + [-90, -90]
                else:
                    lons2, lats2 = lons, [la for _, la in pts]
                for sh in (-360, 0, 360):
                    xy = [((lo + sh + 180) / 360 * W * SS, (90 - la) / 180 * H * SS) for lo, la in zip(lons2, lats2)]
                    d.polygon(xy, fill=255 if k == 0 else 0)
    land = img.resize((W, H), Image.LANCZOS)
    glow = land.filter(ImageFilter.GaussianBlur(14))
    r = np.random.default_rng(3).random((H // 8, W // 8)).astype(np.float32)
    noise = Image.fromarray((r * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    Image.merge("RGB", (land, glow, noise)).save(ROOT / "assets" / "land.png", optimize=True)
    a = np.asarray(land) / 255
    print(f"  assets/land.png  land fraction {a.mean():.3f} (Earth: ~0.29 of area, more on an equirect map)")


if __name__ == "__main__":
    main()
