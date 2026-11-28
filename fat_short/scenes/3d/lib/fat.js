// scenes/3d/lib/fat.js -- the glowing lump of fat: a cluster of fat cells meshed every frame from a distance field,
// so it can wobble, melt into drips, stretch into a muscle and sweat -- and shrink as it leaves as specks.
//
// Local space: metres, centred on the lump (radius ~0.1 m). state = { wob, melt, muscle, shrink, burst }.
import * as THREE from 'three';
import { LiveSDF, smin } from './sdf.js';

const N_CELLS = 22;

/** The fat material: glossy gold with fat cells and an inner glow; it can turn to muscle, get wet, be dissolved from
 *  the top down (uCut, with a glowing edge) and turn to water below uWaterY (uWater). Returns { mat, U }. */
export function fatMaterial(P, env, extra = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#F2A43A'), roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18,
    envMap: env, envMapIntensity: 0.45, emissive: new THREE.Color('#FF9330'), emissiveIntensity: 1.25, ...extra,
  });
  const U = { uMuscle: { value: 0 }, uMuscleCol: { value: new THREE.Color(P.muscle) }, uGlow: { value: 1 }, uWet: { value: 0 },
    uTime: { value: 0 }, uDeep: { value: new THREE.Color(P.fat_deep) }, uCellScale: { value: 46 },
    uCut: { value: 10 }, uWaterY: { value: -10 }, uWater: { value: 0 }, uWaterCol: { value: new THREE.Color(P.water) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vObj; uniform float uMuscle, uGlow, uWet, uTime, uCellScale, uCut, uWaterY, uWater; uniform vec3 uMuscleCol, uDeep, uWaterCol;
      vec3 hash3(vec3 p){ p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
        return fract(sin(p) * 43758.5453); }
      // cellular noise: distance to the nearest and second-nearest cell centre -> fat cells with thin walls
      vec2 cells(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8., d2 = 8.;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
          vec3 g = vec3(float(x), float(y), float(z)); vec3 o = hash3(i + g); vec3 r = g + o - f; float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
        return vec2(sqrt(d1), sqrt(d2)); }
      float fib(vec3 p){ float a = atan(p.y, p.z); return 0.5 + 0.5 * sin(a * 46. + sin(p.x * 60.) * 1.5); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec2 ccut = cells(vObj * 120.);
        float cutEdge = uCut + (ccut.x - 0.5) * 0.012;
        if (vObj.y > cutEdge) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 cc = cells(vObj * uCellScale);
        float wall = (1. - smoothstep(0.02, 0.1, cc.y - cc.x)) * (1. - uMuscle);
        float cellIn = 1. - cc.x;
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.8 + 0.3 * cellIn), uDeep, wall * 0.5);
        float fb = fib(vObj);
        float tendon = smoothstep(0.13, 0.18, abs(vObj.x));
        vec3 musc = mix(uMuscleCol * (0.55 + 0.55 * fb), vec3(0.92, 0.86, 0.8), tendon);
        diffuseColor.rgb = mix(diffuseColor.rgb, musc, uMuscle);
        float isWater = uWater * (1. - smoothstep(uWaterY - 0.004, uWaterY + 0.004, vObj.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, uWaterCol * 0.55, isWater);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
        float sss = pow(ndv, 1.4);
        totalEmissiveRadiance *= uGlow * (0.18 + 0.75 * sss) * (0.7 + 0.5 * cellIn - 0.5 * wall) * (1. - 0.85 * uMuscle);
        totalEmissiveRadiance = mix(totalEmissiveRadiance, uWaterCol * (0.15 + 0.5 * (1. - sss)), isWater);
        float edge = 1. - smoothstep(0.0, 0.012, cutEdge - vObj.y);
        totalEmissiveRadiance += vec3(1.0, 0.85, 0.5) * edge * 6. * step(uCut, 5.) * (1. - uWater);
        if (!gl_FrontFacing && uCut < 5.) totalEmissiveRadiance *= 1.15;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // looking into the dissolved block: shade its inside as a solid cut face (a cap facing up)
        if (!gl_FrontFacing && uCut < 5.) normal = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(roughnessFactor, 0.08, uWet), 0.45, uMuscle);`);
  };
  return { mat, U };
}

export function buildFat(P, env, rnd) {
  // the cells: one core and lobules around it
  const cells = [{ p: [0, 0, 0], r: 0.072, ph: 0, fq: 1.3 }];
  for (let i = 0; i < N_CELLS - 1; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const d = [s * Math.cos(a), u * 0.85, s * Math.sin(a)];
    const r = 0.03 + rnd() * 0.018;
    const dist = 0.06 + rnd() * 0.02;
    cells.push({ p: d.map((x) => x * dist), r, ph: rnd() * 6.28, fq: 1.4 + rnd() * 1.8, d });
  }
  // the muscle: a spindle along x, every cell gets a slot
  const slots = cells.map((c, i) => {
    const u = (i / (cells.length - 1)) * 2 - 1;                          // -1 .. 1 along the spindle
    const x = u * 0.19;
    const prof = Math.pow(Math.max(0, 1 - u * u), 0.9);
    const ang = i * 2.39996, rr = 0.012 * (i % 3);
    return { p: [x, Math.sin(ang) * rr, Math.cos(ang) * rr], r: 0.016 + 0.058 * prof };
  });
  // drips for the melt
  const drips = Array.from({ length: 6 }, (_, i) => ({
    x: (rnd() - 0.5) * 0.12, z: (rnd() - 0.5) * 0.1, t0: 0.2 + rnd() * 0.45, r: 0.011 + rnd() * 0.008, sp: 0.7 + rnd() * 0.5,
  }));

  const live = new LiveSDF(160000);
  const { mat, U } = fatMaterial(P, env);
  const mesh = new THREE.Mesh(live.geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  const group = new THREE.Group();
  group.add(mesh);

  // sweat: small water beads that appear, slide down the surface and drip off
  const NS = 40;
  const waterMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#E8F6FF'), roughness: 0.02, metalness: 0,
    transmission: 1, thickness: 0.012, ior: 1.33, envMap: env, envMapIntensity: 1.4, specularIntensity: 1 });
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), waterMat, NS);
  beads.renderOrder = 7; beads.frustumCulled = false;
  group.add(beads);
  const beadDef = Array.from({ length: NS }, () => {
    const a = rnd() * Math.PI * 2, el = 0.15 + rnd() * 1.05;
    return { a, el, t0: rnd() * 0.5, r: 0.009 + rnd() * 0.009, sp: 0.5 + rnd() * 0.8 };
  });

  let state = { wob: 1, melt: 0, muscle: 0, shrink: 0, t: 0 };
  const tmp = { p: [], r: [] };
  function layout() {
    const { wob, melt, muscle, shrink, t } = state;
    const me = melt * melt * (3 - 2 * melt);
    const sc = 1 - shrink;
    tmp.p.length = 0; tmp.r.length = 0;
    cells.forEach((c, i) => {
      let x = c.p[0], y = c.p[1], z = c.p[2], r = c.r;
      // wobble: each cell breathes on its own, the whole lump squashes and stretches a little
      const w = wob * 0.0035;
      x += w * Math.sin(t * (c.fqA ?? c.fq * 2.1) + c.ph); y += w * Math.sin(t * (c.fqB ?? c.fq * 1.7) + c.ph * 1.3);
      z += w * Math.cos(t * (c.fqC ?? c.fq * 1.9) + c.ph);
      r *= 1 + 0.04 * wob * Math.sin(t * (c.fqR ?? c.fq) + c.ph);
      const sq = 1 + 0.03 * wob * Math.sin(t * SQ);
      x *= sq; z *= sq; y /= sq;
      // melt: everything sags towards a puddle and spreads
      if (me > 0) {
        const fl = -0.1;
        const ty = fl + (y - fl) * 0.22;
        y = y + (ty - y) * me * (0.75 + 0.25 * Math.abs(Math.sin(c.ph)));
        x *= 1 + 0.75 * me; z *= 1 + 0.75 * me;
        r *= 1 + 0.12 * me;
      }
      // muscle: move to the spindle slot
      if (muscle > 0) {
        const m = muscle * muscle * (3 - 2 * muscle), s = slots[i];
        x += (s.p[0] - x) * m; y += (s.p[1] - y) * m; z += (s.p[2] - z) * m; r += (s.r - r) * m;
      }
      tmp.p.push([x * sc, y * sc, z * sc]); tmp.r.push(r * sc);
    });
    const dr = [];
    if (melt > 0) {
      for (const d of drips) {
        const u = Math.max(0, (melt - d.t0) / (1 - d.t0));
        if (u <= 0) continue;
        const y = -0.085 - 0.32 * Math.pow(u, 1.6) * d.sp;
        dr.push({ p: [d.x * (1 + 0.6 * me), y, d.z * (1 + 0.6 * me)], r: d.r * Math.min(1, u * 3), neck: Math.max(0, 1 - u * 1.6) });
      }
    }
    return dr;
  }
  let drips_ = [];
  const CP = new Float64Array(N_CELLS * 4);
  function packCells() { for (let i = 0; i < tmp.p.length; i++) { CP[i * 4] = tmp.p[i][0]; CP[i * 4 + 1] = tmp.p[i][1]; CP[i * 4 + 2] = tmp.p[i][2]; CP[i * 4 + 3] = tmp.r[i]; } }
  function sdf(x, y, z) {
    let d = 1e9;
    const k = 0.022 * (1 - state.muscle * 0.3), n = tmp.p.length;
    for (let i = 0; i < n; i++) {
      const dx = x - CP[i * 4], dy = y - CP[i * 4 + 1], dz = z - CP[i * 4 + 2];
      const b = Math.sqrt(dx * dx + dy * dy + dz * dz) - CP[i * 4 + 3];
      const h = k - Math.abs(d - b);
      d = (d < b ? d : b) - (h > 0 ? h * h * 0.25 / k : 0);
    }
    for (const dd of drips_) {
      const p = dd.p;
      const ex = x - p[0], ey = (y - p[1]) * 0.8, ez = z - p[2];
      let dd2 = Math.sqrt(ex * ex + ey * ey + ez * ez) - dd.r;     // a teardrop, a little long
      if (dd.neck > 0) {                                            // the thread back to the lump
        const ty = Math.min(-0.07, Math.max(p[1], y));
        const rr = 0.003 + 0.009 * dd.neck * (1 - (ty - p[1]) / Math.max(1e-3, -0.07 - p[1]) * 0.5);
        const fx = x - p[0], fy = y - ty, fz = z - p[2];
        dd2 = smin(dd2, Math.sqrt(fx * fx + fy * fy + fz * fz) - rr, 0.01);
      }
      d = smin(d, dd2, 0.02 * dd.neck + 0.003);
    }
    return d;
  }
  function bounds() {
    let x0 = 1, y0 = 1, z0 = 1, x1 = -1, y1 = -1, z1 = -1;
    const all = tmp.p.map((p, i) => [p, tmp.r[i]]).concat(drips_.map((d) => [d.p, d.r]));
    for (const [p, r] of all) {
      x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); z0 = Math.min(z0, p[2] - r);
      x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); z1 = Math.max(z1, p[2] + r);
    }
    const m = 0.02;
    return [[x0 - m, y0 - m, z0 - m], [x1 + m, y1 + m, z1 + m]];
  }

  const M = new THREE.Matrix4(), Qn = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3();
  function surfacePoint(dir, out) {
    // march from the centre along dir to the surface
    let lo = 0, hi = 0.35;
    for (let k = 0; k < 18; k++) {
      const m = (lo + hi) / 2;
      if (sdf(dir[0] * m, dir[1] * m + 0.0, dir[2] * m) < 0) lo = m; else hi = m;
    }
    return out.set(dir[0] * lo, dir[1] * lo, dir[2] * lo);
  }

  let SQ = 2.6;
  return {
    group, mesh, mat, U, beads, cells, sdf, surfacePoint,
    /** make every wobble periodic over the video, so the last frame flows into the first */
    setPeriod(D) {
      const q = (f) => Math.max(1, Math.round(f * D / (2 * Math.PI))) * 2 * Math.PI / D;
      for (const c of cells) c.fq = q(c.fq * 2.1) / 2.1;
      SQ = q(2.6);
      for (const c of cells) { c.fqA = q(c.fq * 2.1); c.fqB = q(c.fq * 1.7); c.fqC = q(c.fq * 1.9); c.fqR = q(c.fq); }
    },
    /** state: { wob, melt, muscle, shrink, sweat (0..1 progress), t, glow, h } */
    update(s) {
      state = { ...state, ...s };
      U.uMuscle.value = state.muscle || 0;
      U.uWet.value = Math.min(1, (state.melt || 0) * 1.5 + (state.sweat ? 0.3 : 0));
      U.uGlow.value = s.glow ?? 1;
      U.uTime.value = state.t;
      drips_ = layout();
      packCells();
      if (state.visible === false || (state.shrink ?? 0) >= 0.999) { mesh.visible = false; }
      else {
        mesh.visible = true;
        live.update(sdf, bounds(), s.h || 0.0046);
      }
      // sweat beads
      const sw = state.sweat || 0;
      beads.visible = sw > 0 && sw < 1;
      if (beads.visible) {
        beadDef.forEach((b, i) => {
          const u = (sw - b.t0) / (1 - b.t0 + 1e-6);
          if (u <= 0) { M.makeScale(0, 0, 0); beads.setMatrixAt(i, M); return; }
          const grow = Math.min(1, u * 4);
          const slide = Math.max(0, u - 0.25) * b.sp * 1.6;
          const el = b.el + slide;                                    // polar angle from the top
          const dir = [Math.sin(el) * Math.cos(b.a), Math.cos(el), Math.sin(el) * Math.sin(b.a)];
          surfacePoint(dir, V);
          if (el > 2.6) V.y -= (el - 2.6) * 0.25;                   // dripped off: falls away
          const r = b.r * grow * (1 - Math.max(0, (sw - 0.9) * 10));
          S.set(r, r * 1.15, r);
          Qn.identity();
          M.compose(V.addScaledVector(new THREE.Vector3(...dir), r * 0.45), Qn, S);
          beads.setMatrixAt(i, M);
        });
        beads.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
