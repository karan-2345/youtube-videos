// scenes/3d/Pyramid.js -- the whole Short as one 3D world with four sets, cut on the words:
//   desert   the Giza plateau at golden hour: a team of 20 hauling a 2.5 t block on a sled (a man on the front pours
//            water on the sand), more teams on the road, the Great Pyramid two-thirds built; and, far off, the
//            colossus of Djehutihotep's painting hauled by 172 men in four rows.
//   tomb     the painted wall (lib/painting.js), lit by a torch.
//   lab      the 2014 experiment: a tray of sand, a small sled, a force sensor, a beaker of water.
//   macro    sand grains and the water bridges between them.
// The hook paints the live desert over into the painting with brush strokes; the painting is wiped away into the 3D
// colossus the same way. Everything is a pure function of t; the last frame flows into the first (the sled's
// position, the strides, the dust and the camera are all periodic or matched across the loop).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { track, ramp, ease, clamp01, lerp, toScreen } from '/scenes/web/runtime.js';
import { mulberry, DEG } from '/scenes/3d/lib/common.js';
import { buildCrowd, haulPose } from '/scenes/3d/lib/people.js';
import { buildSky, buildTerrain, buildPyramid, buildMotes, groundH, PYR } from '/scenes/3d/lib/desert.js';
import { buildSled, buildBlock, rope, buildColossus, waterStream, particles } from '/scenes/3d/lib/props.js';
import { paintingTextures, wallMaterial, paintOverMaterial, WALL, PW, PH, POURER, STATUE, REG, ROWS, PER_ROW } from '/scenes/3d/lib/painting.js';
import { buildLab, TRAY, SLED } from '/scenes/3d/lib/lab.js';
import { buildGrains } from '/scenes/3d/lib/grains.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export async function setup({ renderer, data, overlay, W, H: HH }) {
  const A = data.anchors, P = data.palette, D = data.duration, HZ = data.haul_hz;
  const Q = new URLSearchParams(location.search);
  const SS = Number(Q.get('ss') || 1.5);
  const col = (h) => new THREE.Color(h);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, W / HH, 0.3, 9000);
  scene.add(camera);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const fogDesert = new THREE.Fog(col(P.sky_low), 250, 5200);

  // ================================================================== sets
  const SETS = { desert: new THREE.Group(), tomb: new THREE.Group(), lab: new THREE.Group(), macro: new THREE.Group() };
  for (const g of Object.values(SETS)) scene.add(g);
  SETS.tomb.position.set(0, 0, 20000);
  SETS.lab.position.set(20000, 0, 0);
  SETS.macro.position.set(-20000, 0, 0);

  // ---------------------------------------------------------------- desert: light
  const SUN = V3(0.42, 0.3, 0.86).normalize();
  const sun = new THREE.DirectionalLight(col(P.sun), 4.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  SETS.desert.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(col('#A9C3E6'), col('#B08A5A'), 0.95);
  SETS.desert.add(hemi);
  const sky = buildSky(P);
  sky.material.uniforms.sunDir.value.copy(SUN);
  SETS.desert.add(sky);
  const sandU = { uTracks: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] }, uRoad: { value: 1 } };
  const terrain = buildTerrain(P, sandU);
  SETS.desert.add(terrain.group);
  const pyr = buildPyramid(P);
  SETS.desert.add(pyr.group);
  const motes = buildMotes(600, 5);
  SETS.desert.add(motes);

  // ---------------------------------------------------------------- the people
  const N_TEAM = 20, N_FAR_T = 6, N_FAR = 10, N_COL = ROWS * PER_ROW;
  const N = N_TEAM + 1 + N_FAR_T * N_FAR + N_COL + 2 + 3;
  const crowd = buildCrowd(P, N, 9);
  SETS.desert.add(crowd.group);
  const IDX = { team: 0, pourer: N_TEAM, far: N_TEAM + 1, col: N_TEAM + 1 + N_FAR_T * N_FAR };
  IDX.colPourer = IDX.col + N_COL; IDX.clapper = IDX.colPourer + 1; IDX.carriers = IDX.clapper + 1;
  const rnd = mulberry(31);
  const jitter = Array.from({ length: N }, () => ({ ph: (rnd() - 0.5) * 0.9, dx: (rnd() - 0.5) * 0.18, dz: (rnd() - 0.5) * 0.12, sc: 0.94 + 0.12 * rnd(), lean: (rnd() - 0.5) * 0.08 }));

  // ---------------------------------------------------------------- the hauling team (the hero) and the far teams
  const V = 0.45;                                    // m/s
  const Xs = (t) => (t < D * 0.5 ? V * t : V * (t - D));   // the hero sled: continuous within every desert shot, and across the loop
  const BLOCK = [1.3, 0.85, 1.0];
  function makeTeam(nw, rowsZ, ropeLen) {
    const g = new THREE.Group();
    const sled = buildSled(P);
    g.add(sled.group);
    const block = buildBlock(P, BLOCK); block.position.set(-0.25, sled.top, 0); g.add(block);
    const ropes = rowsZ.map((z) => {
      const r = rope(P, 0.022);
      const pts = [V3(1.3, 0.32, Math.sign(z) * 0.45), V3(2.3, 1.0, z * 0.9), V3(3.1, 1.36, z), V3(3.0 + ropeLen * 0.5, 1.38, z), V3(3.0 + ropeLen, 1.36, z)];
      r.userData.setPoints(pts); g.add(r); return r;
    });
    SETS.desert.add(g);
    return { g, sled, block, ropes, top: sled.top };
  }
  const team = makeTeam(N_TEAM, [-0.62, 0.62], 10.2);
  const FAR = [];
  for (let k = 0; k < N_FAR_T; k++) {
    const road = k % 3 === 2 ? 42 : 0;
    FAR.push({ x0: road ? 60 + k * 70 : 34 + k * 46, z: road, team: makeTeam(N_FAR, [-0.62, 0.62], 5.2) });
  }
  const pourStream = waterStream(P, 0.03); SETS.desert.add(pourStream);
  // ---------------------------------------------------------------- the colossus site (x = -2000)
  const XC0 = -2000;
  const Xc = (t) => XC0 + 0.28 * (t - 22);
  const colos = new THREE.Group();
  const bigSled = buildSled(P, { len: 7.2, width: 3.0, runnerH: 0.42, beams: 9 });
  colos.add(bigSled.group);
  const statue = buildColossus(P); statue.position.set(-0.6, bigSled.top, 0); colos.add(statue);
  const COL_Z = [-3.3, -1.1, 1.1, 3.3], COL_X0 = 6.2, COL_DX = 0.8;
  for (const z of COL_Z) {
    const r = rope(P, 0.04);
    const len = COL_DX * (PER_ROW - 1) + 1.0;
    r.userData.setPoints([V3(3.6, 0.7, Math.sign(z) * 1.3), V3(4.9, 1.1, z * 0.85), V3(COL_X0, 1.36, z), V3(COL_X0 + len * 0.5, 1.38, z), V3(COL_X0 + len, 1.35, z)]);
    colos.add(r);
  }
  SETS.desert.add(colos);
  const colStream = waterStream(P, 0.045); SETS.desert.add(colStream);

  // ---------------------------------------------------------------- dust and splashes
  const dust = particles(420, '#E8C79A'); SETS.desert.add(dust);
  const splash = particles(160, '#CFEFFF', { soft: false }); SETS.desert.add(splash);

  // ---------------------------------------------------------------- tomb
  const ptex = paintingTextures(renderer);
  const wallMat = wallMaterial(P, ptex);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WALL.w, WALL.h, 1, 1), wallMat);
  wall.position.set(0, 0.6 + WALL.h / 2, 0); wall.receiveShadow = true;
  SETS.tomb.add(wall);
  const stoneMat = new THREE.MeshStandardMaterial({ color: col('#6E5A44'), roughness: 0.95 });
  const surround = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.3), stoneMat); surround.position.set(0, 2.9, -0.17); SETS.tomb.add(surround);
  const tFloor = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), stoneMat); tFloor.rotation.x = -Math.PI / 2; tFloor.position.set(0, 0, 3.5); SETS.tomb.add(tFloor);
  const torch = new THREE.PointLight(col('#FFB26B'), 60, 30, 1.6); torch.position.set(-1.5, 3.4, 4.8); SETS.tomb.add(torch);
  const torch2 = new THREE.PointLight(col('#FFC890'), 28, 30, 1.6); torch2.position.set(3.5, 1.5, 4.2); SETS.tomb.add(torch2);
  const tombAmb = new THREE.AmbientLight(col('#5A4A3A'), 0.6); SETS.tomb.add(tombAmb);
  // uv (0..1) on the painting -> world point on the wall, and the frontal camera that frames a window of it
  const wallPt = (u, v) => SETS.tomb.localToWorld(V3((u - 0.5) * WALL.w, 0.6 + v * WALL.h, 0));
  const FOV_WALL = 36;
  function wallCam(u, v, hv) {
    const dist = hv * WALL.h / Math.tan(FOV_WALL * DEG / 2);
    const p = wallPt(u, v);
    return { pos: p.clone().add(V3(0, 0, dist)), tgt: p, fov: FOV_WALL };
  }
  const hvToHu = (hv) => hv * (W / HH) * WALL.h / WALL.w;
  const UV = (x, y) => [x / PW, 1 - y / PH];
  const POUR_UV = UV(POURER.x + 70, POURER.y - 170), STAT_UV = UV(STATUE.x + 120, STATUE.y - 650);
  // the brush-stroke sheet in front of the camera
  const sheetMat = paintOverMaterial(P, ptex);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sheetMat);
  sheet.renderOrder = 100; sheet.frustumCulled = false;
  camera.add(sheet);

  // ---------------------------------------------------------------- lab
  const lab = buildLab(P, renderer);
  SETS.lab.add(lab.group);
  const key = new THREE.SpotLight(col('#FFF1DE'), 9, 6, 0.6, 0.7, 1.2);
  key.position.set(-0.6, 1.4, 0.9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0015; key.shadow.normalBias = 0.004; key.castShadow = !Q.has('nolabshadow');
  key.target.position.set(0, 0, 0);
  SETS.lab.add(key, key.target);
  const rim = new THREE.DirectionalLight(col('#9CC6FF'), 1.4); rim.position.set(1.5, 0.8, -1.5); SETS.lab.add(rim);
  const labAmb = new THREE.HemisphereLight(col('#B9C6D6'), col('#3A3028'), 0.5); SETS.lab.add(labAmb);
  const labStream = waterStream(P, 0.006); SETS.lab.add(labStream);
  const labSplash = particles(120, '#CFEFFF', { soft: false }); SETS.lab.add(labSplash);
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 16), new THREE.ShaderMaterial({
    uniforms: { a: { value: col('#16283A') }, b: { value: col('#06090E') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 a, b; varying vec3 vP;
      void main(){ vec3 d = normalize(vP); float k = smoothstep(-0.2, 0.6, d.y) ; vec3 c = mix(a, b, k);
        float blob = exp(-pow(length(d.xz - vec2(-0.6, -0.5)) * 2.2, 2.)) * 0.6 + exp(-pow(length(d.xz - vec2(0.7, -0.6)) * 3.0, 2.)) * 0.35;
        gl_FragColor = vec4(c + vec3(0.12, 0.16, 0.22) * blob * (1. - k), 1.); }`,
    side: THREE.BackSide, depthWrite: false,
  }));
  SETS.lab.add(backdrop);

  // ---------------------------------------------------------------- macro
  const grains = buildGrains(P, roomEnv, { n: 230 });
  SETS.macro.add(grains.group);
  const mKey = new THREE.DirectionalLight(col('#FFE8C8'), 1.9); mKey.position.set(-1.5, 2.5, 2.0); mKey.castShadow = true;
  mKey.shadow.mapSize.set(2048, 2048); Object.assign(mKey.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 8 });
  mKey.shadow.bias = -0.0005; mKey.target.position.set(0, -0.3, 0);
  SETS.macro.add(mKey, mKey.target);
  const mRim = new THREE.DirectionalLight(col('#7FB2FF'), 1.6); mRim.position.set(2, 0.6, -2); SETS.macro.add(mRim);
  const mAmb = new THREE.HemisphereLight(col('#6B7C99'), col('#2A1E14'), 0.5); SETS.macro.add(mAmb);
  const mBack = backdrop.clone(); mBack.material = backdrop.material.clone();
  mBack.material.uniforms.a.value = col('#2A1C12'); mBack.material.uniforms.b.value = col('#0A0705');
  SETS.macro.add(mBack);
  const runner = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 1.4), (await import('/scenes/3d/lib/props.js')).woodMaterial(P));
  runner.castShadow = true; SETS.macro.add(runner);

  // ================================================================== shots (cut on the frame time)
  const [tPaint0, tPaint1] = data.shots.paint;           // the desert painted over into the wall
  const [tWipe0, tWipe1] = data.shots.wipe;              // the painting wiped away into 3D
  const SHOTS = data.shots.cuts;
  const shotAt = (t) => { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x[1]) s = x; return s; };
  const setOf = { hook: 'desert', wall: 'tomb', colossus: 'desert', lab1: 'lab', macro: 'macro', lab2: 'lab', colossus2: 'desert', pyramid: 'desert', team: 'desert', crane: 'desert' };

  // ================================================================== cameras
  // the hook path, relative to the hero sled (x follows the sled); u in seconds, u < 0 is the end's crane coming down
  const HOOK = [
    // u,     pos (rel),            target (rel),        fov
    [-2.2, [-12.0, 15.0, 15.0], [26.0, 2.0, -6.0], 40],
    [0.0, [-5.0, 2.5, 2.0], [4.5, 0.7, -0.6], 38],
    [4.3, [-4.0, 2.1, 1.9], [5.5, 0.8, -0.5], 36],
    [7.2, [-9.0, 9.5, 8.5], [40.0, 6.0, -8.0], 38],
    [8.6, [3.6, 1.2, 2.6], [1.6, 0.7, 0.0], 34],
    [11.0, [2.9, 0.95, 1.65], [1.5, 0.75, 0.0], 30],
  ];
  function keyCam(keys, u) {
    const tr = (sel) => track(u, keys.map((k) => [k[0], sel(k)]), { fn: ease.inOut });
    return {
      pos: V3(tr((k) => k[1][0]), tr((k) => k[1][1]), tr((k) => k[1][2])),
      tgt: V3(tr((k) => k[2][0]), tr((k) => k[2][1]), tr((k) => k[2][2])),
      fov: tr((k) => k[3]),
    };
  }
  function hookCam(u, xs) {
    const c = keyCam(HOOK, u);
    c.pos.x += xs; c.tgt.x += xs;
    // a gentle hand-held drift
    c.pos.x += 0.06 * Math.sin(u * 0.9); c.pos.y += 0.04 * Math.sin(u * 1.3 + 1);
    return c;
  }

  function cameraFor(shot, t) {
    const name = shot[0];
    if (name === 'hook') return hookCam(t, Xs(t));
    if (name === 'wall') {
      // hold on the pourer (it pours), pull back to the whole wall, count the men, push in on the statue
      const pullBack = ramp(t, A.p_that - 0.1, A.old + 0.4, ease.inOut);
      const toRows = ramp(t, A.men170 - 0.6, A.men170 + 0.2, ease.inOut);
      const toStat = ramp(t, A.pulling - 0.1, tWipe0, ease.in);
      let u = lerp(POUR_UV[0], 0.3, pullBack), v = lerp(POUR_UV[1], 0.47, pullBack), hv = lerp(0.16, 0.82, ease.out(pullBack));
      const pan = ramp(t, A.men170 - 0.4, A.statue - 0.2, ease.inOut);
      u = lerp(u, lerp(0.42, 0.66, pan), toRows); v = lerp(v, 0.5, toRows); hv = lerp(hv, 0.6, toRows);
      u = lerp(u, STAT_UV[0], toStat); v = lerp(v, STAT_UV[1], toStat); hv = lerp(hv, 0.3, toStat);
      const c = wallCam(u, v, hv);
      // pulled back, the camera swings a little off the wall's axis so the plaster catches the torch
      const swing = Math.sin(Math.PI * clamp01(pullBack - toStat)) * 0.0;
      c.pos.x += swing;
      c.uv = [u, v, hv];
      return c;
    }
    if (name === 'colossus' || name === 'colossus2') {
      const xc = Xc(t);
      const keys = name === 'colossus' ? [
        [tWipe0, [-0.7, 3.7, 17.0], [-0.7, 3.6, 0], 32],
        [tWipe1 + 0.3, [2.5, 4.8, 18.5], [1.5, 3.2, 0], 34],
        [A.while - 0.2, [-14.0, 16.0, 24.0], [14.0, 1.5, -1.0], 40],
        [A.front1 - 0.2, [8.6, 1.8, 0.1], [3.4, 1.35, 0.35], 34],
        [A.ritual + 1.0, [7.8, 1.65, 0.05], [3.4, 1.45, 0.35], 30],
      ] : [
        [A.so_man - 0.12, [0.9, 4.6, 3.3], [5.4, 0.6, -0.1], 38],
        [A.end, [1.4, 4.3, 3.0], [5.6, 0.6, -0.1], 35],
      ];
      const c = keyCam(keys, t);
      c.pos.x += xc; c.tgt.x += xc;
      return c;
    }
    if (name === 'lab1' || name === 'lab2') {
      const sx = labState(t).sledX;
      const keys = name === 'lab1' ? [
        [A.lab, [-0.55, 0.62, 0.78], [0.0, -0.02, 0.0], 34],
        [A.pulled + 0.2, [-0.48, 0.3, 0.55], [-0.12, 0.0, 0.0], 32],
        [A.piling - 0.4, [0.42, 0.12, 0.34], [0.05, 0.01, 0.0], 30],
        [A.wall + 0.6, [0.36, 0.1, 0.3], [0.06, 0.01, 0.0], 28],
        [A.but + 0.2, [-0.2, 0.55, 0.62], [0.0, 0.0, 0.0], 34],
        [A.pull, [-0.4, 0.28, 0.5], [-0.15, 0.0, 0.0], 32],
        [A.tiny, [-0.25, 0.22, 0.42], [-0.05, 0.0, 0.0], 30],
      ] : [
        [A.glides - 0.75, [-0.1, 0.22, 0.42], [0.12, 0.0, 0.0], 30],
        [A.toomuch - 0.3, [0.05, 0.5, 0.62], [0.15, 0.0, 0.0], 34],
        [A.mudw + 0.3, [0.42, 0.16, 0.36], [0.2, 0.0, 0.0], 30],
        [A.so_man, [0.4, 0.13, 0.3], [0.21, 0.0, 0.0], 28],
      ];
      const c = keyCam(keys, t);
      const follow = name === 'lab1' ? (t > A.pull ? sx + 0.26 : 0) * 0.6 : 0;
      c.pos.add(SETS.lab.position).add(V3(follow, 0, 0)); c.tgt.add(SETS.lab.position).add(V3(follow, 0, 0));
      return c;
    }
    if (name === 'macro') {
      const u = t - (A.tiny - 0.12);
      const c = { pos: V3(-1.2 + 0.1 * u, 0.95 - 0.03 * u, 2.6 - 0.1 * u), tgt: V3(0.1, -0.05, 0), fov: 34 };
      c.pos.add(SETS.macro.position); c.tgt.add(SETS.macro.position);
      return c;
    }
    if (name === 'pyramid') {
      const u = clamp01((t - A.end) / (A.same - A.end));
      const p = V3(lerp(-60, -20, u), lerp(16, 20, u), lerp(200, 185, u)), tg = V3(PYR.x - 40, 52, PYR.z);
      return { pos: p, tgt: tg, fov: lerp(36, 33, u) };
    }
    if (name === 'team') {
      const xs = Xs(t), u = t - (A.same - 0.2);
      return { pos: V3(xs + 6.0 + 0.4 * u, 2.4, 9.5 - 0.3 * u), tgt: V3(xs + 6.5, 0.9, 0), fov: 38 };
    }
    // crane: from the team up into the hook's own path (u = t - D) for the last 2.2 s
    const xs = Xs(t), t0 = A.million - 1.0, t1 = D - 2.2;
    if (t < t1) {
      const a = cameraFor(['team'], t0), b = hookCam(-2.2, Xs(t1));
      const u = ease.inOut(clamp01((t - t0) / (t1 - t0)));
      a.pos.x += xs - Xs(t0); a.tgt.x += xs - Xs(t0);
      b.pos.x += xs - Xs(t1); b.tgt.x += xs - Xs(t1);
      return { pos: a.pos.lerp(b.pos, u), tgt: a.tgt.lerp(b.tgt, u), fov: lerp(a.fov, b.fov, u) };
    }
    return hookCam(t - D, xs);
  }

  // ================================================================== the lab's story
  const LX0 = -0.26;
  function labState(t) {
    const tDry0 = A.pulled - 0.1, tDry1 = A.but - 0.25;
    const tRw = A.but - 0.25, tRw1 = A.but + 0.35;
    const tWet0 = A.pull - 0.25;
    const s = { sledX: LX0, start: LX0, heap: 0, groove: 0, sink: 0, tilt: 0, wet: 0, wetR: 0, wetC: [0, 0], mud: 0, puddle: 0, level: 1, ride: 0,
      beaker: { on: 0, x: 0, y: 0.25, z: 0, tilt: 0, fill: 1 }, force: 0, forceCol: 'ink', pouring: 0, pourAmt: 0 };
    // dry run: slow, jerky (stick-slip), the heap builds
    if (t >= tDry0 && t < tRw) {
      const u = t - tDry0;
      const prog = 0.034 * u - 0.004 * Math.sin(u * 7.0) * (1 - Math.exp(-u));
      s.sledX = LX0 + Math.max(0, prog);
      s.heap = 0.036 * (1 - Math.exp(-u / 2.8));
      s.groove = 0.004 * (1 - Math.exp(-u / 1.5));
      s.tilt = -0.05 * (1 - Math.exp(-u / 2)) - 0.01 * Math.sin(u * 7.0);
      s.force = 1.0 + 0.07 * Math.sin(u * 7.0 + 0.5) + 0.03 * Math.sin(u * 17.0);
      s.forceCol = 'accent';
    }
    if (t >= tRw && t < tWet0) {
      // reset: the sled slides back, the sand is levelled again
      const u = ease.inOut(clamp01((t - tRw) / (tRw1 - tRw)));
      const xEnd = LX0 + 0.034 * (tRw - tDry0);
      s.sledX = lerp(xEnd, LX0, u);
      s.heap = 0.036 * (1 - u); s.groove = 0.004 * (1 - u); s.level = 1 - u; s.tilt = -0.05 * (1 - u);
    }
    // water: the beaker comes in, tips, the dark front spreads out from where it lands
    const pour = (t0, t1, amt) => {
      const on = Math.min(ramp(t, t0 - 0.5, t0, ease.out), 1 - ramp(t, t1 + 0.1, t1 + 0.6, ease.in));
      const tip = Math.min(ramp(t, t0, t0 + 0.4, ease.inOut), 1 - ramp(t, t1 - 0.2, t1 + 0.2, ease.inOut));
      return { on, tip };
    };
    const p1 = pour(A.right - 0.4, A.water2 + 0.25, 1), p2 = pour(A.toomuch - 0.45, A.mudw - 0.1, 2);
    const pp = t < A.toomuch - 1.5 ? p1 : p2;
    s.beaker.on = pp.on;
    const bx = t < A.toomuch - 1.5 ? 0.02 : 0.14;
    s.beaker.x = bx + 0.11 - 0.02 * pp.tip; s.beaker.y = 0.11 + 0.18 * (1 - pp.on); s.beaker.z = -0.05;
    s.beaker.tilt = 1.75 * pp.tip;
    s.beaker.fill = t < A.toomuch - 1.5 ? 1 - 0.6 * ramp(t, A.right - 0.1, A.water2 + 0.25) : 1 - 0.9 * ramp(t, A.toomuch - 0.4, A.mudw - 0.1);
    s.pouring = pp.tip > 0.5 ? 1 : 0;
    s.pourAmt = t < A.toomuch - 1.5 ? 1 : 2.2;
    if (t >= A.right - 0.1) { s.wet = 1; s.wetC = [0.05, -0.02]; s.wetR = 0.62 * ease.out(clamp01((t - (A.right - 0.1)) / 1.6)); }
    if (t >= A.so_man + 1) { s.wet = 1; s.wetR = 0.7; }
    // wet run: it glides
    if (t >= tWet0) {
      s.level = 1;
      const u = t - tWet0;
      s.sledX = LX0 + 0.034 * u * clamp01(u / 0.4) - 0.0068 * Math.min(u, 0.4);
      s.heap = 0.0025 * (1 - Math.exp(-u)); s.groove = 0.0012 * (1 - Math.exp(-u));
      s.force = 0.5 + 0.015 * Math.sin(u * 5);
      s.forceCol = 'good';
      if (u < 0.4) s.force *= u / 0.4;
    }
    // too much water: mud, puddles, the sled stops and sinks, the force climbs back
    const mud = ramp(t, A.toomuch + 0.2, A.mudw + 0.2, ease.inOut);
    if (mud > 0) {
      s.mud = mud; s.puddle = ramp(t, A.water2 + 0, A.mudw + 0.5) * 0 + mud;
      const xStop = LX0 + 0.034 * (A.sinks - 0.3 - tWet0) - 0.0027;
      const sinkU = ramp(t, A.sled1 * 0 + A.sinks - 0.45, A.sinks + 0.45, ease.out);
      if (t > A.sinks - 0.3) s.sledX = xStop + 0.006 * ease.out(clamp01((t - A.sinks + 0.3) / 0.6));
      s.sink = 0.013 * sinkU; s.tilt = 0.06 * sinkU;
      s.heap = 0.0025 + 0.004 * sinkU;
      s.force = lerp(s.force, 1.12 + 0.04 * Math.sin(t * 6), ramp(t, A.sinks - 0.3, A.sinks + 0.5));
      if (t > A.sinks - 0.1) s.forceCol = 'accent';
    }
    return s;
  }

  // ================================================================== overlays
  const ov = overlay;
  const carSvg = (c) => `<svg width="150" height="62" viewBox="0 0 150 62" style="vertical-align:middle"><path d="M10 44 L14 30 Q18 22 30 21 L48 20 L62 8 Q66 5 74 5 L104 5 Q112 5 118 12 L128 22 Q142 24 144 34 L144 44 Z" fill="${c}"/>
    <circle cx="38" cy="46" r="11" fill="${c}" stroke="#0B0A0C" stroke-width="4"/><circle cx="116" cy="46" r="11" fill="${c}" stroke="#0B0A0C" stroke-width="4"/></svg>`;
  const el = {
    scrim: ov.el('', ''),
    tonnes: ov.el('2.5 TONNES', 't big'),
    car: ov.el(`<span style="display:inline-flex;align-items:center;gap:22px">MORE THAN A ${carSvg(P.ink)}</span>`, 't small'),
    how: ov.el('HOW?', 't huge'),
    tomb: ov.el('TOMB OF DJEHUTIHOTEP, EGYPT', 't label'),
    bc: ov.el('≈ 1850 BC', 't big'),
    bcLab: ov.el('ALMOST 4,000 YEARS AGO', 't label'),
    count: ov.el('0', 't big'),
    countLab: ov.el('MEN PULLING', 't label'),
    water: ov.el('WATER', 't small'),
    ritual: ov.el('ONLY A RITUAL?', 't mid acc'),
    y2014: ov.el('2014', 't big'),
    uva: ov.el('UNIVERSITY OF AMSTERDAM', 't label'),
    bar: ov.el(`<div class="fbar"><div class="flab">PULLING FORCE</div><div class="track"><div class="fill"></div><div class="tick" style="left:50%"></div></div></div>`, ''),
    dry: ov.el('DRY SAND', 't small'),
    piles: ov.el('SAND PILES UP', 't small acc'),
    justRight: ov.el('JUST A LITTLE WATER', 't small'),
    pct: ov.el('2–5 % OF THE SAND', 't label'),
    halfF: ov.el('HALF THE FORCE', 't mid'),
    bridges: ov.el('WATER BRIDGES', 't mid'),
    bridgesLab: ov.el('HOLD THE GRAINS TOGETHER', 't label'),
    stiff: ov.el('2× STIFFER', 't mid'),
    tooMuch: ov.el('TOO MUCH WATER', 't mid acc'),
    mudL: ov.el('MUD', 't small acc'),
    ritual2: ov.el('A RITUAL', 't mid strike'),
    eng: ov.el('ENGINEERING ✓', 't mid'),
    tl: ov.el('', ''),
    halfP: ov.el('½ THE PEOPLE', 't mid'),
    stones: ov.el('2,000,000+', 't big'),
    stonesLab: ov.el('STONES IN THE GREAT PYRAMID', 't label'),
  };
  el.halfF.style.color = P.good; el.stiff.style.color = P.good; el.eng.style.color = P.good; el.halfP.style.color = P.good; el.bridges.style.color = P.water;
  Object.assign(el.scrim.style, { width: '1080px', height: '780px', background: 'linear-gradient(rgba(8,6,4,0.6), rgba(8,6,4,0.38) 52%, rgba(8,6,4,0))' });
  el.scrim.parentNode.insertBefore(el.scrim, el.scrim.parentNode.firstChild);
  const style = document.createElement('style');
  style.textContent = `.fbar{width:760px;font-family:Inter,sans-serif;font-weight:800;}
    .fbar .flab{font-size:38px;letter-spacing:.05em;color:${P.ink_dim};text-align:center;margin-bottom:14px;text-shadow:0 2px 8px rgba(0,0,0,.8)}
    .fbar .track{position:relative;height:44px;border-radius:22px;background:rgba(10,14,20,.72);border:3px solid rgba(247,243,236,.55);overflow:hidden}
    .fbar .fill{position:absolute;left:0;top:0;bottom:0;border-radius:22px}
    .fbar .tick{position:absolute;top:-4px;bottom:-4px;width:4px;background:rgba(247,243,236,.7)}
    .tlw{width:900px;height:330px;position:relative;font-family:Inter,sans-serif;font-weight:800;color:${P.ink}}
    .tlw .line{position:absolute;left:60px;right:60px;top:150px;height:8px;border-radius:4px;background:rgba(247,243,236,.85)}
    .tlw .dot{position:absolute;top:136px;width:36px;height:36px;border-radius:18px;margin-left:-18px}
    .tlw .yr{position:absolute;top:40px;font-size:64px;transform:translateX(-50%);white-space:nowrap;text-shadow:0 0 24px rgba(0,0,0,.85)}
    .tlw .what{position:absolute;top:200px;font-size:36px;letter-spacing:.04em;color:${P.ink_dim};transform:translateX(-50%);white-space:nowrap;text-shadow:0 2px 8px rgba(0,0,0,.9)}
    .tlw .span{position:absolute;top:268px;font-size:52px;transform:translateX(-50%);white-space:nowrap;color:${P.good};text-shadow:0 0 24px rgba(0,0,0,.85)}`;
  document.head.appendChild(style);
  el.tl.innerHTML = `<div class="tlw"><div class="line"></div>
    <div class="dot d0" style="left:150px;background:${P.casing}"></div><div class="dot d1" style="left:750px;background:${P.ochre_red}"></div>
    <div class="yr y0" style="left:150px">2560 BC</div><div class="yr y1" style="left:750px">1850 BC</div>
    <div class="what w0" style="left:150px">GREAT PYRAMID</div><div class="what w1" style="left:750px">THE PAINTING</div>
    <div class="span sp" style="left:450px">≈ 700 YEARS LATER</div></div>`;
  const leaders = { water: ov.line(P.ink, 4), piles: ov.line(P.accent, 4) };
  const fill = el.bar.querySelector('.fill');
  const setLine = (ln, pts, op = 1) => { ln.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')); ln.style.opacity = op; };
  const fadeIn = (t, a, b = a + 0.3) => ramp(t, a, b, ease.out);
  const fadeWin = (t, a, b, f = 0.28) => Math.min(fadeIn(t, a, a + f), 1 - ramp(t, b - f, b, ease.inOut));
  const popScale = (t, a) => 1 + 0.22 * Math.exp(-Math.max(0, t - a) * 10) * (t > a ? 1 : 0);
  const place = (e, x, y, o, pop = null) => { ov.place(e, x, y, { anchor: 'c', opacity: o }); if (pop && o > 0) e.style.transform += ` scale(${pop.toFixed(3)})`; };

  // ================================================================== update
  const tmp = new THREE.Vector3();
  function update(t, opt = {}) {
    const ft = opt.frameT ?? t;
    const shot = shotAt(ft);
    const setName = setOf[shot[0]];
    for (const [k, g] of Object.entries(SETS)) g.visible = k === setName;
    scene.fog = setName === 'desert' ? fogDesert : null;
    scene.background = setName === 'desert' ? null : col(setName === 'tomb' ? '#120C08' : '#07090C');
    scene.environment = setName === 'lab' && !Q.has('noenv') ? roomEnv : null;
    const cam = cameraFor(shot, t);
    camera.position.copy(cam.pos); camera.fov = cam.fov;
    camera.near = setName === 'lab' ? 0.01 : setName === 'macro' ? 0.02 : setName === 'tomb' ? 0.05 : 0.3;
    camera.far = setName === 'desert' ? 9000 : 60;
    camera.updateProjectionMatrix();
    camera.lookAt(cam.tgt);
    camera.updateMatrixWorld();

    // ---- the brush-stroke sheet (only in its two windows)
    let rev = 0, sheetUV = null;
    if (ft >= tPaint0 && ft < tPaint1) { rev = ramp(t, tPaint0, tPaint1 - 0.05, ease.inOut); sheetUV = [POUR_UV[0], POUR_UV[1], 0.16]; sheetMat.uniforms.uDir.value = 1; }
    if (ft >= tWipe0 && ft < tWipe1) { rev = 1 - ramp(t, tWipe0 + 0.05, tWipe1, ease.inOut); const c = cameraFor(['wall'], tWipe0 - 1e-4); sheetUV = c.uv; sheetMat.uniforms.uDir.value = -1; }
    sheet.visible = !!sheetUV && rev > 0.001;
    if (sheet.visible) {
      const hgt = 2 * Math.tan(camera.fov * DEG / 2) * 1.0;
      sheet.position.set(0, 0, -1.0); sheet.scale.set(hgt * camera.aspect * 1.01, hgt * 1.01, 1);
      sheetMat.uniforms.uCenter.value.set(sheetUV[0], sheetUV[1]);
      sheetMat.uniforms.uHalf.value.set(hvToHu(sheetUV[2]), sheetUV[2]);
      sheetMat.uniforms.uReveal.value = rev;
    }

    if (setName === 'desert') updateDesert(t, shot[0]);
    if (setName === 'tomb' || sheet.visible) updateWall(t);
    if (setName === 'lab') updateLab(t);
    if (setName === 'macro') updateMacro(t);

    if (Q.has('cover')) {
      const c = hookCam(0.6, Xs(0.6));
      camera.position.copy(c.pos); camera.fov = 38; camera.updateProjectionMatrix(); camera.lookAt(c.tgt); camera.updateMatrixWorld();
      sheet.visible = false;
      return;
    }
    if (opt.sub) return;
    overlays(t, shot[0]);
  }

  // ---------------------------------------------------------------- desert
  function teamWorkers(baseIdx, nw, x0, z0, t, { fade = () => 0, lean = 0.42, startX = 3.25, dx = 1.0, rowsZ = [-0.62, 0.62] } = {}) {
    const per = nw / rowsZ.length;
    for (let r = 0; r < rowsZ.length; r++) for (let k = 0; k < per; k++) {
      const i = baseIdx + r * per + k, j = jitter[i];
      const ph = 2 * Math.PI * HZ * t + j.ph + (r ? Math.PI * 0.5 : 0) + k * 0.3;
      const zr = z0 + rowsZ[r] + Math.sign(rowsZ[r]) * 0.22 + j.dz;
      const x = x0 + startX + k * dx + j.dx;
      crowd.set(i, { x, y: groundH(x, zr) + 0.0, z: zr, yaw: 0, scale: j.sc, ...haulPose(ph, lean + j.lean), fade: fade(i - baseIdx) });
    }
  }
  function updateDesert(t, name) {
    crowd.begin();
    const xs = Xs(t);
    // hero team
    team.g.position.set(xs, 0, 0);
    const half = name === 'team' || name === 'crane'
      ? (k) => (k % 2 === 1 ? Math.min(ramp(t, A.half2 - 0.1, A.half2 + 0.8, ease.inOut), 1 - ramp(t, D - 3.4, D - 2.6, ease.inOut)) : 0)
      : () => 0;
    teamWorkers(IDX.team, N_TEAM, xs, 0, t, { fade: half });
    // the pourer on the front of the sled
    const pourT = 0.78 + 0.12 * Math.sin(2 * Math.PI * HZ * t * 0.5);
    crowd.set(IDX.pourer, { x: xs + 0.82, y: team.top, z: 0.05, yaw: 0, scale: 0.98, phase: 0, walk: 0, lean: 0.28,
      arms: [1.15, 0.55, 1.25, 0.35, 0.25, 0.25], jar: pourT, headTilt: 0.45, thigh: -0.05, knee: 0.12 });
    // far teams
    FAR.forEach((f, k) => {
      const x = f.x0 + xs * 0.9 + k * 3;
      f.team.g.position.set(x, groundH(x, f.z), f.z);
      teamWorkers(IDX.far + k * N_FAR, N_FAR, x, f.z, t + k * 0.37, { startX: 3.2, dx: 1.0 });
    });
    // the colossus
    const xc = Xc(t);
    colos.position.set(xc, 0, 0);
    for (let r = 0; r < ROWS; r++) for (let k = 0; k < PER_ROW; k++) {
      const i = IDX.col + r * PER_ROW + k, j = jitter[i];
      const ph = 2 * Math.PI * HZ * 0.8 * t + j.ph + k * 0.15;
      const z = COL_Z[r] + 0.25 + j.dz, x = xc + COL_X0 + k * COL_DX + j.dx;
      crowd.set(i, { x, y: 0, z, yaw: 0, scale: j.sc, ...haulPose(ph, 0.48 + j.lean) });
    }
    crowd.set(IDX.colPourer, { x: xc + 3.25, y: bigSled.top, z: 0.4, yaw: 0, scale: 1.0, phase: 0, walk: 0, lean: 0.3,
      arms: [1.15, 0.55, 1.25, 0.35, 0.25, 0.25], jar: 0.8 + 0.1 * Math.sin(t * 1.7), headTilt: 0.45, knee: 0.1 });
    const clap = Math.abs(Math.sin(Math.PI * HZ * 1.6 * t));
    crowd.set(IDX.clapper, { x: xc + 0.35, y: bigSled.top + 3.45, z: 0.5, yaw: 0, scale: 1.0, phase: 0, walk: 0, lean: -0.05,
      arms: [2.5 + 0.25 * clap, 0.4, 2.5 + 0.25 * clap, 0.4, -0.35 * clap + 0.1, -0.35 * clap + 0.1], headTilt: -0.2 });
    for (let k = 0; k < 3; k++) {
      const x = xc - 6 - k * 2.2 + 0.6 * t * 0, z = -2 + k * 1.6;
      crowd.set(IDX.carriers + k, { x, y: 0, z, yaw: 0, scale: 0.97, ...{ phase: 2 * Math.PI * HZ * t + k, walk: 0.0, lean: 0.05, arms: [3.0, 0.4, 0.2, 0.3, 0, 0] } });
    }
    crowd.commit();
    crowd.group.updateMatrixWorld(true);

    // water streams: from each pourer's jar to the sand just in front of the sled
    const mouth = jarMouth(IDX.pourer, xs + 0.82, team.top, 0.05, pourT);
    const land = V3(xs + 1.62, groundH(xs + 1.62, 0) + 0.02, 0.05);
    pourStream.userData.set(mouth, land, V3(mouth.x + 0.35, mouth.y + 0.05, mouth.z));
    pourStream.material.uniforms.uT.value = t;
    const cm = jarMouth(IDX.colPourer, xc + 3.25, bigSled.top, 0.4, 0.8 + 0.1 * Math.sin(t * 1.7));
    const cl = V3(xc + 4.6, 0.02, 0.4);
    colStream.userData.set(cm, cl, V3(cm.x + 0.5, cm.y + 0.1, cm.z));
    colStream.material.uniforms.uT.value = t;
    // wet tracks in the sand
    const T = sandU.uTracks.value;
    T[0].set(xs + 1.45, 0.05, 0.85, 1);
    T[1].set(xc + 4.2, 0.4, 2.4, 1);
    T[2].set(0, 0, 0, 0); T[3].set(0, 0, 0, 0);
    // dust from the feet and the runners (periodic over the loop), splashes where the water lands
    const dp = dust.geometry.attributes, DN = dust.userData.n;
    const P0 = D / Math.round(D / 2.5);
    for (let i = 0; i < DN; i++) {
      const born = (i / DN) * P0, age = ((t - born) % P0 + P0) % P0, life = 2.2;
      const r2 = mulberry(i * 7 + 1); const a = r2(), b = r2(), c = r2(), d = r2();
      const wk = Math.floor(a * N_TEAM);
      const per = N_TEAM / 2, row = wk >= per ? 1 : 0;
      const bx = Xs(t - age) + 3.25 + (wk % per) * 1.0 + (b - 0.5) * 0.4, bz = (row ? 0.84 : -0.84) + (c - 0.5) * 0.4;
      const isRunner = d < 0.25;
      const x0 = isRunner ? Xs(t - age) + 1.3 + (b - 0.5) * 0.3 : bx, z0 = isRunner ? (c < 0.5 ? -0.45 : 0.45) : bz;
      if (age > life) { dp.alpha.array[i] = 0; continue; }
      const u = age / life;
      dp.position.array[i * 3] = x0 + 0.25 * age + (b - 0.5) * 0.3 * age;
      dp.position.array[i * 3 + 1] = 0.05 + 0.35 * Math.sqrt(age) + 0.1 * c;
      dp.position.array[i * 3 + 2] = z0 + (c - 0.5) * 0.5 * age + 0.15 * age;
      dp.size.array[i] = (isRunner ? 0.55 : 0.4) * (0.5 + 1.6 * u);
      dp.alpha.array[i] = 0.22 * Math.sin(Math.PI * Math.min(1, u * 1.3)) * (1 - u);
    }
    dp.position.needsUpdate = true; dp.size.needsUpdate = true; dp.alpha.needsUpdate = true;
    const sp = splash.geometry.attributes, SN = splash.userData.n;
    for (let i = 0; i < SN; i++) {
      const r2 = mulberry(i * 13 + 5); const a = r2(), b = r2(), c = r2();
      const P1 = D / Math.round(D / 0.6), born = a * P1, age = ((t - born) % P1 + P1) % P1, life = 0.45;
      const which = i < SN * 0.6 ? land : cl;
      if (age > life) { sp.alpha.array[i] = 0; continue; }
      const vx = (b - 0.5) * 1.4, vz = (c - 0.5) * 1.4, vy = 0.9 + 0.8 * a;
      sp.position.array[i * 3] = which.x + vx * age; sp.position.array[i * 3 + 1] = which.y + vy * age - 4.9 * age * age; sp.position.array[i * 3 + 2] = which.z + vz * age;
      sp.size.array[i] = 0.018 * (which === cl ? 1.4 : 1);
      sp.alpha.array[i] = 0.9 * (1 - age / life);
    }
    sp.position.needsUpdate = true; sp.size.needsUpdate = true; sp.alpha.needsUpdate = true;
    const uScale = (HH * SS) / (2 * Math.tan(camera.fov * DEG / 2));
    dust.material.uniforms.uScale.value = uScale; splash.material.uniforms.uScale.value = uScale;
    motes.material.uniforms.uT.value = t; motes.material.uniforms.uC.value.copy(camera.position); motes.material.uniforms.uScale.value = uScale;
    sky.material.uniforms.uTime.value = t;
    // the sun's shadow box follows the subject of the shot
    const focus = name === 'colossus' || name === 'colossus2' ? V3(xc + 12, 0, 0) : name === 'pyramid' ? V3(PYR.x - 120, 0, PYR.z) : V3(xs + 6, 0, 0);
    const ext = name === 'colossus' || name === 'colossus2' ? 34 : name === 'pyramid' ? 220 : (name === 'crane' || name === 'hook' && t > 5 && t < 8.2) ? 45 : 18;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: ext * 6 + 200 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(SUN, ext * 3 + 80);
  }
  function jarMouth(i, x, y, z, tilt) {
    // the jar's mouth: follow the pourer's right hand (approximate: the same chain as people.js)
    const m = crowd.meshes.jar; const M = new THREE.Matrix4(); m.getMatrixAt(i, M);
    return V3(0.22, 0, 0).applyMatrix4(M);
  }

  // ---------------------------------------------------------------- tomb
  function updateWall(t) {
    const count = Math.round(172 * ramp(t, A.men170 - 0.05, A.pulling + 0.1, ease.inOut));
    const lit = t < A.statue + 0.3 ? 1 : 1 - ramp(t, A.statue + 0.3, A.statue + 0.8);
    const pour = Math.max(fadeWin(t, A.pouring - 0.3, A.p_that + 0.4, 0.3), 0);
    const flow = Math.max(fadeWin(t, A.pouring - 0.4, A.old, 0.3), 0) * 1.0;
    for (const u of [wallMat.userData.u, sheetMat.uniforms]) {
      u.uCount.value = count; u.uLitAll.value = lit; u.uPour.value = pour * 0.8; u.uFlow.value = flow; u.uT.value = t;
    }
    sheetMat.uniforms.uGain.value = 0.82;
    const fl = 1 + 0.06 * Math.sin(t * 13.0) + 0.04 * Math.sin(t * 23.7 + 1) + 0.03 * Math.sin(t * 7.1);
    torch.intensity = 60 * fl; torch2.intensity = 28 * (2 - fl);
  }

  // ---------------------------------------------------------------- lab
  let labNow = null;
  function updateLab(t) {
    const s = labState(t);
    labNow = s;
    const r = lab.set(s);
    const lip = r.lip;
    labStream.visible = s.pouring > 0;
    if (labStream.visible) {
      const land = V3(lip.x - 0.035, SETS.lab.position.y + 0.002, lip.z);
      labStream.userData.set(lip, land, V3(lip.x - 0.03, lip.y - 0.01, lip.z));
      labStream.scale.set(1, 1, 1);
      labStream.material.uniforms.uT.value = t;
    }
    const sp = labSplash.geometry.attributes, SN = labSplash.userData.n;
    for (let i = 0; i < SN; i++) {
      const r2 = mulberry(i * 17 + 3); const a = r2(), b = r2(), c = r2();
      const born = a * 0.5, age = ((t - born) % 0.5 + 0.5) % 0.5, life = 0.35;
      if (!labStream.visible || age > life) { sp.alpha.array[i] = 0; continue; }
      const vx = (b - 0.5) * 0.25, vz = (c - 0.5) * 0.25, vy = 0.3 + 0.3 * a;
      sp.position.array[i * 3] = lip.x - 0.035 + vx * age; sp.position.array[i * 3 + 1] = 0.003 + vy * age - 4.9 * age * age; sp.position.array[i * 3 + 2] = lip.z + vz * age;
      sp.size.array[i] = 0.0016 * s.pourAmt;
      sp.alpha.array[i] = 0.9 * (1 - age / life);
    }
    sp.position.needsUpdate = true; sp.size.needsUpdate = true; sp.alpha.needsUpdate = true;
    labSplash.material.uniforms.uScale.value = (HH * SS) / (2 * Math.tan(camera.fov * DEG / 2));
    key.target.position.set(s.sledX * 0.5, 0, 0);
  }

  // ---------------------------------------------------------------- macro
  function updateMacro(t) {
    const t0 = A.tiny - 0.12;
    const jostle = 1 - ramp(t, A.stick - 0.1, A.together + 0.2, ease.inOut);
    const grow = ramp(t, A.tiny + 0.2, A.together + 0.3, ease.inOut);
    const press = ramp(t, A.so_sand - 0.1, A.twice + 0.25, ease.inOut);
    grains.set(t, { jostle: Math.max(jostle, 0) * 1.0, grow, squash: press });
    runner.position.set(0.1, lerp(1.9, 0.24, press), 0);
    runner.visible = press > 0.001;
    void t0;
  }

  // ---------------------------------------------------------------- overlays
  function overlays(t, name) {
    const topOn = Math.max(
      fadeWin(t, A.heavier - 0.1, A.thousands + 0.1), fadeWin(t, A.nobody - 0.15, A.until + 0.2),
      fadeWin(t, A.four - 0.2, A.old + 0.9), fadeWin(t, A.men170 - 0.2, A.statue + 0.4), fadeWin(t, A.which - 0.1, A.lab - 0.02, 0.2),
      fadeWin(t, A.lab, A.physicists + 1.8), fadeWin(t, A.right - 0.2, A.half + 1.0), fadeWin(t, A.tiny, A.glides - 0.75, 0.2),
      fadeWin(t, A.toomuch - 0.1, A.sinks + 0.8), fadeWin(t, A.so_man - 0.1, A.end - 0.05, 0.2), fadeWin(t, A.even, A.same - 0.25),
      fadeWin(t, A.half2 - 0.2, A.million - 0.9), fadeWin(t, A.million - 0.7, D - 2.4));
    ov.place(el.scrim, 0, 0, { anchor: 'tl', opacity: 0.8 * topOn });
    // hook
    const tonOn = fadeWin(t, A.heavier - 0.1, A.thousands + 0.1);
    place(el.tonnes, 540, 360, tonOn, popScale(t, A.heavier - 0.1));
    place(el.car, 540, 500, fadeWin(t, A.car - 0.15, A.thousands + 0.1), popScale(t, A.car - 0.15));
    place(el.how, 540, 430, fadeWin(t, A.nobody - 0.15, A.until + 0.2), popScale(t, A.how - 0.1));
    place(el.tomb, 540, 1660, fadeWin(t, A.painting0 + 0.7, A.p_that + 0.8));
    // the painting
    place(el.bc, 540, 360, fadeWin(t, A.four - 0.2, A.old + 0.9), popScale(t, A.four - 0.2));
    place(el.bcLab, 540, 470, fadeWin(t, A.four - 0.1, A.old + 0.9));
    const cOn = fadeWin(t, A.men170 - 0.2, A.statue + 0.4);
    const count = Math.round(172 * ramp(t, A.men170 - 0.05, A.pulling + 0.1, ease.inOut));
    el.count.textContent = String(count);
    place(el.count, 540, 360, cOn, count >= 172 ? popScale(t, A.pulling + 0.1) : 1);
    place(el.countLab, 540, 470, cOn);
    // "while one man pours water in front of it": a leader to the jar
    const wOn = name === 'colossus' ? fadeWin(t, A.pours - 0.1, A.which + 0.1) : 0;
    if (wOn > 0) {
      const p = toScreen(V3(Xc(t) + 4.3, 0.6, 0.4), camera);
      const lx = Math.min(940, Math.max(140, p.x + 160)), ly = Math.max(760, p.y - 380);
      setLine(leaders.water, [{ x: p.x, y: p.y - 10 }, { x: lx, y: ly + 40 }], wOn);
      place(el.water, lx, ly, wOn);
      el.water.style.color = P.water;
    } else { setLine(leaders.water, [{ x: 0, y: 0 }], 0); el.water.style.opacity = 0; }
    place(el.ritual, 540, 400, fadeWin(t, A.which - 0.1, A.lab - 0.02, 0.2), popScale(t, A.ritual - 0.05));
    // lab
    place(el.y2014, 540, 360, fadeWin(t, A.y2014 - 0.15, A.physicists + 1.8), popScale(t, A.y2014 - 0.15));
    place(el.uva, 540, 470, fadeWin(t, A.physicists - 0.1, A.physicists + 1.8));
    const barOn = (name === 'lab1' || name === 'lab2') ? fadeWin(t, A.pulled - 0.2, A.so_man - 0.1, 0.2) : 0;
    if (barOn > 0 && labNow) {
      const f = clamp01(labNow.force / 1.2);
      fill.style.width = `${(f * 100).toFixed(1)}%`;
      fill.style.background = labNow.forceCol === 'good' ? P.good : labNow.forceCol === 'accent' ? P.accent : P.ink;
    }
    ov.place(el.bar, 540, 1600, { anchor: 'c', opacity: barOn });
    place(el.dry, 540, 380, fadeWin(t, A.dry - 0.15, A.but - 0.3), popScale(t, A.dry - 0.15));
    const pOn = name === 'lab1' ? fadeWin(t, A.piling - 0.1, A.but - 0.3) : 0;
    if (pOn > 0 && labNow) {
      const p = toScreen(SETS.lab.localToWorld(V3(labNow.sledX + SLED.lx / 2 + 0.02, 0.012, 0)), camera);
      setLine(leaders.piles, [{ x: p.x, y: p.y - 14 }, { x: Math.min(820, Math.max(260, p.x)), y: 680 }], pOn);
      place(el.piles, Math.min(820, Math.max(260, p.x)), 640, pOn, popScale(t, A.piling - 0.1));
    } else { setLine(leaders.piles, [{ x: 0, y: 0 }], 0); el.piles.style.opacity = 0; }
    place(el.justRight, 540, 360, fadeWin(t, A.right - 0.2, A.pull - 0.1), popScale(t, A.right - 0.2));
    place(el.pct, 540, 450, fadeWin(t, A.right, A.pull - 0.1));
    place(el.halfF, 540, 400, fadeWin(t, A.half - 0.15, A.tiny - 0.12, 0.2), popScale(t, A.half - 0.15));
    place(el.bridges, 540, 360, fadeWin(t, A.stick - 0.1, A.so_sand - 0.1, 0.2), popScale(t, A.stick - 0.1));
    place(el.bridgesLab, 540, 460, fadeWin(t, A.stick, A.so_sand - 0.1, 0.2));
    place(el.stiff, 540, 400, fadeWin(t, A.twice - 0.15, A.glides - 0.75, 0.2), popScale(t, A.twice - 0.15));
    place(el.tooMuch, 540, 380, fadeWin(t, A.toomuch - 0.1, A.mudw - 0.05, 0.2), popScale(t, A.toomuch - 0.1));
    place(el.mudL, 540, 380, fadeWin(t, A.mudw - 0.05, A.so_man - 0.12, 0.2), popScale(t, A.mudw - 0.05));
    el.mudL.className = 't mid acc'; el.mudL.textContent = t < A.sinks - 0.1 ? 'MUD' : 'MUD · IT SINKS';
    // engineering, not a ritual
    const rOn = fadeWin(t, A.so_man - 0.1, A.end - 0.05, 0.2);
    const strike = ramp(t, A.not_ritual - 0.3, A.not_ritual + 0.25, ease.inOut);
    el.ritual2.style.setProperty('--sw', `${(strike * el.ritual2.offsetWidth).toFixed(0)}px`);
    el.ritual2.style.color = P.ink_dim;
    place(el.ritual2, 540, 330, rOn * (t > A.not_ritual + 0.3 ? 0.55 : 1));
    place(el.eng, 540, 470, fadeWin(t, A.engineering - 0.1, A.end - 0.05, 0.2), popScale(t, A.engineering - 0.1));
    // end: the timeline, half the people, two million stones
    const tlOn = fadeWin(t, A.even, A.same - 0.25);
    ov.place(el.tl, 540, 420, { anchor: 'c', opacity: tlOn });
    if (tlOn > 0) {
      const a = ramp(t, A.seven - 0.2, A.younger + 0.3, ease.inOut);
      el.tl.querySelector('.sp').style.opacity = a;
      el.tl.querySelector('.d1').style.opacity = ramp(t, A.even + 0.1, A.even + 0.4);
      el.tl.querySelector('.y1').style.opacity = ramp(t, A.even + 0.1, A.even + 0.4);
      el.tl.querySelector('.w1').style.opacity = ramp(t, A.even + 0.1, A.even + 0.4);
      const g = ramp(t, A.great - 0.2, A.great + 0.2);
      for (const c of ['.d0', '.y0', '.w0']) el.tl.querySelector(c).style.opacity = 0.35 + 0.65 * g;
    }
    place(el.halfP, 540, 400, fadeWin(t, A.half2 - 0.2, A.million - 0.9), popScale(t, A.half2 - 0.2));
    place(el.stones, 540, 360, fadeWin(t, A.million - 0.7, D - 2.4), popScale(t, A.million - 0.7));
    place(el.stonesLab, 540, 470, fadeWin(t, A.million - 0.5, D - 2.4));
  }

  window.__lab = lab; window.__r = renderer;
  window.shaderErrors = () => { const out = []; scene.traverse((o) => { if (!o.material) return; for (const m of [].concat(o.material)) { const p = renderer.properties.get(m).currentProgram; if (p && p.diagnostics && !p.diagnostics.runnable) out.push((o.name || o.type) + ': ' + (p.diagnostics.vertexShader.log + ' ' + p.diagnostics.fragmentShader.log).trim().slice(0, 300)); } }); return out; };
  window.dbg = {
    cam: (t) => { const c = cameraFor(shotAt(t), t); return { shot: shotAt(t)[0], pos: c.pos.toArray().map((v) => +v.toFixed(2)), tgt: c.tgt.toArray().map((v) => +v.toFixed(2)) }; },
    grains: () => ({ n: grains.count, bridges: grains.bridges }),
  };
  return {
    scene, camera, update,
    post: Q.has('nopost') ? null : { ss: SS, msaa: Number(Q.get('msaa') ?? 0), samples: 1, shutter: 0.5, grain: 0.024, vignette: 0.3, exposure: 1.0, bloom: 0.12, bloomThreshold: 1.1, bg: P.bg },
    blurSamples(t) {
      // fast camera moves and the brush strokes get real motion blur
      for (const [a, b] of [[4.4, 8.6], [A.while - 1.2, A.front1], [D - 4.0, D]]) if (t > a && t < b) return Math.max(1, Number(Q.get('blur') ?? 3));
      return 1;
    },
    look(t) { return {}; },
  };
}
