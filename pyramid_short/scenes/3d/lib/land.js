// scenes/3d/lib/land.js -- Giza as a floating diorama block: the desert plateau with the pyramid's quarry, the
// escarpment down to the Nile valley, the river, the canal and the harbour basin dug to the foot of the plateau,
// the green fields and palms on the banks, and Tura's white limestone cliffs on the far (east) bank. Plus the sky.
//
// World: 1 unit = 1 m. The pyramid's centre at x = z = 0, the plateau at y = 0. North = -z, east = +x (the Nile).
import * as THREE from 'three';

export const BLOCK = { x0: -430, x1: 900, z0: -430, z1: 560, bottom: -150 };
export const WATER_Y = -31;
export const QUARRY = { x0: -150, x1: -20, z0: 150, z1: 255, depth: 14 };
export const HARBOUR = { x0: 318, x1: 392, z0: -10, z1: 80 };
export const CANAL = { z: 35, w: 24, x0: 380, x1: 600 };
export const NILE = { x: 640, w: 118 };

// ------------------------------------------------------------------ noise (JS and GLSL agree only roughly; fine)
function h2(x, z) { let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); }
function vn(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = h2(ix, iz), b = h2(ix + 1, iz), c = h2(ix, iz + 1), d = h2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
export function fbm(x, z, oct = 4) { let s = 0, a = 0.5; for (let i = 0; i < oct; i++) { s += a * vn(x, z); x = x * 2.03 + 17.1; z = z * 2.03 + 5.3; a *= 0.5; } return s; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const NOISE = `
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
`;

export function nileX(z) { return NILE.x + 28 * Math.sin(z * 0.0042 + 0.6) + 10 * Math.sin(z * 0.011); }

/** Ground height (without the quarry pit, which is its own mesh). */
export function heightAt(x, z) {
  // plateau: gentle dunes, rising slowly to the west
  let y = 1.6 * (fbm(x * 0.006, z * 0.006) - 0.45) + 0.6 * (fbm(x * 0.03, z * 0.03) - 0.5) + 7 * sstep(-120, -430, x);
  // the pyramid sits on a levelled platform
  const pr = Math.max(Math.abs(x), Math.abs(z));
  y *= sstep(128, 175, pr);
  // the escarpment down to the valley (ragged edge)
  const ex = 262 + 18 * (fbm(z * 0.012, 3.1) - 0.5) * 2;
  const f = sstep(ex, ex + 46, x);
  const valley = -27.5 + 0.8 * (fbm(x * 0.01, z * 0.01) - 0.5);
  y = y + (valley - y) * f;
  // the Nile
  const dn = Math.abs(x - nileX(z));
  y = y + (-40 - y) * sstep(NILE.w / 2 + 14, NILE.w / 2 - 6, dn);
  // canal and harbour basin
  if (x > HARBOUR.x0 - 30 && x < CANAL.x1 + 40) {
    const dc = Math.abs(z - CANAL.z);
    const inCanal = x > HARBOUR.x1 - 6 && x < nileX(z) ? sstep(CANAL.w / 2 + 6, CANAL.w / 2 - 2, dc) : 0;
    const hx = Math.max(HARBOUR.x0 - x, x - HARBOUR.x1, 0), hz = Math.max(HARBOUR.z0 - z, z - HARBOUR.z1, 0);
    const inBasin = sstep(8, 0, Math.sqrt(hx * hx + hz * hz));
    y = y + (-38 - y) * Math.max(inCanal, inBasin);
  }
  // the east bank: fields, then Tura's cliffs
  const cx = 790 + 20 * (fbm(z * 0.01, 7.7) - 0.5) * 2;
  const cliff = sstep(cx, cx + 34, x);
  const top = 14 + 8 * fbm(x * 0.02, z * 0.02);
  if (x > nileX(z)) y = y + (top - y) * cliff;
  return y;
}

// ------------------------------------------------------------------ materials
export function groundMaterial(P, U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, {
      cSand: { value: new THREE.Color(P.sand) }, cSandD: { value: new THREE.Color(P.sand_dark) },
      cRock: { value: new THREE.Color(P.rock) }, cField: { value: new THREE.Color(P.field) },
      cMud: { value: new THREE.Color(P.mud) },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW; varying vec3 vWN;
        uniform vec3 cSand, cSandD, cRock, cField, cMud;
        uniform vec4 uQuarry; uniform vec4 uWet; uniform vec2 uWetDir; uniform float uWetAmt, uTrack, uNileX;
        ${NOISE}
        float nileX(float z){ return ${NILE.x.toFixed(1)} + 28. * sin(z * 0.0042 + 0.6) + 10. * sin(z * 0.011); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p = vW.xz;
        // the quarry pit is its own mesh
        if (p.x > uQuarry.x && p.x < uQuarry.y && p.y > uQuarry.z && p.y < uQuarry.w) discard;
        float n = fbm(p * 0.02), n2 = fbm(p * 0.11 + 3.), fine = vnoise(p * 1.7), grain = vnoise(p * 9.);
        // wind ripples across the dunes
        float rip = sin(dot(p, vec2(0.93, 0.37)) * 2.4 + n2 * 9.) * 0.5 + 0.5;
        vec3 c = mix(cSand, cSandD, smoothstep(0.35, 0.75, n) * 0.6);
        c *= 0.93 + 0.08 * rip + 0.06 * (fine - .5) + 0.04 * (grain - .5);
        // bare limestone where the sand is thin
        float rock = smoothstep(0.58, 0.72, fbm(p * 0.035 + 11.)) * smoothstep(-5., 2., vW.y) * step(vW.x, 250.);
        c = mix(c, cRock * (0.85 + 0.2 * fine), rock * 0.75);
        // the pyramid's levelled platform: paved, lighter
        float pr = max(abs(p.x), abs(p.y));
        float plat = smoothstep(142., 134., pr) * step(117., pr);
        vec2 pq = fract(p / vec2(3.1, 1.9));
        float pj = 1. - smoothstep(0.0, 0.05, min(min(pq.x, 1. - pq.x), min(pq.y, 1. - pq.y)));
        c = mix(c, cRock * (1.05 + 0.08 * h21(floor(p / vec2(3.1, 1.9)))) * (1. - 0.18 * pj), plat);
        // escarpment face: layered rock
        float slope = smoothstep(0.15, 0.5, 1. - clamp(normalize(vWN).y, 0., 1.));
        // valley: wet dark silt and fields near the river
        float val = smoothstep(-18., -25., vW.y);
        float dn = abs(p.x - nileX(p.y));
        float fields = val * smoothstep(${(NILE.w / 2 + 70).toFixed(1)}, ${(NILE.w / 2 + 20).toFixed(1)}, dn);
        vec2 fp = vec2(p.x * 0.7 + p.y * 0.3, p.y);
        float plot = h21(floor(fp / vec2(22., 30.)));
        vec3 fc = mix(cField, cField * vec3(1.25, 1.12, 0.7), plot) * (0.8 + 0.25 * vnoise(p * 0.4)) * (0.9 + 0.12 * sin(fp.x * 3.1));
        c = mix(c, mix(cMud, cSandD, 0.3) * (0.8 + 0.2 * fine), val * 0.65);
        c = mix(c, fc, fields * step(0.18, plot));
        // muddy banks at the water line
        c = mix(c, cMud * 0.62, smoothstep(${(-WATER_Y - 3).toFixed(1)}, ${(-WATER_Y + 1).toFixed(1)}, -vW.y) * 0.9);
        // Tura: white cliffs
        float tura = smoothstep(-15., 4., vW.y) * step(700., p.x);
        c = mix(c, vec3(0.93, 0.9, 0.82) * (0.88 + 0.12 * fine) * (0.9 + 0.1 * sin(vW.y * 2.6 + n2 * 4.)), tura);
        c = mix(c, cRock * (0.75 + 0.25 * sin(vW.y * 1.7 + n2 * 3.)), slope * 0.8 * (1. - tura));
        // the hauling track from the quarry and the wet patch in front of the hero sledge
        vec2 wq = p - uWet.xy; vec2 wl = vec2(dot(wq, uWetDir), dot(wq, vec2(uWetDir.y, -uWetDir.x)));
        float wet = uWetAmt * (1. - smoothstep(0.55, 1.0, length(wl / uWet.zw))) * (0.85 + 0.3 * vnoise(p * 3.));
        c = mix(c, c * vec3(0.5, 0.47, 0.45), wet);
        diffuseColor.rgb *= c;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.96;');
  };
  return m;
}

/** Strata on the block's sides and the quarry walls: horizontal limestone beds. */
export function strataMaterial(P, { quarry = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.cRock = { value: new THREE.Color(P.rock) }; sh.uniforms.cDark = { value: new THREE.Color(P.rock_dark) };
    sh.uniforms.cSand = { value: new THREE.Color(P.sand) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vW; uniform vec3 cRock, cDark, cSand;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float s = vW.x + vW.z;
        float n = fbm(vec2(s * 0.03, vW.y * 0.2));
        float bed = 0.5 + 0.5 * sin(vW.y * ${quarry ? '2.1' : '0.55'} + n * 5.);
        vec3 c = mix(cRock, cDark, 0.35 * bed + 0.25 * smoothstep(0.55, 0.8, n));
        c *= 0.9 + 0.12 * vnoise(vec2(s, vW.y) * ${quarry ? '2.5' : '0.4'});
        ${quarry ? `
        // chisel-cut blocks still waiting in the walls: a grid of cuts, some blocks already gone
        vec2 q = vec2(s / 2.4, vW.y / 1.3);
        vec2 f = fract(q);
        float j = 1. - smoothstep(0.0, 0.05, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)));
        c *= (0.9 + 0.15 * h21(floor(q))) * (1. - 0.35 * j);
        c *= 0.95 + 0.05 * sin(s * 14. + vW.y * 3.);` : `
        c = mix(c, cSand * 0.9, smoothstep(-6., 0., vW.y - 0.0) * 0.0);
        c *= 0.7 + 0.3 * smoothstep(${BLOCK.bottom.toFixed(1)}, -10., vW.y);`}
        diffuseColor.rgb *= c;`);
  };
  return m;
}

export function waterMaterial(P, U) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign(U, {
      cDeep: { value: new THREE.Color(P.nile_deep) }, cShallow: { value: new THREE.Color(P.nile) },
      cSky: { value: new THREE.Color(P.sky_mid) }, cSun: { value: new THREE.Color(P.sun) },
      sunDir: U.sunDir, fogColor: { value: new THREE.Color(P.sky_low) }, fogNear: { value: 900 }, fogFar: { value: 3600 },
    }),
    vertexShader: `varying vec3 vW; varying float vDepth;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 cDeep, cShallow, cSky, cSun, sunDir, fogColor; uniform float uPhase, fogNear, fogFar; varying vec3 vW; varying float vDepth;
      ${NOISE}
      void main(){
        vec2 p = vW.xz;
        // ripples: sums of travelling sines whose phases turn a whole number of times over the video (loops)
        float a = uPhase;
        vec2 g = vec2(0.);
        g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.9 + a * 9.);
        g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 1.7 + a * 14. + 1.3) * 0.6;
        g += vec2(0.2, -0.98) * cos(dot(p, vec2(0.2, -0.98)) * 3.1 + a * 21. + 2.1) * 0.35;
        g += vec2(0.97, -0.24) * cos(dot(p, vec2(0.97, -0.24)) * 5.3 + a * 30. + 4.0) * 0.2;
        g *= (0.05 + 0.06 * vnoise(p * 0.04 + vec2(3.)));
        g += 0.05 * vec2(vnoise(p * 0.6) - .5, vnoise(p * 0.6 + 9.) - .5);
        vec3 n = normalize(vec3(-g.x, 1., -g.y));
        vec3 v = normalize(cameraPosition - vW);
        float fr = 0.04 + 0.96 * pow(1. - max(dot(n, v), 0.), 5.);
        vec3 r = reflect(-v, n);
        vec3 sky = mix(cSky, cSky * 1.25, smoothstep(0., 0.6, r.y));
        vec3 c = mix(cDeep, cShallow, 0.35 + 0.3 * vnoise(p * 0.02));
        c = mix(c, sky, fr * 0.85);
        float sp = pow(max(dot(r, normalize(sunDir)), 0.), 220.);
        c += cSun * sp * 6.;
        float fogF = smoothstep(fogNear, fogFar, vDepth);
        c = mix(c, fogColor, fogF);
        gl_FragColor = vec4(c, 1.);
      }`,
  });
}

// ------------------------------------------------------------------ the block
export function buildLand(P, U) {
  const g = new THREE.Group();
  const W = BLOCK.x1 - BLOCK.x0, Dz = BLOCK.z1 - BLOCK.z0;
  const SX = 266, SZ = 198;
  const top = new THREE.PlaneGeometry(W, Dz, SX, SZ);
  top.rotateX(-Math.PI / 2);
  top.translate((BLOCK.x0 + BLOCK.x1) / 2, 0, (BLOCK.z0 + BLOCK.z1) / 2);
  const pos = top.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  top.computeVertexNormals();
  const ground = new THREE.Mesh(top, groundMaterial(P, U));
  ground.receiveShadow = true; ground.castShadow = false;
  g.add(ground);
  // sides: follow the top edge down to the bottom
  const strata = strataMaterial(P);
  const side = (pts) => {
    const n = pts.length, arr = new Float32Array(n * 2 * 3), idx = [];
    pts.forEach(([x, z], i) => {
      arr.set([x, heightAt(x, z), z], i * 6);
      arr.set([x, BLOCK.bottom, z], i * 6 + 3);
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, strata); m.receiveShadow = true;
    return m;
  };
  const edge = (x0, z0, x1, z1, n) => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]);
  const sides = [
    side(edge(BLOCK.x0, BLOCK.z1, BLOCK.x1, BLOCK.z1, SX)),             // south (faces +z)
    side(edge(BLOCK.x1, BLOCK.z0, BLOCK.x0, BLOCK.z0, SX)),             // north
    side(edge(BLOCK.x1, BLOCK.z1, BLOCK.x1, BLOCK.z0, SZ)),             // east
    side(edge(BLOCK.x0, BLOCK.z0, BLOCK.x0, BLOCK.z1, SZ)),             // west
  ];
  // make every side face outward
  for (const m of sides) {
    const geo = m.geometry; geo.computeBoundingBox();
    const c = new THREE.Vector3(); geo.boundingBox.getCenter(c);
    const n = geo.attributes.normal; const out = new THREE.Vector3(c.x - (BLOCK.x0 + BLOCK.x1) / 2, 0, c.z - (BLOCK.z0 + BLOCK.z1) / 2);
    if (n.getX(0) * out.x + n.getZ(0) * out.z < 0) { geo.index.array.reverse(); geo.computeVertexNormals(); }
    g.add(m);
  }
  const bottom = new THREE.PlaneGeometry(W, Dz); bottom.rotateX(Math.PI / 2);
  bottom.translate((BLOCK.x0 + BLOCK.x1) / 2, BLOCK.bottom, (BLOCK.z0 + BLOCK.z1) / 2);
  g.add(new THREE.Mesh(bottom, strata));
  // water: one plane, clipped to the block, seen only where the ground dips below it
  const wgeo = new THREE.PlaneGeometry(W - 1, Dz - 1, 1, 1); wgeo.rotateX(-Math.PI / 2);
  wgeo.translate((BLOCK.x0 + BLOCK.x1) / 2, WATER_Y, (BLOCK.z0 + BLOCK.z1) / 2);
  const water = new THREE.Mesh(wgeo, waterMaterial(P, U));
  g.add(water);
  // the water's edge on the block's sides
  const wside = (x0, z0, x1, z1) => {
    const pts = edge(x0, z0, x1, z1, 200).filter(([x, z]) => heightAt(x, z) < WATER_Y);
    return pts;
  };
  const wsMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.nile_deep), roughness: 0.3, transparent: true, opacity: 0.85 });
  for (const [x0, z0, x1, z1] of [[BLOCK.x0, BLOCK.z1, BLOCK.x1, BLOCK.z1], [BLOCK.x1, BLOCK.z0, BLOCK.x0, BLOCK.z0]]) {
    const pts = wside(x0, z0, x1, z1);
    if (pts.length < 2) continue;
    const xa = Math.min(...pts.map((p) => p[0])) - 2, xb = Math.max(...pts.map((p) => p[0])) + 2;
    const q = new THREE.PlaneGeometry(xb - xa, 9);
    if (z0 < 0) q.rotateY(Math.PI);
    q.translate((xa + xb) / 2, WATER_Y - 4.5, z0 > 0 ? z0 + 0.3 : z0 - 0.3);
    g.add(new THREE.Mesh(q, wsMat));
  }
  return { group: g, ground, water };
}

/** The quarry pit beside the pyramid: stepped benches cut into the rock, blocks half cut out. */
export function buildQuarry(P) {
  const g = new THREE.Group();
  const mat = strataMaterial(P, { quarry: true });
  const Qx0 = QUARRY.x0, Qx1 = QUARRY.x1, Qz0 = QUARRY.z0, Qz1 = QUARRY.z1, dep = QUARRY.depth;
  const benches = [[0, 0], [-dep * 0.4, 7], [-dep * 0.75, 14], [-dep, 21]];   // [y, inset]
  for (let i = 0; i < benches.length - 1; i++) {
    const [y0, in0] = benches[i], [y1, in1] = benches[i + 1];
    // walls (vertical) from y0 down to y1 at inset in0, then a tread at y1 from in0 to in1
    const w = new THREE.BoxGeometry(1, 1, 1);
    const rect = [Qx0 + in0, Qx1 - in0, Qz0 + in0, Qz1 - in0];
    const H = y0 - y1;
    const wall = (x, z, sx, sz) => { const m = new THREE.Mesh(w, mat); m.scale.set(sx, H, sz); m.position.set(x, (y0 + y1) / 2, z); m.receiveShadow = true; m.castShadow = true; return m; };
    const t = 2;
    g.add(wall((rect[0] + rect[1]) / 2, rect[2] - t / 2 + t, rect[1] - rect[0], t));
    g.add(wall((rect[0] + rect[1]) / 2, rect[3] + t / 2 - t, rect[1] - rect[0], t));
    g.add(wall(rect[0] - t / 2 + t, (rect[2] + rect[3]) / 2, t, rect[3] - rect[2]));
    g.add(wall(rect[1] + t / 2 - t, (rect[2] + rect[3]) / 2, t, rect[3] - rect[2]));
    // tread
    const tr = new THREE.Mesh(new THREE.PlaneGeometry(rect[1] - rect[0], rect[3] - rect[2]), mat);
    tr.rotation.x = -Math.PI / 2; tr.position.set((rect[0] + rect[1]) / 2, y1, (rect[2] + rect[3]) / 2); tr.receiveShadow = true;
    g.add(tr);
  }
  // loose blocks on the floor, some on sledges
  const blk = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.rock), roughness: 0.85 });
  const r = (s) => { let x = Math.sin(s * 91.7) * 43758.5; return x - Math.floor(x); };
  for (let i = 0; i < 26; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6 + 0.5 * r(i), 1.0 + 0.2 * r(i + 9), 1.1 + 0.3 * r(i + 3)), blk);
    b.position.set(Qx0 + 24 + r(i + 1) * (Qx1 - Qx0 - 48), -dep + 0.55, Qz0 + 24 + r(i + 2) * (Qz1 - Qz0 - 48));
    b.rotation.y = r(i + 5) * 0.4; b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  }
  return g;
}

// ------------------------------------------------------------------ sky
export function buildSky(P, U) {
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({
      top: { value: new THREE.Color(P.sky_top) }, mid: { value: new THREE.Color(P.sky_mid) }, low: { value: new THREE.Color(P.sky_low) },
      sunCol: { value: new THREE.Color(P.sun) }, uDay: { value: 1 },
    }, { sunDir: U.sunDir, uPhase: U.uPhase }),
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, mid, low, sunCol, sunDir; uniform float uPhase, uDay; varying vec3 vD;
      ${NOISE}
      void main(){
        vec3 d = normalize(vD);
        float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.12, h));
        c = mix(c, top, smoothstep(0.08, 0.55, h));
        c = mix(c, low * 0.85, smoothstep(0.0, -0.35, h));
        vec3 sd = normalize(sunDir);
        float s = max(dot(d, sd), 0.);
        c += sunCol * (pow(s, 5.0) * 0.45 + pow(s, 90.0) * 0.9 + pow(s, 1800.0) * 14.0);
        // high thin clouds (they sway a little and come back: the loop)
        vec2 uv = d.xz / (abs(d.y) + 0.2) * 1.2 + vec2(0.05 * sin(uPhase), 0.03 * cos(uPhase));
        float cl = smoothstep(0.55, 0.86, fbm(uv * 1.1 + 4.)) * smoothstep(0.02, 0.14, h) * (1. - smoothstep(0.35, 0.8, h));
        c = mix(c, mix(vec3(1.0, 0.94, 0.86), sunCol, 0.45), cl * 0.5);
        // night for the time-lapse
        vec3 night = mix(vec3(0.015, 0.025, 0.06), vec3(0.04, 0.06, 0.13), smoothstep(-0.1, 0.5, h));
        float stars = step(0.9975, h21(floor(d.xz / (abs(d.y) + 0.3) * 300.))) * smoothstep(0.05, 0.3, h);
        night += stars * 0.8;
        c = mix(night, c, uDay);
        gl_FragColor = vec4(c, 1.);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// ------------------------------------------------------------------ palms along the banks
export function buildPalms(P, rnd, n = 170) {
  const trunkG = new THREE.CylinderGeometry(0.22, 0.34, 1, 6, 4); trunkG.translate(0, 0.5, 0);
  // a crown of drooping fronds: each frond a bent strip
  const fr = [];
  for (let k = 0; k < 11; k++) {
    const a = k / 11 * Math.PI * 2, segs = 6, w = 0.7;
    const pts = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, r = 4.2 * u, y = 1.2 * Math.sin(u * 2.2) - 2.4 * u * u;
      const ww = w * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05));
      const cx = Math.cos(a), cz = Math.sin(a), px = -cz, pz = cx;
      pts.push(cx * r + px * ww, y, cz * r + pz * ww, cx * r - px * ww, y - 0.15, cz * r - pz * ww);
      if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setIndex(idx);
    geo.computeVertexNormals();
    fr.push(geo);
  }
  const crownG = mergeGeos(fr);
  const trunkM = new THREE.MeshStandardMaterial({ color: new THREE.Color('#6B5236'), roughness: 1 });
  const crownM = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.palm), roughness: 0.9, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, n), crowns = new THREE.InstancedMesh(crownG, crownM, n);
  trunks.castShadow = crowns.castShadow = true; trunks.receiveShadow = crowns.receiveShadow = true;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  while (k < n) {
    const z = BLOCK.z0 + 10 + rnd() * (BLOCK.z1 - BLOCK.z0 - 20);
    const side = rnd() < 0.55 ? -1 : 1;
    const x = nileX(z) + side * (NILE.w / 2 + 12 + rnd() * 70);
    if (x < 300 && side < 0) continue;
    if (Math.abs(z - CANAL.z) < 20 && x < nileX(z)) continue;
    if (x > 700 && x < 800 && z > 80 && z < 220) continue;          // keep Tura's dock clear for the camera
    const y = heightAt(x, z);
    if (y < WATER_Y + 1) continue;
    const h = 9 + rnd() * 7;
    q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.12, rnd() * 6, (rnd() - 0.5) * 0.12));
    M.compose(p.set(x, y - 0.2, z), q, s.set(1, h, 1)); trunks.setMatrixAt(k, M);
    M.compose(p.set(x, y + h - 0.3, z), q, s.setScalar(0.9 + 0.3 * rnd())); crowns.setMatrixAt(k, M);
    k++;
  }
  const g = new THREE.Group(); g.add(trunks, crowns);
  return g;
}

export function mergeGeos(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  const hasUV = geos.every((g) => g.attributes.uv);
  const uv = hasUV ? new Float32Array(nv * 2) : null;
  let ov = 0, oi = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal;
    pos.set(p.array, ov * 3); nor.set(n.array, ov * 3);
    if (uv) uv.set(g.attributes.uv.array, ov * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[oi + i] = a[i] + ov; oi += a.length; }
    else { for (let i = 0; i < p.count; i++) idx[oi + i] = ov + i; oi += p.count; }
    ov += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
