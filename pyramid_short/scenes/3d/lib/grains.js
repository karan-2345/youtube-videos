// scenes/3d/lib/grains.js -- the macro world: a pile of quartz sand grains (irregular, faceted, amber to milky) and
// the water bridges that grow between neighbouring grains when the sand is damp (capillary bridges: a concave neck
// of water holding two grains together). Dry, the grains jostle loose; wet, the bridges lock them.
// Units: decimetres of picture (a grain ~0.1 across), the pile's top near y = 0.
import * as THREE from 'three';
import { mulberry, patch } from './common.js';

export function buildGrains(P, envMap, { n = 240, seed = 21 } = {}) {
  const rnd = mulberry(seed);
  const group = new THREE.Group();
  // ---- packing: drop grains one by one onto a pile (each rests on whatever it overlaps)
  const G = [];
  const X = 1.3, Z = 0.8;
  for (let i = 0; i < n * 6 && G.length < n; i++) {
    const r = 0.075 + 0.05 * rnd() ** 1.5;
    const x = (rnd() - 0.5) * 2 * X, z = (rnd() - 0.5) * 2 * Z;
    let y = -0.9 + r;
    for (const g of G) {
      const dx = x - g.x, dz = z - g.z, rr = (r + g.r) * 1.1, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) y = Math.max(y, g.y + Math.sqrt(rr * rr - d2));
    }
    if (y > 0.05) continue;
    G.push({ x, y, z, r, rot: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6), tone: rnd(), ph: rnd() * 6.28, loose: 0 });
  }
  // the top grains are loose (they roll and jiggle when dry)
  for (const g of G) g.loose = Math.max(0, Math.min(1, (g.y + 0.25) / 0.25));

  // ---- one grain shape (noise-deformed icosahedron), instanced
  const geo = new THREE.IcosahedronGeometry(1, 5);
  { const p = geo.attributes.position, r2 = mulberry(4);
    const lobes = Array.from({ length: 7 }, () => new THREE.Vector3(r2() - 0.5, r2() - 0.5, r2() - 0.5).normalize());
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      let k = 1;
      for (const l of lobes) k += 0.05 * Math.max(0, v.dot(l)) ** 3;
      k -= 0.06 * Math.max(0, Math.sin(v.x * 7.0 + v.y * 3.0));
      v.multiplyScalar(k); v.y *= 0.82;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals(); }
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0, envMap, envMapIntensity: 0.6 });
  patch(mat, {
    vHead: 'varying vec3 vO;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvO = position;' },
    fHead: 'varying vec3 vO;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      float f = vnoise3(vO * 4.0) * 0.6 + vnoise3(vO * 13.0) * 0.4;
      diffuseColor.rgb *= 0.78 + 0.35 * f;`,
      // a soft inner glow so the grains read as translucent quartz
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * 0.08 * (0.5 + 0.5 * vnoise3(vO * 3.0));` },
  });
  const grains = new THREE.InstancedMesh(geo, mat, G.length);
  grains.castShadow = true; grains.receiveShadow = true; grains.frustumCulled = false;
  const tones = ['#D9A35E', '#E3BC82', '#C4823F', '#DDB077', '#B8743A', '#E8C994'];
  G.forEach((g, i) => grains.setColorAt(i, new THREE.Color(tones[Math.floor(g.tone * tones.length)])));
  group.add(grains);

  // ---- bridges between neighbours (a concave neck of water)
  const pairs = [];
  for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
    const a = G[i], b = G[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    if (d < (a.r + b.r) * 1.22) pairs.push({ i, j, d, delay: rnd() });
  }
  const prof = [];
  for (let k = 0; k <= 20; k++) { const u = k / 20, w = 2 * u - 1; prof.push(new THREE.Vector2(0.28 + 0.72 * w * w, u - 0.5)); }
  const bgeo = new THREE.LatheGeometry(prof, 18);
  const wmat = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.water), roughness: 0.04, metalness: 0, transparent: true, opacity: 0.82, envMap, envMapIntensity: 1.4,
    emissive: new THREE.Color(P.water), emissiveIntensity: 0.9 });
  const bridges = new THREE.InstancedMesh(bgeo, wmat, pairs.length);
  bridges.frustumCulled = false;
  group.add(bridges);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const pos = G.map((g) => new THREE.Vector3(g.x, g.y, g.z));
  /** dry: 0..1 jostle (dry and disturbed); grow: 0..1 bridges; press: 0..1 the runner pressing (wet: the pile holds) */
  function set(t, { jostle = 0, grow = 0, squash = 0 } = {}) {
    G.forEach((g, i) => {
      const a = jostle * g.loose;
      const off = new THREE.Vector3(Math.sin(t * 11 + g.ph) * 0.012 * a + a * 0.05 * Math.sin(t * 0.9 + g.ph),
        Math.abs(Math.sin(t * 13 + g.ph * 2)) * 0.012 * a, Math.cos(t * 9 + g.ph) * 0.012 * a);
      pos[i].set(g.x, g.y * (1 - 0.03 * squash) - 0.006 * squash, g.z).add(off);
      q.setFromEuler(new THREE.Euler(g.rot.x + a * Math.sin(t * 3 + g.ph) * 0.5, g.rot.y, g.rot.z + a * t * 0.6));
      s.setScalar(g.r);
      m4.compose(pos[i], q, s);
      grains.setMatrixAt(i, m4);
    });
    grains.instanceMatrix.needsUpdate = true;
    pairs.forEach((p, k) => {
      const gk = Math.max(0, Math.min(1, (grow * 1.6 - p.delay * 0.6)));
      const a = pos[p.i], b = pos[p.j];
      v.subVectors(b, a);
      const d = v.length();
      const rn = Math.min(G[p.i].r, G[p.j].r) * 0.72 * Math.sqrt(gk);
      if (gk <= 0.001) { m4.makeScale(0, 0, 0); bridges.setMatrixAt(k, m4); return; }
      q.setFromUnitVectors(up, v.normalize());
      s.set(rn, d * 0.78, rn);
      m4.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, s);
      bridges.setMatrixAt(k, m4);
    });
    bridges.instanceMatrix.needsUpdate = true;
  }
  set(0);
  return { group, set, count: G.length, bridges: pairs.length };
}
