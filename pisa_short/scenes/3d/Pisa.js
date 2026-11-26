// scenes/3d/Pisa.js -- the whole Short as one continuous 3D scene: the Leaning Tower of Pisa on a floating block of
// ground. Everything is a pure function of t (seconds); phrase times, floor events, years and sound cues come from
// renders/cache/scene.json (tools/export.py).
//
// The story clock: the hook topples the tower (what should have happened), freezes it, rewinds it, then keeps
// running time backwards to 1178 (floors lift off). The ground's front half drops away to show the cut; history
// then runs forward: 1173 build, sinking, the war pause (the clay firms up), the ghost of the floors that would have
// failed, the curved upper floors, 1990, the soil drilling, the earthquakes, and back to the opening shot (loop).
import * as THREE from 'three';
import { buildTower, H, R_FOUND, mulberry } from '/scenes/3d/tower.js';
import { buildWorld, buildSky, marbleMaterial, ghostMaterial, buildCypresses, buildPeople, CATINO } from '/scenes/3d/world.js';
import { track, ramp, ease, clamp01, lerp, toScreen } from '/scenes/web/runtime.js';

const DEG = Math.PI / 180;

export async function setup({ renderer, data, overlay, W, H: HH }) {
  const A = data.anchors, P = data.palette, D = data.duration;
  const Q = new URLSearchParams(location.search);
  const SS = Number(Q.get('ss') || 1.5);
  const col = (h) => new THREE.Color(h);
  const scene = new THREE.Scene();
  scene.background = col(P.bg);
  scene.fog = new THREE.Fog(col(P.sky_low), 300, 1100);
  const camera = new THREE.PerspectiveCamera(32, W / HH, 0.5, 5000);

  renderer.shadowMap.enabled = !Q.has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // ================================================================== light: golden-hour sun + sky fill
  const SUN0 = new THREE.Vector3(-0.55, 0.5, 0.67).normalize();
  const sun = new THREE.DirectionalLight(col(P.sun), 4.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 20, far: 360 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  sun.target.position.set(0, 10, 0);
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(col('#8FB0DA'), col('#5E5236'), 0.85);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(col('#9FB6D6'), 0.7);
  fill.position.set(160, 50, -60);
  scene.add(fill);
  const sky = buildSky(P);
  scene.add(sky);
  const sunCol0 = col(P.sun), sunWar = col('#FF7A4A'), hemiSky0 = col('#8FB0DA');

  // ================================================================== ground
  const world = buildWorld(P, renderer);
  const G = world.shared;
  const ground = new THREE.Group();                 // shakes in the earthquakes
  ground.add(world.halves.back, world.halves.front);
  scene.add(ground);
  const cutFace = world.halves.back.children[world.halves.back.children.length - 1];
  cutFace.receiveShadow = false;
  const rnd = mulberry(1234);
  const trees = buildCypresses(P, rnd);
  world.halves.back.add(trees.back); world.halves.front.add(trees.front);
  const people = buildPeople(rnd);
  for (const half of ['back', 'front']) for (const g of people[half]) world.halves[half].add(g);
  const allPeople = [...people.back, ...people.front];
  renderer.localClippingEnabled = true;
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1000);

  // ================================================================== the tower: a chain of floors
  const T = buildTower();
  const marble = marbleMaterial(P);
  const foundMat = marble.clone(); foundMat.onBeforeCompile = marble.onBeforeCompile; foundMat.clippingPlanes = [cutPlane];
  const bronze = new THREE.MeshStandardMaterial({ color: col('#80602F'), metalness: 0.8, roughness: 0.4 });

  function makeChain(material, withFoundation) {
    const fallPivot = new THREE.Group(); fallPivot.position.set(R_FOUND, -3, 0);
    const fallInner = new THREE.Group(); fallInner.position.set(-R_FOUND, 0, 0);
    const root = new THREE.Group();                 // pivot for the lean: the foundation's base centre
    const base = new THREE.Group(); base.position.y = 3 - CATINO.depth;
    fallPivot.add(fallInner); fallInner.add(root); root.add(base);
    let found = null;
    if (withFoundation) {
      found = new THREE.Mesh(T.foundation, foundMat); found.castShadow = true; found.receiveShadow = true; base.add(found);
    }
    const fl = [];
    let parent = base;
    for (let k = 0; k < 8; k++) {
      const holder = new THREE.Group();
      const mesh = new THREE.Mesh(T.floors[k], material);
      if (withFoundation) { mesh.castShadow = true; mesh.receiveShadow = true; }
      holder.add(mesh);
      if (k === 7 && withFoundation) { const b = new THREE.Mesh(T.bells, bronze); b.castShadow = true; holder.add(b); }
      parent.add(holder);
      fl.push({ holder, mesh });
      parent = holder;
    }
    return { fallPivot, root, base, floors: fl, found };
  }
  const tower = makeChain(marble, true);
  ground.add(tower.fallPivot);
  const ghostMat = ghostMaterial(P);
  const ghost = makeChain(ghostMat, false);
  ground.add(ghost.fallPivot);
  const baseArrays = T.floors.map((g) => g.attributes.position.array.slice(0));
  const wedgeNow = new Float32Array(8);

  /** Shear a floor so its top is tilted back by `deg` (taller on the +x, low side). */
  function setWedge(k, deg) {
    if (Math.abs(wedgeNow[k] - deg) < 1e-4) return;
    wedgeNow[k] = deg;
    const pos = T.floors[k].attributes.position, b = baseArrays[k], arr = pos.array, tn = Math.tan(deg * DEG), h = H[k];
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] = b[i + 1] + (b[i + 1] / h) * b[i] * tn;
    }
    pos.needsUpdate = true;
    T.floors[k].computeBoundingSphere();
  }

  // ================================================================== story values
  const F = data.facts;
  const yearKeys = data.years;
  function yearAt(t) {
    if (t <= yearKeys[0][0]) return yearKeys[0][1];
    for (let i = 1; i < yearKeys.length; i++) {
      const [t0, y0] = yearKeys[i - 1], [t1, y1] = yearKeys[i];
      if (t <= t1) return y0 + (y1 - y0) * ease.inOut(clamp01((t - t0) / Math.max(t1 - t0, 1e-6)));
    }
    return yearKeys[yearKeys.length - 1][1];
  }

  // floor events -> per floor
  const evByFloor = Array.from({ length: 8 }, () => []);
  const ghostEv = Array.from({ length: 8 }, () => []);
  for (const [t, f, kind] of data.floors) (kind === 'ghost' ? ghostEv : evByFloor)[f].push([t, kind]);
  const DROP = 0.5, LIFT = 0.5, DROP_H = 10;
  /** { vis, off } for a floor: lifted floors fly up and vanish, landing floors fall in from above. */
  function floorAnim(evs, t, initial = true) {
    let state = initial ? 'built' : 'none', te = -1e9;
    for (const [e, kind] of evs) {
      const start = kind === 'land' || kind === 'ghost' ? e - DROP : e;
      if (t >= start) { state = kind; te = e; }
    }
    if (state === 'built') return { vis: true, off: 0 };
    if (state === 'none') return { vis: false, off: 0 };
    if (state === 'lift') {
      const u = (t - te) / LIFT;
      if (u >= 1) return { vis: false, off: 0 };
      return { vis: true, off: DROP_H * u * u };
    }
    // land / ghost
    if (t < te) { const v = (t - (te - DROP)) / DROP; return { vis: true, off: DROP_H * (1 - v * v) }; }
    const w = (t - te) / 0.3;
    return { vis: true, off: w < 1 ? 0.07 * Math.sin(Math.PI * w) * (1 - w) : 0 };
  }

  // lean of the real tower (degrees) and the settlement under it
  const leanKeys = [
    [0, 4.0], [A.when + 0.55, 4.0], [A.when + 0.8, 4.5], [A.tall, 1.2], [A.y1173 - 0.05, 1.2], [A.y1173 + 0.35, 0],
    [A.sinking, 0], [A.sinking_w + 0.5, 2.0], [A.stopped, 2.0], [A.firmer + 0.6, 2.1], [A.new_floor - 0.2, 2.1],
    [A.hide + 0.4, 2.4], [A.banana_end, 2.4], [A.banana_end + 0.3, 2.7], [A.y1990, 2.7], [A.so_far + 0.6, 4.5],
    [A.straightened - 0.1, 4.5], [A.half_m + 0.5, 4.0], [D, 4.0]];
  const bowlKeys = [[0, 3.0], [A.when + 0.6, 3.0], [A.tall, 1.0], [A.y1173 - 0.05, 1.0], [A.y1173 + 0.35, 0],
    [A.sinking, 0], [A.sinking_w + 0.5, 1.6], [A.stopped, 1.6], [A.firmer + 0.6, 2.0], [A.new_floor, 2.0],
    [A.banana_end + 0.3, 2.4], [A.y1990, 2.4], [A.so_far + 0.6, 3.2], [A.straightened, 3.2], [A.half_m + 0.5, 3.0], [D, 3.0]];
  // the wedge of the upper floors: real (0.3 deg) and exaggerated x5 while we look at the curve
  const EX = 12;
  const exKeys = [[0, 1], [A.taller - 0.2, 1], [A.hide + 0.3, EX * 0.55], [A.curved, EX], [A.y1990 - 0.4, EX], [A.y1990 + 0.7, 1], [D, 1]];
  const WEDGE = [0, 0, 0, 0.34, 0.34, 0.3, 0.3, 0.2];

  // ---------------------------------------------------------------- the hook: the fall, the freeze, the rewind
  const tF0 = 0.22, tFz = A.y800 + 0.12, tRw0 = A.when - 0.08, tRw1 = tRw0 + 0.75;
  const S_FZ = tFz - tF0;
  function fallClock(t) {
    if (t < tF0) return 0;
    if (t < tFz) return t - tF0;
    if (t < tRw0) return S_FZ;
    if (t < tRw1) return S_FZ * (1 - ease.inOut((t - tRw0) / (tRw1 - tRw0)));
    return 0;
  }
  const FALL_MAX = 33 * DEG;
  const fallAngle = (s) => FALL_MAX * Math.pow(clamp01(s / S_FZ), 1.65);
  // joints open as it falls: [floor index whose base is the joint, lag (deg), gap (m)]
  const JOINTS = [[1, -1.0, 0.12], [3, -2.6, 0.35], [5, -6.5, 0.9], [6, -2.0, 0.3], [7, -9.0, 1.4]];
  const jointLag = new Float32Array(8), jointGap = new Float32Array(8);
  function setFallJoints(s) {
    const u = Math.pow(clamp01((s / S_FZ - 0.25) / 0.75), 2);
    jointLag.fill(0); jointGap.fill(0);
    for (const [k, lag, gap] of JOINTS) { jointLag[k] = lag * DEG * u; jointGap[k] = gap * u; }
  }

  function poseChain(ch, { lean, sink, fall = 0, anims = null, wedges = WEDGE, ex = 1, lags = null, gaps = null }) {
    ch.fallPivot.rotation.z = -fall;
    ch.root.position.y = -sink;
    ch.root.rotation.z = -lean * DEG;
    for (let k = 0; k < 8; k++) {
      const h = ch.floors[k].holder;
      const a = anims ? anims[k] : { vis: true, off: 0 };
      h.visible = a.vis;
      h.position.y = (k === 0 ? 0 : H[k - 1]) + a.off + (gaps ? gaps[k] : 0);
      h.rotation.z = (k === 0 ? 0 : wedges[k - 1] * ex * DEG) + (lags ? lags[k] : 0);
    }
  }
  const leanSink = (lean) => 0.45 * lean / 4.0;

  // ---------------------------------------------------------------- debris and dust (precomputed paths)
  const R = mulberry(77);
  const chunkGeo = new THREE.IcosahedronGeometry(1, 0);
  { const p = chunkGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.7 + 0.5 * R()), p.getY(i) * (0.6 + 0.4 * R()), p.getZ(i) * (0.7 + 0.5 * R())); chunkGeo.computeVertexNormals(); }
  const chunkMat = new THREE.MeshStandardMaterial({ color: col(P.marble), roughness: 0.7 });
  const N_CHUNK = 150;
  const chunks = new THREE.InstancedMesh(chunkGeo, chunkMat, N_CHUNK);
  chunks.castShadow = true;
  chunks.frustumCulled = false;
  ground.add(chunks);
  const chunkData = [];
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  function towerPointAt(s, k, local) {
    setFallJoints(s);
    poseChain(tower, { lean: 4.0, sink: leanSink(4.0), fall: fallAngle(s), lags: jointLag, gaps: jointGap });
    tower.fallPivot.updateMatrixWorld(true);
    return tower.floors[k].holder.localToWorld(local.clone());
  }
  for (let i = 0; i < N_CHUNK; i++) {
    const j = JOINTS[Math.floor(R() * JOINTS.length)][0];
    const s0 = S_FZ * (0.45 + 0.5 * R());
    const a = R() * Math.PI * 2, r = 5.5 + 2.4 * R();
    const local = new THREE.Vector3(r * Math.cos(a), (R() - 0.5) * 0.6, r * Math.sin(a));
    const p0 = towerPointAt(s0, j, local);
    const p1 = towerPointAt(s0 + 0.02, j, local);
    const v = p1.sub(p0).multiplyScalar(1 / 0.02);
    v.x += (R() - 0.5) * 6; v.y += R() * 4; v.z += (R() - 0.5) * 6;
    chunkData.push({ s0, p0, v, size: 0.18 + 0.55 * Math.pow(R(), 2), ax: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), w: 2 + 8 * R() });
  }
  // restore
  setFallJoints(0);

  // dust: soft sprites, all emitters in one buffer
  const dust = [];          // { clock: 'fall'|'t', t0, o: Vector3, d: Vector3, sp, life, size, c }
  const addPuff = (clock, t0, o, n, { spread = 1, up = 0.4, sp = 6, life = 2.0, size = 2.5, ring = 0, c = [0.85, 0.8, 0.72] } = {}) => {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2;
      let d;
      if (ring) d = new THREE.Vector3(Math.cos(a), up * R(), Math.sin(a));
      else d = new THREE.Vector3((R() - 0.5) * 2, R() * up * 2, (R() - 0.5) * 2).normalize();
      const oo = ring ? o.clone().add(new THREE.Vector3(Math.cos(a) * ring, 0, Math.sin(a) * ring)) : o.clone().add(new THREE.Vector3((R() - 0.5) * spread, (R() - 0.5) * spread * 0.5, (R() - 0.5) * spread));
      dust.push({ clock, t0: t0 + R() * 0.15, o: oo, d, sp: sp * (0.4 + 0.8 * R()), life: life * (0.6 + 0.6 * R()), size: size * (0.6 + 0.8 * R()), c });
    }
  };
  // the ground giving way under the south side as it starts to fall, and the cracks opening
  addPuff('fall', 0.15, new THREE.Vector3(9.5, -0.3, 0), 110, { spread: 9, up: 0.6, sp: 7, life: 3.0, size: 3.2 });
  for (const [k] of JOINTS) {
    const s0 = S_FZ * 0.55;
    addPuff('fall', s0, towerPointAt(s0, k, new THREE.Vector3(0, 0, 0)), 26, { spread: 9, up: 0.5, sp: 3.5, life: 2.2, size: 2.6, c: [0.9, 0.87, 0.8] });
  }
  setFallJoints(0);
  // landing floors: a ring of dust at the joint
  for (const [te, f, kind] of data.floors) {
    if (kind !== 'land') continue;
    const y = f === 0 ? 0.2 : H.slice(0, f).reduce((a, b) => a + b, 0) - 0.6;
    addPuff('t', te, new THREE.Vector3(0, y, 0), f === 0 ? 60 : 36, { ring: f === 7 ? 4.8 : 7.8, up: 0.25, sp: 5, life: 1.6, size: f === 0 ? 3.2 : 2.2 });
  }

  const dustGeo = new THREE.BufferGeometry();
  const ND = dust.length;
  const dPos = new Float32Array(ND * 3), dSize = new Float32Array(ND), dAlpha = new Float32Array(ND), dCol = new Float32Array(ND * 3);
  dust.forEach((p, i) => dCol.set(p.c, i * 3));
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute('size', new THREE.BufferAttribute(dSize, 1));
  dustGeo.setAttribute('alpha', new THREE.BufferAttribute(dAlpha, 1));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dCol, 3));
  const pointMat = (blending = THREE.NormalBlending) => new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uLight: { value: 1 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; uniform float uScale; varying float vA; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uScale / max(-mv.z, 0.1); vA = alpha; vC = color; }`,
    fragmentShader: `varying float vA; varying vec3 vC; uniform float uLight;
      void main(){ vec2 q = gl_PointCoord - .5; float r = length(q) * 2.; if (r > 1.) discard;
        float a = vA * exp(-r * r * 3.2) * (1. - r); gl_FragColor = vec4(vC * uLight * a, a); }`,
    transparent: true, depthWrite: false, blending,
  });
  const dustMat = pointMat();
  dustMat.blending = THREE.CustomBlending;
  dustMat.blendSrc = THREE.OneFactor; dustMat.blendDst = THREE.OneMinusSrcAlphaFactor;   // premultiplied
  const dustPts = new THREE.Points(dustGeo, dustMat);
  dustPts.frustumCulled = false;
  ground.add(dustPts);

  // water squeezed out of the clay (war) and soil drawn out by the drills (1999-2001): points in the cut plane
  const flows = [];
  const RF = mulberry(91);
  for (let i = 0; i < 170; i++) {           // water: from the clay under the tower, up and out into the sand
    const x0 = (RF() - 0.4) * 22, y0 = -10.5 - RF() * 10;
    const dir = new THREE.Vector3(x0 * 0.06 + (RF() - 0.5) * 0.5, 0.8 + RF() * 0.6, 0).normalize();
    flows.push({ kind: 'water', t0: A.weight - 0.2 + RF() * (A.firmer - A.weight + 0.8), o: new THREE.Vector3(x0, y0, 0.25), d: dir, sp: 2.2 + 2.4 * RF(), life: 1.5 + RF(), size: 0.75 + 0.6 * RF() });
  }
  const drills = [];
  for (let i = 0; i < 6; i++) {             // inclined drills from the north lawn to under the north edge
    const top = new THREE.Vector3(-14 - i * 1.3, 0.0, 0.3), tip = new THREE.Vector3(-5.5 - i * 0.75, -3.7 - (i % 3) * 0.55, 0.3);
    drills.push({ top, tip });
  }
  for (let i = 0; i < 160; i++) {           // soil drawn up the drills
    const dr = drills[i % drills.length];
    flows.push({ kind: 'soil', t0: A.pulled + 0.3 + RF() * (A.half_m - A.pulled), dr, life: 1.1 + 0.5 * RF(), size: 0.9 + 0.5 * RF() });
  }
  const NF = flows.length;
  const fGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(NF * 3), fSize = new Float32Array(NF), fAlpha = new Float32Array(NF), fCol = new Float32Array(NF * 3);
  const water = col(P.water), soilC = col('#3E2E1E');
  flows.forEach((p, i) => fCol.set(p.kind === 'water' ? [water.r * 1.6, water.g * 1.6, water.b * 1.6] : [soilC.r, soilC.g, soilC.b], i * 3));
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('size', new THREE.BufferAttribute(fSize, 1));
  fGeo.setAttribute('alpha', new THREE.BufferAttribute(fAlpha, 1));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const flowMat = pointMat();
  flowMat.blending = THREE.CustomBlending;
  flowMat.blendSrc = THREE.OneFactor; flowMat.blendDst = THREE.OneMinusSrcAlphaFactor;
  const flowPts = new THREE.Points(fGeo, flowMat);
  flowPts.frustumCulled = false;
  world.halves.back.add(flowPts);
  // the drill pipes
  const pipeMat = new THREE.MeshStandardMaterial({ color: col('#C9D0D6'), metalness: 0.3, roughness: 0.35 });
  const pipes = drills.map((dr) => {
    const len = dr.top.distanceTo(dr.tip);
    const g = new THREE.CylinderGeometry(0.3, 0.3, len, 12); g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(g, pipeMat);
    m.position.copy(dr.top);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), tmpV.copy(dr.tip).sub(dr.top).normalize());
    m.userData.len = len;
    world.halves.back.add(m);
    return m;
  });

  // ================================================================== camera shots: [t, [pos], [target], fov]
  const HERO = [[58, 9.5, 86], [3, 24.5, 0], 34];
  const SHOTS = [
    [0.0, ...HERO],
    [tF0 + 0.3, [57, 9.8, 84], [3.5, 24, 0], 34],
    [tFz, [80, 21, 128], [17, 18, 0], 37],
    [tRw0, [104, 30, 96], [17, 19, 0], 37],                     // bullet time: the frozen fall, orbited
    [tRw1, [56, 14, 98], [2, 25, 0], 35],
    [A.tall + 0.2, [44, 12, 80], [1, 18, 0], 34],
    [A.genius, [36, 11, 78], [1, 18, 0], 34],
    [A.hook_end, [22, 10, 80], [0, 18, 0], 34],
    [A.save_tower, [4, 6, 84], [0, 9, 0], 33],
    [A.underground + 0.25, [0, 2, 92], [0, -2, 0], 33],
    [A.y1173 - 0.3, [0, -5.5, 104], [0, -5.5, 0], 32],
    [A.foundation, [0, -5.0, 100], [0, -5.0, 0], 32],
    [A.deep - 0.25, [-8, -3.0, 58], [-5, -2.0, 0], 32],         // the shallow foundation, close
    [A.third - 0.6, [-4, -2.0, 70], [0, 2, 0], 32],
    [A.sinking, [0, -3.5, 98], [0, -2.5, 0], 32],
    [A.went_war, [0, -4.5, 102], [0, -4.5, 0], 32],
    [A.firmer + 0.4, [2, -7.0, 92], [0, -8.5, 0], 32],           // the clay firming up
    [A.kept - 0.3, [2, -6.0, 104], [0, -4.0, 0], 32],
    [A.collapsed - 0.3, [0, 13, 172], [0, 13, 0], 32],           // the ghost floors that would have failed
    [A.war_end, [0, 11, 168], [0, 10, 0], 32],
    [A.new_floor - 0.3, [0, 16, 140], [0, 18, 0], 32],
    [A.hide, [0, 23, 128], [1, 24, 0], 32],
    [A.straight, [0, 24, 124], [1, 24, 0], 32],                  // side profile: the curve
    [A.banana_end - 0.2, [0, 25, 122], [1, 25, 0], 32],
    [A.y1990 + 0.2, [44, 22, 110], [3, 22, 0], 33],              // 1990: closed
    [A.engineers - 0.2, [36, 18, 102], [2, 20, 0], 33],
    [A.pulled, [-8, -1.5, 76], [-8, -3.0, 0], 32],                // the drills under the north side
    [A.straightened - 0.3, [-8, -1.0, 72], [-8, -3.0, 0], 32],
    [A.straightened + 0.35, [6, 53.5, 23], [4.0, 53.0, 0], 30],   // the top: half a metre back
    [A.half_m + 1.0, [6, 53.5, 22], [4.0, 53.0, 0], 30],
    [A.same_clay - 0.1, [0, -2, 122], [0, -1, 0], 32],
    [A.shaking + 0.2, [0, -1, 118], [0, 0, 0], 32],
    [A.so_ground + 0.3, [30, 6, 120], [2, 14, 0], 33],
    [A.reason + 0.4, [52, 9, 96], [3, 22, 0], 34],
    [D - 0.25, ...HERO],
    [D + 1, ...HERO],
  ];
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
  function cameraAt(t) {
    let i = 1;
    while (i < SHOTS.length - 1 && SHOTS[i][0] < t) i++;
    const s0 = SHOTS[i - 1], s1 = SHOTS[i];
    let u = clamp01((t - s0[0]) / Math.max(s1[0] - s0[0], 1e-6));
    u = ease.inOut(u);
    pA.fromArray(s0[1]); pB.fromArray(s1[1]); tA.fromArray(s0[2]); tB.fromArray(s1[2]);
    camera.position.lerpVectors(pA, pB, u);
    const tgt = tA.lerp(tB, u);
    camera.fov = lerp(s0[3], s1[3], u);
    // handheld drift, very gentle
    camera.position.x += 0.35 * Math.sin(t * 0.37) + 0.12 * Math.sin(t * 1.13);
    camera.position.y += 0.25 * Math.sin(t * 0.29 + 1.0);
    camera.updateProjectionMatrix();
    camera.lookAt(tgt);
  }

  // ================================================================== overlays
  const ov = overlay;
  const el = {
    year: ov.el('', 't big'),
    yearLab: ov.el('', 't label'),
    engineer: ov.el('A GENIUS ENGINEER', 't small strike'),
    war: ov.el(`<div style="display:flex;flex-direction:column;align-items:center;gap:6px">${swords(P.accent)}<span>A WAR</span></div>`, 't mid'),
    swords2: ov.el(swords(P.accent), 't'),
    scrim: ov.el('', ''),
    sand: ov.el('SAND', 't label'), clay: ov.el('SOFT, WET CLAY', 't label'), deep: ov.el('DENSE SAND', 't label'),
    depth: ov.el('3 m', 't small'),
    floorN: [ov.el('1', 't small'), ov.el('2', 't small'), ov.el('3', 't small')],
    sinking: ov.el('↓ SINKING', 't small acc'),
    water: ov.el('WATER SQUEEZED OUT', 't label'),
    firm: ov.el('CLAY GETS FIRMER', 't label'),
    ghost: ov.el('IF THEY HAD KEPT BUILDING', 't label acc'),
    taller: ov.el('TALLER ON ONE SIDE', 't label'),
    curve: ov.el('CURVE EXAGGERATED ×12', 't label'),
    closed: ov.el('CLOSED', 't mid acc'),
    soil: ov.el('SOIL REMOVED', 't label'),
    half: ov.el('≈ 45 cm', 't small acc'),
    quakes: ov.el('', 't big'),
    quakeLab: ov.el('STRONG EARTHQUAKES<br>SINCE 1280', 't label'),
  };
  el.war.style.whiteSpace = 'nowrap';
  Object.assign(el.scrim.style, { width: '1080px', height: '760px', background: 'linear-gradient(rgba(10,8,6,0.62), rgba(10,8,6,0.4) 50%, rgba(10,8,6,0))' });
  el.scrim.parentNode.insertBefore(el.scrim, el.scrim.parentNode.firstChild);
  el.quakeLab.style.whiteSpace = 'nowrap'; el.quakeLab.style.textAlign = 'center';
  const leaders = { sand: ov.line(P.ink_dim, 3), clay: ov.line(P.ink_dim, 3), deep: ov.line(P.ink_dim, 3), depth: ov.line(P.ink, 4), axis: ov.line(P.accent, 7), half: ov.line(P.accent, 5), straight: ov.line(P.ink, 4), plumb90: ov.line(P.accent, 4), plumbNow: ov.line(P.ink, 4) };
  leaders.plumb90.setAttribute('stroke-dasharray', '14 10'); leaders.straight.setAttribute('stroke-dasharray', '16 12'); leaders.plumbNow.setAttribute('stroke-dasharray', '14 10');
  const axisDots = [];
  function swords(c) {
    const sw = (rot) => `<g transform="rotate(${rot} 60 60)"><rect x="57" y="6" width="6" height="78" rx="3" fill="#F2EEE6"/>
      <polygon points="57,6 63,6 60,-4" fill="#F2EEE6"/><rect x="44" y="82" width="32" height="7" rx="3" fill="${c}"/>
      <rect x="57" y="89" width="6" height="18" rx="2" fill="${c}"/><circle cx="60" cy="111" r="5" fill="${c}"/></g>`;
    return `<svg width="230" height="230" viewBox="-6 -10 132 132" style="filter:drop-shadow(0 0 18px rgba(0,0,0,.8))">${sw(-40)}${sw(40)}</svg>`;
  }
  const hide = (e) => { e.style.opacity = 0; };
  const setLine = (ln, pts, op = 1) => { ln.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')); ln.style.opacity = op; };
  const W3 = (x, y, z) => toScreen(new THREE.Vector3(x, y, z), camera);
  const fadeIn = (t, a, b = a + 0.35) => ramp(t, a, b, ease.out);
  const fadeWin = (t, a, b, f = 0.3) => Math.min(fadeIn(t, a, a + f), 1 - ramp(t, b - f, b, ease.inOut));
  const yearLabel = (y, t) => {
    if (t < A.y1173 - 0.2) return 'THREE FLOORS';
    if (y < 1175.5 && t < A.stopped) return 'WORK BEGINS';
    if (t < A.stopped - 0.1) return 'THREE FLOORS';
    if (t < A.came_back) return 'WAR · NO BUILDING';
    if (t < A.banana_end) return 'WORK RESUMES';
    if (t < A.y1990 - 0.15) return 'BELL CHAMBER ADDED';
    if (y < 2000.5) return 'CLOSED TO VISITORS';
    return 'REOPENED';
  };

  // ================================================================== update
  let lastT = -1;
  function update(t, opt = {}) {
    const ft = opt.frameT ?? t;
    // ---- clocks
    const s = fallClock(t);
    const fall = fallAngle(s);
    setFallJoints(s);
    const year = yearAt(t);
    const lean = track(t, leanKeys, { fn: ease.inOut });
    const ex = track(t, exKeys, { fn: ease.inOut });

    // ---- the real tower
    const anims = evByFloor.map((evs) => floorAnim(evs, t, true));
    for (let k = 3; k < 8; k++) setWedge(k, WEDGE[k] * (ex > 1.001 ? ex : 1));
    // earthquakes: 4 short pulses, then the long one
    const quakeT = [A.quakes - 0.25, A.quakes + 0.35, A.quakes + 0.95, A.quakes + 1.55];
    let shake = 0;
    for (const q of quakeT) { const a = t - q; if (a > 0 && a < 0.55) shake = Math.max(shake, Math.sin(Math.PI * a / 0.55)); }
    const longQ = fadeWin(t, A.swaying - 0.1, A.so_ground + 0.2, 0.4);
    shake = Math.max(shake, 0.75 * longQ);
    const shudder = s > 0 && s < 0.9 ? 0.22 * Math.sin(s * 71.0) * Math.sin(Math.PI * s / 0.9) : 0;
    const sway = shake * 0.25 * Math.sin(t * 7.0) + shudder;
    poseChain(tower, { lean: lean + sway, sink: leanSink(lean), fall, anims, ex,
      lags: s > 0 ? jointLag : null, gaps: s > 0 ? jointGap : null });
    ground.position.x = shake * 0.55 * Math.sin(t * 31.0);
    ground.position.z = shake * 0.25 * Math.sin(t * 23.0 + 1.0);
    G.uQuake.value = Math.max(shake, longQ);
    G.uTime.value = t;

    // ---- ghost: the floors that would have been built (war), and the "before" outline at the top (1999-2001)
    const gAnims = ghostEv.map((evs, k) => (k < 3 ? { vis: t > A.kept - 0.2 && t < A.collapsed + 2.0, off: 0 } : floorAnim(evs, t, false)));
    const gFail = ramp(t, A.collapsed - 0.05, A.collapsed + 1.3, ease.in);
    let gAlpha = Math.min(fadeIn(t, A.kept - 0.2, A.kept + 0.3), 1 - ramp(t, A.collapsed + 0.7, A.collapsed + 1.8));
    let ghostPose = { lean: 2.0 + 26 * gFail, sink: leanSink(2.0) + 7 * gFail, anims: gAnims, wedges: [0, 0, 0, 0, 0, 0, 0, 0] };
    ghostMat.uniforms.color.value.set(P.accent);
    const beforeW = fadeWin(t, A.straightened - 0.2, A.half_m + 1.2, 0.3);
    if (beforeW > 0) {        // the tower as it was in 1990, faint white, to measure the half metre against
      ghostPose = { lean: 4.5, sink: leanSink(4.5), anims: null, wedges: WEDGE };
      gAlpha = 0.55 * beforeW;
      ghostMat.uniforms.color.value.set(P.accent);
    }
    ghost.fallPivot.visible = gAlpha > 0.003;
    ghostMat.uniforms.alpha.value = gAlpha;
    poseChain(ghost, ghostPose);

    // ---- ground: the front half drops away (bridge) and comes back (end)
    const drop = ramp(t, A.underground - 0.15, A.underground + 0.75, ease.in);
    const back = ramp(t, A.so_ground - 0.1, A.reason + 0.6, ease.inOut);
    const away = drop * (1 - back);
    world.halves.front.position.set(0, -140 * away, 10 * away);
    world.halves.front.rotation.x = 0.08 * away;
    world.halves.front.visible = away < 0.999;
    const cutOn = away > 0.0005;
    cutPlane.constant = cutOn ? 0 : 1000;
    cutFace.visible = cutOn;

    // ---- soil: settlement bowl, the clay firming, the people
    G.uBowl.value = track(t, bowlKeys);
    G.uFirm.value = t < A.y1173 ? 1 : ramp(t, A.squeezed - 0.4, A.firmer + 0.6);
    const tourOn = t < A.when + 0.6 ? 1 : t < A.when + 1.0 ? 1 - (t - A.when - 0.6) / 0.4 : clamp01((t - (A.half_m + 0.4)) / 0.5);
    allPeople.forEach((g, i) => { const k = clamp01(tourOn * 1.6 - (i % 8) * 0.08); g.visible = k > 0.01; g.scale.setScalar(Math.max(0.001, ease.out(k)) * g.userData.s0); });

    // ---- sky and sun: the war tint, the time-lapse of the pause
    const warK = Math.max(fadeWin(t, A.but_war - 0.1, A.bridge + 0.5, 0.35) * 0.75, fadeWin(t, A.went_war - 0.25, A.stopped + 0.9, 0.35) * 0.6);
    const lapse = ramp(t, A.stopped + 0.2, A.firmer + 0.6, ease.inOut);
    const lapseOn = Math.min(fadeIn(t, A.stopped, A.stopped + 0.6), 1 - ramp(t, A.firmer + 0.2, A.firmer + 0.8));
    const days = lapse * 3, dayU = days - Math.floor(days);
    const sd = SUN0.clone();
    let night = 0;
    if (lapseOn > 0) {
      const el0 = Math.asin(SUN0.y), az0 = Math.atan2(SUN0.x, SUN0.z);
      const azv = lerp(az0, -1.1 + 2.2 * dayU, lapseOn);
      const elv = lerp(el0, 0.12 + 0.75 * Math.sin(Math.PI * dayU), lapseOn);
      sd.set(Math.sin(azv) * Math.cos(elv), Math.sin(elv), Math.cos(azv) * Math.cos(elv)).normalize();
      night = lapseOn * Math.pow(Math.max(0, 1 - Math.sin(Math.PI * dayU) * 3), 2) * 0.5 * (days < 2.95 && days > 0.05 ? 1 : 0);
    }
    sun.position.copy(sun.target.position).addScaledVector(sd, 180);
    sky.material.uniforms.sunDir.value.copy(sd);
    sky.material.uniforms.uWar.value = warK;
    sky.material.uniforms.uTime.value = t + lapse * 40;
    sky.material.uniforms.uDim.value = night;
    sun.color.copy(sunCol0).lerp(sunWar, warK * 0.8);
    sun.intensity = 4.6 * (1 - 0.25 * warK) * (1 - 0.8 * night);
    hemi.intensity = 0.85 * (1 - 0.5 * night);
    hemi.color.copy(hemiSky0).lerp(col('#B0624A'), warK * 0.6);

    // ---- debris
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (let i = 0; i < N_CHUNK; i++) {
      const c = chunkData[i];
      const a = s - c.s0;
      if (a <= 0) { m4.makeScale(0, 0, 0); chunks.setMatrixAt(i, m4); continue; }
      tmpV.copy(c.p0).addScaledVector(c.v, a); tmpV.y -= 4.9 * a * a;
      q4.setFromAxisAngle(c.ax, c.w * a);
      sc.setScalar(c.size);
      m4.compose(tmpV, q4, sc);
      chunks.setMatrixAt(i, m4);
    }
    chunks.instanceMatrix.needsUpdate = true;
    chunks.visible = s > 0;

    // ---- dust
    for (let i = 0; i < ND; i++) {
      const p = dust[i];
      const age = (p.clock === 'fall' ? s : t) - p.t0;
      if (age <= 0 || age >= p.life || (p.clock === 'fall' && s <= 0)) { dAlpha[i] = 0; dSize[i] = 0; continue; }
      const u = age / p.life;
      const dist = p.sp * 0.8 * (1 - Math.exp(-age / 0.8));
      dPos[i * 3] = p.o.x + p.d.x * dist; dPos[i * 3 + 1] = p.o.y + p.d.y * dist + 0.6 * age; dPos[i * 3 + 2] = p.o.z + p.d.z * dist;
      dSize[i] = p.size * (0.6 + 1.6 * u);
      dAlpha[i] = 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.4 + 0.05)) * (1 - u);
    }
    dustGeo.attributes.position.needsUpdate = true; dustGeo.attributes.size.needsUpdate = true; dustGeo.attributes.alpha.needsUpdate = true;

    // ---- water and soil flows
    const pipeIn = ramp(t, A.engineers + 0.1, A.pulled + 0.3, ease.out) * (1 - ramp(t, A.half_m + 0.6, A.half_m + 1.1, ease.in));
    pipes.forEach((m) => { m.visible = pipeIn > 0.01; m.scale.set(1, Math.max(pipeIn, 0.001), 1); });
    for (let i = 0; i < NF; i++) {
      const p = flows[i];
      const age = t - p.t0;
      if (age <= 0 || age >= p.life) { fAlpha[i] = 0; fSize[i] = 0; continue; }
      const u = age / p.life;
      if (p.kind === 'water') {
        fPos[i * 3] = p.o.x + p.d.x * p.sp * age; fPos[i * 3 + 1] = p.o.y + p.d.y * p.sp * age; fPos[i * 3 + 2] = p.o.z;
        fAlpha[i] = 0.95 * Math.sin(Math.PI * u);
      } else {
        tmpV.lerpVectors(p.dr.tip, p.dr.top, u);
        fPos[i * 3] = tmpV.x; fPos[i * 3 + 1] = tmpV.y + 0.05; fPos[i * 3 + 2] = 1.1;
        fAlpha[i] = 0.9 * Math.sin(Math.PI * u) * pipeIn;
      }
      fSize[i] = p.size;
    }
    fGeo.attributes.position.needsUpdate = true; fGeo.attributes.size.needsUpdate = true; fGeo.attributes.alpha.needsUpdate = true;

    // ---- camera (shots follow the frame time, so sub-frames do not jitter between cuts)
    cameraAt(t);
    // landing thumps shake the camera a little
    let thump = 0;
    for (const [te, f, kind] of data.floors) if (kind === 'land') { const a = t - te; if (a > 0 && a < 0.35) thump = Math.max(thump, (1 - a / 0.35) * (f === 0 || f === 7 ? 1 : 0.6)); }
    camera.position.y += thump * 0.18 * Math.sin(t * 60);
    camera.position.x += shake * 0.3 * Math.sin(t * 27);
    camera.updateMatrixWorld();
    const uScale = (HH * SS) / (2 * Math.tan(camera.fov * DEG / 2));
    dustMat.uniforms.uScale.value = uScale;
    flowMat.uniforms.uScale.value = uScale;
    scene.updateMatrixWorld(true);
    G.uTowerInv.value.copy(tower.base.matrixWorld).invert();

    if (Q.has('cover')) {                       // the thumbnail: the tower low in the frame, sky above for the title
      camera.position.set(70, 3, 116); camera.fov = 34; camera.updateProjectionMatrix(); camera.lookAt(4, 37.5, 0);
      camera.updateMatrixWorld();
      return;
    }
    if (opt.sub) return;
    overlays(t, year, { s, lean, ex });
    lastT = t;
  }

  // ================================================================== overlays per frame
  function overlays(t, year, st) {
    // the year
    const yOn = Math.max(fadeWin(t, A.y800 + 0.2, A.hook_end + 0.1, 0.25), fadeWin(t, A.y1173 - 0.2, A.kept - 0.1, 0.3),
      fadeWin(t, A.came_back - 0.3, A.same_clay - 0.1, 0.3));
    const qOn0 = fadeWin(t, A.quakes - 0.3, A.so_ground + 0.1, 0.25);
    const textOn = Math.max(yOn, qOn0, fadeWin(t, A.kept + 0.1, A.collapsed + 1.4, 0.3), fadeWin(t, A.genius - 0.05, A.bridge + 0.4, 0.25));
    ov.place(el.scrim, 0, 0, { anchor: 'tl', opacity: 0.85 * textOn });
    const yr = Math.round(year);
    el.year.textContent = String(yr);
    const rolling = Math.abs(year - yr) > 0.02 && ((t > A.when && t < A.tall) || (t > A.stopped && t < A.firmer + 0.6) || (t > A.y1990 - 0.2 && t < A.so_far + 0.1));
    el.year.style.color = rolling ? P.ink_dim : P.ink;
    ov.place(el.year, 540, 330, { anchor: 'c', opacity: yOn });
    el.yearLab.textContent = yearLabel(year, t);
    const spinning = t > A.y1990 - 0.2 && year < 1989.5;
    ov.place(el.yearLab, 540, 445, { anchor: 'c', opacity: yOn * (t < A.tall - 0.2 || spinning ? 0 : 1) });
    ov.place(el.swords2, 540, 610, { anchor: 'c', opacity: fadeWin(t, A.went_war - 0.1, A.stopped + 1.2, 0.25) });

    // hook: "a genius engineer" struck out, then "a war"
    const engOn = fadeWin(t, A.genius - 0.05, A.but_war + 0.15, 0.25);
    const strike = ramp(t, A.but_war - 0.45, A.but_war - 0.05, ease.inOut);
    el.engineer.style.setProperty('--sw', `${(strike * el.engineer.offsetWidth).toFixed(0)}px`);
    ov.place(el.engineer, 540, 585, { anchor: 'c', opacity: engOn * (t > A.but_war + 0.05 ? 0.4 : 1) });
    const warOn = fadeWin(t, A.but_war + 0.05, A.bridge + 0.4, 0.2);
    const pop = 1 + 0.25 * Math.exp(-Math.max(0, t - A.but_war - 0.05) * 9);
    ov.place(el.war, 540, 610, { anchor: 'c', opacity: warOn });
    if (warOn > 0) el.war.style.transform += ` scale(${pop.toFixed(3)})`;

    // the cut: layer labels (ground beat, faded out in the war beat)
    const layOn = fadeWin(t, A.clay - 0.4, A.sinking - 0.2, 0.35);
    const lab = (e, ln, wx, wy, side = 1, op = layOn) => {
      const p = W3(wx, wy, 0.4);
      const x2 = side > 0 ? 1000 : 80;
      setLine(ln, [p, { x: x2 - side * 10, y: p.y }], op * 0.8);
      ov.place(e, x2, p.y - 32, { anchor: side > 0 ? 'r' : 'l', opacity: op });
    };
    lab(el.sand, leaders.sand, 18, -4.5);
    lab(el.clay, leaders.clay, 18, -15.5, 1, layOn);
    el.clay.style.color = P.ink;
    lab(el.deep, leaders.deep, 18, -27);
    // foundation depth: a dimension line beside the foundation's north edge
    const dOn = fadeWin(t, A.deep - 0.35, A.third - 0.1, 0.25);
    { const a = W3(-10.8, 0, 1.0), b = W3(-10.8, -3, 1.0);
      setLine(leaders.depth, [{ x: a.x - 14, y: a.y }, { x: a.x + 14, y: a.y }, a, b, { x: b.x - 14, y: b.y }, { x: b.x + 14, y: b.y }], dOn);
      ov.place(el.depth, a.x + 28, (a.y + b.y) / 2, { anchor: 'l', opacity: dOn }); }
    // floor numbers as they land
    for (let i = 0; i < 3; i++) {
      const te = data.floors.find((e) => e[1] === i && e[2] === 'land')[0];
      const on = fadeWin(t, te - 0.05, A.sinking + 0.2, 0.2);
      const y = (i === 0 ? 5.5 : 10.8 + (i - 1) * 6.3 + 3.2) - 0.6;
      const p = W3(-9.6, y, 0);
      ov.place(el.floorN[i], p.x - 14, p.y, { anchor: 'r', opacity: on });
    }
    { const p = W3(5, -6.0, 0); ov.place(el.sinking, p.x, p.y, { anchor: 'c', opacity: fadeWin(t, A.sinking + 0.2, A.ground_end + 0.2, 0.3) }); }
    // war: water and firmer clay
    { const p = W3(0, -6.5, 0); ov.place(el.water, 540, p.y, { anchor: 'c', opacity: fadeWin(t, A.squeezed - 0.1, A.firmer + 0.2, 0.3) }); }
    { const p = W3(0, -24.8, 0); ov.place(el.firm, p.x, p.y, { anchor: 'c', opacity: fadeWin(t, A.firmer - 0.1, A.kept + 0.1, 0.3) }); }
    ov.place(el.ghost, 540, 330, { anchor: 'c', opacity: fadeWin(t, A.kept + 0.1, A.collapsed + 1.4, 0.3) });
    // banana: wedges and the axis
    ov.place(el.taller, 540, 560, { anchor: 'c', opacity: fadeWin(t, A.taller - 0.1, A.straight - 0.1, 0.3) });
    const axOn = fadeWin(t, A.straight + 0.2, A.y1990 + 0.1, 0.35);
    if (axOn > 0) {
      const pts = [];
      pts.push(toScreen(tower.base.localToWorld(new THREE.Vector3(0, 0, 0)), camera));
      const top7Landed = tower.floors[7].holder.visible && Math.abs(tower.floors[7].holder.position.y - H[6]) < 0.3;
      for (let k = 0; k < 8; k++) {
        if (k === 7 && !top7Landed) break;
        pts.push(toScreen(tower.floors[k].holder.localToWorld(new THREE.Vector3(0, H[k], 0)), camera));
      }
      const draw = ramp(t, A.straight + 0.2, A.curved + 0.4, ease.inOut);
      const n = Math.max(2, Math.ceil(draw * pts.length));
      window.__axis = pts;
      setLine(leaders.axis, pts.slice(0, n), axOn);
      // a straight reference: the direction of the first three floors, carried on to the top
      const p0 = pts[0], p3 = pts[3], L = pts.length - 1;
      const sd = ramp(t, A.curved - 0.2, A.like_banana + 0.2, ease.inOut);
      setLine(leaders.straight, [p0, { x: p0.x + (p3.x - p0.x) * (L / 3), y: p0.y + (p3.y - p0.y) * (L / 3) }], axOn * sd * 0.9);
    } else { setLine(leaders.axis, [{ x: 0, y: 0 }], 0); setLine(leaders.straight, [{ x: 0, y: 0 }], 0); }
    ov.place(el.curve, 540, 1600, { anchor: 'c', opacity: fadeWin(t, A.hide, A.y1990 - 0.3, 0.3) });
    // modern
    ov.place(el.closed, 540, 600, { anchor: 'c', opacity: fadeWin(t, A.close - 0.05, A.engineers + 0.1, 0.15) });
    { const p = W3(-14, 2.5, 0); ov.place(el.soil, p.x, p.y - 30, { anchor: 'c', opacity: fadeWin(t, A.pulled + 0.3, A.straightened - 0.2, 0.3) }); }
    const hOn = fadeWin(t, A.straightened + 0.5, A.half_m + 1.1, 0.3);
    if (hOn > 0) {
      // from the 1990 top (ghost) to today's top, at the top cornice of the bell chamber
      const topNow = tower.floors[7].holder.localToWorld(new THREE.Vector3(0, 5.3, 0));
      ghost.fallPivot.updateMatrixWorld(true);
      const top90 = ghost.floors[7].holder.localToWorld(new THREE.Vector3(0, 5.3, 0));
      const a = toScreen(top90, camera), b = toScreen(topNow, camera);
      const y = Math.min(a.y, b.y) - 110;
      setLine(leaders.half, [{ x: a.x, y: y - 16 }, { x: a.x, y: y + 16 }, { x: a.x, y }, { x: b.x, y }, { x: b.x, y: y - 16 }, { x: b.x, y: y + 16 }], hOn);
      // plumb lines from the top's centre then (red) and now (white), down across the bell chamber
      const a2 = toScreen(ghost.floors[7].holder.localToWorld(new THREE.Vector3(0, -4, 0)), camera);
      const b2 = toScreen(tower.floors[7].holder.localToWorld(new THREE.Vector3(0, -4, 0)), camera);
      setLine(leaders.plumb90, [{ x: a.x, y: y + 16 }, a2], hOn * 0.9);
      setLine(leaders.plumbNow, [{ x: b.x, y: y + 16 }, b2], hOn * 0.9);
      ov.place(el.half, (a.x + b.x) / 2, y - 56, { anchor: 'c', opacity: hOn });
    } else { setLine(leaders.half, [{ x: 0, y: 0 }], 0); setLine(leaders.plumb90, [{ x: 0, y: 0 }], 0); setLine(leaders.plumbNow, [{ x: 0, y: 0 }], 0); hide(el.half); }
    // earthquakes: 1, 2, 3, 4
    const qOn = fadeWin(t, A.quakes - 0.3, A.so_ground + 0.1, 0.25);
    const n = [A.quakes - 0.25, A.quakes + 0.35, A.quakes + 0.95, A.quakes + 1.55].filter((q) => t >= q).length;
    el.quakes.textContent = String(Math.max(1, n));
    el.quakes.style.color = n >= 4 ? P.accent : P.ink;
    ov.place(el.quakes, 540, 330, { anchor: 'c', opacity: qOn });
    ov.place(el.quakeLab, 540, 470, { anchor: 'c', opacity: qOn });
  }

  window.dbg = () => ({ rot: tower.floors.map((f) => +(f.holder.rotation.z / DEG).toFixed(2)), wedge: Array.from(wedgeNow).map((x) => +x.toFixed(2)), axis: (window.__axis || []).map((p) => [Math.round(p.x), Math.round(p.y)]) });
  return {
    scene, camera, update,
    post: Q.has('nopost') ? null : { ss: SS, msaa: Number(Q.get('msaa') ?? 0), samples: 1, shutter: 0.5, grain: 0.022, vignette: 0.32, exposure: 1.0, bg: P.bg },
    blurSamples(t) {
      if (t > tF0 + 1.2 && t < tFz) return 3;                // the fast end of the fall
      if (t > tRw0 && t < tRw1) return 4;                    // the rewind
      return 1;
    },
    look(t) {
      const frz = fadeWin(t, tFz, tRw0 + 0.1, 0.12);
      return { mono: 0.55 * frz, exposure: 1.0 - 0.06 * frz };
    },
  };
}
