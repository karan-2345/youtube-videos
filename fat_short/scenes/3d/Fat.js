// scenes/3d/Fat.js -- "When you lose weight, where does the fat go?" One continuous scene in a dark studio.
//
//   hook     the glowing lump of fat melts (no), turns to muscle (no), sweats (no); the camera pulls back: it is inside
//            a glass body, and on "breathe out" it leaves as golden specks through the lungs and the mouth
//   survey   the body is one of 150 (doctors, dietitians, trainers); only 3 light up
//   atoms    into the lump: one real fat molecule, C55H104O6 -- carbon, hydrogen, oxygen; 78 O2 fly in, it breaks apart
//   split    the atoms regroup as 55 CO2 (they float up and out) and 52 H2O; back on the body: sweat, tears, pee, breath
//   numbers  a 10 kg block of fat: the top 84 % dissolves into a cloud of breath (8.4 kg), the rest turns to water
//   twist    panting does nothing (x); jogging does (the lump empties into the breath); panting -> dizzy
//   end      calm breaths, a few specks on each; the camera sinks back into the lump: the first frame (loop)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ease, ramp, track, rng, clamp01, lerp, toScreen } from '/scenes/web/runtime.js';
import { buildStudio } from './lib/studio.js';
import { buildBody, pose, crowdGeometry, glassMaterials, JOINTS } from './lib/body.js';
import { buildFat, fatMaterial } from './lib/fat.js';
import { Breath, buildSpecks, buildVapor, pointCloud, pointsMaterial } from './lib/specks.js';
import { buildReaction } from './lib/molecule.js';

const YAW = 1.0;                         // the figure faces screen-right, three-quarters to the camera
const LUMP_REST = [0, 1.05, 0.032];      // the lump in the belly (rest pose)
const LUMP_IN = 0.6;                     // its size inside the body (1 = the hook close-up)
const MOL_AT = new THREE.Vector3(0, 30, -6);   // where the molecule lives (its own corner of the studio)
const MOL_SCALE = 0.026;                 // metres per angstrom on screen

export async function setup(ctx) {
  const { renderer, data, overlay: O } = ctx;
  const P = data.palette, A = data.anchors, D = data.duration, FX = data.facts;
  const Q = Object.fromEntries(new URLSearchParams(location.search));
  const scene = new THREE.Scene();
  const rnd = rng(20261122);

  // ---------------------------------------------------------------- studio and lights
  const studio = buildStudio(P, renderer, rng(3));
  scene.add(studio.group);
  const key = new THREE.DirectionalLight(0xfff1e0, 2.0); key.position.set(-1.2, 2.2, 1.6); scene.add(key);
  const rimL = new THREE.DirectionalLight(0x9cc8ff, 1.6); rimL.position.set(1.6, 0.8, -1.6); scene.add(rimL);
  const hemi = new THREE.HemisphereLight(0x3d5578, 0x0c1016, 0.7); scene.add(hemi);

  // ---------------------------------------------------------------- the body, its lump, its breath
  const B = buildBody(P, rng(5));
  B.root.rotation.y = YAW;
  scene.add(B.root);
  const F = buildFat(P, studio.env, rng(11));
  F.setPeriod(D);
  const lumpMount = new THREE.Group();
  lumpMount.position.set(LUMP_REST[0] - JOINTS.spine[0], LUMP_REST[1] - JOINTS.spine[1], LUMP_REST[2] - JOINTS.spine[2]);
  B.bones.spine.add(lumpMount);
  lumpMount.add(F.group);
  F.group.rotation.y = -YAW + 0.25;        // the muscle spindle lies across the hook camera's view

  // breathing, timed to the words
  const cyc = data.breath;                 // tools/export.py: every breath, timed to the words
  const breath = new Breath(cyc);

  const specks = buildSpecks(P, B, F, breath, rng(17), [
    { n: 2600, b0: A.because + 0.15, b1: A.every - 0.2, travel: 0.95, size: 10, gain: 1.15 },    // the hook
    { n: 1400, b0: A.burns - 0.1, b1: A.move - 0.5, travel: 0.8, size: 14, gain: 1.2, life: 0.8 },  // jogging (wide shot)
    { n: 520, b0: A.right_now - 0.6, b1: A.breathe_out3 - 0.6, travel: 1.1, size: 9, gain: 1 },  // the end
  ]);
  scene.add(specks.pts);
  const vapor = buildVapor(P, B, breath, rng(19));
  scene.add(vapor.pts);

  // ---------------------------------------------------------------- the crowd of 150
  const crowdGeo = crowdGeometry(0.014);
  const cm = glassMaterials(P);
  const NC = FX.surveyed - 1;              // the hero is the 150th
  const crowd = { front: new THREE.InstancedMesh(crowdGeo, cm.front, NC), pre: new THREE.InstancedMesh(crowdGeo, cm.pre, NC),
    back: new THREE.InstancedMesh(crowdGeo, cm.back, NC) };
  crowd.back.renderOrder = 20; crowd.pre.renderOrder = 21; crowd.front.renderOrder = 22;
  const cols = 10, rows = 15, gap = 0.78;
  const slots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ r, c });
  const heroSlot = 4;                       // front row, near the middle
  const heroXZ = [(slots[heroSlot].c - (cols - 1) / 2) * gap, 0];
  const crowdSlots = slots.filter((_, i) => i !== heroSlot);
  const right3 = new Set([37, 101]);        // the other two who got it right (crowd indices)
  const cM = new THREE.Matrix4(), cQ = new THREE.Quaternion(), cS = new THREE.Vector3(1, 1, 1), cP = new THREE.Vector3();
  crowdSlots.forEach((s, i) => {
    const x = (s.c - (cols - 1) / 2) * gap - heroXZ[0] + (rnd() - 0.5) * 0.12;
    const z = -s.r * gap * 1.05 + (rnd() - 0.5) * 0.12;
    cQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.35 + (rnd() - 0.5) * 0.3);
    const sc = 0.94 + rnd() * 0.1;
    cM.compose(cP.set(x, 0, z), cQ, cS.set(sc, sc, sc));
    for (const m of Object.values(crowd)) m.setMatrixAt(i, cM);
    crowd.front.setColorAt(i, new THREE.Color(1, 1, 1)); crowd.back.setColorAt(i, new THREE.Color(1, 1, 1));
    s.block = Math.floor(s.r / 5);
  });
  const crowdGroup = new THREE.Group();
  Object.values(crowd).forEach((m) => { m.frustumCulled = false; crowdGroup.add(m); });
  scene.add(crowdGroup);
  const tint = new THREE.Color();

  // ---------------------------------------------------------------- the molecule and the reaction
  const R = buildReaction(P, studio.env, rng(23), FX.fat ? { fat: FX.fat, o2: FX.o2, co2: FX.co2, h2o: FX.h2o } : null);
  R.group.position.copy(MOL_AT);
  R.group.scale.setScalar(MOL_SCALE);
  R.group.updateMatrixWorld(true);
  scene.add(R.group);
  const molHaze = buildMolHaze(P, rng(29));
  molHaze.pts.position.copy(MOL_AT);
  scene.add(molHaze.pts);

  // ---------------------------------------------------------------- water on the body (sweat, tears, pee, breath)
  const waterMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#E8F6FF'), roughness: 0.02, transmission: 1,
    thickness: 0.006, ior: 1.33, envMap: studio.env, envMapIntensity: 1.6 });
  const dropGeo = new THREE.SphereGeometry(1, 20, 14);
  const sweatPts = [[0.03, 1.69, 0.075], [-0.02, 1.7, 0.078], [0.055, 1.665, 0.06], [-0.045, 1.675, 0.065], [0.01, 1.715, 0.07],
    [0.07, 1.62, 0.04], [-0.065, 1.63, 0.045]];
  const sweat = new THREE.InstancedMesh(dropGeo, waterMat, sweatPts.length);
  sweat.frustumCulled = false; sweat.renderOrder = 23;
  const headMount = mountOn(B, 'head'); headMount.add(sweat);
  const tear = new THREE.Mesh(dropGeo, waterMat); tear.renderOrder = 23; headMount.add(tear);
  const bladder = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(P.water) }, uA: { value: 0 } }, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 1.6); gl_FragColor = vec4(uC * (0.35 + 1.6 * f) * uA, 1.); }',
  }));
  bladder.renderOrder = 6;
  const pelvisMount = mountOn(B, 'pelvis'); pelvisMount.add(bladder);
  bladder.position.set(0, 0.935, 0.045); bladder.scale.set(0.045, 0.038, 0.035);

  // ---------------------------------------------------------------- the 10 kg block
  const BLOCK = { w: 0.2, h: 0.28, at: new THREE.Vector3(0.52, 0, 0.62) };
  const bm = fatMaterial(P, studio.env);
  bm.mat.side = THREE.DoubleSide;
  bm.U.uCellScale.value = 30;
  const blockGeo = new RoundedBoxGeometry(BLOCK.w, BLOCK.h, BLOCK.w, 6, 0.022);
  blockGeo.translate(0, BLOCK.h / 2, 0);
  const block = new THREE.Mesh(blockGeo, bm.mat);
  block.position.copy(BLOCK.at); block.renderOrder = 4;
  const blockHolder = new THREE.Group(); blockHolder.add(block); scene.add(blockHolder);
  const blockShadow = studio.shadow.clone(); blockShadow.material = studio.shadow.material.clone();
  blockShadow.position.set(BLOCK.at.x, 0.003, BLOCK.at.z); blockShadow.scale.setScalar(0.45); scene.add(blockShadow);
  const SPLIT = BLOCK.h * (1 - FX.exhaled / FX.loss);   // 16 % of the height stays as water
  const cloud = buildCloud(P, BLOCK, SPLIT, rng(31));
  scene.add(cloud.pts);
  const puddleGeo = new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const puddle = new THREE.Mesh(puddleGeo, new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#0F4FA0'),
    roughness: 0.05, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.05, envMap: studio.env, envMapIntensity: 0.55,
    emissive: new THREE.Color('#1E6FD0'), emissiveIntensity: 0.1, transparent: true, opacity: 0.88 }));
  puddle.position.set(BLOCK.at.x, 0.0, BLOCK.at.z); puddle.renderOrder = 5;
  scene.add(puddle);

  // ---------------------------------------------------------------- dizzy stars
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.42 : 1, a = Math.PI / 2 + i * Math.PI / 5;
    i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  starGeo.center();
  const starMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#FFD45A'), emissive: new THREE.Color('#FFB020'),
    emissiveIntensity: 2.2, roughness: 0.35, envMap: studio.env });
  const stars = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(starGeo, starMat); m.renderOrder = 24; headMount.add(m); return m; });

  // ---------------------------------------------------------------- overlay
  const plate = O.el('', 'plate');
  const T = (html, cls) => O.el(html, 't ' + cls);
  const ov = {
    title1: T('WHERE DOES', 'title'), title2: T('THE FAT GO?', 'title'),
    melt: T('MELTS AWAY', 'mid'), muscle: T('TURNS INTO MUSCLE', 'mid2'), sweat: T('SWEATED OUT', 'mid'),
    out: T('BREATHED OUT', 'mid mint'),
    x1: O.el('', 'xmark'), x2: O.el('', 'xmark'), x3: O.el('', 'xmark'), ok1: O.el('', 'check'),
    doctors: T('50 DOCTORS', 'small'), dietitians: T('50 DIETITIANS', 'small'), trainers: T('50 PERSONAL TRAINERS', 'small'),
    asked: T('WHERE DOES THE FAT GO?', 'small'), three: T('3', 'huge mint'), outOf: T('OUT OF 150 GOT IT RIGHT', 'sub'),
    carbon: T(`<span class="dotc" style="background:${P.carbon}"></span>CARBON`, 'small'),
    hydrogen: T(`<span class="dotc" style="background:${P.hydrogen}"></span>HYDROGEN`, 'small'),
    oxygen: T(`<span class="dotc" style="background:${P.oxygen}"></span>OXYGEN`, 'small'),
    nC: T(`× ${FX.fat.C}`, 'sub'), nH: T(`× ${FX.fat.H}`, 'sub'), nO: T(`× ${FX.fat.O}`, 'sub'),
    fatMol: T('ONE MOLECULE OF FAT', 'label'),
    o2: T('+ OXYGEN YOU BREATHE IN', 'small red'),
    co2: T('CARBON DIOXIDE', 'small'), co2s: T('CO₂ · BREATHED OUT', 'sub'),
    h2o: T('WATER', 'small'), h2os: T('H₂O', 'sub'),
    wSweat: T('SWEAT', 'small'), wTears: T('TEARS', 'small'), wPee: T('PEE', 'small'), wBreath: T('BREATH', 'small'),
    kg10: T('10 KG', 'big'), kg10s: T('OF FAT', 'sub'),
    kg84: T('8.4 KG', 'big'), kg84s: T('BREATHED OUT', 'sub'),
    kg16: T('1.6 KG', 'mid'), kg16s: T('WATER', 'sub'),
    faster: T('BREATHING FASTER', 'mid'), x4: O.el('', 'xmark'),
    moving: T('MOVING', 'mid mint'), ok2: O.el('', 'check'), burns: T('BURNS MORE FAT', 'sub'),
    panting: T('PANTING ON PURPOSE', 'mid2'), dizzy: T('= DIZZY', 'mid red'),
  };
  const lines = { carbon: O.line(P.ink, 4), hydrogen: O.line(P.ink, 4), oxygen: O.line(P.ink, 4),
    co2: O.line(P.ink_dim, 3), h2o: O.line(P.ink_dim, 3), wSweat: O.line(P.water, 3), wTears: O.line(P.water, 3),
    wPee: O.line(P.water, 3), wBreath: O.line(P.breath, 3) };

  // ---------------------------------------------------------------- camera
  const camera = new THREE.PerspectiveCamera(30, 1080 / 1920, 0.01, 300);
  const V3 = (a) => new THREE.Vector3(...a);
  const lumpW = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  const rotY = (v, a) => new THREE.Vector3(v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a));
  const LW = rotY(LUMP_REST, YAW);                       // the lump in world space (rest pose)
  const hookDir = new THREE.Vector3(0.36, 0.14, 1).normalize();
  function orbit(target, dist, az, el, out) {
    const d = hookDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), az);
    d.y += el; d.normalize();
    return out.copy(target).addScaledVector(d, dist);
  }
  // the camera state at any time: { pos, tgt, fov }
  const SHOT = {};
  function cam(t) {
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    let fov = 30;
    if (Q.cover) {                           // the cover: face, lungs and the golden breath, room for the title above
      tgt.set(0.2, 1.36, 0.1);
      orbit(tgt, 2.05, 0.36, 0.04, pos);
      return { pos, tgt, fov };
    }
    // hook: close on the lump, a slow orbit; wider for the muscle; then the pull-back
    const hookAz = lerp(-0.22, 0.28, clamp01(t / A.because));
    const close = new THREE.Vector3(), closeT = LW.clone();
    let d = 1.12 - 0.07 * clamp01(t / A.because);
    d += 0.3 * (ramp(t, A.muscle_or - 0.1, A.muscle_or + 0.4) - ramp(t, A.sweat_and - 0.2, A.sweat_and + 0.3));
    closeT.y -= 0.025 * (ramp(t, A.melt - 0.1, A.melt + 0.4) - ramp(t, A.muscle_or, A.muscle_or + 0.4));
    orbit(closeT, d, hookAz, 0.02 * Math.sin(t * 0.6), close);
    const midT = new THREE.Vector3(0.12, 1.45, 0.06), midP = orbit(midT, 2.6, 0.32, 0.05, new THREE.Vector3());
    const pb = ramp(t, A.because - 0.05, A.leaves + 0.5, ease.inOut);
    pos.lerpVectors(close, midP, pb); tgt.lerpVectors(closeT, midT, pb);
    const face = ramp(t, A.breathe_out - 0.6, A.breathe_out + 0.5, ease.inOut) * (1 - ramp(t, A.survey - 0.2, A.doctors + 0.3, ease.inOut));
    if (face > 0) {
      const fT = new THREE.Vector3(0.2, 1.5, 0.1), fP = orbit(fT, 1.95, 0.4, 0.04, new THREE.Vector3());
      pos.lerp(fP, face); tgt.lerp(fT, face);
    }
    if (t < A.breathe_out_e + 0.6) return { pos, tgt, fov };
    // survey: crane up and back over the crowd
    const crowdT = new THREE.Vector3(0.3, 0.2, -5.6), crowdP = new THREE.Vector3(3.2, 15.5, 13.5);
    const drift = new THREE.Vector3(0.6 * Math.sin(t * 0.15), 0, 0);
    const cr = ramp(t, A.survey - 0.2, A.doctors + 0.3, ease.inOut);
    const fT2 = new THREE.Vector3(0.2, 1.5, 0.1), fP2 = orbit(fT2, 1.95, 0.4, 0.04, new THREE.Vector3());
    pos.lerpVectors(fP2, crowdP.clone().add(drift), cr); tgt.lerpVectors(fT2, crowdT, cr);
    if (t < A.right_e + 0.25) return { pos, tgt, fov };
    // the dive: down into the hero's lump
    const dv = ramp(t, A.right_e + 0.2, A.atoms + 0.32, ease.inOut);
    lumpW.copy(LW);
    const from = crowdP.clone().add(drift);
    const d0 = from.distanceTo(lumpW), d1 = 0.1;
    const dirA = from.clone().sub(lumpW).normalize(), dirB = new THREE.Vector3(0.3, 0.15, 1).normalize();
    const dd = Math.exp(lerp(Math.log(d0), Math.log(d1), dv));
    pos.copy(lumpW).addScaledVector(dirA.lerp(dirB, ease.inOut(clamp01(dv * 1.3))).normalize(), dd);
    tgt.lerpVectors(crowdT, lumpW, ease.out(clamp01(dv * 2.5)));
    if (t < A.atoms + 0.32) return { pos, tgt, fov };
    // the molecule
    const molT = MOL_AT.clone().add(new THREE.Vector3(0, 0.02, 0));
    const mz = track(t, [[A.atoms + 0.3, 1.75], [A.oxygen + 0.8, 1.9], [A.apart, 2.05], [A.join, 2.2], [A.gas, 2.35]]);
    const ma = 0.25 * Math.sin((t - A.atoms) * 0.18);
    pos.copy(molT).add(new THREE.Vector3(Math.sin(ma) * mz, 0.2, Math.cos(ma) * mz));
    tgt.copy(molT).add(new THREE.Vector3(0, 0.1, 0));
    pos.y += 0.1;
    const upT = ramp(t, A.co2 - 0.3, A.breathe_out2_e + 0.2) * 0.16 - ramp(t, A.water - 0.4, A.which + 0.2) * 0.46;
    pos.y += upT; tgt.y += upT;
    if (t < A.which + 0.55) return { pos, tgt, fov };
    // water on the body: head and torso
    const wT = new THREE.Vector3(0.05, 1.42, 0.05), wP = orbit(wT, 1.55, 0.18, 0.06, new THREE.Vector3());
    wP.x += 0.02 * (t - A.which);
    pos.copy(wP); tgt.copy(wT);
    if (t < A.numbers - 0.35) {
      const pee = ramp(t, A.pee - 0.5, A.pee + 0.2) - ramp(t, A.breath - 0.4, A.breath + 0.2);
      tgt.y -= 0.2 * pee; pos.y -= 0.12 * pee;
      return { pos, tgt, fov };
    }
    // numbers: the block, then up to the cloud, then down to the water
    const bT = BLOCK.at.clone().add(new THREE.Vector3(0, 0.16, 0));
    const nb = [[A.numbers - 0.35, 0], [A.ten + 0.4, 0], [A.eight, 0.25], [A.lungs_e, 1], [A.only16, 1], [A.into_water, 0.55]];
    const up = track(t, nb);
    const n0 = bT.clone(), n1 = bT.clone().add(new THREE.Vector3(0, 0.46, 0));
    tgt.lerpVectors(n0, n1, up);
    const bd = 1.05 + 1.25 * up + 0.04 * (t - A.numbers);
    pos.copy(tgt).add(new THREE.Vector3(0.38, 0.18 - 0.1 * up, 1).normalize().multiplyScalar(bd));
    const outro = ramp(t, A.into_water_e + 0.1, A.twist + 0.15, ease.inOut);
    // twist: upper body for the panting, full body for the jog, upper body again for the dizzy
    const uT = new THREE.Vector3(0.05, 1.42, 0.0), uP = orbit(uT, 2.75, 0.35, 0.04, new THREE.Vector3());
    const fT = new THREE.Vector3(0.0, 0.95, 0.0), fP = orbit(fT, 4.3, 0.9, 0.02, new THREE.Vector3());
    const wide = ramp(t, A.because2 - 0.1, A.burns, ease.inOut) - ramp(t, A.panting - 0.25, A.purpose + 0.2, ease.inOut);
    const twP = uP.clone().lerp(fP, wide), twT = uT.clone().lerp(fT, wide);
    if (t < A.end - 0.3) {
      pos.lerp(twP, outro); tgt.lerp(twT, outro);
      if (t > A.dizzy - 0.3) { const k = ramp(t, A.dizzy - 0.3, A.dizzy + 0.3); pos.x += 0.02 * k * Math.sin(t * 7); pos.y += 0.015 * k * Math.cos(t * 5.3); }
      return { pos, tgt, fov };
    }
    // end: upper body with the breath, then down into the lump = the first frame
    const ek = ramp(t, A.end, A.breathe_out3, ease.inOut);
    const eT = new THREE.Vector3(0.12, 1.45 + 0.05 * ek, 0.06), eP = orbit(eT, 2.6 - 0.5 * ek, 0.3 + 0.12 * ek, 0.05, new THREE.Vector3());
    const ein = ramp(t, A.end - 0.3, A.end + 0.9, ease.inOut);
    pos.copy(twP).lerp(eP, ein); tgt.copy(twT).lerp(eT, ein);
    const home = ramp(t, A.breathe_out3 + 0.35, D, ease.inOut);
    const c0 = new THREE.Vector3(); orbit(LW, 1.12, -0.22, 0.0, c0);
    pos.lerp(c0, home); tgt.lerp(LW, home);
    return { pos, tgt, fov };
  }

  // ---------------------------------------------------------------- helpers for the timeline
  const showAt = (t, t0, t1, fin = 0.25, fout = 0.3) => Math.min(ramp(t, t0, t0 + fin, ease.out), 1 - ramp(t, t1, t1 + fout, ease.inOut));
  const pop = (t, t0) => { const u = clamp01((t - t0) / 0.28); return u >= 1 ? 1 : 1 + 0.18 * Math.sin(u * Math.PI) * (1 - u) - 0.0 * u; };
  const placeT = (el, x, y, op, { anchor = 'c', scale = 1, rot = 0 } = {}) => {
    if (op <= 0.001) { el.style.opacity = 0; return; }
    O.place(el, x, y, { anchor, opacity: op });
    if (scale !== 1 || rot) el.style.transform += ` scale(${scale}) rotate(${rot}deg)`;
  };
  const stamp = (el, t, t0, t1, x, y) => {
    const u = clamp01((t - t0) / 0.18);
    const op = showAt(t, t0, t1, 0.06, 0.25);
    placeT(el, x, y, op, { scale: u < 1 ? 1.9 - 0.9 * ease.out(u) : 1, rot: -6 });
  };
  const leader = (line, x0, y0, x1, y1, op) => {
    line.setAttribute('points', `${x0},${y0} ${x1},${y1}`);
    line.style.opacity = op;
  };

  // ---------------------------------------------------------------- update
  const heroTint = new THREE.Color();
  const hlNow = { C: 0, H: 0, O: 0 };
  const glassCol = new THREE.Color(P.glass), mint = new THREE.Color(P.good);
  let lastLump = 1;
  function update(t, opt = {}) {
    const ft = opt.frameT ?? t;
    // ---- breathing and pose
    const br = breath.at(t);
    const J = data.jog;
    const jog = ramp(t, J.t0, J.full) * (1 - ramp(t, J.out0, J.t1));
    const jogPhase = 2 * Math.PI * J.hz * Math.max(0, t - J.t0);
    const dizzy = ramp(t, A.dizzy - 0.4, A.dizzy + 0.2) * (1 - ramp(t, A.end + 0.4, A.end + 1.4));
    const turn = ramp(t, A.survey - 0.1, A.doctors, ease.inOut) * (1 - ramp(t, A.right_e + 0.2, A.atoms + 0.3));
    B.root.rotation.y = YAW - 0.65 * turn;
    pose(B, t, { jog, phase: jogPhase, breath: br, dizzy });

    // ---- the body's visibility: hidden in the hook close-up and the end close-up, on through the middle
    const bodyOn = ramp(t, A.because + 0.1, A.leaves + 0.1) * (1 - ramp(t, D - 0.85, D - 0.15));
    const inMol = t > A.atoms + 0.32 && t < A.which + 0.55;
    B.mats.u.uAlpha.value = bodyOn; B.mats.ub.uAlpha.value = 0.22 * bodyOn;
    B.setVisible(bodyOn > 0.002 && !inMol);
    const organs = ramp(t, A.because + 0.3, A.leaves + 0.3) * (1 - ramp(t, D - 0.9, D - 0.3));
    B.lungU.uAlpha.value = organs * (0.85 + 0.35 * br); B.awMat.uniforms.uAlpha.value = organs * 0.9;
    B.lungs.visible = B.airMesh.visible = organs > 0.002 && !inMol;
    B.mats.u.uWarmAmt.value = 0.5 * bodyOn;
    B.mats.u.uLegs.value = 0.9 * jog * ramp(t, A.needs - 0.2, A.needs + 0.4);
    // the three who got it right: the hero turns mint
    const right = ramp(t, A.only + 0.25, A.three + 0.3) * (1 - ramp(t, A.right_e + 0.2, A.atoms));
    heroTint.copy(glassCol).lerp(mint, right);
    B.mats.u.uColor.value.copy(heroTint);
    B.mats.u.uRim.value = 1.5 + 1.2 * right;

    // ---- the lump
    const melt = ramp(t, A.melt - 0.1, A.away_e + 0.05, ease.inOut) * (1 - ramp(t, A.muscle_or - 0.12, A.muscle_or + 0.18, ease.inOut));
    const muscle = ramp(t, A.muscle_or + 0.15, A.muscle + 0.05, ease.inOut) * (1 - ramp(t, A.sweat_and - 0.15, A.sweat_and + 0.25, ease.inOut));
    const sweatK = clamp01((t - (A.sweat - 0.15)) / (A.because - A.sweat + 0.05));
    const inside = ramp(t, A.because, A.leaves + 0.2, ease.inOut) * (1 - ramp(t, D - 1.25, D - 0.05, ease.inOut));
    const lumpScale = lerp(1, LUMP_IN, inside);
    // the burst in the hook: the lump gives up some of itself; jogging empties it a little more
    const giveA = ramp(t, A.because + 0.2, A.breathe_out + 0.6) * (1 - ramp(t, A.survey, A.only));
    const giveB = ramp(t, A.burns, A.panting) * (1 - ramp(t, A.dizzy, A.end + 1));
    F.group.scale.setScalar(lumpScale * (1 - 0.22 * giveA - 0.15 * giveB));
    lastLump = F.group.scale.x;
    const lumpVisible = !inMol && !(t > A.numbers - 0.35 && t < A.into_water_e + 0.1 && false);
    F.update({ t, wob: 1 - 0.5 * inside, melt, muscle, sweat: sweatK > 0 && sweatK < 1 ? sweatK : 0, shrink: 0,
      glow: 1 + 0.4 * (1 - inside) + 0.5 * giveA + 0.6 * giveB, visible: lumpVisible, h: inside > 0.5 ? 0.0055 : 0.0046 });

    // ---- specks and vapour
    specks.mat.uniforms.uPx.value = post.ss;
    vapor.mat.uniforms.uPx.value = post.ss;
    specks.pts.visible = !inMol;
    if (!inMol) specks.update(t, { gain: 1 });
    vapor.pts.visible = !inMol && bodyOn > 0.01;
    if (vapor.pts.visible) vapor.update(t, bodyOn * (1 - ramp(t, A.numbers - 0.3, A.numbers + 0.3) + ramp(t, A.into_water, A.twist)));

    // ---- crowd
    const crowdOn = ramp(t, A.survey - 0.1, A.asked) * (1 - ramp(t, A.right_e + 0.3, A.atoms + 0.2));
    crowdGroup.visible = crowdOn > 0.002;
    if (crowdGroup.visible) {
      cm.u.uAlpha.value = crowdOn; cm.ub.uAlpha.value = 0.22 * crowdOn;
      const blk = [ramp(t, A.doctors - 0.1, A.doctors + 0.2) * (1 - ramp(t, A.dietitians - 0.1, A.dietitians + 0.2)),
        ramp(t, A.dietitians - 0.1, A.dietitians + 0.2) * (1 - ramp(t, A.trainers - 0.1, A.trainers + 0.25)),
        ramp(t, A.trainers - 0.1, A.trainers + 0.2) * (1 - ramp(t, A.where - 0.1, A.where + 0.3))];
      crowdSlots.forEach((s, i) => {
        const hi = 1 + 0.9 * blk[s.block];
        const isRight = right3.has(i);
        if (isRight) tint.setRGB(1, 1, 1).lerp(mint, right).multiplyScalar(hi * (1 + 0.6 * right));
        else tint.setRGB(1, 1, 1).multiplyScalar(hi * (1 - 0.72 * right)).lerp(new THREE.Color(0.45, 0.2, 0.2), right * 0.5);
        crowd.front.setColorAt(i, tint); crowd.back.setColorAt(i, tint);
      });
      crowd.front.instanceColor.needsUpdate = true; crowd.back.instanceColor.needsUpdate = true;
      cm.u.uRim.value = 1.5;
    }

    // ---- the molecule
    R.group.visible = molHaze.pts.visible = inMol;
    if (inMol) {
      const hl = { C: showAt(t, A.carbon - 0.05, A.hydrogen - 0.1, 0.2, 0.2), H: showAt(t, A.hydrogen - 0.05, A.oxygen - 0.1, 0.2, 0.2),
        O: showAt(t, A.oxygen - 0.05, A.energy - 0.2, 0.2, 0.3) };
      Object.assign(hlNow, hl);
      hl.any = Math.max(hl.C, hl.H, hl.O);
      R.update({
        t, spin: 0.35 * Math.sin((t - A.atoms) * 0.25) + (t - A.atoms) * 0.12, hl,
        o2In: ramp(t, A.energy - 0.6, A.apart + 0.3, ease.linear), burst: ramp(t, A.breaks, A.apart_e + 0.25, ease.linear),
        mix: ramp(t, A.apart, A.breathe_in_e + 0.4, ease.linear), co2Form: ramp(t, A.pieces, A.co2_e + 0.2, ease.linear),
        h2oForm: ramp(t, A.water - 0.25, A.water_e + 0.45, ease.linear), rise: ramp(t, A.co2_e - 0.1, A.water + 0.3, ease.inOut),
        fall: ramp(t, A.water_e + 0.2, A.which + 0.6, ease.in), fatGlow: 0.22 + 0.6 * ramp(t, A.breaks, A.apart),
      });
      molHaze.update(t);
      molHaze.mat.uniforms.uPx.value = post.ss;
    }

    // ---- water on the body
    const sw = ramp(t, A.sweat2 - 0.1, A.sweat2 + 0.4);
    sweat.visible = sw > 0 && t < A.numbers;
    if (sweat.visible) {
      sweatPts.forEach((p, i) => {
        const g = clamp01(sw * 1.4 - i * 0.06), slide = 0.012 * clamp01(t - A.sweat2 - 0.4 - i * 0.1);
        const r = 0.0065 * g * (0.8 + 0.4 * ((i * 7) % 3) / 2);
        cM.compose(cP.set(p[0], p[1] - slide, p[2] + 0.004), cQ.identity(), cS.set(r, r * 1.2, r * 0.7));
        sweat.setMatrixAt(i, cM);
      });
      sweat.instanceMatrix.needsUpdate = true;
    }
    const te = clamp01((t - A.tears + 0.1) / 1.4);
    tear.visible = te > 0 && t < A.numbers;
    if (tear.visible) {
      const r = 0.0055 * Math.min(1, te * 4);
      tear.position.set(0.034, 1.605 - 0.05 * ease.inOut(clamp01(te * 1.3 - 0.15)), 0.084 - 0.01 * te);
      tear.scale.set(r, r * 1.35, r * 0.8);
    }
    const bl = ramp(t, A.pee - 0.15, A.pee + 0.35) * (1 - ramp(t, A.numbers - 0.3, A.numbers));
    bladder.visible = bl > 0;
    bladder.material.uniforms.uA.value = bl * (0.8 + 0.2 * Math.sin(t * 6));
    bladder.scale.set(0.045, 0.038, 0.035).multiplyScalar(0.7 + 0.3 * bl);

    // ---- the block
    const drop = ramp(t, A.numbers + 0.25, A.ten - 0.05, ease.in);
    const blk = (drop > 0 ? 1 : 0) * (1 - ramp(t, A.twist - 0.2, A.twist + 0.2));
    block.visible = blk > 0.001 && t < A.twist + 0.3;
    blockShadow.visible = block.visible;
    const cut = ramp(t, A.eight - 0.05, A.lungs_e - 0.1, ease.inOut);
    const toWater = ramp(t, A.one6 + 0.1, A.into_water_e - 0.2, ease.inOut);
    if (block.visible) {
      const land = clamp01((t - (A.ten - 0.05)) / 0.45);
      const pp = land > 0 && land < 1 ? 1 + 0.12 * Math.sin(land * Math.PI * 2.5) * (1 - land) : 1;
      block.position.y = BLOCK.at.y + 0.7 * (1 - drop);
      const sl = 1 - ease.in(toWater);
      block.scale.set(blk * (2 - pp) * (1 + 0.25 * toWater), blk * pp * sl, blk * (2 - pp) * (1 + 0.25 * toWater));
      block.visible = block.visible && sl > 0.02;
      bm.U.uCut.value = cut > 0 ? lerp(BLOCK.h + 0.02, SPLIT, cut) : 10;
      bm.U.uWater.value = toWater; bm.U.uWaterY.value = SPLIT + 0.01;
      bm.U.uTime.value = t;
      blockShadow.material.uniforms.uAmt.value = blk * (0.3 + 0.7 * drop);
    }
    // the last 1.6 kg: the slab slumps and becomes a pool of water
    const pw = ramp(t, A.one6 + 0.1, A.into_water_e - 0.1, ease.inOut) * (1 - ramp(t, A.twist - 0.2, A.twist + 0.2));
    puddle.visible = pw > 0.001;
    if (puddle.visible) {
      const wob = 1 + 0.03 * Math.sin(t * 7) * (1 - pw * 0.5);
      puddle.scale.set(0.2 * (0.5 + 0.7 * pw) * wob, 0.034 * (0.4 + 0.6 * pw), 0.2 * (0.5 + 0.7 * pw) / wob);
      puddle.material.opacity = 0.92 * Math.min(1, pw * 2.5);
    }
    cloud.update(t, { cut, gain: 1 - ramp(t, A.into_water_e, A.twist + 0.2), rise: ramp(t, A.eight, A.only16, ease.linear) });
    cloud.mat.uniforms.uPx.value = post.ss;

    // ---- dizzy stars
    stars.forEach((s, i) => {
      const a = t * 3.2 + i * (Math.PI * 2 / 5);
      s.visible = dizzy > 0.01;
      s.position.set(Math.cos(a) * 0.17, 1.8 + 0.02 * Math.sin(a * 2), Math.sin(a) * 0.17 + 0.0);
      s.scale.setScalar(0.03 * dizzy);
      s.lookAt(camera.position); s.rotateZ(t * 2 + i);
    });

    // ---- studio
    studio.MU.uTime.value = 2 * Math.PI * t / D;          // periodic over the video: the loop is seamless
    studio.MU.uScale.value = post.ss;
    studio.FU.uGrid.value = 0.6 * jog;
    studio.FU.uScroll.value = (t - A.because2) * 1.6 * (t > A.because2 ? 1 : 0) * 0 + integJog(t);
    studio.U.uWarmAmt.value = inMol ? 0.06 : 0.0;
    studio.floor.visible = studio.shadow.visible = !inMol && t > A.because;
    studio.motes.visible = true;

    // ---- camera
    const C = cam(ft === t ? t : t);
    camera.position.copy(C.pos);
    camera.fov = C.fov; camera.updateProjectionMatrix();
    camera.lookAt(C.tgt);
    // a breath of handheld drift
    camera.rotation.z += 0.004 * Math.sin(2 * Math.PI * 7 * t / D);
    const fwd = tmpV.subVectors(C.tgt, C.pos).normalize();
    studio.U.uGlowDir.value.copy(fwd).setY(fwd.y * 0.3 + 0.05);

    if (!opt.sub && !Q.cover) overlayAt(ft, { br, dizzy, right });
  }

  function integJog(t) {
    // floor scroll = integral of the jog speed
    const a = A.because2 + 0.55, b = A.panting + 0.4;
    if (t <= a) return 0;
    const sp = 1.5, u = Math.min(t, b) - a;
    return sp * u;
  }

  // ---------------------------------------------------------------- overlay at frame time
  function overlayAt(t) {
    const W = 1080;
    // plate behind the top text whenever there is top text
    // hook
    const titleOp = Math.max(1 - ramp(t, A.fat0 - 0.15, A.melt - 0.05), ramp(t, D - 0.6, D - 0.05));
    const tq = clamp01(t / 0.3);
    placeT(ov.title1, W / 2, 320, titleOp, { scale: 1 });
    placeT(ov.title2, W / 2, 450, titleOp, { scale: 1 });
    const m1 = showAt(t, A.melt - 0.08, A.muscle_or - 0.1, 0.15, 0.2);
    placeT(ov.melt, W / 2, 400, m1, { scale: pop(t, A.melt - 0.08) });
    stamp(ov.x1, t, A.away + 0.12, A.muscle_or - 0.1, W / 2, 400);
    const m2 = showAt(t, A.muscle_or + 0.05, A.sweat_and - 0.15, 0.15, 0.2);
    placeT(ov.muscle, W / 2, 400, m2, { scale: pop(t, A.muscle_or + 0.05) });
    stamp(ov.x2, t, A.muscle + 0.15, A.sweat_and - 0.15, W / 2, 400);
    const m3 = showAt(t, A.sweat - 0.08, A.because - 0.05, 0.15, 0.2);
    placeT(ov.sweat, W / 2, 400, m3, { scale: pop(t, A.sweat - 0.08) });
    stamp(ov.x3, t, A.either + 0.05, A.because - 0.05, W / 2, 400);
    const m4 = showAt(t, A.breathe_out, A.survey + 0.1, 0.15, 0.3);
    placeT(ov.out, 450, 330, m4, { scale: pop(t, A.breathe_out) });
    stamp(ov.ok1, t, A.breathe_out + 0.1, A.survey + 0.1, 905, 330);
    // survey
    placeT(ov.doctors, W / 2, 330, showAt(t, A.doctors - 0.05, A.where - 0.2, 0.2, 0.3), { scale: pop(t, A.doctors - 0.05) });
    placeT(ov.dietitians, W / 2, 410, showAt(t, A.dietitians - 0.05, A.where - 0.2, 0.2, 0.3), { scale: pop(t, A.dietitians - 0.05) });
    placeT(ov.trainers, W / 2, 490, showAt(t, A.trainers - 0.05, A.where - 0.2, 0.2, 0.3), { scale: pop(t, A.trainers - 0.05) });
    placeT(ov.asked, W / 2, 360, showAt(t, A.where - 0.05, A.only - 0.15, 0.2, 0.25), { scale: pop(t, A.where - 0.05) });
    const th = showAt(t, A.three - 0.1, A.right_e + 0.15, 0.15, 0.25);
    placeT(ov.three, W / 2, 400, th, { scale: pop(t, A.three - 0.1) });
    placeT(ov.outOf, W / 2, 560, showAt(t, A.three + 0.05, A.right_e + 0.15, 0.2, 0.25));
    // atoms: legend with leaders to an atom of each kind
    const legend = [['carbon', 'nC', 'C', A.carbon], ['hydrogen', 'nH', 'H', A.hydrogen], ['oxygen', 'nO', 'O', A.oxygen]];
    const inMolT = t > A.atoms + 0.32 && t < A.which + 0.55;
    placeT(ov.fatMol, W / 2, 300, showAt(t, A.atoms + 0.5, A.carbon - 0.2, 0.3, 0.3));
    legend.forEach(([k, n, el, t0], i) => {
      const op = inMolT ? showAt(t, t0 - 0.05, A.breaks - 0.2, 0.2, 0.3) : 0;
      const y = 300 + i * 92;
      placeT(ov[k], 110, y, op, { anchor: 'l' });
      const x1 = 110 + ov[k].offsetWidth + 22;
      placeT(ov[n], x1, y + 4, op, { anchor: 'l' });
      if (op > 0 && (hlNow[el] ?? 0) > 0.05) {
        const p = toScreen(R.find(el), camera);
        leader(lines[k], x1 + ov[n].offsetWidth + 18, y, p.x, p.y, op * (hlNow[el] ?? 0));
      } else lines[k].style.opacity = 0;
    });
    placeT(ov.o2, W / 2, 330, inMolT ? showAt(t, A.with_oxygen - 0.05, A.pieces - 0.3, 0.2, 0.3) : 0, { scale: pop(t, A.with_oxygen - 0.05) });
    placeT(ov.co2, W / 2, 300, inMolT ? showAt(t, A.co2 - 0.05, A.water - 0.2, 0.2, 0.3) : 0, { scale: pop(t, A.co2 - 0.05) });
    placeT(ov.co2s, W / 2, 380, inMolT ? showAt(t, A.gas, A.water - 0.2, 0.2, 0.3) : 0);
    placeT(ov.h2o, W / 2, 1180, inMolT ? showAt(t, A.water - 0.05, A.which + 0.4, 0.2, 0.2) : 0, { scale: pop(t, A.water - 0.05) });
    placeT(ov.h2os, W / 2, 1255, inMolT ? showAt(t, A.water + 0.1, A.which + 0.4, 0.2, 0.2) : 0);
    lines.co2.style.opacity = 0; lines.h2o.style.opacity = 0;
    // water on the body: labels with leaders
    const wl = [['wSweat', 'brow', A.sweat2, 820, 330], ['wTears', 'eyeL', A.tears, 860, 470], ['wPee', 'bladder', A.pee, 850, 1150],
      ['wBreath', 'mouth', A.breath, 860, 620]];
    wl.forEach(([k, anc, t0, lx, ly]) => {
      const op = t > A.which + 0.5 ? showAt(t, t0 - 0.05, A.numbers - 0.95, 0.2, 0.3) : 0;
      placeT(ov[k], lx, ly, op, { anchor: 'c' });
      if (op > 0) {
        const p = toScreen(B.anchor(anc, tmpV2), camera);
        const tx = anc === 'mouth' ? p.x + 40 : p.x + 6;
        leader(lines[k], lx - ov[k].offsetWidth / 2 - 14, ly, tx, p.y, op * 0.9);
      } else lines[k].style.opacity = 0;
    });
    // numbers
    const bs = toScreen(BLOCK.at.clone().add(new THREE.Vector3(0, BLOCK.h + 0.05, 0)), camera);
    const k10 = showAt(t, A.ten - 0.05, A.eight - 0.15, 0.2, 0.3);
    placeT(ov.kg10, W / 2, 330, k10, { scale: pop(t, A.ten - 0.05) });
    placeT(ov.kg10s, W / 2, 450, k10);
    const k84 = showAt(t, A.eight - 0.05, A.into_water_e + 0.3, 0.2, 0.3);
    placeT(ov.kg84, W / 2, 300, k84, { scale: pop(t, A.eight - 0.05) });
    placeT(ov.kg84s, W / 2, 415, showAt(t, A.lungs - 0.1, A.into_water_e + 0.3, 0.2, 0.3));
    const k16 = showAt(t, A.one6 - 0.05, A.into_water_e + 0.3, 0.2, 0.3);
    const ws = toScreen(BLOCK.at.clone().add(new THREE.Vector3(0, 0.02, 0)), camera);
    placeT(ov.kg16, W / 2, Math.min(1220, ws.y + 150), k16, { scale: pop(t, A.one6 - 0.05) });
    placeT(ov.kg16s, W / 2, Math.min(1220, ws.y + 150) + 80, showAt(t, A.into_water - 0.05, A.into_water_e + 0.3, 0.2, 0.3));
    // twist
    const fa = showAt(t, A.faster - 0.05, A.because2 + 0.2, 0.2, 0.3);
    placeT(ov.faster, W / 2, 330, fa, { scale: pop(t, A.faster - 0.05) });
    stamp(ov.x4, t, A.wont + 0.1, A.because2 + 0.2, W / 2, 330);
    const mv = showAt(t, A.move - 0.05, A.panting - 0.1, 0.2, 0.3);
    placeT(ov.burns, W / 2, 440, showAt(t, A.burns - 0.05, A.panting - 0.1, 0.2, 0.3));
    placeT(ov.moving, 470, 330, mv, { scale: pop(t, A.move - 0.05) });
    stamp(ov.ok2, t, A.moveW + 0.05, A.panting - 0.1, 790, 330);
    const pa = showAt(t, A.panting - 0.05, A.end - 0.2, 0.2, 0.3);
    placeT(ov.panting, W / 2, 330, pa, { scale: pop(t, A.panting - 0.05) });
    placeT(ov.dizzy, W / 2, 430, showAt(t, A.dizzy - 0.05, A.end - 0.2, 0.15, 0.3), { scale: pop(t, A.dizzy - 0.05) });
    // the plate: as strong as the strongest top text
    const tops = [titleOp, m1, m2, m3, m4, th, k10, k84, fa, mv, pa, inMolT ? 1 : 0, showAt(t, A.doctors - 0.05, A.only - 0.15)];
    plate.style.opacity = Math.max(...tops) * 0.85;
  }

  window.dbg = { cam, A, B, F, camera, breath, specks };
  const post = { ss: +(Q.ss || 1.5), msaa: 0, grain: 0.02, vignette: 0.32, bloom: 0.16, bloomThreshold: 1.0, samples: 1, bg: 0x06090f };
  const fast = [[A.because - 0.05, A.leaves + 0.5], [A.survey - 0.2, A.doctors + 0.3], [A.right_e + 0.25, A.atoms + 0.35],
    [A.breaks, A.apart_e + 0.3], [A.breathe_out3 + 0.35, D]];
  return {
    scene, camera, update, post: Q.nopost ? null : post,
    blurSamples: (t) => (Q.blur === '0' ? 1 : fast.some(([a, b]) => t > a && t < b) ? 3 : 1),
    look: (t) => {
      const flash = ramp(t, A.right_e + 0.55, A.atoms + 0.3, ease.in) * (1 - ramp(t, A.atoms + 0.34, A.atoms + 0.9, ease.out));
      const wipe = Math.max(ramp(t, A.which + 0.25, A.which + 0.55) * (1 - ramp(t, A.which + 0.56, A.which + 0.95)),
        ramp(t, A.numbers - 0.6, A.numbers - 0.36) * (1 - ramp(t, A.numbers - 0.34, A.numbers + 0.05)), 0);
      return { fade: Math.max(flash, wipe), exposure: 1.0, bloom: Q.nobloom ? 0 : 0.16 + 0.1 * flash, fadeColor: t < A.split ? P.fat_glow : P.bg_low };
    },
  };
}

// ---------------------------------------------------------------- small helpers
function mountOn(B, bone) {
  const g = new THREE.Group();
  const j = JOINTS[bone];
  g.position.set(-j[0], -j[1], -j[2]);
  B.bones[bone].add(g);
  return g;
}

/** golden haze around the molecule: other fat molecules, out of focus */
function buildMolHaze(P, rnd) {
  const n = 160;
  const c = pointCloud(n, pointsMaterial(P.fat, { core: 0.4, halo: 0.6 }));
  const D = Array.from({ length: n }, () => ({ p: new THREE.Vector3((rnd() - 0.5) * 6, (rnd() - 0.5) * 5, -1.5 - rnd() * 6), s: 40 + rnd() * 160, ph: rnd() * 6 }));
  return {
    pts: c.pts, mat: c.pts.material,
    update(t) {
      D.forEach((d, i) => {
        c.pos.set([d.p.x + 0.1 * Math.sin(t * 0.3 + d.ph), d.p.y + 0.1 * Math.cos(t * 0.25 + d.ph), d.p.z], i * 3);
        c.size[i] = d.s; c.alpha[i] = 0.08 + 0.05 * Math.sin(t + d.ph);
      });
      c.flush();
    },
  };
}

/** the 8.4 kg: specks that leave the block as it dissolves and gather in a cloud above it */
function buildCloud(P, BLOCK, SPLIT, rnd) {
  const n = 2200;
  const c = pointCloud(n, pointsMaterial(P.fat_glow, { core: 2.0, halo: 0.9 }));
  c.pts.renderOrder = 8;
  const top = BLOCK.h, center = BLOCK.at.clone().add(new THREE.Vector3(0.0, 0.92, 0.0));
  const D = Array.from({ length: n }, () => {
    const y = SPLIT + rnd() * (top - SPLIT);
    const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
    return { src: new THREE.Vector3((rnd() - 0.5) * BLOCK.w, y, (rnd() - 0.5) * BLOCK.w), y,
      dst: new THREE.Vector3(g() * 0.2, g() * 0.13, g() * 0.13), ph: rnd() * 6.28, sz: 18 + rnd() * 12, sp: 0.8 + rnd() * 0.5 };
  });
  const tmp = new THREE.Vector3();
  return {
    pts: c.pts, mat: c.pts.material,
    update(t, { cut, gain, rise }) {
      const cutY = cut > 0 ? top + 0.02 - (top + 0.02 - SPLIT) * cut : 10;
      D.forEach((d, i) => {
        if (cutY > d.y || gain <= 0) { c.alpha[i] = 0; return; }
        // released when the dissolving edge passes its height; flies up into the cloud and keeps swirling
        const rel = (top + 0.02 - d.y) / (top + 0.02 - SPLIT);
        const age = Math.max(0, (cut - rel) * 5.5) / d.sp;
        const u = 1 - Math.pow(1 - Math.min(1, age), 2.2);
        tmp.copy(d.src).add(BLOCK.at);
        const dst = d.dst.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t * 0.35 + d.ph * 0.1).add(center);
        tmp.lerp(dst, u);
        tmp.y += Math.sin(u * Math.PI) * 0.12;
        tmp.x += Math.sin(t * 1.3 + d.ph) * 0.01; tmp.z += Math.cos(t * 1.1 + d.ph) * 0.01;
        c.pos.set([tmp.x, tmp.y, tmp.z], i * 3);
        c.alpha[i] = gain * Math.min(1, age * 5) * (0.75 + 0.25 * Math.sin(t * 8 + d.ph));
        c.size[i] = d.sz;
      });
      c.flush();
    },
  };
}
