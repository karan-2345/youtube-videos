// scenes/3d/lib/board3d.js -- the club-room set every chess scene shares: a walnut-and-maple tournament board on a
// dark table under one warm lamp, and a turned boxwood / ebonised Staunton set (units = cm, 57 mm squares, king
// 9.5 cm). Wood is drawn on canvas from seeded noise, pieces are lathe-turned profiles (the knight's head is an
// extruded, bevelled silhouette). Everything is a pure function of the scene data and t.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/scenes/web/runtime.js';

export const SQ = 5.7;                       // square (cm)
export const BORDER = 3.4, THICK = 2.2;      // frame width and board thickness (cm)

/** Board square centre (file 0-7 = a-h, rank 0-7 = 1-8) at height y. White sits at +z. */
export function sq(file, rank, y = 0) { return new THREE.Vector3((file - 3.5) * SQ, y, (3.5 - rank) * SQ); }

// ---------------------------------------------------------------- wood
function hash2(x, y, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y, s, oct = 4) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, s + i * 13); amp *= 0.5; f *= 2.03; }
  return v;
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Straight-grained, slightly figured wood: grain lines run along v. */
export function woodCanvas({ base, dark, size = 1024, seed = 1, rings = 34, warp = 1.6, fibre = 0.12, contrast = 0.5 }) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), img = g.createImageData(size, size), px = img.data;
  const A = hex(base), B = hex(dark);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const w = fbm(u * 3.0, v * 0.55, seed) * warp + fbm(u * 9, v * 1.4, seed + 5) * 0.25;
      let s = 0.5 + 0.5 * Math.sin((u * rings + w * 6) * Math.PI * 2);
      s = Math.pow(s, 2.6);
      const f = vnoise(u * 420, v * 9, seed + 9) * fibre + vnoise(u * 90, v * 3, seed + 11) * fibre * 0.6;
      const m = Math.min(1, s * contrast + f);
      const i = 4 * (y * size + x);
      px[i] = A[0] + (B[0] - A[0]) * m; px[i + 1] = A[1] + (B[1] - A[1]) * m; px[i + 2] = A[2] + (B[2] - A[2]) * m;
      px[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function tex(cv, repeat = 1) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/** A box whose UVs sample a random patch of a big wood texture (rotated 90 degrees if `turn`). */
function veneerBox(w, h, d, r, turn, scale = 0.22) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, ou = r(), ov = r();
  for (let i = 0; i < uv.count; i++) {
    let u = uv.getX(i), v = uv.getY(i);
    if (turn) [u, v] = [v, 1 - u];
    uv.setXY(i, ou + u * scale, ov + v * scale);
  }
  return g;
}

// ---------------------------------------------------------------- the room: table, board, lamp
export function buildRoom(scene, renderer, pal, { lamp = 3.3, lampPos = [-38, 128, 46] } = {}) {
  scene.background = new THREE.Color(pal.bg);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;

  const maple = tex(woodCanvas({ base: pal.maple, dark: pal.maple_grain, seed: 3, rings: 46, contrast: 0.42 }));
  const walnut = tex(woodCanvas({ base: pal.walnut, dark: pal.walnut_grain, seed: 8, rings: 28, contrast: 0.6, warp: 2.2 }));
  const table = tex(woodCanvas({ base: pal.table, dark: pal.table_grain, seed: 21, rings: 9, contrast: 0.45, warp: 2.6, fibre: 0.06 }), 2);

  const top = new THREE.Mesh(new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ map: table, roughness: 0.78, metalness: 0 }));
  top.rotation.x = -Math.PI / 2; top.position.y = -THICK; top.receiveShadow = true;
  scene.add(top);

  const r = rng(57), light = [], dark = [];
  const gap = 0.05;                                     // a hairline of the walnut base shows between squares
  for (let f = 0; f < 8; f++) for (let k = 0; k < 8; k++) {
    const g = veneerBox(SQ - gap, 0.3, SQ - gap, r, (f + k) % 2 === 1);
    const p = sq(f, k, -0.15);
    g.translate(p.x, p.y, p.z);
    ((f + k) % 2 === 1 ? light : dark).push(g);       // a1 (f 0, k 0) is dark
  }
  const lacq = { roughness: 0.38, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4 };
  const lightSq = new THREE.Mesh(mergeGeometries(light), new THREE.MeshPhysicalMaterial({ map: maple, ...lacq }));
  const darkSq = new THREE.Mesh(mergeGeometries(dark), new THREE.MeshPhysicalMaterial({ map: walnut, ...lacq }));
  const full = 8 * SQ + 2 * BORDER;
  const frameGeom = veneerBox(full, THICK - 0.3, full, r, false, 0.9);
  frameGeom.translate(0, -0.3 - (THICK - 0.3) / 2, 0);
  const frame = new THREE.Mesh(frameGeom, new THREE.MeshPhysicalMaterial({ map: walnut, color: '#b9a493', ...lacq }));
  // a thin maple inlay around the playing field
  const line = new THREE.Group();
  const s4 = 4 * SQ + 0.55, wIn = 0.22;
  for (const [x, z, w, d] of [[0, -s4, 2 * s4 + wIn, wIn], [0, s4, 2 * s4 + wIn, wIn], [-s4, 0, wIn, 2 * s4], [s4, 0, wIn, 2 * s4]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), new THREE.MeshPhysicalMaterial({ map: maple, ...lacq }));
    m.position.set(x, -0.29, z); line.add(m);
  }
  for (const m of [lightSq, darkSq, frame]) { m.receiveShadow = true; m.castShadow = true; }
  const board = new THREE.Group(); board.add(lightSq, darkSq, frame, line);
  scene.add(board);
  board.add(coordinates(pal));

  const key = new THREE.SpotLight(pal.lamp, lamp, 0, 25 * Math.PI / 180, 0.55, 0);
  key.position.set(...lampPos); key.target.position.set(0, 0, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 60; key.shadow.camera.far = 260; key.shadow.bias = -0.0002; key.shadow.normalBias = 0.03;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0xb6c0cc, 0x140d08, 0.22));
  return { board, key };
}

/** a-h and 1-8 printed on the frame, the way tournament boards have them. */
function coordinates(pal) {
  const g = new THREE.Group();
  const font = `600 64px 'Archivo'`;
  const label = (txt) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    const c = cv.getContext('2d'); c.font = font; c.fillStyle = pal.inlay; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, 48, 52);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, depthWrite: false, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  const off = 4 * SQ + BORDER / 2;
  for (let i = 0; i < 8; i++) {
    const a = label('abcdefgh'[i]); a.position.copy(sq(i, 0)).setY(-0.28); a.position.z = off; g.add(a);
    const n = label(String(i + 1)); n.position.copy(sq(0, i)).setY(-0.28); n.position.x = -off; g.add(n);
  }
  return g;
}

// ---------------------------------------------------------------- the pieces
const v2 = (pts) => pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));

function arc(cx, cy, rx, ry, a0, a1, n = 14) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

/** The turned foot every piece shares: a wide base, a bead, a cove up to the stem. */
function foot(R) {
  return [[0, 0], [R, 0], [R + 0.03, 0.14], [R, 0.32], [R * 0.91, 0.42], [R * 0.93, 0.55], [R * 0.86, 0.68],
          [R * 0.72, 0.8], [R * 0.66, 0.95]];
}

const PROFILES = {
  p: () => [...foot(1.55), [0.92, 1.2], [0.8, 1.6], [0.68, 2.1], [0.6, 2.5], [0.62, 2.62], [1.0, 2.72], [1.05, 2.82],
            [0.98, 2.92], [0.62, 3.0], ...arc(0, 3.85, 0.95, 0.95, -55, 90)],
  r: () => [...foot(1.72), [1.1, 1.2], [1.02, 1.8], [0.96, 2.8], [0.94, 3.55], [1.2, 3.7], [1.26, 3.85], [1.16, 3.98],
            [1.18, 4.1], [1.26, 4.3], [1.3, 4.95], [0.86, 4.95], [0.86, 4.75], [0, 4.75]],
  b: () => [...foot(1.65), [0.98, 1.2], [0.84, 1.8], [0.68, 2.8], [0.58, 3.9], [0.98, 4.05], [1.04, 4.2], [0.95, 4.32],
            [0.62, 4.42], [0.5, 4.55], ...arc(0, 5.6, 0.86, 1.15, -68, 72, 18), [0.2, 6.75], [0.16, 6.82],
            ...arc(0, 7.06, 0.3, 0.3, -55, 90, 8)],
  q: () => [...foot(1.85), [1.12, 1.25], [0.98, 2.0], [0.8, 3.2], [0.64, 4.8], [1.12, 5.0], [1.18, 5.15], [1.05, 5.28],
            [1.12, 5.38], [0.98, 5.5], [0.7, 5.65], [0.78, 6.1], [1.0, 6.8], [1.24, 7.25], [1.3, 7.38], [1.08, 7.45],
            [0.78, 7.5], ...arc(0, 7.5, 0.78, 0.55, 0, 70, 6), [0.16, 8.08], ...arc(0, 8.32, 0.3, 0.3, -55, 90, 8)],
  k: () => [...foot(1.92), [1.16, 1.25], [1.02, 2.0], [0.84, 3.3], [0.68, 5.1], [1.16, 5.3], [1.22, 5.45], [1.08, 5.58],
            [1.15, 5.68], [1.0, 5.8], [0.72, 5.95], [0.8, 6.4], [1.02, 7.1], [1.2, 7.55], [1.22, 7.68], [1.0, 7.78],
            ...arc(0, 7.78, 1.0, 0.42, 0, 90, 8)],
  n: () => [...foot(1.75), [1.1, 1.15], [1.12, 1.3], [1.24, 1.42], [1.2, 1.55], [0, 1.55]],
};

function knightHead() {
  // side view of the horse's head and neck, facing -x, in cm above the collar
  const s = new THREE.Shape();
  const pts = [[0.98, 1.45], [1.1, 2.3], [1.02, 3.2], [0.86, 4.0], [0.66, 4.65], [0.52, 5.2], [0.42, 5.62], [0.22, 5.3],
               [0.02, 5.05], [-0.32, 4.98], [-0.72, 4.72], [-1.12, 4.2], [-1.48, 3.62], [-1.6, 3.32], [-1.48, 3.08],
               [-1.12, 3.02], [-0.7, 3.2], [-0.42, 3.05], [-0.5, 2.6], [-0.82, 2.1], [-0.98, 1.45]];
  s.moveTo(...pts[0]);
  s.splineThru(pts.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
  s.lineTo(...pts[0]);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.15, bevelEnabled: true, bevelThickness: 0.32, bevelSize: 0.22,
                                           bevelSegments: 6, curveSegments: 64 });
  g.translate(0, 0, -0.575);
  // weld the extrusion's vertices so the bevel shades smoothly, not as facets
  const pos = new THREE.BufferGeometry();
  pos.setAttribute('position', g.attributes.position);
  const welded = mergeVertices(pos, 1e-4);
  welded.computeVertexNormals();
  return welded;
}

function crown(rOut, rIn, y0, h, n = 6, gapDeg = 22) {
  const parts = [];
  const step = 360 / n;
  for (let i = 0; i < n; i++) {
    const a0 = (i * step + gapDeg / 2) * Math.PI / 180, a1 = ((i + 1) * step - gapDeg / 2) * Math.PI / 180;
    const s = new THREE.Shape();
    s.absarc(0, 0, rOut, a0, a1, false);
    s.lineTo(rIn * Math.cos(a1), rIn * Math.sin(a1));
    s.absarc(0, 0, rIn, a1, a0, true);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05,
                                             bevelSegments: 2, curveSegments: 10 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    parts.push(g);
  }
  return parts;
}

function lathe(pts) {
  const g = new THREE.LatheGeometry(v2(pts), 64);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** One merged geometry per piece kind. */
export function pieceGeometries() {
  const out = {};
  for (const k of 'prbqk') out[k] = lathe(PROFILES[k]());
  out.r = mergeGeometries([out.r, ...crown(1.3, 0.86, 4.85, 0.7)].map(dropUV));
  const q = [dropUV(out.q)];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, b = new THREE.SphereGeometry(0.2, 12, 8).toNonIndexed();
    b.translate(1.2 * Math.cos(a), 7.5, 1.2 * Math.sin(a)); q.push(dropUV(b));
  }
  out.q = mergeGeometries(q);
  const cross = [new THREE.BoxGeometry(0.36, 1.35, 0.36).translate(0, 8.62, 0), new THREE.BoxGeometry(1.0, 0.34, 0.36).translate(0, 8.82, 0)];
  out.k = mergeGeometries([dropUV(out.k), ...cross.map((c) => dropUV(c.toNonIndexed()))]);
  out.n = mergeGeometries([dropUV(lathe(PROFILES.n())), dropUV(knightHead().toNonIndexed())]);
  out.b = dropUV(out.b); out.p = dropUV(out.p);
  return out;
}

function dropUV(g) {
  // the pieces use a triplanar-free, untextured lacquer; keep only position + normal so merges always line up
  const n = new THREE.BufferGeometry();
  n.setAttribute('position', g.attributes.position);
  if (g.attributes.normal) n.setAttribute('normal', g.attributes.normal);
  return n;
}

export function pieceMaterials(pal) {
  return {
    w: new THREE.MeshPhysicalMaterial({ color: pal.boxwood, roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.3, sheen: 0.2 }),
    b: new THREE.MeshPhysicalMaterial({ color: pal.ebony, roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.22 }),
  };
}

/** A piece mesh: white pieces' knights face the queen side (-x), black ones the king side, as on a real board. */
export function makePiece(geoms, mats, kind, white) {
  const m = new THREE.Mesh(geoms[kind], white ? mats.w : mats.b);
  m.castShadow = true; m.receiveShadow = true;
  if (kind === 'n') m.rotation.y = white ? -0.35 : Math.PI - 0.35;
  return m;
}
