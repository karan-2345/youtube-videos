// scenes/3d/lib/molecule.js -- one real fat molecule, atom for atom, and what happens to every one of its atoms.
//
// The triglyceride C55H104O6 (glycerol + palmitic, oleic and stearic acid), as ball-and-stick. 78 O2 molecules fly in,
// the fat breaks apart, and the atoms regroup as 55 CO2 and 52 H2O -- the balanced equation, shown exactly. The fat's
// own atoms keep a golden glow, so you can see where they end up.
// Units: angstroms inside the group (the group is scaled to the scene).
import * as THREE from 'three';

const R = { C: 0.36, H: 0.23, O: 0.34 };

// ---------------------------------------------------------------- the molecule
export function triglyceride() {
  const atoms = [], bonds = [];
  const add = (el, p) => { atoms.push({ el, p: new THREE.Vector3(...p), fat: true }); return atoms.length - 1; };
  const bond = (a, b, order = 1) => bonds.push([a, b, order]);
  const xs = [-2.9, 0, 2.9];                               // three chains, side by side
  const Y = new THREE.Vector3(0, 1, 0);
  // glycerol backbone: CH2 - CH - CH2
  const g = xs.map((x, i) => add('C', [x, i === 1 ? 0.35 : 0, 0]));
  bond(g[0], g[1]); bond(g[1], g[2]);
  g.forEach((c, i) => {
    const p = atoms[c].p;
    const nh = i === 1 ? 1 : 2;
    for (let k = 0; k < nh; k++) {
      const dir = new THREE.Vector3(i === 0 ? -0.55 : i === 2 ? 0.55 : 0, 0.62, (nh === 1 ? 0 : k ? 1 : -1) * 0.75).normalize();
      bond(c, add('H', p.clone().addScaledVector(dir, 1.09).toArray()));
    }
  });
  const chains = [{ n: 16, kink: 0 }, { n: 18, kink: 9 }, { n: 18, kink: 0 }];   // palmitic, oleic (cis-9), stearic
  chains.forEach((ch, i) => {
    const top = atoms[g[i]].p;
    const oE = add('O', [top.x, top.y - 1.43, 0]);
    bond(g[i], oE);
    const c1 = add('C', [top.x + 0.35, top.y - 2.7, 0]);
    bond(oE, c1);
    const oC = add('O', [top.x + 1.4, top.y - 2.25, 0.35]);  // the carbonyl oxygen, sticking out
    bond(c1, oC, 2);
    // the zigzag: alternate along u, step down along the chain direction; a cis double bond bends it
    let dir = new THREE.Vector3(0, -1, 0), u = new THREE.Vector3(1, 0, 0);
    const w = new THREE.Vector3(0, 0, 1);
    let prev = c1, pos = atoms[c1].p.clone(), side = -1;
    for (let k = 2; k <= ch.n; k++) {
      const step = dir.clone().multiplyScalar(1.277).addScaledVector(u, 0.43 * side * 2 * (k === 2 ? 0.5 : 1));
      pos = pos.clone().add(step);
      const c = add('C', pos.toArray());
      const dbl = ch.kink && k === ch.kink + 1;
      bond(prev, c, dbl ? 2 : 1);
      // hydrogens: two per CH2 (one per CH at the double bond), three at the end
      const isDB = ch.kink && (k === ch.kink || k === ch.kink + 1);
      const out = u.clone().multiplyScalar(side);
      if (k === ch.n) {
        bond(c, add('H', pos.clone().addScaledVector(dir.clone().multiplyScalar(0.9).addScaledVector(out, 0.45).normalize(), 1.09).toArray()));
        for (const sw of [1, -1]) bond(c, add('H', pos.clone().addScaledVector(out.clone().multiplyScalar(0.35).addScaledVector(w, sw * 0.82).addScaledVector(dir, 0.3).normalize(), 1.09).toArray()));
      } else if (isDB) {
        bond(c, add('H', pos.clone().addScaledVector(out.clone().multiplyScalar(0.95).addScaledVector(w, 0.3).normalize(), 1.09).toArray()));
      } else {
        for (const sw of [1, -1]) bond(c, add('H', pos.clone().addScaledVector(out.clone().multiplyScalar(0.58).addScaledVector(w, sw * 0.81).normalize(), 1.09).toArray()));
      }
      if (ch.kink && k === ch.kink + 1) {                      // the cis kink: the chain turns about 30 degrees
        dir.applyAxisAngle(w, 0.55); u.applyAxisAngle(w, 0.55);
      }
      prev = c; side = -side;
    }
  });
  // centre it
  const c = new THREE.Vector3();
  atoms.forEach((a) => c.add(a.p)); c.multiplyScalar(1 / atoms.length);
  atoms.forEach((a) => a.p.sub(c));
  return { atoms, bonds };
}

// ---------------------------------------------------------------- the reaction, every atom accounted for
export function buildReaction(P, env, rnd, F) {
  const mol = triglyceride();
  const fatN = mol.atoms.length;
  const count = (el) => mol.atoms.filter((a) => a.el === el).length;
  if (count('C') !== F.fat.C || count('H') !== F.fat.H || count('O') !== F.fat.O)
    throw new Error(`molecule is C${count('C')}H${count('H')}O${count('O')}, expected C55H104O6`);
  const atoms = mol.atoms.map((a) => ({ ...a }));
  // the oxygen breathed in: 78 O2
  const o2 = [];
  for (let k = 0; k < F.o2; k++) {
    const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const far = d.clone().multiplyScalar(26 + rnd() * 14);
    const near = d.clone().multiplyScalar(13 + rnd() * 6).add(new THREE.Vector3(0, 0, 0));
    const ax = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const i0 = atoms.length;
    atoms.push({ el: 'O', fat: false, far, near, ax, o2: k, s: 0 }, { el: 'O', fat: false, far, near, ax, o2: k, s: 1 });
    o2.push([i0, i0 + 1, 2]);
  }
  // products: 55 CO2 and 52 H2O, each with a home in the cloud
  const idx = { C: [], H: [], Ofat: [], Oair: [] };
  atoms.forEach((a, i) => { if (a.el === 'C') idx.C.push(i); else if (a.el === 'H') idx.H.push(i); else (a.fat ? idx.Ofat : idx.Oair).push(i); });
  const oPool = [...idx.Ofat.slice(0, 4), ...idx.Oair];          // 4 of the fat's 6 oxygens end in CO2, 2 in water [M]
  const oWater = [...idx.Ofat.slice(4)];
  const co2 = [], h2o = [];
  const home = (yc, spread) => new THREE.Vector3((rnd() - 0.5) * 2 * spread, yc + (rnd() - 0.5) * spread * 1.4, (rnd() - 0.5) * 2 * spread * 0.7);
  for (let k = 0; k < F.co2; k++) {
    const c = idx.C[k], oa = oPool[2 * k], ob = oPool[2 * k + 1];
    const h = home(4, 11), ax = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    co2.push({ c, oa, ob, h, ax, spin: (rnd() - 0.5) * 2 });
  }
  const oLeft = oPool.slice(2 * F.co2).concat(oWater);
  for (let k = 0; k < F.h2o; k++) {
    const o = oLeft[k], ha = idx.H[2 * k], hb = idx.H[2 * k + 1];
    const h = home(-6, 10), ax = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    h2o.push({ o, ha, hb, h, ax, spin: (rnd() - 0.5) * 2 });
  }
  if (oLeft.length !== F.h2o) throw new Error(`oxygen does not balance: ${oLeft.length} left for ${F.h2o} waters`);
  // burst directions
  atoms.forEach((a) => { a.v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(3 + rnd() * 7); a.ph = rnd() * 6.28; a.jt = rnd(); });

  // ---- meshes
  const N = atoms.length;
  const group = new THREE.Group();
  const sph = new THREE.SphereGeometry(1, 28, 18);
  const aMat = new THREE.MeshPhysicalMaterial({ roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
    envMap: env, envMapIntensity: 0.65 });
  const aU = { uGold: { value: new THREE.Color(P.fat_glow) } };
  aMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, aU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aGlow;\nvarying vec2 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGlow; uniform vec3 uGold;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rimG = pow(1. - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.);
        totalEmissiveRadiance += uGold * vGlow.x * (0.25 + 1.6 * rimG) + vColor.rgb * vGlow.y * 1.4;`);
  };
  aMat.vertexColors = false;
  const atomMesh = new THREE.InstancedMesh(sph, aMat, N);
  atomMesh.frustumCulled = false;
  const glow = new Float32Array(N * 2);
  const glowAttr = new THREE.InstancedBufferAttribute(glow, 2);
  sph.setAttribute('aGlow', glowAttr);
  const col = { C: new THREE.Color(P.carbon), H: new THREE.Color(P.hydrogen), O: new THREE.Color(P.oxygen) };
  atoms.forEach((a, i) => atomMesh.setColorAt(i, col[a.el]));
  group.add(atomMesh);

  // bonds: two half-sticks per bond, each in its atom's colour
  const allBonds = [
    ...mol.bonds.map((b) => ({ a: b[0], b: b[1], o: b[2], set: 'fat' })),
    ...o2.map((b) => ({ a: b[0], b: b[1], o: 2, set: 'o2' })),
    ...co2.flatMap((m) => [{ a: m.c, b: m.oa, o: 2, set: 'co2' }, { a: m.c, b: m.ob, o: 2, set: 'co2' }]),
    ...h2o.flatMap((m) => [{ a: m.o, b: m.ha, o: 1, set: 'h2o' }, { a: m.o, b: m.hb, o: 1, set: 'h2o' }]),
  ];
  const NB = allBonds.reduce((s, b) => s + 2 * b.o, 0);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
  const bMat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.6, envMap: env, envMapIntensity: 0.8 });
  const bondMesh = new THREE.InstancedMesh(cyl, bMat, NB);
  bondMesh.frustumCulled = false;
  let bi = 0;
  for (const b of allBonds) for (let k = 0; k < 2 * b.o; k++) {
    bondMesh.setColorAt(bi++, col[atoms[k % 2 ? b.b : b.a].el]);
  }
  group.add(bondMesh);

  // ---- choreography
  const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = Array.from({ length: N }, () => new THREE.Vector3());
  const cl = (x) => Math.min(1, Math.max(0, x));
  const sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
  const eo = (x) => 1 - Math.pow(1 - cl(x), 3);
  const molRot = new THREE.Quaternion(), qA = new THREE.Quaternion();
  const homeCO2 = new Map(), homeH2O = new Map();
  co2.forEach((m) => { homeCO2.set(m.c, [m, 0]); homeCO2.set(m.oa, [m, -1]); homeCO2.set(m.ob, [m, 1]); });
  h2o.forEach((m) => { homeH2O.set(m.o, [m, 0]); homeH2O.set(m.ha, [m, -1]); homeH2O.set(m.hb, [m, 1]); });

  /** K = { t, spin, hl: {C,H,O} highlight 0..1, o2In 0..1, burst 0..1, mix 0..1, co2Form 0..1, h2oForm 0..1,
   *        rise 0..1 (CO2 floats up), fall 0..1 (water sinks), fatGlow 0..1 } */
  function update(K) {
    const t = K.t;
    molRot.setFromAxisAngle(up, K.spin);
    for (let i = 0; i < N; i++) {
      const a = atoms[i], p = pos[i];
      // where it is in its first life
      if (a.fat) p.copy(a.p).applyQuaternion(molRot);
      else {
        const k = eo(K.o2In * (1.1 - 0.2 * a.jt));
        p.copy(a.far).lerp(a.near, k);
        qA.setFromAxisAngle(a.ax, t * 1.3 + a.jt * 6);
        V.set(a.s ? 0.6 : -0.6, 0, 0).applyQuaternion(qA);
        p.add(V);
        // after the burst, the oxygen streams into the cloud
        const m = sm((K.mix - a.jt * 0.3) / 0.7);
        if (m > 0) {
          V.copy(a.near).multiplyScalar(0.45);
          p.lerp(V.add(new THREE.Vector3(Math.sin(t + a.ph), Math.cos(t * 0.8 + a.ph), 0).multiplyScalar(1.2)), m);
          qA.setFromAxisAngle(a.ax, t * 1.3 + a.jt * 6);
          p.add(V.set(a.s ? 0.6 : -0.6, 0, 0).applyQuaternion(qA).multiplyScalar(0));
        }
      }
      // the burst: the fat flies apart
      if (a.fat && K.burst > 0) {
        const b = eo(K.burst);
        p.addScaledVector(a.v, b);
        p.x += Math.sin(t * 0.9 + a.ph) * 0.6 * b; p.y += Math.cos(t * 0.7 + a.ph) * 0.6 * b;
      }
      // the new molecules
      const hc = homeCO2.get(i), hw = homeH2O.get(i);
      const form = hc ? K.co2Form : hw ? K.h2oForm : 0;
      if (form > 0) {
        const [m, slot] = hc || hw;
        const f = sm((form - (m.spin + 1) * 0.12) / 0.75);
        qA.setFromAxisAngle(m.ax, (t * 0.6 + m.spin * 3));
        if (hc) V.set(slot * 1.16, 0, 0).applyQuaternion(qA);
        else V.set(slot * 0.76, slot === 0 ? 0 : -0.59, 0).applyQuaternion(qA);
        const hm = m.h.clone();
        if (hc) hm.y += K.rise * 34 + Math.sin(t * 0.7 + m.spin * 5) * 0.4;
        else hm.y -= K.fall * 22;
        p.lerp(hm.add(V), f);
      }
      // glow: fat atoms gold; highlighted elements light up in their own colour
      const hl = K.hl || {};
      glow[i * 2] = a.fat ? (K.fatGlow ?? 0) : 0;
      glow[i * 2 + 1] = (hl[a.el] || 0) * 0.6;
      const dim = 1 - 0.55 * Math.max(0, (hl.any || 0) - (hl[a.el] || 0));
      const show = a.fat ? 1 : sm(K.o2In * 4);                 // the breathed-in oxygen arrives from nothing
      const r = R[a.el] * dim * (1 + 0.25 * (hl[a.el] || 0)) * (K.scale ?? 1) * show;
      M.compose(p, Qn.identity(), S.set(r, r, r));
      atomMesh.setMatrixAt(i, M);
    }
    atomMesh.instanceMatrix.needsUpdate = true;
    glowAttr.needsUpdate = true;
    // bonds
    const w = { fat: 1 - sm(K.burst * 3), o2: (1 - sm((K.co2Form - 0.0) * 4)) * sm(K.o2In * 3), co2: sm((K.co2Form - 0.55) / 0.4), h2o: sm((K.h2oForm - 0.55) / 0.4) };
    let j = 0;
    for (const b of allBonds) {
      const pa = pos[b.a], pb = pos[b.b];
      const len = pa.distanceTo(pb);
      const vis = w[b.set] * (len < 3.2 ? 1 : 0);
      const dir = V.subVectors(pb, pa).normalize();
      Qn.setFromUnitVectors(up, dir);
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(Qn).multiplyScalar(0.14);
      for (let k = 0; k < 2 * b.o; k++) {
        const half = k % 2, lane = b.o === 2 ? (k < 2 ? -1 : 1) : 0;
        const r = (b.o === 2 ? 0.07 : 0.1) * vis * (K.scale ?? 1);
        const mid = new THREE.Vector3().lerpVectors(pa, pb, half ? 0.75 : 0.25).addScaledVector(side, lane);
        M.compose(mid, Qn, S.set(r, len * 0.5, r));
        bondMesh.setMatrixAt(j++, M);
      }
    }
    bondMesh.instanceMatrix.needsUpdate = true;
  }
  /** a representative atom of an element, in world space (for the label leaders) */
  function find(el) {
    const i = atoms.findIndex((a, k) => a.el === el && a.fat && (el !== 'C' || k > 8) && (el !== 'H' || k > 20));
    return pos[i].clone().applyMatrix4(group.matrixWorld);
  }
  return { group, update, atoms, co2, h2o, pos, find, N, NB };
}
