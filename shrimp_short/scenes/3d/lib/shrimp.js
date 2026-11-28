// scenes/3d/lib/shrimp.js -- the pistol-shrimp Short's actors on the "Cut-away" look (cut.js keeps the shared helpers):
// the sea (water, light rays, marine snow, sand with caustics, burrows, rocks, sea grass), the pistol shrimp (our own
// stylised design: banded orange shell, hooded eyes, one huge snapping claw that can be cut open), a small goby, the
// snap effects (water jet, cavitation bubble, shock wave, flash), the Sun's surface, a submarine, the sonar screen and
// the crackling colony.
//
// Everything is a pure function of time: nothing here reads a clock or Math.random (rng(seed) is deterministic).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rng, clamp01, lerp, ease } from '/scenes/web/runtime.js';
import { canvasTex, glowTex, vec, NOISE_GLSL } from './cut.js';

export { vec };
const col = (h) => new THREE.Color(h);
export const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
const wrapf = (v, lo, hi) => { const s = hi - lo; return ((((v - lo) % s) + s) % s) + lo; };

export function makeCam() {
  return new THREE.PerspectiveCamera(36, 1080 / 1920, 0.02, 400);
}

/** Camera poses {p, t}; lerp between two with u. */
export function setCam(camera, a, b, u) {
  camera.position.lerpVectors(a.p, b.p, u);
  const t = a.t.clone().lerp(b.t, u);
  camera.lookAt(t);
  camera.updateMatrixWorld();
  return t;
}

export function camPath(camera, t, keys, fn = ease.inOut) {
  if (t <= keys[0][0]) return setCam(camera, keys[0][1], keys[0][1], 0);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) return setCam(camera, keys[i - 1][1], keys[i][1], fn(clamp01((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]))));
  }
  const last = keys[keys.length - 1][1];
  return setCam(camera, last, last, 0);
}

// ---------------------------------------------------------------- shader bits
const CAUSTIC_GLSL = `
float caustic(vec2 p, float t){
  vec2 q = p * 1.15;
  float n1 = snoise(vec3(q, t * 0.45));
  float n2 = snoise(vec3(q * 1.9 + 3.1, t * 0.6 + 5.0));
  return pow(1.0 - abs(n1), 7.0) + 0.6 * pow(1.0 - abs(n2), 9.0);
}`;

/** Add world-space caustics (and optional fine grain) to a standard material. */
function causticPatch(mat, uni, { strength = 0.3, grain = 0, key = 'c' } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime;
    sh.uniforms.uCaus = { value: strength };
    sh.uniforms.uCausOn = uni.uCausOn;
    sh.uniforms.uCausCol = uni.uCausCol;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nuniform float uTime, uCaus, uCausOn;\nuniform vec3 uCausCol;\n${NOISE_GLSL}\n${CAUSTIC_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${grain ? `diffuseColor.rgb *= 1.0 + ${grain.toFixed(3)} * snoise(vec3(vWPos.xz * 26.0, 1.7));` : ''}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uCausCol * caustic(vWPos.xz + 0.25 * vWPos.y, uTime) * uCaus * uCausOn;');
  };
  mat.customProgramCacheKey = () => 'caus-' + key;
  return mat;
}

// ---------------------------------------------------------------- the sea
export function seaStage(renderer, pal) {
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  const deep = col(pal.sea_deep), seaC = col(pal.sea);
  scene.fog = new THREE.FogExp2(seaC.clone(), 0.075);
  const hemi = new THREE.HemisphereLight(0x86d4dc, 0x3a3226, 0.85);
  const sun = new THREE.DirectionalLight(0xdaf6f6, 2.0);
  sun.position.set(3, 10, 4);
  const rim = new THREE.DirectionalLight(0x8fe6f0, 1.5);
  rim.position.set(-5, 4, -6);
  const warm = new THREE.DirectionalLight(0xffd6b0, 0.4);
  warm.position.set(5, -1, 6);
  scene.add(hemi, sun, rim, warm);
  const uni = { uTime: { value: 0 }, uCausOn: { value: 1 }, uCausCol: { value: col(pal.caustic) } };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { deep: { value: deep }, sea: { value: seaC }, glow: { value: col(pal.caustic) }, uTime: uni.uTime },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 deep, sea, glow; uniform float uTime; varying vec3 vDir;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = mix(deep, sea, smoothstep(-0.5, 0.0, d.y));
        float up = max(d.y, 0.0);
        c = mix(c, sea * 1.9, smoothstep(0.0, 0.9, d.y));
        vec2 sp = d.xz / (d.y + 0.25) * 2.2;
        float ripple = 0.5 + 0.5 * snoise(vec3(sp, uTime * 0.35));
        c += glow * (0.18 * pow(up, 4.0) + 0.5 * pow(up, 10.0) * (0.55 + 0.45 * ripple));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 32), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);
  const rays = makeRays(pal);
  const snow = makeSnow(pal);
  scene.add(rays.group, snow.points);
  return {
    scene, uni, lights: { hemi, sun, rim, warm },
    update(t, camera, target) {
      uni.uTime.value = t;
      sky.position.copy(camera.position);
      rays.update(t, camera, target);
      snow.update(t, target);
    },
  };
}

function makeRays(pal) {
  const tex = canvasTex(64, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const a = Math.sin(Math.PI * (x + 0.5) / w) ** 3;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(0.65, `rgba(255,255,255,${a * 0.3})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x, 0, 1, h);
    }
  });
  const group = new THREE.Group();
  const R = rng(77), items = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: tex, color: col(pal.caustic), transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, side: THREE.DoubleSide,
    }));
    const len = 16 + R() * 8;
    m.scale.set(0.5 + R() * 1.2, len, 1);
    m.renderOrder = -5;
    items.push({ m, x: (R() - 0.5) * 14, z: -3 - R() * 9, tilt: 0.1 + R() * 0.12, ph: R() * 6.28, op: 0.03 + R() * 0.035, len });
    group.add(m);
  }
  return {
    group,
    update(t, camera, target) {
      for (const it of items) {
        it.m.position.set(target.x + it.x + Math.sin(t * 0.2 + it.ph) * 0.3, target.y + it.len * 0.5 - 1.5, target.z + it.z);
        it.m.rotation.set(0, Math.atan2(camera.position.x - it.m.position.x, camera.position.z - it.m.position.z), it.tilt);
        it.m.material.opacity = it.op * (0.6 + 0.4 * Math.sin(t * 0.7 + it.ph));
      }
    },
  };
}

function dotTex() {
  return canvasTex(64, 64, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
}

function makeSnow(pal, n = 520) {
  const R = rng(91);
  const base = [];
  for (let i = 0; i < n; i++) base.push([(R() - 0.5) * 14, R() * 10, (R() - 0.5) * 14, R() * 6.28, 0.6 + R() * 0.8]);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 0.026, map: dotTex(), color: col(pal.caustic), transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(t, c) {
      for (let i = 0; i < n; i++) {
        const [x, y, z, ph, sp] = base[i];
        pos[3 * i] = c.x + wrapf(x + Math.sin(t * 0.25 * sp + ph) * 0.15 - c.x, -7, 7);
        pos[3 * i + 1] = c.y + wrapf(y - 0.05 * sp * t - c.y, -2, 8);
        pos[3 * i + 2] = c.z + wrapf(z + Math.cos(t * 0.21 * sp + ph) * 0.15 - c.z, -7, 7);
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- the seabed
// The hero's burrow sits right behind its tail; the others are the colony (S04).
export const SHR = { x: 0.0, y: 0.215, z: 0.0, ry: -0.5 };
export const BURROWS = (() => {
  const f = [Math.cos(SHR.ry), -Math.sin(SHR.ry)];          // the hero's forward (x, z)
  const out = [{ x: SHR.x - 2.12 * f[0], z: SHR.z - 2.12 * f[1], r: 0.42, hero: true }];
  const R = rng(5);
  let tries = 0;
  while (out.length < 26 && tries++ < 2000) {
    const a = R() * Math.PI * 2, d = 3.2 + R() * 13;
    const x = Math.cos(a) * d, z = Math.sin(a) * d - 3;
    if (x > 0.5 && x < 6 && z > -2.5 && z < 3) continue;   // keep the fish's side clear
    if (out.some((b) => Math.hypot(b.x - x, b.z - z) < 2.4)) continue;
    out.push({ x, z, r: 0.3 + R() * 0.12, ry: R() * Math.PI * 2 });
  }
  return out;
})();

export function sandH(x, z) {
  let h = 0.05 * Math.sin(0.9 * x + 0.4 * z) + 0.04 * Math.sin(1.7 * z - 0.6 * x + 1.3)
    + 0.025 * Math.sin(3.1 * x + 2.2 * z + 0.5) + 0.012 * Math.sin(5.3 * x - 4.1 * z + 2.0);
  h += 0.01 * Math.sin(9 * (0.8 * x + 0.6 * z) + 0.6 * Math.sin(1.3 * z));
  for (const b of BURROWS) {
    const r = Math.hypot(x - b.x, z - b.z);
    if (r > b.r * 3) continue;
    h += 0.17 * (b.r / 0.42) * gauss(r, b.r + 0.18, 0.15);
    h -= 0.45 * (1 - sstep(b.r * 0.65, b.r * 1.02, r));
  }
  return h;
}

export function makeSeabed(pal, uni) {
  const N = 420, S = 34;
  const geo = new THREE.PlaneGeometry(2, 2, N, N);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const cs = col(pal.sand), cd = col(pal.sand_dark), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getZ(i);
    const x = S * Math.sign(u) * u * u, z = S * Math.sign(v) * v * v - 2;
    p.setXYZ(i, x, sandH(x, z), z);
    let dark = 0;
    for (const b of BURROWS) {
      const r = Math.hypot(x - b.x, z - b.z);
      dark = Math.max(dark, 1 - sstep(b.r * 0.55, b.r * 1.08, r));
    }
    const v2 = 0.93 + 0.07 * Math.sin(2.1 * x + 1.7 * z) * Math.sin(1.3 * z - 0.7 * x + 1.0);
    c.copy(cs).lerp(cd, 0.9 * dark).multiplyScalar(v2 * (1 - 0.75 * dark * dark));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = causticPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }), uni,
    { strength: 0.2, grain: 0.12, key: 'sand' });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.add(mesh);
  // stones round the burrows and a few scattered ones
  const rockMat = causticPatch(new THREE.MeshStandardMaterial({ color: col(pal.rock), roughness: 0.92 }), uni, { strength: 0.18, key: 'rock' });
  const R = rng(17);
  const place = (x, z, r, seed) => {
    const g = rockGeo(seed, r);
    const m = new THREE.Mesh(g, rockMat);
    m.position.set(x, sandH(x, z) - r * 0.25, z);
    m.rotation.y = R() * 6.28;
    group.add(m);
  };
  const hb = BURROWS[0];
  place(hb.x - 0.35, hb.z - 0.55, 0.22, 3);
  place(hb.x + 0.2, hb.z - 0.62, 0.15, 4);
  place(hb.x - 0.62, hb.z + 0.05, 0.17, 5);
  place(-3.4, -2.6, 0.45, 6);
  place(3.6, -3.8, 0.5, 7);
  place(-1.2, -4.6, 0.32, 8);
  for (let i = 0; i < 26; i++) {
    const a = R() * 6.28, d = 4 + R() * 14;
    place(Math.cos(a) * d, Math.sin(a) * d - 4, 0.12 + R() * 0.35, 20 + i);
  }
  group.add(makeGrass(pal, uni, [[-2.9, -2.2], [-2.6, -2.5], [2.9, -3.4], [3.3, -3.1], [-0.9, -3.9], [4.8, -6], [-5, -5]]));
  return { group, mesh };
}

function rockGeo(seed, r) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const R = rng(seed);
  const ph = [R() * 6, R() * 6, R() * 6, R() * 6];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const d = 1 + 0.16 * Math.sin(3 * v.x + ph[0]) * Math.sin(2.6 * v.y + ph[1]) + 0.1 * Math.sin(5 * v.z + ph[2]) + 0.05 * Math.sin(9 * v.x + 7 * v.y + ph[3]);
    p.setXYZ(i, v.x * d * r, v.y * d * r * 0.62, v.z * d * r * 0.85);
  }
  g.computeVertexNormals();
  return g;
}

function makeGrass(pal, uni, spots) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: col(pal.weed), side: THREE.DoubleSide, roughness: 0.65 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aPh;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hy = position.y;
        transformed.x += 0.16 * hy * hy * sin(uTime * 1.1 + hy * 1.7 + aPh);
        transformed.z += 0.08 * hy * hy * sin(uTime * 0.8 + hy * 1.3 + aPh * 1.7);`);
  };
  mat.customProgramCacheKey = () => 'grass';
  const R = rng(33);
  for (const [x, z] of spots) {
    for (let k = 0; k < 6; k++) {
      const h = 0.7 + R() * 0.9;
      const g = new THREE.PlaneGeometry(0.045 + R() * 0.03, h, 1, 14);
      g.translate(0, h / 2, 0);
      const ph = new Float32Array(g.attributes.position.count).fill(R() * 6.28);
      g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
      const m = new THREE.Mesh(g, mat);
      const xx = x + (R() - 0.5) * 0.4, zz = z + (R() - 0.5) * 0.4;
      m.position.set(xx, sandH(xx, zz) - 0.02, zz);
      m.rotation.y = R() * 3.14;
      group.add(m);
    }
  }
  return group;
}

// ---------------------------------------------------------------- the pistol shrimp
// Body frame: +x forward (head), +y up, +z the shrimp's right side, where the snapping claw is.
// The snapping claw is drawn in "profile" units (x 0..1 along the claw, y up), scaled by CS.
export const CS = 0.92;
export const HINGE = new THREE.Vector2(0.6, 0.07);      // the moving finger's hinge
export const SOCK = { x0: 0.712, x1: 0.768, y0: -0.09 }; // the socket in the fixed finger, open at the top
export const PEG_X = 0.14;                               // the plunger, in hinge coords
export const JET0 = new THREE.Vector2(0.775, -0.03);     // where the jet leaves the socket
export const BUB = new THREE.Vector2(1.32, -0.03);       // where the bubble tears open
export const BUB_R = 0.16;
export const OPEN = 1.2;                                 // the cocked angle of the moving finger (rad)
const ARM = { S: vec(0.36, -0.1, 0.16), E: vec(0.52, -0.23, 0.31), W: vec(0.71, -0.13, 0.34) };
export const CLAW_ROT = { yaw: 0.6, pitch: 0.3 };

/** A unit sphere with its poles on +-x, reshaped by fn(x, y, z) -> [X, Y, Z]; fn keeps z = 0 on z = 0. */
function blob(fn, ws = 72, hs = 44) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.rotateZ(-Math.PI / 2);
  g.deleteAttribute('uv');
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [X, Y, Z] = fn(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, X, Y, Z);
  }
  g.computeVertexNormals();
  return g;
}

/** The z = 0 section of a blob: fn applied to the circle of radius rho. */
function section(fn, rho = 1, n = 180) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const [X, Y] = fn(rho * Math.cos(a), rho * Math.sin(a), 0);
    out.push([X, Y]);
  }
  return out;
}

function paint(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = fn(p.getX(i), p.getY(i), p.getZ(i));
    c[3 * i] = v.r; c[3 * i + 1] = v.g; c[3 * i + 2] = v.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

const mott = (x, y, z) => 1 + 0.06 * Math.sin(17 * x + 3.1) * Math.sin(13 * y + 11 * z) + 0.04 * Math.sin(29 * z + 7 * x);

// the claw parts (profile coords)
export const palmFn = (x, y, z) => {
  const X = 0.31 * (x + 1);
  let Y = y * 0.168 * (1 + 0.14 * x);
  if (Y < 0) Y *= 0.9;
  return [X, Y - 0.004, z * 0.13 * (1 + 0.08 * x)];
};
export const pollexFn = (x, y, z) => {
  const s = (x + 1) / 2;
  const X = 0.46 + 0.56 * s;
  const yc = -0.075 + 0.055 * s * s;
  const hh = 0.07 * (1 - 0.6 * s) + 0.012;
  return [X, yc + y * hh, z * (0.075 * (1 - 0.55 * s) + 0.01)];
};
export const dactylFn = (x, y, z) => {              // hinge coords
  const s = (x + 1) / 2;
  const X = -0.04 + 0.46 * s;
  const yc = -0.115 * s * s;
  const hh = 0.075 * (1 - 0.62 * s) + 0.01;
  return [X, yc + y * hh, z * (0.07 * (1 - 0.45 * s) + 0.008)];
};

function shellMat(pal, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.34, clearcoat: 0.75, clearcoatRoughness: 0.2, sheen: 0.5,
    sheenColor: col(pal.shrimp_band), sheenRoughness: 0.45, emissive: col(pal.shrimp).multiplyScalar(0.05), ...extra,
  });
}

function limb(mat, pts, r) {
  const g = new THREE.Group();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r * (1 - 0.18 * i), L, 3, 10), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(m);
  }
  return g;
}

function antennaMat(pal, uni) {
  const m = new THREE.MeshStandardMaterial({ color: col(pal.shrimp).lerp(col(pal.shrimp_band), 0.35), roughness: 0.45 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uni.uTime;
    sh.uniforms.uAmp = uni.uAntAmp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uAmp; attribute float aS; attribute float aPh;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = aS * aS * uAmp;
        transformed.y += w * 0.16 * sin(uTime * 1.5 + aS * 3.0 + aPh);
        transformed.z += w * 0.12 * sin(uTime * 1.1 + aS * 2.4 + aPh * 1.3);`);
  };
  m.customProgramCacheKey = () => 'antenna';
  return m;
}

function antenna(mat, pts, r, ph, seg = 56) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, seg, r, 6, false);
  const n = g.attributes.position.count;
  const s = new Float32Array(n), a = new Float32Array(n).fill(ph);
  for (let i = 0; i < n; i++) s[i] = Math.floor(i / 7) / seg;
  g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  g.setAttribute('aPh', new THREE.BufferAttribute(a, 1));
  return new THREE.Mesh(g, mat);
}

/** The cut faces of the claw: canvas drawings of the z = 0 sections (shell rim, muscle, socket, plunger). */
function capTexture(pal, box, draw, W = 1024) {
  const [x0, x1, y0, y1] = box;
  const H = Math.round(W * (y1 - y0) / (x1 - x0));
  const tx = (X) => (X - x0) / (x1 - x0) * W, ty = (Y) => (y1 - Y) / (y1 - y0) * H;
  const path = (g, pts) => {
    g.moveTo(tx(pts[0][0]), ty(pts[0][1]));
    for (const [X, Y] of pts) g.lineTo(tx(X), ty(Y));
    g.closePath();
  };
  return canvasTex(W, H, (g) => draw(g, { tx, ty, path, px: W / (x1 - x0) }));
}

function capPlane(tex, box, mat) {
  const [x0, x1, y0, y1] = box;
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0.0012);
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, ...mat }));
}

export function makeShrimp(pal, { cuttable = true } = {}) {
  const uni = { uTime: { value: 0 }, uAntAmp: { value: 1 } };
  const group = new THREE.Group();
  const SH = col(pal.shrimp), BAND = col(pal.shrimp_band), C = new THREE.Color();
  const shell = shellMat(pal);
  const pale = new THREE.MeshPhysicalMaterial({ color: SH.clone().lerp(BAND, 0.45), roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 });

  // carapace (head and thorax) with a hood over each eye and a short rostrum
  const carFn = (x, y, z) => {
    const s = (x + 1) / 2;
    let X = -0.48 + s;
    const hh = 0.27 * (1 - 0.35 * sstep(0.55, 1, s)) * (y > 0 ? 1 : 0.78);
    const ww = 0.215 * (1 - 0.3 * sstep(0.6, 1, s));
    let Y = y * hh;
    const Z = z * ww;
    const hood = Math.exp(-((s - 0.86) ** 2) / 0.004) * Math.max(0, y) * Math.exp(-((Math.abs(z) - 0.55) ** 2) / 0.06);
    X += 0.06 * hood;
    Y += 0.035 * hood;
    return [X, Y + 0.03, Z];
  };
  const carGeo = paint(blob(carFn, 96, 60), (x, y, z) => {
    const stripe = Math.exp(-(z * z) / 0.0018) * sstep(0.05, 0.2, y);
    const rear = sstep(-0.36, -0.46, x);
    return C.copy(SH).lerp(BAND, Math.max(0.85 * stripe, 0.8 * rear)).multiplyScalar(mott(x, y, z));
  });
  group.add(new THREE.Mesh(carGeo, shell));

  // eyes, tucked under the hoods
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: 0.12, metalness: 0.0 });
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), eyeMat);
    e.position.set(0.45, 0.12, 0.085 * s);
    group.add(e);
  }

  // abdomen: six banded segments curving down to the tail fan
  const segs = [];
  for (let i = 0; i < 6; i++) {
    const s = i / 5;
    const L = 0.16, H = 0.23 * (1 - 0.36 * s), W = 0.2 * (1 - 0.38 * s);
    const g = paint(blob((x, y, z) => [x * L, y * H * (y < 0 ? 1.05 : 1), z * W], 48, 30), (x, y, z) => {
      const rear = sstep(-0.05, -0.13, x);
      const stripe = Math.exp(-(z * z) / 0.0014) * sstep(0.04, 0.12, y);
      return C.copy(SH).lerp(BAND, Math.max(0.85 * rear, 0.8 * stripe)).multiplyScalar(mott(x + i, y, z));
    });
    const m = new THREE.Mesh(g, shell);
    m.position.set(-0.47 - i * 0.205, 0.035 - 0.07 * s * s, 0);
    m.rotation.z = 0.24 * s;
    group.add(m);
    segs.push(m);
  }
  // tail fan: telson and two pairs of uropods
  const fan = new THREE.Group();
  fan.position.set(-1.6, -0.06, 0);
  fan.rotation.z = 0.3;
  const leaf = (len, w, ry) => {
    const g = paint(blob((x, y, z) => [(x - 1) * len * 0.5, y * 0.022, z * w], 32, 16), (x) =>
      C.copy(SH).lerp(BAND, 0.7 * sstep(-0.7 * len, -len, x)));
    const m = new THREE.Mesh(g, shell);
    m.rotation.y = ry;
    fan.add(m);
  };
  leaf(0.3, 0.07, 0);
  for (const s of [1, -1]) { leaf(0.28, 0.075, 0.42 * s); leaf(0.26, 0.07, 0.8 * s); }
  group.add(fan);

  // walking legs and swimmerets
  for (const s of [1, -1]) {
    for (const [k, bx] of [0.26, 0.1, -0.06, -0.22].entries()) {
      group.add(limb(pale, [vec(bx, -0.12, 0.12 * s), vec(bx + 0.04, -0.02, 0.32 * s), vec(bx + 0.1 + 0.02 * k, -0.235, 0.42 * s)], 0.017));
    }
    for (let i = 0; i < 4; i++) {
      const x = -0.55 - i * 0.2;
      group.add(limb(pale, [vec(x, -0.12, 0.07 * s), vec(x + 0.03, -0.2, 0.1 * s)], 0.012));
    }
  }

  // antennae and antennules
  const aMat = antennaMat(pal, uni);
  const ants = new THREE.Group();
  group.add(ants);
  for (const s of [1, -1]) {
    ants.add(antenna(aMat, [vec(0.46, 0.1, 0.06 * s), vec(0.72, 0.3, 0.12 * s), vec(0.95, 0.52, 0.24 * s), vec(1.1, 0.66, 0.42 * s), vec(1.18, 0.7, 0.66 * s), vec(1.2, 0.64, 0.9 * s)], 0.0075, s > 0 ? 0.3 : 2.1));
    ants.add(antenna(aMat, [vec(0.48, 0.12, 0.03 * s), vec(0.7, 0.24, 0.05 * s), vec(0.92, 0.3, 0.1 * s), vec(1.08, 0.28, 0.16 * s)], 0.0065, s > 0 ? 1.2 : 3.4, 24));
  }

  // the small claw (left side)
  group.add(limb(pale, [vec(0.36, -0.12, -0.15), vec(0.55, -0.21, -0.24), vec(0.73, -0.17, -0.26)], 0.03));
  const minor = new THREE.Group();
  minor.position.set(0.73, -0.17, -0.26);
  minor.rotation.set(0, 0.25, -0.1);
  const mpal = paint(blob((x, y, z) => [0.09 * (x + 1), y * 0.045, z * 0.04]), () => C.copy(SH));
  minor.add(new THREE.Mesh(mpal, shell));
  for (const s of [1, -1]) {
    const f = paint(blob((x, y, z) => [0.15 + 0.07 * (x + 1), 0.012 * s + y * 0.013, z * 0.013], 24, 12), () => C.copy(SH).multiplyScalar(0.85));
    minor.add(new THREE.Mesh(f, shell));
  }
  group.add(minor);

  // the snapping claw: arm, then the claw root (rotated to aim) holding palm, fixed finger and moving finger
  group.add(limb(pale, [ARM.S, ARM.E, ARM.W], 0.05));
  const claw = new THREE.Group();
  claw.position.copy(ARM.W);
  claw.rotation.order = 'YZX';
  claw.rotation.set(0, CLAW_ROT.yaw, CLAW_ROT.pitch);
  claw.scale.setScalar(CS);
  group.add(claw);
  const clawCol = (X, x, y, z) => {
    const base = C.copy(SH).lerp(BAND, 0.75 * sstep(0.1, 0.02, X));
    return base.multiplyScalar(mott(x * 2, y, z) * (1 - 0.32 * sstep(0.84, 1.03, X)));
  };
  const palmGeo = paint(blob(palmFn), (x, y, z) => clawCol(x, x, y, z));
  const pollGeo = paint(blob(pollexFn, 56, 32), (x, y, z) => clawCol(x, x, y, z));
  const dactyl = new THREE.Group();
  dactyl.position.set(HINGE.x, HINGE.y, 0);
  dactyl.name = 'dactyl';
  claw.add(dactyl);
  const dactGeo = paint(blob(dactylFn, 56, 32), (x, y, z) => clawCol(x + HINGE.x, x, y, z));
  const pegGeo = new THREE.CapsuleGeometry(0.022, 0.04, 4, 12);
  pegGeo.translate(PEG_X, -0.1, 0);
  const pegMat = new THREE.MeshPhysicalMaterial({ color: col(pal.plunger), roughness: 0.4, clearcoat: 0.5 });

  const out = { group, uni, claw, dactyl, segs, ants };
  if (!cuttable) {
    claw.add(new THREE.Mesh(palmGeo, shell), new THREE.Mesh(pollGeo, shell));
    dactyl.add(new THREE.Mesh(dactGeo, shell), new THREE.Mesh(pegGeo, pegMat));
    out.set = (st) => {
      if (st.time !== undefined) uni.uTime.value = st.time;
      if (st.open !== undefined) dactyl.rotation.z = st.open * OPEN;
    };
    return out;
  }

  // cuttable: two halves, clipped at the claw's z = 0 plane; the near half lifts away to show the cut faces
  const planeFar = new THREE.Plane(), planeNear = new THREE.Plane();
  const far = shell.clone(), near = shell.clone();
  far.clippingPlanes = [planeFar];
  far.side = THREE.DoubleSide;
  near.clippingPlanes = [planeNear];
  near.transparent = true;
  const pegFar = pegMat.clone(), pegNear = pegMat.clone();
  pegFar.clippingPlanes = [planeFar];
  pegNear.clippingPlanes = [planeNear];
  pegNear.transparent = true;
  const nearPalm = new THREE.Group(), nearDact = new THREE.Group();
  claw.add(new THREE.Mesh(palmGeo, far), new THREE.Mesh(pollGeo, far), nearPalm);
  nearPalm.add(new THREE.Mesh(palmGeo, near), new THREE.Mesh(pollGeo, near));
  dactyl.add(new THREE.Mesh(dactGeo, far), new THREE.Mesh(pegGeo, pegFar), nearDact);
  nearDact.add(new THREE.Mesh(dactGeo, near), new THREE.Mesh(pegGeo, pegNear));

  // the cut faces
  const PBOX = [-0.06, 1.1, -0.26, 0.26];
  const palmCapTex = capTexture(pal, PBOX, (g, { tx, ty, path, px }) => {
    const parts = [palmFn, pollexFn];
    g.fillStyle = pal.shrimp;
    g.beginPath();
    for (const f of parts) path(g, section(f));
    g.fill('nonzero');
    // flesh: the big closer muscle, inside the shell rim
    g.fillStyle = pal.claw_flesh;
    g.beginPath();
    path(g, section(palmFn, 0.9));
    path(g, section(pollexFn, 0.8));
    g.fill('nonzero');
    g.save();
    g.beginPath();
    path(g, section(palmFn, 0.9));
    g.clip();
    const R = rng(8);
    g.strokeStyle = 'rgba(255,236,226,0.35)';
    g.lineWidth = 3;
    for (let i = 0; i < 46; i++) {
      const a = R() * Math.PI * 2, r = 0.5 + R() * 0.45;
      const [X, Y] = palmFn(Math.cos(a) * r, Math.sin(a) * r, 0);
      g.beginPath();
      g.moveTo(tx(X), ty(Y));
      g.quadraticCurveTo(tx((X + 0.55) / 2), ty(Y * 0.5 + 0.02), tx(0.57), ty(0.035));
      g.stroke();
    }
    g.restore();
    // the tendon to the moving finger
    g.strokeStyle = 'rgba(250,240,225,0.8)';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(tx(0.42), ty(0.02));
    g.lineTo(tx(0.585), ty(0.05));
    g.stroke();
    // the socket: a water-filled pit in the fixed finger, lined with shell
    const sx0 = tx(SOCK.x0), sx1 = tx(SOCK.x1), sy0 = ty(0.03), sy1 = ty(SOCK.y0);
    const pit = (pad) => {
      const w = sx1 - sx0 + 2 * pad, r = w / 2;
      g.beginPath();
      g.moveTo(sx0 - pad, sy0);
      g.lineTo(sx0 - pad, sy1 - r + pad);
      g.arc(sx0 - pad + r, sy1 - r + pad, r, Math.PI, 0, true);
      g.lineTo(sx1 + pad, sy0);
      g.closePath();
    };
    g.fillStyle = pal.shrimp;
    pit(7);
    g.fill();
    const wg = g.createLinearGradient(sx0, 0, sx1, 0);
    wg.addColorStop(0, '#1d6b7a');
    wg.addColorStop(0.5, '#3a97a6');
    wg.addColorStop(1, '#1d6b7a');
    g.fillStyle = wg;
    pit(0);
    g.fill();
  });
  const DBOX = [-0.1, 0.5, -0.25, 0.12];
  const dactCapTex = capTexture(pal, DBOX, (g, { tx, ty, path }) => {
    g.fillStyle = pal.shrimp;
    g.beginPath();
    path(g, section(dactylFn));
    g.fill();
    g.fillStyle = pal.claw_flesh;
    g.beginPath();
    path(g, section(dactylFn, 0.8));
    g.fill();
    // the plunger: a peg on the underside of the moving finger
    const pw = tx(PEG_X + 0.021) - tx(PEG_X - 0.021);
    const pg = g.createLinearGradient(tx(PEG_X - 0.021), 0, tx(PEG_X + 0.021), 0);
    pg.addColorStop(0, '#c99a2c');
    pg.addColorStop(0.45, pal.plunger);
    pg.addColorStop(1, '#b8871f');
    g.fillStyle = pg;
    g.beginPath();
    g.roundRect(tx(PEG_X - 0.021), ty(-0.02), pw, ty(-0.158) - ty(-0.02), [4, 4, pw / 2, pw / 2]);
    g.fill();
  }, 768);
  const palmCap = capPlane(palmCapTex, PBOX, {});
  const dactCap = capPlane(dactCapTex, DBOX, { polygonOffset: true, polygonOffsetFactor: -1 });
  dactCap.position.z = 0.0008;
  claw.add(palmCap);
  dactyl.add(dactCap);
  palmCap.visible = dactCap.visible = false;

  const n = new THREE.Vector3(), q = new THREE.Quaternion(), o = new THREE.Vector3();
  out.set = (st) => {
    if (st.time !== undefined) uni.uTime.value = st.time;
    if (st.open !== undefined) dactyl.rotation.z = st.open * OPEN;
    ants.visible = st.antennae ?? true;
    const cut = st.cut ?? 0;
    nearPalm.position.z = nearDact.position.z = 1.1 * ease.inOut(clamp01(cut));
    nearPalm.position.y = nearDact.position.y = 0.25 * ease.inOut(clamp01(cut));
    near.opacity = pegNear.opacity = 1 - sstep(0.25, 0.85, cut);
    nearPalm.visible = nearDact.visible = near.opacity > 0.002;
    palmCap.visible = dactCap.visible = cut > 0.001;
    // the cut planes follow the claw
    group.updateMatrixWorld(true);
    claw.getWorldQuaternion(q);
    claw.getWorldPosition(o);
    n.set(0, 0, 1).applyQuaternion(q);
    planeNear.setFromNormalAndCoplanarPoint(n, o);
    planeFar.setFromNormalAndCoplanarPoint(n.clone().negate(), o);
  };
  /** A point in claw profile coords -> world. */
  out.clawPoint = (x, y, z = 0) => { group.updateMatrixWorld(true); return claw.localToWorld(vec(x, y, z)); };
  return out;
}

/** The colony: lighter shrimp (no cut-away), cloned from one template. */
export function makeColony(pal, uni) {
  const tpl = makeShrimp(pal, { cuttable: false });
  tpl.uni.uTime = uni.uTime;
  const group = new THREE.Group();
  const members = [];
  const R = rng(41);
  for (const b of BURROWS.slice(1)) {
    const g = tpl.group.clone();
    const s = 0.75 + R() * 0.3;
    g.scale.setScalar(s);
    const f = [Math.cos(b.ry), -Math.sin(b.ry)];
    const x = b.x + 2.0 * s * f[0], z = b.z + 2.0 * s * f[1];
    g.position.set(x, sandH(x, z) + 0.2 * s, z);
    g.rotation.y = b.ry;
    group.add(g);
    members.push({ g, dactyl: g.getObjectByName('dactyl'), ph: R(), rate: 0.35 + R() * 0.5 });
  }
  return {
    group, members,
    set(t, on) {
      for (const m of members) {
        const k = ((t * m.rate + m.ph) % 1 + 1) % 1;
        // cocked most of the cycle, snapping shut at k = 0.75
        const open = k < 0.75 ? sstep(0.0, 0.5, k) : 1 - sstep(0.75, 0.77, k) * (1 - sstep(0.85, 1.0, k));
        m.dactyl.rotation.z = OPEN * lerp(0.15, open, on);
      }
    },
  };
}

// ---------------------------------------------------------------- the fish (a small goby)
export function makeFish(pal, seed = 5) {
  const group = new THREE.Group();
  const roll = new THREE.Group();
  roll.scale.setScalar(0.72);
  group.add(roll);
  const uni = { uPhase: { value: 0 }, uAmp: { value: 0.05 } };
  const tex = canvasTex(256, 512, (g, w, h) => {
    // u around the body (0 back, 0.5 belly), v head (top) to tail (bottom)
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#9c8a62');
    gr.addColorStop(0.22, pal.fish);
    gr.addColorStop(0.5, '#f1ead6');
    gr.addColorStop(0.78, pal.fish);
    gr.addColorStop(1, '#9c8a62');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const R = rng(seed);
    for (let i = 0; i < 5; i++) {                    // saddle blotches over the back
      const y = h * (0.2 + 0.15 * i);
      g.fillStyle = 'rgba(80,62,40,0.4)';
      for (const x of [0, w]) { g.beginPath(); g.ellipse(x, y, w * 0.2, h * 0.045, 0, 0, Math.PI * 2); g.fill(); }
    }
    for (let i = 0; i < 70; i++) {                   // blue spots on the flanks
      const side = R() < 0.5 ? 0.25 : 0.75;
      const x = w * (side + (R() - 0.5) * 0.24), y = h * (0.08 + R() * 0.75);
      g.fillStyle = pal.fish_spot;
      g.beginPath();
      g.arc(x, y, 2.5 + R() * 3.5, 0, Math.PI * 2);
      g.fill();
    }
  });
  const bodyGeo = (() => {
    const g = new THREE.SphereGeometry(1, 64, 32);
    g.rotateZ(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const s = (x + 1) / 2;
      const rad = 0.28 + 0.72 * sstep(0.0, 0.6, s);
      p.setXYZ(i, x * 0.42, y * 0.105 * rad * (y < 0 ? 0.85 : 1) + 0.012 * sstep(0.6, 1, s), z * 0.088 * rad);
    }
    g.computeVertexNormals();
    return g;
  })();
  const bodyMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42 });
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uPhase = uni.uPhase;
    sh.uniforms.uAmp = uni.uAmp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPhase, uAmp;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sb = clamp((0.25 - position.x) / 0.67, 0.0, 1.0);
        transformed.z += uAmp * sb * sb * sin(uPhase - sb * 3.5);`);
  };
  bodyMat.customProgramCacheKey = () => 'fishbody';
  roll.add(new THREE.Mesh(bodyGeo, bodyMat));
  const finMat = new THREE.MeshStandardMaterial({ color: col(pal.fish).multiplyScalar(0.9), transparent: true, opacity: 0.62, side: THREE.DoubleSide, roughness: 0.6, depthWrite: false });
  const finShape = (pts) => { const s = new THREE.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); return new THREE.ShapeGeometry(s); };
  const tail = new THREE.Group();
  tail.position.set(-0.4, 0.0, 0);
  roll.add(tail);
  const tg = new THREE.Shape();
  tg.moveTo(0, 0.02); tg.quadraticCurveTo(-0.12, 0.11, -0.22, 0.06); tg.quadraticCurveTo(-0.26, 0, -0.22, -0.06); tg.quadraticCurveTo(-0.12, -0.1, 0, -0.02);
  tail.add(new THREE.Mesh(new THREE.ShapeGeometry(tg, 16), finMat));
  const d1 = new THREE.Mesh(finShape([[0.02, 0.07], [0.06, 0.16], [0.14, 0.15], [0.2, 0.09]]), finMat);
  const d2 = new THREE.Mesh(finShape([[-0.3, 0.05], [-0.26, 0.12], [-0.02, 0.13], [0.0, 0.08]]), finMat);
  roll.add(d1, d2);
  const pect = [];
  for (const s of [1, -1]) {
    const pg = new THREE.Shape();
    pg.moveTo(0, 0); pg.quadraticCurveTo(-0.05, 0.09, -0.15, 0.06); pg.quadraticCurveTo(-0.17, 0.0, -0.13, -0.05); pg.quadraticCurveTo(-0.06, -0.07, 0, 0);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(pg, 12), finMat);
    m.position.set(0.17, -0.02, 0.07 * s);
    m.rotation.y = -0.6 * s;
    roll.add(m);
    pect.push(m);
  }
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0d0c0c, roughness: 0.1 });
  const irisMat = new THREE.MeshStandardMaterial({ color: col('#c9a050'), roughness: 0.3 });
  for (const s of [1, -1]) {
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), irisMat);
    iris.position.set(0.3, 0.06, 0.034 * s);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), eyeMat);
    eye.position.set(0.312, 0.065, 0.048 * s);
    roll.add(iris, eye);
  }
  return {
    group,
    /** swim: phase (rad) and amplitude; stun 0..1 rolls it belly-up and folds the fins */
    set({ phase = 0, amp = 0.05, stun = 0 } = {}) {
      uni.uPhase.value = phase;
      uni.uAmp.value = amp * (1 - stun);
      tail.rotation.y = -amp * (1 - stun) * 3.2 * Math.cos(phase - 3.5);
      tail.position.z = amp * (1 - stun) * Math.sin(phase - 3.5);
      roll.rotation.x = 2.5 * ease.inOut(clamp01(stun));
      for (const [i, m] of pect.entries()) m.rotation.y = (i ? 0.6 : -0.6) * (1 - 0.7 * stun) + 0.25 * Math.sin(phase * 0.5) * (1 - stun);
    },
  };
}

// ---------------------------------------------------------------- the snap: jet, bubble, shock wave, flash
export function makeSnapFX(pal) {
  const group = new THREE.Group();              // lives in the claw's profile coords
  const uni = { uTime: { value: 0 } };
  // the water jet: a tapered tube along +x with streaks running out of the socket
  const jetGeo = new THREE.CylinderGeometry(0.045, 0.022, 1, 24, 24, true);
  jetGeo.rotateZ(-Math.PI / 2);       // axis along x: the narrow end (y = -0.5) goes to x = -0.5, at the socket
  jetGeo.translate(0.5, 0, 0);
  const jetMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uni.uTime, uLen: { value: 0 }, uOp: { value: 0 }, uCol: { value: col(pal.jet) } },
    vertexShader: `varying float vX; varying vec3 vN; varying vec3 vV; uniform float uLen;
      void main(){ vX = position.x; vec3 p = position; p.x *= uLen;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uOp; uniform vec3 uCol; varying float vX; varying vec3 vN; varying vec3 vV;
      ${NOISE_GLSL}
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float st = 0.5 + 0.5 * snoise(vec3(vX * 9.0 - uTime * 14.0, f * 3.0, 0.5));
        float a = uOp * (0.25 + 0.75 * pow(f, 1.5)) * (0.55 + 0.6 * st) * smoothstep(1.0, 0.82, vX);
        gl_FragColor = vec4(uCol * (0.8 + 0.8 * st), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const jetMesh = new THREE.Mesh(jetGeo, jetMat);
  jetMesh.position.set(JET0.x, JET0.y, 0);
  jetMesh.renderOrder = 5;
  group.add(jetMesh);
  // streak particles inside the jet
  const NP = 70, R = rng(12);
  const jp = new Float32Array(NP * 3), jbase = [];
  for (let i = 0; i < NP; i++) jbase.push([R(), (R() - 0.5) * 0.05, (R() - 0.5) * 0.05, 0.6 + R() * 0.8]);
  const jpGeo = new THREE.BufferGeometry();
  jpGeo.setAttribute('position', new THREE.BufferAttribute(jp, 3));
  const jpMat = new THREE.PointsMaterial({ size: 0.02, map: dotTex(), color: col(pal.jet), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const jpts = new THREE.Points(jpGeo, jpMat);
  jpts.frustumCulled = false;
  group.add(jpts);

  // the cavitation bubble
  const bubMat = new THREE.ShaderMaterial({
    uniforms: { uTime: uni.uTime, uOp: { value: 0 }, uCol: { value: col(pal.bubble) }, uWob: { value: 0.05 } },
    vertexShader: `uniform float uTime, uWob; varying vec3 vN; varying vec3 vV;
      ${NOISE_GLSL}
      void main(){ vec3 p = position * (1.0 + uWob * snoise(normalize(position) * 1.3 + vec3(0.0, 0.0, uTime * 2.0)));
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uOp; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN), v = normalize(vV);
        float f = 1.0 - abs(dot(n, v));
        float rim = pow(f, 2.2);
        vec3 L = normalize(vec3(-0.35, 0.85, 0.4));
        float spec = pow(max(dot(n, normalize(L + v)), 0.0), 70.0);
        float spec2 = pow(max(dot(n, normalize(vec3(0.5, -0.4, 0.6) + v)), 0.0), 30.0) * 0.4;
        vec3 c = uCol * (0.1 + 1.5 * rim) + vec3(1.0) * (spec * 2.5 + spec2);
        gl_FragColor = vec4(c, uOp * clamp(0.08 + rim * 1.05 + spec + spec2, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false,
  });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), bubMat);
  bubble.position.set(BUB.x, BUB.y, 0);
  bubble.renderOrder = 6;
  group.add(bubble);

  // the shock wave: a thin bright shell
  const shockMat = new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 }, uCol: { value: col(pal.shock) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 uCol; uniform float uOp; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = uOp * (pow(f, 14.0) * 2.2 + 0.25 * pow(f, 4.0));
        gl_FragColor = vec4(uCol * 1.8, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), shockMat);
  shock.position.copy(bubble.position);
  shock.renderOrder = 7;
  group.add(shock);

  // the flash: a hot core, a halo with streaks and a point light that lights the claw and the sand
  const flareTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.08, 'rgba(255,248,225,0.95)');
    gr.addColorStop(0.25, 'rgba(255,214,150,0.35)');
    gr.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
    for (const [ax, ay, len] of [[1, 0, 1], [0, 1, 0.7], [0.7, 0.7, 0.35], [0.7, -0.7, 0.35]]) {
      const lg = g.createLinearGradient(c - ax * c * len, c - ay * c * len, c + ax * c * len, c + ay * c * len);
      lg.addColorStop(0, 'rgba(255,240,210,0)');
      lg.addColorStop(0.5, 'rgba(255,250,235,0.9)');
      lg.addColorStop(1, 'rgba(255,240,210,0)');
      g.strokeStyle = lg;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(c - ax * c * len, c - ay * c * len);
      g.lineTo(c + ax * c * len, c + ay * c * len);
      g.stroke();
    }
  });
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: col(pal.flash), transparent: true, opacity: 0,
    depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  flash.position.copy(bubble.position);
  flash.renderOrder = 20;
  group.add(flash);
  const light = new THREE.PointLight(col(pal.flash), 0, 6, 2);
  light.position.copy(bubble.position);
  group.add(light);

  // micro-bubbles left behind after the collapse
  const ND = 90, dp = new Float32Array(ND * 3), dbase = [];
  const R2 = rng(29);
  for (let i = 0; i < ND; i++) {
    const v = new THREE.Vector3(R2() - 0.5, R2() - 0.5, R2() - 0.5).normalize().multiplyScalar(0.02 + R2() * 0.09);
    dbase.push([v, 0.5 + R2()]);
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const ringTex = canvasTex(64, 64, (g, w) => {
    g.strokeStyle = 'rgba(235,252,255,0.95)';
    g.lineWidth = 6;
    g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 6, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(w * 0.38, w * 0.36, 6, 0, Math.PI * 2); g.fill();
  });
  const dMat = new THREE.PointsMaterial({ size: 0.022, map: ringTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const debris = new THREE.Points(dGeo, dMat);
  debris.frustumCulled = false;
  debris.position.copy(bubble.position);
  group.add(debris);

  return {
    group, bubble, shock, flash, light, uni,
    /** jet 0..1 opacity, jetLen (profile units), r bubble radius, shock {R, op}, flash 0..1, debris tau (s, <0 off) */
    set({ time = 0, jet = 0, jetLen = 0, r = 0, wob = 0.03, shockR = 0, shockOp = 0, flashA = 0, flashS = 0.35, debrisT = -1, lightK = 1 } = {}) {
      uni.uTime.value = time;
      jetMat.uniforms.uOp.value = jet;
      jetMat.uniforms.uLen.value = Math.max(jetLen, 1e-4);
      jetMesh.visible = jet > 0.002 && jetLen > 0.002;
      for (let i = 0; i < NP; i++) {
        const [u, y, z, sp] = jbase[i];
        const x = ((((u + time * 3.0 * sp) % 1) + 1) % 1) * jetLen;
        jp[3 * i] = JET0.x + x; jp[3 * i + 1] = JET0.y + y * (0.5 + x); jp[3 * i + 2] = z * (0.5 + x);
      }
      jpGeo.attributes.position.needsUpdate = true;
      jpMat.opacity = 0.8 * jet;
      jpts.visible = jet > 0.002 && jetLen > 0.002;
      bubble.scale.set(r * 1.12, r, r);
      bubble.visible = r > 0.0015;
      bubMat.uniforms.uOp.value = 1;
      bubMat.uniforms.uWob.value = wob;
      shock.scale.setScalar(Math.max(shockR, 1e-4));
      shockMat.uniforms.uOp.value = shockOp;
      shock.visible = shockOp > 0.002 && shockR > 0.001;
      flash.material.opacity = clamp01(flashA);
      flash.scale.setScalar(flashS * (0.4 + 0.6 * clamp01(flashA)));
      flash.visible = flashA > 0.002;
      light.intensity = 5 * flashA * lightK;
      debris.visible = debrisT >= 0 && debrisT < 3;
      if (debris.visible) {
        for (let i = 0; i < ND; i++) {
          const [v, sp] = dbase[i];
          const k = 1 + 2.2 * (1 - Math.exp(-debrisT * 3));
          dp[3 * i] = v.x * k; dp[3 * i + 1] = v.y * k + 0.08 * sp * debrisT; dp[3 * i + 2] = v.z * k;
        }
        dGeo.attributes.position.needsUpdate = true;
        dMat.opacity = 0.9 * (1 - sstep(0.8, 3, debrisT)) * sstep(0, 0.05, debrisT);
      }
    },
  };
}

// ---------------------------------------------------------------- HUD discs (attached to the camera)
function hud(camera, cx, cy, D = 2) {
  const halfH = D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), pxU = halfH * 2 / 1920;
  const g = new THREE.Group();
  g.position.set((cx - 540) * pxU, (960 - cy) * pxU, -D);
  camera.add(g);
  return { g, pxU };
}

/** The Sun's surface: a glowing disc with granulation and a darker limb, beside the flash (S03). */
export function makeSun(camera, pal, { cx = 780, cy = 620, rad = 190 } = {}) {
  const { g, pxU } = hud(camera, cx, cy, 3);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOp: { value: 0 }, uCol: { value: col(pal.sun) } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uOp; uniform vec3 uCol; varying vec3 vN; varying vec3 vP;
      ${NOISE_GLSL}
      void main(){
        float mu = max(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0);
        vec3 q = normalize(vP) * 7.0;
        float gr = 1.0 - abs(snoise(q + vec3(0.0, 0.0, uTime * 0.2)));
        float gr2 = 0.5 + 0.5 * snoise(q * 2.3 + 4.0 + vec3(uTime * 0.3));
        float limb = 0.22 + 0.78 * pow(mu, 0.6);
        vec3 c = uCol * (0.85 + 0.95 * gr * gr + 0.3 * gr2) * limb;
        gl_FragColor = vec4(c, uOp);
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(rad * pxU * 3 / 3, 64, 48), mat);
  sun.renderOrder = 60;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(pal.sun), transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.setScalar(rad * pxU * 4.2);
  glow.renderOrder = 59;
  g.add(glow, sun);
  return {
    update(t, show) {
      const s = ease.out(clamp01(show));
      g.scale.setScalar(Math.max(1e-4, s));
      g.visible = show > 0.001;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uOp.value = clamp01(show * 1.4);
      glow.material.opacity = 0.55 * clamp01(show);
      sun.rotation.y = t * 0.05;
    },
    cx, cy, rad,
  };
}

/** The sonar screen: a green disc with range rings, a sweep, a contact, and the shrimp crackle as noise (S04). */
export function makeSonar(camera, pal, { cx = 540, cy = 560, rad = 230 } = {}) {
  const { g, pxU } = hud(camera, cx, cy, 2);
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(rad * pxU, 96), mat);
  disc.renderOrder = 100;
  const ringMat = new THREE.MeshBasicMaterial({ color: col(pal.ink_text), transparent: true, depthTest: false, depthWrite: false, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(rad * pxU, (rad + 6) * pxU, 96), ringMat);
  ring.renderOrder = 101;
  g.add(disc, ring);
  const green = pal.sonar;
  return {
    cx, cy, rad,
    update(t, { show = 0, noise = 0, blip = 1 } = {}) {
      const s = ease.out(clamp01(show)) * (1 + 0.06 * Math.sin(Math.PI * clamp01(show)));
      g.scale.setScalar(Math.max(s, 1e-4));
      g.visible = show > 0.001;
      mat.opacity = ringMat.opacity = clamp01(show * 1.5);
      if (!g.visible) return;
      const h = S / 2;
      ctx.fillStyle = '#03140c';
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(98,242,160,0.28)';
      ctx.lineWidth = 2;
      for (const r of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.arc(h, h, h * r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(S, h); ctx.moveTo(h, 0); ctx.lineTo(h, S); ctx.stroke();
      // the sweep, with a fading wedge behind it
      const ang = t * 2.4;
      for (let k = 0; k < 24; k++) {
        const a0 = ang - k * 0.035;
        ctx.fillStyle = `rgba(98,242,160,${0.22 * (1 - k / 24)})`;
        ctx.beginPath(); ctx.moveTo(h, h); ctx.arc(h, h, h, a0 - 0.036, a0); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = green;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(h, h); ctx.lineTo(h + h * Math.cos(ang), h + h * Math.sin(ang)); ctx.stroke();
      // the contact (a ship), brightest just after the sweep passes it
      const ba = -0.9, br = 0.55;
      const since = (((ang - ba) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const glowB = blip * (0.35 + 0.65 * Math.exp(-since * 0.8));
      ctx.fillStyle = `rgba(160,255,200,${glowB})`;
      ctx.beginPath(); ctx.arc(h + h * br * Math.cos(ba), h + h * br * Math.sin(ba), 9, 0, Math.PI * 2); ctx.fill();
      // the shrimp crackle: speckle that fills the whole screen
      if (noise > 0) {
        const R = rng(1000 + Math.floor(t * 30));
        const n = Math.floor(2600 * noise);
        for (let i = 0; i < n; i++) {
          const a = R() * Math.PI * 2, r = Math.sqrt(R()) * h;
          const v = R();
          ctx.fillStyle = `rgba(150,255,195,${0.25 + 0.6 * v})`;
          ctx.fillRect(h + r * Math.cos(a), h + r * Math.sin(a), 2 + 3 * v, 2 + 3 * v);
        }
      }
      tex.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- the colony's snaps, seen from afar
export function makeSnapField(pal, n = 360) {
  const R = rng(55);
  const pos = new Float32Array(n * 3), ph = new Float32Array(n), rate = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x, z;
    do { x = (R() - 0.5) * 34; z = (R() - 0.5) * 30 - 6; } while (Math.hypot(x, z) < 3);
    pos.set([x, sandH(x, z) + 0.15, z], i * 3);
    ph[i] = R(); rate[i] = 0.5 + R() * 1.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  geo.setAttribute('aRate', new THREE.BufferAttribute(rate, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOn: { value: 0 }, uCol: { value: col(pal.flash) }, uMap: { value: glowTex('#ffffff') } },
    vertexShader: `attribute float aPh, aRate; uniform float uTime, uOn; varying float vB;
      void main(){ float k = fract(uTime * aRate + aPh); vB = uOn * exp(-k * 9.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vB *= exp(-0.05 * max(-mv.z - 6.0, 0.0));
        gl_PointSize = (16.0 + 110.0 * vB) * 6.0 / max(-mv.z, 0.5);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform sampler2D uMap; varying float vB;
      void main(){ float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(uCol * 2.0, a * vB); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, set(t, on) { mat.uniforms.uTime.value = t; mat.uniforms.uOn.value = on; points.visible = on > 0.001; } };
}

// ---------------------------------------------------------------- the submarine and its sonar pings
export function makeSub(pal) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: col(pal.steel), roughness: 0.55, metalness: 0.3 });
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const r = 0.42 * Math.pow(Math.sin(Math.PI * t), 0.42) * (1 - 0.3 * sstep(0.62, 1, t));
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), -2.6 + 5.2 * t));
  }
  const hull = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat);
  hull.rotation.z = -Math.PI / 2;           // axis along +x, bow at +x
  group.add(hull);
  const tower = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.62, 6, 16), mat);
  tower.rotation.z = Math.PI / 2;
  tower.scale.set(1.0, 1, 1);
  tower.position.set(0.55, 0.48, 0);
  const towerUp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.22), mat);
  towerUp.position.set(0.55, 0.36, 0);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), mat);
  scope.position.set(0.7, 0.78, 0);
  group.add(tower, towerUp, scope);
  for (const [x, w] of [[1.7, 0.7], [-2.1, 0.9]]) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, w), mat);
    pl.position.set(x, 0.02, 0);
    group.add(pl);
  }
  const rud = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.03), mat);
  rud.position.set(-2.25, 0.05, 0);
  group.add(rud);
  // pings: expanding shells from the bow
  const pingMat = new THREE.ShaderMaterial({
    uniforms: { uOp: { value: 0 }, uCol: { value: col(pal.sonar) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uOp; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uCol, uOp * pow(f, 7.0)); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), pingMat.clone());
    m.position.set(2.2, -0.1, 0);
    group.add(m);
    return m;
  });
  return {
    group,
    update(t, on) {
      for (const [i, m] of pings.entries()) {
        const k = ((t / 1.4 + i / 3) % 1 + 1) % 1;
        m.scale.setScalar(0.2 + k * 4.2);
        m.material.uniforms.uOp.value = on * 0.3 * (1 - k);
        m.visible = on > 0.001;
      }
    },
  };
}

// ---------------------------------------------------------------- the hero layout, shared by S00 and S04 (the loop)
/** Place the hero shrimp; returns the claw tip, the jet direction and the fish's hover point (world). */
export function heroLayout(shrimp) {
  shrimp.group.position.set(SHR.x, SHR.y, SHR.z);
  shrimp.group.rotation.set(0, SHR.ry, 0.05);
  shrimp.set({ open: 0.15, cut: 0, time: 0 });
  const tip = shrimp.clawPoint(1.02, -0.03);
  const bub = shrimp.clawPoint(BUB.x, BUB.y);
  const dir = shrimp.clawPoint(2.0, -0.03).sub(tip).normalize();
  const hover = bub.clone().addScaledVector(dir, 0.42).add(vec(0, 0.2, 0));
  const start = hover.clone().add(vec(1.6, 0.7, 0.5));
  const face = Math.atan2(dir.z, -dir.x);          // the fish's +x points back along the jet, at the shrimp
  return { tip, bub, dir, hover, start, face };
}

/** The fish swimming in (t from 0; negative t is further out on the same line, for S04's loop end). */
export function fishApproach(L, t) {
  const u = t < 0 ? t / 1.6 : 1 - Math.pow(1 - clamp01(t / 1.6), 2.2);
  const p = L.start.clone().lerp(L.hover, u);
  p.y += 0.02 * Math.sin(t * 2.3);
  return p;
}

/** The opening shot (S00's first frame and S04's last). */
export const CAM0 = { p: vec(5.85, 2.79, 5.23), t: vec(0.62, 0.42, 0.0) };
