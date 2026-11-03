// scenes/lib.js -- helpers shared by every shot: easing/keys, phrase anchors, type, numbers, textures, paper folding.
import * as THREE from 'three';

export const W = 1080, H = 1920;
export const SAFE = { top: 240, bottom: 1680 };      // the middle 3:4 of the frame: everything that matters stays inside
export const PAL = {
  floor: 0x1a1917, paper: 0xf1eee7, ink: '#f4f1ea', dim: '#a9a49a',
  accent: '#f2a93b', accentHex: 0xf2a93b,            // the one accent: warm amber (also the gold foil)
  bg: 0x0d0d0e,
};

// ------------------------------------------------------------------ easing and keys
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
};
export const ramp = (t, t0, t1, fn = ease.inOut) => fn(clamp01((t - t0) / Math.max(1e-9, t1 - t0)));
/** keys [[t, v], ...] (v number or array); held outside; log=true interpolates in log space (scale moves). */
export function keyed(t, ks, { log = false, fn = ease.inOut } = {}) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
    if (t <= t1) {
      const u = fn(clamp01((t - t0) / Math.max(1e-9, t1 - t0)));
      const f = (a, b) => (log ? Math.exp(lerp(Math.log(a), Math.log(b), u)) : lerp(a, b, u));
      return Array.isArray(v0) ? v0.map((a, k) => f(a, v1[k])) : f(v0, v1);
    }
  }
  return ks[ks.length - 1][1];
}
/** Window opacity: fades in over [a, a+fi], out over [b-fo, b]. */
export const win = (t, a, b, fi = 0.35, fo = 0.35) => ramp(t, a, a + fi, ease.sine) * (1 - ramp(t, b - fo, b, ease.sine));

// ------------------------------------------------------------------ phrase anchors on the measured narration
// A sentence's start/end are measured; a word inside it is placed by its share of the spoken characters.
export function anchors(sentences) {
  const by = Object.fromEntries(sentences.map((s) => [s.id, s]));
  return (id, phrase, edge = 'start') => {
    const s = by[id];
    if (!s) throw new Error('no sentence ' + id);
    const i = s.text.indexOf(phrase);
    if (i < 0) throw new Error(`phrase "${phrase}" not in ${id}`);
    const pos = edge === 'end' ? i + phrase.length : i;
    return s.start + (s.end - s.start) * pos / s.text.length;
  };
}

// ------------------------------------------------------------------ numbers (all values arrive from data.json)
export const commas = (n) => Math.round(n).toLocaleString('en-US');
export function sig(n, k = 3) { const p = Math.pow(10, Math.floor(Math.log10(Math.abs(n))) - k + 1); return Math.round(n / p) * p; }
/** A length in metres, the way a person would say it. */
export function length(m, { ly = 9.4607304725808e15, digits = 3 } = {}) {
  const s3 = (v) => sig(v, digits).toLocaleString('en-US', { maximumSignificantDigits: digits });
  if (m < 0.01) return [`${(m * 1000).toFixed(1)}`, 'mm'];
  if (m < 1) return [`${(m * 100).toFixed(1)}`, 'cm'];
  if (m < 1000) return [`${Math.round(m)}`, 'm'];
  const km = m / 1000;
  if (km < 1e6) return [commas(km), 'km'];
  if (km < 1e9) return [s3(km / 1e6), 'million km'];
  if (km < 1e12) return [s3(km / 1e9), 'billion km'];
  if (m < 0.1 * ly) return [s3(km / 1e12), 'trillion km'];
  if (m < 1000 * ly) return [s3(m / ly), m / ly < 1.5 ? 'light year' : 'light years'];
  return [commas(sig(m / ly, digits)), 'light years'];
}

// ------------------------------------------------------------------ type (Inter ExtraBold, centred, DOM overlay)
export class Type {
  constructor() { this.root = document.getElementById('ov'); this.items = []; }
  make(size = 96, color = PAL.ink) {
    const d = document.createElement('div');
    Object.assign(d.style, { position: 'absolute', left: '0', top: '0', fontSize: size + 'px', lineHeight: '1.04',
      color, whiteSpace: 'nowrap', textAlign: 'center', letterSpacing: '-0.02em', opacity: 0, willChange: 'transform' });
    d.style.fontVariantNumeric = 'tabular-nums';
    this.root.appendChild(d); this.items.push(d);
    return d;
  }
  /** Centre the element at (x, y); hides it when op ~ 0. Text that doesn't fit in maxW is scaled down. */
  put(d, html, { x = W / 2, y = 400, op = 1, scale = 1, maxW = 960 } = {}) {
    if (op <= 0.003) { d.style.opacity = 0; return; }
    if (d._html !== html) { d.innerHTML = html; d._html = html; d._w = d.offsetWidth; d._h = d.offsetHeight; }
    const s = scale * Math.min(1, maxW / d._w);
    d.style.transform = `translate(${x - d._w / 2}px, ${y - d._h / 2}px) scale(${s})`;
    d.style.transformOrigin = '50% 50%';
    d.style.opacity = op;
  }
  hideAll() { for (const d of this.items) d.style.opacity = 0; }
}

// ------------------------------------------------------------------ textures (generated, no downloads)
export function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Value noise on a canvas (for the floor's slight unevenness and the clouds). */
function noiseCanvas(size, octaves, seed, fnPix, skip = 0) {
  const r = rng(seed), grids = [];
  for (let o = skip; o < octaves; o++) { const n = 4 << o; grids.push({ n, v: Float32Array.from({ length: n * n }, () => r()) }); }
  const sample = (g, x, y) => {
    const fx = x * g.n, fy = y * g.n, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
    const at = (i, j) => g.v[((j % g.n + g.n) % g.n) * g.n + ((i % g.n + g.n) % g.n)];
    const s = (q) => q * q * (3 - 2 * q);
    return lerp(lerp(at(x0, y0), at(x0 + 1, y0), s(u)), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), s(u)), s(v));
  };
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, a = 0.5, tot = 0;
    for (const g of grids) { v += a * sample(g, x / size, y / size); tot += a; a *= 0.55; }
    fnPix(img.data, (y * size + x) * 4, v / tot, x / size, y / size);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
export function floorTexture() {
  const c = noiseCanvas(512, 7, 7, (d, i, v, x, y) => { const g = 128 + (v - 0.5) * 70; d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255; }, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
export function cloudTexture(seed) {
  const c = noiseCanvas(256, 6, seed, (d, i, v, x, y) => {
    const r = Math.hypot(x - 0.5, (y - 0.5) * 1.6) * 2;
    const a = clamp01((v - 0.42) * 3.2) * clamp01(1 - r) ** 1.4;
    const shade = 200 + 55 * clamp01((0.5 - y) * 2 + v * 0.5);
    d[i] = d[i + 1] = d[i + 2] = shade; d[i + 3] = a * 255;
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Paper edge: one faint line per layer (the texture repeats once per layer). */
export function layerTexture(base = '#f1eee7', line = '#8b877f') {
  const c = document.createElement('canvas'); c.width = 4; c.height = 32;
  const ctx = c.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, 4, 32);
  ctx.fillStyle = line; ctx.fillRect(0, 0, 4, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ------------------------------------------------------------------ materials
export function paperMaterials(tex, { color = PAL.paper, metal = false } = {}) {
  const top = metal ? new THREE.MeshStandardMaterial({ color: PAL.accentHex, metalness: 1, roughness: 0.38 })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
  const side = metal ? new THREE.MeshStandardMaterial({ color: 0xc98f2c, metalness: 1, roughness: 0.45 })
    : new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex.clone(), roughness: 0.9 });
  if (!metal) side.map.needsUpdate = true;
  // BoxGeometry groups: +x, -x, +y, -y, +z, -z
  return [side, side, top, top, side, side];
}

// ------------------------------------------------------------------ the fold: a box that halves along its longer side
// State after k folds: extents [x0,x1] x [z0,z1], height t*2^k. Fold k+1: the far half (the +x or +z side) turns over a
// hinge at the middle, 180 degrees, onto the near half. Progress f in [0, N] (fractional = mid-fold).
export class Folder {
  constructor(parent, { a, b, t, metal = false, tex, maxFolds = 13, minH = 0 }) {
    this.t = t; this.states = []; this.minH = minH;
    let s = { x0: -a / 2, x1: a / 2, z0: -b / 2, z1: b / 2, h: t, layers: 1 };
    for (let k = 0; k <= maxFolds; k++) {
      this.states.push(s);
      const alongX = (s.x1 - s.x0) >= (s.z1 - s.z0);
      s = alongX ? { ...s, x1: (s.x0 + s.x1) / 2, h: s.h * 2, layers: s.layers * 2, axis: 'x' }
                 : { ...s, z1: (s.z0 + s.z1) / 2, h: s.h * 2, layers: s.layers * 2, axis: 'z' };
      this.states[k].next = alongX ? 'x' : 'z';
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.base = new THREE.Mesh(geo, paperMaterials(tex, { metal }));
    this.pivot = new THREE.Object3D();
    this.flap = new THREE.Mesh(geo, paperMaterials(tex, { metal }));
    this.pivot.add(this.flap);
    for (const m of [this.base, this.flap]) { m.castShadow = true; m.receiveShadow = false; }
    this.group = new THREE.Group(); this.group.add(this.base, this.pivot);
    parent.add(this.group);
  }
  _layers(mesh, n) {
    const side = mesh.material[0];
    if (side.map) { side.map.repeat.set(1, n); side.map.offset.set(0, n < 4 ? 0.5 : 0); }
  }
  /** f: folds done (fractional mid-fold). lift: an attempted fold that fails (0..1 of a small angle). */
  set(f, { lift = 0 } = {}) {
    const k = Math.min(Math.floor(f), this.states.length - 2), u = ease.inOut(clamp01(f - k));
    const s0 = this.states[k], s = { ...s0, h: Math.max(s0.h, this.minH) };
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    if (u <= 0 && lift <= 0) {                      // at rest: one block
      this.base.scale.set(s.x1 - s.x0, s.h, s.z1 - s.z0); this.base.position.set(cx, s.h / 2, cz);
      this._layers(this.base, s.layers);
      this.pivot.visible = false;
      return s;
    }
    this.pivot.visible = true;
    const ang = u > 0 ? Math.PI * u : lift;
    if (s.next === 'x') {
      const xm = cx, w = s.x1 - xm;
      this.base.scale.set(xm - s.x0, s.h, s.z1 - s.z0); this.base.position.set((s.x0 + xm) / 2, s.h / 2, cz);
      this.pivot.position.set(xm, s.h, cz); this.pivot.rotation.set(0, 0, ang);
      this.flap.scale.set(w, s.h, s.z1 - s.z0); this.flap.position.set(w / 2, -s.h / 2, 0);
    } else {
      const zm = cz, w = s.z1 - zm;
      this.base.scale.set(s.x1 - s.x0, s.h, zm - s.z0); this.base.position.set(cx, s.h / 2, (s.z0 + zm) / 2);
      this.pivot.position.set(cx, s.h, zm); this.pivot.rotation.set(-ang, 0, 0);
      this.flap.scale.set(s.x1 - s.x0, s.h, w); this.flap.position.set(0, -s.h / 2, w / 2);
    }
    this._layers(this.base, s.layers); this._layers(this.flap, s.layers);
    return s;
  }
  /** Centre of the block (for the camera) at fold progress f, continuous. */
  centre(f) {
    const k = Math.min(Math.floor(f), this.states.length - 2), u = ease.inOut(clamp01(f - k));
    const a = this.states[k], b = this.states[k + 1];
    const c = (s) => [(s.x0 + s.x1) / 2, s.h / 2, (s.z0 + s.z1) / 2, Math.max(s.x1 - s.x0, s.z1 - s.z0)];
    return c(a).map((v, i) => lerp(v, c(b)[i], u));
  }
}

// ------------------------------------------------------------------ figures: a walking person, a hand, a roll
const clay = () => new THREE.MeshStandardMaterial({ color: 0xbdb6ab, roughness: 0.7 });
export function person() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x8f8a82, roughness: 0.8 });
  const skin = clay();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 6, 12), m); body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin); head.position.y = 1.55; g.add(head);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Object3D(); hip.position.set(0, 0.8, s * 0.09); g.add(hip);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.62, 4, 8), m); leg.position.y = -0.39; hip.add(leg); legs.push(hip);
    const sh = new THREE.Object3D(); sh.position.set(0, 1.32, s * 0.22); g.add(sh);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), m); arm.position.y = -0.3; sh.add(arm); arms.push(sh);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.walk = (phase, amt = 1) => {
    legs.forEach((h, i) => { h.rotation.z = Math.sin(phase + i * Math.PI) * 0.45 * amt; });
    arms.forEach((h, i) => { h.rotation.z = -Math.sin(phase + i * Math.PI) * 0.35 * amt; });
  };
  return g;
}

/** A relaxed right hand, palm down, fingers draped forward (+x), built from rounded pieces in a pale matte clay. */
export function hand() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xd9cfc3, roughness: 0.62 });
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), m);
  palm.scale.set(0.05, 0.013, 0.041); palm.position.set(0, 0.011, 0); g.add(palm);
  const back = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), m);
  back.scale.set(0.055, 0.015, 0.034); back.position.set(-0.045, 0.014, -0.002); back.rotation.z = 0.1; g.add(back);
  const fingers = [[0.022, 0.064, 0.0098], [0.007, 0.072, 0.0102], [-0.008, 0.069, 0.0099], [-0.023, 0.056, 0.0088]];
  for (const [z, len, r] of fingers) {
    const k1 = new THREE.Object3D(); k1.position.set(0.042, 0.012, z); k1.rotation.set(0, z * 1.6, -0.28); g.add(k1);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(r, len * 0.42, 8, 14), m); a.rotation.z = Math.PI / 2; a.position.x = len * 0.24; k1.add(a);
    const k2 = new THREE.Object3D(); k2.position.x = len * 0.47; k2.rotation.z = -0.62; k1.add(k2);
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.94, len * 0.3, 8, 14), m); b.rotation.z = Math.PI / 2; b.position.x = len * 0.2; k2.add(b);
    const k3 = new THREE.Object3D(); k3.position.x = len * 0.4; k3.rotation.z = -0.4; k2.add(k3);
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.86, len * 0.16, 8, 14), m); c.rotation.z = Math.PI / 2; c.position.x = len * 0.12; k3.add(c);
  }
  const t1 = new THREE.Object3D(); t1.position.set(-0.012, 0.006, 0.036); t1.rotation.set(0.0, -0.75, -0.25); g.add(t1);
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.034, 8, 14), m); th.rotation.z = Math.PI / 2; th.position.x = 0.024; t1.add(th);
  const t2 = new THREE.Object3D(); t2.position.x = 0.046; t2.rotation.z = -0.3; t1.add(t2);
  const th2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0108, 0.02, 8, 14), m); th2.rotation.z = Math.PI / 2; th2.position.x = 0.014; t2.add(th2);
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.2, 10, 20), m);
  wrist.rotation.z = Math.PI / 2 - 0.22; wrist.scale.set(1, 1, 0.82); wrist.position.set(-0.17, 0.035, -0.002); g.add(wrist);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}

export function roll() {
  const g = new THREE.Group();
  const paper = new THREE.MeshStandardMaterial({ color: PAL.paper, roughness: 0.9 });
  const core = new THREE.MeshStandardMaterial({ color: 0x7d6c57, roughness: 0.95 });
  const hole = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 });
  const R = 0.055, r = 0.021, w = 0.105;
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(R, R, w, 72), paper);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w + 0.0012, 48), core);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.0012, r - 0.0012, w + 0.0016, 48), hole);
  g.add(outer, tube, inner);
  g.rotation.x = Math.PI / 2;                    // axis along z: rolls along x
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  const holder = new THREE.Group(); holder.add(g); holder.userData = { R, w };
  return holder;
}
