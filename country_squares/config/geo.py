"""
config/geo.py -- Equal Earth projection and the 2-D geometry the map and the morph use.

Equal Earth (Šavrič, Patterson & Jenny 2018) is equal-area. Latitudes are first converted to authalic latitudes
(WGS84), so areas are preserved on the ellipsoid, not only on a sphere: one km² on the map is one km² on the ground,
and a country's square can be drawn at the same scale as its outline (tests/test_geo.py checks both).

All map coordinates are kilometres with y growing SOUTHWARD (screen axes), so the browser can draw them directly.
"""

from __future__ import annotations

import math

A_WGS84 = 6378.137                      # km
F_WGS84 = 1 / 298.257223563
E2 = F_WGS84 * (2 - F_WGS84)
E = math.sqrt(E2)

A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
M = math.sqrt(3) / 2

MAP_TOL_KM = 3.0                        # Douglas-Peucker tolerance for drawn rings (0.1 px on the full map)
MIN_PART_KM2 = 40.0                     # islands smaller than this are not drawn on the world map
MORPH_SPACING_KM = 20.0                 # point spacing of the morphing outline
MORPH_N = (64, 2400)                    # min / max points per morphing outline
LAT_RANGE = (-58.0, 84.0)               # the map's crop (no Antarctica)


def _q(phi: float) -> float:
    s = math.sin(phi)
    return (1 - E2) * (s / (1 - E2 * s * s) - 1 / (2 * E) * math.log((1 - E * s) / (1 + E * s)))


_QP = _q(math.pi / 2)
R_AUTHALIC = A_WGS84 * math.sqrt(_QP / 2)          # 6,371.0072 km


def authalic_lat(phi: float) -> float:
    return math.asin(max(-1.0, min(1.0, _q(phi) / _QP)))


def project(lon: float, lat: float) -> tuple[float, float]:
    """(lon, lat) in degrees -> (x, y) in km, y southward."""
    lam = math.radians(lon)
    th = math.asin(M * math.sin(authalic_lat(math.radians(lat))))
    t2 = th * th
    t6 = t2 * t2 * t2
    x = 2 * math.sqrt(3) * lam * math.cos(th) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1))
    y = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return x * R_AUTHALIC, -y * R_AUTHALIC


def project_ring(ring) -> list[tuple[float, float]]:
    return [project(lon, lat) for lon, lat in ring]


def map_bounds() -> dict:
    x0, _ = project(-180, 0)
    x1, _ = project(180, 0)
    _, y0 = project(0, LAT_RANGE[1])
    _, y1 = project(0, LAT_RANGE[0])
    return {"x0": round(x0, 1), "x1": round(x1, 1), "y0": round(y0, 1), "y1": round(y1, 1)}


def signed_area(r) -> float:
    """Shoelace; positive = clockwise on screen (y down)."""
    s = 0.0
    for (x0, y0), (x1, y1) in zip(r, r[1:] + r[:1]):
        s += x0 * y1 - x1 * y0
    return s / 2


def ring_area(r) -> float:
    return abs(signed_area(r))


def centroid(r) -> tuple[float, float]:
    a = signed_area(r)
    if abs(a) < 1e-12:
        xs, ys = zip(*r)
        return sum(xs) / len(xs), sum(ys) / len(ys)
    cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(r, r[1:] + r[:1]):
        c = x0 * y1 - x1 * y0
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    return cx / (6 * a), cy / (6 * a)


def simplify(r, tol: float) -> list[list[float]]:
    """Douglas-Peucker on a closed ring; returns rounded [x, y] pairs (at least 3)."""
    pts = list(r)
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    if n <= 4:
        return [[round(x, 1), round(y, 1)] for x, y in pts]
    keep = [False] * n
    # split at the two points farthest apart so the ring is two open polylines
    far = max(range(n), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    keep[0] = keep[far] = True
    stack = [(0, far), (far, n)]
    while stack:
        i, j = stack.pop()
        a, b = pts[i], pts[j % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1e-12
        best, bi = -1.0, -1
        for k in range(i + 1, j):
            p = pts[k]
            d = abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / L
            if d > best:
                best, bi = d, k
        if bi >= 0 and best > tol:
            keep[bi] = True
            stack += [(i, bi), (bi, j)]
    out = [[round(p[0], 1), round(p[1], 1)] for p, k in zip(pts, keep) if k]
    if len(out) < 3:
        out = [[round(x, 1), round(y, 1)] for x, y in pts[:: max(1, n // 3)]][:3]
    return out


def resample(r, n: int) -> list[tuple[float, float]]:
    pts = list(r)
    if pts[0] != pts[-1]:
        pts = pts + [pts[0]]
    seg = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total = sum(seg)
    out, k, acc = [], 0, 0.0
    for i in range(n):
        target = total * i / n
        while k < len(seg) - 1 and acc + seg[k] < target:
            acc += seg[k]
            k += 1
        u = (target - acc) / seg[k] if seg[k] else 0.0
        a, b = pts[k], pts[k + 1]
        out.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
    return out


def square_ring(cx: float, cy: float, side: float, n: int) -> list[tuple[float, float]]:
    """n points (n divisible by 4) evenly spaced around a square, clockwise on screen from the top-left corner."""
    h, q = side / 2, n // 4
    out = []
    for i in range(q):
        out.append((cx - h + side * i / q, cy - h))
    for i in range(q):
        out.append((cx + h, cy - h + side * i / q))
    for i in range(q):
        out.append((cx + h - side * i / q, cy + h))
    for i in range(q):
        out.append((cx - h, cy + h - side * i / q))
    return out


def morph_ring(r, center) -> list[list[float]]:
    """The outline resampled for the morph: clockwise, n points (multiple of 4), rotated so point i lands as close
    as possible to point i of square_ring(center, side of equal area, n). The browser only interpolates."""
    pts = list(r)
    if signed_area(pts) < 0:
        pts = pts[::-1]
    per = sum(math.dist(a, b) for a, b in zip(pts, pts[1:] + pts[:1]))
    n = int(min(max(per / MORPH_SPACING_KM, MORPH_N[0]), MORPH_N[1])) // 4 * 4
    res = resample(pts, n)
    sq = square_ring(center[0], center[1], math.sqrt(ring_area(pts)), n)
    step = max(1, n // 256)
    best = min(range(0, n, step), key=lambda k: sum((res[(i + k) % n][0] - sq[i][0]) ** 2 +
                                                     (res[(i + k) % n][1] - sq[i][1]) ** 2 for i in range(0, n, step)))
    res = res[best:] + res[:best]
    return [[round(x, 1), round(y, 1)] for x, y in res]
