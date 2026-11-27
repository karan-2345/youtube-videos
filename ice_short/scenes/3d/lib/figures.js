// scenes/3d/lib/figures.js -- people of the 1800s as painted figurines: a coat or shirt, trousers or a skirt, boots
// or bare feet, a hat (top hat, straw hat, turban, head wrap), a face with eyes, brows and a mouth that opens to laugh.
// Instanced body parts posed by a small forward-kinematics rig each frame (one draw call per part for the whole crowd).
//
// Local frame of a figure: forward = +x, up = +y, its left side = -z. Limbs hang along -y from their joint; a positive
// angle about z swings a limb forward (+x).
//   buildPeople(N, seed) -> { group, dress(i, d), set(i, pose), begin(), commit(), meshes }
//   poses: stand(), laugh(t, k), point(t), sit(), amazed(t, k), walk(phase)
import * as THREE from 'three';
import { patch, tint, mulberry } from './common.js';

export function mergeGeos(list) {
  const arrs = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of arrs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of arrs) {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function cap(r, len, segs = 10) {
  const g = new THREE.CapsuleGeometry(r, len, 4, segs);
  g.translate(0, -len / 2 - r * 0.2, 0);
  return g;
}
const W = '#ffffff';

function geometries() {
  const M = (list) => mergeGeos(list);
  // coat / shirt body: a tapered capsule, broad at the shoulders; buttons and lapels for the coat
  const torso = new THREE.CapsuleGeometry(0.155, 0.36, 4, 14); torso.scale(1, 1, 1.3); torso.translate(0, 0.33, 0);
  const tp = torso.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); const k = 0.86 + 0.14 * Math.min(1, Math.max(0, (y - 0.1) / 0.45)); tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); }
  torso.computeVertexNormals();
  const chest = new THREE.SphereGeometry(0.16, 14, 10); chest.scale(0.82, 0.72, 1.3); chest.translate(0.02, 0.5, 0);
  const lapL = new THREE.BoxGeometry(0.02, 0.26, 0.07); lapL.rotateX(0.35); lapL.translate(0.15, 0.52, -0.06);
  const lapR = new THREE.BoxGeometry(0.02, 0.26, 0.07); lapR.rotateX(-0.35); lapR.translate(0.15, 0.52, 0.06);
  const torsoG = M([tint(torso, W), tint(chest, W), tint(lapL, '#BBBBBB'), tint(lapR, '#BBBBBB')]);
  // collar / cravat (white)
  const crav = new THREE.CylinderGeometry(0.075, 0.09, 0.1, 12); crav.translate(0.01, 0.66, 0);
  const knot = new THREE.SphereGeometry(0.045, 8, 6); knot.scale(0.8, 1.1, 1.2); knot.translate(0.09, 0.6, 0);
  const shirtV = new THREE.BoxGeometry(0.02, 0.2, 0.08); shirtV.translate(0.155, 0.5, 0);
  const collarG = M([tint(crav, W), tint(knot, W), tint(shirtV, W)]);
  // coat tails (behind, to the knee)
  const tl = new THREE.BoxGeometry(0.05, 0.55, 0.15); tl.translate(-0.15, -0.2, -0.08); tl.rotateZ(-0.12);
  const tr = new THREE.BoxGeometry(0.05, 0.55, 0.15); tr.translate(-0.15, -0.2, 0.08); tr.rotateZ(-0.12);
  const tailsG = M([tint(tl, W), tint(tr, W)]);
  // skirt: a flared cone to the ankle
  const sk = new THREE.CylinderGeometry(0.2, 0.42, 0.88, 18, 3, true);
  const sp = sk.attributes.position;
  for (let i = 0; i < sp.count; i++) { const a = Math.atan2(sp.getZ(i), sp.getX(i)); const y = sp.getY(i); const k = 1 + 0.05 * Math.sin(a * 8) * (0.5 - y / 0.88); sp.setX(i, sp.getX(i) * k); sp.setZ(i, sp.getZ(i) * k); }
  sk.translate(0, -0.36, 0); sk.computeVertexNormals();
  const skirtG = tint(sk, W);
  // head: face with eyes and brows (dark, so the skin tint leaves them dark), ears, nose
  const head = new THREE.SphereGeometry(0.105, 18, 14); head.scale(0.98, 1.15, 0.92); head.translate(0.01, 0.16, 0);
  const jaw = new THREE.SphereGeometry(0.08, 12, 8); jaw.scale(1.05, 0.8, 1.0); jaw.translate(0.03, 0.09, 0);
  const nose = new THREE.ConeGeometry(0.02, 0.055, 6); nose.rotateZ(-Math.PI / 2 - 0.4); nose.translate(0.112, 0.155, 0);
  const earL = new THREE.SphereGeometry(0.025, 6, 6); earL.scale(0.6, 1.2, 0.4); earL.translate(0.0, 0.16, -0.098);
  const earR = earL.clone(); earR.translate(0, 0, 0.196);
  const parts = [tint(head, W), tint(jaw, W), tint(nose, W), tint(earL, W), tint(earR, W)];
  for (const s of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.014, 8, 6); eye.scale(0.6, 1, 1); eye.translate(0.098, 0.185, s * 0.036); parts.push(tint(eye, '#141010'));
    const brow = new THREE.BoxGeometry(0.012, 0.012, 0.045); brow.rotateX(s * 0.15); brow.translate(0.1, 0.215, s * 0.038); parts.push(tint(brow, '#3A2A20'));
  }
  const neck = new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8); neck.translate(0, 0.04, 0); parts.push(tint(neck, W));
  const headG = M(parts);
  // mouth: a dark lens on the face, scaled open when laughing
  const mouth = new THREE.SphereGeometry(0.022, 10, 6); mouth.scale(0.4, 0.5, 1.3);
  const mouthG = tint(mouth, '#3A1612');
  // hair: a cap with sideburns
  const hairC = new THREE.SphereGeometry(0.115, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52); hairC.scale(1.0, 1.05, 0.98); hairC.rotateZ(0.42); hairC.translate(-0.016, 0.175, 0);
  const sbL = new THREE.BoxGeometry(0.03, 0.06, 0.012); sbL.translate(0.035, 0.13, -0.098);
  const sbR = sbL.clone(); sbR.translate(0, 0, 0.196);
  const hairG = M([tint(hairC, W), tint(sbL, W), tint(sbR, W)]);
  // hats
  const th1 = new THREE.CylinderGeometry(0.098, 0.088, 0.2, 18); th1.translate(0, 0.37, 0);
  const th2 = new THREE.CylinderGeometry(0.16, 0.16, 0.012, 22); th2.scale(1.1, 1, 0.92); th2.translate(0, 0.27, 0);
  const thb = new THREE.CylinderGeometry(0.0995, 0.0995, 0.03, 18); thb.translate(0, 0.295, 0);
  const tophatG = M([tint(th1, W), tint(th2, W), tint(thb, '#555555')]);
  const st1 = new THREE.CylinderGeometry(0.09, 0.1, 0.08, 16); st1.translate(0, 0.315, 0);
  const st2 = new THREE.CylinderGeometry(0.26, 0.24, 0.012, 24); st2.translate(0, 0.28, 0);
  const strawG = M([tint(st1, W), tint(st2, '#E8E0C8')]);
  const turban = [];
  for (let k = 0; k < 3; k++) { const tt = new THREE.TorusGeometry(0.09 - k * 0.012, 0.035, 8, 18); tt.rotateX(Math.PI / 2); tt.rotateZ(0.12 * (k % 2 ? 1 : -1)); tt.translate(0, 0.27 + k * 0.04, 0); turban.push(tint(tt, W)); }
  const tcap = new THREE.SphereGeometry(0.085, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); tcap.translate(0, 0.3, 0); turban.push(tint(tcap, W));
  const turbanG = M(turban);
  const wrap = new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55); wrap.scale(1.02, 1.15, 1.0); wrap.rotateZ(0.3); wrap.translate(-0.01, 0.19, 0);
  const knot2 = new THREE.SphereGeometry(0.05, 8, 6); knot2.translate(0.0, 0.3, 0.06);
  const wrapG = M([tint(wrap, W), tint(knot2, W)]);
  // arms (sleeve) and hands
  const uarmG = tint(cap(0.05, 0.24), W);
  const farm = cap(0.043, 0.21); const cuff = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10); cuff.translate(0, -0.28, 0);
  const farmG = M([tint(farm, W), tint(cuff, '#D0D0D0')]);
  const hand = new THREE.SphereGeometry(0.047, 10, 8); hand.scale(0.9, 1.3, 0.75); hand.translate(0, -0.34, 0);
  const thumb = new THREE.SphereGeometry(0.02, 6, 5); thumb.scale(1, 1.6, 1); thumb.translate(0.03, -0.32, 0.03);
  const handG = M([tint(hand, W), tint(thumb, W)]);
  // legs (trousers) and boots
  const thighG = tint(cap(0.078, 0.34), W);
  const shinG = tint(cap(0.06, 0.32), W);
  const boot = new THREE.BoxGeometry(0.24, 0.07, 0.1); boot.translate(0.05, -0.47, 0);
  const ankle = new THREE.CylinderGeometry(0.062, 0.066, 0.12, 10); ankle.translate(0, -0.41, 0);
  const toe = new THREE.SphereGeometry(0.05, 8, 6); toe.scale(1.2, 0.7, 1); toe.translate(0.15, -0.47, 0);
  const bootG = M([tint(boot, W), tint(ankle, W), tint(toe, W)]);
  return { torso: torsoG, collar: collarG, tails: tailsG, skirt: skirtG, head: headG, mouth: mouthG, hair: hairG,
    tophat: tophatG, straw: strawG, turban: turbanG, wrap: wrapG, uarm: uarmG, farm: farmG, hand: handG, thigh: thighG, shin: shinG, boot: bootG };
}

const PER = { torso: 1, collar: 1, tails: 1, skirt: 1, head: 1, mouth: 1, hair: 1, tophat: 1, straw: 1, turban: 1, wrap: 1,
  uarm: 2, farm: 2, hand: 2, thigh: 2, shin: 2, boot: 2 };
const PARTS = Object.keys(PER);

/** Wardrobes. */
export const SKIN = ['#E9C3A0', '#D9A982', '#B97E57', '#8E5A3A', '#6B4029', '#4E2E1D'];
export function dressFor(kind, r) {
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  if (kind === 'tudor') return { coat: '#1D2330', trousers: '#C9BFA8', boot: '#151110', skin: '#E2B795', hair: '#5A3A22', hat: 'tophat', hatC: '#16161A', collar: '#F4F1EA', tails: true };
  if (kind === 'merchant') return { coat: pick(['#3A2A22', '#24324A', '#4A3A2A', '#2E3B2E']), trousers: pick(['#CFC5AE', '#B7AA8E', '#8C7F6A']), boot: '#18120E', skin: pick(SKIN.slice(0, 2)), hair: pick(['#3A2618', '#6A4A2A', '#9A9088']), hat: pick(['tophat', 'tophat', 'none']), hatC: pick(['#1A1818', '#3A2E24']), collar: '#EEE9DC', tails: true };
  if (kind === 'islander') {
    const woman = r() < 0.45;
    return woman
      ? { coat: pick(['#F1E9D6', '#E7C74A', '#D9573C', '#F2EEE6']), skirt: pick(['#C3402F', '#2E6FA0', '#E0A63A', '#5E8C3A', '#F2EEE6']), trousers: '#000000', boot: 'skin', skin: pick(SKIN.slice(2)), hair: '#120C08', hat: 'wrap', hatC: pick(['#D9573C', '#E7C74A', '#2E6FA0', '#F2EEE6']), collar: null }
      : { coat: pick(['#F1E9D6', '#E9E2D0', '#CDB79A', '#8FA7C0']), trousers: pick(['#CDBB98', '#E8E0CC', '#6E6A5E']), boot: pick(['skin', '#2A1E16']), skin: pick(SKIN.slice(2)), hair: '#120C08', hat: pick(['straw', 'straw', 'none']), hatC: '#D8C28C', collar: null };
  }
  if (kind === 'sailor') return { coat: pick(['#E9E4D8', '#2C3E5C', '#B8432E']), trousers: pick(['#E2DCCB', '#2C3E5C']), boot: pick(['skin', '#1E1612']), skin: pick(SKIN.slice(0, 4)), hair: pick(['#2A1A10', '#6A4A2A']), hat: pick(['straw', 'none', 'none']), hatC: '#D2BC88', collar: null };
  if (kind === 'calcutta') {
    const brit = r() < 0.4;
    return brit
      ? { coat: pick(['#F2EEE4', '#E4DCC8', '#24324A']), trousers: '#EDE8DC', boot: '#1A1410', skin: pick(SKIN.slice(0, 2)), hair: '#5A3A22', hat: pick(['tophat', 'straw']), hatC: pick(['#1A1818', '#E9E0C8']), collar: '#F4F1EA', tails: r() < 0.5 }
      : { coat: pick(['#F4F0E6', '#EFE6CF', '#E9DCC0']), trousers: pick(['#F4F0E6', '#EDE5D2']), boot: 'skin', skin: pick(SKIN.slice(2, 5)), hair: '#120C08', hat: pick(['turban', 'turban', 'none']), hatC: pick(['#F4F0E6', '#D9573C', '#E7C74A', '#B8432E']), collar: null };
  }
  if (kind === 'cutter') return { coat: pick(['#4A3A2E', '#3A3F48', '#5A2E28']), trousers: pick(['#3E3A34', '#5A5248']), boot: '#18120E', skin: pick(SKIN.slice(0, 2)), hair: '#3A2618', hat: pick(['wrap', 'none']), hatC: pick(['#6A2A22', '#3A3F48']), collar: null };
  return { coat: '#888888', trousers: '#666666', boot: '#222222', skin: SKIN[1], hair: '#222', hat: 'none', hatC: '#222', collar: null };
}

export function buildPeople(N, seed = 7) {
  const G = geometries();
  const group = new THREE.Group();
  const meshes = {};
  const fades = {};
  for (const k of PARTS) {
    const cnt = N * PER[k];
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(cnt), 1);
    G[k].setAttribute('aFade', fade);
    const rough = { skirt: 0.9, torso: 0.78, tails: 0.78, tophat: 0.45, boot: 0.4, hair: 0.7, head: 0.55, hand: 0.55 }[k] ?? 0.75;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: rough, metalness: 0 });
    patch(mat, {
      vHead: 'attribute float aFade; varying float vFade; varying vec3 vOP;',
      vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvFade = aFade; vOP = position;' },
      fHead: 'varying float vFade; varying vec3 vOP;',
      frag: { '#include <color_fragment>': `#include <color_fragment>
        if (vFade > 0.001 && vnoise3(vOP * 30.) < vFade) discard;
        // cloth: a fine weave and soft folds; skin: a little warmth in the shadows
        diffuseColor.rgb *= 0.92 + 0.12 * vnoise3(vOP * vec3(60., 18., 60.));` },
    });
    const m = new THREE.InstancedMesh(G[k], mat, cnt);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cnt; i++) m.setColorAt(i, new THREE.Color(1, 1, 1));
    meshes[k] = m; fades[k] = fade;
    group.add(m);
  }
  const dressOf = new Array(N).fill(null);
  function dress(i, d) {
    dressOf[i] = d;
    const C = (h) => new THREE.Color(h);
    const setC = (k, c) => { for (let j = 0; j < PER[k]; j++) meshes[k].setColorAt(i * PER[k] + j, c); };
    const skin = C(d.skin);
    setC('torso', C(d.coat)); setC('uarm', C(d.coat)); setC('farm', C(d.coat)); setC('tails', C(d.coat));
    setC('collar', C(d.collar || d.coat)); setC('skirt', C(d.skirt || '#000'));
    setC('head', skin); setC('hand', skin); setC('mouth', C('#ffffff'));
    setC('hair', C(d.hair));
    setC('thigh', C(d.trousers)); setC('shin', d.skirt ? skin : C(d.trousers));
    setC('boot', d.boot === 'skin' ? skin : C(d.boot));
    for (const h of ['tophat', 'straw', 'turban', 'wrap']) setC(h, C(d.hatC || '#222'));
    for (const k of PARTS) meshes[k].instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the rig
  const used = new Uint8Array(N);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const rz = (a) => new THREE.Matrix4().makeRotationZ(a);
  const rx = (a) => new THREE.Matrix4().makeRotationX(a);
  const ry = (a) => new THREE.Matrix4().makeRotationY(a);
  const mul = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);
  const sc = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);
  const handPos = [];

  /** pose: { x, y, z, yaw, scale, phase, walk, lean, twist, side (lean sideways), arms: [shL, elL, shR, elR, sprL, sprR],
   *  thigh, knee, headTilt, headTurn, mouth (0..1), fade, sit } */
  function set(i, s) {
    used[i] = 1;
    const d = dressOf[i] || {};
    const fade = s.fade ?? 0;
    for (const k of PARTS) for (let j = 0; j < PER[k]; j++) fades[k].array[i * PER[k] + j] = fade;
    const hide = (k) => { for (let j = 0; j < PER[k]; j++) meshes[k].setMatrixAt(i * PER[k] + j, zero); };
    if (fade >= 0.999) { for (const k of PARTS) hide(k); return; }
    const S = s.scale ?? 1;
    const ph = s.phase ?? 0, wk = s.walk ?? 0;
    const bob = -0.035 * wk * Math.abs(Math.cos(ph));
    const root = mul(mul(tr(s.x, s.y ?? 0, s.z), ry(s.yaw ?? 0)), sc(S, S, S));
    const pelvis = mul(root, tr(0, (s.sit ? 0.48 : 0.93) + bob + (s.hop ?? 0), 0));
    for (const side of [-1, 1]) {
      const j = side < 0 ? 0 : 1;
      const p = side < 0 ? ph : ph + Math.PI;
      const th = (s.sit ? 1.45 : 0) + (s.thigh ?? 0) + wk * 0.42 * Math.sin(p);
      const kn = (s.sit ? 1.5 : 0) + (s.knee ?? 0) + wk * (0.12 + 0.6 * Math.max(0, Math.cos(p)) ** 1.5);
      const hip = mul(mul(pelvis, tr(0, -0.02, side * 0.095)), rz(th));
      meshes.thigh.setMatrixAt(i * 2 + j, hip);
      const knee = mul(mul(hip, tr(0, -0.44, 0)), rz(-kn));
      meshes.shin.setMatrixAt(i * 2 + j, knee);
      meshes.boot.setMatrixAt(i * 2 + j, mul(knee, rz(s.sit ? 0 : 0)));
    }
    const lean = s.lean ?? 0;
    const torso = mul(mul(mul(pelvis, rz(-lean)), rx(s.side ?? 0)), ry(s.twist ?? 0));
    meshes.torso.setMatrixAt(i, torso);
    meshes.collar.setMatrixAt(i, d.collar ? torso : zero);
    if (d.tails && !d.skirt) meshes.tails.setMatrixAt(i, mul(pelvis, rz(s.sit ? 1.2 : -0.02 * wk * Math.sin(2 * ph)))); else hide('tails');
    if (d.skirt) meshes.skirt.setMatrixAt(i, mul(pelvis, rz(-lean * 0.2))); else hide('skirt');
    const headM = mul(mul(mul(torso, tr(0.0, 0.66, 0)), ry(s.headTurn ?? 0)), rz(s.headTilt ?? lean * 0.5));
    meshes.head.setMatrixAt(i, headM);
    meshes.hair.setMatrixAt(i, headM);
    const mo = s.mouth ?? 0.15;
    meshes.mouth.setMatrixAt(i, mul(mul(headM, tr(0.103, 0.105 - 0.008 * mo, 0)), sc(1, 0.4 + 2.6 * mo, 1)));
    for (const h of ['tophat', 'straw', 'turban', 'wrap']) meshes[h].setMatrixAt(i, d.hat === h && !s.noHat ? headM : zero);
    const a = s.arms || [0.12, 0.18, 0.12, 0.18, 0.05, 0.05];
    for (const side of [-1, 1]) {
      const o = side < 0 ? 0 : 2, j = side < 0 ? 0 : 1;
      const sh = mul(mul(mul(torso, tr(0, 0.55, side * 0.21)), rx(-side * (a[4 + j] ?? 0))), rz(a[o]));
      meshes.uarm.setMatrixAt(i * 2 + j, sh);
      const el = mul(mul(sh, tr(0, -0.3, 0)), rz(a[o + 1]));
      meshes.farm.setMatrixAt(i * 2 + j, el);
      meshes.hand.setMatrixAt(i * 2 + j, el);
      if (j === 1) handPos[i] = new THREE.Vector3(0, -0.34, 0).applyMatrix4(el);
    }
  }
  function begin() { used.fill(0); }
  function commit() {
    for (let i = 0; i < N; i++) if (!used[i]) for (const k of PARTS) for (let j = 0; j < PER[k]; j++) meshes[k].setMatrixAt(i * PER[k] + j, zero);
    for (const k of PARTS) { meshes[k].instanceMatrix.needsUpdate = true; fades[k].needsUpdate = true; }
  }
  return { group, set, dress, begin, commit, N, meshes, handPos };
}

// ---------------------------------------------------------------- poses
export const stand = (k = 0) => ({ arms: [0.08 + 0.03 * Math.sin(k), 0.2, 0.08, 0.22, 0.06, 0.06], lean: 0.02, headTilt: 0.02 });
/** Laughing: head back, shoulders shaking, a hand on the belly or slapping a knee, mouth open. */
export function laugh(t, k = 0, amt = 1) {
  const sh = Math.sin(t * 22 + k * 2.1) * 0.5 + 0.5, slow = Math.sin(t * 3.1 + k);
  const style = k % 3;
  const arms = style === 0 ? [0.5, 1.6, 0.5, 1.6, 0.15, 0.15]          // hands on the belly
    : style === 1 ? [-0.1, 0.3, 2.0 + 0.2 * sh, 0.5, 0.1, 0.25]          // pointing / waving
      : [0.6, 1.2, 0.15, 0.25, 0.1, 0.1];                                 // a hand to the mouth-ish
  const L = (a, b) => a + (b - a) * amt;
  const base = stand(k);
  return {
    arms: base.arms.map((v, i) => L(v, arms[i])),
    lean: L(0.02, -0.18 + 0.06 * sh + (style === 0 ? 0.35 * Math.max(0, slow) : 0)),
    headTilt: L(0.02, -0.35 + 0.1 * sh), mouth: L(0.12, 0.65 + 0.35 * sh), hop: amt * 0.012 * sh, side: amt * 0.05 * slow,
  };
}
export function amazed(t, k = 0, amt = 1) {
  const s = Math.sin(t * 2 + k) * 0.5 + 0.5;
  const base = stand(k);
  const arms = k % 2 ? [1.2 + 0.2 * s, 1.4, 1.2 + 0.2 * s, 1.4, 0.3, 0.3] : [0.4, 0.6, 2.4 + 0.15 * s, 0.4, 0.1, 0.2];
  return { arms: base.arms.map((v, i) => v + (arms[i] - v) * amt), lean: 0.02 - 0.1 * amt, headTilt: -0.1 * amt, mouth: 0.12 + 0.5 * amt };
}
export function walkPose(phase, amt = 1) {
  return { phase, walk: amt, arms: [0.1 + 0.3 * Math.sin(phase + Math.PI) * amt, 0.25, 0.1 + 0.3 * Math.sin(phase) * amt, 0.25, 0.05, 0.05], lean: 0.06 };
}
