// scenes/3d/lib/sets.js -- the two small sets away from the lagoon.
//   buildFence()  a garden fence in the open air (at FENCE_AT): three posts and two rails on a lawn; the middle post
//                 rots: white fungal threads climb from the ground line, mushrooms and brackets grow, the wood darkens
//                 and softens, and it breaks at the ground and falls. uniforms: uMyc, uRot, uFung.
//   buildCells()  inside a post, a microscope's view (at CELLS_AT): the wood's cells as a bundle of hollow tubes seen
//                 end-on; rod-shaped bacteria nibble the walls (uEat), water fills the emptied cells (uFill).
//   buildO2(N)    oxygen molecules (two fused spheres), posed from JS.
import * as THREE from 'three';
import { NOISE, patch, mulberry, tint } from './common.js';
import { mergeGeos } from './figures.js';

export const FENCE_AT = new THREE.Vector3(0, 0, 240);
export const CELLS_AT = new THREE.Vector3(0, -400, 0);

export function buildFence() {
  const g = new THREE.Group(); g.position.copy(FENCE_AT);
  const uni = { uMyc: { value: 0 }, uRot: { value: 0 }, uFung: { value: 0 }, uT: { value: 0 } };
  // lawn and soil
  const lawnG = new THREE.CircleGeometry(16, 96, 0, Math.PI * 2); lawnG.rotateX(-Math.PI / 2);
  const lawn = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  patch(lawn, {
    vHead: 'varying vec3 vL;', vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' },
    fHead: 'varying vec3 vL;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      vec2 p = vL.xz;
      float n = fbm(p * 0.6), f = vnoise(p * 9.0), ff = vnoise(p * 40.0);
      vec3 c = mix(vec3(0.20, 0.36, 0.10), vec3(0.42, 0.55, 0.18), n) * (0.75 + 0.3 * f) * (0.85 + 0.25 * ff);
      float bare = smoothstep(0.55, 0.15, length(p - vec2(0., 0.)));                 // trodden soil round the post
      c = mix(c, vec3(0.30, 0.22, 0.14) * (0.8 + 0.3 * f), bare);
      c *= 1. - 0.5 * smoothstep(9.0, 16.0, length(p));
      diffuseColor.rgb *= c;` },
  });
  const lawnM = new THREE.Mesh(lawnG, lawn); lawnM.receiveShadow = true; g.add(lawnM);
  // grass tufts
  { const blade = new THREE.ConeGeometry(0.008, 0.11, 3); blade.translate(0, 0.055, 0);
    const r = mulberry(4), N = 9000; const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5C7F2C'), roughness: 0.9 });
    const im = new THREE.InstancedMesh(blade, m, N); const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), E = new THREE.Euler();
    for (let i = 0; i < N; i++) { const a = r() * 6.28, d = 0.35 + Math.sqrt(r()) * 7; E.set((r() - 0.5) * 0.6, r() * 6, (r() - 0.5) * 0.6); Q.setFromEuler(E); S.set(1, 0.6 + r() * 1.2, 1); M.compose(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d), Q, S); im.setMatrixAt(i, M); }
    im.castShadow = false; im.receiveShadow = true; g.add(im); }
  // a hedge behind
  { const hg = new THREE.BoxGeometry(18, 1.9, 1.4, 60, 8, 6); const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.18 * Math.sin(x * 2.1 + y * 3.3) + 0.12 * Math.sin(x * 5.3 - z * 4.1 + y); p.setXYZ(i, x, y + (y > 0 ? k : 0), z + (z !== 0 ? Math.sign(z) * k : 0)); }
    hg.computeVertexNormals(); hg.translate(0, 0.95, -5.5);
    const hm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2F4A1E'), roughness: 0.95 });
    patch(hm, { vHead: 'varying vec3 vL;', vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' }, fHead: 'varying vec3 vL;',
      frag: { '#include <color_fragment>': '#include <color_fragment>\n diffuseColor.rgb *= 0.6 + 0.7 * vnoise3(vL * 6.0) * (0.7 + 0.5 * vnoise3(vL * 1.5));' } });
    const h = new THREE.Mesh(hg, hm); h.castShadow = true; h.receiveShadow = true; g.add(h); }
  // posts and rails
  const wood = (rotting) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    patch(m, {
      uniforms: uni,
      vHead: `varying vec3 vL; uniform float uRot; ${NOISE}`,
      vert: { '#include <begin_vertex>': `#include <begin_vertex>
        vL = position;
        ${rotting ? `{ float band = 1. - smoothstep(0.0, 0.55, abs(position.y - 0.12));
          float n = vnoise3(position * vec3(9., 4., 9.));
          transformed.xz *= 1. - uRot * band * (0.25 + 0.55 * n); }` : ''}` },
      fHead: `varying vec3 vL; uniform float uRot, uMyc, uT;`,
      frag: { '#include <color_fragment>': `#include <color_fragment>
        vec3 p = vL;
        float grain = 0.5 + 0.5 * sin((p.x + p.z) * 60.0 + vnoise(p.xy * vec2(6., 1.5)) * 5.0);
        vec3 c = mix(vec3(0.45, 0.33, 0.21), vec3(0.62, 0.48, 0.32), grain) * (0.85 + 0.2 * vnoise3(p * 3.0));
        c = mix(c, vec3(0.52, 0.5, 0.46), 0.35);                               // weathered grey
        ${rotting ? `
        float low = 1. - smoothstep(-0.1, 1.1 * uRot + 0.3, p.y);
        c = mix(c, vec3(0.17, 0.11, 0.07) * (0.8 + 0.4 * vnoise3(p * 12.)), clamp(uRot * 1.3, 0., 1.) * low);
        // white fungal threads climbing from the ground line
        float reach = -0.2 + uMyc * 1.1;
        float th = vnoise3(p * vec3(30., 6., 30.)) * 0.6 + vnoise3(p * 70.) * 0.4;
        float myc = smoothstep(0.62, 0.72, th) * (1. - smoothstep(reach - 0.25, reach, p.y));
        c = mix(c, vec3(0.93, 0.92, 0.86), myc * 0.9);
        // cracks
        float cr = smoothstep(0.03, 0.0, abs(vnoise(vec2(p.y * 3.0, (p.x - p.z) * 8.)) - 0.5)) * uRot * low;
        c *= 1. - 0.7 * cr;` : ''}
        diffuseColor.rgb *= c;` },
    });
    return m;
  };
  const postG = () => { const b = new THREE.BoxGeometry(0.17, 1.75, 0.17, 4, 40, 4); b.translate(0, 0.875 - 0.45, 0); const cap = new THREE.ConeGeometry(0.125, 0.1, 4); cap.rotateY(Math.PI / 4); cap.translate(0, 1.35, 0); return mergeGeos([tint(b, '#ffffff'), tint(cap, '#ffffff')]); };
  const side = wood(false), mid = wood(true);
  for (const x of [-2.3, 2.3]) { const m = new THREE.Mesh(postG(), side); m.position.set(x, 0, 0); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  const midPivot = new THREE.Group(); g.add(midPivot);
  const midPost = new THREE.Mesh(postG(), mid); midPost.castShadow = true; midPost.receiveShadow = true; midPivot.add(midPost);
  const rails = new THREE.Group(); g.add(rails);
  for (const y of [0.45, 1.05]) for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.05), side); r.position.set(s * 1.15, y, 0.11); r.castShadow = true;
    r.userData.base = r.position.clone(); r.userData.side = s; rails.add(r);
  }
  // fungi: mushrooms at the foot, brackets up the post (instanced, scaled by uFung with per-instance delays)
  const cap = new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.6, 1); cap.translate(0, 0.07, 0);
  const gill = new THREE.CircleGeometry(0.06, 12); gill.rotateX(Math.PI / 2); gill.translate(0, 0.07, 0);
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.07, 6); stem.translate(0, 0.035, 0);
  const mush = mergeGeos([tint(cap, '#B98552'), tint(gill, '#EDE3CF'), tint(stem, '#E6DCC6')]);
  const brack = new THREE.SphereGeometry(0.08, 12, 6, -Math.PI / 2, Math.PI, 0, Math.PI / 2); brack.scale(1, 0.32, 0.9);
  const brk = mergeGeos([tint(brack, '#A87A4A')]);
  const fungMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7 });
  const r = mulberry(17);
  const mushSpots = [], brSpots = [];
  for (let i = 0; i < 16; i++) { const a = r() * 6.28, d = 0.14 + r() * 0.3; mushSpots.push([Math.cos(a) * d, 0, Math.sin(a) * d, 0.7 + r() * 1.0, r()]); }
  for (let i = 0; i < 9; i++) { const f = Math.floor(r() * 4); const y = 0.08 + r() * 0.75; const off = [[0.09, 0, 0], [0, 0, 0.09], [-0.09, 0, 0], [0, 0, -0.09]][f]; brSpots.push([off[0], y, off[2], 0.7 + r() * 0.8, r(), f]); }
  const mushIM = new THREE.InstancedMesh(mush, fungMat, mushSpots.length), brIM = new THREE.InstancedMesh(brk, fungMat, brSpots.length);
  mushIM.castShadow = true; brIM.castShadow = true; g.add(mushIM); midPivot.add(brIM);
  function setFungi(f, fall) {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3();
    mushSpots.forEach(([x, y, z, s, d], i) => { const k = Math.min(1, Math.max(0, f * 1.6 - d * 0.6)); S.setScalar(s * k * k * (3 - 2 * k) + 1e-4); Q.identity(); M.compose(new THREE.Vector3(x, y, z), Q, S); mushIM.setMatrixAt(i, M); });
    brSpots.forEach(([x, y, z, s, d, fc], i) => { const k = Math.min(1, Math.max(0, f * 1.6 - d * 0.6)); S.setScalar(s * k + 1e-4); Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -fc * Math.PI / 2); M.compose(new THREE.Vector3(x, y, z), Q, S); brIM.setMatrixAt(i, M); });
    mushIM.instanceMatrix.needsUpdate = true; brIM.instanceMatrix.needsUpdate = true;
  }
  /** fall 0..1: the post snaps at the ground line and topples toward +z (the camera side), the rails drop. */
  function pose(rot, fall) {
    midPivot.position.set(0, 0.12, 0); midPost.position.set(0, -0.12, 0);
    const k = fall * fall;
    midPivot.rotation.set(1.35 * k, 0, 0.12 * k);
    midPivot.position.y = 0.12 - 0.05 * k;
    for (const rl of rails.children) {
      const s = rl.userData.side;
      rl.rotation.z = -s * 0.5 * k; rl.position.copy(rl.userData.base); rl.position.y -= 0.35 * k * (rl.userData.base.y / 1.05); rl.position.x -= s * 0.1 * k;
    }
  }
  return { group: g, uni, setFungi, pose, midPivot };
}

export function buildO2(N, seed = 31) {
  const a = new THREE.SphereGeometry(0.035, 12, 8); a.translate(-0.024, 0, 0);
  const b = new THREE.SphereGeometry(0.035, 12, 8); b.translate(0.024, 0, 0);
  const g = mergeGeos([tint(a, '#ffffff'), tint(b, '#ffffff')]);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); fade.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aA', fade);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8FD2FF'), emissive: new THREE.Color('#5FB8FF'), emissiveIntensity: 0.9, roughness: 0.3, transparent: true });
  patch(m, {
    vHead: 'attribute float aA; varying float vA;', vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvA = aA;' },
    fHead: 'varying float vA;', frag: { '#include <color_fragment>': '#include <color_fragment>\n diffuseColor.a *= vA; if (vA < 0.01) discard;' },
  });
  const im = new THREE.InstancedMesh(g, m, N);
  im.frustumCulled = false; im.renderOrder = 8;
  const r = mulberry(seed);
  const seeds = Array.from({ length: N }, () => [r(), r(), r(), r(), r()]);
  return { mesh: im, fade, seeds };
}

// ------------------------------------------------------------------ the cells
export function buildCells() {
  const g = new THREE.Group(); g.position.copy(CELLS_AT);
  const uni = { uEat: { value: 0 }, uFill: { value: 0 }, uT: { value: 0 }, uFogC: { value: new THREE.Color('#0E2A2C') } };
  const r = mulberry(77);
  const cells = [];
  const RC = 0.5, LEN = 16;
  for (let j = -9; j <= 9; j++) for (let i = -9; i <= 9; i++) {
    // softwood: radial rows of squarish cells, earlywood big, latewood small and thick
    const ring = (i + 40) % 7, late = ring >= 5;
    const sx = 1.02, sy = late ? 0.72 : 1.0;
    const x = i * sx + (j % 2 ? 0.0 : 0.0) + (r() - 0.5) * 0.05, y = j * 1.0 + (late ? 0 : 0) + (r() - 0.5) * 0.05;
    cells.push({ x, y, sy, late, eat: r(), fill: r(), bug: r() < 0.32 });
  }
  const N = cells.length;
  const wall = new THREE.CylinderGeometry(RC, RC, LEN, 6, 24, true); wall.rotateX(Math.PI / 2); wall.translate(0, 0, -LEN / 2); wall.rotateZ(Math.PI / 6);
  const aEat = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  const aFill = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  wall.setAttribute('aEat', aEat);
  const wm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#E8D2A8'), roughness: 0.55, side: THREE.DoubleSide });
  patch(wm, {
    uniforms: uni,
    vHead: 'attribute float aEat; varying float vEat; varying vec3 vL; varying vec3 vVW;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvEat = aEat; vL = position; vVW = (modelMatrix * instanceMatrix * vec4(position, 1.)).xyz;' },
    fHead: 'varying float vEat; varying vec3 vL; varying vec3 vVW; uniform vec3 uFogC; uniform float uT;',
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        // erosion troughs: the bacteria leave pits and channels, densest near the cut end
        float ch = vnoise3(vL * vec3(5., 5., 1.4)) * 0.7 + vnoise3(vL * 14.) * 0.3;
        float e = vEat * (1. - smoothstep(-9.0, -1.0, vL.z) * 0.0) * smoothstep(-14.0, -2.0, vL.z);
        if (ch < e * 0.75) discard;
        float rim = smoothstep(e * 0.75 + 0.08, e * 0.75, ch);
        vec3 c = diffuseColor.rgb * (0.82 + 0.25 * vnoise3(vL * vec3(2., 2., 0.3)));
        c = mix(c, vec3(0.45, 0.32, 0.18), rim * 0.8);
        c *= 0.55 + 0.45 * smoothstep(-15.0, -1.0, vL.z);
        diffuseColor.rgb = c;`,
      '#include <dithering_fragment>': `
        float fd = length(vVW - cameraPosition);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, 1. - exp(-fd * 0.07));
        #include <dithering_fragment>`,
    },
  });
  const walls = new THREE.InstancedMesh(wall, wm, N);
  // the end rings (thick walls seen on the cut face)
  const ringShape = new THREE.Shape(); const ro = RC * 1.12, ri = RC * 0.78;
  for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; k ? ringShape.lineTo(ro * Math.cos(a), ro * Math.sin(a)) : ringShape.moveTo(ro * Math.cos(a), ro * Math.sin(a)); }
  const hole = new THREE.Path(); for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; k ? hole.lineTo(ri * Math.cos(a), ri * Math.sin(a)) : hole.moveTo(ri * Math.cos(a), ri * Math.sin(a)); }
  ringShape.holes.push(hole);
  const ringG = new THREE.ExtrudeGeometry(ringShape, { depth: 0.25, bevelEnabled: false }); ringG.translate(0, 0, -0.25);
  ringG.setAttribute('aEat', aEat);
  const rm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#F0DCB4'), roughness: 0.6 });
  patch(rm, {
    uniforms: uni,
    vHead: 'attribute float aEat; varying float vEat; varying vec3 vL; varying vec3 vVW;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvEat = aEat; vL = position; vVW = (modelMatrix * instanceMatrix * vec4(position, 1.)).xyz;' },
    fHead: 'varying float vEat; varying vec3 vL; varying vec3 vVW; uniform vec3 uFogC;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
        float ch = vnoise3(vL * 9.);
        if (ch < vEat * 0.55) discard;
        diffuseColor.rgb *= 0.85 + 0.2 * vnoise3(vL * 20.);`,
      '#include <dithering_fragment>': `
        float fd = length(vVW - cameraPosition);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, 1. - exp(-fd * 0.07));
        #include <dithering_fragment>` },
  });
  const rings = new THREE.InstancedMesh(ringG, rm, N);
  // water in the emptied cells
  const wg = new THREE.CylinderGeometry(RC * 0.96, RC * 0.96, 1, 6, 1, false); wg.rotateX(Math.PI / 2); wg.translate(0, 0, -0.5); wg.rotateZ(Math.PI / 6);
  const fm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3FA6E0'), emissive: new THREE.Color('#1F6FB0'), emissiveIntensity: 0.6, roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false });
  const water = new THREE.InstancedMesh(wg, fm, N); water.renderOrder = 3;
  const M = new THREE.Matrix4();
  cells.forEach((c, i) => { M.makeScale(c.late ? 0.92 : 1.0, c.sy, 1).setPosition(c.x, c.y, 0); walls.setMatrixAt(i, M); rings.setMatrixAt(i, M); });
  g.add(walls, rings, water);
  // bacteria: rods on the inner walls of the nibbled cells
  const rodG = new THREE.CapsuleGeometry(0.075, 0.34, 4, 8); rodG.rotateX(Math.PI / 2);
  const bm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9BE07A'), emissive: new THREE.Color('#5FCF3E'), emissiveIntensity: 1.6, roughness: 0.45 });
  const bugs = [];
  cells.forEach((c, i) => { if (c.bug) for (let k = 0; k < 3; k++) bugs.push({ c, i, a: r() * 6.28, z: k === 0 ? 0.12 : -0.3 - r() * 3.5, ph: r() * 6.28, sp: 0.5 + r() }); });
  const bugIM = new THREE.InstancedMesh(rodG, bm, bugs.length);
  g.add(bugIM);
  const Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), V = new THREE.Vector3();
  function update(t, eat, fill, bugOn) {
    uni.uT.value = t;
    cells.forEach((c, i) => {
      aEat.array[i] = c.bug ? eat * (0.55 + 0.45 * c.eat) : eat * 0.15 * c.eat;
      const f = Math.min(1, Math.max(0, fill * 1.5 - c.fill * 0.5)) * (c.bug ? 1 : 0.85);
      if (f < 0.01) { water.setMatrixAt(i, M.makeScale(0, 0, 0)); return; }
      M.makeScale(c.late ? 0.92 : 1.0, c.sy, Math.max(1e-3, f * 15.5)).setPosition(c.x, c.y, -0.05);
      water.setMatrixAt(i, M);
    });
    aEat.needsUpdate = true; water.instanceMatrix.needsUpdate = true;
    bugs.forEach((b, k) => {
      const wig = Math.sin(t * 5 * b.sp + b.ph);
      const a = b.a + 0.15 * Math.sin(t * 0.7 + b.ph);
      const rr = b.z > 0 ? 0.52 : 0.36;
      V.set(b.c.x + Math.cos(a) * rr, b.c.y + Math.sin(a) * rr * b.c.sy, b.z + 0.05 * wig);
      Q.setFromAxisAngle(new THREE.Vector3(Math.cos(a), Math.sin(a), 0), (b.z > 0 ? Math.PI / 2 : 0) + 0.25 * wig);
      S.setScalar(bugOn);
      M.compose(V, Q, S); bugIM.setMatrixAt(k, M);
    });
    bugIM.instanceMatrix.needsUpdate = true;
  }
  return { group: g, uni, update, walls, water };
}
