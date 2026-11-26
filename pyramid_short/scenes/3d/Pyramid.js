// scenes/3d/Pyramid.js -- the Great Pyramid Short as one continuous 3D scene: Giza on a floating diorama block.
// Everything is a pure function of t; word times come from renders/cache/scene.json (tools/export.py).
//
// The story clock: the hook shows the finished, white-cased pyramid (3,800 years go by in three days of sun), a
// rolled papyrus asks how, and unrolls into Merer's diary, which fills the screen; behind it we're on the building
// site (a third built, the ramp, the crews). The pyramid grows in a time-lapse; a sledge crew pours water on the sand;
// Merer's boats bring the white stones from Tura across the Nile and down the canal while the last courses and the
// casing go on; a macro of a casing joint against a credit card; the casing is stripped and flown off to Cairo; the
// workers' town, their bread and beer, their tombs; a saucer gets crossed out; the crowd of builders; the casing
// flies back and the camera lands on frame 0.
import * as THREE from 'three';
import { ease, ramp, track, rng, lerp, clamp01, toScreen } from '/scenes/web/runtime.js';
import { buildLand, buildQuarry, buildSky, buildPalms, heightAt, QUARRY, HARBOUR, CANAL, nileX, WATER_Y } from './lib/land.js';
import { buildPyramid, buildTemple, rampGeometry, rampMaterial, GP } from './lib/pyramid.js';
import { figureMaterials, buildFigure, Crowd } from './lib/people.js';
import { buildSledge, Rope, buildPour, buildBerm, buildBoat, buildPapyrus, buildCard, buildRations, buildTown, buildUFO, stoneMaterial } from './lib/props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Polished white limestone seen from a hand's breadth away: mottling, tiny fossil shells, pores. */
function macroStone(P) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#E7DDCB'), roughness: 0.38 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vM;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvM = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vM;
      float hh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      float fb(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.07 + 13.1; a *= .5; } return s; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = vM.xy * 40.;
        float mot = fb(q * 0.6), fine = fb(q * 4.), sp = vn(q * 22.);
        float shell = smoothstep(0.82, 0.9, vn(q * 3.1 + 7.)) * (1. - smoothstep(0.9, 0.97, vn(q * 3.1 + 7.)));
        float pore = smoothstep(0.88, 0.95, sp);
        vec3 c = vec3(1.0) * (0.88 + 0.14 * mot + 0.06 * (fine - .5));
        c *= mix(vec3(1.0), vec3(0.93, 0.88, 0.8), smoothstep(0.45, 0.7, fb(q * 0.25 + 3.)));
        c *= 1. - 0.18 * shell - 0.3 * pore;
        diffuseColor.rgb *= c;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.32 + 0.25 * smoothstep(0.88, 0.95, vn(vM.xy * 880.));');
  };
  return m;
}

export async function setup(ctx) {
  const { renderer, data, overlay: O } = ctx;
  const P = data.palette, A = data.anchors, D = data.duration;
  const Q = new URLSearchParams(location.search);
  const SS = Number(Q.get('ss') || 1.5);
  const col = (h) => new THREE.Color(h);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(col('#E9CFA6'), 500, 4200);
  const camera = new THREE.PerspectiveCamera(36, 1080 / 1920, 0.05, 6000);
  scene.add(camera);

  renderer.shadowMap.enabled = !Q.has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // ================================================================== light: a low sun from the south-west
  const U = { sunDir: { value: new THREE.Vector3() }, uPhase: { value: 0 },
    uQuarry: { value: new THREE.Vector4(QUARRY.x0, QUARRY.x1, QUARRY.z0, QUARRY.z1) },
    uWet: { value: new THREE.Vector4(0, 300, 3, 1) }, uWetDir: { value: new THREE.Vector2(0, 1) }, uWetAmt: { value: 0 }, uTrack: { value: 0 }, uNileX: { value: 0 } };
  const SUN = V(-0.62, 0.36, 0.7).normalize();
  const AXIS = V(0, 0.5, -0.866).normalize();              // the sky turns about the celestial pole (30 deg N)
  const sun = new THREE.DirectionalLight(col(P.sun), 5.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(col('#8FB0DE'), col('#A07A4C'), 0.9);
  scene.add(hemi);
  const bounce = new THREE.DirectionalLight(col('#F3C894'), 0.5);
  bounce.position.set(300, -60, -200);
  scene.add(bounce);
  const sky = buildSky(P, U);
  scene.add(sky);
  const sunNow = new THREE.Vector3();
  function setSun(dir, focus, r) {
    U.sunDir.value.copy(dir);
    sun.position.copy(focus).addScaledVector(dir, 1500);
    sun.target.position.copy(focus);
    const c = sun.shadow.camera;
    if (c.right !== r) { c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1500 - Math.max(r * 2, 300); c.far = 1500 + Math.max(r * 2, 300); c.updateProjectionMatrix(); }
    sun.shadow.normalBias = r < 60 ? 0.02 : 0.5;
  }
  /** Days elapsed in the two time-lapses (whole days, so the sun ends where it started). */
  const days = (t) => 3 * ramp(t, A.y3800 - 0.15, A.years_e + 0.35, ease.inOut) + 6 * ramp(t, A.every_day - 0.1, A.merer_end - 0.05, ease.inOut);

  // ================================================================== the world
  const land = buildLand(P, U);
  scene.add(land.group);
  scene.add(buildQuarry(P));
  const R = rng(7);
  scene.add(buildPalms(P, R));
  const temple = buildTemple(P, heightAt);
  scene.add(temple);
  const town = buildTown(P, heightAt, rng(31));
  scene.add(town);

  const pyr = buildPyramid(P);
  scene.add(pyr.group);
  const h = GP.H / GP.N;
  const queens = [-62, -8, 46].map((z) => {
    const q = buildPyramid(P, { a: 23, H: 30, N: 18, Lc: 3.2, blockL: 1.6 });
    q.group.position.set(178, 0, z);
    scene.add(q.group);
    return q;
  });
  const rampMesh = new THREE.Mesh(new THREE.BufferGeometry(), rampMaterial(P));
  rampMesh.castShadow = true; rampMesh.receiveShadow = true;
  scene.add(rampMesh);
  let rampH = -1, rampInfo = null;
  function setRamp(Ht) {
    rampMesh.visible = Ht > 1;
    if (!rampMesh.visible) return;
    if (Math.abs(Ht - rampH) < 0.01) return;
    rampH = Ht;
    rampMesh.geometry.dispose();
    rampInfo = rampGeometry(Ht, GP);
    rampMesh.geometry = rampInfo.geo;
  }
  const RAMP_X = 40;
  const rampY = (z) => (rampInfo ? Math.max(0, rampH - (z - rampInfo.zTop) * 0.25) : 0);

  // ================================================================== the story clock
  const T_CUT = 12.02;                                     // the diary covers the screen: from here, the building site
  const bAt = (t) => (t < T_CUT ? 1 : track(t, [[T_CUT, 0.33], [A.every_day, 0.33], [A.merer_end, 0.75], [A.along, 0.75], [A.pyramid2_e + 0.1, 1]]));
  const coursesAt = (t) => Math.round(bAt(t) * GP.N);
  const casingAt = (t) => {
    if (t < T_CUT) return GP.N;
    if (t < A.forty) return 0;
    return Math.min(coursesAt(t) - 1.5, GP.N * ramp(t, A.forty, A.pyramid2_e + 0.4, ease.linear)) + (t > A.pyramid2_e + 0.4 ? 2 : 0);
  };
  const stripAt = (t) => (t < A.ropes - 0.25 ? 1.05 * ramp(t, A.took - 0.15, A.cairo_e + 0.35, ease.linear) : 1.05 * (1 - ramp(t, A.ropes - 0.25, D - 0.7, ease.inOut)));
  const rampAt = (t) => (t < T_CUT ? 0 : coursesAt(t) * h * (1 - ramp(t, A.along - 0.1, A.canals + 0.4)));

  // ================================================================== people
  const FM = figureMaterials(P);
  const ropeMat = new THREE.MeshStandardMaterial({ color: col('#B49A6A'), roughness: 0.95 });
  // crew A: hauls a block up the ramp (Merer's shot) and sets it on the top course
  const crewA = { sledge: buildSledge(P), men: [], ropes: [new Rope(ropeMat), new Rope(ropeMat)] };
  for (let i = 0; i < 8; i++) { const f = buildFigure(FM, i + 3); crewA.men.push(f); scene.add(f.root); }
  const merer = buildFigure(FM, 1, { hero: true });
  const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 10), new THREE.MeshStandardMaterial({ color: col(P.papyrus), roughness: 0.8 }));
  scroll.rotation.x = Math.PI / 2; scroll.position.set(0, -0.3, 0.02);
  merer.arms[0].el.add(scroll);
  scene.add(merer.root, crewA.sledge.group, ...crewA.ropes.map((r) => r.mesh));
  // crew B: the close-up on the sand: haulers, the water-pourer, the berm of dry sand
  const crewB = { sledge: buildSledge(P), men: [], ropes: [new Rope(ropeMat), new Rope(ropeMat)] };
  for (let i = 0; i < 12; i++) { const f = buildFigure(FM, i + 11, { headCloth: i % 3 === 0 }); crewB.men.push(f); scene.add(f.root); }
  const pourer = buildFigure(FM, 2, { headCloth: true });
  const pour = buildPour(P);
  pourer.arms[1].el.add(pour.jar); pour.jar.position.set(0.02, -0.33, 0.12); pour.jar.rotation.set(-1.9, 0, 0);
  const berm = buildBerm(P);
  crewB.sledge.group.add(berm);
  scene.add(pourer.root, crewB.sledge.group, pour.pts, ...crewB.ropes.map((r) => r.mesh));
  // the boat crew with Merer at the bow
  const boatHero = buildBoat(P, { L: 22, cargo: 3 });
  const boatMen = [];
  for (let i = 0; i < 7; i++) {
    const f = buildFigure(FM, i + 30, { headCloth: i % 2 === 0 });
    f.root.position.set(i < 6 ? (i % 2 ? 1.2 : -1.2) : 0, 1.41, -6.5 + Math.floor(i / 2) * 2.2);
    if (i === 6) f.root.position.set(0, 1.41, -9.2);
    f.root.rotation.y = 0;
    boatHero.add(f.root); boatMen.push(f);
  }
  const merer2 = buildFigure(FM, 1, { hero: true });
  merer2.root.position.set(0, 1.41, 7.2); boatHero.add(merer2.root);
  const oars = [];
  for (let i = 0; i < 6; i++) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.2, 5), new THREE.MeshStandardMaterial({ color: col('#6B4A2C'), roughness: 0.8 }));
    o.castShadow = true; boatHero.add(o); oars.push(o);
  }
  scene.add(boatHero);
  const boats = [buildBoat(P, { L: 20, cargo: 2 }), buildBoat(P, { L: 18, cargo: 2 }), buildBoat(P, { L: 21, cargo: 3, sail: false }), buildBoat(P, { L: 19, cargo: 2, sail: false })];
  boats.forEach((b) => scene.add(b));

  // tiny people and sledges for the wide shots
  const crowd = new Crowd(3200);
  scene.add(crowd.mesh);
  const miniSledgeGeo = (() => { const g = new THREE.BoxGeometry(1.6, 1.0, 1.2); g.translate(0, 0.75, 0); return g; })();
  const miniSledges = new THREE.InstancedMesh(miniSledgeGeo, stoneMaterial(P, P.rock), 40);
  miniSledges.castShadow = true; miniSledges.receiveShadow = true; miniSledges.frustumCulled = false;
  const miniRunners = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.22, 3.0).translate(0, 0.11, 0), new THREE.MeshStandardMaterial({ color: col(P.wood), roughness: 0.85 }), 40);
  miniRunners.castShadow = true; miniRunners.frustumCulled = false;
  scene.add(miniSledges, miniRunners);
  // blocks of the course being laid on the top platform
  const courseBlocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, h * 0.98, 1.15), stoneMaterial(P, P.rock), 120);
  courseBlocks.castShadow = true; courseBlocks.receiveShadow = true; courseBlocks.frustumCulled = false;
  scene.add(courseBlocks);

  // ================================================================== the diary, the card, rations, the saucer
  const papyrus = buildPapyrus(P, { w: 2.4, h: 1.05 });
  const papHolder = new THREE.Group(); papHolder.add(papyrus.mesh); papyrus.mesh.position.x = -1.2;
  camera.add(papHolder);
  papyrus.mesh.material.transparent = true;
  // macro of the casing joint: two polished stones with a 0.5 mm gap, on the south face's lowest course
  const JX = 98.4, JY = 0.95, faceN = V(0, 1 / GP.H, 1 / GP.a).normalize();
  const JZ = GP.a * (1 - JY / GP.H);
  const jointP = V(JX, JY, JZ);
  const upSlope = V(0, GP.H, -GP.a).normalize();         // up the face, in the face plane
  const macro = new THREE.Group();
  {
    const pol = macroStone(P);
    for (const sd of [-1, 1]) {
      const w = 1.2;
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 0.05), pol);
      s.position.set(sd * (w / 2 + 0.00025), 0, -0.022);
      s.castShadow = true; s.receiveShadow = true;
      macro.add(s);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 1.6), new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
    back.position.z = -0.03; macro.add(back);
    const m = new THREE.Matrix4().makeBasis(V(1, 0, 0), upSlope, faceN);
    macro.quaternion.setFromRotationMatrix(m);
    macro.position.copy(jointP).addScaledVector(faceN, 0.004);
  }
  scene.add(macro);
  const card = buildCard();
  scene.add(card);
  const rations = buildRations(P);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.8), new THREE.MeshStandardMaterial({ color: col(P.mud), roughness: 0.95 }));
  bench.castShadow = true; bench.receiveShadow = true;
  const RAT = V(420, heightAt(420, 318), 318), RAT_D = V(0.8, 0, 0.6), RAT_YAW = Math.atan2(0.8, 0.6);
  bench.position.copy(RAT).add(V(0, 0.27, 0)); rations.group.position.copy(RAT).add(V(0, 0.55, 0));
  bench.rotation.y = RAT_YAW; rations.group.rotation.y = RAT_YAW;
  scene.add(bench, rations.group);
  const ufo = buildUFO();
  scene.add(ufo.group);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(16, 60, 32, 1, true), new THREE.MeshBasicMaterial({ color: col('#B8F3FF'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(beam);

  // Tura: white limestone blocks waiting on the dock
  const turaBlocks = new THREE.Group();
  {
    const wm = stoneMaterial(P, P.casing, { rough: 0.55 });
    const rr = rng(44);
    for (let i = 0; i < 30; i++) {
      const z = 104 + rr() * 92, x = nileX(z) + 66 + rr() * 9;
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.7), wm);
      const stack = i % 3 === 2 ? 1 : 0;
      b.position.set(x, heightAt(x, z) + 0.5 + stack, z); b.rotation.y = (rr() - 0.5) * 0.3;
      b.castShadow = true; b.receiveShadow = true; turaBlocks.add(b);
    }
  }
  scene.add(turaBlocks);
  // birds: kites wheeling over the camera's path (periodic over the video)
  const birds = [];
  {
    const bm = new THREE.MeshStandardMaterial({ color: col('#3A2F27'), roughness: 0.9, side: THREE.DoubleSide });
    const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, 0, 0, -0.2, 0.85, 0, -0.05], 3)); wing.computeVertexNormals();
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.4, 2, 6), bm); body.rotation.x = Math.PI / 2; g.add(body);
      const wl = new THREE.Mesh(wing, bm), wr = new THREE.Mesh(wing, bm); wr.scale.x = -1;
      g.add(wl, wr); g.scale.setScalar(2.2); scene.add(g);
      birds.push({ g, wl, wr, ph: i * 0.9, r: 30 + i * 9, c: V(250 + (i % 3) * 25, 62 + i * 4, 400 + (i % 2) * 30) });
    }
  }
  // smoke from the bakeries, dust in the air (both periodic over the video)
  function puffs(n, size, colr) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: SS }, uSize: { value: size }, uCol: { value: col(colr) } },
      vertexShader: `attribute float aA; varying float vA; uniform float uPx, uSize;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * 1100. * uSize / -mv.z; vA = aA; }`,
      fragmentShader: `varying float vA; uniform vec3 uCol; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(uCol, a); }`,
      transparent: true, depthWrite: false,
    });
    const p = new THREE.Points(geo, mat); p.frustumCulled = false;
    return p;
  }
  const smoke = puffs(90, 5, '#CFC3B2');
  const dust = puffs(160, 0.6, '#F3DDB8');
  scene.add(smoke, dust);

  // ================================================================== crews: placement as a function of time
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  const SLOPE = Math.atan(0.25);
  /** Crew A on the ramp: the sledge's z (centre), the men ahead of it, uphill = -z. */
  function placeCrewA(t, zs, onTop, show) {
    const g = crewA.sledge.group;
    g.visible = show; crewA.men.forEach((f) => (f.root.visible = show)); merer.root.visible = show;
    crewA.ropes.forEach((r) => (r.mesh.visible = show));
    if (!show) return;
    const ys = onTop ? rampH : rampY(zs);
    g.rotation.order = 'YXZ'; g.rotation.set(onTop ? 0 : -SLOPE, Math.PI, 0);
    g.position.set(RAMP_X, ys + 0.02, zs);
    const ph = zs * -2.4;
    const ends = [[], []];
    crewA.men.forEach((f, i) => {
      const row = i % 2, k = Math.floor(i / 2);
      const z = zs - 2.9 - k * 1.25, x = RAMP_X + (row ? 0.75 : -0.75);
      const y = onTop ? rampH : rampY(z);
      f.root.position.set(x, y, z); f.root.rotation.set(0, Math.PI, 0);
      f.set({ walk: ph + k * 0.9 + row * 0.5, stride: 0.85, lean: 0.42, mode: 'haul' });
      ends[row].push(V(x + (row ? 0.08 : -0.08), y + 1.12, z - 0.28));
    });
    const fy = onTop ? rampH : rampY(zs - 1.7);
    crewA.ropes.forEach((r, row) => r.set([V(RAMP_X + (row ? 0.5 : -0.5), fy + 0.4, zs - 1.65), ...ends[row], ends[row][ends[row].length - 1].clone().add(V(0, -1.0, -1.1))]));
    const mz = zs - 2.4;
    merer.root.position.set(RAMP_X - 2.0, onTop ? rampH : rampY(mz), mz); merer.root.rotation.set(0, Math.PI + 0.2, 0);
    merer.set({ walk: ph * 0.8, stride: 0.6, lean: 0.05, mode: 'walk', look: -0.05 });
  }

  /** Crew B on the sand west of the ramp, hauling south (+z, toward the camera): sledge centre z = zs. */
  const XB = 4, ZB0 = 276, VB = 0.78, ZB = 300;
  const zsAt = (t) => ZB0 + VB * (t - A.most) + 0.35 * VB * Math.max(0, t - A.pull - 0.3);   // easier once lighter
  const xsAt = zsAt;
  function placeCrewB(t, show) {
    const g = crewB.sledge.group;
    g.visible = show; crewB.men.forEach((f) => (f.root.visible = show)); pourer.root.visible = show; pour.pts.visible = show;
    crewB.ropes.forEach((r) => (r.mesh.visible = show));
    if (!show) { U.uWetAmt.value = 0; return; }
    const zs = zsAt(t);
    const y0 = heightAt(XB, zs - 1.2), y1 = heightAt(XB, zs + 1.2), ym = (y0 + y1) / 2;
    g.rotation.order = 'YXZ'; g.rotation.set(-Math.atan2(y1 - y0, 2.4), 0, 0);
    g.position.set(XB, ym + 0.02, zs);
    const relT = A.pull + 0.25;
    const ends = [[], []];
    crewB.men.forEach((f, i) => {
      const row = i % 2, k = Math.floor(i / 2);
      const released = row === 1 ? k % 2 === 0 : k % 2 === 1;      // every other man lets go
      const gone = released && t > relT;
      const zsR = gone ? zsAt(relT) : zs;
      const z = zsR + 3.0 + k * 1.2, x = XB + (row ? 0.78 : -0.78) + (gone ? (row ? 1 : -1) * 1.2 * ramp(t, relT, relT + 0.8) : 0);
      const y = heightAt(x, z);
      f.root.position.set(x, y, z);
      f.root.rotation.set(0, gone ? (row ? 1 : -1) * 1.2 * ramp(t, relT, relT + 0.6) : 0, 0);
      const heavy = 1 - 0.6 * ramp(t, A.damp, A.firm + 0.3);           // they lean less once the sand is damp
      if (gone) f.set({ walk: 0, stride: 0.1, lean: 0.05 * (1 - ramp(t, relT, relT + 0.6)), mode: 'stand', look: 0.1 });
      else {
        f.set({ walk: zs * 2.8 + k * 0.9 + row * 0.4, stride: 0.75, lean: 0.25 + 0.3 * heavy, mode: 'haul' });
        ends[row].push(V(x + (row ? -0.06 : 0.06), y + 1.1 - 0.1 * heavy, z + 0.22));
      }
    });
    crewB.ropes.forEach((r, row) => {
      const e = ends[row];
      r.set([V(XB + (row ? 0.5 : -0.5), ym + 0.42, zs + 1.75), ...e, e[e.length - 1].clone().add(V(0, -0.95, 1.0))]);
    });
    // the man on the front of the sledge pours water on the sand ahead of the runners
    const pk = ramp(t, A.poured - 0.35, A.poured + 0.1);
    pourer.root.position.set(XB + 0.3, ym + 0.22, zs + 1.2);
    pourer.root.rotation.set(0, -0.35, 0);
    pourer.set({ mode: 'pour', k: 0.4 + 0.6 * pk, lean: 0.25 * pk });
    pourer.root.updateMatrixWorld(true);
    pour.jar.getWorldPosition(tmpV);
    const lip = tmpV.clone().add(V(0, 0.08, 0.12));
    const pourAmt = ramp(t, A.poured, A.water) * (1 - ramp(t, A.half_e, A.half_e + 0.4));
    pour.update(t, lip, V(-0.12, 0, 1).normalize(), pourAmt);
    // the wet streak: from where the pouring started to where the water lands now
    const zw0 = zsAt(A.poured) + 2.2, zw1 = zs + 2.5;
    U.uWet.value.set(XB, (zw0 + zw1) / 2 - 0.3, Math.max(0.6, (zw1 - zw0) / 2 + 1.5), 1.3);
    U.uWetDir.value.set(0, 1);
    U.uWetAmt.value = ramp(t, A.water - 0.1, A.sand + 0.2);
    // dry sand heaps up in front of the runners, and flattens once it's damp
    berm.userData.set((0.55 + 0.45 * ramp(t, A.most, A.while)) * (1 - ramp(t, A.damp - 0.2, A.firm, ease.inOut)));
    berm.position.set(0, 0.0, 1.85);
  }

  /** Mini crews hauling up the ramp and across the sand, people in the quarry, at the harbour, on the top. */
  const miniM = new THREE.Matrix4(), miniE = new THREE.Euler(), miniS = V(1, 1, 1);
  function placeMinis(t, show, crowdSet) {
    let n = 0;
    if (show && rampInfo) {
      const L = rampInfo.L, zt = rampInfo.zTop;
      for (let k = 0; k < 6; k++) {
        const u = ((k / 6 + t * 0.012) % 1), z = zt + 6 + u * (L - 12), y = rampY(z);
        miniE.set(-SLOPE, Math.PI, 0); tmpQ.setFromEuler(miniE);
        miniM.compose(tmpV.set(RAMP_X + (k % 2 ? 3.5 : -3.5), y, z), tmpQ, miniS);
        miniSledges.setMatrixAt(n, miniM); miniRunners.setMatrixAt(n, miniM); n++;
        for (let j = 0; j < 10; j++) {
          const zz = z - 3 - Math.floor(j / 2) * 1.2, xx = RAMP_X + (k % 2 ? 3.5 : -3.5) + (j % 2 ? 0.7 : -0.7);
          crowdSet.put(xx, rampY(zz), zz, Math.PI, t * 5 + j, 1, 0.4);
        }
      }
      // across the sand from the quarry to the ramp's foot
      for (let k = 0; k < 4; k++) {
        const u = ((k / 4 + t * 0.02) % 1), x = QUARRY.x1 + 6 + u * (RAMP_X - QUARRY.x1 - 14), z = 268 + k * 9;
        const y = heightAt(x, z);
        miniE.set(0, Math.PI / 2, 0); tmpQ.setFromEuler(miniE);
        miniM.compose(tmpV.set(x, y, z), tmpQ, miniS);
        miniSledges.setMatrixAt(n, miniM); miniRunners.setMatrixAt(n, miniM); n++;
        for (let j = 0; j < 8; j++) { const xx = x + 3 + Math.floor(j / 2) * 1.2; crowdSet.put(xx, heightAt(xx, z), z + (j % 2 ? 0.7 : -0.7), Math.PI / 2, t * 5 + j, 1, 0.4); }
      }
      // in the quarry, on the top platform, at the harbour
      const rr = rng(77);
      for (let j = 0; j < 70; j++) {
        const x = QUARRY.x0 + 24 + rr() * (QUARRY.x1 - QUARRY.x0 - 48), z = QUARRY.z0 + 24 + rr() * (QUARRY.z1 - QUARRY.z0 - 48);
        crowdSet.put(x + 0.6 * Math.sin(t * 0.7 + j), -QUARRY.depth, z, rr() * 6, t * 3 + j, 1, rr() < 0.5 ? 0.5 : 0);
      }
      const top = rampH, rTop = GP.a * (1 - top / GP.H) - 3;
      for (let j = 0; j < 46; j++) {
        const a = rr() * 6.28, r = rr() * rTop;
        crowdSet.put(Math.cos(a) * r * 0.9, top, Math.sin(a) * r * 0.9, rr() * 6, t * 3 + j, 1, rr() < 0.4 ? 0.5 : 0);
      }
    }
    if (show) {
      const rr = rng(78);
      for (let j = 0; j < 40; j++) crowdSet.put(HARBOUR.x0 + 4 + rr() * 8, -27.5, HARBOUR.z0 + rr() * (HARBOUR.z1 - HARBOUR.z0), -Math.PI / 2, t * 3 + j, 1, 0);
    }
    const z0 = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = n; i < 40; i++) { miniSledges.setMatrixAt(i, z0); miniRunners.setMatrixAt(i, z0); }
    miniSledges.instanceMatrix.needsUpdate = true; miniRunners.instanceMatrix.needsUpdate = true;
  }

  /** The partly laid course on the top platform, and the gap the hero block slides into. */
  const HERO_SLOT = V(RAMP_X - 10.6, 0, 75.5);
  function placeCourse(t, show) {
    const top = rampH, rr = GP.a * (1 - top / GP.H);
    let n = 0;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1);
    HERO_SLOT.y = top + h / 2;
    if (show) {
      for (let i = 0; i < 80 && n < 118; i++) {
        const x = -rr + 4 + i * 1.62;
        if (x > rr - 3) break;
        if (Math.abs(x - HERO_SLOT.x) < 0.9) continue;                       // the hero block's slot
        M.compose(tmpV.set(x, top + h / 2, 61), q, one); courseBlocks.setMatrixAt(n++, M);
        if (x < 12) { M.compose(tmpV.set(x + 0.8, top + h / 2, 59.8 - 0.05 * (i % 3)), q, one); courseBlocks.setMatrixAt(n++, M); }
      }
      for (let i = 0; i < 46 && n < 118; i++) {
        const x = -rr + 3 + i * 1.62;
        if (x > rr - 3) break;
        if (Math.abs(x - RAMP_X) < 10 || Math.abs(x - HERO_SLOT.x) < 0.9) continue;   // the landing, the hero's slot
        M.compose(tmpV.set(x, top + h / 2, rr - 2.2), q, one); courseBlocks.setMatrixAt(n++, M);
      }
      HERO_SLOT.z = rr - 2.2;
    }
    const z0 = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = n; i < 120; i++) courseBlocks.setMatrixAt(i, z0);
    courseBlocks.instanceMatrix.needsUpdate = true;
  }

  // ================================================================== cameras
  const P0 = V(330, 38, 420), P1 = V(262, 42, 334), TG0 = V(8, 99, 8), TG1 = V(8, 102, 8);
  const T_IN = A.until;                                     // the hook's dolly
  const T_E = 2.0;                                          // the end's run-in along the same line
  const PE = P0.clone().addScaledVector(P1.clone().sub(P0), -T_E / T_IN);
  const TGE = TG0.clone().addScaledVector(TG1.clone().sub(TG0), -T_E / T_IN);
  const lerpV = (a, b, u) => a.clone().lerp(b, u);
  const Y = V(0, 1, 0);
  /** Log-distance move toward/away from a point: from (pos0, d0) to (pos1, d1) along a direction. */
  function cam(t) {
    let pos, tgt, fov = 36, near = 0.5, roll = 0, focus = V(60, 0, 80), fr = 520, up = Y;
    if (t < A.until) {                                      // hook: the dolly in, the time-lapse sky, the question
      const u = ease.out(clamp01(t / T_IN));
      pos = lerpV(P0, P1, u); tgt = lerpV(TG0, TG1, u);
      near = 0.05;
    } else if (t < T_CUT) {                                 // the diary fills the screen
      const u = ramp(t, A.until, T_CUT, ease.inOut);
      pos = lerpV(P1, P1.clone().add(V(-12, 2, -20)), u); tgt = TG1.clone();
      near = 0.05;
    } else if (t < 15.4) {                                  // M1: Merer and his crew on the ramp, the pyramid ahead
      const zs = 214 - 1.1 * (t - T_CUT), ys = rampY(zs);
      const u = ramp(t, T_CUT, 15.4, ease.linear);
      pos = V(RAMP_X - 0.9 + 0.3 * u, ys + 3.6 + 0.2 * u, zs + 11.8 - 1.2 * u); tgt = V(RAMP_X - 1.3, ys + 1.6, zs - 100);
      fov = 40; near = 0.1; focus = V(RAMP_X, ys, zs - 4); fr = 34;
    } else if (t < 18.4) {                                  // M2: crane up over the whole building site
      const u = ramp(t, 15.4, 18.4, ease.inOut);
      const zs = 214 - 1.1 * (15.4 - T_CUT), ys = rampY(zs);
      const p0 = V(RAMP_X - 0.6, ys + 3.8, zs + 10.6), p1 = V(400, 215, 590);
      pos = lerpV(p0, p1, ease.in(u) * 0.6 + u * 0.4); pos.y = lerp(p0.y, p1.y, ease.out(u));
      tgt = lerpV(V(RAMP_X - 1.3, ys + 1.6, zs - 100), V(-25, 22, 150), u);
      fov = lerp(40, 36, u); near = 0.2; focus = lerpV(V(RAMP_X, 0, 200), V(0, 0, 150), u); fr = lerp(60, 340, u);
    } else if (t < A.one - 0.05) {                          // M3a: the ramp, seen whole, rising to the pyramid
      const u = ramp(t, 18.4, A.one - 0.05, ease.inOut);
      pos = lerpV(V(400, 215, 590), V(170, 88, 330), u); tgt = lerpV(V(-25, 22, 150), V(30, 24, 150), u);
      fov = 38; near = 0.5; focus = V(40, 0, 150); fr = 220;
    } else if (t < 21.5) {                                  // M3b: at the landing, a block is set in its place
      const u = ramp(t, A.one - 0.05, 21.5, ease.out);
      const top = rampH;
      pos = lerpV(V(RAMP_X - 17, top + 3.6, 90), V(RAMP_X - 18.5, top + 2.6, 86), u); tgt = V(RAMP_X - 6, top + 0.9, 76);
      fov = 40; near = 0.2; focus = V(RAMP_X - 6, top, 78); fr = 26;
    } else if (t < 23.95) {                                 // M4: the time-lapse, wide
      const u = ramp(t, 21.5, 23.95, ease.inOut);
      pos = lerpV(V(-330, 230, 640), V(-410, 260, 600), u); tgt = V(-20, 46, 90);
      fov = 38; near = 1; focus = V(0, 0, 150); fr = 460;
    } else if (t < 26.0) {                                  // S1: the quarry right beside it
      const u = ramp(t, 23.95, 26.0, ease.inOut);
      pos = lerpV(V(-250, 150, 520), V(-100, 62, 380), u); tgt = lerpV(V(-60, 10, 120), V(-75, -6, 200), u);
      fov = 38; near = 0.5; focus = V(-60, 0, 220); fr = 200;
    } else if (t < 34.45) {                                 // S2: the sledge crew on the sand, coming toward us
      const zs = zsAt(t), u = ramp(t, 26.0, 34.45, ease.linear);
      const y = heightAt(XB, zs);
      const k = ramp(t, 26.0, 27.3, ease.out);
      const far = V(XB - 40, y + 40, zs + 60);
      const close = V(XB + 0.9 - 0.5 * u, y + 2.4 + 0.3 * u, zs + 17 - 1.5 * u);
      pos = lerpV(far, close, k);
      tgt = lerpV(V(XB - 20, y, zs - 60), V(XB + 0.3, y + 4.6, zs - 30), k);
      // look down at the sand ahead while the water goes on it
      const lookSand = ramp(t, A.while, A.poured + 0.3) * (1 - ramp(t, A.because, A.firm));
      tgt.add(V(0, -5.5 * lookSand, 4 * lookSand));
      fov = lerp(40, 36, k); near = 0.05; focus = V(XB, y, zs + 5); fr = 18;
    } else if (t < 37.6) {                                  // B1: Tura -- white stones on the dock, across the Nile
      const u = ramp(t, 34.45, 37.6, ease.inOut);
      pos = lerpV(V(792, -11, 148), V(784, -13, 143), u); tgt = lerpV(V(520, -32, 128), V(480, -26, 110), u);
      fov = 40; near = 0.5; focus = V(735, -28, 140); fr = 70;
    } else if (t < 40.75) {                                 // B2: alongside Merer's boat, bow first
      const bp = boatPos(t);
      const u = ramp(t, 37.6, 40.75, ease.linear);
      const fwd = V(Math.sin(bp.yaw), 0, Math.cos(bp.yaw)), side = V(fwd.z, 0, -fwd.x);
      pos = bp.p.clone().addScaledVector(fwd, 30 - 3 * u).addScaledVector(side, -11 - 1.5 * u).add(V(0, 6.5, 0));
      tgt = bp.p.clone().addScaledVector(fwd, 1).add(V(0, 5.2, 0));
      fov = 38; near = 0.2; focus = bp.p; fr = 40;
    } else if (t < 43.6) {                                  // B3: up the canal; behind it, the pyramid is finished
      const bp = boatPos(t);
      const u = ramp(t, 40.75, 43.6, ease.inOut);
      pos = bp.p.clone().add(V(24 + 30 * u, 4.5 + 26 * u * u, 7 + 6 * u));
      tgt = lerpV(V(160, 22, 22), V(20, 58, 6), u);
      fov = 38; near = 0.5; focus = lerpV(bp.p, V(150, 0, 30), u); fr = lerp(60, 420, u);
    } else if (t < A.so3) {                                 // C1: dive to the casing joint; the credit card
      const u = ramp(t, 43.6, A.joints - 0.1, ease.inOut);
      const end = jointP.clone().addScaledVector(faceN, 0.3).add(V(0.018, 0, 0));
      const start = boatPos(43.6).p.clone().add(V(54, 35, 13));
      const dir = start.clone().sub(end); const L0 = dir.length(); dir.normalize();
      pos = end.clone().addScaledVector(dir, Math.exp(lerp(Math.log(L0), Math.log(1e-4), u)));
      tgt = lerpV(V(20, 58, 6), jointP.clone().add(V(0.018, 0, 0)), ease.out(clamp01(u * 1.15)));
      up = Y.clone().lerp(upSlope, ramp(t, 44.4, A.joints - 0.1, ease.inOut)).normalize();
      fov = lerp(38, 30, u); near = lerp(0.5, 0.004, ease.in(u)); focus = jointP; fr = lerp(300, 4, u);
      if (t > A.joints - 0.1) pos.add(V(-0.012 * ramp(t, A.joints, A.so3), 0, 0));
    } else if (t < A.until2 - 0.05) {                       // C2: pull back to the whole white pyramid, shining
      const u = ramp(t, A.so3, A.shone + 0.2, ease.inOut);
      const start = jointP.clone().addScaledVector(faceN, 0.3).add(V(0.006, 0, 0));
      const endP = V(345, 92, 540);
      const dir = endP.clone().sub(start); const L1 = dir.length(); dir.normalize();
      pos = start.clone().addScaledVector(dir, Math.exp(lerp(Math.log(1e-4), Math.log(L1), u)));
      tgt = lerpV(jointP, V(0, 70, 0), ease.inOut(clamp01(u * 1.3)));
      up = upSlope.clone().lerp(Y, ramp(t, A.so3, A.so3 + 0.6, ease.inOut)).normalize();
      fov = lerp(30, 36, u); near = lerp(0.004, 1, ease.out(u)); focus = V(0, 0, 0); fr = lerp(4, 420, u);
      pos.add(V(-6, 1, -8).multiplyScalar(ramp(t, A.shone + 0.2, A.until2, ease.linear)));
    } else if (t < A.workers - 0.2) {                       // C3: the casing is stripped and flown off to Cairo
      const u = ramp(t, A.until2 - 0.05, A.workers - 0.2, ease.inOut);
      pos = lerpV(V(339, 93, 532), V(-300, 120, 600), u); tgt = lerpV(V(0, 70, 0), V(60, 70, -20), u);
      fov = 36; near = 1; focus = V(0, 0, 0); fr = 420;
    } else if (t < A.because3 + 0.55) {                     // W1: the workers' town
      const u = ramp(t, A.workers - 0.2, A.because3 + 0.55, ease.inOut);
      pos = lerpV(V(500, 22, 360), V(462, 2, 330), u); tgt = lerpV(V(400, -26, 240), V(396, -24, 252), u);
      fov = 38; near = 0.3; focus = V(410, -27, 260); fr = 90;
    } else if (t < A.buried - 0.05) {                       // W2: bread and beer
      const u = ramp(t, A.because3 + 0.55, A.buried - 0.05, ease.inOut);
      const c = RAT.clone().add(V(0, 0.55, 0));
      const side = V(RAT_D.z, 0, -RAT_D.x);
      pos = c.clone().addScaledVector(RAT_D, lerp(5.0, 4.5, u)).addScaledVector(side, lerp(0.32, 0.16, u)).add(V(0, 0.34, 0));
      tgt = c.clone().addScaledVector(RAT_D, -20).addScaledVector(side, 0.14).add(V(0, 0.34 + 20 * Math.tan(0.07), 0));
      fov = 38; near = 0.05; focus = c; fr = 10;
    } else if (t < A.end - 0.1) {                           // W3: their tombs, below the king's pyramid
      const u = ramp(t, A.buried - 0.05, A.end - 0.1, ease.inOut);
      pos = lerpV(V(390, -8, 250), V(370, -2, 235), u); tgt = lerpV(V(280, -10, 190), V(120, 40, 60), u);
      fov = 38; near = 0.3; focus = V(250, -10, 170); fr = 260;
    } else if (t < 61.3) {                                  // E1: it wasn't aliens
      const u = ramp(t, A.end - 0.1, 61.3, ease.inOut);
      pos = lerpV(V(420, 55, 640), V(380, 60, 580), u); tgt = V(0, 95, 0);
      fov = 36; near = 1; focus = V(0, 0, 0); fr = 420;
    } else if (t < 63.15) {                                 // E2: thousands of people
      const u = ramp(t, 61.3, 63.15, ease.inOut);
      pos = lerpV(V(380, 60, 580), V(190, 9, 236), u); tgt = lerpV(V(0, 95, 0), V(70, 26, 80), u);
      fov = 36; near = 0.5; focus = V(90, 0, 140); fr = 260;
    } else if (t < D - T_E) {                               // E3a: rise to the start of the run-in
      const u = ramp(t, 63.15, D - T_E, ease.inOut);
      pos = lerpV(V(190, 9, 236), PE, u); tgt = lerpV(V(70, 26, 80), TGE, u);
      fov = 36; near = 0.3; focus = V(60, 0, 80); fr = 520;
    } else {                                                // E3b: the run-in to frame 0 (same line, same speed)
      const u = ease.in(clamp01((t - (D - T_E)) / T_E));
      pos = lerpV(PE, P0, u); tgt = lerpV(TGE, TG0, u);
      near = 0.05;
    }
    return { pos, tgt, fov, near, roll, focus, fr, up };
  }

  /** Merer's boat: across the Nile (B2), then up the canal (B3). Position, heading. */
  function boatPos(t) {
    if (t < 40.75) {
      const u = ramp(t, 37.6, 40.75, ease.linear);
      return { p: V(lerp(706, 694, u), WATER_Y + 0.15, lerp(126, 114, u)), yaw: -2.356 };
    }
    const u = ramp(t, 40.75, 43.6, ease.linear);
    return { p: V(lerp(470, 452, u), WATER_Y + 0.15, CANAL.z), yaw: -Math.PI / 2 };
  }

  // ================================================================== overlays
  const T = (html, cls) => O.el(html, 't ' + cls);
  const plate = O.el('', 'plate');
  plate.parentNode.insertBefore(plate, plate.parentNode.firstChild);
  const el = {
    title: T('HOW DID THEY<br>BUILD THIS?', 'title'),
    h146: T('146 m', 'mid'), tallest: T('TALLEST THING ON EARTH', 'label'),
    y3800: T('3,800', 'big'), yLab: T('YEARS', 'label'),
    how: T('BUT HOW?', 'mid'), howSub: T('NOBODY WROTE IT DOWN?', 'label'),
    diary: T('THE DIARY OF MERER', 'mid2'), found: T('FOUND IN 2013 · 4,500 YEARS OLD', 'label'),
    merer: T('MERER', 'small'), mererSub: T('INSPECTOR · HIS CREW', 'label'),
    blocks: T('2,300,000', 'big'), blocksLab: T('STONE BLOCKS', 'label'),
    ramp: T('RAMP', 'small'), rampSub: T('EXACT SHAPE STILL DEBATED', 'label'),
    every: T('1 BLOCK', 'mid'), everySub: T('EVERY FEW MINUTES', 'label'),
    years20: T('20 YEARS', 'mid'), yearsSub: T('EVERY DAY', 'label'),
    quarry: T('QUARRY', 'small'), quarrySub: T('RIGHT BESIDE IT', 'label'),
    sledge: T('WOODEN SLEDGE', 'label'),
    dry: T('DRY SAND PILES UP', 'label red'),
    water: T('WATER', 'label'),
    wet: T('DAMP SAND STAYS FIRM', 'label mint'),
    pull: T('PULL', 'label'), pullBar: O.el('', ''), pullVal: T('100%', 'small'),
    tura: T('TURA', 'small'), turaSub: T('FINE WHITE LIMESTONE', 'label'), nile: T('THE NILE', 'label'),
    crew: T('MERER\'S CREW · 40 MEN', 'label'),
    canal: T('CANAL', 'label'), harbour: T('HARBOUR', 'label'),
    joint: O.el('', ''),
    cairo: T('1300s: TAKEN TO BUILD CAIRO', 'label'), cairoArrow: T('→', 'mid'),
    slaves: T('SLAVES?', 'mid'), xSlaves: O.el('', 'xmark'), paid: T('PAID WORKERS', 'small mint'),
    wages: T('BREAD + BEER = WAGES', 'label'),
    tombs: T('WORKERS\' TOMBS', 'label'), king: T('THE KING\'S PYRAMID', 'label'),
    xUfo: O.el('', 'xmark'),
    thousands: T('THOUSANDS OF PEOPLE', 'mid2'),
    tools: T('ROPES · BOATS · WET SAND', 'label'),
  };
  el.merer.style.color = P.gold; el.diary.style.color = P.gold; el.crew.style.color = P.gold;
  Object.assign(el.pullBar.style, { width: '420px', height: '34px', borderRadius: '17px', background: 'rgba(0,0,0,0.45)', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.75)', overflow: 'hidden' });
  el.pullBar.innerHTML = '<div style="height:100%;width:100%;background:#E5482C;border-radius:17px"></div>';
  const pullFill = el.pullBar.firstChild;
  // the joint vs the card, magnified side by side
  el.joint.innerHTML = `<svg width="980" height="387" viewBox="0 0 760 300" style="filter:drop-shadow(0 4px 18px rgba(0,0,0,.7))">
    <g font-family="Inter" font-weight="800" fill="#F7F4EE">
      <rect x="40" y="40" width="300" height="120" rx="10" fill="#EFE8DA"/><rect x="40" y="40" width="300" height="120" rx="10" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="3"/>
      <rect x="184" y="40" width="12" height="120" fill="#120D08"/>
      <text x="190" y="215" font-size="44" text-anchor="middle">JOINT</text><text x="190" y="262" font-size="38" text-anchor="middle" fill="#D9D1C3">0.5 mm</text>
      <rect x="420" y="40" width="300" height="120" rx="10" fill="#EFE8DA"/>
      <rect x="561" y="40" width="18" height="120" fill="#2C5BA8"/>
      <text x="570" y="215" font-size="44" text-anchor="middle">CARD</text><text x="570" y="262" font-size="38" text-anchor="middle" fill="#D9D1C3">0.76 mm</text>
    </g></svg>`;
  const lines = { a: O.line(P.ink, 4), b: O.line(P.ink, 4), c: O.line(P.ink, 4), d: O.line(P.ink, 4), dim: O.line(P.ink, 5) };
  const setLine = (ln, pts, op = 1) => { ln.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')); ln.style.opacity = op; };
  const hideLine = (ln) => { ln.style.opacity = 0; };
  const fadeIn = (t, a, b = a + 0.3) => ramp(t, a, b, ease.out);
  const win = (t, a, b, f = 0.25) => Math.min(fadeIn(t, a, a + f), 1 - ramp(t, b - f, b, ease.inOut));
  const S = (v) => toScreen(v, camera);
  const pop = (t, a) => 1 + 0.25 * Math.exp(-Math.max(0, t - a) * 9) * (t > a ? 1 : 0);

  function overlayAt(t) {
    for (const k in el) el[k].style.opacity = 0;
    for (const k in lines) hideLine(lines[k]);
    let plateOp = 0;
    const top = (e, y, op, extra = {}) => { O.place(e, 540, y, Object.assign({ anchor: 'c', opacity: op }, extra)); if (op > 0) plateOp = Math.max(plateOp, op); };
    // title: frame 0 and the loop
    const tOp = Math.max(1 - ramp(t, A.tallest - 0.25, A.tallest + 0.05), ramp(t, D - 0.55, D - 0.05));
    top(el.title, 420, tOp);
    // 146 m: a dimension line beside the pyramid
    const hOp = win(t, A.tallest, A.y3800 - 0.05);
    if (hOp > 0) {
      const ap = S(V(0, GP.H, 0)), b1 = S(V(GP.a, 0, GP.a));
      const x = Math.min(1000, b1.x + 40);
      setLine(lines.dim, [{ x: x - 18, y: ap.y }, { x: x + 18, y: ap.y }, { x, y: ap.y }, { x, y: b1.y }, { x: x - 18, y: b1.y }, { x: x + 18, y: b1.y }], hOp);
      top(el.h146, 330, hOp); top(el.tallest, 410, hOp);
    }
    // 3,800 years, counting up while the sun races
    const yOp = win(t, A.y3800 - 0.05, A.thought - 0.1);
    if (yOp > 0) {
      const n = Math.round(3800 * ramp(t, A.y3800, A.years_e, ease.out) / 10) * 10;
      el.y3800.textContent = n.toLocaleString('en-US');
      top(el.y3800, 380, yOp); top(el.yLab, 490, yOp);
    }
    top(el.how, 360, win(t, A.thought, A.until + 0.05)); top(el.howSub, 445, win(t, A.nobody, A.until + 0.05));
    const dOp = win(t, A.found - 0.1, T_CUT - 0.15);
    top(el.diary, 330, dOp); top(el.found, 410, win(t, A.found + 0.15, T_CUT - 0.15));
    // Merer on the ramp
    const mOp = win(t, A.merer_w - 0.1, 15.3);
    if (mOp > 0) {
      merer.root.updateMatrixWorld(true);
      const hd = S(merer.root.localToWorld(V(0, 1.85, 0)));
      const lx = Math.max(160, Math.min(920, hd.x)), ly = 520;
      O.place(el.merer, lx, ly - 40, { anchor: 'c', opacity: mOp });
      O.place(el.mererSub, lx, ly + 18, { anchor: 'c', opacity: mOp * win(t, A.crew, 15.3) });
      setLine(lines.a, [{ x: lx, y: ly + 48 }, { x: hd.x, y: hd.y - 10 }], mOp * 0.9);
      plateOp = Math.max(plateOp, mOp * 0.7);
    }
    const bOp = win(t, A.n23 - 0.1, 18.35);
    if (bOp > 0) { el.blocks.style.transform += ''; top(el.blocks, 370, bOp); top(el.blocksLab, 480, bOp); }
    // the ramp, the top
    const rOp = win(t, A.ramps - 0.05, A.one + 0.1);
    if (rOp > 0 && rampInfo) {
      const p = S(V(RAMP_X + 7, rampY(rampInfo.zTop + 25), rampInfo.zTop + 25));
      O.place(el.ramp, 540, 360, { anchor: 'c', opacity: rOp }); O.place(el.rampSub, 540, 430, { anchor: 'c', opacity: rOp });
      setLine(lines.b, [{ x: 540, y: 470 }, { x: p.x, y: p.y }], rOp * 0.9);
      plateOp = Math.max(plateOp, rOp);
    }
    top(el.every, 370, win(t, A.one, 21.5)); top(el.everySub, 450, win(t, A.every, 21.5));
    top(el.years20, 370, win(t, A.every_day, A.merer_end + 0.15)); top(el.yearsSub, 450, win(t, A.every_day, A.merer_end + 0.15));
    // the quarry
    const qOp = win(t, A.cut - 0.1, 26.0);
    if (qOp > 0) {
      const p = S(V((QUARRY.x0 + QUARRY.x1) / 2, -QUARRY.depth, (QUARRY.z0 + QUARRY.z1) / 2));
      top(el.quarry, 360, qOp); top(el.quarrySub, 430, win(t, A.beside - 0.05, 26.0));
      setLine(lines.a, [{ x: 540, y: 470 }, { x: p.x, y: p.y }], qOp * 0.9);
    }
    // the sledge close-up
    const zsB = zsAt(t), yB = heightAt(XB, zsB);
    const sOp = win(t, A.sledges - 0.05, A.while + 0.2);
    if (sOp > 0) {
      const p = S(V(XB - 0.8, yB + 0.35, zsB - 0.6));
      O.place(el.sledge, Math.max(200, Math.min(880, p.x)), 1150, { anchor: 'c', opacity: sOp });
      setLine(lines.a, [{ x: Math.max(200, Math.min(880, p.x)), y: 1120 }, { x: p.x, y: p.y + 10 }], sOp * 0.9);
    }
    const dryOp = win(t, A.most + 2.4, A.poured);
    if (dryOp > 0) {
      const p = S(V(XB - 0.62, yB + 0.12, zsB + 2.05));
      O.place(el.dry, 540, 380, { anchor: 'c', opacity: dryOp });
      setLine(lines.b, [{ x: 540, y: 410 }, { x: p.x, y: p.y }], dryOp * 0.9); plateOp = Math.max(plateOp, dryOp);
    }
    const wOp = win(t, A.water - 0.05, A.because);
    if (wOp > 0) {
      const p = S(V(XB + 0.1, yB + 0.7, zsB + 2.3));
      O.place(el.water, 540, 380, { anchor: 'c', opacity: wOp });
      setLine(lines.c, [{ x: 540, y: 410 }, { x: p.x, y: p.y }], wOp * 0.9); plateOp = Math.max(plateOp, wOp);
    }
    const fOp = win(t, A.damp, A.pull - 0.05);
    if (fOp > 0) {
      const p = S(V(XB, yB + 0.03, zsB + 2.4));
      O.place(el.wet, 540, 380, { anchor: 'c', opacity: fOp });
      setLine(lines.d, [{ x: 540, y: 410 }, { x: p.x, y: p.y }], fOp * 0.9); plateOp = Math.max(plateOp, fOp);
    }
    const pOp = win(t, A.pull - 0.05, A.half_e + 0.45);
    if (pOp > 0) {
      const v = 1 - 0.5 * ramp(t, A.drops, A.half + 0.2);
      pullFill.style.width = `${(v * 100).toFixed(1)}%`;
      pullFill.style.background = v < 0.6 ? P.good : P.accent;
      el.pullVal.textContent = `${Math.round(v * 100)}%`;
      top(el.pull, 330, pOp); O.place(el.pullBar, 540, 400, { anchor: 'c', opacity: pOp }); top(el.pullVal, 480, pOp);
    }
    // Tura, the Nile, the crew, the canal
    const tuOp = win(t, A.white - 0.05, A.so2 - 0.1);
    if (tuOp > 0) {
      const p = S(V(830, 6, 150));
      top(el.tura, 360, tuOp); top(el.turaSub, 430, tuOp);
      setLine(lines.a, [{ x: 540, y: 470 }, { x: p.x, y: p.y }], tuOp * 0.9);
      const n = S(V(nileX(60), WATER_Y, 60));
      O.place(el.nile, Math.max(140, Math.min(940, n.x)), n.y, { anchor: 'c', opacity: win(t, A.nile - 0.05, A.so2 - 0.1) });
    }
    const cOp = win(t, A.forty - 0.1, 40.7);
    if (cOp > 0) {
      boatHero.updateMatrixWorld(true);
      const p = S(merer2.root.localToWorld(V(0, 1.9, 0)));
      top(el.crew, 390, cOp);
      setLine(lines.a, [{ x: 540, y: 420 }, { x: p.x, y: p.y }], cOp * 0.9);
    }
    const caOp = win(t, A.canals - 0.05, 43.55);
    if (caOp > 0) {
      const p = S(V(440, WATER_Y, CANAL.z)), q = S(V((HARBOUR.x0 + HARBOUR.x1) / 2, WATER_Y, (HARBOUR.z0 + HARBOUR.z1) / 2));
      O.place(el.canal, Math.max(140, Math.min(940, p.x)), p.y - 60, { anchor: 'c', opacity: caOp });
      const hOp2 = caOp * win(t, A.almost - 0.1, 43.55);
      O.place(el.harbour, Math.max(140, Math.min(940, q.x)), q.y - 60, { anchor: 'c', opacity: hOp2 });
    }
    // the joint and the card
    const jOp = win(t, A.thinner - 0.1, A.so3 + 0.1);
    if (jOp > 0) { O.place(el.joint, 540, 470, { anchor: 'c', opacity: jOp }); plateOp = Math.max(plateOp, jOp); }
    // to Cairo
    const caiOp = win(t, A.took - 0.1, A.workers - 0.2);
    top(el.cairo, 360, caiOp); top(el.cairoArrow, 440, caiOp, { dy: 0 });
    el.cairoArrow.style.transform += ` translateX(${(40 * Math.sin(t * 6)).toFixed(1)}px)`;
    // workers
    const slOp = win(t, A.builders, A.because3 + 0.4);
    top(el.slaves, 380, slOp);
    if (t > A.slaves + 0.25) { const k = pop(t, A.slaves + 0.25); O.place(el.xSlaves, 540, 380, { anchor: 'c', opacity: slOp }); el.xSlaves.style.transform += ` scale(${k})`; }
    top(el.paid, 490, win(t, A.slaves_e + 0.1, A.because3 + 0.4));
    top(el.wages, 380, win(t, A.paid - 0.05, A.buried - 0.05));
    const tbOp = win(t, A.buried, A.end - 0.1);
    if (tbOp > 0) {
      const p = S(V(296, heightAt(296, 190) + 2, 190)), q = S(V(0, GP.H * 0.8, 0));
      O.place(el.tombs, Math.max(160, Math.min(920, p.x)), p.y + 80, { anchor: 'c', opacity: tbOp });
      O.place(el.king, Math.max(160, Math.min(920, q.x)), 380, { anchor: 'c', opacity: win(t, A.king - 0.1, A.end - 0.1) });
      plateOp = Math.max(plateOp, win(t, A.king - 0.1, A.end - 0.1) * 0.8);
    }
    // the saucer
    if (t > A.built3 - 0.05 && t < 61.2) {
      const p = S(ufo.group.position);
      const k = pop(t, A.built3 - 0.05);
      O.place(el.xUfo, p.x, p.y, { anchor: 'c', opacity: win(t, A.built3 - 0.05, 61.2, 0.1) });
      el.xUfo.style.transform += ` scale(${k * 1.1})`;
    }
    top(el.thousands, 380, win(t, A.thousands - 0.05, A.ropes - 0.1));
    const toOp = win(t, A.ropes - 0.05, D - 0.6);
    if (toOp > 0) {
      const words = ['ROPES', 'BOATS', 'WET SAND'], at = [A.ropes, A.boats3, A.wet];
      el.tools.innerHTML = words.map((w, i) => `<span style="opacity:${t > at[i] - 0.05 ? 1 : 0.0}">${w}</span>`).join('<span style="opacity:.5"> · </span>');
      top(el.tools, 380, toOp);
    }
    plate.style.opacity = Math.min(1, plateOp);
  }

  // ================================================================== update
  const lastCam = { pos: null };
  function update(t, opt = {}) {
    const ft = opt.frameT ?? t;
    U.uPhase.value = 2 * Math.PI * t / D;
    // sun, sky and the time-lapses
    const dd = days(t);
    sunNow.copy(SUN).applyAxisAngle(AXIS, 2 * Math.PI * dd);
    const day = THREE.MathUtils.smoothstep(sunNow.y, -0.06, 0.12);
    sun.intensity = 5.2 * THREE.MathUtils.smoothstep(sunNow.y, -0.01, 0.15);
    hemi.intensity = 0.38 + 0.52 * day;
    bounce.intensity = 0.5 * day;
    sky.material.uniforms.uDay.value = 0.12 + 0.88 * day;
    scene.fog.color.set('#E9CFA6').multiplyScalar(0.3 + 0.7 * day);

    // story state
    const b = bAt(t), courses = coursesAt(t);
    pyr.setCore(courses); pyr.setCasing(casingAt(t)); pyr.setStrip(stripAt(t));
    pyr.U.uShine.value = win(t, A.shone - 0.1, A.until2 + 0.2, 0.3);
    setRamp(rampAt(t));
    const done = t < T_CUT || t > A.pyramid2_e - 0.3;
    const qOn = t < T_CUT || t > 34.45;
    for (const q of queens) { q.group.visible = qOn; q.setCore(q.N); q.setCasing(q.N); q.setStrip(stripAt(t)); }
    temple.visible = qOn;

    // camera
    const C = cam(ft);
    camera.position.copy(C.pos); camera.fov = C.fov; camera.near = C.near; camera.far = C.near < 0.02 ? 1500 : 6000;
    camera.updateProjectionMatrix();
    camera.up.copy(C.up);
    camera.lookAt(C.tgt);
    camera.rotateZ(0.003 * Math.sin(2 * Math.PI * 5 * t / D));
    setSun(sunNow.y > 0 ? sunNow : SUN, C.focus, C.fr);

    // the diary (in front of the camera)
    const papOn = t > A.how - 0.6 && t < T_CUT + 0.5;
    papHolder.visible = papOn;
    if (papOn) {
      const fly = ramp(t, A.how - 0.6, A.did_it_e, ease.out);
      const toCam = ramp(t, A.stones - 0.25, T_CUT, ease.in);
      const past = ramp(t, T_CUT, T_CUT + 0.45, ease.out);
      const z = lerp(-7.2, -0.85, toCam) + 1.0 * past;
      papHolder.position.set(lerp(0.3, 0, fly), lerp(-3.2, -0.26, fly) * (1 - toCam), z);
      papHolder.rotation.set(lerp(0.9, 0.12, fly) * (1 - toCam), lerp(-0.6, -0.08, fly) * (1 - toCam), lerp(0.3, -0.04, fly) * (1 - toCam));
      papyrus.U.uUnroll.value = lerp(0.03, 1, ramp(t, A.until, A.found + 0.3, ease.inOut));
      papyrus.U.uGlow.value = 0.6 * win(t, A.diary - 0.1, T_CUT, 0.3);
      papyrus.mesh.material.opacity = 1 - ramp(t, T_CUT + 0.1, T_CUT + 0.45);
      papyrus.mesh.position.x = -1.2 * papyrus.U.uUnroll.value - 0.0;
    }

    // crews
    const inM1 = ft >= T_CUT && ft < A.one - 0.05;
    const inM3 = ft >= A.one - 0.05 && ft < 21.5;
    if (inM1) placeCrewA(t, 214 - 1.1 * (t - T_CUT), false, true);
    else if (inM3) placeCrewA(t, rampInfo ? rampInfo.zTop + 2.6 : 78, false, true);
    else placeCrewA(t, 0, false, false);
    // the hero block: rides the sledge, then slides off into its slot
    if (inM3) {
      const blk = crewA.sledge.block;
      const u = ramp(t, A.one + 0.25, A.every + 0.55, ease.inOut);
      crewA.sledge.group.updateMatrixWorld(true);
      const start = crewA.sledge.group.localToWorld(V(0, 0.28 + 0.525, -0.1));
      blk.position.set(0, 0.28 + 0.525, -0.1);
      if (u > 0) {
        const w = start.clone().lerp(HERO_SLOT, u); w.y += Math.sin(u * Math.PI) * 0.6;
        blk.position.copy(crewA.sledge.group.worldToLocal(w));
      }
    } else crewA.sledge.block.position.set(0, 0.28 + 0.525, -0.1);
    placeCrewB(t, ft >= 26.0 && ft < 34.45);
    const showMinis = ft >= T_CUT && ft < 26.0 && !(ft > 21.5 && ft < 23.95);
    crowd.begin();
    placeMinis(t, showMinis, crowd);
    placeCourse(t, ft >= 15.4 && ft < 21.5);
    // the boats
    const boatsOn = ft >= 34.45 && ft < 43.6;
    boatHero.visible = boatsOn;
    if (boatsOn) {
      const bp = boatPos(ft);
      boatHero.position.copy(bp.p); boatHero.rotation.set(0.012 * Math.sin(t * 1.7), bp.yaw, 0.02 * Math.sin(t * 1.3));
      if (ft < 37.6) { boatHero.position.set(nileX(150) + 56, WATER_Y + 0.1, 150); boatHero.rotation.y = 0.12; }
      boatMen.forEach((f, i) => {
        if (i < 6) {
          const ph = t * 4.2 + (i % 2) * 0.2;
          f.set({ mode: 'row', walk: ph, stride: 0, lean: 0.25 + 0.2 * Math.sin(ph) });
          const o = oars[i]; const sd = i % 2 ? 1 : -1;
          o.position.set(f.root.position.x + sd * 1.6, 1.3, f.root.position.z + 0.6 - 0.8 * Math.sin(ph));
          o.rotation.set(0.3 * Math.sin(ph), 0, sd * 1.05);
        } else f.set({ mode: 'stand' });
      });
      merer2.set({ mode: 'point', look: -0.1 });
    }
    const bPaths = [[V(nileX(-60) + 20, 0, -60), -0.4], [V(nileX(220) - 25, 0, 220), 2.4], [V(nileX(112) + 55, 0, 112), 0.1], [V(nileX(186) + 54, 0, 186), 0.06]];
    boats.forEach((bt, i) => {
      bt.visible = ft >= 34.45 && ft < 43.6;
      const [p, yaw] = bPaths[i];
      const drift = (t - 34.45) * (i < 2 ? 1.6 : 0);
      bt.position.set(p.x + Math.sin(yaw) * drift, WATER_Y + 0.1, p.z + Math.cos(yaw) * drift);
      bt.rotation.set(0.01 * Math.sin(t * 1.5 + i), yaw, 0.015 * Math.sin(t * 1.1 + i));
    });
    // Tura: men loading the docked boats
    if (ft >= 34.45 && ft < 37.6) {
      const rr = rng(91);
      for (let j = 0; j < 40; j++) {
        const z = 70 + rr() * 110, x = nileX(z) + 62 + rr() * 50;
        crowd.put(x + 0.5 * Math.sin(t + j), heightAt(x, z), z, rr() * 6, t * 4 + j, 1, rr() < 0.3 ? 0.4 : 0);
      }
    }
    // the opening shot: people walking on the plateau (their loop is periodic over the video)
    if (ft < A.until + 0.2 || ft > D - T_E - 0.8) {
      for (let j = 0; j < 22; j++) {
        const grp = j < 12 ? 0 : 1, u = ((t / D) * 2 + (j % 12) / 12 * 0.18 + grp * 0.5) % 1;
        const a0 = grp ? V(250, 0, 330) : V(205, 0, 300), a1 = grp ? V(150, 0, 170) : V(110, 0, 260);
        const x = lerp(a0.x, a1.x, u) + (j % 2 ? 0.8 : -0.8), z = lerp(a0.z, a1.z, u) + (j % 3) * 0.7;
        const k = Math.min(1, u * 12, (1 - u) * 12);
        crowd.put(x, heightAt(x, z), z, Math.atan2(a1.x - a0.x, a1.z - a0.z), t * 6 + j, k, 0);
      }
    }
    // the town (smoke, people), the end crowd
    if (ft >= A.workers - 0.2 && ft < A.end - 0.1) {
      const rr = rng(55);
      for (let j = 0; j < 160; j++) {
        const x = 350 + rr() * 115, z = 196 + rr() * 92 + 2 * Math.sin(t * 0.5 + j);
        crowd.put(x, heightAt(x, z), z, rr() * 6, t * 4 + j, 1, 0);
      }
    }
    const thouK = ramp(t, A.thousands - 0.2, A.thousands + 0.6, ease.out) * (1 - ramp(t, A.boats3 - 0.2, A.wet + 0.3));
    if (thouK > 0.01) {
      const rr = rng(66);
      for (let j = 0; j < 2600; j++) {
        const side = j % 4, s = (rr() * 2 - 1) * 135, d = 120 + rr() * 70;
        const walk = (t * 1.4 * (rr() < 0.5 ? 1 : -1)) % 270;
        const ss = ((s + walk + 405) % 270) - 135;
        let x, z;
        if (side === 0) { x = ss; z = d; } else if (side === 1) { x = d; z = -ss; } else if (side === 2) { x = -ss; z = -d; } else { x = -d; z = ss; }
        crowd.put(x, heightAt(x, z), z, (side + 1) * Math.PI / 2, t * 5 + j, thouK, 0);
      }
      for (let j = 0; j < 500; j++) {
        const k = Math.floor(rr() * 24), r = GP.a * (1 - (k + 1.5) / GP.N), s2 = (rr() * 2 - 1) * r * 0.95;
        const side = rr() < 0.5 ? 0 : 1;
        const x = side ? r + 0.4 : s2, z = side ? s2 : r + 0.4;
        crowd.put(x, (k + 1) * h, z, side ? Math.PI / 2 : 0, t * 4 + j, thouK, 0);
      }
    }
    crowd.end();
    // smoke
    {
      const p = smoke.geometry.attributes.position.array, a = smoke.geometry.attributes.aA.array;
      const on = ft >= A.workers - 0.2 && ft < A.end - 0.1 ? 1 : 0;
      for (let i = 0; i < 90; i++) {
        const k = i % 3, life = 6, age = (t + i * 0.067) % life;
        const x0 = 442 + k * 14, z0 = 222, y0 = heightAt(x0, z0) + 3;
        p[i * 3] = x0 + age * 1.6 + Math.sin(i + age) * 0.8; p[i * 3 + 1] = y0 + age * 2.6; p[i * 3 + 2] = z0 - age * 0.9;
        a[i] = on * 0.32 * Math.sin(Math.PI * age / life);
      }
      smoke.geometry.attributes.position.needsUpdate = true; smoke.geometry.attributes.aA.needsUpdate = true;
      smoke.material.uniforms.uPx.value = SS;
    }
    // dust drifting near the camera in the opening shot (periodic over the video)
    {
      const p = dust.geometry.attributes.position.array, a = dust.geometry.attributes.aA.array;
      const on = 1 - ramp(t, A.how - 0.6, A.how) + ramp(t, D - T_E - 0.5, D - T_E);
      const r2 = rng(5);
      for (let i = 0; i < 160; i++) {
        const ph = 2 * Math.PI * (t / D * 5 + r2());
        const bx = 150 + r2() * 220, bz = 300 + r2() * 240;
        p[i * 3] = bx + 40 * Math.sin(ph); p[i * 3 + 1] = 2 + r2() * 30 + 3 * Math.sin(ph * 2 + i); p[i * 3 + 2] = bz - 30 * Math.cos(ph);
        a[i] = Math.min(1, on) * 0.35 * (0.5 + 0.5 * Math.sin(ph * 3 + i));
      }
      dust.geometry.attributes.position.needsUpdate = true; dust.geometry.attributes.aA.needsUpdate = true;
      dust.material.uniforms.uPx.value = SS;
    }
    pour.mat.uniforms.uPx.value = SS;
    turaBlocks.visible = ft >= 34.45 && ft < 40.8;
    // birds wheel round over the opening shot and the last one
    const birdsOn = ft < A.how + 0.5 || ft > 58.9;
    birds.forEach((B, i) => {
      B.g.visible = birdsOn;
      if (!birdsOn) return;
      const a = 2 * Math.PI * (t / D * (i % 2 ? 4 : -3) + B.ph / 6.28);
      B.g.position.set(B.c.x + B.r * Math.cos(a), B.c.y + 4 * Math.sin(a * 2 + i), B.c.z + B.r * Math.sin(a));
      B.g.rotation.set(0, -a + (i % 2 ? 0 : Math.PI), (i % 2 ? -1 : 1) * 0.35);
      const f = 0.5 * Math.sin(2 * Math.PI * (t / D) * 160 + i * 1.7);
      B.wl.rotation.z = f; B.wr.rotation.z = -f;
    });
    // the macro and the card
    const macroOn = ft > 44.6 && ft < A.until2;
    macro.visible = macroOn; card.visible = macroOn && ft > A.joints - 0.6;
    if (card.visible) {
      // perpendicular to the face, its thin edge into the vertical joint: it can't go in
      const inn = ramp(t, A.joints - 0.6, A.thinner + 0.15, ease.out);
      const bump = Math.exp(-Math.max(0, t - A.thinner - 0.15) * 7) * Math.sin(Math.max(0, t - A.thinner - 0.15) * 30) * 0.0015;
      const e1 = faceN.clone().multiplyScalar(Math.cos(0.62)).addScaledVector(V(1, 0, 0), Math.sin(0.62)).normalize();
      const e3 = e1.clone().cross(upSlope).normalize();
      card.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(e1, upSlope, e3));
      card.position.copy(jointP).addScaledVector(faceN, 0.0072).addScaledVector(e1, 0.0428 + lerp(0.07, 0.0006, inn) + bump).addScaledVector(e3, -0.00038).addScaledVector(upSlope, -0.006);
    }
    // the saucer
    const ufoOn = ft > A.aliens - 0.6 && ft < 61.3;
    ufo.group.visible = ufoOn; beam.visible = ufoOn;
    if (ufoOn) {
      const inU = ramp(t, A.aliens - 0.6, A.aliens + 0.1, ease.out), outU = ramp(t, A.built3 + 0.25, 61.2, ease.in);
      const p = V(-260, 330, -60).lerp(V(0, 205, 0), inU).lerp(V(700, 520, -500), outU);
      ufo.group.position.copy(p); ufo.group.rotation.set(0.15 * Math.sin(t * 3), t * 4, 0.12 * Math.cos(t * 2.5) + 0.3 * outU);
      ufo.group.scale.setScalar(2.4);
      ufo.lights.forEach((l, i) => l.material.color.setHSL(0.13, 1, 0.5 + 0.4 * Math.max(0, Math.sin(t * 12 + i))));
      beam.position.copy(p).add(V(0, -30, 0));
      beam.material.opacity = 0.22 * win(t, A.aliens + 0.05, A.built3 + 0.2, 0.12);
    }
    // rations: hidden outside their shot
    rations.group.visible = bench.visible = ft > A.because3 && ft < A.buried + 0.2;

    if (!opt.sub && !Q.has('nooverlay') && !Q.has('cover')) overlayAt(ft);
    lastCam.pos = C.pos;
  }

  window.dbg = { cam, A, camera, pyr, bAt, casingAt, stripAt, xsAt, rampAt };
  return {
    scene, camera, update,
    post: Q.has('nopost') ? null : { ss: SS, msaa: 0, samples: 1, shutter: 0.5, grain: 0.02, vignette: 0.28, exposure: 1.0, bloom: 0.14, bloomThreshold: 1.5, bg: P.bg },
    blurSamples(t) {
      if (Q.get('blur') === '0') return 1;
      if ((t > A.stones - 0.3 && t < T_CUT + 0.5) || (t > 15.4 && t < 18.4) || (t > 43.6 && t < A.joints) || (t > A.so3 && t < A.until2) ||
          (t > A.y3800 && t < A.years_e + 0.3) || (t > A.every_day && t < A.merer_end) || (t > A.took && t < A.cairo_e + 0.4) ||
          (t > A.built3 && t < 61.3) || (t > 63.0 && t < 65.0)) return 3;
      return 1;
    },
    look(t) {
      return {};
    },
  };
}
