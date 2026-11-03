// scenes/3d/lib/club.js -- the one scene every shot of the chess Short is built from: the club-room board under its
// lamp (lib/board3d.js), pieces moving on a schedule, move threads, the count on top in Inter ExtraBold, the real
// game tree, and Shannon's zeros. Nothing here knows the story: every move, branch, number and time comes from the
// scene's JSON (scenes/3d/export.py), so each scene file is a one-line stub.
//
// Layout rule (user, 2026-11-01): everything that matters sits inside the middle 3:4 of the frame (y 240-1680).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { ease, ramp, clamp01, lerp } from '/scenes/web/runtime.js';
import { SQ, sq, buildRoom, pieceGeometries, pieceMaterials, makePiece } from './board3d.js';

const SS = 1.5;                      // post supersampling (LineMaterial widths are in render-target pixels)
const N_ARC = 28;

const CSS = (p) => `
.cl { position:absolute; white-space:nowrap; will-change:transform,opacity; font-family:'Inter'; font-weight:800;
  font-optical-sizing:auto; font-variant-numeric:tabular-nums; }
.cl.num { font-size:190px; line-height:1; letter-spacing:-.03em; color:${p.ink}; }
.cl.num sup { font-size:.46em; vertical-align:1.0em; margin-left:.03em; letter-spacing:-.02em; }
.cl.lb { font-size:38px; line-height:1.15; letter-spacing:.01em; text-transform:uppercase; color:${p.ink_dim}; text-align:center; }
.cl.lb b { color:${p.ink}; }
.cl.lb sup, .cl.sub sup { font-size:.62em; vertical-align:.6em; }
.cl.sub { font-size:30px; line-height:1.25; letter-spacing:.01em; text-transform:uppercase; color:${p.ink_faint}; text-align:center; }
.cl.sub b { color:${p.ink_dim}; }
.cl.sub i { font-style:normal; color:${p.accent}; }
.cl.zeros { font-size:36px; line-height:1.3; letter-spacing:.005em; white-space:normal; width:960px; text-align:center; }
`;

/** Keyframed value: keys [[t, v], ...], eased between keys, held outside. */
function keyed(t, keys, fn = ease.inOut) {
  if (!keys || !keys.length) return null;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    if (t <= t1) {
      const u = fn(clamp01((t - t0) / Math.max(t1 - t0, 1e-6)));
      return Array.isArray(v0) ? v0.map((a, k) => lerp(a, v1[k], u)) : lerp(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}

/** The state that is current at t: items sorted by .t, the last one with t <= now (or null). */
function current(items, t) {
  let out = null;
  for (const it of items || []) { if (it.t <= t) out = it; else break; }
  return out;
}

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette;
  const st = document.createElement('style'); st.textContent = CSS(pal); document.head.appendChild(st);
  await Promise.all(["600 64px 'Archivo'", "800 190px 'Inter'", "800 30px 'Inter'"].map((f) => document.fonts.load(f)));

  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, 5, 2000);
  const room = buildRoom(scene, renderer, pal, { lamp: 3.4, lampPos: [-42, 140, -24] });
  const res = new THREE.Vector2(1080 * SS, 1920 * SS);

  // ---------------------------------------------------------------- pieces on a schedule
  const geoms = pieceGeometries(), mats = pieceMaterials(pal);
  const pieces = data.pieces.map((p) => { const m = makePiece(geoms, mats, p.k, p.w); scene.add(m); return { ...p, m }; });
  const lift = (k, dist) => (k === 'n' ? 3.2 : 0.9 + 0.08 * dist);
  function placePieces(t) {
    for (const p of pieces) {
      let [f, r] = p.sq, y = 0;
      for (const [k0, from, to, dur] of p.keys) {
        if (t <= k0) break;
        const u = ease.inOut(clamp01((t - k0) / dur));
        const dist = sq(...from).distanceTo(sq(...to)) / SQ;
        f = lerp(from[0], to[0], u); r = lerp(from[1], to[1], u);
        y = Math.sin(Math.PI * u) * lift(p.k, dist);
      }
      p.m.position.copy(sq(f, r, y));
    }
  }

  // ---------------------------------------------------------------- move threads
  const arcPts = (from, to, k) => {
    const a = sq(...from, 1.2), b = sq(...to, 0.15);
    const dist = a.distanceTo(b) / SQ, h = (k === 'n' ? 3.4 : 1.4) + 0.32 * dist;
    const out = [];
    for (let i = 0; i <= N_ARC; i++) {
      const u = i / N_ARC;
      out.push(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + Math.sin(Math.PI * u) * h, lerp(a.z, b.z, u));
    }
    return out;
  };
  const ringGeom = new THREE.RingGeometry(0.42, 0.7, 40).rotateX(-Math.PI / 2);
  const groups = (data.threads || []).map((gr) => {
    const order = gr.branches.map((b, i) => i).sort((i, j) => (gr.branches[i].from[0] - gr.branches[j].from[0]) || (i - j));
    const accent = new Set(gr.accent || []);
    const threads = gr.branches.map((b, i) => {
      const g = new LineGeometry(); g.setPositions(arcPts(b.from, b.to, b.k));
      const col = accent.has(i) ? pal.accent : pal.ink;
      const line = new Line2(g, new LineMaterial({ color: col, linewidth: accent.has(i) ? 5.4 : 4.2, transparent: true,
                                                   opacity: 0, resolution: res, depthWrite: false }));
      line.computeLineDistances(); line.renderOrder = 5; scene.add(line);
      const ring = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false }));
      ring.position.copy(sq(...b.to, 0.03)); ring.renderOrder = 4; scene.add(ring);
      return { line, ring, start: gr.t0 + gr.spread * order.indexOf(i) / Math.max(1, gr.branches.length), acc: accent.has(i) };
    });
    return { ...gr, threads };
  });
  function drawThreads(t) {
    for (const gr of groups) {
      gr.threads.forEach((th, i) => {
        const picked = i === gr.pick;
        const grow = ramp(t, th.start, th.start + 0.16, ease.out);
        const fadeT = picked ? gr.t1 + 0.05 : gr.fade;
        const a = grow * (1 - ramp(t, fadeT, fadeT + 0.25, ease.inOut));
        th.line.visible = th.ring.visible = a > 0.002;
        th.line.geometry.instanceCount = Math.max(1, Math.ceil(grow * N_ARC));
        th.line.material.opacity = (th.acc || (picked && t > gr.t1 - 0.3) ? 1.0 : 0.62) * a;
        th.ring.material.opacity = 0.75 * a * (grow > 0.98 ? 1 : 0);
      });
    }
  }

  // ---------------------------------------------------------------- the real game tree (to four plies) + the fog beyond
  let tree = null;
  if (data.tree) {
    const T = data.tree, K = T.counts, depth = K.length;
    const leaves = K.map((r) => r.slice());
    for (let k = depth - 2; k >= 0; k--) {
      let off = 0;
      leaves[k] = K[k].map((c) => { let s = 0; for (let j = 0; j < c; j++) s += leaves[k + 1][off + j]; off += c; return s; });
    }
    const N = leaves[0][0], start = [[0]];
    for (let k = 0; k < depth - 1; k++) {
      const row = []; let off = 0;
      K[k].forEach((c, i) => { let s0 = start[k][i]; for (let j = 0; j < c; j++) { row.push(s0); s0 += leaves[k + 1][off + j]; } off += c; });
      start.push(row);
    }
    const H = [2, 9, 16, 24, 33], Wd = [0, 24, 48, 72, 92];
    const zj = (k, i) => (k === 0 ? 0 : (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453 % 1) * 5 * k / 4);
    const pos = (k, u, i) => new THREE.Vector3((u - 0.5) * Wd[k], H[k], zj(k, i) - 6);
    const nodePos = [[pos(0, 0.5, 0)]];
    for (let k = 1; k < depth; k++) nodePos.push(start[k].map((s0, i) => pos(k, (s0 + leaves[k][i] / 2) / N, i)));
    const group = new THREE.Group(); scene.add(group);
    const levels = [];
    const opac = [1, 0.32, 0.055];
    for (let k = 0; k < depth - 1; k++) {
      const pts = []; let off = 0;
      K[k].forEach((c, i) => { const a = nodePos[k][i]; for (let j = 0; j < c; j++) { const b = nodePos[k + 1][off + j]; pts.push(a.x, a.y, a.z, b.x, b.y, b.z); } off += c; });
      let obj;
      if (k === 0) {
        const lg = new LineSegmentsGeometry(); lg.setPositions(pts);
        obj = new LineSegments2(lg, new LineMaterial({ color: pal.ink, linewidth: 3.6, resolution: res, transparent: true, opacity: 0, depthWrite: false }));
      } else {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: pal.ink, transparent: true, opacity: 0, depthWrite: false }));
      }
      group.add(obj); levels.push({ obj, max: opac[k] });
    }
    // the last ply: one dot per game, in a shuffled order so the band fills in evenly
    const a = new Float32Array(3 * N), hp = [];
    { let off = 0, n = 0;
      K[depth - 1].forEach((c, i) => {
        for (let j = 0; j < c; j++, n++) {
          const v = pos(depth, (start[depth - 1][i] + j + 0.5) / N, off + j), h = Math.sin(n * 91.345) * 43758.5453 % 1;
          a[3 * n] = v.x; a[3 * n + 1] = v.y + Math.abs(h) * 2.2; a[3 * n + 2] = v.z;
        }
        const a0 = nodePos[depth - 1][i], b = pos(depth, (start[depth - 1][i] + c / 2) / N, i);
        hp.push(a0.x, a0.y, a0.z, b.x, b.y, b.z);
        off += c;
      }); }
    for (let i = N - 1; i > 0; i--) {                           // deterministic shuffle
      const j = Math.floor((Math.sin(i * 3.7) * 43758.5453 % 1 + 1) % 1 * (i + 1));
      for (let c = 0; c < 3; c++) { const x = a[3 * i + c]; a[3 * i + c] = a[3 * j + c]; a[3 * j + c] = x; }
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const band = new THREE.Points(bg, new THREE.PointsMaterial({ color: pal.ink, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.16, depthWrite: false }));
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    const hairs = new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ color: pal.ink, transparent: true, opacity: 0, depthWrite: false }));
    group.add(band, hairs);
    // beyond ply 4 the games are too many to draw: a fog of grains rising above the band, filled bottom-up
    const FN = 220000, fa = new Float32Array(3 * FN);
    let sd = 99;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    // denser just above the band and thinning upward, widening like the tree below it
    const ys = Array.from({ length: FN }, () => Math.pow(rnd(), 1.7)).sort((p, q) => p - q);
    for (let i = 0; i < FN; i++) {
      const y = ys[i], w = Wd[4] * (1 + 0.55 * y);
      fa[3 * i] = (rnd() - 0.5) * w; fa[3 * i + 1] = H[4] + 2 + y * 30; fa[3 * i + 2] = -6 + (rnd() - 0.5) * 24 * (0.3 + y);
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fa, 3));
    const fog = new THREE.Points(fg, new THREE.PointsMaterial({ color: pal.ink, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.2, depthWrite: false }));
    group.add(fog);
    // the traced game
    const idx = [0]; let node = 0;
    for (let k = 0; k < depth - 1; k++) { let off = 0; for (let i = 0; i < node; i++) off += K[k][i]; node = off + T.path[k]; idx.push(node); }
    const way = idx.map((i, k) => nodePos[k][i]);
    way.push(pos(depth, (start[depth - 1][node] + T.path[depth - 1] + 0.5) / N, 0));
    const lg = new LineGeometry(); lg.setPositions(way.flatMap((v) => [v.x, v.y, v.z]));
    const path = new Line2(lg, new LineMaterial({ color: pal.ink, linewidth: 5, resolution: res, transparent: true, opacity: 0, depthWrite: false }));
    group.add(path);
    tree = { group, levels, band, hairs, fog, path, N, FN };
  }
  function drawTree(t) {
    if (!tree) return;
    const T = data.tree;
    const vis = ramp(t, T.show[0], T.show[0] + 0.3, ease.out) * (1 - ramp(t, T.show[1] - 0.3, T.show[1], ease.inOut));
    tree.group.visible = vis > 0.001;
    tree.levels.forEach((L, k) => {
      const g = ramp(t, T.grow[k], T.grow[k] + 0.5, ease.out);
      L.obj.material.opacity = L.max * g * vis;
      if (k === 0) L.obj.geometry.instanceCount = Math.max(1, Math.ceil(g * 20));
    });
    const gb = ramp(t, T.grow[3], T.grow[3] + 0.8, ease.out);
    tree.band.geometry.setDrawRange(0, Math.floor(gb * tree.N));
    tree.band.material.opacity = 0.16 * vis;
    tree.hairs.material.opacity = 0.025 * gb * vis;
    tree.path.material.opacity = ramp(t, T.path_t, T.path_t + 0.4, ease.out) * vis;
    const fogU = keyed(t, T.fog) ?? 0;
    tree.fog.geometry.setDrawRange(0, Math.floor(fogU * tree.FN));
    tree.fog.material.opacity = 0.2 * vis;
  }

  // ---------------------------------------------------------------- DOM: the count, its label and sub-line, texts, zeros
  const P = (cls, html = '') => overlay.el(html, `cl ${cls}`);
  const num = P('num'), lbl = P('lb'), sub = P('sub');
  const fit = (el, px, max = 960) => {
    el.style.fontSize = `${px}px`;
    const w = el.offsetWidth;
    if (w > max) el.style.fontSize = `${px * max / w}px`;
  };
  const texts = (data.texts || []).map((x) => ({ ...x, el: P(x.cls, x.html) }));
  let zeros = null;
  if (data.zeros) {
    const Z = data.zeros, chars = [];
    let html = '';
    const push = (ch, kind, zi) => { chars.push({ kind, zi }); html += `<span>${ch}</span>`; };
    push('1', 'one', -1);
    for (let i = 0; i < Z.zeros; i++) {
      if ((Z.zeros - i) % 3 === 0) { push(',', 'comma', i); html += '<wbr>'; }
      push('0', 'zero', i);
    }
    const el = P('zeros', html);
    zeros = { el, chars, spans: [...el.querySelectorAll('span')] };
  }

  let lastNum = null;
  function drawDom(t) {
    const c = current(data.counter, t);
    const ca = c ? (c.fade ? ramp(t, c.t, c.t + c.fade, ease.out) : 1) : 0;
    if (c) {
      if (lastNum !== c) {
        num.innerHTML = c.html; num.style.color = c.accent ? pal.accent : pal.ink; fit(num, c.size || 190);
        lbl.innerHTML = c.label || ''; sub.innerHTML = c.sub || '';
        lastNum = c;
      }
    }
    const out = c && c.out ? 1 - ramp(t, c.out, c.out + 0.3, ease.inOut) : 1;
    overlay.place(num, 540, data.layout.num_y, { anchor: 'c', opacity: c ? ca * out : 0 });
    overlay.place(lbl, 540, data.layout.label_y, { anchor: 'c', opacity: c ? ca * out : 0 });
    overlay.place(sub, 540, data.layout.label_y + 48, { anchor: 'c', opacity: c && c.sub ? ca * out : 0 });
    for (const x of texts) {
      const a = ramp(t, x.t0, x.t0 + x.fade, ease.out) * (1 - ramp(t, x.t1, x.t1 + x.fade, ease.inOut));
      overlay.place(x.el, x.x, x.y, { anchor: x.anchor, opacity: a });
    }
    if (zeros) {
      const Z = data.zeros;
      const typed = Math.floor(ramp(t, Z.t0, Z.t_full, ease.linear) * Z.zeros);
      const ph = current((Z.phases || []).map(([pt, lit, acc]) => ({ t: pt, lit, acc })), t);
      zeros.chars.forEach((ch, i) => {
        const s = zeros.spans[i];
        const shown = ch.kind === 'one' ? t >= Z.t0 : ch.zi < typed;
        s.style.visibility = shown ? 'visible' : 'hidden';
        // phases [t, lit, accent_from]: zeros below `lit` in ink, from `accent_from` on in the accent
        let col = pal.ink_faint;
        if (ph && (ch.kind === 'one' || ch.zi < ph.lit)) col = pal.ink;
        if (ph && ch.kind !== 'one' && ch.zi >= ph.acc) col = pal.accent;
        s.style.color = col;
      });
      const a = ramp(t, Z.t0, Z.t0 + 0.2, ease.out) * (1 - ramp(t, Z.t_out, Z.t_out + 0.35, ease.inOut));
      overlay.place(zeros.el, 540, Z.y, { anchor: 't', opacity: a });
    }
  }

  // ---------------------------------------------------------------- camera, light
  const look = { exposure: 1.0 };
  function stage(t) {
    const p = keyed(t, data.cam.map(([tk, pp]) => [tk, pp]));
    const l = keyed(t, data.cam.map(([tk, , ll]) => [tk, ll]));
    camera.position.set(...p); camera.lookAt(...l);
    look.exposure = keyed(t, data.exposure) ?? 1.0;
    room.key.intensity = keyed(t, data.lamp) ?? 3.4;
  }

  return {
    scene, camera,
    post: { ss: SS, samples: 4, shutter: 0.5, grain: 0.03, vignette: 0.34, exposure: 1.0, bg: 0x0b0907 },
    look: () => look,
    update(t, opts = {}) {
      stage(t);
      placePieces(t);
      drawThreads(t);
      drawTree(t);
      if (opts.sub) return;
      drawDom(t);
    },
  };
}
