// scenes/3d/lib/people.js -- the workers: low-poly Egyptian labourers (bare torso, white linen kilt, dark cropped
// hair), drawn as instanced body parts posed by a tiny forward-kinematics rig every frame. One crowd holds every
// figure in the film (the hauling team, the far teams, the 172 at the colossus, the water pourers, the clapper).
//
// Local frame of a figure: forward = +x, up = +y, its left side = -z. Limbs hang along -y from their joint; a
// positive angle about z swings a limb forward (+x).
//
// Each figure can dissolve (aFade 0 -> 1): a noisy edge eats it with a hot rim, so "half as many people" can leave.
import * as THREE from 'three';
import { patch, tint, mulberry } from './common.js';

const PARTS = ['torso', 'kilt', 'head', 'uarm', 'farm', 'thigh', 'shin', 'jar'];
const PER = { torso: 1, kilt: 1, head: 1, uarm: 2, farm: 2, thigh: 2, shin: 2, jar: 1 };

function cap(r, len, segs = 8) {
  const g = new THREE.CapsuleGeometry(r, len, 3, segs);
  g.translate(0, -len / 2 - r * 0.2, 0);
  return g;
}

function geometries(P) {
  const merge = (list) => {
    const BGU = mergeGeos(list);
    return BGU;
  };
  const skin = P.skin, linen = P.linen, hair = '#1A120C';
  const torso = new THREE.CapsuleGeometry(0.15, 0.36, 4, 10); torso.scale(1, 1, 1.35); torso.translate(0, 0.33, 0);
  const chest = new THREE.SphereGeometry(0.16, 12, 8); chest.scale(0.85, 0.75, 1.35); chest.translate(0.02, 0.5, 0);
  const torsoG = merge([tint(torso, skin), tint(chest, skin)]);
  const kilt = new THREE.CylinderGeometry(0.19, 0.27, 0.42, 14, 1, false); kilt.translate(0, -0.13, 0);
  const belt = new THREE.TorusGeometry(0.19, 0.025, 6, 16); belt.rotateX(Math.PI / 2); belt.translate(0, 0.07, 0);
  const kiltG = merge([tint(kilt, linen), tint(belt, linen)]);
  const head = new THREE.SphereGeometry(0.105, 14, 10); head.scale(1.05, 1.12, 0.95); head.translate(0.01, 0.16, 0);
  const hairG = new THREE.SphereGeometry(0.115, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); hairG.scale(1.08, 1.05, 1.0);
  hairG.rotateZ(0.35); hairG.translate(-0.012, 0.18, 0);
  const neck = new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8); neck.translate(0, 0.04, 0);
  const nose = new THREE.ConeGeometry(0.022, 0.05, 5); nose.rotateZ(-Math.PI / 2); nose.translate(0.11, 0.15, 0);
  const headG = merge([tint(head, skin), tint(hairG, hair), tint(neck, skin), tint(nose, skin)]);
  const uarmG = tint(cap(0.048, 0.24), skin);
  const farm = cap(0.04, 0.22); const hand = new THREE.SphereGeometry(0.048, 8, 6); hand.scale(1, 1.3, 0.8); hand.translate(0, -0.33, 0);
  const farmG = merge([tint(farm, skin), tint(hand, skin)]);
  const thighG = tint(cap(0.075, 0.34), skin);
  const shin = cap(0.058, 0.36); const foot = new THREE.BoxGeometry(0.22, 0.06, 0.09); foot.translate(0.06, -0.47, 0);
  const shinG = merge([tint(shin, skin), tint(foot, skin)]);
  // the water jar (only drawn for the pourers): a round-bellied pot, mouth along +x of its own frame
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const r = 0.03 + 0.15 * Math.sin(Math.PI * Math.min(1, u * 1.08)) ** 0.8 * (1 - 0.35 * u) + (u > 0.9 ? 0.03 : 0);
    prof.push(new THREE.Vector2(Math.max(0.01, r), u * 0.42));
  }
  const jar = new THREE.LatheGeometry(prof, 16); jar.translate(0, -0.21, 0); jar.rotateZ(-Math.PI / 2);
  const jarG = tint(jar, '#A55E36');
  return { torso: torsoG, kilt: kiltG, head: headG, uarm: uarmG, farm: farmG, thigh: thighG, shin: shinG, jar: jarG };
}

function mergeGeos(list) {
  // minimal merge (positions, normals, colours), all non-indexed
  const arrs = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of arrs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of arrs) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
export { mergeGeos };

export function buildCrowd(P, N, seed = 7) {
  const G = geometries(P);
  const group = new THREE.Group();
  const shared = { uGlow: { value: new THREE.Color(P.good) } };
  const meshes = {}, fades = {};
  for (const k of PARTS) {
    const cnt = N * PER[k];
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(cnt), 1);
    G[k].setAttribute('aFade', fade);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: k === 'kilt' ? 0.85 : 0.6, metalness: 0 });
    patch(mat, {
      uniforms: shared,
      vHead: 'attribute float aFade; varying float vFade; varying vec3 vWP;',
      vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvFade = aFade;',
              '#include <worldpos_vertex>': '#include <worldpos_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz;' },
      fHead: 'varying float vFade; varying vec3 vWP; uniform vec3 uGlow;',
      frag: { '#include <color_fragment>': `#include <color_fragment>
                float nz = vnoise3(vWP * 9.0) * 0.6 + vnoise3(vWP * 23.0) * 0.4;
                float edge = nz - (vFade * 1.25 - 0.12);
                if (vFade > 0.001 && edge < 0.0) discard;
                float rim = vFade > 0.001 ? 1. - smoothstep(0.0, 0.1, edge) : 0.;`,
              '#include <emissivemap_fragment>': '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * rim * 6.0;',
              // skin: a touch of sheen from sweat and oil, so the low sun picks out the backs
              '#include <roughnessmap_fragment>': '#include <roughnessmap_fragment>\nroughnessFactor *= 1.0;' },
    });
    const m = new THREE.InstancedMesh(G[k], mat, cnt);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const rnd = mulberry(seed + k.length);
    for (let i = 0; i < cnt; i++) {
      const v = k === 'kilt' ? 0.93 + 0.07 * rnd() : 0.82 + 0.3 * rnd();
      m.setColorAt(i, new THREE.Color(v, v * (0.97 + 0.03 * rnd()), v * (0.95 + 0.05 * rnd())));
    }
    meshes[k] = m; fades[k] = fade;
    group.add(m);
  }
  // per-figure skin tone (applied through instanceColor on the skin parts)
  const rnd = mulberry(seed);
  const tone = Array.from({ length: N }, () => 0.78 + 0.36 * rnd());
  for (const k of ['torso', 'head', 'uarm', 'farm', 'thigh', 'shin']) {
    for (let i = 0; i < N; i++) for (let j = 0; j < PER[k]; j++) {
      const c = new THREE.Color(); meshes[k].getColorAt(i * PER[k] + j, c);
      const v = tone[i]; c.setRGB(v, v * 0.98, v * 0.95); meshes[k].setColorAt(i * PER[k] + j, c);
    }
  }

  // ---------------------------------------------------------------- the rig
  const M = new THREE.Matrix4(), R = new THREE.Matrix4(), T = new THREE.Matrix4(), S = new THREE.Matrix4();
  const stack = [];
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const rotZ = (a) => R.makeRotationZ(a);
  const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);
  const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const rz = (a) => new THREE.Matrix4().makeRotationZ(a);
  const rx = (a) => new THREE.Matrix4().makeRotationX(a);
  const ry = (a) => new THREE.Matrix4().makeRotationY(a);
  const used = new Uint8Array(N);
  const handOut = new THREE.Vector3();

  /** Pose figure i. s = { x, y, z, yaw, scale, phase (rad), walk (0..1), lean, arms: [a1L, a2L, a1R, a2R, spreadL, spreadR],
   *  jar (tilt or null), fade (0..1), headTilt } */
  function set(i, s) {
    used[i] = 1;
    const fade = s.fade ?? 0;
    for (const k of PARTS) for (let j = 0; j < PER[k]; j++) fades[k].array[i * PER[k] + j] = fade;
    if (fade >= 0.999) { for (const k of PARTS) for (let j = 0; j < PER[k]; j++) meshes[k].setMatrixAt(i * PER[k] + j, zero); return; }
    const sc = s.scale ?? 1;
    const ph = s.phase ?? 0, wk = s.walk ?? 0;
    const bob = -0.035 * wk * Math.abs(Math.cos(ph));
    const root = mul(mul(tr(s.x, s.y ?? 0, s.z), ry(s.yaw ?? 0)), new THREE.Matrix4().makeScale(sc, sc, sc));
    const pelvis = mul(root, tr(0, 0.93 + bob, 0));
    // legs
    for (const side of [-1, 1]) {
      const p = side < 0 ? ph : ph + Math.PI;
      const th = (s.thigh ?? 0) + wk * 0.42 * Math.sin(p);
      const kn = (s.knee ?? 0) + wk * (0.12 + 0.6 * Math.max(0, Math.cos(p)) ** 1.5);
      const hip = mul(mul(pelvis, tr(0, -0.02, side * 0.095)), rz(th));
      meshes.thigh.setMatrixAt(i * 2 + (side < 0 ? 0 : 1), hip);
      const knee = mul(mul(hip, tr(0, -0.44, 0)), rz(-kn));
      meshes.shin.setMatrixAt(i * 2 + (side < 0 ? 0 : 1), knee);
    }
    meshes.kilt.setMatrixAt(i, mul(pelvis, rz(-(s.lean ?? 0) * 0.3)));
    const torso = mul(mul(pelvis, rz(-(s.lean ?? 0))), rz(0.04 * wk * Math.sin(2 * ph)));
    meshes.torso.setMatrixAt(i, torso);
    meshes.head.setMatrixAt(i, mul(mul(torso, tr(0.0, 0.66, 0)), rz(s.headTilt ?? (s.lean ?? 0) * 0.6)));
    const a = s.arms || [0.15, 0.2, 0.15, 0.2, 0, 0];
    let hand = null;
    for (const side of [-1, 1]) {
      const o = side < 0 ? 0 : 2;
      const sh = mul(mul(mul(torso, tr(0, 0.55, side * 0.215)), rx(-side * (a[4 + (o ? 1 : 0)] ?? 0))), rz(a[o]));
      meshes.uarm.setMatrixAt(i * 2 + (o ? 1 : 0), sh);
      const el = mul(mul(sh, tr(0, -0.3, 0)), rz(a[o + 1]));
      meshes.farm.setMatrixAt(i * 2 + (o ? 1 : 0), el);
      if (side > 0) hand = el;
    }
    if (s.jar != null) {
      // the jar held in both hands at the right hand, tipped by s.jar (0 upright .. 1 pouring)
      const j = mul(mul(mul(hand, tr(0.0, -0.36, -0.2)), rz(-Math.PI / 2 + 0.0)), rz(-(s.lean ?? 0) * 0 - 1.4 * s.jar + 0.6));
      meshes.jar.setMatrixAt(i, j);
      handOut.setFromMatrixPosition(mul(j, tr(0.22, 0, 0)));
    } else meshes.jar.setMatrixAt(i, zero);
  }
  function begin() { used.fill(0); }
  function commit() {
    for (let i = 0; i < N; i++) if (!used[i]) for (const k of PARTS) for (let j = 0; j < PER[k]; j++) meshes[k].setMatrixAt(i * PER[k] + j, zero);
    for (const k of PARTS) { meshes[k].instanceMatrix.needsUpdate = true; fades[k].needsUpdate = true; }
  }
  return { group, set, begin, commit, N, jarMouth: handOut, meshes };
}

/** Hauling pose: leaning into the rope, the rope over the right shoulder, both hands on it at the chest. */
export function haulPose(phase, lean = 0.42) {
  return { phase, walk: 1, lean, arms: [1.75, 0.55, 1.55, 0.95, 0.12, -0.05], headTilt: lean * 0.45 };
}
