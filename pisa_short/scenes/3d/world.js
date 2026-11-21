// scenes/3d/world.js -- everything around the tower: the sky, the floating block of ground (lawn on top, the soil
// layers on its sides, split along z = 0 so the front half can drop away and show the cut), the sunken walkway
// round the tower's base, the materials (marble, lawn, soil, paving) and the sun.
//
// World: the tower's axis at x = z = 0, lawn at y = 0, the tower leans toward +x (south). Ground layers:
// A sandy silt (0 to about -9 m), B soft wet clay (about -9 to -22 m), C dense sand (below).
import * as THREE from 'three';

export const BLOCK = { x: 36, z: 28, bottom: -34 };
export const CATINO = { r0: 8.15, r1: 11.5, depth: 0.6 };

const NOISE = `
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
`;

// ------------------------------------------------------------------ materials
export function marbleMaterial(P) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.marble), roughness: 0.58, metalness: 0, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPat;\nvarying vec3 vPat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPat = aPat;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vPat;\n${NOISE}
        float marbleF(out float joint){
          float s = vPat.x, y = vPat.y, J = vPat.z;
          float ch = 0.58, row = floor(y / ch);
          float sx = s / 1.3 + 0.5 * mod(row, 2.);
          vec2 cell = vec2(floor(sx), row);
          float tint = (h21(cell * 0.913 + 3.1) - .5) * 0.075 * J;
          float fy = fract(y / ch), fx = fract(sx);
          float wY = fwidth(y / ch), wX = fwidth(sx);
          joint = J * max(1. - smoothstep(0., 1.5 * wY + .02, min(fy, 1. - fy)), 1. - smoothstep(0., 1.5 * wX + .012, min(fx, 1. - fx)));
          float vein = fbm(vec2(s * 0.42 + y * 0.31, y * 0.83 - s * 0.17) * 1.6);
          vein = smoothstep(0.58, 0.8, vein) * 0.11;
          float streak = smoothstep(0.5, 0.9, fbm(vec2(s * 1.9, y * 0.12))) * 0.13;
          float grime = 0.06 * smoothstep(0.55, 0.0, fract(y / 6.3 + 0.02));   // dirt gathered just above each cornice
          float fine = (vnoise(vec2(s, y) * 9.) - .5) * 0.05;
          return 1. + tint - vein - streak - grime + fine;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float jointM; float mf = marbleF(jointM);
        diffuseColor.rgb *= mf * (1. - 0.22 * jointM);
        diffuseColor.rgb *= vec3(1.0, 0.985, 0.955);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.5, 0.75, jointM);');
  };
  return m;
}

export function ghostMaterial(P) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(P.accent) }, alpha: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float alpha; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1. - abs(dot(normalize(vN), normalize(vV))); float a = alpha * (0.06 + 0.9 * pow(f, 2.5));
        gl_FragColor = vec4(color * a * 2.2, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

/** Soil: layers by depth, the boundaries bent down into a settlement bowl under the tower (uBowl metres, more on
 *  the south side), the clay going darker and denser as it firms up (uFirm), and travelling quake waves (uQuake). */
export function soilMaterial(P, shared, { section = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared, {
      cSand: { value: new THREE.Color(P.sand) }, cClay: { value: new THREE.Color(P.clay) },
      cClayFirm: { value: new THREE.Color(P.clay_firm) }, cDeep: { value: new THREE.Color(P.sand_deep) },
      cGrass: { value: new THREE.Color(P.grass) }, uSection: { value: section ? 1 : 0 },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvL = position; vW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW; varying vec3 vL;
        uniform vec3 cSand, cClay, cClayFirm, cDeep, cGrass; uniform float uSection, uBowl, uFirm, uQuake, uTime, uLayerGlow; uniform mat4 uTowerInv;
        ${NOISE}
        float bowl(vec2 xz){ float d2 = dot(xz - vec2(1.5, 0.), xz - vec2(1.5, 0.)); return exp(-d2 / 260.); }
        vec3 soil(vec3 p, out float rough){
          vec2 q = vec2(p.x + p.z, p.y);
          float b = bowl(p.xz) * uBowl;
          float yAB = -9.0 + (fbm(vec2(p.x + p.z, 3.1) * 0.06) - .5) * 2.0 - b;
          float yBC = -22.0 + (fbm(vec2(p.x + p.z, 9.7) * 0.05) - .5) * 2.4 - b * 0.4;
          float n = fbm(q * vec2(0.35, 1.6));
          float strata = 0.5 + 0.5 * sin(p.y * 7.0 + n * 6.0);
          float grain = vnoise(q * 14.0);
          float peb = smoothstep(0.86, 0.9, vnoise(q * 3.7 + 11.0)) * step(p.y, yAB + 0.0);
          vec3 c;
          if (p.y > -0.55 + (vnoise(vec2(p.x + p.z, 1.) * 0.7) - .5) * 0.25) {
            c = mix(vec3(0.17, 0.12, 0.08), cGrass * 0.8, smoothstep(-0.25, -0.05, p.y));   // topsoil and the grass lip
          } else if (p.y > yAB) {
            c = cSand * (0.86 + 0.16 * strata + 0.1 * (grain - .5));
            c = mix(c, c * 0.72, smoothstep(0.75, 1.0, n));
          } else if (p.y > yBC) {
            float firm = uFirm * bowl(p.xz * 0.8);
            c = mix(cClay, cClayFirm, firm) * (0.92 + 0.08 * (0.5 + 0.5 * sin(p.y * 3.0 + n * 2.0)) + 0.05 * (grain - .5));
            c *= 1. + 0.12 * (1. - firm) * smoothstep(0.6, 0.95, vnoise(q * 1.3));   // wet sheen patches
          } else {
            c = cDeep * (0.85 + 0.12 * strata + 0.12 * (grain - .5));
          }
          c = mix(c, c * 0.55 + vec3(0.03), peb * 0.8);
          float edge = min(abs(p.y - yAB), abs(p.y - yBC));
          c *= 1. - 0.35 * (1. - smoothstep(0.0, 0.18, edge));                              // boundary lines
          c *= 0.78 + 0.22 * smoothstep(-34., -6., p.y);                                     // deeper = darker
          // quake waves: bright bands rising through the layers, damped in the clay
          float wv = sin((p.y * 0.55 + uTime * 9.0)) * 0.5 + 0.5;
          float damp = p.y > yBC && p.y < yAB ? 0.35 : 1.0;
          c += uQuake * damp * pow(wv, 6.0) * vec3(0.42, 0.34, 0.24);
          rough = 0.95;
          return c;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float rs; vec3 sc = soil(vW, rs);
        if (uSection > 0.5) {
          if (abs(vW.x) < ${CATINO.r1.toFixed(2)} && vW.y > -${CATINO.depth.toFixed(2)}) discard;
          // the foundation, cut through: stone courses in the tower's own frame
          vec3 tl = (uTowerInv * vec4(vW, 1.)).xyz;
          if (abs(tl.x) < 9.8 && tl.y > -2.4 && tl.y < 0.05) {
            vec2 q = tl.xy / vec2(1.1, 0.6);
            vec2 f = fract(q + vec2(0.5 * mod(floor(q.y), 2.), 0.));
            float j = 1. - smoothstep(0.0, 0.06, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)));
            sc = vec3(0.62, 0.58, 0.52) * (0.85 + 0.15 * h21(floor(q + vec2(0.5 * mod(floor(q.y), 2.), 0.)))) * (1. - 0.4 * j);
          }
        }
        diffuseColor.rgb *= sc;`);
  };
  return m;
}

export function lawnMaterial(P, shared) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared, {
      cGrass: { value: new THREE.Color(P.grass) }, cGrassL: { value: new THREE.Color(P.grass_light) },
      cPath: { value: new THREE.Color('#CDBFA6') },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vL; uniform float uQuake, uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vL = position;
        { float r = length(position.xz);
          transformed.y += uQuake * 0.35 * sin(r * 0.45 - uTime * 11.0) * exp(-r * 0.02); }
        vW = (modelMatrix * vec4(transformed, 1.)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW; varying vec3 vL; uniform vec3 cGrass, cGrassL, cPath; uniform float uPeople;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float r = length(vL.xz);
        if (r < ${CATINO.r1.toFixed(2)} + 0.38) discard;
        vec2 p = vL.xz;
        float stripe = step(0.5, fract(p.x / 5.0));                       // mowing stripes
        float n = fbm(p * 0.18), fine = vnoise(p * 6.0), finer = vnoise(p * 23.0);
        vec3 g = mix(cGrass, cGrassL, 0.32 * stripe + 0.35 * (n - 0.4));
        g *= 0.9 + 0.12 * fine + 0.08 * (finer - .5);
        // paths: one to the front, one to the north-west, a ring path round the walkway
        float path = 0.;
        path = max(path, step(abs(p.x + 3.0), 2.2) * step(14.0, p.y));
        path = max(path, step(abs(p.y - 2.0 - (p.x + 12.0) * 0.12), 2.0) * step(p.x, -12.0));
        path = max(path, step(abs(r - 13.3), 1.2));
        vec3 stone = cPath * (0.9 + 0.1 * vnoise(p * 3.0)) * (1. - 0.12 * step(0.94, fract(p.x * 1.4)) );
        g = mix(g, stone, path);
        diffuseColor.rgb *= g;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.7, 0.);');
  };
  return m;
}

function pavingMaterial(P) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#D8CCB6'), roughness: 0.8, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vL;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvL = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vL;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = vec2(atan(vL.z, vL.x) * length(vL.xz), length(vL.xz));
        vec2 cell = floor(q / vec2(1.2, 0.9));
        vec2 f = fract(q / vec2(1.2, 0.9));
        float joint = 1. - smoothstep(0.0, 0.05, min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)));
        diffuseColor.rgb *= (0.88 + 0.14 * h21(cell)) * (1. - 0.3 * joint) * (0.9 + 0.1 * vnoise(q * 4.));`);
  };
  return m;
}

// ------------------------------------------------------------------ geometry helpers
function halfRing(r0, r1, y, front, segs = 64) {
  // angles measured in the xz plane from +x toward +z: front half = z > 0 = (0, pi)
  const a0 = front ? 0 : Math.PI;
  const g = new THREE.RingGeometry(r0, r1, segs, 1, 0, Math.PI);
  // RingGeometry lies in xy with angle from +x toward +y; map (x, y) -> (x, z) and face up
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), yy = p.getY(i);
    const ang = Math.atan2(yy, x) + a0, r = Math.hypot(x, yy);
    p.setXYZ(i, r * Math.cos(ang), y, r * Math.sin(ang));
  }
  g.computeVertexNormals();
  // the winding may face down: make it face up
  const n = g.attributes.normal;
  if (n.getY(0) < 0) { g.index.array.reverse(); g.computeVertexNormals(); }
  return g;
}

function halfTube(r, y0, y1, front, inward, segs = 64) {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, segs, 1, true, 0, Math.PI);
  g.translate(0, (y0 + y1) / 2, 0);
  // CylinderGeometry's theta runs from +z toward +x: theta 0..pi covers x > 0. Rotate so it covers z > 0 or z < 0.
  g.rotateY(front ? -Math.PI / 2 : Math.PI / 2);
  if (inward) {
    g.scale(-1, 1, 1);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return g;
}

function quad(w, h, segW = 1, segH = 1) { return new THREE.PlaneGeometry(w, h, segW, segH); }

// ------------------------------------------------------------------ the world
export function buildWorld(P, renderer) {
  const shared = { uBowl: { value: 0 }, uFirm: { value: 0 }, uQuake: { value: 0 }, uTime: { value: 0 }, uLayerGlow: { value: 0 }, uTowerInv: { value: new THREE.Matrix4() } };
  const soil = soilMaterial(P, shared), soilCut = soilMaterial(P, shared, { section: true });
  const lawn = lawnMaterial(P, shared);
  const paving = pavingMaterial(P);
  const curbMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#E4DACA'), roughness: 0.6 });

  const halves = {};
  for (const front of [false, true]) {
    const grp = new THREE.Group();
    const s = front ? 1 : -1, Z = BLOCK.z, X = BLOCK.x, B = BLOCK.bottom;
    // lawn
    const lg = quad(2 * X, Z, 144, 56); lg.rotateX(-Math.PI / 2); lg.translate(0, 0, s * Z / 2);
    const lm = new THREE.Mesh(lg, lawn); lm.receiveShadow = true; grp.add(lm);
    // sides
    const sideX = (sx) => { const g = quad(Z, -B, 1, 1); g.rotateY(sx * Math.PI / 2); g.translate(sx * X, B / 2, s * Z / 2); return g; };
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(sideX(sx), soil); m.receiveShadow = true; grp.add(m); }
    const outer = quad(2 * X, -B); outer.translate(0, B / 2, 0);
    if (!front) outer.rotateY(Math.PI);
    outer.translate(0, 0, s * Z);
    const om = new THREE.Mesh(outer, soil); om.receiveShadow = true; grp.add(om);
    const bottom = quad(2 * X, Z); bottom.rotateX(Math.PI / 2); bottom.translate(0, B, s * Z / 2);
    grp.add(new THREE.Mesh(bottom, soil));
    // the walkway round the base (sunken), its paving and kerb
    const pav = new THREE.Mesh(halfRing(CATINO.r0 - 0.2, CATINO.r1, -CATINO.depth, front), paving); pav.receiveShadow = true; grp.add(pav);
    const wallIn = new THREE.Mesh(halfTube(CATINO.r1, -CATINO.depth, 0.3, front, true), curbMat); wallIn.receiveShadow = true; grp.add(wallIn);
    const kerbTop = new THREE.Mesh(halfRing(CATINO.r1, CATINO.r1 + 0.4, 0.3, front), curbMat); kerbTop.receiveShadow = true; grp.add(kerbTop);
    const kerbOut = new THREE.Mesh(halfTube(CATINO.r1 + 0.4, 0.0, 0.3, front, false), curbMat); kerbOut.receiveShadow = true; grp.add(kerbOut);
    halves[front ? 'front' : 'back'] = grp;
  }
  // the cut face (only seen once the front half has dropped away)
  const cut = quad(2 * BLOCK.x, -BLOCK.bottom, 1, 1); cut.translate(0, BLOCK.bottom / 2, 0);
  const cutMesh = new THREE.Mesh(cut, soilCut); cutMesh.receiveShadow = true;
  halves.back.add(cutMesh);
  return { halves, shared, materials: { soil, soilCut, lawn, paving } };
}

// ------------------------------------------------------------------ sky
export function buildSky(P) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(P.sky_top) }, mid: { value: new THREE.Color(P.sky_mid) }, low: { value: new THREE.Color(P.sky_low) },
      sunDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() }, sunCol: { value: new THREE.Color(P.sun) },
      uTime: { value: 0 }, uWar: { value: 0 }, uDim: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, mid, low, sunCol, sunDir; uniform float uTime, uWar, uDim; varying vec3 vD;
      ${NOISE}
      void main(){
        vec3 d = normalize(vD);
        float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, h));
        c = mix(c, top, smoothstep(0.16, 0.75, h));
        c = mix(c, low * 0.82, smoothstep(0.0, -0.35, h));                 // below the horizon: warm haze
        float s = max(dot(d, normalize(sunDir)), 0.);
        c += sunCol * (pow(s, 6.0) * 0.35 + pow(s, 120.0) * 1.5);
        // soft clouds in a band above the horizon
        vec2 uv = d.xz / (abs(d.y) + 0.18) * 1.4 + vec2(uTime * 0.012, 0.);
        float cl = smoothstep(0.52, 0.85, fbm(uv * 1.3)) * smoothstep(-0.05, 0.12, h) * (1. - smoothstep(0.3, 0.75, h));
        c = mix(c, mix(vec3(1.0, 0.93, 0.85), sunCol, 0.35), cl * 0.55);
        c = mix(c, vec3(0.42, 0.1, 0.06) * (0.6 + 0.4 * h), uWar);           // war: a smoky red sky
        c *= 1. - uDim;
        gl_FragColor = vec4(c, 1.);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), m);
  mesh.frustumCulled = false;
  return mesh;
}

// ------------------------------------------------------------------ cypresses and people (for scale)
export function buildCypresses(P, rnd) {
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, y = u * 12.5;
    const r = 1.55 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.04)), 0.8) * (1 - 0.38 * u) + (u < 0.03 ? 0.2 : 0);
    prof.push(new THREE.Vector2(Math.max(r, 0.02), y + 1.1));
  }
  const crown = new THREE.LatheGeometry(prof, 28);
  { const p = crown.attributes.position, n = p.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const k = 1 + 0.1 * Math.sin(a * 6 + y * 1.9) + 0.07 * Math.sin(a * 13 - y * 3.7) + 0.05 * Math.sin(y * 7.3 + a * 3);
      p.setX(i, x * k); p.setZ(i, z * k);
      const v = 0.75 + 0.35 * (k - 0.85) + 0.15 * (y / 13.6);
      c[i * 3] = v; c[i * 3 + 1] = v; c[i * 3 + 2] = v;
    }
    crown.setAttribute('color', new THREE.BufferAttribute(c, 3));
    crown.computeVertexNormals(); }
  const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1.3, 8); trunk.translate(0, 0.65, 0);
  const leaf = new THREE.MeshStandardMaterial({ color: new THREE.Color('#33502A'), roughness: 0.95, vertexColors: true });
  const bark = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4A3626'), roughness: 1 });
  const spots = { back: [[-31, -23], [-27.5, -25.5], [-33, -16], [29, -24], [32.5, -18.5], [25, -26]], front: [[-32, 22], [31.5, 23.5]] };
  const out = { back: new THREE.Group(), front: new THREE.Group() };
  for (const half of ['back', 'front']) for (const [x, z] of spots[half]) {
    const s = 0.8 + 0.45 * rnd();
    const c = new THREE.Mesh(crown, leaf); c.scale.setScalar(s); c.position.set(x, 0, z); c.rotation.y = rnd() * 6; c.castShadow = true; c.receiveShadow = true;
    const t = new THREE.Mesh(trunk, bark); t.scale.setScalar(s); t.position.set(x, 0, z);
    out[half].add(c, t);
  }
  return out;
}

export function buildPeople(rnd) {
  const leg = new THREE.CylinderGeometry(0.075, 0.065, 0.86, 6); leg.translate(0, 0.43, 0);
  const torso = new THREE.CapsuleGeometry(0.2, 0.42, 3, 10); torso.scale(1, 1, 0.7); torso.translate(0, 1.18, 0);
  const arm = new THREE.CapsuleGeometry(0.055, 0.5, 2, 6); arm.translate(0, -0.25, 0);
  const head = new THREE.SphereGeometry(0.13, 12, 10); head.translate(0, 1.66, 0);
  const shirts = ['#C8553D', '#2F6690', '#F2E8CF', '#3A7D44', '#E0A458', '#6D597A', '#EDEDED', '#B56576', '#1B998B', '#F4D35E'];
  const pantsC = ['#2B2D42', '#3D405B', '#6B705C', '#22333B', '#8D7B68'];
  const skinC = ['#E0AC8F', '#C68B6B', '#8D5A3C', '#F1C7A8'];
  const people = { back: [], front: [] };
  for (let i = 0; i < 26; i++) {
    let x, z;
    const mode = rnd();
    if (mode < 0.55) { const a = rnd() * Math.PI * 2, r = 12.6 + rnd() * 1.4; x = r * Math.cos(a); z = r * Math.sin(a); }
    else if (mode < 0.8) { x = -3 + (rnd() - 0.5) * 3.6; z = 15 + rnd() * 11; }
    else { const a = rnd() * Math.PI * 2, r = 8.9 + rnd() * 2.2; x = r * Math.cos(a); z = r * Math.sin(a); }
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color(shirts[i % shirts.length]), roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: new THREE.Color(pantsC[i % pantsC.length]), roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinC[i % skinC.length]), roughness: 0.8 });
    const parts = [];
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(leg, pants); l.position.x = sx * 0.1; l.rotation.x = sx * 0.12 * (rnd() - 0.3); parts.push(l); }
    parts.push(new THREE.Mesh(torso, shirt));
    for (const sx of [-1, 1]) { const a = new THREE.Mesh(arm, shirt); a.position.set(sx * 0.26, 1.42, 0); a.rotation.z = sx * 0.12; a.rotation.x = (rnd() - 0.5) * 0.5; parts.push(a); }
    parts.push(new THREE.Mesh(head, skin));
    for (const m of parts) { m.castShadow = true; g.add(m); }
    const inWalk = Math.hypot(x, z) < 11.5;
    g.position.set(x, inWalk ? -0.6 : 0, z);
    g.rotation.y = rnd() * 6.28;
    g.scale.setScalar(0.92 + 0.14 * rnd());
    g.userData.s0 = g.scale.x;
    people[z >= 0 ? 'front' : 'back'].push(g);
  }
  return people;
}
