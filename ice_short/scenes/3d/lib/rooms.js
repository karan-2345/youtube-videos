// scenes/3d/lib/rooms.js -- the small sets.
//   buildHold(P)     inside the ship's hold: curved frames and planking, deck beams with a hatch grating overhead
//                    (sun shafts and dust), a swinging lantern, the ice stack in a sawdust bed with a cut face, bilge
//                    water that rises as the ice melts.
//   buildPrison(P)   a debtors' cell: rough stone, a flagstone floor with straw, a barred window with a sunbeam, a bench.
//   buildPond(P)     a New England pond in winter: snow, bare trees, an ice house, the ice scored into a grid and cut.
//   buildStudy(P)    a Boston desk by a window: the Boston Gazette, an inkwell and quill, a candle (the globe sits here).
//   buildGlass(P)    a cut-glass tumbler with ice cubes, for the last line.
import * as THREE from 'three';
import { patch, tint, mulberry, NOISE } from './common.js';
import { mergeGeos } from './figures.js';
import { woodMat, sawdustMaterial } from './ship.js';
import { iceBlocks, puddles } from './ice.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** A soft light shaft: an additive box/cone with dust in it (noise), fading along its length. */
export function lightShaft(len, r0, r1, color = '#FFE2B0', strength = 0.35) {
  const g = new THREE.CylinderGeometry(r0, r1, len, 24, 1, true);
  g.translate(0, -len / 2, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(color) }, uS: { value: strength }, uLen: { value: len } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `${NOISE} uniform float uT, uS, uLen; uniform vec3 uCol; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){
        float along = clamp(-vP.y / uLen, 0., 1.);
        float side = abs(dot(normalize(vN), normalize(vV)));
        float a = uS * smoothstep(0.0, 0.6, side) * (1. - along) * (0.75 + 0.5 * vnoise3(vP * 3.0 + vec3(0., uT * 0.2, 0.)));
        gl_FragColor = vec4(uCol * a, 0.);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 5;
  return mesh;
}

/** Floating dust motes in a box (lit by the sun shafts). */
export function motes(n, box, color = '#FFE8C0') {
  const g = new THREE.BufferGeometry();
  const r = mulberry(n);
  const p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = box[0] + r() * (box[3] - box[0]); p[i * 3 + 1] = box[1] + r() * (box[4] - box[1]); p[i * 3 + 2] = box[2] + r() * (box[5] - box[2]); s[i] = r(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uScale: { value: 1000 }, uCol: { value: new THREE.Color(color) }, uA: { value: 0.5 } },
    vertexShader: `attribute float seed; uniform float uT, uScale; varying float vA;
      void main(){ vec3 q = position + vec3(sin(uT * 0.3 + seed * 40.) * 0.15, sin(uT * 0.21 + seed * 17.) * 0.12, cos(uT * 0.27 + seed * 23.) * 0.15);
        vec4 mv = modelViewMatrix * vec4(q, 1.); gl_PointSize = clamp(uScale * (0.004 + 0.006 * seed) / -mv.z, 0., 12.);
        vA = 0.4 + 0.6 * fract(seed * 7.3); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vA; void main(){ vec2 q = gl_PointCoord - .5; float r = dot(q,q) * 4.; if (r > 1.) discard; gl_FragColor = vec4(uCol * uA * vA * (1. - r), 0.); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false;
  return pts;
}

function stoneMaterial(base = '#7A7266', scale = 1) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(base), roughness: 0.95 });
  return patch(m, {
    uniforms: { uS: { value: scale } },
    vHead: 'varying vec3 vWs; varying vec3 vNs;',
    vert: { '#include <worldpos_vertex>': '#include <worldpos_vertex>\nvWs = (modelMatrix * vec4(transformed, 1.)).xyz; vNs = normalize(mat3(modelMatrix) * normal);' },
    fHead: 'varying vec3 vWs; varying vec3 vNs; uniform float uS;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      vec2 q = (abs(vNs.y) > 0.6 ? vWs.xz : (abs(vNs.x) > 0.6 ? vWs.zy : vWs.xy)) / uS;
      vec2 bs = vec2(0.62, 0.36);
      float row = floor(q.y / bs.y);
      vec2 c = vec2(fract((q.x + row * 0.37) / bs.x), fract(q.y / bs.y));
      float mortar = 1. - smoothstep(0.0, 0.06, min(min(c.x, 1. - c.x) * bs.x, min(c.y, 1. - c.y) * bs.y) / 0.6);
      float id = h21(vec2(floor((q.x + row * 0.37) / bs.x), row));
      diffuseColor.rgb *= (0.78 + 0.35 * id) * (0.8 + 0.3 * fbm(q * 3.0)) * (1. - mortar * 0.55);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.85, 0.95, 0.8), smoothstep(0.6, 0.9, fbm(q * 0.8)) * 0.4);` },
  });
}

// ================================================================== the hold
export function buildHold(P) {
  const group = new THREE.Group();
  const LEN = 12, BEAM = 6.4, HGT = 3.1;
  // the hull's inside: frames (ribs) and planking on a U-section
  const sect = (y) => (BEAM / 2) * (1 - Math.pow(Math.max(0, 1 - y / HGT), 2.6) * 0.55);   // half width at height y
  const plank = woodMat('#6E4C30', { plank: 0.22, along: 'x' });
  {
    const g = new THREE.PlaneGeometry(LEN, 1, 40, 24);
    const p = g.attributes.position;
    const pos = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), v = p.getY(i) + 0.5;      // 0..1 up the side
        const y = -0.3 + v * (HGT + 0.3);
        pos.push(x, y, side * sect(Math.max(0, y)));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const idx = [];
    const n = p.count, cols = 41;
    for (const [o, flip] of [[0, false], [n, true]]) for (let j = 0; j < 24; j++) for (let i = 0; i < 40; i++) {
      const a = o + j * cols + i, b = a + cols;
      if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    geo.setIndex(idx); geo.computeVertexNormals();
    const walls = new THREE.Mesh(geo, plank); walls.receiveShadow = true; walls.castShadow = true; group.add(walls);
  }
  const frameMat = woodMat('#4E3420', { plank: 0.5, along: 'y' });
  const fg = [];
  for (let k = 0; k <= 12; k++) {
    const x = -LEN / 2 + LEN * k / 12;
    for (const side of [-1, 1]) {
      const pts = [];
      for (let j = 0; j <= 10; j++) { const y = -0.3 + (HGT + 0.3) * j / 10; pts.push(V(x, y, side * (sect(Math.max(0, y)) - 0.12))); }
      fg.push(tint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.12, 5, false), '#ffffff'));
    }
    if (k % 2 === 0) { const b = new THREE.BoxGeometry(0.26, 0.28, BEAM); b.translate(x, HGT - 0.14, 0); fg.push(tint(b.toNonIndexed(), '#ffffff')); }
  }
  // the deck overhead (with the hatch opening at x in [-1.4, 1.4]) and the floor (ceiling planks)
  for (const [a, b] of [[-LEN / 2, -1.4], [1.4, LEN / 2]]) { const d = new THREE.BoxGeometry(b - a, 0.12, BEAM); d.translate((a + b) / 2, HGT + 0.06, 0); fg.push(tint(d.toNonIndexed(), '#ffffff')); }
  for (const z of [-BEAM / 2 + 0.6, BEAM / 2 - 0.6]) { const d = new THREE.BoxGeometry(2.8, 0.12, 1.2); d.translate(0, HGT + 0.06, z); fg.push(tint(d.toNonIndexed(), '#ffffff')); }
  const frames = new THREE.Mesh(mergeGeos(fg), frameMat); frames.castShadow = true; frames.receiveShadow = true; group.add(frames);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(LEN, 0.1, BEAM * 0.72), woodMat('#5E4028', { plank: 0.3, along: 'x' }));
  floor.position.set(0, -0.05, 0); floor.receiveShadow = true; group.add(floor);
  // the hatch grating (lets the sun in), open or closed by uOpen (hatch boards slide away)
  const grate = [];
  for (let k = 0; k < 9; k++) { const b = new THREE.BoxGeometry(0.06, 0.08, 1.8); b.translate(-1.2 + k * 0.3, HGT + 0.1, 0); grate.push(tint(b.toNonIndexed(), '#ffffff')); }
  for (let k = 0; k < 6; k++) { const b = new THREE.BoxGeometry(2.6, 0.08, 0.06); b.translate(0, HGT + 0.1, -0.75 + k * 0.3); grate.push(tint(b.toNonIndexed(), '#ffffff')); }
  const grating = new THREE.Mesh(mergeGeos(grate), frameMat); grating.castShadow = true; group.add(grating);
  const boards = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.9), woodMat('#4A3220', { plank: 0.3, along: 'z' }));
  boards.position.set(0, HGT + 0.2, 0); boards.castShadow = true; group.add(boards);
  // the sun through the grating, and the light it brings
  const sunIn = new THREE.SpotLight(new THREE.Color('#FFE0B0'), 0, 14, 0.42, 0.45, 1.2);
  sunIn.position.set(0.6, HGT + 6, 0.4); sunIn.target.position.set(-0.4, 0, -0.2); sunIn.castShadow = true;
  sunIn.shadow.mapSize.set(1024, 1024); sunIn.shadow.bias = -0.0008; sunIn.shadow.normalBias = 0.03;
  group.add(sunIn, sunIn.target);
  const shaft = lightShaft(4.2, 0.9, 1.5, '#FFE2B4', 0.18); shaft.position.set(0.2, HGT + 0.3, 0.1); shaft.rotation.z = 0.18; group.add(shaft);
  // the lantern (swings with the ship)
  const lantern = new THREE.Group();
  const lglass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 12), new THREE.MeshStandardMaterial({ color: '#FFC870', emissive: new THREE.Color('#FFB050'), emissiveIntensity: 3.0, roughness: 0.3 }));
  const lcap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 12), new THREE.MeshStandardMaterial({ color: '#2A2420', metalness: 0.8, roughness: 0.4 })); lcap.position.y = 0.18;
  const lbase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12), lcap.material); lbase.position.y = -0.14;
  const lrope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), new THREE.MeshStandardMaterial({ color: '#3A2A1A' })); lrope.position.y = 0.52;
  lglass.position.y = 0; lantern.add(lglass, lcap, lbase, lrope);
  const lamp = new THREE.PointLight(new THREE.Color('#FFB866'), 9, 9, 1.4); lamp.castShadow = false; lantern.add(lamp);
  const pivot = new THREE.Group(); pivot.position.set(-3.6, HGT - 0.05, -1.4); group.add(pivot);
  lantern.position.y = -0.82; pivot.add(lantern);
  const amb = new THREE.HemisphereLight(new THREE.Color('#6A5A48'), new THREE.Color('#2A2018'), 0.5); group.add(amb);

  // the ice stack: 6 along x, 3 across, 2 layers (the cut face toward +z shows the inside of the sawdust bed)
  const NXb = 7, NZb = 4, NL = 2, BH = 0.31;
  const ice = iceBlocks(NXb * NZb * NL + 30, { glow: 0.3 });
  group.add(ice.mesh);
  const slots = [];
  for (let l = 0; l < NL; l++) for (let i = 0; i < NXb; i++) for (let j = 0; j < NZb; j++) {
    slots.push({ x: -2.4 + i * 0.68, z: -1.65 + j * 0.68, y: 0.02 + l * (BH * 2 + 0.03), l, i, j });
  }
  // sawdust: the bed's top surface (rises) and its cut face toward the camera (+z side)
  const sdMat = sawdustMaterial();
  // the sawdust bed: a box from the floor up to its level (its front face is the cut)
  const sdG = new THREE.BoxGeometry(NXb * 0.68 + 0.5, 1, NZb * 0.68 + 0.36); sdG.translate(0, 0.5, 0);
  const sdBox = new THREE.Mesh(sdG, sdMat);
  sdBox.position.set(-2.4 + (NXb - 1) * 0.34, 0.0, -1.65 + (NZb - 1) * 0.34 - 0.0); sdBox.receiveShadow = true; sdBox.castShadow = true;
  group.add(sdBox);
  // the falling sawdust (a stream from the hatch + flakes)
  const fall = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: new THREE.Color('#D4A868'), size: 0.025, sizeAttenuation: true }));
  const NF = 1600; const fp = new Float32Array(NF * 3); fall.geometry.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fall.frustumCulled = false;
  group.add(fall);
  // bilge water: a sloshing sheet on the floor
  const water = new THREE.Mesh(new THREE.PlaneGeometry(LEN, BEAM * 0.8, 40, 20), new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#3E5A5E'), roughness: 0.06, transparent: true, opacity: 0.8, clearcoat: 1, envMapIntensity: 1.2 }));
  water.rotation.x = -Math.PI / 2; water.receiveShadow = true; group.add(water);
  const pud = puddles(4); group.add(pud.mesh);
  const dust = motes(500, [-3, 0.3, -2.4, 3, 3.0, 2.4]); group.add(dust);
  const r = mulberry(17);
  const jit = slots.map(() => ({ dx: (r() - 0.5) * 0.03, dz: (r() - 0.5) * 0.03, yaw: (r() - 0.5) * 0.05, k: 0.75 + 0.5 * r() }));
  /** s = { melt (0..1 overall), loose (0 packed .. 1 loose, wide gaps), drop (0..1: blocks dropping into place),
   *  sawdust (0..1 bed level), pour (0..1 sawdust falling), open (0..1 hatch open), water (0..1), t, sway } */
  function set(s) {
    const t = s.t;
    slots.forEach((q, k) => {
      const j = jit[k];
      const loose = s.loose ?? 0;
      const order = (q.l * NXb * NZb + q.i * NZb + q.j) / (slots.length);
      const dropU = s.drop == null ? 1 : Math.min(1, Math.max(0, (s.drop - order * 0.75) / 0.25));
      const fallY = (1 - dropU) * (1 - dropU) * 3.2;
      const m = Math.min(1, (s.melt ?? 0) * j.k);
      if (dropU <= 0) { ice.set(k, { hide: true }); return; }
      ice.set(k, { x: q.x * (1 + loose * 0.22) + j.dx + loose * 0.1 * Math.sin(k * 3.1), y: q.y * (1 - loose * 0.0) + fallY, z: q.z * (1 + loose * 0.25) + j.dz,
        yaw: j.yaw + loose * 0.3 * Math.sin(k * 1.7), sx: 0.32, sy: BH, sz: 0.32, round: 0.07 + loose * 0.05, melt: m });
    });
    for (let k = slots.length; k < ice.n; k++) ice.set(k, { hide: true });
    ice.commit();
    const lvl = s.sawdust ?? 0;
    const top = 0.02 + lvl * (NL * (BH * 2 + 0.03) + 0.06);
    sdBox.visible = lvl > 0.01; sdBox.scale.y = top;
    // sawdust stream from the hatch
    const pour = s.pour ?? 0;
    fall.visible = pour > 0.001;
    if (fall.visible) {
      for (let i = 0; i < NF; i++) {
        const rr = mulberry(i * 7 + 3); const a = rr(), b = rr(), c = rr();
        const per = 0.9, age = ((t - a * per) % per + per) % per, life = per;
        const u = age / life;
        const x0 = -1.0 + 2.0 * b, z0 = -0.8 + 1.4 * c;
        fp[i * 3] = x0 + Math.sin(i) * 0.05 * u; fp[i * 3 + 1] = HGT + 0.2 - (HGT + 0.2 - top) * Math.min(1, u * u * 1.3) ; fp[i * 3 + 2] = z0;
        if (rr() > pour) fp[i * 3 + 1] = -100;
      }
      fall.geometry.attributes.position.needsUpdate = true;
    }
    // water rises as the ice melts, sloshing with the roll
    const wl = s.water ?? 0;
    water.visible = wl > 0.01;
    water.position.y = -0.04 + wl * 0.22; water.rotation.z = (s.sway ?? 0) * 0.5;
    const wp = water.geometry.attributes.position;
    for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), y = wp.getY(i); wp.setZ(i, 0.02 * Math.sin(x * 2.1 + t * 2.2) * Math.cos(y * 1.7 - t * 1.6)); }
    wp.needsUpdate = true; water.geometry.computeVertexNormals();
    // the hatch
    const open = s.open ?? 0;
    boards.position.x = open * 3.2; boards.visible = open < 0.98;
    sunIn.intensity = 8 + 70 * open;
    shaft.material.uniforms.uS.value = 0.08 + 0.3 * open; shaft.material.uniforms.uT.value = t;
    dust.material.uniforms.uT.value = t;
    pivot.rotation.x = (s.sway ?? 0) * 1.6; pivot.rotation.z = (s.sway ?? 0) * 0.6;
    lamp.intensity = 9 * (1 + 0.05 * Math.sin(t * 17) + 0.04 * Math.sin(t * 29 + 1));
  }
  return { group, set, dust, shaft, sunIn, LEN, BEAM, HGT, slots };
}

// ================================================================== the prison cell
export function buildPrison(P) {
  const group = new THREE.Group();
  const Wd = 4.4, Dp = 3.6, Ht = 3.4;
  const stone = stoneMaterial('#7E7568', 1);
  const add = (g, m, x, y, z, ry = 0) => { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.rotation.y = ry; mesh.receiveShadow = true; mesh.castShadow = true; group.add(mesh); return mesh; };
  // back wall with a window hole: four boxes around it
  const wx = 0.6, wy = 2.55, ww = 0.9, wh = 0.7;
  add(new THREE.BoxGeometry(Wd, wy - wh / 2, 0.5), stone, 0, (wy - wh / 2) / 2, -Dp / 2);
  add(new THREE.BoxGeometry(Wd, Ht - wy - wh / 2, 0.5), stone, 0, Ht - (Ht - wy - wh / 2) / 2, -Dp / 2);
  add(new THREE.BoxGeometry(Wd / 2 + wx - ww / 2, wh, 0.5), stone, -Wd / 2 + (Wd / 2 + wx - ww / 2) / 2, wy, -Dp / 2);
  add(new THREE.BoxGeometry(Wd / 2 - wx - ww / 2, wh, 0.5), stone, Wd / 2 - (Wd / 2 - wx - ww / 2) / 2, wy, -Dp / 2);
  add(new THREE.BoxGeometry(0.5, Ht, Dp + 1), stone, -Wd / 2 - 0.25, Ht / 2, 0);
  add(new THREE.BoxGeometry(0.5, Ht, Dp + 1), stone, Wd / 2 + 0.25, Ht / 2, 0);
  add(new THREE.BoxGeometry(Wd + 1, 0.4, Dp + 1), stoneMaterial('#5E574E', 1.3), 0, Ht + 0.2, 0);
  const floor = add(new THREE.BoxGeometry(Wd + 1, 0.2, Dp + 4), stoneMaterial('#6A6258', 1.6), 0, -0.1, 0.8);
  const iron = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2A2624'), roughness: 0.55, metalness: 0.8 });
  for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.022, 0.022, wh, 8), iron, wx - ww / 2 + 0.18 + k * 0.18, wy, -Dp / 2 + 0.05);
  add(new THREE.BoxGeometry(ww, 0.04, 0.05), iron, wx, wy + 0.1, -Dp / 2 + 0.05);
  // the door: iron bars on the right wall
  for (let k = 0; k < 7; k++) add(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), iron, Wd / 2 - 0.02, 1.1, 0.4 + k * 0.14);
  // bench, straw, a tin cup, a blanket
  const bw = woodMat('#5E4630', { plank: 0.2, along: 'x' });
  add(new THREE.BoxGeometry(2.0, 0.08, 0.5), bw, -0.7, 0.48, -Dp / 2 + 0.55);
  add(new THREE.BoxGeometry(0.08, 0.46, 0.4), bw, -1.55, 0.23, -Dp / 2 + 0.55);
  add(new THREE.BoxGeometry(0.08, 0.46, 0.4), bw, 0.15, 0.23, -Dp / 2 + 0.55);
  const straw = [];
  const r = mulberry(5);
  for (let k = 0; k < 900; k++) {
    const g = new THREE.CylinderGeometry(0.003, 0.003, 0.12 + r() * 0.1, 3);
    g.rotateZ(Math.PI / 2 + (r() - 0.5) * 0.3); g.rotateY(r() * 6.28);
    const a = r() * 6.28, d = Math.sqrt(r()) * 0.9;
    g.translate(-0.4 + Math.cos(a) * d * 1.4, 0.005 + r() * 0.02, 0.1 + Math.sin(a) * d);
    straw.push(tint(g, r() < 0.5 ? '#C9A85E' : '#A88A48'));
  }
  const strawM = new THREE.Mesh(mergeGeos(straw), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); strawM.receiveShadow = true; group.add(strawM);
  const cup = add(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#8A8A88', metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }), 0.6, 0.045, -0.6);
  void cup;
  // light: the sunbeam through the window, cold bounce, the beam's dust
  const sun = new THREE.SpotLight(new THREE.Color('#FFD9A6'), 120, 20, 0.16, 0.35, 1.0);
  sun.position.set(wx + 1.6, wy + 3.0, -Dp / 2 - 3.0); sun.target.position.set(-0.6, 0.0, 0.4);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  group.add(sun, sun.target);
  const fill = new THREE.HemisphereLight(new THREE.Color('#56627A'), new THREE.Color('#241F1C'), 0.28); group.add(fill);
  const beam = lightShaft(5.6, 0.36, 0.95, '#FFE0B0', 0.3);
  beam.position.set(wx, wy, -Dp / 2);
  beam.lookAt(new THREE.Vector3(-0.6, 0.0, 0.4).add(group.position));
  beam.rotateX(-Math.PI / 2);
  group.add(beam);
  const dust = motes(400, [-1.6, 0.2, -1.6, 1.0, 3.0, 1.2]); group.add(dust);
  return { group, sun, beam, dust, W: Wd, D: Dp, H: Ht, bench: V(-0.7, 0.52, -Dp / 2 + 0.55) };
}

// ================================================================== the pond in winter
export function buildPond(P) {
  const group = new THREE.Group();
  // the pond: ice with snow drifts, the scored grid (uScore 0..1 lines drawn), the cut channel of open water
  const iceU = { uScore: { value: 0 }, uLift: { value: 0 }, uT: { value: 0 } };
  const pm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#CFE2EC'), roughness: 0.35, metalness: 0 });
  patch(pm, {
    uniforms: iceU,
    vHead: 'varying vec3 vWp;',
    vert: { '#include <worldpos_vertex>': '#include <worldpos_vertex>\nvWp = vec3(transformed.x, 0., -transformed.y);' },
    fHead: 'varying vec3 vWp; uniform float uScore, uLift, uT;',
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        vec2 p = vWp.xz;
        vec2 g = p / 0.56;
        float inField = smoothstep(-7.0, -6.0, g.x) * smoothstep(7.0, 6.0, g.x) * smoothstep(-9.0, -8.0, g.y) * smoothstep(4.0, 3.0, g.y);
        float snow = smoothstep(0.45, 0.7, fbm(p * 0.25) + 0.2 * fbm(p * 2.)) ;
        float clear = smoothstep(0.55, 0.3, fbm(p * 0.12 + 3.));
        vec3 iceC = mix(vec3(0.55, 0.68, 0.76), vec3(0.2, 0.32, 0.42), clear * 0.6);
        iceC *= 0.9 + 0.15 * vnoise(p * 6.);
        float cracks = 1. - smoothstep(0.0, 0.02, abs(vnoise(p * 1.7) - 0.5));
        iceC = mix(iceC, vec3(0.85, 0.92, 0.96), cracks * 0.5);
        vec3 c = mix(iceC, vec3(0.94, 0.96, 0.98), snow * 0.85 * (1. - inField * 0.9));
        // the grid: lines 0.56 m apart inside the cutting field, drawn row by row as uScore grows
                vec2 f = abs(fract(g) - 0.5);
        float lx = 1. - smoothstep(0.02, 0.07, 0.5 - f.x), ly = 1. - smoothstep(0.02, 0.07, 0.5 - f.y);
        float drawnX = step(g.y, mix(-8.0, 3.0, clamp(uScore * 2.0, 0., 1.)));
        float drawnY = step(g.x, mix(-6.0, 6.0, clamp(uScore * 2.0 - 1.0, 0., 1.)));
        float score = max(lx * drawnX, ly * drawnY) * step(0.5, inField);
        c = mix(c, vec3(0.12, 0.2, 0.26), score * 0.85);
        // the open channel where blocks have been floated out
        float chan = step(-1.6, p.x) * step(p.x, 1.6) * step(3.0 * 0.56, p.y) * step(p.y, 30.);
        c = mix(c, vec3(0.04, 0.07, 0.09), chan);
        diffuseColor.rgb = c;`,
      '#include <roughnessmap_fragment>': '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.12, 0.85, smoothstep(0.45, 0.7, fbm(vWp.xz * 0.25)));',
    },
  });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(80, 96), pm);
  pond.rotation.x = -Math.PI / 2; pond.receiveShadow = true; group.add(pond);
  // snowy banks rising from the shore
  const bg = new THREE.RingGeometry(78, 900, 96, 24); bg.rotateX(-Math.PI / 2);
  const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), z = bp.getZ(i), d = Math.sqrt(x * x + z * z);
    bp.setY(i, Math.min(30, (d - 78) * 0.08) + 2.0 * Math.sin(x * 0.05) * Math.cos(z * 0.04) * Math.min(1, (d - 78) / 30));
  }
  bg.computeVertexNormals();
  const snowM = new THREE.MeshStandardMaterial({ color: new THREE.Color('#EEF2F6'), roughness: 0.8 });
  const bank = new THREE.Mesh(bg, snowM); bank.receiveShadow = true; group.add(bank);
  // bare trees: a trunk and recursive branches, merged, instanced round the shore
  const tr = mulberry(9);
  const tg = [];
  const branch = (a, dir, len, r, depth) => {
    const b = a.clone().add(dir.clone().multiplyScalar(len));
    const g = new THREE.CylinderGeometry(r * 0.7, r, len, 5, 1, true); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir)); g.translate(a.x, a.y, a.z);
    tg.push(tint(g, '#3E3630'));
    if (depth <= 0) return;
    for (let k = 0; k < 3; k++) {
      const nd = dir.clone().add(V((tr() - 0.5) * 1.3, tr() * 0.5, (tr() - 0.5) * 1.3)).normalize();
      branch(b, nd, len * (0.6 + tr() * 0.15), r * 0.62, depth - 1);
    }
  };
  branch(V(0, 0, 0), V(0, 1, 0), 4.5, 0.22, 4);
  const treeG = mergeGeos(tg);
  const trees = new THREE.InstancedMesh(treeG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 160);
  const M = new THREE.Matrix4();
  for (let k = 0; k < 160; k++) {
    const a = tr() * Math.PI * 2, d = 84 + tr() * 120;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (z > 0 && Math.abs(x) < 30) { k--; continue; }
    const y = Math.min(30, (d - 78) * 0.08) - 0.3, s = 1.2 + tr() * 1.4;
    M.makeRotationY(tr() * 6.28); M.scale(V(s, s, s)); M.setPosition(x, y, z); trees.setMatrixAt(k, M);
  }
  trees.castShadow = true; group.add(trees);
  // the ice house on the far shore (a big plank barn), with a ramp
  const barnM = woodMat('#5A4636', { plank: 0.3, along: 'y' });
  const barn = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 22), barnM); barn.position.set(-20, 7 + 2, -110); barn.castShadow = true; group.add(barn);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 15, 9, 4, 1), new THREE.MeshStandardMaterial({ color: '#E8ECEF', roughness: 0.8 }));
  roof.rotation.y = Math.PI / 4; roof.scale.set(1.45, 1, 0.82); roof.position.set(-20, 14 + 2 + 4.5, -110); group.add(roof);
  // cut blocks: lifted out of the grid, a row floating in the channel
  const ice = iceBlocks(60, { glow: 0.12 });
  group.add(ice.mesh);
  // light: low winter sun through thin cloud
  const sun = new THREE.DirectionalLight(new THREE.Color('#FFE6CC'), 2.2);
  sun.position.set(40, 30, -60); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 200 });
  sun.shadow.bias = -0.0005; group.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(new THREE.Color('#A8B6C8'), new THREE.Color('#C8D0D8'), 0.55); group.add(hemi);
  // falling snow
  const snow = motes(1200, [-14, 0, -14, 14, 10, 14], '#FFFFFF');
  snow.material.blending = THREE.NormalBlending; snow.material.uniforms.uA.value = 0.9;
  group.add(snow);
  function set(t, { score = 0, lift = 0 } = {}) {
    iceU.uScore.value = score; iceU.uT.value = t;
    // the blocks of the first two rows rise out (lift) and slide toward the channel
    let n = 0;
    for (let i = -3; i < 3; i++) for (let j = 0; j < 3; j++) {
      const u = Math.min(1, Math.max(0, lift * 1.6 - (j * 6 + i + 3) / 18 * 0.6));
      const x = (i + 0.5) * 0.56, z = (j + 0.5 - 3) * 0.56 + 1.68;
      ice.set(n++, { x, y: -0.5 + u * 0.55, z: z + u * u * 1.2, yaw: u * 0.1 * Math.sin(n), sx: 0.27, sy: 0.25, sz: 0.27, round: 0.04, melt: 0, hide: u <= 0.001 });
    }
    for (let k = 0; k < 14; k++) ice.set(n++, { x: (k % 2 - 0.5) * 0.6, y: -0.38 + 0.03 * Math.sin(t * 1.3 + k), z: 3.6 + k * 0.62, yaw: 0.05 * Math.sin(k * 2.3), sx: 0.27, sy: 0.25, sz: 0.27, round: 0.05, melt: 0 });
    while (n < ice.n) ice.set(n++, { hide: true });
    ice.commit();
    snow.material.uniforms.uT.value = t;
    const sp = snow.geometry.attributes.position;
    void sp;
  }
  return { group, set, sun, snow, ice };
}

// ================================================================== the study (newspaper, globe)
function gazetteTexture() {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 2200;
  const x = c.getContext('2d');
  // aged paper
  const g = x.createRadialGradient(800, 1100, 200, 800, 1100, 1400);
  g.addColorStop(0, '#EFE3C4'); g.addColorStop(1, '#D2BC8E');
  x.fillStyle = g; x.fillRect(0, 0, 1600, 2200);
  const r = mulberry(4);
  for (let k = 0; k < 6000; k++) { x.fillStyle = `rgba(110,80,40,${r() * 0.05})`; x.fillRect(r() * 1600, r() * 2200, 2 + r() * 6, 2 + r() * 6); }
  x.fillStyle = '#211A12'; x.textAlign = 'center';
  x.font = 'bold 150px "DejaVu Serif", Georgia, serif'; x.fillText('BOSTON GAZETTE.', 800, 190);
  x.font = 'italic 36px "DejaVu Serif", Georgia, serif'; x.fillText('MONDAY, FEBRUARY 10, 1806.', 800, 260);
  x.fillRect(80, 285, 1440, 5); x.fillRect(80, 296, 1440, 2);
  // columns of small type (illegible, but typeset)
  const words = 'the of and to a in that ship port vessel cargo from arrived sailed Boston Captain goods sold at by with for this on was which be are'.split(' ');
  x.textAlign = 'left'; x.font = '22px "DejaVu Serif", Georgia, serif';
  for (let col = 0; col < 4; col++) {
    let y = 345;
    while (y < 2140) {
      if (r() < 0.06) { x.font = 'bold 26px "DejaVu Serif", Georgia, serif'; x.fillText(['SHIP NEWS.', 'FOR SALE,', 'MARINE LIST.', 'NOTICE.'][Math.floor(r() * 4)], 90 + col * 360, y); x.font = '22px "DejaVu Serif", Georgia, serif'; y += 36; continue; }
      let line = ''; while (line.length < 30) line += words[Math.floor(r() * words.length)] + ' ';
      x.fillStyle = `rgba(33,26,18,${0.55 + r() * 0.35})`;
      x.fillText(line, 90 + col * 360, y); y += 29;
    }
    if (col < 3) { x.fillStyle = '#211A12'; x.fillRect(436 + col * 360, 330, 2, 1820); }
  }
  // the notice (the box the camera reads): clear it and set it larger
  const bx = 455, by = 1040, bw = 690, bh = 410;
  x.fillStyle = '#EDE0BF'; x.fillRect(bx, by, bw, bh);
  x.fillStyle = '#1A140E';
  x.font = 'bold 44px "DejaVu Serif", Georgia, serif'; x.fillText('No joke.', bx + 24, by + 66);
  x.font = '36px "DejaVu Serif", Georgia, serif';
  const lines = ['A vessel with a cargo of 80 tons', 'of Ice has cleared out from this', 'port for Martinique. We hope this', 'will not prove to be a slippery', 'speculation.'];
  lines.forEach((l, i) => x.fillText(l, bx + 24, by + 130 + i * 56));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  // where "slippery speculation" sits on the page (uv), for the underline
  const fx = (px) => px / 1600, fy = (py) => 1 - py / 2200;
  const w1 = x.measureText('will not prove to be a ').width, w2 = x.measureText('slippery').width, w3 = x.measureText('speculation.').width;
  const u = { a: [fx(bx + 24 + w1), fy(by + 130 + 3 * 56 + 10)], b: [fx(bx + 24 + w1 + w2), fy(by + 130 + 3 * 56 + 10)],
    c: [fx(bx + 24), fy(by + 130 + 4 * 56 + 10)], d: [fx(bx + 24 + w3), fy(by + 130 + 4 * 56 + 10)], box: [fx(bx + bw / 2), fy(by + bh / 2)] };
  return { tex: t, u };
}

export function buildStudy(P) {
  const group = new THREE.Group();
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.8), woodMat('#4A2E1C', { plank: 0.25, along: 'x', rough: 0.45 }));
  desk.position.y = 0.76; desk.receiveShadow = true; group.add(desk);
  const gz = gazetteTexture();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.8, 40, 40), new THREE.MeshStandardMaterial({ map: gz.tex, roughness: 0.92, side: THREE.DoubleSide }));
  // a gentle curl
  const pp = paper.geometry.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i); pp.setZ(i, 0.012 * Math.cos(x * 6) + 0.02 * Math.max(0, x - 0.2) ** 1.5 * 10 + 0.006 * Math.sin(y * 9)); }
  paper.geometry.computeVertexNormals();
  paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.12; paper.position.set(-0.25, 0.805, 0.15);
  paper.receiveShadow = true; paper.castShadow = true;
  group.add(paper);
  // ink, quill, candle
  const glassM = new THREE.MeshStandardMaterial({ color: '#1A2228', roughness: 0.1, metalness: 0.2 });
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 16), glassM); ink.position.set(0.32, 0.835, -0.25); ink.castShadow = true; group.add(ink);
  const quill = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.34, 6), new THREE.MeshStandardMaterial({ color: '#EDE6D6', roughness: 0.7 }));
  quill.position.set(0.36, 0.93, -0.24); quill.rotation.z = -0.5; quill.rotation.x = 0.2; quill.castShadow = true; group.add(quill);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 16), new THREE.MeshStandardMaterial({ color: '#EFE6D2', roughness: 0.6 }));
  candle.position.set(0.75, 0.91, -0.45); group.add(candle);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.2) }));
  flame.scale.set(1, 2.2, 1); flame.position.set(0.75, 1.045, -0.45); group.add(flame);
  const cl = new THREE.PointLight(new THREE.Color('#FFB060'), 2.2, 5, 1.6); cl.position.set(0.75, 1.08, -0.45); cl.castShadow = true; cl.shadow.mapSize.set(1024, 1024); group.add(cl);
  // window light from the left, a dim panelled room behind
  const win = new THREE.DirectionalLight(new THREE.Color('#D8E4F0'), 1.5); win.position.set(-3, 3.5, 1.5); win.target.position.set(0, 0.8, 0);
  win.castShadow = true; win.shadow.mapSize.set(2048, 2048); Object.assign(win.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.5, far: 12 });
  group.add(win, win.target);
  const amb = new THREE.HemisphereLight(new THREE.Color('#7A6A58'), new THREE.Color('#2A1E14'), 0.3); group.add(amb);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), woodMat('#3A2618', { plank: 0.6, along: 'y', rough: 0.6 }));
  wall.position.set(0, 2, -1.6); wall.receiveShadow = true; group.add(wall);
  const bright = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 1.9) }));
  bright.position.set(-2.4, 2.0, -1.55); group.add(bright);
  return { group, paper, gz, desk, candle: cl, flame };
}

// ================================================================== the glass
export function buildGlass(P) {
  const group = new THREE.Group();
  const prof = [];
  const Hg = 0.11, Rg = 0.042;
  for (let i = 0; i <= 20; i++) { const u = i / 20; prof.push(new THREE.Vector2(Rg * (0.86 + 0.14 * u), u * Hg)); }
  for (let i = 20; i >= 0; i--) { const u = i / 20; prof.push(new THREE.Vector2(Rg * (0.86 + 0.14 * u) - 0.003, 0.012 + u * (Hg - 0.012))); }
  const gg = new THREE.LatheGeometry(prof, 48);
  const gm = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#F4FAFF'), roughness: 0.03, metalness: 0, transparent: true, opacity: 0.22,
    clearcoat: 1, clearcoatRoughness: 0.0, envMapIntensity: 2.2, specularIntensity: 1, side: THREE.DoubleSide, depthWrite: false });
  patch(gm, { frag: { '#include <opaque_fragment>': `#include <opaque_fragment>
    float fr = pow(1. - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.);
    gl_FragColor.a = clamp(0.05 + fr * 0.7, 0., 1.);
    // facet lines of cut glass
    gl_FragColor.rgb += vec3(0.25) * fr;` } });
  const glass = new THREE.Mesh(gg, gm); glass.renderOrder = 6; group.add(glass);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(Rg * 0.86, Rg * 0.86, 0.012, 48), new THREE.MeshPhysicalMaterial({ color: '#E8F4FA', roughness: 0.05, transparent: true, opacity: 0.5, clearcoat: 1 }));
  base.position.y = 0.006; group.add(base);
  // the drink: a pale lemonade, its surface meniscus
  const liquidH = 0.07;
  const lq = new THREE.Mesh(new THREE.CylinderGeometry(Rg * 0.94 - 0.003, Rg * 0.86 - 0.002, liquidH, 48), new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#8A4A1A'), roughness: 0.05, transparent: true, opacity: 0.78, clearcoat: 1, depthWrite: false, emissive: new THREE.Color('#5A2A08'), emissiveIntensity: 0.35 }));
  lq.position.y = 0.012 + liquidH / 2; lq.renderOrder = 5; group.add(lq);
  const cubes = iceBlocks(4, { glow: 0.25, shadow: true });
  group.add(cubes.mesh);
  const drops = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: new THREE.Color('#E8F6FF'), size: 0.004, transparent: true, opacity: 0.9 }));
  const ND = 120; const dp = new Float32Array(ND * 3); drops.geometry.setAttribute('position', new THREE.BufferAttribute(dp, 3)); drops.frustumCulled = false;
  group.add(drops);
  // condensation beads on the outside
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: 0.02, transparent: true, opacity: 0.3, clearcoat: 1 }), 220);
  const r = mulberry(12); const M = new THREE.Matrix4();
  for (let k = 0; k < 220; k++) {
    const a = r() * 6.28, y = 0.015 + r() * 0.065, rr = Rg * (0.86 + 0.14 * y / Hg) + 0.0008;
    const s = 0.0004 + r() * 0.0007; M.makeScale(s, s * 1.3, s); M.setPosition(Math.cos(a) * rr, y, Math.sin(a) * rr); beads.setMatrixAt(k, M);
  }
  group.add(beads);
  /** drop: time since the cube was let go (s); splash in [0..1] */
  function set(t, tDrop) {
    const lvl = 0.012 + liquidH;
    const c = [[0.012, lvl - 0.006, -0.01, 0.4], [-0.014, lvl - 0.008, 0.012, 1.3], [0.004, lvl - 0.02, 0.016, 2.2]];
    c.forEach(([x, y, z, yaw], i) => cubes.set(i, { x, y: y - 0.016 + 0.002 * Math.sin(t * 2 + i), z, yaw: yaw + 0.05 * Math.sin(t + i), rx: 0.2 * i, sx: 0.016, sy: 0.016, sz: 0.016, round: 0.18, melt: 0.15 }));
    // the falling cube
    const age = t - tDrop;
    const yF = age < 0 ? 0.32 - 0 : Math.max(lvl - 0.022, 0.32 - 4.9 * age * age);
    const bob = age > 0 && yF <= lvl - 0.021 ? 0.006 * Math.exp(-(age - 0.25) * 6) * Math.sin((age - 0.25) * 30) : 0;
    cubes.set(3, { x: -0.004, y: yF + bob, z: -0.002, yaw: 0.6 + age * 2 * (age < 0.25 ? 1 : 0), rx: 0.5 + (age < 0.25 ? age * 4 : 1), sx: 0.017, sy: 0.017, sz: 0.017, round: 0.16, melt: 0.05, hide: age < -0.6 });
    cubes.commit();
    // the splash
    for (let i = 0; i < ND; i++) {
      const rr = mulberry(i * 3 + 1); const a = rr() * 6.28, sp = 0.2 + rr() * 0.5, up = 0.6 + rr() * 0.8;
      const s = age - 0.22;
      if (s < 0 || s > 0.5) { dp[i * 3 + 1] = -10; continue; }
      dp[i * 3] = Math.cos(a) * sp * s * 0.4; dp[i * 3 + 1] = lvl + up * s - 4.9 * s * s; dp[i * 3 + 2] = Math.sin(a) * sp * s * 0.4;
    }
    drops.geometry.attributes.position.needsUpdate = true;
  }
  return { group, set, glass, Hg };
}
