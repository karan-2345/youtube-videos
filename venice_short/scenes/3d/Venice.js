// scenes/3d/Venice.js -- the whole Short as one continuous 3D scene: Santa Maria della Salute on a diorama of Venice
// whose front is cut open like a glass tank, so the canal water, the lagoon mud and the forest of wooden posts under
// the church are always in view. Everything is a pure function of t (seconds); word times come from scene.json.
//
// The story clock: the hook shows what should have happened (the posts rot, the church sinks) and rewinds it; the
// lagoon beat runs time back (the city un-builds, the posts pull out, the salt marsh and the first huts return); the
// piles beat grows a forest, fells it, sharpens and flips the trunks and hammers them in (a crew of pile drivers in
// front), packs the mud and builds the stone city on top; then the Salute and its million posts; a garden fence post
// rotting in the open air; back under water where there is almost no oxygen; a microscope's view of bacteria and
// water in the wood; and the upside-down forest, back into the opening shot (loop).
import * as THREE from 'three';
import { track, ramp, ease, clamp01, lerp, toScreen } from '/scenes/web/runtime.js';
import { mulberry } from '/scenes/3d/lib/common.js';
import { buildSky, SKY_FN, skyUniforms } from '/scenes/3d/lib/sky.js';
import { TANK, MED, buildGlass, buildTankWalls, buildBed, buildWater, buildSilt, withMedium } from '/scenes/3d/lib/medium.js';
import { buildPosts, buildPlanks, LEN } from '/scenes/3d/lib/posts.js';
import { buildChurch, stoneMaterial, leadMaterial, podiumGeometry, palazzo, roofMaterial, palinaGeometry } from '/scenes/3d/lib/church.js';
import { gondolaGeometry, rigGeometry, rammerGeometry, hutGeometry, boatGeometry, buildReeds, buildPuffs } from '/scenes/3d/lib/props.js';
import { buildPeople, dressFor, stand } from '/scenes/3d/lib/figures.js';
import { buildFence, buildO2, buildCells, FENCE_AT, CELLS_AT } from '/scenes/3d/lib/sets.js';

const DEG = Math.PI / 180;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
const smooth = (x) => x * x * (3 - 2 * x);

export async function setup({ renderer, data, overlay: O, W, H: HH }) {
  const A = data.anchors, P = data.palette, D = data.duration;
  const Q = new URLSearchParams(location.search);
  const SS = Number(Q.get('ss') || 1.5);
  const col = (h) => new THREE.Color(h);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / HH, 0.08, 9000);
  renderer.shadowMap.enabled = !Q.has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  const { MUD_TOP, BOTTOM, TX, TZ } = TANK;

  // ================================================================== light: late afternoon over the lagoon
  const SUN_DIR = V3(-0.62, 0.42, 0.66).normalize();
  const sun = new THREE.DirectionalLight(col('#FFD7A3'), 4.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 10, far: 260 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(col('#9DB8DA'), col('#6A5A40'), 0.9);
  const fill = new THREE.DirectionalLight(col('#A8BEDB'), 0.55); fill.position.set(80, 40, -60);
  scene.add(hemi, fill);
  function aimSun(center) {
    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(SUN_DIR, 120);
    sun.target.updateMatrixWorld();
  }
  const skyCfg = { top: '#4F7DB5', mid: '#A7C1DB', low: '#F3D6AE', haze: '#EBD3B2', sun: '#FFD9A0', sunDir: SUN_DIR, cloud: 0.8, sunSize: 1.2 };
  const sky = buildSky(skyCfg);
  scene.add(sky);
  const skyU = skyUniforms(skyCfg);

  // ================================================================== the tank: water over mud, glass in front
  const glass = buildGlass(P); scene.add(glass.group);
  scene.add(buildTankWalls());
  const ISLANDS = [[-15, -17, 9.5, 1], [12, -25, 10, 1], [-1, -35, 8, 0.95], [21, -11, 6, 0.9], [-24, -33, 7, 1], [5, -13, 5.2, 0.85], [-6, -26, 6, 0.9]];
  const bed = buildBed(P, ISLANDS); scene.add(bed.mesh);
  const water = buildWater(P, SKY_FN, skyU); scene.add(water.mesh);
  const silt = buildSilt(1400, D); scene.add(silt.points);

  // ================================================================== buildings
  const CH = V3(0, 1.0, -19);                       // the church's origin: campo level, centre of the octagon
  const bShared = { uBuild: { value: 100 }, uBuildGlow: { value: 0 }, uGlowCol: { value: col('#FFC27A') }, uHi: { value: 0 } };
  const hShared = { uBuild: { value: 100 }, uBuildGlow: { value: 0 }, uGlowCol: { value: col('#FFC27A') }, uHi: { value: 0 } };
  const stoneM = stoneMaterial(bShared), leadM = leadMaterial(bShared);
  const podM = stoneMaterial(bShared, { courses: true });
  const church = new THREE.Group(); church.position.copy(CH); scene.add(church);
  const CG = buildChurch();
  const chStone = new THREE.Mesh(CG.stone, stoneM), chLead = new THREE.Mesh(CG.lead, leadM);
  for (const m of [chStone, chLead]) { m.castShadow = true; m.receiveShadow = true; church.add(m); }
  // podium (in the church group so it sinks with it in the hook)
  const PY0 = MUD_TOP + 0.43;
  const podG = podiumGeometry([{ oct: 12, x: 0, z: 0 }, { w: 15, d: 15, x: 0, z: -13.5 }, { w: 12, d: 2.6, x: 0, z: 12.4, top: -1.6 }], PY0 - CH.y, 0);
  const podium = new THREE.Mesh(podG, podM); podium.castShadow = true; podium.receiveShadow = true; church.add(podium);

  const HOUSES = [
    [-25.3, -6, 7.2, 11, 12.5, '#D9A45B'], [-17.9, -6, 6.6, 10, 10.5, '#D98C7A'], [-25.3, -19, 7.2, 12, 13.5, '#C8664A'], [-18.0, -18, 6.8, 11, 11.5, '#E6D3A8'],
    [17.9, -6, 6.6, 10, 11.0, '#E0B07A'], [25.3, -6, 7.2, 11, 13.0, '#B85A45'], [17.9, -18, 6.8, 11, 12.5, '#D7C2A0'], [25.3, -19, 7.2, 12, 10.5, '#C97F5E'],
  ];
  const houseM = stoneMaterial(hShared, { stucco: true }), roofM = roofMaterial(hShared), hpodM = stoneMaterial(hShared, { courses: true });
  const houses = new THREE.Group(); scene.add(houses);
  HOUSES.forEach(([cx, zf, w, d, h, c], i) => {
    const g = palazzo(w, d, h, c, 40 + i);
    const wm = new THREE.Mesh(g.walls, houseM), rm = new THREE.Mesh(g.roof, roofM);
    for (const m of [wm, rm]) { m.position.set(cx, 0.6, zf); m.castShadow = true; m.receiveShadow = true; houses.add(m); }
    const pg = podiumGeometry([{ w: w + 0.5, d: d + 0.5, x: cx, z: zf - d / 2 }], PY0, 0.6);
    const pm = new THREE.Mesh(pg, hpodM); pm.castShadow = true; pm.receiveShadow = true; houses.add(pm);
  });
  // mooring poles by the steps and a cluster of channel markers
  const poleM = withMedium(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5 }));
  const poles = new THREE.Group(); scene.add(poles);
  for (const [x, z, c1, c2] of [[-8.6, -4.4, '#2E4F9A', '#F2F2F2'], [-7.7, -4.2, '#2E4F9A', '#F2F2F2'], [7.7, -4.2, '#B03030', '#F2F2F2'], [8.6, -4.4, '#B03030', '#F2F2F2']]) {
    const m = new THREE.Mesh(palinaGeometry(x, z, MUD_TOP - 2.5, 3.4, c1, c2), poleM); m.castShadow = true; poles.add(m);
  }
  { const brM = withMedium(new THREE.MeshStandardMaterial({ color: col('#5A4632'), roughness: 0.9 }));
    for (const [dx, dz, tl] of [[0, 0, 0.05], [0.3, 0.1, -0.06], [0.12, 0.32, 0.02]]) {
      const g = new THREE.CylinderGeometry(0.16, 0.18, 9.5, 8); g.translate(0, 4.75 + MUD_TOP - 3.5, 0);
      const m = new THREE.Mesh(g, brM); m.position.set(-23 + dx, 0, -2.4 + dz); m.rotation.z = tl; m.castShadow = true; poles.add(m);
    } }

  // ================================================================== the posts
  const rnd = mulberry(2024);
  const inOct = (x, z, R) => { const a = R * Math.cos(Math.PI / 8); return Math.abs(x) <= a && Math.abs(z) <= a && (Math.abs(x) + Math.abs(z)) <= a * Math.SQRT2; };
  const inChurch = (x, z) => inOct(x, z - CH.z, 11.9) || (Math.abs(x) < 7.4 && z > -40 && z < -24) || (Math.abs(x) < 5.9 && z > -8.6 && z < -5.6);
  const inHouse = (x, z) => HOUSES.some(([cx, zf, w, d]) => Math.abs(x - cx) < w / 2 && z < zf - 0.1 && z > zf - d);
  const spots = [];
  for (let x = -29.6; x <= 29.6; x += 0.75) for (let z = -40.5; z <= -5.5; z += 0.75) {
    const jx = x + (rnd() - 0.5) * 0.22, jz = z + (rnd() - 0.5) * 0.22;
    if (inChurch(jx, jz)) spots.push({ x: jx, z: jz, ch: true });
    else if (inHouse(jx, jz) && rnd() < 0.7) spots.push({ x: jx, z: jz, ch: false });
  }
  const NP = spots.length;
  const posts = buildPosts(spots.map((s) => [s.x, s.z]));
  scene.add(posts.trunks, posts.crowns, posts.ghosts);
  // per-post timing
  let rigPost = 0, best = 1e9;
  spots.forEach((s, i) => {
    s.r = rnd(); s.r2 = rnd(); s.twist = rnd() * 6.283; s.psi = (rnd() - 0.5) * 0.7;
    s.tilt = (rnd() - 0.5) * 0.07; s.tilt2 = (rnd() - 0.5) * 0.07;
    s.sx = (s.x + TX) / (2 * TX);
    const dc = s.ch ? Math.min(1, Math.hypot(s.x - CH.x, s.z - CH.z) / 13) : 0.4 + 0.6 * rnd();
    s.order = s.ch ? 1 - dc : dc;
    s.tGrow = A.cut - 0.6 + 0.5 * s.r;
    s.tFall = A.forests - 0.15 + 0.75 * s.sx + 0.12 * s.r2;
    s.tLift = A.sharpened - 0.3 + 0.3 * s.r;
    s.tNeedle = A.sharpened - 0.45 + 0.3 * s.r2;
    s.tSharp = A.sharpened + 0.1 + 0.35 * s.r;
    s.tFlip = A.posts1 - 0.2 + 0.35 * s.r2;
    s.tH1 = A.hammer2 + 0.05 + 1.65 * s.order + 0.1 * s.r;
    s.tHk = A.hammered + 0.05 + 0.6 * s.sx;                // the hook's echo of the hammering
    s.tPull = A.because + 0.55 + 0.8 * (1 - s.sx) + 0.15 * s.r;
    const d = Math.hypot(s.x + 3.2, s.z + 8.3);
    if (s.ch && d < best) { best = d; rigPost = i; }
  });
  const RIG = spots[rigPost];
  const RIG_BLOWS = [A.hammer2, A.hammer2 + 0.6, A.hammer2 + 1.2, A.hammer2 + 1.8];
  const HOVER = LEN + 2.5;
  const M4 = new THREE.Matrix4(), Qa = new THREE.Quaternion(), Qb = new THREE.Quaternion(), SV = new THREE.Vector3(), PV = new THREE.Vector3();
  const AX = V3(1, 0, 0), AY = V3(0, 1, 0), AZ = V3(0, 0, 1);
  const zeroM = new THREE.Matrix4().makeScale(0, 0, 0);

  /** The butt-end height of a post being hammered from HOVER: a free fall, then two taps. */
  function hammerY(t, t1) {
    if (t < t1 - 0.22) return HOVER;
    if (t < t1) { const u = (t - (t1 - 0.22)) / 0.22; return HOVER + (-1.6 - HOVER) * u * u; }
    if (t < t1 + 0.33) return -1.6;
    if (t < t1 + 0.40) return lerp(-1.6, -2.45, ease.out((t - t1 - 0.33) / 0.07));
    if (t < t1 + 0.62) return -2.45;
    if (t < t1 + 0.69) return lerp(-2.45, MUD_TOP, ease.out((t - t1 - 0.62) / 0.07));
    return MUD_TOP;
  }
  function rigY(t) {   // the rig's post: four blows of the rammer, from 3.4 down to 1.2 (then cut to level)
    let y = 3.4;
    for (const b of RIG_BLOWS) y -= 0.55 * ease.out(clamp01((t - b) / 0.06));
    return y;
  }
  /** Pose and state of post i at time t (the story's phases). */
  const stateA = posts.state.array;
  function posePost(i, t, phase) {
    const s = spots[i];
    let rot = 0, glow = 0, sharp = 1, crown = 0, scale = 1;
    let y = MUD_TOP, theta = Math.PI, lift = 0;
    if (phase === 'present') {
      // hook: the hammering echo, the rot and its rewind, the glow pulses
      if (t < A.because + 0.6) {
        const tb = s.tHk;
        if (t > tb - 0.3 && t < tb + 0.1) lift = t < tb ? 0.9 * ease.out(clamp01((t - (tb - 0.3)) / 0.2)) * (1 - ease.in(clamp01((t - (tb - 0.08)) / 0.08))) : 0;
        const r0 = ramp(t, A.rotted - 0.3 + 0.5 * s.r, A.rotted + 0.9 + 0.5 * s.r2, ease.inOut);
        rot = r0 * (1 - ramp(t, A.but - 0.05, A.but + 0.5, ease.inOut));
        glow = 0.9 * bump(t, A.millions + 0.15 + 0.9 * s.sx, 0.22) + 1.1 * bump(t, A.holding + 0.1 + 0.5 * (1 - s.order), 0.25);
      }
      // the lagoon rewind: pulled up out of the mud and gone
      if (t > s.tPull && t < A.so1) { const u = clamp01((t - s.tPull) / 0.75); y += 12 * ease.in(u); scale = 1 - u; if (u >= 1) return hide(i); }
      // later glow pulses: the million posts, the hold, the finale
      glow += 1.0 * bump(t, A.more_than + 0.2 + 0.9 * s.sx + 0.15 * s.r, 0.28);
      glow += 0.55 * bump(t, A.keeps + 0.25, 0.4) + 0.5 * bump(t, A.whole_forest + 0.2 + 0.5 * s.sx, 0.35);
    } else {
      // the piles beat: a tree grows, falls, is lifted, sharpened, flipped and hammered in
      if (t < s.tGrow) return hide(i);
      const grow = ease.out(clamp01((t - s.tGrow) / 0.5));
      const fall = clamp01((t - s.tFall) / 0.75);
      const fallA = fall < 1 ? fall * fall : 1;
      const bounce = fall >= 1 ? 0.06 * Math.exp(-(t - s.tFall - 0.75) * 9) * Math.sin((t - s.tFall - 0.75) * 30) : 0;
      const liftU = ease.inOut(clamp01((t - s.tLift) / 0.6));
      const flipU = ease.inOut(clamp01((t - s.tFlip) / 0.7));
      crown = grow * (1 - ease.inOut(clamp01((t - s.tNeedle) / 0.45)));
      sharp = ease.inOut(clamp01((t - s.tSharp) / 0.45));
      theta = Math.PI / 2 * fallA - bounce + Math.PI / 2 * flipU;
      y = -0.15 + 2.75 * liftU + (HOVER - 2.6) * flipU;
      scale = grow;
      if (i === rigPost && t > A.hammer2 - 0.3) { y = t < A.between - 0.4 ? rigY(t) : MUD_TOP; theta = Math.PI; }
      else if (t > s.tH1 - 0.22) y = hammerY(t, s.tH1);
      if (i !== rigPost && t > s.tFlip + 0.7 && t < s.tH1 - 0.22) y += 0.12 * Math.sin((t + s.r * 5) * 2.3);   // hovering
    }
    // matrix: T(x, y, z) * Ry(psi) * Rz(theta) * Ry(twist) * S
    const tk = clamp01(theta / Math.PI * 2 - 1);
    Qa.setFromAxisAngle(AY, s.psi * (1 - tk)); Qb.setFromAxisAngle(AX, theta + s.tilt * tk); Qa.multiply(Qb);
    Qb.setFromAxisAngle(AZ, s.tilt2 * tk); Qa.multiply(Qb);
    Qb.setFromAxisAngle(AY, s.twist); Qa.multiply(Qb);
    SV.set(scale, scale, scale); PV.set(s.x, y + lift, s.z);
    M4.compose(PV, Qa, SV);
    posts.trunks.setMatrixAt(i, M4);
    stateA[i * 4] = rot; stateA[i * 4 + 1] = glow; stateA[i * 4 + 2] = sharp; stateA[i * 4 + 3] = crown;
  }
  function hide(i) { posts.trunks.setMatrixAt(i, zeroM); stateA[i * 4 + 3] = 0; }

  // the planks (zatterone) over the post heads, under each podium
  const plankRects = [];
  { // church: per column of boards the z extent of the footprint, per row the x extent (contiguous)
    const zs = [], xs = [];
    for (let x = -11.8; x <= 11.8; x += 0.42) { let lo = 1e9, hi = -1e9; for (let z = -41; z < -5; z += 0.1) if (inChurch(x, z)) { lo = Math.min(lo, z); hi = Math.max(hi, z); } if (hi > lo) zs.push([x, lo, hi]); }
    for (let z = -40.5; z <= -5.6; z += 0.42) { let lo = 1e9, hi = -1e9; for (let x = -12; x < 12; x += 0.1) if (inChurch(x, z)) { lo = Math.min(lo, x); hi = Math.max(hi, x); } if (hi > lo) xs.push([z, lo, hi]); }
    plankRects.push({ zs, xs });
  }
  const plankList = [];
  for (const { zs, xs } of plankRects) {
    for (const [x, lo, hi] of zs) plankList.push([x + 0.2, (lo + hi) / 2, 0.38, hi - lo, MUD_TOP + 0.11, true]);
    for (const [z, lo, hi] of xs) plankList.push([(lo + hi) / 2, z + 0.2, hi - lo, 0.38, MUD_TOP + 0.33, true]);
  }
  for (const [cx, zf, w, d] of HOUSES) {
    for (let x = cx - w / 2; x < cx + w / 2 - 0.1; x += 0.42) plankList.push([x + 0.2, zf - d / 2, 0.38, d, MUD_TOP + 0.11, false]);
    for (let z = zf - d; z < zf - 0.1; z += 0.42) plankList.push([cx, z + 0.2, w, 0.38, MUD_TOP + 0.33, false]);
  }
  const planks = buildPlanks([], 0);   // empty builder for the material; real list below
  const plankGeo = new THREE.BoxGeometry(1, 0.2, 1);
  plankGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(plankList.map(() => rnd())), 1));
  const plankMesh = new THREE.InstancedMesh(plankGeo, planks.mesh.material, plankList.length);
  plankMesh.frustumCulled = false; scene.add(plankMesh);
  const plankT = plankList.map(([x, z, w, d, y, ch], i) => ({ t0: (y > MUD_TOP + 0.2 ? A.then + 0.32 : A.then) + 0.3 * rnd() + (ch ? 0 : 0.1), d: 0.3 * rnd() }));
  function posePlanks(t, phase) {
    plankList.forEach(([x, z, w, d, y], i) => {
      let off = 0, s = 1;
      if (phase === 'piles') { const u = clamp01((t - plankT[i].t0) / 0.3); if (u <= 0) { plankMesh.setMatrixAt(i, zeroM); return; } off = 5 * (1 - ease.out(u)); }
      else if (t > A.because + 0.35 && t < A.so1) { const u = clamp01((t - A.because - 0.35 - plankT[i].d) / 0.45); off = 8 * ease.in(u); s = 1 - u; if (u >= 1) { plankMesh.setMatrixAt(i, zeroM); return; } }
      M4.makeScale(w * s, s, d * s).setPosition(x, y + off, z);
      plankMesh.setMatrixAt(i, M4);
    });
    plankMesh.instanceMatrix.needsUpdate = true;
  }

  // ================================================================== people, the rig, boats, huts, gondola
  const PEOPLE_N = 12;
  const people = buildPeople(PEOPLE_N, 9);
  scene.add(people.group);
  const prnd = mulberry(5);
  const plain = (r) => ({ coat: ['#E8E0CC', '#8C6A48', '#B9A57E', '#6E5A44'][Math.floor(r() * 4)], trousers: ['#5A4A38', '#3E3A34', '#7A6A52'][Math.floor(r() * 3)], boot: 'skin', skin: ['#D9A982', '#B97E57', '#C88E66'][Math.floor(r() * 3)], hair: ['#2A1A10', '#4A3020', '#6A4A2A'][Math.floor(r() * 3)], hat: 'none', hatC: '#222', collar: null });
  for (let i = 0; i < 4; i++) people.dress(i, plain(prnd));                        // the pile drivers
  for (let i = 4; i < 10; i++) people.dress(i, plain(prnd));                       // settlers in two boats
  people.dress(10, { coat: '#F2EEE6', trousers: '#1C2230', boot: '#151110', skin: '#D9A982', hair: '#2A1A10', hat: 'straw', hatC: '#E4D29E', collar: null });   // gondolier
  people.dress(11, plain(prnd));
  const rigG = rigGeometry();
  const propM = withMedium(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8 }));
  const rig = new THREE.Group(); scene.add(rig);
  const raft = new THREE.Mesh(rigG.geo, propM); raft.castShadow = true; raft.receiveShadow = true; rig.add(raft);
  const rammer = new THREE.Mesh(rammerGeometry(), propM); rammer.castShadow = true; rig.add(rammer);
  rig.position.set(RIG.x, 0, RIG.z);
  const ropeM = new THREE.MeshStandardMaterial({ color: col('#B59A6E'), roughness: 0.9 });
  const ropes = Array.from({ length: 5 }, () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), ropeM); m.castShadow = true; rig.add(m); return m; });
  function ropeBetween(m, a, b) { const d = PV.subVectors(b, a); const L = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(AY, d.normalize()); m.scale.set(1, L, 1); }
  const CREW = [[-1.45, -1.25], [1.45, -1.25], [-1.45, 1.25], [1.45, 1.25]];

  const gond = new THREE.Mesh(gondolaGeometry(), propM); gond.castShadow = true; scene.add(gond);
  const oarM = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), new THREE.MeshStandardMaterial({ color: col('#B88A55'), roughness: 0.6 }));
  oarM.castShadow = true; scene.add(oarM);
  const GZ = -2.5;
  const gondX = (t) => -2 + 14 * Math.sin(2 * Math.PI * t / D);
  const gondV = (t) => 14 * 2 * Math.PI / D * Math.cos(2 * Math.PI * t / D);

  const boats = [0, 1].map(() => { const m = new THREE.Mesh(boatGeometry(), propM); m.castShadow = true; scene.add(m); return m; });
  const HUTS = [[-15, -17, 2.4, 2.0], [-12.5, -19.5, 2.0, 1.8], [12, -25, 2.6, 2.2], [14.5, -22.5, 2.0, 1.7], [-1, -35, 2.4, 2.0], [-24, -33, 2.2, 1.9]];
  const hutM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95 });
  const huts = HUTS.map(([x, z, w, d], i) => { const m = new THREE.Mesh(hutGeometry(w, d, i), hutM); m.position.set(x, 0.42, z); m.rotation.y = (i * 1.7) % 3; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; });
  const reedSpots = [];
  { const r = mulberry(8); for (let k = 0; k < 1500; k++) { const isl = ISLANDS[k % ISLANDS.length]; const a = r() * 6.28, d = Math.sqrt(r()) * isl[2] * 0.75; const x = isl[0] + Math.cos(a) * d, z = isl[1] + Math.sin(a) * d; if (z > -6) continue; reedSpots.push([x, 0.25, z, 0.6 + r() * 0.8]); } }
  const reeds = buildReeds(reedSpots); scene.add(reeds.mesh);

  // the stake that sinks into the soft mud (lagoon beat)
  const stakeIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 10, 6).translate(0, 1.6, 0), posts.bark, 1);
  stakeIM.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array([0.3]), 1));
  const stakeState = new THREE.InstancedBufferAttribute(new Float32Array([0, 0, 1, 0]), 4);
  stakeIM.geometry.setAttribute('aState', stakeState);
  stakeIM.frustumCulled = false; scene.add(stakeIM);

  // ================================================================== puffs (mud clouds, splashes, falling needles)
  const puffList = [];
  spots.forEach((s, i) => {
    if (i === rigPost) return;
    // the tip enters the mud during the free fall of the first blow; taps send smaller clouds
    const tTip = s.tH1 - 0.04;
    if (i % 3 === 0) puffList.push([s.x, MUD_TOP + 0.1, s.z, tTip, 0.9, 0]);
    if (i % 5 === 0) puffList.push([s.x, 0.05, s.z, s.tH1 - 0.11, 0.35, 1]);
    if (i % 7 === 0) puffList.push([s.x, MUD_TOP - 3.0, s.z, s.tH1 + 0.36, 0.6, 0]);
    if (i % 4 === 0) puffList.push([s.x, MUD_TOP - LEN + 0.4, s.z, s.tHk, 0.6, 0]);
    if (i % 9 === 0) puffList.push([s.x, 3.0, s.z + 6.0, s.tNeedle, 1.3, 2]);
  });
  for (const b of RIG_BLOWS) { puffList.push([RIG.x, 0.05, RIG.z, b, 0.55, 1]); puffList.push([RIG.x, 0.05, RIG.z, b + 0.01, 0.55, 1]); }
  puffList.push([0, MUD_TOP, -8, A.soft + 0.5, 1.2, 0], [0, MUD_TOP, -8, A.sticky + 0.2, 1.0, 0]);
  const puffs = buildPuffs(puffList); scene.add(puffs.points);

  // ================================================================== other sets
  const fence = buildFence(); scene.add(fence.group);
  const O2N = 150;
  const o2 = buildO2(O2N); scene.add(o2.mesh);
  const cells = buildCells(); scene.add(cells.group);
  const cellLight = new THREE.PointLight(col('#BFE8FF'), 60, 40, 1.6); cellLight.position.copy(CELLS_AT).add(V3(4, 6, 8)); scene.add(cellLight);
  const cellLight2 = new THREE.PointLight(col('#FFD9A8'), 30, 40, 1.6); cellLight2.position.copy(CELLS_AT).add(V3(-6, -3, 6)); scene.add(cellLight2);
  // spores (secret beat): fluffy white specks that drift down, land and die
  const SPN = 26, sporeR = mulberry(61);
  const spores = Array.from({ length: SPN }, () => ({ x: -2 + sporeR() * 7, z: -6.5 - sporeR() * 3.5, t0: A.fungi2 - 0.3 + sporeR() * 0.9, sp: 0.6 + sporeR() * 0.5, ph: sporeR() * 6 }));
  const sporeG = new THREE.IcosahedronGeometry(0.13, 1);
  const sporeMat = new THREE.MeshStandardMaterial({ color: col('#F4F1E8'), emissive: col('#E8E2D0'), emissiveIntensity: 1.2, roughness: 0.9, transparent: true });
  const sporeIM = new THREE.InstancedMesh(sporeG, sporeMat, SPN); sporeIM.frustumCulled = false; sporeIM.renderOrder = 8;
  const sporeCol = new THREE.Color(); scene.add(sporeIM);
  for (let i = 0; i < SPN; i++) sporeIM.setColorAt(i, col('#ffffff'));

  // ================================================================== overlays
  const el = (html, cls) => O.el(html, `t ${cls}`);
  const plate = O.el('', 'plate');
  const L = {
    venice: el('VENICE', 'title'),
    standsOn: el('STANDS ON A FOREST', 'sub'),
    millions: el('MILLIONS OF<br>TREE TRUNKS', 'mid2'),
    scaleNote: el('POSTS DRAWN BIGGER · NOT TO SCALE', 'label'),
    thousand: el('1,000+ YEARS', 'mid'),
    thousandSub: el('IN THE MUD', 'sub'),
    shouldHave: el('WHAT SHOULD<br>HAVE HAPPENED', 'mid2 red'),
    still: el('STILL HOLDING<br>THE CITY UP', 'mid2 mint'),
    ago: el('~1,500 YEARS AGO', 'mid2'),
    lagoonL: el('A SHALLOW LAGOON', 'label'),
    noRock: el('NO ROCK', 'mid2 red'),
    waterL: el('WATER', 'label'),
    mudL: el('SOFT MUD', 'label'),
    forests: el('WHOLE FORESTS', 'mid2'),
    sharpL: el('SHARPENED', 'mid2'),
    flipL: el('TIP FIRST', 'sub'),
    hammerL: el('HAMMERED IN', 'mid2'),
    perM: el('SIDE BY SIDE', 'mid2'),
    packed: el('PACKED FIRM', 'mid2 mint'),
    planksL: el('WOODEN PLANKS', 'label'),
    stoneL: el('STONE', 'label'),
    saluteL: el('SANTA MARIA<br>DELLA SALUTE', 'mid2'),
    built: el('BUILT 1631', 'sub'),
    count: el('0', 'big'),
    countSub: el('WOODEN POSTS UNDER ONE CHURCH', 'sub'),
    years: el('YEAR 1', 'big'),
    fewYears: el('A FEW YEARS', 'sub'),
    fungiL: el('FUNGI', 'label'),
    o2L: el('O₂ OXYGEN', 'label'),
    o2air: el('AIR', 'label'), o2water: el('WATER', 'label'), o2mud: el('MUD', 'label'),
    almost: el('ALMOST<br>NO OXYGEN', 'mid2'),
    noFungi: el('FUNGI CAN\'T<br>LIVE HERE', 'mid2 red'),
    bacteriaL: el('BACTERIA', 'label'),
    cent: el('100 YEARS', 'big'),
    centSub: el('VERY, VERY SLOWLY', 'sub'),
    waterFill: el('WATER FILLS THE WOOD', 'mid2'),
    shapeL: el('KEEPS ITS SHAPE', 'mid2 mint'),
    weightL: el('THE WEIGHT', 'label'),
    upside: el('AN UPSIDE-DOWN<br>FOREST', 'mid2 mint'),
    working: el('STILL WORKING', 'sub'),
  };
  const lead1 = O.line('rgba(244,247,250,0.8)', 3), dot1 = O.dot('rgba(244,247,250,0.9)', 7);
  const sq = O.line('rgba(255,214,140,0.95)', 5);
  const arrows = [0, 1, 2].map(() => O.line('rgba(255,214,140,0.95)', 9));
  const o2bar = [0, 1, 2].map(() => O.line('rgba(143,210,255,0.95)', 26));
  const xMark = el('<div class="xmark"></div>', '');
  const fade = (t, a, b, w = 0.25) => Math.min(ramp(t, a - w * 0.5, a + w * 0.5), 1 - ramp(t, b - w * 0.5, b + w * 0.5));
  const show = (d, t, a, b, x, y, opt = {}) => { const o = fade(t, a, b, opt.w ?? 0.25); if (o <= 0.001) { d.style.opacity = 0; return null; } return O.place(d, x, y, { anchor: opt.anchor ?? 'c', opacity: o, dy: (1 - o) * (opt.rise ?? 18) }); };
  const hideAll = () => { for (const d of Object.values(L)) d.style.opacity = 0; xMark.style.opacity = 0; plate.style.opacity = 0;
    for (const p of [lead1, sq, ...arrows, ...o2bar]) p.setAttribute('points', ''); dot1.setAttribute('r', 0); };
  const scr = (v) => toScreen(v, camera);
  function leader(p3, x, y, o) {
    const s = scr(p3);
    lead1.setAttribute('points', `${x},${y} ${s.x.toFixed(1)},${s.y.toFixed(1)}`); lead1.setAttribute('opacity', o);
    dot1.setAttribute('cx', s.x); dot1.setAttribute('cy', s.y); dot1.setAttribute('r', 7 * o);
  }
  function arrow(line, a, b, o) {   // a screen-space arrow from a to b (pixels)
    if (o <= 0.001) { line.setAttribute('points', ''); return; }
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, h = 34;
    const p = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
    line.setAttribute('points', [p(a[0], a[1]), p(b[0], b[1]), p(b[0] - ux * h - uy * h * 0.7, b[1] - uy * h + ux * h * 0.7), p(b[0], b[1]), p(b[0] - ux * h + uy * h * 0.7, b[1] - uy * h - ux * h * 0.7)].join(' '));
    line.setAttribute('opacity', o);
  }
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  // ================================================================== cameras
  // the opening shot H(t): a slow push in; defined for negative t too, so the finale can land in it (loop)
  const P0 = V3(0.6, 1.6, 50), T0 = V3(0, 7.6, -19), VEL = V3(0.03, -0.012, -0.33);
  const H = (t) => ({ pos: P0.clone().addScaledVector(VEL, t), tgt: T0.clone().addScaledVector(V3(0.02, -0.02, 0), t) });
  const keys = (t, list) => {   // list: [[t, [px,py,pz], [tx,ty,tz]], ...] -> eased per segment
    const pos = V3(...list[0][1]), tgt = V3(...list[0][2]);
    if (t <= list[0][0]) return { pos, tgt };
    for (let i = 1; i < list.length; i++) {
      const [t0, p0, g0] = list[i - 1], [t1, p1, g1] = list[i];
      if (t <= t1) { const u = ease.inOut(clamp01((t - t0) / (t1 - t0))); return { pos: V3(...p0).lerp(V3(...p1), u), tgt: V3(...g0).lerp(V3(...g1), u) }; }
    }
    const e = list[list.length - 1]; return { pos: V3(...e[1]), tgt: V3(...e[2]) };
  };
  const mix = (a, b, u) => ({ pos: a.pos.clone().lerp(b.pos, u), tgt: a.tgt.clone().lerp(b.tgt, u) });
  const F = FENCE_AT, C = CELLS_AT;
  const fv = (x, y, z) => [F.x + x, F.y + y, F.z + z], cv = (x, y, z) => [C.x + x, C.y + y, C.z + z];
  const SEC = spots.reduce((b, s, i) => (s.ch && Math.abs(s.x - 1.2) < 0.4 && s.z > b.z ? { i, z: s.z, x: s.x } : b), { i: 0, z: -1e9, x: 0 });
  const SHOTS = [
    ['hook', -10, A.because + 0.05],
    ['lagoon', A.because + 0.05, A.so1 - 0.05],
    ['forest', A.so1 - 0.05, A.hammer2 - 0.3],
    ['rig', A.hammer2 - 0.3, A.between - 0.4],
    ['top', A.between - 0.4, A.then - 0.15],
    ['build', A.then - 0.15, A.this_church],
    ['salute', A.this_church, A.wood_rots - 0.3],
    ['fence', A.wood_rots - 0.3, A.down - 0.25],
    ['secret', A.down - 0.25, A.bacteria - 0.35],
    ['cells', A.bacteria - 0.35, A.keeps - 0.25],
    ['hold', A.keeps - 0.25, A.under - 0.2],
    ['finale', A.under - 0.2, D + 10],
  ];
  const shotAt = (t) => SHOTS.find(([, a, b]) => t >= a && t < b) || SHOTS[SHOTS.length - 1];
  function cameraFor(shot, t) {
    const n = shot[0];
    if (n === 'hook') {
      const c = H(t);
      const sh = 0.25 * bump(t, A.long_ago + 0.2, 0.5);
      c.pos.x += sh * Math.sin(t * 47); c.pos.y += sh * Math.sin(t * 61 + 1);
      return c;
    }
    if (n === 'lagoon') return keys(t, [[A.because + 0.05, H(A.because + 0.05).pos.toArray(), H(A.because + 0.05).tgt.toArray()],
      [A.islands, [2, 24, 30], [0, -1, -20]], [A.where, [-1, 22, 28], [0, -1.5, -21]],
      [A.no_rock + 0.1, [6, -7.5, 34], [0, -8.0, -14]], [A.only_water, [5, -6.0, 32], [0, -6.5, -14]],
      [A.soft, [2.5, -2.2, 11.5], [0, -3.6, -7]], [A.so1, [2.0, -2.4, 10.5], [0, -3.9, -7.5]]]);
    if (n === 'forest') return keys(t, [[A.so1 - 0.05, [-3, 14, 44], [0, 3, -20]], [A.forests, [-6, 11, 40], [0, 3.5, -20]],
      [A.sharpened + 0.45, [2.5, 3.3, 7.5], [0, 2.5, -4]], [A.posts1 + 0.6, [-6, 7, 30], [0, 5, -19]], [A.hammer2, [-5, 6.5, 32], [0, 4.5, -19]]]);
    if (n === 'rig') return keys(t, [[A.hammer2 - 0.3, [RIG.x - 9.5, 2.6, RIG.z + 11], [RIG.x + 2, 1.8, RIG.z - 6]],
      [A.between - 0.4, [RIG.x - 8.0, 1.8, RIG.z + 9.5], [RIG.x + 2.5, 0.8, RIG.z - 7]]]);
    if (n === 'top') return keys(t, [[A.between - 0.4, [2.5, 9.5, -8], [1, MUD_TOP, -13.5]], [A.then - 0.15, [2.2, 7.5, -9.0], [1, MUD_TOP, -13.8]]]);
    if (n === 'build') return keys(t, [[A.then - 0.15, [-4, -0.6, 17], [0, -2.6, -14]], [A.stone - 0.1, [-5, 0.6, 22], [0, -1.0, -16]], [A.stone + 0.5, [-6, 4.5, 30], [0, 3, -19]],
      [A.this_church, [-9, 7.5, 40], [0, 12, -19]]]);
    if (n === 'salute') return keys(t, [[A.this_church, [-9, 7.5, 40], [0, 12, -19]], [A.salute_name + 0.6, [-13, 9, 31], [0, 14, -19]],
      [A.standing, [-11, 5, 30], [0, 10, -19]], [A.more_than, [-4, -4.5, 19], [0, -6.5, -19]], [A.wood_rots - 0.3, [-3, -5, 16], [0, -6.5, -19]]]);
    if (n === 'fence') return keys(t, [[A.wood_rots - 0.3, fv(2.2, 1.4, 4.6), fv(0, 0.6, 0)], [A.fungi1, fv(1.1, 0.75, 2.2), fv(0, 0.35, 0)],
      [A.eat + 0.4, fv(0.85, 0.6, 1.7), fv(0, 0.3, 0)], [A.crumbles - 0.2, fv(1.6, 0.9, 3.4), fv(0, 0.45, 0.2)], [A.down - 0.25, fv(1.9, 1.0, 3.9), fv(0, 0.4, 0.4)]]);
    if (n === 'secret') return keys(t, [[A.down - 0.25, [SEC.x + 3.0, 2.5, 16], [SEC.x, -0.5, SEC.z]], [A.almost, [SEC.x + 2.6, -1.2, 15], [SEC.x, -2.2, SEC.z]],
      [A.fungi2, [SEC.x + 2.2, -1.6, 10.5], [SEC.x, -2.6, SEC.z]], [A.without, [SEC.x + 1.4, -2.6, 6.0], [SEC.x, -3.4, SEC.z]],
      [A.bacteria - 0.35, [SEC.x + 0.4, -3.6, 1.6], [SEC.x, -4.2, SEC.z]]]);
    if (n === 'cells') return keys(t, [[A.bacteria - 0.35, cv(4.0, 3.0, 12), cv(0, 0, -2)], [A.slowly, cv(2.6, 1.6, 7.5), cv(0, 0, -3)],
      [A.water_fills, cv(1.8, 1.2, 6.0), cv(0, 0, -4)], [A.keeps - 0.25, cv(1.2, 0.8, 4.5), cv(0, 0, -4)]]);
    if (n === 'hold') return keys(t, [[A.keeps - 0.25, [SEC.x + 1.2, -4.8, 4.2], [SEC.x, -5.0, SEC.z]], [A.carrying, [-4, -3.2, 20], [0, 2.0, -19]], [A.under - 0.2, [-5, -2.0, 25], [0, 4, -19]]]);
    // finale: rise out of the water, along the palazzi and the church, land in H(t - D)
    const f = keys(t, [[A.under - 0.2, [-5, -2.0, 25], [0, 4, -19]], [A.palace + 0.3, [-14, 4.5, 30], [-12, 4, -12]],
      [A.church2 + 0.5, [-4, 4.0, 36], [0, 8, -19]], [A.upside, [3, -3.5, 30], [0, -2, -19]], [A.working, [2, -1.0, 40], [0, 3, -19]], [D - 1.8, H(-1.8).pos.toArray(), H(-1.8).tgt.toArray()]]);
    return mix(f, H(t - D), ramp(t, D - 2.6, D - 1.2));
  }

  // ================================================================== update
  const shaderErrs = () => { const out = []; scene.traverse((o) => { if (!o.material) return; for (const m of [].concat(o.material)) { const p = renderer.properties.get(m).currentProgram; if (p && p.diagnostics && !p.diagnostics.runnable) out.push((o.name || o.type) + ': ' + (p.diagnostics.vertexShader.log + ' ' + p.diagnostics.fragmentShader.log).trim().slice(0, 400)); } }); return out; };
  window.shaderErrors = shaderErrs;
  window.shaderSrc = (line) => { const out = []; scene.traverse((o) => { if (!o.material) return; for (const m of [].concat(o.material)) { const p = renderer.properties.get(m).currentProgram; if (p && p.diagnostics && !p.diagnostics.runnable) { const gl = renderer.getContext(); for (const sh of gl.getAttachedShaders(p.program)) { const src = gl.getShaderSource(sh).split('\n'); const log = gl.getShaderInfoLog(sh); if (log) out.push(log.slice(0, 200) + ' || ' + src.slice(line - 3, line + 2).join(' / ')); } } } }); return [...new Set(out)]; };
  let lastCam = null;

  function update(t, opt = {}) {
    const ft = opt.frameT ?? t;
    const shot = shotAt(ft);
    const sn = shot[0];
    const wT = t < 38 ? t : t - D;                  // the water's own clock: wraps inside the fence shot (unseen)
    const venice = !(sn === 'fence' || sn === 'cells');
    const phase = (ft >= A.so1 - 0.05 && ft < A.this_church + 0.5) ? 'piles' : 'present';
    const lagoonEra = ft >= A.because + 0.05 && ft < A.so1 + 0.8;   // the city is gone
    // ---------------------------------------------------------------- medium, water, sky
    MED.uMedT.value = wT; water.uni.uT.value = wT; silt.uni.uT.value = t; puffs.uni.uT.value = t; reeds.uni.uT.value = t;
    skyU.uTime.value = wT; sky.material.uniforms.uTime.value = wT;
    const clear = bump(ft, (A.between + A.then) / 2 - 0.3, 1.1);   // the top-down shot sees through the water
    MED.uWaterK.value = 0.085 - 0.06 * clear; water.uni.uWaterA.value = 1 - 0.75 * clear;
    MED.uO2.value = ramp(t, A.almost - 0.3, A.almost + 0.4) * (1 - ramp(t, A.bacteria - 0.5, A.bacteria));
    // ---------------------------------------------------------------- the church and the city
    let build = 100, bglow = 0;
    if (lagoonEra) build = -10;
    if (ft >= A.because && ft < A.because + 0.9) { build = lerp(36, PY0 - 0.2, ease.in(clamp01((ft - A.because) / 0.85))); bglow = 1; }
    if (phase === 'piles') {
      build = -10;
      if (t > A.stone - 0.45) { const u = clamp01((t - (A.stone - 0.45)) / (A.this_church + 0.2 - (A.stone - 0.45))); build = lerp(PY0 - 0.1, 36, ease.inOut(u)); bglow = 1 - ramp(t, A.this_church, A.this_church + 0.5); }
    }
    for (const s of [bShared, hShared]) { s.uBuild.value = build; s.uBuildGlow.value = bglow; }
    bShared.uHi.value = 0.8 * bump(ft, A.church2 + 0.2, 0.35) + 0.5 * bump(ft, A.salute_name, 0.4);
    hShared.uHi.value = 0.8 * bump(ft, A.palace + 0.15, 0.35);
    // the hook's "should have rotted": the church and its podium sink and lean, then rewind
    const sinkU = ramp(t, A.rotted - 0.1, A.long_ago + 0.55, ease.inOut) * (1 - ramp(t, A.but - 0.05, A.but + 0.5, ease.inOut));
    church.position.set(CH.x, CH.y - 5.5 * sinkU, CH.z);
    church.rotation.set(-4.5 * DEG * sinkU, 0, 7 * DEG * sinkU);
    houses.position.y = -3.0 * sinkU; houses.rotation.z = -2.5 * DEG * sinkU;
    const cityOn = !lagoonEra && !(phase === 'piles' && t < A.stone - 0.5);
    poles.visible = venice && cityOn && sn !== 'build';
    // ---------------------------------------------------------------- the bed, marsh, huts, reeds
    const marsh = lagoonEra ? ramp(ft, A.because + 0.9, A.islands, ease.inOut) * (1 - ramp(ft, A.so1 - 0.1, A.so1 + 0.6)) : 0;
    bed.uni.uMarsh.value = marsh; glass.mat.uniforms.uMarsh.value = marsh;
    bed.uni.uFirm.value = phase === 'piles' ? ramp(t, A.packed - 0.2, A.packed + 0.5) : (lagoonEra ? 0 : 1);
    reeds.uni.uGrow.value = marsh * ramp(ft, A.first, A.islands + 0.3);
    reeds.mesh.visible = marsh > 0.01;
    huts.forEach((h, i) => { const u = ramp(ft, A.built1 + i * 0.13, A.built1 + i * 0.13 + 0.35, ease.out) * (1 - ramp(ft, A.so1 - 0.2, A.so1 + 0.3)); h.visible = u > 0.01 && lagoonEra; h.scale.setScalar(Math.max(u, 1e-3)); h.position.y = 0.42 * marsh - 0.3 * (1 - u); });
    // ---------------------------------------------------------------- posts and planks
    if (venice || true) {
      for (let i = 0; i < NP; i++) posePost(i, t, phase);
      posts.trunks.instanceMatrix.needsUpdate = true; posts.state.needsUpdate = true;
      posePlanks(t, phase);
    }
    posts.uni.uSilt.value = phase === 'piles' ? ramp(t, A.hammer2 + 0.5, A.packed) : 1;
    posts.crowns.visible = phase === 'piles' && t < A.posts1 + 0.6;
    posts.ghostUni.uGhost.value = ramp(ft, A.whole_forest + 0.6, A.in_mud, ease.inOut) * (1 - ramp(ft, A.working - 0.3, D - 1.5, ease.inOut));
    posts.ghostUni.uGT.value = t;
    posts.ghosts.visible = posts.ghostUni.uGhost.value > 0.001;
    // the stake in the soft mud
    { const u = ramp(ft, A.soft - 0.6, A.sticky + 0.5, ease.inOut); stakeIM.visible = lagoonEra && ft > A.only_water && ft < A.so1;
      M4.makeTranslation(0.4, 1.4 - 5.2 * u, -8.0); stakeIM.setMatrixAt(0, M4); stakeIM.instanceMatrix.needsUpdate = true; }
    // ---------------------------------------------------------------- the rig and its crew
    const rigOn = sn === 'rig';
    rig.visible = rigOn;
    people.begin();
    if (rigOn) {
      const head = rigY(t) + 0.0;
      // the rammer: rises (pulled) between blows, falls onto the head at each blow
      let lift = 0;
      const nb = RIG_BLOWS.findIndex((b) => b > t);
      const next = nb < 0 ? 1e9 : RIG_BLOWS[nb], prev = nb === 0 ? A.hammer2 - 0.8 : (nb < 0 ? RIG_BLOWS[3] : RIG_BLOWS[nb - 1]);
      if (t < next) { const u = clamp01((t - prev - 0.08) / Math.max(0.1, next - prev - 0.2)); lift = 1.7 * Math.sin(Math.PI * 0.5 * Math.min(1, u * 1.15)); if (t > next - 0.1) lift *= 1 - ease.in((t - (next - 0.1)) / 0.1); }
      const ry = head + lift;
      rammer.position.set(0, ry, 0);
      const ringP = V3(RIG.x, ry + 1.0, RIG.z), apex = V3(RIG.x, 6.45, RIG.z);
      ropeBetween(ropes[0], ringP, apex);
      const pull = lift / 1.7;
      CREW.forEach(([dx, dz], k) => {
        const yaw = Math.atan2(-dz, dx) + Math.PI;     // face the centre (figures face +x locally)
        const lean = -0.25 * pull;
        const sh = 2.75 - 1.5 * pull, elb = 0.15 + 0.4 * pull;
        const bob = Math.sin(t * 3 + k) * 0.01;
        people.set(k, { x: RIG.x + dx, y: 0.19, z: RIG.z + dz, yaw, lean, arms: [sh, elb, sh, elb, 0.05, 0.05], thigh: -0.1 * pull, knee: 0.25 * pull, headTilt: -0.2 + 0.1 * pull, mouth: 0.3 + 0.3 * Math.max(0, Math.sin(t * 6.2 + k)), hop: bob });
        const hand = V3(RIG.x + dx * 0.72, 0.19 + 2.15 - 0.9 * pull, RIG.z + dz * 0.72);
        ropeBetween(ropes[k + 1], apex, hand);
      });
    }
    // settlers' boats in the lagoon
    boats.forEach((b, k) => {
      const on = lagoonEra && ft < A.so1 - 0.3;
      b.visible = on;
      if (!on) return;
      const u = ease.out(clamp01((ft - A.because - 0.7 - k * 0.4) / 3.2));
      const x = k ? lerp(26, 18.5, u) : lerp(-27, -19.5, u), z = k ? -8.5 : -10.5;
      b.position.set(x, 0.02 + 0.03 * Math.sin(t * 2.1 + k), z); b.rotation.set(0.02 * Math.sin(t * 1.7 + k), k ? Math.PI : 0, 0.02 * Math.sin(t * 1.3));
      for (let j = 0; j < 3; j++) {
        const lx = -1.2 + j * 1.15, row = j === 0 ? Math.sin(t * 2.6 + k) : 0;
        const wx = x + (k ? -lx : lx), yaw = k ? Math.PI : 0;
        people.set(4 + k * 3 + j, { x: wx, y: 0.3, z, yaw, arms: j === 0 ? [1.2 + 0.4 * row, 0.4, 1.2 + 0.4 * row, 0.4, 0.1, 0.1] : stand(j).arms, lean: 0.05 + 0.1 * row, scale: 0.95 });
      }
    });
    // the gondola
    { const gx = gondX(t), v = gondV(t), dir = v >= 0 ? 1 : -1;
      const on = venice && cityOn && sn !== 'build' && sn !== 'top';
      gond.visible = on; oarM.visible = on;
      water.uni.uWake.value.set(gx, GZ, dir, on ? Math.min(1, Math.abs(v) / 1.2) : 0);
      if (on) {
        const ph = 2 * Math.PI * t / (D / 40);
        gond.position.set(gx, 0.02 * Math.sin(t * 1.9), GZ); gond.rotation.set(0.025 * Math.sin(ph), dir > 0 ? 0 : Math.PI, 0.01 * Math.sin(t * 1.3));
        gond.updateMatrixWorld();
        const loc = (x, y, z) => V3(x, y, z).applyMatrix4(gond.matrixWorld);
        const stroke = Math.sin(ph);
        const hands = loc(-3.35 - 0.35 * stroke, 1.45, 0.25), pivot = loc(-2.9, 1.3, 0.62);
        const dirO = PV.subVectors(pivot, hands).normalize().clone();
        const blade = pivot.clone().addScaledVector(dirO, 3.2);
        ropeBetween(oarM, hands, blade);
        const g = loc(-3.55 - 0.1 * stroke, 0.45, 0.05);
        people.set(10, { x: g.x, y: g.y, z: g.z, yaw: dir > 0 ? 0 : Math.PI, lean: 0.1 + 0.12 * stroke, arms: [0.9 - 0.35 * stroke, 0.6, 1.1 - 0.35 * stroke, 0.5, 0.25, -0.1], thigh: 0.1 * stroke, knee: 0.1 });
      }
    }
    people.commit();
    // ---------------------------------------------------------------- the fence, the O2 molecules, the spores, the cells
    fence.group.visible = sn === 'fence';
    if (sn === 'fence') {
      fence.uni.uMyc.value = ramp(t, A.fungi1 - 0.2, A.eat + 0.6) + ramp(t, A.crumbles - 0.5, A.crumbles + 0.6) * 0.3;
      fence.uni.uRot.value = ramp(t, A.eat - 0.3, A.few_years);
      fence.uni.uFung.value = ramp(t, A.eat - 0.2, A.thats_why + 0.4);
      fence.setFungi(ramp(t, A.eat - 0.25, A.thats_why + 0.6), 0);
      const fall = clamp01((t - (A.few_years - 0.35)) / 0.6);
      fence.pose(fence.uni.uRot.value, fall);
    }
    const o2On = sn === 'fence' || sn === 'secret';
    o2.mesh.visible = o2On;
    if (o2On) {
      for (let i = 0; i < O2N; i++) {
        const [a, b, c, d, e] = o2.seeds[i];
        let x, y, z, al = 1;
        if (sn === 'fence') {
          x = (a - 0.5) * 6; y = 0.1 + b * 2.4; z = -2.2 + c * 2.8;
          x += 0.25 * Math.sin(t * 0.8 + e * 9); y += 0.15 * Math.sin(t * 1.1 + d * 7);
          // drawn into the post's foot where the fungi feed
          const pull = clamp01((t - A.eat - d * 2.2) / 1.4) * (i % 3 === 0 ? 1 : 0);
          x = lerp(x, 0.12 * Math.cos(e * 6), pull); y = lerp(y, 0.15 + 0.4 * b, pull); z = lerp(z, 0.12 * Math.sin(e * 6), pull);
          al = ramp(t, A.wood_rots - 0.2 + d, A.wood_rots + 0.4 + d) * (1 - pull * pull);
          x += F.x; y += F.y; z += F.z;
        } else {
          // the secret beat: dense in the air, thinner in the water, almost none in the mud
          const layer = i < 80 ? 0 : i < 130 ? 1 : 2;
          x = SEC.x - 3 + a * 6; z = SEC.z + 2.2 + c * 3.5;
          y = layer === 0 ? 0.5 + b * 3.2 : layer === 1 ? -0.3 - b * 2.4 : MUD_TOP - 0.6 - b * 3.5;
          if (layer === 2 && i % 10 !== 0) al = 0;
          x += 0.2 * Math.sin(t * 0.7 + e * 9); y += 0.1 * Math.sin(t * 0.9 + d * 7);
          al *= ramp(t, A.almost - 0.4 + d * 0.5, A.almost + 0.1 + d * 0.5) * (1 - ramp(t, A.without + 0.2, A.bacteria - 0.4));
          if (layer === 1) al *= 0.85;
        }
        const sc = 1.0 + 0.15 * Math.sin(t * 2 + e * 5);
        Qa.setFromAxisAngle(V3(d - 0.5, 1, e - 0.5).normalize(), t * (0.5 + a) + e * 6);
        M4.compose(V3(x, y, z), Qa, SV.set(sc, sc, sc));
        o2.mesh.setMatrixAt(i, M4); o2.fade.array[i] = al;
      }
      o2.mesh.instanceMatrix.needsUpdate = true; o2.fade.needsUpdate = true;
    }
    sporeIM.visible = sn === 'secret';
    if (sn === 'secret') {
      spores.forEach((s, i) => {
        const age = t - s.t0;
        let y = 1.6 - age * s.sp * 1.6, al = clamp01(age / 0.3), dead = 0;
        if (y < MUD_TOP + 0.05) { y = MUD_TOP + 0.05; dead = clamp01((t - (s.t0 + (1.6 - MUD_TOP) / (s.sp * 1.6))) / 0.9); }
        dead = Math.max(dead, ramp(t, A.cant, A.without + 0.2));
        al *= 1 - ramp(t, A.without + 0.4, A.bacteria - 0.4);
        const sc = (age < 0 ? 0 : 1) * (1 - 0.6 * dead) * (1 + 0.15 * Math.sin(t * 3 + s.ph));
        M4.compose(V3(s.x + 0.15 * Math.sin(t + s.ph), y, s.z), Qa.identity(), SV.set(sc, sc, sc));
        sporeIM.setMatrixAt(i, M4);
        sporeCol.setRGB(1, 1, 1).lerp(col('#6A675E'), dead);
        sporeIM.setColorAt(i, sporeCol);
      });
      sporeIM.instanceMatrix.needsUpdate = true; sporeIM.instanceColor.needsUpdate = true;
      sporeMat.opacity = 1;
    }
    cells.group.visible = sn === 'cells';
    cellLight.visible = cellLight2.visible = sn === 'cells';
    if (sn === 'cells') cells.update(t, ramp(t, A.nibble - 0.2, A.water_fills + 0.5, ease.linear), ramp(t, A.water_fills - 0.1, A.keeps - 0.3), ramp(t, A.bacteria - 0.1, A.bacteria + 0.35));
    // ---------------------------------------------------------------- visibility of the lagoon set
    for (const o of [glass.group, water.mesh, bed.mesh, silt.points, posts.trunks, plankMesh, church, houses, puffs.points]) o.visible = venice;
    sky.visible = sn !== 'cells';
    scene.background = sn === 'cells' ? col('#0E2A2C') : null;
    hemi.intensity = sn === 'cells' ? 0.4 : 0.9;
    // ---------------------------------------------------------------- camera
    const c = cameraFor(shot, t);
    camera.position.copy(c.pos); camera.lookAt(c.tgt);
    camera.fov = sn === 'cells' ? 44 : sn === 'fence' ? 34 : 40;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    aimSun(sn === 'fence' ? F.clone() : V3(0, 0, -19));
    scene.updateMatrixWorld(true);
    if (opt.sub) return;
    // ---------------------------------------------------------------- overlays (once per frame, at frameT)
    hideAll();
    if (Q.has('cover')) return;
    const T = ft;
    const top = 330;
    plate.style.opacity = sn === 'cells' || sn === 'fence' ? 0.6 : 0.85;
    if (sn === 'hook') {
      show(L.venice, T, -1, A.millions - 0.1, 540, top, { rise: 0 });
      show(L.standsOn, T, -1, A.millions - 0.1, 540, top + 105, { rise: 0 });
      show(L.millions, T, A.millions - 0.05, A.thousand - 0.35, 540, top + 20);
      show(L.scaleNote, T, A.millions + 0.2, A.thousand - 0.35, 540, 1690, { rise: 0 });
      show(L.thousand, T, A.thousand - 0.05, A.should, 540, top + 10);
      show(L.thousandSub, T, A.thousand + 0.2, A.should, 540, top + 95);
      show(L.shouldHave, T, A.rotted - 0.1, A.but, 540, top + 30);
      show(L.still, T, A.still - 0.05, A.because + 0.1, 540, top + 30);
    }
    if (sn === 'lagoon') {
      show(L.ago, T, A.because + 0.2, A.where, 540, top);
      show(L.lagoonL, T, A.shallow - 0.1, A.where, 540, top + 95);
      if (show(L.noRock, T, A.no_rock - 0.05, A.only_water + 0.1, 540, 1150)) {
        const s = scr(V3(0, BOTTOM + 0.5, -12)); O.place(xMark, s.x, Math.min(s.y, 1600), { anchor: 'c', opacity: fade(T, A.no_rock, A.only_water + 0.1) });
      }
      { const s = scr(V3(-6, -1.5, -6)); show(L.waterL, T, A.only_water - 0.05, A.so1, 300, Math.max(560, Math.min(1600, s.y)), { anchor: 'c' }); }
      { const s = scr(V3(-4.5, -5.0, -6)); show(L.mudL, T, A.soft - 0.05, A.so1, 300, Math.max(560, Math.min(1600, s.y)), { anchor: 'c' }); }
    }
    if (sn === 'forest') {
      show(L.forests, T, A.forests - 0.15, A.sharpened - 0.1, 540, top);
      show(L.sharpL, T, A.sharpened - 0.05, A.posts1 + 0.4, 540, top);
      show(L.flipL, T, A.posts1, A.hammer2 - 0.3, 540, top + 95);
    }
    if (sn === 'rig') show(L.hammerL, T, A.hammer2 - 0.2, A.between - 0.5, 540, top);
    if (sn === 'top') {
      const o = fade(T, A.between - 0.3, A.packed - 0.1);
      show(L.perM, T, A.between - 0.3, A.packed - 0.1, 540, top);
      show(L.packed, T, A.packed - 0.1, A.then - 0.15, 540, top);
    }
    if (sn === 'build') {
      { const s = scr(V3(-9, MUD_TOP + 0.3, -9)); show(L.planksL, T, A.then + 0.1, A.stone - 0.1, s.x, s.y + 60, { anchor: 'c' }); }
      { const s = scr(V3(-9, -0.5, -9)); show(L.stoneL, T, A.stone - 0.3, A.this_church, s.x, s.y - 40, { anchor: 'c' }); }
    }
    if (sn === 'salute') {
      show(L.saluteL, T, A.salute_name - 0.15, A.standing + 0.2, 540, top + 20);
      show(L.built, T, A.salute_name + 0.25, A.standing + 0.2, 540, top + 205);
      const cu = ramp(T, A.more_than - 0.1, A.million + 0.55, (x) => 1 - Math.pow(1 - x, 2.2));
      L.count.textContent = cu >= 0.999 ? '1,100,000+' : fmt(1_100_000 * cu);
      show(L.count, T, A.more_than - 0.15, A.wood_rots + 0.2, 540, top + 20, { rise: 0 });
      show(L.countSub, T, A.million - 0.2, A.wood_rots + 0.2, 540, top + 130);
    }
    if (sn === 'fence') {
      const yr = 1 + Math.floor(4 * ramp(T, A.fence - 0.2, A.few_years + 0.2, ease.linear) + 1e-6);
      L.years.textContent = `YEAR ${yr}`;
      show(L.years, T, A.thats_why, A.down, 540, top, { rise: 0 });
      show(L.fewYears, T, A.few_years - 0.15, A.down, 540, top + 115);
      { const s = scr(V3(F.x + 0.2, 0.25, F.z + 0.2)); show(L.fungiL, T, A.fungi1 + 0.1, A.thats_why - 0.1, s.x + 150, s.y - 160, { anchor: 'c' }); if (fade(T, A.fungi1 + 0.1, A.thats_why - 0.1) > 0) leader(V3(F.x + 0.1, 0.12, F.z + 0.12), s.x + 150, s.y - 125, fade(T, A.fungi1 + 0.1, A.thats_why - 0.1)); }
      show(L.o2L, T, A.wood_rots + 0.4, A.fungi1 - 0.1, 540, top);
    }
    if (sn === 'secret') {
      const o = fade(T, A.almost - 0.2, A.fungi2 - 0.1);
      show(L.almost, T, A.almost - 0.1, A.fungi2 - 0.15, 540, top);
      // the oxygen gauge: three bars at the right edge, for the air, the water and the mud
      if (o > 0) {
        const rows = [[L.o2air, 1.0, V3(SEC.x + 3, 1.5, SEC.z + 3)], [L.o2water, 0.45, V3(SEC.x + 3, -1.5, SEC.z + 3)], [L.o2mud, 0.04, V3(SEC.x + 3, MUD_TOP - 2.0, SEC.z + 3)]];
        rows.forEach(([d, v, p], k) => {
          const s = scr(p); const y = Math.max(560, Math.min(1650, s.y));
          O.place(d, 760, y - 34, { anchor: 'l', opacity: o });
          const w = 240 * v * ramp(T, A.almost - 0.1 + k * 0.15, A.almost + 0.5 + k * 0.15);
          o2bar[k].setAttribute('points', `760,${(y + 14).toFixed(0)} ${(760 + Math.max(w, 6)).toFixed(0)},${(y + 14).toFixed(0)}`); o2bar[k].setAttribute('opacity', o);
        });
      }
      show(L.noFungi, T, A.fungi2 - 0.05, A.bacteria - 0.4, 540, top);
      if (fade(T, A.cant - 0.1, A.bacteria - 0.4) > 0) O.place(xMark, 540, top + 250, { anchor: 'c', opacity: fade(T, A.cant - 0.1, A.bacteria - 0.4) });
    }
    if (sn === 'cells') {
      { const s = scr(V3(C.x + 0.4, C.y + 0.4, C.z - 0.8)); show(L.bacteriaL, T, A.bacteria + 0.1, A.slowly - 0.1, s.x, s.y - 150, { anchor: 'c' }); }
      const yrs = 100 * Math.max(1, Math.round(9 * ramp(T, A.slowly - 0.1, A.water_fills + 0.2, ease.linear)));
      L.cent.textContent = `${yrs} YEARS`;
      show(L.cent, T, A.slowly - 0.1, A.water_fills - 0.1, 540, top, { rise: 0 });
      show(L.centSub, T, A.slowly + 0.1, A.water_fills - 0.1, 540, top + 115);
      show(L.waterFill, T, A.water_fills - 0.1, A.keeps, 540, top);
    }
    if (sn === 'hold') {
      show(L.shapeL, T, A.keeps - 0.15, A.under, 540, top);
      const o = fade(T, A.carrying - 0.2, A.under + 0.1);
      if (o > 0) {
        [[-6, 0], [0, 0], [6, 0]].forEach(([dx], k) => {
          const a = scr(V3(dx, 9, -19)), b = scr(V3(dx, MUD_TOP - 0.5, -16));
          arrow(arrows[k], [a.x, a.y], [b.x, b.y], o * ramp(T, A.carrying - 0.2 + k * 0.1, A.carrying + 0.2 + k * 0.1));
        });
        show(L.weightL, T, A.carrying - 0.1, A.under + 0.1, 540, top + 110);
      }
    }
    if (sn === 'finale') {
      show(L.upside, T, A.upside - 0.1, A.working + 0.4, 540, top);
      show(L.working, T, A.working - 0.1, D - 0.9, 540, top + 160);
    }
    if (sn === 'hook' && T < A.millions - 0.1 || sn === 'finale' && T > A.working - 0.2) plate.style.opacity = 0.85;
    O.place(plate, 0, 0, { anchor: 'tl', opacity: Number(plate.style.opacity) });
    lastCam = c;
  }

  window.dbg = {
    cam: (t) => { const s = shotAt(t); const c = cameraFor(s, t); return { shot: s[0], pos: c.pos.toArray().map((v) => +v.toFixed(2)), tgt: c.tgt.toArray().map((v) => +v.toFixed(2)) }; },
    info: () => ({ posts: NP, planks: plankList.length, rigPost, sec: SEC, puffs: puffList.length }),
  };
  return {
    scene, camera, update,
    post: Q.has('nopost') ? null : { ss: SS, msaa: Number(Q.get('msaa') ?? 0), samples: 1, shutter: 0.5, grain: 0.024, vignette: 0.3, exposure: 1.0, bloom: 0.13, bloomThreshold: 1.1, bg: P.bg },
    blurSamples(t) {
      const fast = [[-1, 0.6], [A.hammered - 0.4, A.into_mud + 0.4], [A.long_ago - 0.3, A.still + 0.2], [A.because, A.islands],
        [A.forests - 0.2, A.hammer2 + 2.2], [A.then, A.this_church + 0.4], [A.standing, A.more_than + 0.3], [A.few_years - 0.5, A.few_years + 0.5], [D - 3, D + 1]];
      for (const [a, b] of fast) if (t > a && t < b) return Math.max(1, Number(Q.get('blur') ?? 3));
      return 1;
    },
    look(t) {
      const sn = shotAt(t)[0];
      const what = ramp(t, A.rotted - 0.1, A.rotted + 0.3) * (1 - ramp(t, A.but - 0.05, A.but + 0.35));
      // flashes at the cuts into and out of the microscope
      const fl = Math.max(bump(t, A.bacteria - 0.35, 0.07), bump(t, A.keeps - 0.25, 0.07));
      return { mono: 0.55 * what, fade: 0.85 * fl, fadeColor: '#CFEFFF', exposure: sn === 'cells' ? 1.15 : 1.0 };
    },
  };
}
