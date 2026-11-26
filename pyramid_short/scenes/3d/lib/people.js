// scenes/3d/lib/people.js -- the builders. A posable figure (white linen kilt, bare torso, short dark hair or a
// head cloth) for the close-ups -- hauling on a rope, pouring water, rowing, walking, standing -- and an instanced
// crowd of tiny figures for the wide shots. Every pose is a pure function of a phase, so it renders the same every time.
import * as THREE from 'three';
import { mergeGeos } from './land.js';

const cap = (r, l, s = 8) => new THREE.CapsuleGeometry(r, l, 3, s);

export function figureMaterials(P) {
  const skins = ['#7A4B2E', '#8A5A3A', '#9A6844', '#6E4128', '#A47450'].map((c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.62 }));
  const linen = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.linen), roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: new THREE.Color('#1D1612'), roughness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color('#E9DFC8'), roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.gold), roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(P.gold), emissiveIntensity: 0 });
  return { skins, linen, hair, cloth, gold };
}

/** One figure: returns { root, set(pose) }. Origin at the feet, facing +z. */
export function buildFigure(M, seed = 0, { headCloth = false, hero = false } = {}) {
  const skin = M.skins[seed % M.skins.length];
  const root = new THREE.Group();
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  const s = 0.95 + 0.1 * ((seed * 7919) % 13) / 13;
  root.scale.setScalar(s);
  const limb = (r0, r1, L) => { const g = new THREE.CylinderGeometry(r0, r1, L, 10); g.translate(0, -L / 2, 0); return g; };
  const ball = (r) => new THREE.SphereGeometry(r, 10, 8);
  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  // kilt: a wrapped linen skirt, flared, with a front flap
  const kiltMat = hero ? M.gold : M.linen;
  const kilt = mesh(new THREE.CylinderGeometry(0.158, 0.215, 0.36, 16, 1, true), kiltMat); kilt.position.y = -0.14; hips.add(kilt);
  const flap = mesh(new THREE.BoxGeometry(0.16, 0.3, 0.012), kiltMat); flap.position.set(0.03, -0.15, 0.19); flap.rotation.set(-0.12, 0, 0.1); hips.add(flap);
  const belt = mesh(new THREE.TorusGeometry(0.158, 0.02, 6, 18), M.linen); belt.rotation.x = Math.PI / 2; belt.position.y = 0.035; hips.add(belt);
  const pelvis = mesh(ball(0.15), skin); pelvis.scale.set(1.05, 0.7, 0.75); pelvis.position.y = 0.02; hips.add(pelvis);
  const spine = new THREE.Group(); spine.position.y = 0.05; hips.add(spine);
  // torso: a lathed profile from the waist to the shoulders, flattened front to back
  const prof = [[0.0, 0.0], [0.135, 0.0], [0.13, 0.1], [0.145, 0.2], [0.168, 0.31], [0.178, 0.39], [0.165, 0.44], [0.12, 0.48], [0.055, 0.5], [0.0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = mesh(new THREE.LatheGeometry(prof, 18), skin); torso.scale.set(1.08, 1, 0.66); spine.add(torso);
  const chest = mesh(ball(0.11), skin); chest.scale.set(1.5, 0.75, 0.75); chest.position.set(0, 0.33, 0.035); spine.add(chest);
  const neck = new THREE.Group(); neck.position.y = 0.5; spine.add(neck);
  const nk = mesh(limb(0.048, 0.055, 0.1), skin); nk.rotation.x = Math.PI; nk.position.y = -0.0; neck.add(nk);
  const head = mesh(ball(0.098), skin); head.scale.set(0.86, 1.04, 0.98); head.position.set(0, 0.155, 0.012); neck.add(head);
  const jaw = mesh(ball(0.07), skin); jaw.scale.set(0.95, 0.8, 0.95); jaw.position.set(0, 0.105, 0.035); neck.add(jaw);
  const nose = mesh(new THREE.ConeGeometry(0.018, 0.045, 6), skin); nose.rotation.x = Math.PI / 2 + 0.25; nose.position.set(0, 0.145, 0.1); neck.add(nose);
  for (const sx of [-1, 1]) { const ear = mesh(ball(0.022), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(sx * 0.085, 0.15, 0.0); neck.add(ear); }
  const cap = mesh(new THREE.SphereGeometry(0.104, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), headCloth ? M.cloth : M.hair);
  cap.scale.set(0.9, 1.0, 1.0); cap.position.set(0, 0.165, -0.004); cap.rotation.x = -0.32; neck.add(cap);
  if (headCloth) { const tail = mesh(new THREE.ConeGeometry(0.09, 0.16, 10, 1, true), M.cloth); tail.position.set(0, 0.11, -0.07); tail.rotation.x = 0.35; neck.add(tail); }
  const arms = [], legs = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.19, 0.42, 0); spine.add(sh);
    const delt = mesh(ball(0.062), skin); delt.scale.set(1, 0.9, 0.95); sh.add(delt);
    const up = mesh(limb(0.054, 0.042, 0.29), skin); sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    el.add(mesh(ball(0.042), skin));
    const fo = mesh(limb(0.044, 0.032, 0.25), skin); el.add(fo);
    const hand = mesh(ball(0.042), skin); hand.scale.set(0.75, 1.15, 0.55); hand.position.y = -0.29; el.add(hand);
    arms.push({ sh, el, hand });
    const hp = new THREE.Group(); hp.position.set(sx * 0.088, -0.02, 0); hips.add(hp);
    const th = mesh(limb(0.082, 0.056, 0.43), skin); hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.43; hp.add(kn);
    kn.add(mesh(ball(0.056), skin));
    const sh2 = mesh(limb(0.056, 0.036, 0.42), skin); kn.add(sh2);
    const ft = new THREE.Group(); ft.position.y = -0.43; kn.add(ft);
    const foot = mesh(new THREE.BoxGeometry(0.085, 0.045, 0.23), skin); foot.position.set(0, -0.012, 0.055); ft.add(foot);
    legs.push({ hp, kn, ft });
  }
  const F = { root, hips, spine, neck, arms, legs, kilt, scale: s };
  /** pose: { walk: phase (radians), stride, lean (rad), mode: 'haul'|'pour'|'row'|'stand'|'walk'|'point', k: mode amount } */
  F.set = (o = {}) => {
    const ph = o.walk ?? 0, st = o.stride ?? 0, lean = o.lean ?? 0, mode = o.mode || 'stand';
    // legs: a walk cycle; the pushing leg straight, the swinging leg bent
    legs.forEach((L, i) => {
      const p = ph + (i ? Math.PI : 0);
      const sw = Math.sin(p);
      L.hp.rotation.x = -sw * 0.55 * st - lean * 0.5;
      L.kn.rotation.x = Math.max(0, Math.cos(p)) * 0.9 * st + (lean > 0.2 ? 0.15 : 0);
      L.ft.rotation.x = -L.hp.rotation.x * 0.4 - L.kn.rotation.x * 0.3;
    });
    hips.position.y = 0.92 - Math.abs(Math.cos(ph)) * 0.03 * st - lean * 0.12;
    hips.position.z = lean * 0.1;
    spine.rotation.x = lean;
    spine.rotation.y = Math.sin(ph) * 0.08 * st;
    neck.rotation.x = -lean * 0.6 + (o.look ?? 0);
    const [aL, aR] = arms;
    if (mode === 'haul') {
      // both hands on the rope in front of the chest, the rope over the shoulder
      for (const [a, sx] of [[aL, -1], [aR, 1]]) {
        a.sh.rotation.set(-1.05 - 0.12 * Math.sin(ph + (sx > 0 ? 0.6 : 0)), 0, sx * 0.08);
        a.el.rotation.set(-1.15, 0, 0);
      }
    } else if (mode === 'pour') {
      const k = o.k ?? 1;
      aL.sh.rotation.set(-1.4 * k, 0, -0.15); aL.el.rotation.set(-0.5 * k, 0, 0);
      aR.sh.rotation.set(-1.0 * k, 0, 0.3); aR.el.rotation.set(-1.2 * k, 0, 0);
    } else if (mode === 'row') {
      const r = Math.sin(ph);
      for (const [a, sx] of [[aL, -1], [aR, 1]]) { a.sh.rotation.set(-0.9 - 0.6 * r, 0, sx * 0.15); a.el.rotation.set(-0.6 + 0.4 * r, 0, 0); }
    } else if (mode === 'point') {
      aR.sh.rotation.set(-1.5, 0, 0.25); aR.el.rotation.set(-0.15, 0, 0);
      aL.sh.rotation.set(0.1, 0, -0.12); aL.el.rotation.set(-0.3, 0, 0);
    } else {
      // walk / stand: arms swing opposite the legs
      const sw = Math.sin(ph) * 0.45 * st;
      aL.sh.rotation.set(sw, 0, -0.1); aL.el.rotation.set(-0.25 - 0.2 * st, 0, 0);
      aR.sh.rotation.set(-sw, 0, 0.1); aR.el.rotation.set(-0.25 - 0.2 * st, 0, 0);
    }
  };
  F.set();
  return F;
}

/** A tiny figure (one merged mesh, vertex colours) for crowds: kilt, body, head. Facing +z, feet at 0. */
function crowdGeometry() {
  const parts = [];
  const add = (g, c) => {
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  const skin = [0.5, 0.3, 0.19], lin = [0.93, 0.9, 0.82], hair = [0.1, 0.08, 0.07];
  let g = new THREE.CylinderGeometry(0.17, 0.23, 0.42, 7); g.translate(0, 0.74, 0); add(g, lin);
  g = new THREE.CapsuleGeometry(0.15, 0.32, 2, 7); g.scale(1.05, 1, 0.7); g.translate(0, 1.22, 0); add(g, skin);
  g = new THREE.SphereGeometry(0.11, 8, 6); g.translate(0, 1.6, 0); add(g, skin);
  g = new THREE.SphereGeometry(0.115, 8, 4, 0, Math.PI * 2, 0, 1.6); g.translate(0, 1.62, -0.01); add(g, hair);
  for (const sx of [-1, 1]) {
    g = new THREE.CapsuleGeometry(0.06, 0.5, 2, 5); g.translate(sx * 0.09, 0.3, 0); add(g, skin);
    g = new THREE.CapsuleGeometry(0.045, 0.5, 2, 5); g.rotateX(-0.9); g.translate(sx * 0.2, 1.3, 0.2); add(g, skin);
  }
  const out = mergeGeos(parts);
  // merge colours too
  const cols = new Float32Array(out.attributes.position.count * 3);
  let o = 0; for (const p of parts) { cols.set(p.attributes.color.array, o); o += p.attributes.color.array.length; }
  out.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return out;
}

export class Crowd {
  constructor(n) {
    this.mesh = new THREE.InstancedMesh(crowdGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), n);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.n = n; this.used = 0;
    this.M = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3();
  }
  begin() { this.used = 0; }
  /** Place one figure at (x, y, z) facing yaw, with a walking bob of phase ph, scale k (0 hides it), lean. */
  put(x, y, z, yaw, ph = 0, k = 1, lean = 0) {
    if (this.used >= this.n || k <= 0.001) return;
    this.e.set(lean, yaw, 0);
    this.q.setFromEuler(this.e);
    this.M.compose(this.p.set(x, y + Math.abs(Math.sin(ph)) * 0.06, z), this.q, this.s.setScalar(k));
    this.mesh.setMatrixAt(this.used++, this.M);
  }
  end() {
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = this.used; i < this.n; i++) this.mesh.setMatrixAt(i, z);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
