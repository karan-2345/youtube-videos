// LookA -- STOP 1 look test, look A "Club room": the hook's first sentence on a walnut-and-maple board under a lamp.
// t < still_b.t: a real opening (Giuoco Piano) is played; on every ply every legal move grows out as a thread,
// one is played, and the count of possible games jumps (perft, from facts); 85 billion lands in the accent as the
// voice says it, then the Lichess comparison. t >= still_b.t: the fool's mate (a still). t >= still_c.t: Shannon's
// number as a hundred and twenty zeros (a still).
// Type: Inter ExtraBold for everything on screen except the captions (user pick 2026-11-01: the serif + letterspaced
// labels looked too infographic); Inter is the copy installed on this laptop (assets/fonts, SIL OFL). Captions stay
// Archivo (from Google Fonts in this preview). Everything important sits inside the middle 3:4 of the frame
// (y 240-1680), so Instagram's 3:4 grid crop shows it.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { ease, ramp, track, clamp01, lerp, toScreen } from '/scenes/web/runtime.js';
import { SQ, sq, buildRoom, pieceGeometries, pieceMaterials, makePiece } from './lib/board3d.js';

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..800&display=block';
const SS = 1.5;                      // post supersampling (LineMaterial widths are in render-target pixels)

const CSS = (p) => `
@font-face { font-family:'Inter'; src:url('/assets/fonts/Inter-VariableFont_opsz,wght.ttf'); font-weight:100 900; }
.la { position:absolute; white-space:nowrap; will-change:transform,opacity; font-family:'Inter'; font-weight:800;
  font-optical-sizing:auto; font-variant-numeric:tabular-nums; }
.la.num { font-size:190px; line-height:1; letter-spacing:-.03em; color:${p.ink}; }
.la.big { font-size:250px; line-height:1; letter-spacing:-.035em; color:${p.ink}; }
.la.big sup { font-size:.46em; vertical-align:1.0em; margin-left:.03em; letter-spacing:-.02em; }
.la.lb { font-size:38px; line-height:1.15; letter-spacing:.01em; text-transform:uppercase; color:${p.ink_dim};
  text-align:center; }
.la.lb b { color:${p.ink}; font-weight:800; }
.la.sub { font-size:30px; line-height:1.25; letter-spacing:.01em; text-transform:uppercase; color:${p.ink_faint};
  text-align:center; }
.la.sub b { color:${p.ink_dim}; }
.la.small { font-size:28px; font-weight:700; line-height:1.25; letter-spacing:.01em; text-transform:uppercase;
  color:${p.ink_dim}; }
.la.small b { color:${p.accent}; }
.la.zeros { font-size:36px; line-height:1.3; letter-spacing:.005em; color:${p.ink_faint}; white-space:normal;
  width:960px; text-align:center; }
.la.zeros i { font-style:normal; color:${p.accent}; }
.la.cap { font:800 74px/1.06 'Archivo'; font-stretch:88%; color:#fff; text-align:center; letter-spacing:.003em;
  white-space:normal; width:900px; font-variant-numeric:normal;
  -webkit-text-stroke:10px rgba(0,0,0,.92); paint-order:stroke fill; }
.la.cap b { color:${p.accent}; }
`;

const NOTE = ['before the first move', "possible games after White's first move", 'possible games after 1 move each',
  "possible games after White's 2nd move", 'possible games after 2 moves each', "possible games after White's 3rd move",
  'possible games after 3 moves each', "possible games after White's 4th move", 'possible games after 4 moves each'];

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = FONT_CSS; document.head.appendChild(link);
  const st = document.createElement('style'); st.textContent = CSS(pal); document.head.appendChild(st);
  await new Promise((r) => { link.onload = r; link.onerror = r; });
  await Promise.all(["600 64px 'Archivo'", "800 74px 'Archivo'", "800 190px 'Inter'", "700 28px 'Inter'"]
    .map((f) => document.fonts.load(f)));

  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, 5, 2000);
  const room = buildRoom(scene, renderer, pal, { lamp: 3.4, lampPos: [-42, 140, -24] });

  // ---- pieces
  const geoms = pieceGeometries(), mats = pieceMaterials(pal);
  const pieces = data.pieces.map((p) => {
    const m = makePiece(geoms, mats, p.k, p.w);
    scene.add(m);
    return { ...p, m };
  });
  const lift = (k, dist) => (k === 'n' ? 3.2 : 0.9 + 0.08 * dist);
  function placePieces(t) {
    for (const p of pieces) {
      let [f, r] = p.sq, y = 0;
      for (const [k0, from, to] of p.keys) {
        if (t <= k0) break;
        const u = ease.inOut(clamp01((t - k0) / 0.22));
        const a = sq(...from), b = sq(...to);
        const dist = a.distanceTo(b) / SQ;
        f = lerp(from[0], to[0], u); r = lerp(from[1], to[1], u);
        y = Math.sin(Math.PI * u) * lift(p.k, dist);
      }
      p.m.position.copy(sq(f, r, y));
    }
  }

  // ---- move threads: one Line2 per legal move per ply, grown along a lifted arc
  const N = 28;
  const res = new THREE.Vector2(1080 * SS, 1920 * SS);
  const arcPts = (from, to, k) => {
    const a = sq(...from, 1.2), b = sq(...to, 0.15);
    const dist = a.distanceTo(b) / SQ, h = (k === 'n' ? 3.4 : 1.4) + 0.32 * dist;
    const out = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      out.push(lerp(a.x, b.x, u), lerp(a.y, b.y, u) + Math.sin(Math.PI * u) * h, lerp(a.z, b.z, u));
    }
    return out;
  };
  const ringGeom = new THREE.RingGeometry(0.42, 0.7, 40).rotateX(-Math.PI / 2);
  const plies = data.plies.map((ply) => {
    const order = ply.branch.map((b, i) => i).sort((i, j) => (ply.branch[i].from[0] - ply.branch[j].from[0]) || (i - j));
    const threads = ply.branch.map((b, i) => {
      const g = new LineGeometry(); g.setPositions(arcPts(b.from, b.to, b.k));
      const mat = new LineMaterial({ color: pal.ink, linewidth: 4.2, transparent: true, opacity: 0, resolution: res,
                                     depthWrite: false });
      const line = new Line2(g, mat); line.computeLineDistances(); line.renderOrder = 5; scene.add(line);
      const ring = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({ color: pal.ink, transparent: true, opacity: 0,
                                                                         depthWrite: false }));
      ring.position.copy(sq(...b.to, 0.03)); ring.renderOrder = 4; scene.add(ring);
      return { line, ring, start: ply.t0 + 0.34 * (ply.t1 - ply.t0) * order.indexOf(i) / ply.branch.length };
    });
    return { ...ply, threads };
  });
  function drawThreads(t, show) {
    for (const ply of plies) {
      ply.threads.forEach((th, i) => {
        const picked = i === ply.pick;
        const grow = ramp(t, th.start, th.start + 0.16, ease.out);
        const fadeT = picked ? ply.t1 + 0.05 : ply.t1 - 0.2;
        const fade = 1 - ramp(t, fadeT, fadeT + 0.25, ease.inOut);
        const a = show ? grow * fade : 0;
        th.line.visible = th.ring.visible = a > 0.002;
        th.line.geometry.instanceCount = Math.max(1, Math.ceil(grow * N));
        th.line.material.opacity = (picked && t > ply.t1 - 0.3 ? 1.0 : 0.62) * a;
        th.ring.material.opacity = 0.75 * a * (grow > 0.98 ? 1 : 0);
      });
    }
  }

  // ---- still B: the fool's mate (an accent thread from d8 to h4)
  const sb = data.still_b, sc = data.still_c;
  const mateLine = new Line2(new LineGeometry(), new LineMaterial({ color: pal.accent, linewidth: 6, resolution: res,
                                                                    transparent: true, depthWrite: false }));
  mateLine.geometry.setPositions(arcPts(sb.mate[0], sb.mate[1], 'q')); mateLine.computeLineDistances();
  mateLine.renderOrder = 6; scene.add(mateLine);
  const mateRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 48).rotateX(-Math.PI / 2),
                                  new THREE.MeshBasicMaterial({ color: pal.accent, transparent: true, depthWrite: false }));
  mateRing.position.copy(sq(...sb.mate[1], 0.04)); scene.add(mateRing);
  const sqOf = (s) => ['abcdefgh'.indexOf(s[0]), +s[1] - 1];
  function placeFool() {
    for (const p of pieces) p.m.position.copy(sq(...p.sq));
    for (const [a, b] of sb.moves) {
      const p = pieces.find((q) => q.sq[0] === sqOf(a)[0] && q.sq[1] === sqOf(a)[1]);
      p.m.position.copy(sq(...sqOf(b)));
    }
    const q = pieces.find((p) => p.sq[0] === sb.mate[0][0] && p.sq[1] === sb.mate[0][1]);
    q.m.position.copy(sq(...sb.mate[1]));
  }

  // ---- DOM
  const P = (cls, html = '') => overlay.el(html, `la ${cls}`);
  const num = P('num', '1'), note = P('lb', NOTE[0]), li1 = P('lb'), li2 = P('sub');
  const caps = data.caption.map(([t0, html]) => ({ t0, el: P('cap', html) }));
  const fmt = (v) => Math.round(v).toLocaleString('en-US');
  const L = data.lichess;
  li1.innerHTML = `<b>${L.ratio} \u00d7</b> every rated game`;
  li2.innerHTML = `ever played on Lichess: <b>${fmt(L.games)}</b>`;
  // a number is as big as it can be while it fits 960 px (the middle of the frame), centred
  const fit = (el, px, max = 960) => {
    el.style.fontSize = `${px}px`;
    const w = el.offsetWidth;
    if (w > max) el.style.fontSize = `${px * max / w}px`;
  };
  // still B / C texts
  const bNum = P('num', String(sb.mates)),
        bNote = P('lb', `of the ${fmt(sb.games)} two-move games<br>end in checkmate`),
        bCap = P('cap', "and Black's queen slides out to <b>h4</b>");
  const cLb = P('lb', "Shannon's estimate for a typical game"), cBig = P('big', `10<sup>${sc.zeros}</sup>`);
  const zs = '0'.repeat(sc.zeros).split('').map((z, i) => (i >= sc.atoms ? `<i>${z}</i>` : z));
  let grouped = '1';
  zs.forEach((z, i) => { grouped += ((sc.zeros - i) % 3 === 0 ? ',<wbr>' : '') + z; });
  const cZeros = P('zeros', grouped);
  const cNote = P('lb', `atoms in the observable universe: about 10<sup style="font-size:.6em">${sc.atoms}</sup>`);
  const cNote2 = P('sub', `the last <b style="color:${pal.accent}">${sc.zeros - sc.atoms}</b> zeros are the difference`);
  const cCap = P('cap', `a one followed by <b>${sc.zeros}</b> zeros`);
  const allB = [bNum, bNote, bCap], allC = [cLb, cBig, cZeros, cNote, cCap];

  const M = 64, look = { exposure: 1.0 };
  // the hero camera: White's side, 42 degrees up, a slow push in and a small turn; the board sits between the
  // numbers (y < 720) and the caption band (y > 1290)
  function heroCam(t) {
    const dist = track(t, [[0, 234], [data.timing.duration, 227]]);
    const az = track(t, [[0, -0.06], [data.timing.duration, 0.03]]), el = 0.74;
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(0, 3, 2);
  }
  // the count snaps to each exact value as the piece lands: every number on screen is a real perft count
  function countAt(t) {
    let v = 1, n = 0;
    for (const ply of data.plies) {
      if (t < ply.t1) break;
      v = ply.count; n++;
    }
    return [v, n];
  }

  // ---- still D: the real game tree to two moves each (20, 400, 8,902, 197,281 branches), one game traced
  const sd = data.still_d, se = data.still_e;
  const tree = new THREE.Group(); scene.add(tree);
  {
    const K = data.tree.counts, depth = K.length;                 // K[k][i] = children of node i at ply k
    const leaves = K.map((r) => r.slice());                       // leaves under each node, bottom-up
    for (let k = depth - 2; k >= 0; k--) {
      let off = 0;
      leaves[k] = K[k].map((c) => { let s = 0; for (let j = 0; j < c; j++) s += leaves[k + 1][off + j]; off += c; return s; });
    }
    const N = leaves[0][0];
    const start = [[0]];
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
    const opac = [1, 0.32, 0.055];
    for (let k = 0; k < depth - 1; k++) {
      const pts = [];
      let off = 0;
      K[k].forEach((c, i) => {
        const a = nodePos[k][i];
        for (let j = 0; j < c; j++) {
          const b = nodePos[k + 1][off + j];
          pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
        off += c;
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const segs = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: pal.ink, transparent: true,
                                                                            opacity: opac[k], depthWrite: false }));
      tree.add(segs);
      if (k < 1) {                                                // the first ply again, thicker
        const lg = new LineSegmentsGeometry(); lg.setPositions(pts);
        tree.add(new LineSegments2(lg, new LineMaterial({ color: pal.ink, linewidth: k === 0 ? 3.6 : 2.2, resolution: res,
                                                          transparent: true, opacity: k === 0 ? 0.95 : 0.7, depthWrite: false })));
      }
    }
    {
      const a = new Float32Array(3 * N);
      let off = 0, n = 0;
      K[depth - 1].forEach((c, i) => {
        for (let j = 0; j < c; j++, n++) {
          const v = pos(depth, (start[depth - 1][i] + j + 0.5) / N, off + j);
          const h = Math.sin(n * 91.345) * 43758.5453 % 1;
          a[3 * n] = v.x; a[3 * n + 1] = v.y + h * 2.2; a[3 * n + 2] = v.z;
        }
        off += c;
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      tree.add(new THREE.Points(g, new THREE.PointsMaterial({ color: pal.ink, size: 1.6, sizeAttenuation: false,
                                                              transparent: true, opacity: 0.16, depthWrite: false })));
      // and a faint hair from each ply-3 node toward its games
      const hp = [];
      K[depth - 1].forEach((c, i) => {
        const a0 = nodePos[depth - 1][i], u = (start[depth - 1][i] + c / 2) / N, b = pos(depth, u, i);
        hp.push(a0.x, a0.y, a0.z, b.x, b.y, b.z);
      });
      const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
      tree.add(new THREE.LineSegments(hg, new THREE.LineBasicMaterial({ color: pal.ink, transparent: true, opacity: 0.025,
                                                                       depthWrite: false })));
    }
    // the one game everyone in the hook played: 1. e4 e5 2. Nf3 Nc6
    const PATH = data.tree.path, idx = [0];
    let node = 0;
    for (let k = 0; k < depth - 1; k++) {
      let off = 0; for (let i = 0; i < node; i++) off += K[k][i];
      node = off + PATH[k]; idx.push(node);
    }
    const way = idx.map((i, k) => nodePos[k][i]);
    way.push(pos(depth, (start[depth - 1][node] + PATH[depth - 1] + 0.5) / N, 0));
    const lg = new LineGeometry(); lg.setPositions(way.flatMap((v) => [v.x, v.y, v.z]));
    tree.add(new Line2(lg, new LineMaterial({ color: pal.ink, linewidth: 5, resolution: res, depthWrite: false })));
  }
  const dNum = P('num', fmt(sd.count)), dNote = P('lb', NOTE[4]),
        dSmall = P('sub', 'every branch is a real game'),
        dCap = P('cap', '<b>197,281</b> games after two moves each');

  // ---- still E: two clouds, 10^120 everywhere and 10^80 as a speck (not to scale)
  const cloud = (n, c, R, seed, size, op) => {        // grains spread evenly through a ball of radius R
    let st = seed;
    const r = () => { st = (st * 16807) % 2147483647; return st / 2147483647; };
    const a = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) {
      let x, y, z;
      do { x = 2 * r() - 1; y = 2 * r() - 1; z = 2 * r() - 1; } while (x * x + y * y + z * z > 1);
      a[3 * i] = c[0] + x * R; a[3 * i + 1] = c[1] + y * R; a[3 * i + 2] = c[2] + z * R;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: pal.ink, size, sizeAttenuation: false, transparent: true,
                                                          opacity: op, depthWrite: false }));
  };
  const clouds = new THREE.Group(); scene.add(clouds);
  const SPECK = [4, 46, 18];
  clouds.add(cloud(140000, [0, 40, -95], 92, 7, 1.7, 0.3), cloud(2600, SPECK, 1.1, 11, 2.0, 0.9));
  const ringPts = [];
  for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; ringPts.push(SPECK[0] + 3.2 * Math.cos(a), SPECK[1] + 3.2 * Math.sin(a), SPECK[2]); }
  const rg = new LineGeometry(); rg.setPositions(ringPts);
  clouds.add(new Line2(rg, new LineMaterial({ color: pal.accent, linewidth: 4.5, resolution: res, depthWrite: false })));
  const eLb = P('lb', "Shannon's estimate for a typical game"), eBig = P('big', `10<sup>${se.zeros}</sup>`),
        eSpeck = P('small', `every atom in the<br>observable universe, <b>10<sup>${se.atoms}</sup></b>`),
        eNote = P('sub', 'not to scale'),
        eCap = P('cap', `so Shannon's estimate has <b>${se.zeros - se.atoms}</b> more`);

  return {
    scene, camera,
    post: { ss: SS, samples: 4, shutter: 0.5, grain: 0.03, vignette: 0.34, exposure: 1.0, bg: 0x0b0907 },
    look: () => look,
    update(t, opts = {}) {
      const frame = t < sb.t - 0.01 ? 'A' : t < sc.t - 0.01 ? 'B' : t < sd.t - 0.01 ? 'C' : t < se.t - 0.01 ? 'D' : 'E';
      mateLine.visible = mateRing.visible = frame === 'B';
      tree.visible = frame === 'D'; clouds.visible = frame === 'E';
      room.key.intensity = frame === 'E' ? 1.1 : 3.4;
      if (frame === 'A') {
        placePieces(t);
        drawThreads(t, true);
        heroCam(t);
        look.exposure = 1.0;
      } else {
        drawThreads(t, false);
        if (frame === 'B') {
          placeFool();
          camera.position.set(74, 96, 150); camera.lookAt(6, 0, -2);
          look.exposure = 1.0;
        } else if (frame === 'C') {
          for (const p of pieces) p.m.position.copy(sq(...p.sq));
          heroCam(data.timing.duration);
          camera.lookAt(0, 3, -30);
          look.exposure = 0.24;
        } else if (frame === 'D') {
          for (const p of pieces) p.m.position.copy(sq(...p.sq));
          camera.position.set(0, 52, 205); camera.lookAt(0, 16, -6);
          look.exposure = 1.0;
        } else {
          for (const p of pieces) p.m.position.copy(sq(...p.sq));
          heroCam(data.timing.duration);
          camera.lookAt(0, 14, -10);
          look.exposure = 1.0;
        }
      }
      if (opts.sub) return;
      // ---- DOM
      const A = frame === 'A' ? 1 : 0;
      const [v, n] = countAt(t);
      num.textContent = fmt(v);
      fit(num, 190);
      note.textContent = NOTE[n];
      num.style.color = t >= data.counter.accent_t && A ? pal.accent : pal.ink;
      overlay.place(num, 540, 400, { anchor: 'c', opacity: A });
      overlay.place(note, 540, 528, { anchor: 'c', opacity: A });
      const g1 = ramp(t, L.t, L.t + 0.5, ease.out), g2 = ramp(t, L.t2, L.t2 + 0.6, ease.out);
      overlay.place(li1, 540, 600, { anchor: 'c', opacity: A * g1 });
      overlay.place(li2, 540, 646, { anchor: 'c', opacity: A * g2 });
      caps.forEach((c, i) => {
        const t1 = i + 1 < caps.length ? caps[i + 1].t0 : 1e9;
        overlay.place(c.el, 540, 1380, { anchor: 'c', opacity: A && t >= c.t0 && t < t1 ? 1 : 0 });
      });
      const B = frame === 'B' ? 1 : 0, C = frame === 'C' ? 1 : 0;
      overlay.place(bNum, 540, 400, { anchor: 'c', opacity: B });
      overlay.place(bNote, 540, 548, { anchor: 'c', opacity: B });
      overlay.place(bCap, 540, 1380, { anchor: 'c', opacity: B });
      overlay.place(cBig, 540, 420, { anchor: 'c', opacity: C });
      overlay.place(cLb, 540, 580, { anchor: 'c', opacity: C });
      overlay.place(cZeros, 540, 632, { anchor: 't', opacity: C });
      overlay.place(cNote, 540, 880, { anchor: 'c', opacity: C });
      overlay.place(cNote2, 540, 928, { anchor: 'c', opacity: C });
      overlay.place(cCap, 540, 1380, { anchor: 'c', opacity: C });
      const D = frame === 'D' ? 1 : 0, E = frame === 'E' ? 1 : 0;
      fit(dNum, 190);
      overlay.place(dNum, 540, 400, { anchor: 'c', opacity: D });
      overlay.place(dNote, 540, 528, { anchor: 'c', opacity: D });
      overlay.place(dSmall, 540, 574, { anchor: 'c', opacity: D });
      overlay.place(dCap, 540, 1380, { anchor: 'c', opacity: D });
      overlay.place(eBig, 540, 420, { anchor: 'c', opacity: E });
      overlay.place(eLb, 540, 580, { anchor: 'c', opacity: E });
      const sp = toScreen(new THREE.Vector3(SPECK[0] - 3.2, SPECK[1], SPECK[2]), camera);
      overlay.place(eSpeck, sp.x - 22, sp.y, { anchor: 'r', opacity: E });
      overlay.place(eNote, 540, 626, { anchor: 'c', opacity: E });
      overlay.place(eCap, 540, 1380, { anchor: 'c', opacity: E });
      void allB; void allC;
    },
  };
}
