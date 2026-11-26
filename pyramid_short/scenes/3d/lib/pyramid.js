// scenes/3d/lib/pyramid.js -- the Great Pyramid as it was built: a stepped core of limestone courses (drawn up to
// any course, for the construction), a shell of white Tura casing stones (each a mitred prism that can be laid,
// polished, or stripped off and flown away to Cairo -- all in the vertex shader), the construction ramp, and the
// temple and causeway down to the harbour.
//
// Real proportions: base 230.3 m, height 146.6 m (slope 51.8 deg); drawn with N courses (the real one has ~210).
import * as THREE from 'three';
import { NOISE, mergeGeos } from './land.js';

export const GP = { a: 115.15, H: 146.6, N: 80 };

// ------------------------------------------------------------------ core: stacked slabs (a box per course)
function coreGeometry(a, H, N) {
  const h = H / N, geos = [];
  for (let k = 0; k < N; k++) {
    const r = Math.max(a * (1 - (k + 1) / N), 0.9);
    const g = new THREE.BoxGeometry(2 * r, h, 2 * r);
    g.translate(0, (k + 0.5) * h, 0);
    geos.push(g);
  }
  return mergeGeos(geos);
}

export function coreMaterial(P, { a, H, N, blockL = 2.2 }) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.cRock = { value: new THREE.Color(P.rock) };
    sh.uniforms.cDark = { value: new THREE.Color(P.rock_dark) };
    m.userData.shader = sh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vL; varying vec3 vLN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvL = position; vLN = objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vL; varying vec3 vLN; uniform vec3 cRock, cDark;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        const float A = ${a.toFixed(3)}, HH = ${H.toFixed(3)}, NN = ${N.toFixed(1)}, CH = ${(H / N).toFixed(4)}, BL = ${blockL.toFixed(2)};
        vec3 nn = normalize(vLN);
        float course = floor((vL.y - 0.001) / CH);
        float ao = 1., j = 0.;
        vec2 cell;
        if (nn.y > 0.5) {
          // tread: the top of a course; joints both ways, darker close to the riser above
          course = floor((vL.y + 0.01) / CH) - 1.;
          float rr = A * (1. - (course + 2.) / NN);
          float d = max(abs(vL.x), abs(vL.z)) - rr;
          ao = 0.55 + 0.45 * smoothstep(0.0, 0.9, d);
          vec2 q = vL.xz / vec2(BL, BL * 0.7) + vec2(0.5 * mod(course, 2.), 0.);
          vec2 f = fract(q); cell = floor(q) + course * 7.;
          float w = max(fwidth(q.x), fwidth(q.y));
          j = 1. - smoothstep(0., 1.4 * w + 0.025, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)));
        } else {
          // riser: courses of blocks, the vertical joints staggered course by course
          float s = abs(nn.x) > 0.5 ? vL.z : vL.x;
          float fy = fract(vL.y / CH);
          float sx = s / BL + 0.5 * mod(course, 2.) + 0.37 * h21(vec2(course, 3.));
          float fx = fract(sx); cell = vec2(floor(sx), course);
          float wy = fwidth(vL.y / CH), wx = fwidth(sx);
          j = max(1. - smoothstep(0., 1.3 * wy + 0.03, min(fy, 1. - fy)), 1. - smoothstep(0., 1.3 * wx + 0.02, min(fx, 1. - fx)));
          ao = 0.7 + 0.3 * smoothstep(0.0, 0.35, fy);           // the step below shades the riser's foot
          ao *= 1. - 0.18 * smoothstep(0.75, 1.0, fy);           // and the worn top edge
        }
        float tint = h21(cell * 0.913 + 1.7);
        vec3 c = mix(cRock, cDark, 0.18 + 0.32 * tint * tint);
        c *= mix(vec3(1.0), vec3(1.04, 1.0, 0.92), step(0.7, h21(cell + 4.1)));   // a few yellower blocks
        float wear = fbm(vec2(vL.x + vL.z, vL.y) * 0.35);
        c *= 0.88 + 0.2 * wear;
        c *= 0.92 + 0.08 * vnoise(vec2(vL.x + vL.z, vL.y) * 4.5);
        // fade the joints out with distance (no shimmering)
        float far = clamp(length(fwidth(vL)) * 3.5, 0., 1.);
        c *= 1. - 0.42 * j * (1. - far);
        c *= mix(ao, 1., far * 0.5);
        diffuseColor.rgb *= c;`);
  };
  return m;
}

// ------------------------------------------------------------------ casing: mitred prisms, one per stone
function casingGeometry(a, H, N, Lc) {
  const h = H / N;
  const R = (y) => a * (1 - y / H);
  const pos = [], nor = [], cen = [], info = [];
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // faces: outward normal direction (dx, dz) and along-face tangent (tx, tz)
  const faces = [[0, 1, 1, 0], [1, 0, 0, -1], [0, -1, -1, 0], [-1, 0, 0, 1]];
  const v = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  for (let k = 0; k < N; k++) {
    const y0 = k * h, y1 = (k + 1) * h, r0 = R(y0), r1 = R(y1);
    // cross-section (d = distance out from the centre along the face normal, y)
    const tri = [[r0, y0], [r1, y1], [r1 - 0.02, y0]];
    for (let f = 0; f < 4; f++) {
      const [dx, dz, tx, tz] = faces[f];
      const nP = Math.max(1, Math.round(2 * r0 / Lc));
      for (let p = 0; p < nP; p++) {
        const s0 = -r0 + 2 * r0 * p / nP, s1 = -r0 + 2 * r0 * (p + 1) / nP;
        const gap = 0.012;
        // corners of the prism: for each section vertex, the s-range is clipped by the mitre |s| <= d
        const P3 = (d, y, s) => [dx * d + tx * s, y, dz * d + tz * s];
        const ends = tri.map(([d, y]) => [Math.max(s0 + gap, -d), Math.min(s1 - gap, d)]);
        const A0 = tri.map(([d, y], i) => P3(d, y, ends[i][0]));
        const A1 = tri.map(([d, y], i) => P3(d, y, ends[i][1]));
        const sm = (s0 + s1) / 2, dm = (r0 + r1) / 2 - 0.3;
        const c = P3(Math.max(dm, 0), (y0 + y1) / 2, Math.max(-dm, Math.min(dm, sm)));
        const sd = rnd();
        const quad = (a0, a1, b1, b0) => { tri3(a0, a1, b1); tri3(a0, b1, b0); };
        const tri3 = (p0, p1, p2) => {
          e1.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); e2.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
          n.crossVectors(e1, e2);
          if (n.lengthSq() < 1e-12) return;
          // face away from the piece's centre
          v.set((p0[0] + p1[0] + p2[0]) / 3 - c[0], (p0[1] + p1[1] + p2[1]) / 3 - c[1], (p0[2] + p1[2] + p2[2]) / 3 - c[2]);
          let q = [p0, p1, p2];
          if (n.dot(v) < 0) { q = [p0, p2, p1]; n.negate(); }
          n.normalize();
          for (const pp of q) { pos.push(...pp); nor.push(n.x, n.y, n.z); cen.push(...c); info.push(k, sd, f, p / nP); }
        };
        tri3(A0[0], A0[1], A0[2]); tri3(A1[0], A1[1], A1[2]);
        quad(A0[0], A0[1], A1[1], A1[0]);                     // outer face (the polished one)
        quad(A0[1], A0[2], A1[2], A1[1]);                     // back (against the core)
        quad(A0[2], A0[0], A1[0], A1[2]);                     // bottom
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(cen, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
  return g;
}

export function casingMaterial(P, { N, H }) {
  const U = { uCaseTop: { value: N }, uStrip: { value: 0 }, uShine: { value: 0 }, uCairo: { value: new THREE.Vector3(0.72, 0, -0.69) } };
  const COMMON = `
    attribute vec3 aCenter; attribute vec4 aInfo;
    uniform float uCaseTop, uStrip; uniform vec3 uCairo;
    mat3 rotAx(vec3 ax, float an){ ax = normalize(ax); float s = sin(an), c = cos(an), oc = 1. - c;
      return mat3(oc*ax.x*ax.x + c, oc*ax.x*ax.y + ax.z*s, oc*ax.z*ax.x - ax.y*s,
                  oc*ax.x*ax.y - ax.z*s, oc*ax.y*ax.y + c, oc*ax.y*ax.z + ax.x*s,
                  oc*ax.z*ax.x + ax.y*s, oc*ax.y*ax.z - ax.x*s, oc*ax.z*ax.z + c); }
    float flyU(){ float k = aInfo.x / ${N.toFixed(1)};
      float ts = 0.5 * (1. - k) + 0.42 * aInfo.y;            // mostly top first, but loosely
      return clamp((uStrip - ts) / 0.1, 0., 1.); }
    mat3 flyRot(){ return rotAx(vec3(aInfo.y - 0.5, 0.6, 0.3 - aInfo.y), flyU() * (2.5 + 3. * aInfo.y)); }
    vec3 flyPos(vec3 p){
      float fu = flyU();
      float vis = step(aInfo.x + 0.5, uCaseTop);
      float sc = vis * (1. - smoothstep(0.6, 1.0, fu));
      vec3 outw = normalize(vec3(aCenter.x, 0., aCenter.z) + 1e-4);
      vec3 path = outw * 9. * fu + vec3(0., 55. * sin(fu * 1.7), 0.) + uCairo * 700. * fu * fu;
      return aCenter + path + flyRot() * (p - aCenter) * sc; }`;
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.casing), roughness: 0.34, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}\nvarying float vSeed; varying vec3 vCL;`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = flyRot() * objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = flyPos(position); vSeed = aInfo.y; vCL = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vSeed; varying vec3 vCL; uniform float uShine;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float t = 0.955 + 0.06 * (vSeed - 0.5) + 0.04 * (vnoise(vec2(vCL.x + vCL.z, vCL.y) * 0.9) - 0.5);
        float band = fract(vCL.y / ${(H / N).toFixed(4)});
        t *= 1. - 0.035 * smoothstep(0.9, 1.0, band) - 0.02 * smoothstep(0.08, 0.0, band);
        t *= 0.93 + 0.1 * fbm(vec2(vCL.x + vCL.z, vCL.y) * 0.06);
        t *= 1. - 0.06 * smoothstep(0.6, 0.0, vCL.y / 40.);          // a little dust and grime near the ground
        diffuseColor.rgb *= t * vec3(1.0, 0.985, 0.955);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.36, 0.2, uShine);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uShine * 0.16;');
  };
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = flyPos(position);');
  };
  return { mat: m, depth, U };
}

// ------------------------------------------------------------------ the construction ramp (a straight one)
export function rampGeometry(Ht, { a, H }, { x = 40, w = 14, grade = 0.25, toe = 0, k = 0.45 } = {}) {
  // a straight ramp from the working height down to the sand, its sides battered in proportion to its height
  const zTop = a * (1 - Ht / H) - 2;
  const L = (Ht - toe) / grade;
  const zFoot = zTop + L;
  const half = w / 2, bt = half + k * Ht;
  const P = {
    tl: [x - half, Ht, zTop], tr: [x + half, Ht, zTop], fl: [x - half, toe, zFoot], fr: [x + half, toe, zFoot],
    btl: [x - bt, -1, zTop], btr: [x + bt, -1, zTop], bfl: [x - half - 1.5, -1, zFoot + 4], bfr: [x + half + 1.5, -1, zFoot + 4],
  };
  const quads = [['tl', 'fl', 'fr', 'tr'], ['tl', 'btl', 'bfl', 'fl'], ['tr', 'fr', 'bfr', 'btr'], ['fl', 'bfl', 'bfr', 'fr'], ['tl', 'tr', 'btr', 'btl']];
  const pos = [];
  for (const q of quads) { const [a0, a1, a2, a3] = q.map((n) => P[n]); pos.push(...a0, ...a1, ...a2, ...a0, ...a2, ...a3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return { geo: g, zTop, zFoot, L, x, half, k };
}

export function rampMaterial(P) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.cMud = { value: new THREE.Color(P.mud) }; sh.uniforms.cSand = { value: new THREE.Color(P.sand_dark) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vW; varying vec3 vWN; uniform vec3 cMud, cSand;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 c;
        if (abs(vWN.y) > 0.6) {
          // the packed running surface, with timber sleepers across it
          c = mix(cSand, cMud, 0.4) * (0.82 + 0.25 * fbm(vW.xz * 0.3)) * (0.92 + 0.1 * vnoise(vW.xz * 4.));
          // timber sleepers across the track, the runners' grooves, a damp dark stripe down the middle
          float sl = smoothstep(0.82, 0.9, fract(vW.z / 1.4)) * (1. - smoothstep(0.96, 1.0, fract(vW.z / 1.4)));
          c = mix(c, vec3(0.42, 0.29, 0.18) * (0.8 + 0.3 * h21(vec2(floor(vW.z / 1.4), 1.))), sl * 0.85);
          float dx = abs(vW.x - 40.);
          c *= 1. - 0.18 * smoothstep(1.2, 0.4, abs(dx - 3.5)) - 0.12 * smoothstep(2.5, 0., dx);
        } else {
          // mudbrick walls: courses of bricks
          vec2 q = vec2((vW.x + vW.z) / 0.42, vW.y / 0.16);
          q.x += 0.5 * mod(floor(q.y), 2.);
          vec2 f = fract(q);
          float j = 1. - smoothstep(0., 0.12, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)));
          float far = clamp(length(fwidth(q)) * 0.6, 0., 1.);
          c = cMud * (0.85 + 0.25 * h21(floor(q))) * (1. - 0.3 * j * (1. - far));
          c *= 0.85 + 0.2 * fbm(vW.xy * 0.2);
        }
        diffuseColor.rgb *= c;`);
  };
  return m;
}

// ------------------------------------------------------------------ assemble
export function buildPyramid(P, { a = GP.a, H = GP.H, N = GP.N, Lc = 4.2, blockL = 2.2 } = {}) {
  const g = new THREE.Group();
  const coreGeo = coreGeometry(a, H, N);
  const core = new THREE.Mesh(coreGeo, coreMaterial(P, { a, H, N, blockL }));
  core.castShadow = true; core.receiveShadow = true;
  const perSlab = 36;
  const cas = casingMaterial(P, { N, H });
  const casing = new THREE.Mesh(casingGeometry(a, H, N, Lc), cas.mat);
  casing.castShadow = true; casing.receiveShadow = true;
  casing.frustumCulled = false;                           // stones fly far away
  casing.customDepthMaterial = cas.depth;                // the shadows follow the flying stones
  g.add(core, casing);
  const api = {
    group: g, core, casing, U: cas.U, a, H, N,
    /** Courses of the core shown (0..N, fractional = the top course partly laid). */
    setCore(courses) { const k = Math.max(0, Math.min(N, Math.ceil(courses))); coreGeo.setDrawRange(0, k * perSlab); core.visible = k > 0; },
    setCasing(courses) { cas.U.uCaseTop.value = courses; casing.visible = courses > 0.01 && cas.U.uStrip.value < 1.02; },
    setStrip(u) { cas.U.uStrip.value = u; casing.visible = cas.U.uCaseTop.value > 0.01 && u < 1.02; },
    heightOf(courses) { return courses * H / N; },
  };
  return api;
}

/** Mortuary temple on the east face and the causeway down to the harbour (valley temple). */
export function buildTemple(P, heightAt) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.casing), roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.rock), roughness: 0.85 });
  const box = (x, y, z, sx, sy, sz, m = stone) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y + sy / 2, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  // temple: an enclosure wall and a pillared court
  box(140, 0, 0, 40, 7, 4); box(140, 0, -50, 40, 7, 4); box(140, 0, 50, 40, 7, 4);
  box(158, 0, -25, 4, 7, 50); box(158, 0, 25, 4, 7, 50);
  box(130, 0, 0, 14, 0.6, 92, dark);
  for (let i = 0; i < 8; i++) box(132 + (i % 2) * 12, 0.6, -36 + Math.floor(i / 2) * 24, 1.6, 6, 1.6);
  // causeway: walled, sloping down from the plateau to the valley temple by the harbour
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const x = 160 + i * (318 - 160) / 40, z = 0 + i * 18 / 40;
    pts.push([x, Math.max(heightAt(x, z), -27.5) + 0.2, z]);
  }
  const cw = 9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
    const L = Math.hypot(x1 - x0, z1 - z0, y1 - y0);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 1.2, cw), dark);
    seg.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.2, (z0 + z1) / 2);
    seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    seg.rotation.z = Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0));
    seg.castShadow = true; seg.receiveShadow = true; g.add(seg);
    for (const sd of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 3.2, 1.0), stone);
      w.position.copy(seg.position); w.rotation.copy(seg.rotation);
      w.translateZ(sd * (cw / 2 - 0.5)); w.translateY(1.9);
      w.castShadow = true; w.receiveShadow = true; g.add(w);
    }
  }
  // valley temple at the harbour's edge
  box(312, -27.5, 18, 26, 9, 30, stone);
  return g;
}
