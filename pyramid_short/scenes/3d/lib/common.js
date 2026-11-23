// scenes/3d/lib/common.js -- small shared pieces: GLSL noise, a JS value noise that matches it in spirit, a PRNG,
// and helpers for patching three.js standard materials.
import * as THREE from 'three';

export const NOISE = `
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
  float h31(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
  float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    float a = mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y);
    float b = mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y);
    return mix(a, b, f.z); }
`;

export function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// JS value noise (for geometry: dunes, grain shapes)
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, oct = 4) {
  let a = 0.5, s = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 17.1; a *= 0.5; }
  return s;
}

/** Patch a standard material: add `head` to both shaders' common section and replace chunks. */
export function patch(mat, { uniforms = {}, vHead = '', fHead = '', vert = {}, frag = {} }) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${vHead}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${NOISE}\n${fHead}`);
    for (const [k, v] of Object.entries(vert)) sh.vertexShader = sh.vertexShader.replace(k, v);
    for (const [k, v] of Object.entries(frag)) sh.fragmentShader = sh.fragmentShader.replace(k, v);
  };
  const key = 'patch' + (++patchId);
  mat.customProgramCacheKey = () => key;
  return mat;
}
let patchId = 0;

/** Bake a flat vertex colour into a geometry (so several parts can share one vertex-coloured material). */
export function tint(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

export const DEG = Math.PI / 180;
