// scenes/3d/lib/finger.js -- the wrinkly-fingers Short's actors: the fingertip whose pad buckles into folds, the
// bath water, the skin block whose top buckles over tightening blood vessels, nerve fibres with pulses, the glass
// marble and the tire. The stage, labels, camera helpers and skin textures come from cut.js.
//
// The fold pattern is a fixed function (no randomness, no noise): the same folds every time (S04), and the blood
// vessels can be placed exactly under the valleys.
import * as THREE from 'three';
import { rng, ramp, ease, clamp01, lerp } from '/scenes/web/runtime.js';
import { BLK, vec, canvasTex, skinTile, layerTex, glowTex, NOISE_GLSL } from './cut.js';

// ---------------------------------------------------------------- the finger
// Tip at y = 0, pointing down; the pad faces +z (angle a = 0) and the nail is on the back (a = pi). One unit is about
// 14 mm: the end joint's crease sits at y = FING.dip, the middle joint's at FING.pip.
// The skin is star-shaped round the y axis, p(a, y) = r(a, y) * (sin a, ., FING.sz * cos a), so the shader can get a
// back from any point (fingerA) and the fold pattern lands in the same place on every soak.
export const FING = { R: 0.55, sz: 0.86, len: 4.6, dip: 1.92, pip: 3.5 };
export const NAIL = { phi: 0.82, y0: 0.13, y1: 1.16 };     // half-width (radians round the back), free edge, base
const TIP = 0.62, TIP_P = 2.3;                            // the tip's rounding: a little squarer than a half-circle
const K = 9.0;                                         // folds per radian around the finger
export function foldW(a, y) { return a * K + 0.9 * Math.sin(y * 2.3 + a * 1.7) + 0.4 * Math.sin(y * 4.1 - a * 3.3); }
const gauss = (x, m, s) => Math.exp(-(((x - m) / s) ** 2));
const sstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const wrapPi = (x) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));

/** Side-to-side half-width along the finger: a rounded tip, a slight waist, the joints a little wider. */
export function fingerR(y) {
  const yy = Math.max(0, y);
  const w = 0.525 + 0.012 * yy - 0.012 * gauss(yy, 1.5, 0.28) + 0.03 * gauss(yy, FING.dip + 0.06, 0.24)
          - 0.012 * gauss(yy, 2.75, 0.4) + 0.05 * gauss(yy, FING.pip + 0.1, 0.3) + 0.03 * sstep(FING.pip + 0.1, 4.5, yy);
  const d = Math.max(0, (TIP - yy) / TIP);
  return w * Math.pow(Math.max(0, 1 - Math.pow(d, TIP_P)), 1 / TIP_P);
}
const nailProx = (s) => NAIL.y1 - 0.06 * s * s - 0.2 * s ** 4;    // the cuticle: an arc with rounded corners
const nailDist = (s) => NAIL.y0 + 0.05 * s * s + 0.12 * s ** 6;    // the free edge, its corners rounded off

/** Radius factor before the nail folds: a fuller pad in front, a flatter back, knuckles on the back. */
function shapeK(a, y) {
  const c = Math.cos(a), front = Math.max(0, c), back = Math.max(0, -c);
  const pad = 0.1 * gauss(y, 0.72, 0.42) + 0.06 * gauss(y, 2.7, 0.45) + 0.05 * gauss(y, 4.3, 0.4)
            - 0.035 * gauss(y, FING.dip - 0.04, 0.12) - 0.03 * gauss(y, FING.pip - 0.08, 0.14);
  const knuckle = 0.035 * gauss(y, FING.dip + 0.06, 0.18) + 0.05 * gauss(y, FING.pip + 0.08, 0.22);
  return 1 + pad * front * front - 0.12 * Math.pow(back, 1.5) + knuckle * back * back;
}
/** The skin round the nail: the fold over its base, the folds along its sides, the bed it lies in. */
function nailFoldK(a, y) {
  const s = Math.abs(wrapPi(a - Math.PI)) / NAIL.phi, sc = Math.min(s, 1);
  const yp = nailProx(sc), yd = nailDist(sc);
  let k = 0.05 * gauss(y, yp + 0.03, 0.055) * sstep(1.2, 0.85, s);
  k += 0.05 * gauss(s, 1.04, 0.11) * sstep(yd + 0.06, yd + 0.3, y) * sstep(yp + 0.1, yp - 0.05, y);
  k -= 0.03 * sstep(1.02, 0.9, s) * sstep(yd - 0.05, yd + 0.05, y) * sstep(yp + 0.02, yp - 0.04, y);
  return k;
}
/** The skin's distance from the axis at (a, y), before the front-to-back squash. */
export function surfR(a, y) { return fingerR(y) * (shapeK(a, y) + nailFoldK(a, y)); }
/** A point on the skin; off > 0 lifts it off the surface. */
export function surfP(a, y, off = 0) {
  const r = surfR(a, y) + off;
  return vec(r * Math.sin(a), y, r * FING.sz * Math.cos(a));
}
/** How far the middle of the pad stands out in front (z) at height y. */
export const padZ = (y) => surfR(0, y) * FING.sz;

const FOLD_GLSL = `
uniform float uW;
float foldW(float a, float y){ return a * ${K.toFixed(1)} + 0.9 * sin(y * 2.3 + a * 1.7) + 0.4 * sin(y * 4.1 - a * 3.3); }
float padMask(float a, float y){ return smoothstep(1.45, 1.0, abs(a)) * smoothstep(0.1, 0.38, y) * smoothstep(1.8, 1.3, y); }
float foldS(float a, float y){ return abs(sin(foldW(a, y) * 1.5707963)); }
float fingerA(vec3 p){ return atan(p.x, p.z / ${FING.sz}); }
float fingerDisp(vec3 p){
  float a = fingerA(p);
  return uW * padMask(a, p.y) * 0.032 * (pow(foldS(a, p.y), 0.75) - 0.56);
}`;

// Skin detail drawn in the fragment shader: fingerprint ridges, the joints' creases, the knuckles' wrinkles.
const g1 = (v) => v.toFixed(3);
const DETAIL_GLSL = `
const float SP = 0.031;                     // ridge spacing (about 0.45 mm)
float fpPhase(vec2 q, float yb){
  vec2 w = q + 0.022 * vec2(sin(q.y * 9.1 + 2.0 * sin(q.x * 7.3)), sin(q.x * 8.7 + 1.7 * sin(q.y * 6.1)));
  if (q.y > yb) return (w.y + 0.05 * sin(w.x * 2.3) + 0.03 * w.x * w.x) / SP;      // across the middle segment
  vec2 c = (w - vec2(0.03, 0.8)) * vec2(1.0, 0.8);                                   // a whorl on the pad
  return length(c) / SP + atan(c.y, c.x) / 6.2831853;
}
vec3 fpGrad(vec2 q, float yb){
  float e = 0.0015;
  float p0 = fpPhase(q, yb);
  float dx = fpPhase(q + vec2(e, 0.0), yb) - p0, dy = fpPhase(q + vec2(0.0, e), yb) - p0;
  dx -= floor(dx + 0.5); dy -= floor(dy + 0.5);          // the spiral's seam jumps by one whole ridge
  return vec3(dx / e, dy / e, p0);
}
void crease(float y, float yc, float depth, float sig, float m, inout vec2 g, inout float sh){
  float d = (y - yc) / sig; float e = exp(-d * d) * m;
  g.y += depth * 2.0 * d / sig * e;
  sh += e * min(1.0, depth / 0.008);
}`;

const DETAIL_FRAG = `
vec2 fpG = vec2(0.0);
float fpShade = 0.0;
{
  vec2 q = vec2(vA * vWd, vY);
  float pf = max(length(dFdx(q)), length(dFdy(q)));            // scene units per pixel
  float a2 = vA * vA;
  // fingerprint ridges on the palm side
  float yb = ${g1(FING.dip)} + 0.03 * a2;
  float fm = smoothstep(1.75, 1.15, abs(vA)) * step(vY, ${g1(FING.pip + 0.9)});
  vec3 pg = fpGrad(q, yb);
  float fw = length(pg.xy) * pf;
  float brk = smoothstep(0.55, 0.8, snoise(vec3(q * 24.0, 4.2)));
  float amp = fm * (1.0 - smoothstep(0.16, 0.36, fw)) * (1.0 - 0.75 * brk) * (vY > yb ? 0.45 : 1.0);
  fpG += -0.002 * 3.14159265 * sin(6.2831853 * pg.z) * pg.xy * amp;
  fpShade += 0.05 * amp * (0.5 - 0.5 * cos(6.2831853 * pg.z));
  // creases across the palm side of both joints
  vec2 cg = vec2(0.0); float cs = 0.0;
  float fmC = smoothstep(1.5, 0.9, abs(vA));
  float wb = 0.012 * sin(vA * 5.3 + 0.7) + 0.006 * sin(vA * 11.0 + 2.0);
  float vr1 = 0.55 + 0.45 * sin(vA * 3.1 + 1.0), vr2 = 0.55 + 0.45 * sin(vA * 2.3 - 0.6);
  crease(vY, ${g1(FING.dip)} + 0.03 * a2 + wb, 0.008 * vr1, 0.011, fmC, cg, cs);
  crease(vY, ${g1(FING.dip - 0.085)} + 0.02 * a2 - wb, 0.004, 0.009, fmC * smoothstep(0.9, 0.2, abs(vA + 0.2)), cg, cs);
  crease(vY, ${g1(FING.pip - 0.06)} + 0.03 * a2 - wb, 0.009 * vr2, 0.012, fmC, cg, cs);
  crease(vY, ${g1(FING.pip + 0.06)} + 0.025 * a2 + 0.7 * wb, 0.007 * vr1, 0.011, fmC * smoothstep(1.3, 0.6, abs(vA - 0.15)), cg, cs);
  // wrinkles over the knuckles on the back
  float ph = vA - sign(vA) * 3.14159265;
  float bm = smoothstep(1.25, 0.55, abs(ph));
  for (int k = 0; k < 4; k++) { float fk = float(k) - 1.5;
    crease(vY, ${g1(FING.dip + 0.04)} + 0.05 * fk + 0.045 * ph * ph + 0.01 * sin(ph * 7.0 + fk * 2.1),
           0.004 * (1.0 - abs(fk) / 3.0), 0.008, bm, cg, cs); }
  for (int k = 0; k < 6; k++) { float fk = float(k) - 2.5;
    crease(vY, ${g1(FING.pip + 0.1)} + 0.06 * fk + 0.06 * ph * ph + 0.012 * sin(ph * 6.0 + fk * 1.7),
           0.006 * (1.0 - abs(fk) / 4.0), 0.01, bm, cg, cs); }
  fpG += cg * (1.0 - smoothstep(0.006, 0.014, pf));               // thinner than about two pixels: shade only
  fpShade += min(0.3, 0.26 * cs);
  // colour: a lighter palm side, a pinker fingertip, darker knuckles
  float fr = smoothstep(-0.2, 0.7, cos(vA));
  diffuseColor.rgb *= mix(vec3(0.93, 0.9, 0.88), vec3(1.03, 0.99, 0.97), fr);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(1.07, 0.9, 0.88), 0.6 * fr * (1.0 - smoothstep(0.05, 0.9, vY)));
  float kn = (1.0 - fr) * (0.6 * exp(-pow((vY - ${g1(FING.dip + 0.06)}) / 0.2, 2.0)) + exp(-pow((vY - ${g1(FING.pip + 0.1)}) / 0.26, 2.0)));
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.93, 0.85, 0.83), 0.7 * kn);
  float pn = (1.0 - fr) * smoothstep(1.2, 0.75, abs(ph)) * smoothstep(0.05, 0.3, vY) * smoothstep(1.45, 1.15, vY);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.98, 0.86, 0.84), 0.6 * pn);
  diffuseColor.rgb *= 1.0 - fpShade;
}`;

const DETAIL_NORMAL = `
{ vec3 tv = normalize(vAxis);
  vec3 tu = normalize(cross(tv, normal));
  vec3 tv2 = cross(normal, tu);
  normal = normalize(normal - (fpG.x * tu + fpG.y * tv2)); }`;

/** Valley lines of the fold pattern, as curves on (or under) the pad: inset > 0 goes under the skin. */
export function valleyCurves({ inset = 0, lift = 0.0, y0 = 0.4, y1 = 1.55, amax = 1.2 } = {}) {
  const out = [];
  for (let k = -6; k <= 6; k++) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const y = lerp(y0, y1, i / 48);
      let lo = -1.8, hi = 1.8;
      for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (foldW(m, y) < 2 * k) lo = m; else hi = m; }
      const a = (lo + hi) / 2;
      if (Math.abs(a) > amax) continue;
      pts.push(surfP(a, y, lift - inset));
    }
    if (pts.length > 10) out.push({ k, curve: new THREE.CatmullRomCurve3(pts) });
  }
  return out;
}

function fingerMaterial(pal, u) {
  const map = skinTile(pal, 21);
  map.repeat.set(3, 3.5);                               // a whole number of tiles round, so the seam doesn't show
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map, roughness: 0.56, sheen: 0.5,
    sheenColor: new THREE.Color('#ff9c86'), sheenRoughness: 0.45, transparent: true, opacity: 1,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uW = u.uW;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
${FOLD_GLSL}
attribute vec2 aFing;
varying float vS; varying float vPad; varying float vA; varying float vY; varying float vWd; varying vec3 vAxis;`)
      .replace('#include <beginnormal_vertex>', `
vec3 objectNormal;
{
  vec3 n0 = normalize(normal);
  vec3 ax = abs(n0.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 t1 = normalize(cross(ax, n0)); vec3 t2 = normalize(cross(n0, t1));
  float e = 0.004;
  vec3 q0 = position + n0 * fingerDisp(position);
  vec3 q1 = position + t1 * e; q1 += n0 * fingerDisp(q1);
  vec3 q2 = position + t2 * e; q2 += n0 * fingerDisp(q2);
  vec3 nn = normalize(cross(q1 - q0, q2 - q0));
  objectNormal = dot(nn, n0) < 0.0 ? -nn : nn;
}`)
      .replace('#include <begin_vertex>', `
vec3 transformed = position + normalize(normal) * fingerDisp(position);
{ float a = fingerA(position); vS = foldS(a, position.y); vPad = padMask(a, position.y); }
vA = aFing.x; vWd = aFing.y; vY = position.y;
vAxis = (modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uW; varying float vS; varying float vPad; varying float vA; varying float vY; varying float vWd; varying vec3 vAxis;
${NOISE_GLSL}
${DETAIL_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ float pw = uW * vPad;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 0.96, 0.95) + vec3(0.05, 0.04, 0.04), 0.7 * pw);
  diffuseColor.rgb *= 1.0 - 0.5 * pw * (1.0 - pow(vS, 0.75)); }
${DETAIL_FRAG}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${DETAIL_NORMAL}`);
  };
  m.customProgramCacheKey = () => 'finger2';
  return m;
}

/** The skin: a grid round the axis (seam down the middle of the back, under the nail) closing to a point at the tip. */
function fingerGeometry() {
  const M = 320, N = 360, row = M + 1;
  const pos = new Float32Array(row * (N + 1) * 3), uv = new Float32Array(row * (N + 1) * 2);
  const fa = new Float32Array(row * (N + 1) * 2);
  for (let i = 0; i <= N; i++) {
    const y = FING.len * Math.pow(i / N, 1.6), w = fingerR(y);
    for (let j = 0; j <= M; j++) {
      const a = -Math.PI + 2 * Math.PI * j / M, k = i * row + j;
      const r = i === 0 ? 0 : surfR(a, y);
      pos.set([r * Math.sin(a), y, r * FING.sz * Math.cos(a)], k * 3);
      uv.set([j / M, y / FING.len], k * 2);
      fa.set([a, w], k * 2);
    }
  }
  const idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const v00 = i * row + j, v01 = v00 + 1, v10 = v00 + row, v11 = v10 + 1;
    idx.push(v00, v01, v11, v00, v11, v10);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aFing', new THREE.BufferAttribute(fa, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  for (let i = 0; i <= N; i++) {                         // the seam's two columns share one normal; the tip points down
    const k0 = i * row, k1 = k0 + M;
    if (i === 0) { for (let j = 0; j <= M; j++) n.setXYZ(k0 + j, 0, -1, 0); continue; }
    const v = new THREE.Vector3(n.getX(k0) + n.getX(k1), n.getY(k0) + n.getY(k1), n.getZ(k0) + n.getZ(k1)).normalize();
    n.setXYZ(k0, v.x, v.y, v.z); n.setXYZ(k1, v.x, v.y, v.z);
  }
  return geo;
}

/** The nail bed's surface: the back without the folds, following the tip's rounding only part of the way. */
function nailBedR(a, y) {
  const yy = y > 0.5 ? y : 0.5 - (0.5 - y) * 0.55;
  return fingerR(yy) * shapeK(a, yy);
}

/** The nail: a thin plate with a lunula, a pink bed and a pale free edge that stands a little off the fingertip. */
function makeNail(pal) {
  const NS = 36, NT = 44, TH = 0.008, row = NS + 1, layer = row * (NT + 1);
  const lift = (s, t) => (0.008 + 0.018 * (1 - s * s)) * lerp(1, 0.25, sstep(0.82, 1, t))
                       * lerp(1, 0.35, sstep(0.75, 1, Math.abs(s)) * sstep(0.08, 0.3, t));
  const P = (s, t, dz) => {
    const a = Math.PI + s * NAIL.phi, y = lerp(nailDist(s), nailProx(s), t);
    const r = nailBedR(a, y) + lift(s, t) + dz;
    return new THREE.Vector3(r * Math.sin(a), y, r * FING.sz * Math.cos(a));
  };
  const pts = [], uv = [];
  for (const dz of [0, -TH]) for (let j = 0; j <= NT; j++) for (let i = 0; i <= NS; i++) {
    pts.push(P(-1 + 2 * i / NS, j / NT, dz));
    uv.push(i / NS, j / NT);
  }
  const V = (L, i, j) => L * layer + j * row + i;
  const idx = [];
  for (let j = 0; j < NT; j++) for (let i = 0; i < NS; i++) {
    idx.push(V(0, i, j), V(0, i + 1, j), V(0, i + 1, j + 1), V(0, i, j), V(0, i + 1, j + 1), V(0, i, j + 1));
    idx.push(V(1, i, j), V(1, i + 1, j + 1), V(1, i + 1, j), V(1, i, j), V(1, i, j + 1), V(1, i + 1, j + 1));
  }
  // the rim, wound to face outward (away from the plate's middle)
  const ring = [];
  for (let i = 0; i < NS; i++) ring.push([i, 0]);
  for (let j = 0; j < NT; j++) ring.push([NS, j]);
  for (let i = NS; i > 0; i--) ring.push([i, NT]);
  for (let j = NT; j > 0; j--) ring.push([0, j]);
  const mid = P(0, 0.5, -TH / 2);
  for (let k = 0; k < ring.length; k++) {
    const [i0, j0] = ring[k], [i1, j1] = ring[(k + 1) % ring.length];
    const a = V(0, i0, j0), b = V(0, i1, j1), c = V(1, i1, j1), d = V(1, i0, j0);
    const nrm = pts[b].clone().sub(pts[a]).cross(pts[d].clone().sub(pts[a]));
    const out = pts[a].clone().add(pts[b]).multiplyScalar(0.5).sub(mid);
    if (nrm.dot(out) >= 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#E29E90'; g.fillRect(0, 0, w, h);                       // the pink bed under the plate
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(196,128,110,0.3)'); side.addColorStop(0.18, 'rgba(196,128,110,0)');
    side.addColorStop(0.82, 'rgba(196,128,110,0)'); side.addColorStop(1, 'rgba(196,128,110,0.3)');
    g.fillStyle = side; g.fillRect(0, 0, w, h);
    g.filter = 'blur(6px)';
    g.fillStyle = 'rgba(244,218,210,0.6)';                               // the lunula, at the base (canvas top)
    g.beginPath(); g.ellipse(w / 2, -h * 0.04, w * 0.3, h * 0.17, 0, 0, Math.PI * 2); g.fill();
    g.filter = 'blur(2px)';
    const smile = (x) => h * (0.91 + 0.025 * ((x / w) * 2 - 1) ** 2);      // where the plate leaves the skin
    g.strokeStyle = 'rgba(212,146,128,0.35)'; g.lineWidth = 6;           // the darker band just before it
    g.beginPath(); for (let x = 0; x <= w; x += 8) g[x ? 'lineTo' : 'moveTo'](x, smile(x) - 6); g.stroke();
    g.fillStyle = 'rgba(236,220,206,0.9)';                                              // the free edge
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, smile(x));
    g.lineTo(w, h); g.closePath(); g.fill();
    g.filter = 'none';
    const r = rng(5);                                                     // faint lengthwise ridges
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      g.strokeStyle = `rgba(255,240,232,${0.025 + r() * 0.045})`; g.lineWidth = 1 + r() * 2;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, h); g.stroke();
    }
  });
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03,
                                              envMapIntensity: 4.5, transparent: true });
  return { mesh: new THREE.Mesh(geo, mat), mat };
}

export function makeFinger(pal) {
  const u = { uW: { value: 0 } };
  const mat = fingerMaterial(pal, u);
  const mesh = new THREE.Mesh(fingerGeometry(), mat);
  const nail = makeNail(pal);
  const nailMat = nail.mat;
  const group = new THREE.Group();
  group.add(mesh, nail.mesh);
  return {
    group, mesh, u,
    set({ wrinkle = 0, opacity = 1 } = {}) {
      u.uW.value = wrinkle;
      mat.opacity = nailMat.opacity = opacity;
      mat.transparent = nailMat.transparent = opacity < 0.999;
      mat.depthWrite = nailMat.depthWrite = opacity > 0.6;
      group.visible = opacity > 0.002;
    },
  };
}

/** Thin tubes along the fold valleys (the S04 trace) or under them (the blood vessels). */
export function makeValleyLines(color, { inset = 0, lift = 0.006, radius = 0.006, glow = 1.6, depthTest = true,
                                         opacity = 1 } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(glow), transparent: true,
                                            opacity, depthTest, depthWrite: false });
  const items = valleyCurves({ inset, lift }).map(({ curve }) => {
    const geo = new THREE.TubeGeometry(curve, 64, radius, 6, false);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 20;
    group.add(m);
    return { geo, total: geo.index.count };
  });
  return {
    group, mat,
    set({ draw = 1, opacity: op = 1 } = {}) {
      for (const it of items) it.geo.setDrawRange(0, Math.floor(it.total * clamp01(draw) / 36) * 36);
      mat.opacity = op * opacity;
      group.visible = op > 0.002 && draw > 0.002;
    },
  };
}

/** A nerve running down inside the finger (seen x-ray style through the skin), with a fan into the pad. */
export function makeFingerNerve(pal, { gap = false } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.nerve).multiplyScalar(1.25), transparent: true,
                                            opacity: 0.95, depthTest: false, depthWrite: false });
  const z = (y) => fingerR(y) * FING.sz * 0.55;
  const main = new THREE.CatmullRomCurve3([vec(0.08, 4.6, z(4.6)), vec(0.04, 3.2, z(3.2)), vec(-0.02, 2.2, z(2.2)),
                                           vec(0.0, 1.3, z(1.3))]);
  const branches = [-0.7, -0.35, 0, 0.35, 0.7].map((a) => new THREE.CatmullRomCurve3([
    vec(0.0, 1.3, z(1.3)), vec(Math.sin(a) * 0.25, 1.0, z(1.0) + 0.05), vec(Math.sin(a) * fingerR(0.7) * 0.8, 0.62,
      fingerR(0.62) * FING.sz * Math.cos(a) * 0.8)]));
  const GAP = [2.62, 2.92];                       // where the damaged nerve is broken (main-curve heights)
  const segs = [];
  const addTube = (curve, r) => { const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r, 8, false), mat); m.renderOrder = 30; group.add(m); return m; };
  if (gap) {
    const pts = main.getSpacedPoints(80);
    const upper = pts.filter((p) => p.y > GAP[1]), lower = pts.filter((p) => p.y < GAP[0]);
    segs.push(addTube(new THREE.CatmullRomCurve3(upper), 0.035), addTube(new THREE.CatmullRomCurve3(lower), 0.035));
  } else segs.push(addTube(main, 0.035));
  for (const b of branches) addTube(b, 0.018);
  // pulses
  const pmat = new THREE.SpriteMaterial({ map: glowTex('#fff2b0'), transparent: true, blending: THREE.AdditiveBlending,
                                          depthTest: false, depthWrite: false });
  const pulses = Array.from({ length: 6 }, () => { const s = new THREE.Sprite(pmat); s.renderOrder = 31; group.add(s); return s; });
  // the break: a cinnabar X between the two ends
  const x = new THREE.Group();
  const xm = new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.accent).multiplyScalar(1.3), depthTest: false, transparent: true });
  for (const r of [0.78, -0.78]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.02), xm); b.rotation.z = r; b.renderOrder = 32; x.add(b); }
  const gp = main.getPointAt(0.42);
  x.position.set(gp.x, (GAP[0] + GAP[1]) / 2, gp.z + 0.05);
  x.visible = gap;
  group.add(x);
  return {
    group, gapY: (GAP[0] + GAP[1]) / 2, xMark: x,
    /** firing: pulses run down the nerve; with a gap they die at the break */
    set(t, { opacity = 1, firing = 0, xShow = 1 } = {}) {
      mat.opacity = 0.95 * opacity;
      group.visible = opacity > 0.002;
      x.visible = gap && xShow * opacity > 0.01;
      x.scale.setScalar(Math.max(1e-3, ease.out(clamp01(xShow))));
      pulses.forEach((s, i) => {
        const ph = (((t * 0.9 + i / pulses.length) % 1) + 1) % 1;   // blur sub-frames can be just before t = 0
        let p = main.getPointAt(Math.min(ph * 1.25, 1));
        let vis = firing;
        if (ph * 1.25 > 1) { const b = branches[i % branches.length]; p = b.getPointAt(Math.min(1, (ph * 1.25 - 1) * 4)); }
        if (gap && p.y < GAP[1]) vis *= Math.max(0, 1 - (GAP[1] - p.y) / 0.12);
        s.position.copy(p);
        s.scale.setScalar(0.22 * vis);
        s.visible = vis > 0.01;
      });
    },
  };
}

// ---------------------------------------------------------------- the bath water
export function makeWater(pal, { width = 14, depth = 6, front = 2.2 } = {}) {
  const group = new THREE.Group();
  const vol = new THREE.Mesh(new THREE.BoxGeometry(width, 6, depth), new THREE.MeshPhysicalMaterial({
    color: pal.water, roughness: 0.1, transparent: true, opacity: 0.13, depthWrite: false }));
  vol.position.set(0, -3, front - depth / 2);
  vol.renderOrder = 6;
  const su = { uT: { value: 0 }, uC0: { value: new THREE.Vector3(0, 0, 0) }, uC1: { value: new THREE.Vector3(99, 0, 0) },
               uAmp: { value: 0 } };
  const sm = new THREE.MeshPhysicalMaterial({ color: pal.water, roughness: 0.03, clearcoat: 1, transparent: true,
                                              opacity: 0.5, depthWrite: false, envMapIntensity: 1.5 });
  sm.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, su);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uT, uAmp; uniform vec3 uC0, uC1;
float rip(vec2 p){ float h = 0.0;
  float d0 = length(p - uC0.xy); h += uC0.z * sin(d0 * 16.0 - uT * 9.0) * exp(-d0 * 1.6);
  float d1 = length(p - uC1.xy); h += uC1.z * sin(d1 * 16.0 - uT * 9.0) * exp(-d1 * 1.6);
  return uAmp * h + 0.006 * sin(p.x * 2.1 + uT * 1.3) * sin(p.y * 1.7 - uT * 0.9); }`)
      .replace('#include <beginnormal_vertex>', `
vec3 objectNormal;
{ float e = 0.01; float h0 = rip(position.xy);
  objectNormal = normalize(vec3(-(rip(position.xy + vec2(e, 0.0)) - h0) / e, -(rip(position.xy + vec2(0.0, e)) - h0) / e, 1.0)); }`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.xy, rip(position.xy));');
  };
  sm.customProgramCacheKey = () => 'water-surface';
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(width, depth, 220, 110), sm);
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(0, 0, front - depth / 2);
  surf.renderOrder = 7;
  // the bright edge of the tank's front face, where the surface meets the glass
  const edge = new THREE.Mesh(new THREE.BoxGeometry(width, 0.012, 0.012), new THREE.MeshBasicMaterial({
    color: new THREE.Color('#dff6ff').multiplyScalar(1.4), transparent: true, opacity: 0.8 }));
  edge.position.set(0, 0, front);
  group.add(vol, surf, edge);
  // meniscus rings round each finger, and bubbles
  const ringMat = new THREE.MeshPhysicalMaterial({ color: '#eaf8ff', roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false });
  const rings = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.011, 8, 64), ringMat); m.rotation.x = Math.PI / 2; m.renderOrder = 8; group.add(m); return m; });
  const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshPhysicalMaterial({
    color: '#f2fbff', roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.6, depthWrite: false }), 60);
  bub.frustumCulled = false;
  bub.renderOrder = 9;
  group.add(bub);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
  return {
    group, front,
    /** fingers: [{x, z, tipY, dipT}] (dipT = when the tip went in, for ripples and bubbles) */
    update(t, fingers = []) {
      su.uT.value = t;
      su.uAmp.value = 1;
      [su.uC0, su.uC1].forEach((c, i) => {
        const f = fingers[i];
        if (!f) { c.value.set(99, 99, 0); return; }
        const age = t - (f.dipT ?? -99);
        c.value.set(f.x, -(f.z ?? 0) + (front - depth / 2), 0.02 * Math.exp(-Math.max(0, age) * 1.4) * (age > 0 ? 1 : 0) + 0.004);
      });
      rings.forEach((r, i) => {
        const f = fingers[i];
        const under = f ? -f.tipY : -1;
        r.visible = !!f && under > 0.02;
        if (!r.visible) return;
        const s = f.s ?? 1, yl = Math.min(under / s, FING.len);
        const zf = padZ(yl), zb = surfR(Math.PI, yl) * FING.sz;
        r.position.set(f.x, 0.005, (f.z ?? 0) + s * (zf - zb) / 2);
        r.scale.set((fingerR(yl) + 0.01) * s, ((zf + zb) / 2 + 0.01) * s, 1);
      });
      let k = 0;
      for (const f of fingers) {
        if (f.dipT == null) continue;
        const rr = rng(Math.round(f.x * 100) + 7);
        for (let j = 0; j < 30; j++, k++) {
          const t0 = f.dipT + rr() * 0.5, life = 0.9 + rr() * 0.6, a = (t - t0) / life;
          const s = a > 0 && a < 1 ? 0.012 + rr() * 0.025 : 0;
          const ang = rr() * 6.28, rad = fingerR(0.4) * (0.8 + rr() * 0.6);
          pp.set(f.x + Math.cos(ang) * rad + 0.05 * Math.sin(a * 9 + j), lerp(-0.9 * rr() - 0.1, -0.02, Math.min(1, Math.max(0, a))),
                 (f.z ?? 0) + Math.sin(ang) * rad * 0.8);
          sc.setScalar(s * (a > 0.92 ? (1 - a) / 0.08 : 1));
          m4.compose(pp, q, sc);
          bub.setMatrixAt(k, m4);
        }
      }
      for (; k < 60; k++) { m4.makeScale(0, 0, 0); bub.setMatrixAt(k, m4); }
      bub.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- the skin block whose top buckles into folds
// Folds run along z (the finger's length); valleys where fw(x, z) = 2k. The vessel loops sit under the valleys.
export function foldBlockW(x, z) { return x * 6.4 + 0.35 * Math.sin(z * 2.1 + x * 1.3); }
const BLOCK_GLSL = `
uniform float uW, uSink;
float bfw(float x, float z){ return x * 6.4 + 0.35 * sin(z * 2.1 + x * 1.3); }
float bfold(float x, float z){ float s = abs(sin(bfw(x, z) * 1.5707963)); return 0.09 * (pow(s, 0.75) - 0.56); }`;
export function blockValleys(z = BLK.front) {
  const xs = [];
  for (let k = -8; k <= 8; k++) {
    let lo = -2, hi = 2;
    for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (foldBlockW(m, z) < 2 * k) lo = m; else hi = m; }
    const x = (lo + hi) / 2;
    if (Math.abs(x) < BLK.w / 2 - 0.12) xs.push(x);
  }
  return xs;
}

function foldMats(mats, u, mode, layerH) {
  for (const m of mats) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
${BLOCK_GLSL}
float lw(float y){ return ${mode === 'epi' ? '1.0' : `clamp((y + ${(layerH / 2).toFixed(4)}) / ${layerH.toFixed(4)}, 0.0, 1.0) * 0.8`}; }`)
        .replace('#include <beginnormal_vertex>', `
vec3 objectNormal = normal;
if (normal.y > 0.5) {
  float e = 0.003, w = uW * lw(position.y);
  float dx = (bfold(position.x + e, position.z) - bfold(position.x - e, position.z)) / (2.0 * e) * w;
  float dz = (bfold(position.x, position.z + e) - bfold(position.x, position.z - e)) / (2.0 * e) * w;
  objectNormal = normalize(vec3(-dx, 1.0, -dz));
}`)
        .replace('#include <begin_vertex>', `
vec3 transformed = position;
transformed.y += lw(position.y) * (uW * bfold(position.x, position.z) - uSink * 0.07);`);
    };
    m.customProgramCacheKey = () => 'fold-' + mode;
  }
}

export function makeFoldBlock(pal) {
  const group = new THREE.Group(), inner = new THREE.Group();
  group.add(inner);
  const u = { uW: { value: 0 }, uSink: { value: 0 } };
  const cutMat = (tex) => new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.35, transparent: true });
  const all = [];
  const layer = (kind, h, y, seed, segs) => {
    const side = cutMat(layerTex(kind, BLK.d, h, pal, seed + 1));
    const front = cutMat(layerTex(kind, BLK.w, h, pal, seed));
    const back = cutMat(layerTex(kind, BLK.w, h, pal, seed + 2));
    let top;
    if (kind === 'epi') {
      const map = skinTile(pal, 12), bump = skinTile(pal, 12, true);
      for (const tx of [map, bump]) tx.repeat.set(BLK.w / 1.2, BLK.d / 1.2);
      top = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 1.0, roughness: 0.5, sheen: 0.7,
                                             sheenColor: new THREE.Color('#ff9c86'), transparent: true });
    } else top = new THREE.MeshPhysicalMaterial({ color: kind === 'fat' ? pal.fat : pal.dermis, roughness: 0.6, transparent: true });
    const bottom = new THREE.MeshPhysicalMaterial({ color: kind === 'fat' ? pal.fat : pal.dermis, roughness: 0.6, transparent: true });
    const mats = [side, side, top, bottom, front, back];
    if (kind !== 'fat') foldMats(mats, u, kind, h);
    const m = new THREE.Mesh(new THREE.BoxGeometry(BLK.w, h, BLK.d, ...segs), mats);
    m.position.y = y;
    inner.add(m);
    all.push(...mats);
  };
  layer('epi', BLK.epi, -BLK.epi / 2, 21, [220, 2, 150]);
  layer('derm', BLK.derm, BLK.yEpi - BLK.derm / 2, 31, [220, 6, 150]);
  layer('fat', BLK.fat, BLK.yDerm - BLK.fat / 2, 41, [1, 1, 1]);

  // blood vessels on the cut face: a plexus along the face and a loop up under every valley
  const VZ = BLK.front - 0.006, Y0 = -0.82, Y1 = -0.36;     // tube centres just behind the face: they straddle it
  const valleys = blockValleys(BLK.front);
  const curves = [new THREE.CatmullRomCurve3(Array.from({ length: 30 }, (_, i) => {
    const x = lerp(-BLK.w / 2 + 0.02, BLK.w / 2 - 0.02, i / 29);
    return vec(x, Y0 + 0.03 * Math.sin(x * 4.0), VZ);
  }))];
  for (const x of valleys) {                       // a hairpin loop: two legs and a round top
    const rTop = 0.045, yTop = Y1 - 0.05, pts = [];
    for (let i = 0; i <= 5; i++) pts.push(vec(x - rTop, lerp(Y0, yTop, i / 5), VZ));
    for (let i = 1; i < 10; i++) { const a = Math.PI * (1 - i / 10); pts.push(vec(x + rTop * Math.cos(a), yTop + rTop * Math.sin(a), VZ)); }
    for (let i = 0; i <= 5; i++) pts.push(vec(x + rTop, lerp(yTop, Y0, i / 5), VZ));
    curves.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  }
  const vMat = new THREE.MeshPhysicalMaterial({ color: pal.vessel, roughness: 0.35, clearcoat: 0.8, emissive: new THREE.Color(pal.vessel),
                                                emissiveIntensity: 0.12, transparent: true });
  const vessels = curves.map((c, i) => {
    const R = i === 0 ? 0.045 : 0.024;
    const g = new THREE.TubeGeometry(c, i === 0 ? 160 : 64, R, 12, false);
    const gs = new THREE.TubeGeometry(c, i === 0 ? 160 : 64, R * 0.45, 12, false);    // tightened
    const d = gs.attributes.position.clone();                                          // relative morph: the offset
    for (let k = 0; k < d.count; k++) d.setXYZ(k, d.getX(k) - g.attributes.position.getX(k), d.getY(k) - g.attributes.position.getY(k), d.getZ(k) - g.attributes.position.getZ(k));
    g.morphAttributes.position = [d];
    g.morphTargetsRelative = true;
    const m = new THREE.Mesh(g, vMat);
    m.morphTargetInfluences = [0];
    inner.add(m);
    return m;
  });
  all.push(vMat);

  // the nerve: up from the deep dermis, along the face, with a branch to the base of every loop
  const NZ = BLK.front - 0.008;
  const nerveMain = new THREE.CatmullRomCurve3([vec(-1.32, -1.75, NZ), vec(-0.9, -1.45, NZ), vec(-0.2, -1.32, NZ),
    vec(0.5, -1.28, NZ), vec(1.32, -1.2, NZ)]);
  const nBranches = valleys.map((x, i) => {
    const s = clamp01((x + 1.32) / 2.64), base = nerveMain.getPointAt(Math.min(0.98, s * 0.9 + 0.05));
    return new THREE.CatmullRomCurve3([base, vec(lerp(base.x, x, 0.5) + 0.04 * Math.sin(i * 2), lerp(base.y, Y0 - 0.06, 0.55), NZ),
                                       vec(x, Y0 - 0.07, NZ)]);
  });
  const nMat = new THREE.MeshPhysicalMaterial({ color: pal.nerve, roughness: 0.4, emissive: new THREE.Color(pal.nerve),
                                                emissiveIntensity: 0.25, transparent: true });
  inner.add(new THREE.Mesh(new THREE.TubeGeometry(nerveMain, 120, 0.04, 10, false), nMat));
  for (const b of nBranches) inner.add(new THREE.Mesh(new THREE.TubeGeometry(b, 32, 0.018, 8, false), nMat));
  all.push(nMat);
  const pmat = new THREE.SpriteMaterial({ map: glowTex('#ffd95a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pulses = Array.from({ length: 14 }, () => { const s = new THREE.Sprite(pmat); inner.add(s); return s; });

  return {
    group, inner, u, valleys, vessels, nerveMain, nBranches,
    loopTop: (i) => vec(valleys[i], Y1 - 0.005, VZ + 0.02),
    set(t, { wrinkle = 0, sink = 0, tighten = 0, firing = 0, opacity = 1 } = {}) {
      u.uW.value = wrinkle;
      u.uSink.value = sink;
      for (const v of vessels) v.morphTargetInfluences[0] = tighten;
      for (const m of all) { m.opacity = opacity; m.transparent = opacity < 0.999; m.depthWrite = opacity > 0.5; }
      group.visible = opacity > 0.002;
      pulses.forEach((s, i) => {
        const ph = (((t * 0.8 + i / pulses.length) % 1) + 1) % 1;
        const b = nBranches[i % nBranches.length];
        const p = ph < 0.6 ? nerveMain.getPointAt(Math.min(0.98, ph / 0.6 * 0.95)) : b.getPointAt((ph - 0.6) / 0.4);
        s.position.copy(p).setZ(NZ + 0.05);
        s.scale.setScalar(0.14 * firing);
        s.visible = firing > 0.01;
      });
    },
  };
}

// ---------------------------------------------------------------- the glass marble on a wet tray
export function makeMarble(pal) {
  const group = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.42, 64, 48), new THREE.MeshPhysicalMaterial({
    color: pal.glass, roughness: 0.03, transparent: true, opacity: 0.34, clearcoat: 1, clearcoatRoughness: 0.02,
    envMapIntensity: 1.8, depthWrite: false }));
  glass.renderOrder = 10;
  const rg = new THREE.PlaneGeometry(0.6, 0.2, 48, 4);
  const rp = rg.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), a = x * 4.5;
    rp.setXYZ(i, x, y * Math.cos(a), y * Math.sin(a));
  }
  rg.computeVertexNormals();
  const ribbon = new THREE.Mesh(rg, new THREE.MeshPhysicalMaterial({ color: '#2FB9A8', roughness: 0.3, side: THREE.DoubleSide, clearcoat: 0.6 }));
  ribbon.rotation.z = 0.5;
  group.add(ribbon, glass);
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 64), new THREE.MeshPhysicalMaterial({
    color: '#10191f', roughness: 0.35, envMapIntensity: 0.15 }));
  tray.position.y = -0.46;
  group.add(tray);
  // water squeezed out along the grooves
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshPhysicalMaterial({
    color: pal.water, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.85, envMapIntensity: 1.6 }), 80);
  drops.frustumCulled = false;
  group.add(drops);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pp = new THREE.Vector3();
  const r = rng(5);
  const items = Array.from({ length: 80 }, (_, i) => ({ side: i % 2 ? 1 : -1, lane: (r() - 0.5) * 0.3, d0: r() * 0.4,
    v: 0.7 + r() * 0.8, s: 0.022 + r() * 0.03, lag: r() }));
  return {
    group, ribbon,
    /** squeeze 0..1: how far the water has been pushed out along the grooves */
    set(t, { squeeze = 0, spin = 0 } = {}) {
      ribbon.rotation.y = spin;
      items.forEach((d, i) => {
        const u = clamp01(squeeze * 1.4 - d.lag * 0.4);
        const x = d.side * (0.06 + d.d0 * 0.1 + u * d.v);
        pp.set(x, 0.42 - u * u * 0.3 - Math.abs(x) * 0.25, d.lane + 0.02 * Math.sin(t * 6 + i));
        sc.setScalar(d.s * (u > 0 && u < 0.98 ? 1 : 0) * (0.6 + 0.4 * Math.sin(u * Math.PI)));
        m4.compose(pp, q, sc);
        drops.setMatrixAt(i, m4);
      });
      drops.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- the tire on a wet road
export function makeTire(pal) {
  const group = new THREE.Group(), wheel = new THREE.Group();
  group.add(wheel);
  const R = 0.82, r = 0.3;
  // the tread: lateral grooves painted into the rubber round the outside of the tyre (uv.y near 0 / 1 = outer side)
  const treadTex = (bump) => canvasTex(2048, 256, (g, w, h) => {
    g.fillStyle = bump ? '#ffffff' : pal.rubber;
    g.fillRect(0, 0, w, h);
    g.fillStyle = bump ? '#000000' : '#0a0b0d';
    for (let i = 0; i < 72; i++) {
      const x = (i + 0.5) / 72 * w, off = (i % 2 ? 1 : -1) * 6;
      for (const [y0, y1] of [[0, 0.17], [0.83, 1]]) g.fillRect(x - 6 + off, y0 * h, 12, (y1 - y0) * h);
    }
    if (!bump) { g.fillStyle = '#1a1c20'; g.fillRect(0, 0.17 * h, w, 0.025 * h); g.fillRect(0, 0.805 * h, w, 0.025 * h); }
  }, { srgb: !bump, wrap: true });
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: treadTex(false), bumpMap: treadTex(true), bumpScale: 3,
                                                  roughness: 0.62, clearcoat: 0.2 });
  const tire = new THREE.Mesh(new THREE.TorusGeometry(R, r, 48, 160), rubber);
  tire.scale.z = 1.35;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.42, 64), new THREE.MeshPhysicalMaterial({
    color: '#b9bec6', metalness: 1, roughness: 0.25 }));
  hub.rotation.x = Math.PI / 2;
  wheel.add(tire, hub);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.06), new THREE.MeshPhysicalMaterial({ color: '#6c727b', metalness: 1, roughness: 0.3 }));
    s.position.set(Math.cos(i * 1.2566) * 0.28, Math.sin(i * 1.2566) * 0.28, 0.23);
    s.rotation.z = i * 1.2566 - Math.PI / 2;
    wheel.add(s);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 3), new THREE.MeshPhysicalMaterial({
    color: '#141619', roughness: 0.45, envMapIntensity: 0.15 }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = -(R + r);
  group.add(road);
  const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.005, 0.07), new THREE.MeshBasicMaterial({ color: '#d8d2c2' }), 8);
  dash.position.set(0, -(R + r) + 0.003, 0.95);
  group.add(dash);
  const spray = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshPhysicalMaterial({
    color: pal.water, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.8 }), 90);
  spray.frustumCulled = false;
  group.add(spray);
  const rr = rng(9);
  const drops = Array.from({ length: 90 }, () => ({ ph: rr(), side: rr() > 0.5 ? 1 : -1, vz: 0.6 + rr() * 0.9,
    vy: 0.6 + rr() * 0.9, vx: 0.4 + rr() * 0.8, s: 0.01 + rr() * 0.02 }));
  return {
    group,
    set(t, { speed = 2.2 } = {}) {
      wheel.rotation.z = -t * speed / (R + r);
      for (let i = 0; i < 8; i++) {
        const x = ((i * 1.3 - t * speed) % 10.4 + 10.4) % 10.4 - 5.2;
        m4.makeTranslation(x, 0, 0);
        dash.setMatrixAt(i, m4);
      }
      dash.instanceMatrix.needsUpdate = true;
      drops.forEach((d, i) => {
        const a = (t * 1.6 + d.ph) % 1;
        pp.set(-0.05 - a * d.vx, -(R + r) + 0.02 + d.vy * a - 1.6 * a * a, d.side * (0.25 + d.vz * a));
        sc.setScalar(d.s * (1 - a));
        m4.compose(pp, q.identity(), sc);
        spray.setMatrixAt(i, m4);
      });
      spray.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- shared poses (the cuts between scenes line up)
/** A camera pose on a circle round the finger's axis: deg from the pad (+z) toward +x. */
export function orbitPose(deg, dist, h, target) {
  const a = deg * Math.PI / 180;
  return { p: vec(dist * Math.sin(a), h, dist * Math.cos(a)), t: target };
}
/** Like cut.js setCam, but the camera swings round the finger's axis instead of cutting across it. */
export function orbitCam(camera, A, B, u) {
  const a0 = Math.atan2(A.p.x, A.p.z), a1 = a0 + wrapPi(Math.atan2(B.p.x, B.p.z) - a0);
  const a = lerp(a0, a1, u), r = lerp(Math.hypot(A.p.x, A.p.z), Math.hypot(B.p.x, B.p.z), u);
  camera.position.set(r * Math.sin(a), lerp(A.p.y, B.p.y, u), r * Math.cos(a));
  const t = A.t.clone().lerp(B.t, u);
  camera.lookAt(t);
  camera.updateMatrixWorld();
  return t;
}
/** cut.js camPath with orbiting moves. */
export function orbitPath(camera, t, keys) {
  if (t <= keys[0][0]) return orbitCam(camera, keys[0][1], keys[0][1], 0);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) return orbitCam(camera, keys[i - 1][1], keys[i][1], ramp(t, keys[i - 1][0], keys[i][0], ease.inOut));
  }
  const last = keys[keys.length - 1][1];
  return orbitCam(camera, last, last, 0);
}

export const CAMW = {
  c0:    orbitPose(150, 6.5, 1.75, vec(0.0, 0.8, 0.0)),             // the finger above the water from behind: the nail (S00 start = S04 end)
  pad:   { p: vec(0.75, -0.15, 4.3), t: vec(0.0, -0.5, 0.0) },    // close on the pad under water
  out:   { p: vec(0.6, 1.35, 4.6), t: vec(0.0, 1.1, 0.3) },       // the wet finger lifted out, the cut
  lift:  { p: vec(0.95, 1.65, 6.3), t: vec(0.1, 1.05, 1.5) },     // the block lifted off the pad (S00 end = S01 start)
  blk:   { p: vec(2.6, 1.5, 7.4), t: vec(0.0, -0.9, 0.0) },       // the block, three-quarter view
  blk2:  { p: vec(1.5, 1.55, 4.9), t: vec(0.0, -0.45, 0.45) },    // closer, from above: the folds and the vessel loops
  two:   { p: vec(0.0, 0.75, 8.9), t: vec(0.0, 0.25, 0.0) },      // two fingers in the water (S02)
  mt:    { p: vec(0.0, 0.25, 10.4), t: vec(0.0, 0.05, 0.0) },     // marble above, tire below (S03)
};
export const LIFT_TIP = 0.35;                       // the finger's tip height while the block is cut out
const PAD_Y = 0.8, S_PAD = 0.3;

/** The block's pose: u 0 = flat on the pad, 1 = lifted off (S00 end), 2 = the standard view (S01). */
export function liftPose(block, u) {
  const g = block.group, s = block.inner.scale;
  const r0 = padZ(PAD_Y);
  if (u <= 1) {
    const e = ease.inOut(clamp01(u));
    s.set(lerp(S_PAD, 0.5, e), lerp(0.03, 0.5, Math.pow(e, 0.8)), lerp(S_PAD, 0.5, e));
    g.position.set(lerp(0, 0.15, e), lerp(LIFT_TIP + PAD_Y, 1.25, e), lerp(r0, 1.9, e));
    g.rotation.set(lerp(Math.PI / 2, Math.PI / 2 - 0.8, e), lerp(0, -0.35, e), 0);
  } else {
    const e = ease.inOut(clamp01(u - 1));
    s.setScalar(lerp(0.5, 1, e));
    g.position.set(lerp(0.15, 0, e), lerp(1.25, 0, e), lerp(1.9, 0, e));
    g.rotation.set(lerp(Math.PI / 2 - 0.8, 0, e), lerp(-0.35, 0, e), 0);
  }
  g.updateMatrixWorld(true);
}

/** The glowing cut line round the block's footprint on the pad (in the finger's own frame). */
export function makePadCut() {
  const a0 = (BLK.w * S_PAD / 2) / surfR(0, PAD_Y), h = BLK.d * S_PAD / 2;
  const on = (a, y) => surfP(a, y, 0.012);
  const corners = [[-a0, PAD_Y + h], [a0, PAD_Y + h], [a0, PAD_Y - h], [-a0, PAD_Y - h], [-a0, PAD_Y + h]];
  const path = new THREE.CurvePath();
  for (let i = 0; i < 4; i++) {
    const [a1, y1] = corners[i], [a2, y2] = corners[i + 1];
    path.add(new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, k) => on(lerp(a1, a2, k / 12), lerp(y1, y2, k / 12)))));
  }
  const geo = new THREE.TubeGeometry(path, 240, 0.007, 6, false);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFF1DC').multiplyScalar(3.0), transparent: true });
  const mesh = new THREE.Mesh(geo, mat);
  const total = geo.index.count;
  const holeMat = new THREE.MeshStandardMaterial({ color: '#4a1512', roughness: 0.9, transparent: true, opacity: 0 });
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(BLK.w * S_PAD * 0.98, BLK.d * S_PAD * 0.98), holeMat);
  hole.position.set(0, PAD_Y, padZ(PAD_Y) + 0.004);
  const group = new THREE.Group();
  group.add(mesh, hole);
  return {
    group,
    set({ draw = 0, alpha = 1, hole: hu = 0 }) {
      geo.setDrawRange(0, Math.floor(total * clamp01(draw) / 36) * 36);
      mesh.visible = draw > 0 && alpha > 0.01;
      mat.opacity = alpha;
      holeMat.opacity = hu;
      hole.visible = hu > 0.01;
    },
  };
}
