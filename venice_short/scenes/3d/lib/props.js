// scenes/3d/lib/props.js -- small things on and in the water: a gondola with its ferro, the pile drivers' raft and
// rammer (the "battipali"), the first settlers' boats and huts, marsh reeds, and the mud puffs that burst where a post
// goes in (all puffs precomputed: one static buffer, positions are a pure function of time in the vertex shader).
import * as THREE from 'three';
import { NOISE, patch, mulberry, tint } from './common.js';
import { mergeGeos } from './figures.js';
import { withMedium, MED, MEDIUM_GLSL } from './medium.js';

/** A thin cylinder from a to b (for ropes and poles). */
export function rod(a, b, r, c, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg, 1);
  g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
  return tint(g, c);
}

/** Gondola: length ~10.8 m along +x (bow at +x), the deck edge ~0.5 m above the water line (y = 0). */
export function gondolaGeometry() {
  const L = 10.8, NU = 48, NV = 14, pos = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, s = 2 * u - 1;
    const half = 0.72 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), 2.4)), 0.55) * (1 + 0.06 * s);
    const sheer = 0.5 + 0.95 * Math.pow(Math.abs(s), 3.2) + (s > 0 ? 0.25 * Math.pow(s, 6) : 0);
    const keel = -0.28 * (1 - s * s) + 0.35 * Math.pow(Math.abs(s), 4);
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, ang = Math.PI * v;            // from the left deck edge, under the keel, to the right one
      const x = (u - 0.5) * L;
      const y = keel + (sheer - keel) * (1 - Math.sin(ang)) * 1.0;
      const z = Math.cos(ang) * half * (1 - 0.0 * Math.sin(ang));
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const a = i * (NV + 1) + j, b = a + NV + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setIndex(idx);
  const h = hull.toNonIndexed(); h.computeVertexNormals();
  const parts = [tint(h, '#0B0B0D')];
  // deck between the edges (a flat floor) and a red cushioned seat, a gilded trim
  const floor = new THREE.BoxGeometry(6.0, 0.05, 1.0); floor.translate(-0.3, 0.42, 0); parts.push(tint(floor, '#3A2A1E'));
  const seat = new THREE.BoxGeometry(1.2, 0.35, 1.0); seat.translate(0.6, 0.6, 0); parts.push(tint(seat, '#8E1F24'));
  const back = new THREE.BoxGeometry(0.2, 0.6, 1.0); back.translate(1.15, 0.8, 0); parts.push(tint(back, '#8E1F24'));
  // the ferro at the bow: a blade with six teeth
  const fx = L / 2 - 0.15;
  const blade = new THREE.BoxGeometry(0.06, 1.15, 0.05); blade.rotateZ(-0.12); blade.translate(fx + 0.05, 1.85, 0); parts.push(tint(blade, '#D8DCDF'));
  for (let k = 0; k < 6; k++) { const t = new THREE.BoxGeometry(0.32, 0.07, 0.04); t.translate(fx + 0.22, 1.42 + k * 0.13, 0); parts.push(tint(t, '#D8DCDF')); }
  const crest = new THREE.BoxGeometry(0.5, 0.18, 0.05); crest.translate(fx + 0.05, 2.45, 0); parts.push(tint(crest, '#D8DCDF'));
  // the stern piece and the forcola (oarlock) on the right side near the stern
  const st = new THREE.BoxGeometry(0.1, 0.5, 0.1); st.translate(-L / 2 + 0.2, 1.65, 0); parts.push(tint(st, '#0B0B0D'));
  const forc = new THREE.BoxGeometry(0.14, 0.75, 0.12); forc.translate(-2.9, 0.95, 0.62); parts.push(tint(forc, '#6B4A2E'));
  return mergeGeos(parts);
}

/** The pile drivers' raft: planks, a tripod of poles, a pulley; the rammer and the ropes are posed each frame. */
export function rigGeometry() {
  const parts = [];
  for (let k = 0; k < 9; k++) { const g = new THREE.BoxGeometry(0.42, 0.14, 4.2); g.translate(-1.9 + k * 0.47, 0.12, 0); parts.push(tint(g, k % 2 ? '#6E5238' : '#7C5E40')); }
  for (const z of [-1.7, 1.7]) { const g = new THREE.BoxGeometry(4.3, 0.12, 0.25); g.translate(0, 0.22, z); parts.push(tint(g, '#5A432E')); }
  const apex = new THREE.Vector3(0, 6.6, 0);
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [0, 1.9]]) parts.push(rod(new THREE.Vector3(x, 0.2, z), apex, 0.09, '#5E4630', 7));
  const pul = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12); pul.rotateX(Math.PI / 2); pul.translate(0, 6.45, 0); parts.push(tint(pul, '#3A2C20'));
  return { geo: mergeGeos(parts), apex };
}
export function rammerGeometry() {
  const parts = [];
  const g = new THREE.CylinderGeometry(0.32, 0.34, 0.95, 14); g.translate(0, 0.475, 0); parts.push(tint(g, '#4A3524'));
  for (const y of [0.12, 0.83]) { const b = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 14); b.translate(0, y, 0); parts.push(tint(b, '#2C2C2E')); }
  for (let k = 0; k < 4; k++) { const hnd = new THREE.BoxGeometry(0.5, 0.06, 0.06); hnd.translate(0.45, 0.6, 0); hnd.rotateY(k * Math.PI / 2); parts.push(tint(hnd, '#3A2A1C')); }
  const ring = new THREE.TorusGeometry(0.08, 0.02, 6, 12); ring.translate(0, 1.0, 0); parts.push(tint(ring, '#2C2C2E'));
  return mergeGeos(parts);
}

/** A settler's hut: wattle walls, a steep thatched roof. Foot at y = 0. */
export function hutGeometry(w, d, seed) {
  const r = mulberry(seed), parts = [];
  const wall = new THREE.BoxGeometry(w, 1.7, d, 6, 2, 6); wall.translate(0, 0.85, 0); parts.push(tint(wall, '#7A6040'));
  const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.82, 2.4, 4, 3); roof.rotateY(Math.PI / 4); roof.scale(w / Math.max(w, d), 1, d / Math.max(w, d)); roof.translate(0, 1.7 + 1.2, 0);
  const p = roof.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.08 * Math.sin(p.getX(i) * 9 + p.getZ(i) * 7) * (r() * 0.5 + 0.5));
  roof.computeVertexNormals(); parts.push(tint(roof, '#B49A5E'));
  const door = new THREE.BoxGeometry(0.6, 1.1, 0.05); door.translate(0, 0.55, d / 2 + 0.01); parts.push(tint(door, '#2A2016'));
  return mergeGeos(parts);
}

/** A flat-bottomed boat (for the settlers), ~5 m, bow at +x. */
export function boatGeometry() {
  const parts = [];
  const hull = new THREE.BoxGeometry(4.6, 0.5, 1.3, 8, 1, 1);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), u = x / 2.3; p.setZ(i, p.getZ(i) * (1 - 0.6 * Math.pow(Math.abs(u), 3))); p.setY(i, p.getY(i) + 0.35 * Math.pow(Math.abs(u), 3) * (p.getY(i) > 0 ? 1 : 0.4)); }
  hull.computeVertexNormals(); hull.translate(0, 0.1, 0); parts.push(tint(hull, '#6A5038'));
  const inside = new THREE.BoxGeometry(3.6, 0.05, 0.95); inside.translate(0, 0.28, 0); parts.push(tint(inside, '#3E2E20'));
  return mergeGeos(parts);
}

/** Reeds on the marsh islands: instanced blades, swaying. */
export function buildReeds(spots, seed = 3) {
  const blade = new THREE.ConeGeometry(0.035, 1.2, 3, 4); blade.translate(0, 0.6, 0);
  const parts = [];
  const r = mulberry(seed);
  for (let k = 0; k < 7; k++) { const b = blade.clone(); const a = r() * 6.28, d = r() * 0.25; b.rotateZ((r() - 0.5) * 0.5); b.scale(1, 0.6 + r() * 0.7, 1); b.translate(Math.cos(a) * d, 0, Math.sin(a) * d); parts.push(tint(b, ['#5E7A34', '#7C8C3E', '#9C9A52', '#4E6A2E'][Math.floor(r() * 4)])); }
  const g = mergeGeos(parts);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const uni = { uT: { value: 0 }, uGrow: { value: 0 } };
  patch(m, {
    uniforms: uni,
    vHead: 'uniform float uT, uGrow;',
    vert: { '#include <begin_vertex>': `#include <begin_vertex>
      transformed.y *= uGrow;
      vec4 ip = instanceMatrix * vec4(0., 0., 0., 1.);
      transformed.x += 0.08 * position.y * position.y * sin(uT * 1.7 + ip.x * 0.5 + ip.z * 0.3);` },
  });
  const mesh = new THREE.InstancedMesh(g, m, spots.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
  spots.forEach(([x, y, z, s], i) => { Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28); S.setScalar(s); M.compose(new THREE.Vector3(x, y, z), Q, S); mesh.setMatrixAt(i, M); });
  mesh.castShadow = true; mesh.frustumCulled = false;
  return { mesh, uni };
}

/** Puffs: list of [x, y, z, t0, size, kind] (kind 0 = mud, 1 = water splash, 2 = needles / leaves). */
export function buildPuffs(list, seed = 21) {
  const PER = 14, n = list.length * PER;
  const r = mulberry(seed);
  const org = new Float32Array(n * 3), dir = new Float32Array(n * 3), t0 = new Float32Array(n), sz = new Float32Array(n), kind = new Float32Array(n);
  let o = 0;
  for (const [x, y, z, t, s, k] of list) for (let j = 0; j < PER; j++) {
    org.set([x, y, z], o * 3);
    const a = r() * 6.283, up = k === 1 ? 1.5 + r() * 2.5 : k === 2 ? -0.3 - r() * 0.6 : 0.2 + r() * 0.9;
    dir.set([Math.cos(a) * (0.5 + r()), up, Math.sin(a) * (0.5 + r())], o * 3);
    t0[o] = t + r() * 0.06; sz[o] = s * (0.6 + 0.8 * r()); kind[o] = k; o++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(org, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aT0', new THREE.BufferAttribute(t0, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const uni = Object.assign({ uT: { value: 0 } }, MED);
  const m = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: `${NOISE}\n${MEDIUM_GLSL}
      uniform float uT; attribute vec3 aDir; attribute float aT0, aSize, aKind; varying vec3 vC; varying float vA;
      void main(){
        float age = uT - aT0;
        float life = aKind > 1.5 ? 1.8 : aKind > 0.5 ? 0.7 : 1.6;
        if (age < 0. || age > life) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
        float u = age / life;
        vec3 p = position;
        if (aKind > 1.5) p += vec3(aDir.x * 1.6 * u, -2.2 * u * u + aDir.y * u, aDir.z * 1.6 * u);            // needles drifting down
        else if (aKind > 0.5) p += vec3(aDir.x * 0.9 * age, aDir.y * age - 4.9 * age * age, aDir.z * 0.9 * age);  // droplets
        else p += aDir * (1. - exp(-age * 3.0)) * vec3(0.9, 0.5, 0.9);                                        // a mud cloud
        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float grow = aKind > 0.5 ? 1.0 : 1.0 + 2.5 * (1. - exp(-age * 2.0));
        gl_PointSize = aSize * grow * 1080. * 0.08 / -mv.z;
        vec3 base = aKind > 1.5 ? vec3(0.45, 0.55, 0.2) : aKind > 0.5 ? vec3(0.85, 0.95, 0.95) : vec3(0.42, 0.37, 0.29);
        vC = applyMedium(base, p);
        vA = (aKind > 0.5 ? 0.9 : 0.55) * (1. - u) * (aKind > 0.5 ? 1. : smoothstep(0., 0.1, u));
      }`,
    fragmentShader: `varying vec3 vC; varying float vA;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q); if (d > 0.25) discard; gl_FragColor = vec4(vC, vA * (1. - d * 4.)); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = 7;
  return { points: pts, uni };
}
