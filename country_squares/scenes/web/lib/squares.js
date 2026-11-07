// scenes/web/lib/squares.js -- the ONE data-driven scene every shot of the Short is drawn with (Canvas 2D).
//
// World units are kilometres on the Equal Earth map (y southward). Each country is drawn as its outline morphing into
// a square of the same area (at the map), then the square flies into the queue: bottom-aligned on one baseline, sorted
// by area, gap = GAP x the next square's side, so the queue looks evenly spaced at every zoom. Everything that moves
// is a key track in the scene JSON (scenes/export.py), so every frame is a pure function of t.
//
// Camera keys: {t, kind:'map', x, y, s}  (centre in km, scale in px/km)
//          or  {t, kind:'q', r, z, ox, by, pace}  -- in queue space: r = the rank in focus (fractional), whose square
//              is 400 px x z on screen; ox shifts the view by ox x that square's side; by = the baseline's screen y.
//              pace:'log' moves r so the on-screen zoom is uniform in log scale (long trips down the queue).
const W = 1080, H = 1920;
const FOCUS_PX = 400;

export const ease = {
  linear: t => t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOut2: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  sine: t => 0.5 - 0.5 * Math.cos(Math.PI * t),
};
const clamp01 = x => Math.min(1, Math.max(0, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ramp = (t, t0, t1, fn = ease.inOut) => fn(clamp01((t - t0) / Math.max(t1 - t0, 1e-9)));

/** Piecewise keys [[t, v], ...] (eased between keys, held outside). */
function track(t, keys, fn = ease.inOut) {
  if (!keys || !keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    if (t <= t1) return lerp(v0, v1, fn(clamp01((t - t0) / Math.max(t1 - t0, 1e-9))));
  }
  return keys[keys.length - 1][1];
}

/** Fade in/out window: 0 -> 1 over `fin` after t0, 1 -> 0 over `fout` before t1. */
function win(t, t0, t1, fin = 0.35, fout = 0.35) {
  if (t < t0 || t > t1) return 0;
  return Math.min(ramp(t, t0, t0 + fin, ease.out), 1 - ramp(t, t1 - fout, t1, ease.in));
}

function squareRing(c, side, n) {
  const h = side / 2, q = n / 4, out = [];
  for (let i = 0; i < q; i++) out.push([c[0] - h + side * i / q, c[1] - h]);
  for (let i = 0; i < q; i++) out.push([c[0] + h, c[1] - h + side * i / q]);
  for (let i = 0; i < q; i++) out.push([c[0] + h - side * i / q, c[1] + h]);
  for (let i = 0; i < q; i++) out.push([c[0] - h, c[1] + h - side * i / q]);
  return out;
}

const NF = new Intl.NumberFormat('en-US');
export function fmtArea(a) { return a >= 10 ? NF.format(Math.round(a)) : String(+a.toFixed(2)); }

export async function setup({ canvas, data, world }) {
  const P = data.palette;
  const C = world.countries;                         // sorted by rank
  const N = C.length;
  const byIso = Object.fromEntries(C.map(c => [c.iso, c]));
  const Q = data.queue;
  let qx = Q.x0;
  for (let i = 0; i < N; i++) {
    const c = C[i];
    c.qx = qx; c.qcx = qx + c.side / 2; c.qcy = Q.base - c.side / 2;
    qx += c.side + (i + 1 < N ? Q.gap * C[i + 1].side : 0);
    c.sq = squareRing(c.map.center, c.side, c.map.main.length);
    c.tone = P['land' + c.mapcolor];
    c.order = (c.rank - 1) / (N - 1);
  }
  const logS = C.map(c => Math.log(c.side));

  // flags: the SVG for big squares (vector, drawn clipped), cached bitmaps for the rest
  await Promise.all(C.map(c => new Promise(res => {
    const im = new Image();
    im.onload = () => { c.flag = im; res(); };
    im.onerror = () => { console.warn('no flag', c.iso); res(); };
    im.src = `/scenes/web/node_modules/flag-icons/flags/1x1/${c.iso}.svg`;
  })));
  for (const c of C) if (c.flag && c.flag.decode) await c.flag.decode().catch(() => {});
  const bmp = new Map();
  function flagBitmap(c, px) {
    const size = Math.min(1024, Math.max(32, 2 ** Math.ceil(Math.log2(px))));
    const key = c.iso + size;
    if (!bmp.has(key)) {
      const cv = new OffscreenCanvas(size, size);
      cv.getContext('2d').drawImage(c.flag, 0, 0, size, size);
      bmp.set(key, cv);
    }
    return bmp.get(key);
  }

  // grain: one fixed noise tile, offset per frame (deterministic)
  const grain = new OffscreenCanvas(256, 256);
  {
    const g = grain.getContext('2d'), img = g.createImageData(256, 256);
    let s = 1234567;
    for (let i = 0; i < img.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const v = (s >> 16) & 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  const main = canvas.getContext('2d', { alpha: false });
  const off = new OffscreenCanvas(W, H);
  const offCtx = off.getContext('2d', { alpha: false });

  // ------------------------------------------------------------------ camera
  function sideAt(r) {
    const i = Math.max(0, Math.min(N - 2, Math.floor(r - 1)));
    return Math.exp(lerp(logS[i], logS[i + 1], clamp01(r - 1 - i)));
  }
  function centerAt(r) {
    const i = Math.max(0, Math.min(N - 2, Math.floor(r - 1)));
    return lerp(C[i].qcx, C[i + 1].qcx, clamp01(r - 1 - i));
  }
  function rankForLogSide(ls) {                       // logS is decreasing in rank
    let lo = 1, hi = N;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (Math.log(sideAt(mid)) > ls) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function qcam(k) {
    const sig = sideAt(k.r), s = FOCUS_PX / sig * (k.z ?? 1);
    const B = k.by ?? 1060;
    return { x: centerAt(k.r) + (k.ox ?? 0) * sig, y: Q.base - (B - H / 2) / s, s, r: k.r };
  }
  const explicit = k => (k.kind === 'q' ? qcam(k) : { x: k.x, y: k.y, s: k.s, r: null });
  function camAt(t) {
    const K = data.camera;
    if (t <= K[0].t) return explicit(K[0]);
    for (let i = 1; i < K.length; i++) {
      const a = K[i - 1], b = K[i];
      if (t > b.t) continue;
      const u = (ease[b.ease || 'inOut'])(clamp01((t - a.t) / Math.max(b.t - a.t, 1e-9)));
      if (a.kind === 'q' && b.kind === 'q') {
        const r = b.pace === 'log' ? rankForLogSide(lerp(Math.log(sideAt(a.r)), Math.log(sideAt(b.r)), u))
                                   : lerp(a.r, b.r, u);
        return qcam({ r, z: Math.exp(lerp(Math.log(a.z ?? 1), Math.log(b.z ?? 1), u)),
                      ox: lerp(a.ox ?? 0, b.ox ?? 0, u), by: lerp(a.by ?? 1060, b.by ?? 1060, u) });
      }
      const A = explicit(a), B = explicit(b);
      return { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), s: Math.exp(lerp(Math.log(A.s), Math.log(B.s), u)), r: null };
    }
    return explicit(K[K.length - 1]);
  }

  // ------------------------------------------------------------------ world pass
  const stag = (m, o, st) => clamp01(m * (1 + st) - st * o);

  function drawWorld(ctx, t) {
    const cam = camAt(t);
    const X = x => W / 2 + (x - cam.x) * cam.s, Y = y => H / 2 + (y - cam.y) * cam.s;
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, H * 0.6);
    glow.addColorStop(0, P.bg_glow); glow.addColorStop(1, P.bg);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const gridA = track(t, data.grid);
    if (gridA > 0.001 && data.graticule) {
      ctx.save(); ctx.globalAlpha = gridA; ctx.strokeStyle = P.grid; ctx.lineWidth = 1.5;
      for (const line of data.graticule) {
        ctx.beginPath();
        line.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
        ctx.stroke();
      }
      ctx.restore();
    }
    const floorA = track(t, data.floor);
    if (floorA > 0.001) {                                       // the queue's floor line
      ctx.save(); ctx.globalAlpha = floorA; ctx.strokeStyle = P.grid; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, Y(Q.base) + 2); ctx.lineTo(W, Y(Q.base) + 2); ctx.stroke(); ctx.restore();
    }

    const ghostA = track(t, data.ghosts);
    if (ghostA > 0.001) {
      ctx.save(); ctx.globalAlpha = ghostA; ctx.fillStyle = P.ghost;
      for (const g of world.ghosts) {
        ctx.beginPath();
        for (const r of g.rings) { r.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.closePath(); }
        ctx.fill();
      }
      ctx.restore();
    }

    const m = track(t, data.morph, ease.linear), f = track(t, data.fly, ease.linear);
    const flagA = track(t, data.flags), lineW = track(t, data.edge) || 1.2;
    const st = data.stagger ?? 0.5, stf = data.flyStagger ?? 0.6;
    const boxes = [];
    for (const c of C) {
      const mu = ease.inOut(stag(m, c.order, st));
      const fu = ease.inOut(stag(f, c.order, stf));
      if (mu < 1) {                                             // outline -> square, at the map
        const mc = c.map.center;
        ctx.fillStyle = c.tone; ctx.strokeStyle = P.edge; ctx.lineWidth = lineW;
        if (mu < 0.999 && c.map.parts.length) {                 // islands shrink into the square, under the mainland
          ctx.beginPath();
          for (const p of c.map.parts) {
            const cx = lerp(p.c[0], mc[0], mu), cy = lerp(p.c[1], mc[1], mu), k = 1 - mu;
            p.ring.forEach(([x, y], i) => {
              const sx = X(cx + (x - p.c[0]) * k), sy = Y(cy + (y - p.c[1]) * k);
              i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
            });
            ctx.closePath();
          }
          ctx.fill('evenodd'); if (mu < 0.05) ctx.stroke();
        }
        ctx.beginPath();
        const pts = c.map.main;
        for (let i = 0; i < pts.length; i++) {
          const x = lerp(pts[i][0], c.sq[i][0], mu), y = lerp(pts[i][1], c.sq[i][1], mu);
          i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        continue;
      }
      const cx = lerp(c.map.center[0], c.qcx, fu), cy = lerp(c.map.center[1], c.qcy, fu);
      const px = c.side * cam.s;
      const sx = X(cx - c.side / 2), sy = Y(cy - c.side / 2);
      if (sx > W || sy > H || sx + px < 0 || sy + px < 0) continue;
      if (px < 0.35) {                                          // sub-pixel: a dot with the right coverage
        ctx.globalAlpha = Math.max(px / 0.35, 0.15); ctx.fillStyle = c.tone;
        ctx.fillRect(sx, sy, Math.max(px, 0.35), Math.max(px, 0.35)); ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = c.tone;
      ctx.fillRect(sx, sy, px, px);
      if (flagA > 0.001 && c.flag && px > 1.5) {
        ctx.save(); ctx.globalAlpha = flagA;
        // only the visible part is drawn, so a square thousands of pixels wide costs no more than the screen
        const vx0 = Math.max(sx, -2), vy0 = Math.max(sy, -2), vx1 = Math.min(sx + px, W + 2), vy1 = Math.min(sy + px, H + 2);
        if (px > 1024) {
          ctx.beginPath(); ctx.rect(vx0, vy0, vx1 - vx0, vy1 - vy0); ctx.clip();
          const k = 512 / px;                                   // the SVG's 512-unit viewBox
          ctx.drawImage(c.flag, (vx0 - sx) * k, (vy0 - sy) * k, (vx1 - vx0) * k, (vy1 - vy0) * k, vx0, vy0, vx1 - vx0, vy1 - vy0);
        } else {
          ctx.drawImage(flagBitmap(c, px), sx, sy, px, px);
        }
        ctx.restore();
      }
      if (px > 3) {
        ctx.strokeStyle = flagA > 0.5 ? 'rgba(11,16,32,0.9)' : P.edge;
        ctx.lineWidth = Math.min(lineW * 1.5, px / 8);
        ctx.strokeRect(sx, sy, px, px);
      }
      if (fu > 0.98) boxes.push({ c, sx, sy, px });
    }

    // queue labels: name + rank/area under each square that is big enough, biggest first, never overlapping
    const labA = track(t, data.labels);
    if (labA > 0.001) {
      const placed = [];
      const hot = new Set((data.accents || []).filter(a => t >= a.t0 - 0.3 && t <= a.t1).map(a => a.iso));
      boxes.sort((a, b) => (hot.has(b.c.iso) - hot.has(a.c.iso)) || (b.px - a.px));
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      for (const b of boxes) {
        const a = labA * clamp01((b.px - 60) / 60);
        if (a <= 0.01) continue;
        const name = b.c.name.toUpperCase();
        const k = Math.min(1, Math.max(0.68, b.px / 240)), f1 = Math.round(34 * k), f2 = Math.round(26 * k);
        ctx.font = `800 ${f1}px 'Inter'`;
        const w1 = ctx.measureText(name).width;
        const sub = `#${b.c.rank} · ${fmtArea(b.c.area)} km²`;
        ctx.font = `600 ${f2}px 'Inter'`;
        const w = Math.max(w1, ctx.measureText(sub).width);
        const visL = Math.max(b.sx, 0), visR = Math.min(b.sx + b.px, W);
        let cx = (visL + visR) / 2;
        cx = Math.min(Math.max(cx, w / 2 + 40), W - w / 2 - 40);
        const x0 = cx - w / 2 - 18, x1 = cx + w / 2 + 18;
        if (placed.some(p => !(x1 < p[0] || x0 > p[1]))) continue;
        placed.push([x0, x1]);
        const y = b.sy + b.px;
        ctx.globalAlpha = a;
        ctx.fillStyle = P.ink; ctx.font = `800 ${f1}px 'Inter'`; ctx.fillText(name, cx, y + 18 + f1);
        ctx.fillStyle = P.ink_dim; ctx.font = `600 ${f2}px 'Inter'`; ctx.fillText(sub, cx, y + 28 + f1 + f2);
      }
      ctx.globalAlpha = 1;
    }

    // accents and dimension lines (on squares in the queue)
    for (const a of data.accents || []) {
      const k = win(t, a.t0, a.t1, 0.25, 0.3);
      if (k <= 0) continue;
      const c = byIso[a.iso];
      const sx = X(c.qx), sy = Y(Q.base - c.side), px = c.side * cam.s;
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = P.accent; ctx.lineWidth = a.w ?? 7;
      ctx.strokeRect(sx - 2, sy - 2, px + 4, px + 4); ctx.restore();
    }
    for (const d of data.dims || []) {
      const k = win(t, d.t0, d.t1, 0.3, 0.3);
      if (k <= 0) continue;
      const c = byIso[d.iso];
      const sx = X(c.qx), sy = Y(Q.base - c.side), px = c.side * cam.s;
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = P.accent; ctx.fillStyle = P.accent; ctx.lineWidth = 4;
      const y = sy - 34, grow = ramp(t, d.t0, d.t0 + 0.5, ease.out);
      const xm = sx + px / 2, hw = px / 2 * grow;
      ctx.beginPath(); ctx.moveTo(xm - hw, y); ctx.lineTo(xm + hw, y);
      ctx.moveTo(xm - hw, y - 14); ctx.lineTo(xm - hw, y + 14); ctx.moveTo(xm + hw, y - 14); ctx.lineTo(xm + hw, y + 14);
      ctx.stroke();
      ctx.font = `800 ${d.px ?? 44}px 'Inter'`; ctx.textAlign = 'center';
      ctx.fillText(d.text, Math.min(Math.max(xm, 200), W - 200), y - 24);
      ctx.restore();
    }
    return cam;
  }

  // ------------------------------------------------------------------ overlay pass (screen space, never blurred)
  function text(ctx, s, x, y, px, color, weight = 800, align = 'center') {
    ctx.font = `${weight} ${px}px 'Inter'`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function drawOverlay(ctx, t, cam) {
    for (const o of data.callouts || []) {
      const k = win(t, o.t0, o.t1, 0.4, 0.35);
      if (k <= 0) continue;
      ctx.save(); ctx.globalAlpha = k;
      let y = o.y + (1 - ramp(t, o.t0, o.t0 + 0.5, ease.out)) * 24;
      for (const [s, px, col] of o.lines) { y += px * 1.02; text(ctx, s, o.x ?? W / 2, y, px, P[col] || col); y += px * 0.18; }
      ctx.restore();
    }
    for (const o of data.counters || []) {                   // the rank in focus, live during a trip down the queue
      const k = win(t, o.t0, o.t1, 0.3, 0.3);
      if (k <= 0 || cam.r == null) continue;
      ctx.save(); ctx.globalAlpha = k;
      text(ctx, `#${Math.max(1, Math.min(N, Math.round(cam.r)))}`, W / 2, o.y + 120, 128, P.ink);
      text(ctx, `OF ${N}`, W / 2, o.y + 172, 40, P.ink_dim);
      ctx.restore();
    }
    for (const b of data.bars || []) {                       // share of the queue's area in the first k squares
      const k = win(t, b.t0, b.t1, 0.4, 0.35);
      if (k <= 0) continue;
      ctx.save(); ctx.globalAlpha = k;
      const x0 = 60, w = W - 120, h = 40, y = b.y, grow = ramp(t, b.t0 + 0.2, b.t0 + 1.4, ease.inOut);
      ctx.fillStyle = P.grid; ctx.fillRect(x0, y, w, h);
      const tot = C.reduce((s, c) => s + c.area, 0);
      let x = x0;
      for (let i = 0; i < b.k; i++) {
        const ww = w * C[i].area / tot * grow;
        ctx.fillStyle = i % 2 ? '#E8482A' : P.accent; ctx.fillRect(x, y, ww, h);
        ctx.strokeStyle = P.bg; ctx.lineWidth = 2; ctx.strokeRect(x, y, ww, h);
        x += ww;
      }
      text(ctx, b.left, x0, y - 22, 40, P.accent, 800, 'left');
      text(ctx, b.right, x0 + w, y - 22, 40, P.ink_dim, 800, 'right');
      ctx.restore();
    }
    for (const r of data.rulers || []) {                     // n copies of one square across another's width
      const k = win(t, r.t0, r.t1, 0.4, 0.35);
      if (k <= 0) continue;
      const A = byIso[r.a], B = byIso[r.b], L = W - 120, x0 = 60, s = L * B.side / A.side, n = r.n;
      ctx.save(); ctx.globalAlpha = k;
      ctx.strokeStyle = P.accent; ctx.lineWidth = 4;
      const y = r.y + s;
      ctx.beginPath(); ctx.moveTo(x0, y + 16); ctx.lineTo(x0 + L, y + 16);
      ctx.moveTo(x0, y + 2); ctx.lineTo(x0, y + 30); ctx.moveTo(x0 + L, y + 2); ctx.lineTo(x0 + L, y + 30); ctx.stroke();
      for (let i = 0; i < n; i++) {
        const a = ramp(t, r.t0 + 0.3 + i * r.stagger, r.t0 + 0.55 + i * r.stagger, ease.out);
        if (a <= 0) continue;
        ctx.globalAlpha = k * a;
        const sx = x0 + i * s, sy = r.y + (1 - a) * -30;
        if (B.flag) ctx.drawImage(flagBitmap(B, s), sx, sy, s, s); else { ctx.fillStyle = B.tone; ctx.fillRect(sx, sy, s, s); }
        ctx.strokeStyle = P.bg; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, s, s);
      }
      ctx.globalAlpha = k;
      text(ctx, r.top, W / 2, r.y - 28, 40, P.ink);
      text(ctx, r.bottom, W / 2, y + 74, 34, P.accent);
      ctx.restore();
    }
    for (const n of data.nests || []) {                      // one square inside another, to the same scale
      const k = win(t, n.t0, n.t1, 0.4, 0.35);
      if (k <= 0) continue;
      const A = byIso[n.a], B = byIso[n.b], S = n.S, s = S * B.side / A.side, x0 = W - 90 - S, y0 = n.y;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(243,239,231,0.06)'; ctx.fillRect(x0, y0, S, S);
      ctx.strokeStyle = P.ink_dim; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.strokeRect(x0, y0, S, S); ctx.setLineDash([]);
      const g = ramp(t, n.t0 + 0.3, n.t0 + 1.0, ease.out);
      if (B.flag) {
        ctx.save(); ctx.beginPath(); ctx.rect(x0, y0 + S - s * g, s, s * g); ctx.clip();
        ctx.drawImage(flagBitmap(B, s), x0, y0 + S - s, s, s); ctx.restore();
        ctx.strokeStyle = P.accent; ctx.lineWidth = 4; ctx.strokeRect(x0, y0 + S - s * g, s, s * g);
      }
      text(ctx, n.labelA, x0 + 20, y0 + 50, 34, P.ink_dim, 800, 'left');
      text(ctx, n.labelB, x0 + s / 2, y0 + S - s - 16, 30, P.ink, 800, 'center');
      const xr = (60 + x0) / 2;
      text(ctx, n.big, xr, y0 + S / 2 + 30, 120, P.accent, 800, 'center');
      text(ctx, n.small, xr, y0 + S / 2 + 86, 32, P.ink_dim, 800, 'center');
      ctx.restore();
    }
    // vignette + grain (fixed pattern, shifted each frame)
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.035; ctx.globalCompositeOperation = 'overlay';
    const f = Math.round(t * 60), ox = (f * 73) % 256, oy = (f * 151) % 256;
    for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) ctx.drawImage(grain, x, y);
    ctx.restore();
    const fade = track(t, data.fade);                         // to / from the background colour
    if (fade > 0.001) { ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }

  function draw(t) {
    const K = Math.round(track(t, data.blur, ease.linear)) || 1;   // motion blur: K sub-frames over a half-frame shutter
    let cam;
    if (K <= 1) {
      cam = drawWorld(main, t);
    } else {
      for (let k = 0; k < K; k++) {
        const tk = t + ((k + 0.5) / K - 0.5) * 0.5 / data.fps;
        drawWorld(offCtx, tk);
        main.globalAlpha = 1 / (k + 1);
        main.drawImage(off, 0, 0);
      }
      main.globalAlpha = 1;
      cam = camAt(t);
    }
    drawOverlay(main, t, cam);
  }
  return { draw, probe: t => camAt(t) };
}
