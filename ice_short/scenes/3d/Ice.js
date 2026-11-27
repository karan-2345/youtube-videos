// scenes/3d/Ice.js -- the Ice King Short as one 3D world, cut on the words:
//   sea       the Caribbean at golden hour: the brig (Tudor's Favorite, 1806) sails for Martinique with her hold cut
//             open on a cargo of pond ice; Saint-Pierre's pier, where the town laughs and the ice melts; the race
//             between a big block and the same ice in small pieces; the Tuscany on the open Atlantic (1833); the
//             Hooghly at Calcutta, the crowd, the ice house, the crown; the glass of ice on the brig's deckhouse.
//   hold      inside a hold: loose ice melting (1806), then blocks packed tight and buried in sawdust (1833).
//   prison    a debtors' cell.         pond   a Boston pond in winter, scored and cut.
//   study     a Boston desk: the Gazette's "slippery speculation", and an antique globe with the two routes.
// Everything is a pure function of t. The brig's position, the sea and the camera are continuous across the loop:
// the last shot (the glass) pulls back along the hook's own camera path into frame 0.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { track, ramp, ease, clamp01, lerp, toScreen } from '/scenes/web/runtime.js';
import { mulberry, DEG } from '/scenes/3d/lib/common.js';
import { buildSky, buildOcean, waveAt, skyUniforms } from '/scenes/3d/lib/ocean.js';
import { buildShip, deckAt, halfBeam, SHIP } from '/scenes/3d/lib/ship.js';
import { buildPeople, dressFor, stand, laugh, amazed, walkPose } from '/scenes/3d/lib/figures.js';
import { buildHarbour } from '/scenes/3d/lib/harbour.js';
import { iceBlocks, puddles, iceMaterial } from '/scenes/3d/lib/ice.js';
import { buildHold, buildPrison, buildPond, buildStudy, buildGlass } from '/scenes/3d/lib/rooms.js';
import { buildGlobe, PLACES, ROUTE_INDIA, ROUTE_MART } from '/scenes/3d/lib/globe.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export async function setup({ renderer, data, overlay: ov, W, H: HH }) {
  const A = data.anchors, P = data.palette, D = data.duration;
  const CUTS = data.shots.cuts;
  const Q = new URLSearchParams(location.search);
  const SS = Number(Q.get('ss') || 1.5);
  const col = (h) => new THREE.Color(h);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, W / HH, 0.1, 12000);
  scene.add(camera);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const shotAt = (t) => { let s = CUTS[0]; for (const c of CUTS) if (t >= c[1]) s = c; return s; };
  const startOf = (name) => CUTS.find((c) => c[0] === name)[1];
  const endOf = (name) => { const i = CUTS.findIndex((c) => c[0] === name); return i + 1 < CUTS.length ? CUTS[i + 1][1] : D; };

  // ================================================================== looks (sky + sea + sun) per place
  const LOOK = {
    mart: { top: '#2F6DB5', mid: '#9CC6E6', low: '#F6D9AA', haze: '#EFD8B4', sun: '#FFD7A2', sunDir: V3(-0.72, 0.36, 0.58).normalize(),
      deep: '#0B4A63', shallow: '#2CC0B6', amp: 0.8, cloud: 1.0, fogDist: 2600, sunI: 2.9, hemi: ['#AFCBE8', '#A88A64', 0.55], exposure: 1.0 },
    atl: { top: '#1F4F93', mid: '#87AED6', low: '#E7D7C0', haze: '#C9D4DE', sun: '#FFE6C4', sunDir: V3(0.35, 0.42, -0.84).normalize(),
      deep: '#08304A', shallow: '#1F7A94', amp: 1.45, cloud: 1.3, fogDist: 2200, sunI: 2.8, hemi: ['#9DB8DA', '#36506A', 0.6], exposure: 1.0 },
    cal: { top: '#6D86A8', mid: '#E2C9A0', low: '#F4C27E', haze: '#E9C79A', sun: '#FFC27A', sunDir: V3(-0.62, 0.2, -0.75).normalize(),
      deep: '#4A4A34', shallow: '#7A7050', amp: 0.28, cloud: 0.5, fogDist: 1200, sunI: 2.7, hemi: ['#D9C6A8', '#7A6040', 0.6], exposure: 1.0, murk: 1, sunSize: 3 },
  };
  const envOf = {};
  for (const [k, L] of Object.entries(LOOK)) {
    const s = new THREE.Scene(); const sky = buildSky(L); sky.onBeforeRender = () => {}; s.add(sky);
    envOf[k] = pmrem.fromScene(s, 0.02, 0.1, 10000).texture;
  }

  // ================================================================== sets
  const SETS = { sea: new THREE.Group(), hold: new THREE.Group(), prison: new THREE.Group(), pond: new THREE.Group(), study: new THREE.Group() };
  for (const g of Object.values(SETS)) scene.add(g);
  // the interiors sit below the sea (only one set is ever visible), close to the origin so that the shaders'
  // noise keeps its float precision
  SETS.hold.position.set(0, -1000, 0);
  SETS.prison.position.set(100, -1000, 0);
  SETS.pond.position.set(0, -2000, 0);
  SETS.study.position.set(200, -1000, 0);

  // ---------------------------------------------------------------- the sea set
  const sky = buildSky(LOOK.mart); SETS.sea.add(sky);
  const harbM = buildHarbour(P, 'martinique', 3); const HM = V3(650, 0, 0); harbM.group.position.copy(HM); SETS.sea.add(harbM.group);
  const harbC = buildHarbour(P, 'calcutta', 8); const HC = V3(0, 0, 5500); harbC.group.position.copy(HC); SETS.sea.add(harbC.group);
  const ocean = buildOcean({ ...LOOK.mart, land: { tex: harbM.landTex, x0: HM.x + 60, z0: HM.z, size: 2400 } }); SETS.sea.add(ocean);
  const OU = ocean.material.uniforms, SU = sky.material.uniforms;
  const sun = new THREE.DirectionalLight(col('#FFD7A2'), 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; SETS.sea.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(col('#AFCBE8'), col('#C9A774'), 1.0); SETS.sea.add(hemi);
  const brig = buildShip(P, { masts: 2, name: '', seed: 3 }); SETS.sea.add(brig.group);
  const tusc = buildShip(P, { masts: 3, name: 'TUSCANY', seed: 7 }); SETS.sea.add(tusc.group);
  // the pier's ice (Martinique), the race (big block vs small pieces), the Calcutta cargo and the crown
  const dockIce = iceBlocks(40); SETS.sea.add(dockIce.mesh);
  const dockPud = puddles(40); SETS.sea.add(dockPud.mesh);
  const crownMat = iceMaterial({ glow: 0.6 });
  const crown = new THREE.Group();
  {
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3 + 0.12 * (k % 2), 6), crownMat.clone());
      spike.position.set(Math.cos(a) * 0.2, 0.15, Math.sin(a) * 0.2); crown.add(spike);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 8, 36), crownMat.clone()); ring.rotation.x = Math.PI / 2; crown.add(ring);
    const cm = new THREE.MeshPhysicalMaterial({ color: col('#9FDDF5'), emissive: col('#4FC8FF'), emissiveIntensity: 0.9, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.88, envMapIntensity: 2.0 });
    crown.traverse((o) => { if (o.isMesh) { o.material = cm; } });
    SETS.sea.add(crown);
  }
  // the Calcutta ice house (a drum with pilasters and a dome), built in time-lapse
  const iceHouse = new THREE.Group();
  {
    const white = new THREE.MeshStandardMaterial({ color: col('#F2EDE2'), roughness: 0.8 });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 9, 40), white); drum.position.y = 4.5; iceHouse.add(drum);
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 8.6, 10), white); c.position.set(Math.cos(a) * 9.3, 4.3, Math.sin(a) * 9.3); iceHouse.add(c); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(9.4, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), white); dome.position.y = 9; dome.scale.y = 0.62; iceHouse.add(dome);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 2.6), new THREE.MeshStandardMaterial({ color: '#3A2A1A', roughness: 0.7 })); door.position.set(-8.95, 2, 0); iceHouse.add(door);
    iceHouse.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    iceHouse.position.copy(HC).add(V3(24, 2.8, -22));
    SETS.sea.add(iceHouse);
  }
  const glass = buildGlass(P); brig.body.add(glass.group);
  const GLASS_AT = V3(-6.2, deckAt(-6.2) + 1.05, halfBeam(-6.2) * 0.93);
  glass.group.position.copy(GLASS_AT);

  // ---------------------------------------------------------------- people
  const N_ISL = 16, N_SAIL = 4, N_CAL = 34, N_CUT = 4;
  const N = 1 + N_ISL + N_SAIL + N_CAL + N_CUT;
  const IDX = { tudor: 0, isl: 1, sail: 1 + N_ISL, cal: 1 + N_ISL + N_SAIL, cut: 1 + N_ISL + N_SAIL + N_CAL };
  const ppl = buildPeople(N, 11);
  scene.add(ppl.group);
  const rp = mulberry(21);
  ppl.dress(0, dressFor('tudor', rp));
  for (let i = 0; i < N_ISL; i++) ppl.dress(IDX.isl + i, dressFor('islander', rp));
  for (let i = 0; i < N_SAIL; i++) ppl.dress(IDX.sail + i, dressFor('sailor', rp));
  for (let i = 0; i < N_CAL; i++) ppl.dress(IDX.cal + i, dressFor('calcutta', rp));
  for (let i = 0; i < N_CUT; i++) ppl.dress(IDX.cut + i, dressFor('cutter', rp));
  const jit = Array.from({ length: N }, () => ({ a: rp(), b: rp(), c: rp(), sc: 0.95 + 0.1 * rp() }));

  // ---------------------------------------------------------------- the small sets
  const hold = buildHold(P); SETS.hold.add(hold.group);
  const prison = buildPrison(P); SETS.prison.add(prison.group);
  const pond = buildPond(P); SETS.pond.add(pond.group);
  const study = buildStudy(P); SETS.study.add(study.group);
  const globe = buildGlobe(); SETS.study.add(globe.group);
  globe.group.position.set(1.15, 1.02, -0.35);
  const studyFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: '#2A1C12', roughness: 0.7 }));
  studyFloor.rotation.x = -Math.PI / 2; SETS.study.add(studyFloor);
  const rMart = globe.route('mart', ROUTE_MART, '#7A3A1E', 0.005);
  const rIndia = globe.route('india', ROUTE_INDIA, '#B3261E', 0.0062);
  globe.pinAt(...PLACES.boston); globe.pinAt(...PLACES.martinique); globe.pinAt(...PLACES.calcutta);
  const snowSky = new THREE.Color('#C9D2DC');

  // ================================================================== the brig's track (the hook and the glass)
  const VB = 3.0;                                          // m/s
  const tau = (t) => (t < D * 0.5 ? t : t - D);            // continuous over the loop
  const brigX = (t) => VB * tau(t);
  const shipFrame = (t) => V3(brigX(t), 0, 0);
  // the hook camera, in the brig's frame (translation only): keys [tau, pos, target]
  const HOOK = [
    [-3.4, V3(-9, 6.5, 9), V3(-5, 3.6, 2.4)],
    [-1.6, V3(-21, 12, 15), V3(-3, 4, 0)],
    [0.0, V3(-27, 17, 21), V3(-1, 5, 0)],
    [2.6, V3(-24, 15.5, 18.5), V3(0, 4, 0)],
    [4.4, V3(-12, 11, 9.5), V3(1, 1.5, -0.5)],
    [5.6, V3(-9, 15, 13), V3(60, 12, 10)],
    [7.0, V3(-6, 18, 14), V3(600, 60, 150)],
  ];
  const hookPos = new THREE.CatmullRomCurve3(HOOK.map((k) => k[1]), false, 'centripetal');
  const hookTgt = new THREE.CatmullRomCurve3(HOOK.map((k) => k[2]), false, 'centripetal');
  function hookCam(ta) {
    const ks = HOOK.map((k) => k[0]);
    let i = 0; while (i < ks.length - 2 && ta > ks[i + 1]) i++;
    const u = clamp01((ta - ks[i]) / (ks[i + 1] - ks[i]));
    const uu = (i + ease.inOut(u) * 0.0 + u) / (ks.length - 1);
    return { pos: hookPos.getPoint(Math.min(1, Math.max(0, uu))), tgt: hookTgt.getPoint(Math.min(1, Math.max(0, uu))), fov: 38 };
  }

  // ================================================================== cameras per shot
  const pier = (x, y, z) => V3(HM.x + x, y, HM.z + z);
  const cal = (x, y, z) => V3(HC.x + x, y, HC.z + z);
  const PIER_Y = harbM.pier.y + 0.12;
  const FAV_AT = pier(-30, 0, -5.9);                       // the Favorite moored at the pier
  const TUS_AT = cal(-34, 0, -6.4);                        // the Tuscany at the Calcutta ghat
  const ATL = V3(-4200, 0, -2600);                         // the open Atlantic
  function cameraFor(name, t) {
    const s0 = startOf(name), s1 = endOf(name), u = clamp01((t - s0) / (s1 - s0));
    const L = (a, b, k = u) => a.clone().lerp(b, ease.inOut(k));
    switch (name) {
      case 'hook': { const c = hookCam(tau(t)); const f = shipFrame(t); return { pos: c.pos.add(f), tgt: c.tgt.add(f), fov: c.fov }; }
      case 'laugh': return { pos: L(pier(-39.5, PIER_Y + 1.9, 1.5), pier(-39.0, PIER_Y + 1.7, 1.7)), tgt: L(pier(-31.5, PIER_Y + 1.15, -0.2), pier(-31.5, PIER_Y + 1.2, -0.2)), fov: 40 };
      case 'tudor': return { pos: L(pier(-31.2, PIER_Y + 1.62, -1.6), pier(-31.0, PIER_Y + 1.6, -1.45)), tgt: L(pier(-33.4, PIER_Y + 1.5, -0.7), pier(-33.4, PIER_Y + 1.52, -0.7)), fov: 32 };
      case 'paper': {
        const a = SETS.study.localToWorld(V3(-0.42, 1.25, 0.55)), b = SETS.study.localToWorld(V3(-0.2, 1.08, 0.38));
        const ta = SETS.study.localToWorld(V3(-0.32, 0.8, 0.12)), tb = SETS.study.localToWorld(V3(-0.2, 0.8, 0.1));
        return { pos: L(a, b), tgt: L(ta, tb), fov: 34 };
      }
      case 'holdMelt': { const g = SETS.hold.position; return { pos: L(V3(4.4, 2.2, 1.6).add(g), V3(3.8, 1.9, 1.5).add(g)), tgt: L(V3(-0.6, 0.4, -0.6).add(g), V3(-0.7, 0.35, -0.6).add(g)), fov: 44 }; }
      case 'dockMelt': return { pos: L(pier(-41.5, PIER_Y + 1.6, 2.8), pier(-40.5, PIER_Y + 4.6, 4.2)), tgt: L(pier(-34, PIER_Y + 0.3, 0), pier(-34, PIER_Y + 0.1, 0)), fov: 38 };
      case 'prison': { const g = SETS.prison.position; return { pos: L(V3(1.6, 1.55, 2.5).add(g), V3(1.25, 1.45, 2.1).add(g)), tgt: L(V3(-0.6, 1.05, -1.2).add(g), V3(-0.6, 1.15, -1.2).add(g)), fov: 42 }; }
      case 'race': return { pos: L(pier(-39.6, PIER_Y + 1.7, 0.05), pier(-39.9, PIER_Y + 1.85, 0.05)), tgt: L(pier(-36.1, PIER_Y + 0.3, 0.05), pier(-36.1, PIER_Y + 0.25, 0.05)), fov: 34 };
      case 'pond': { const g = SETS.pond.position; return { pos: L(V3(2.6, 3.0, 6.6).add(g), V3(2.1, 2.7, 6.0).add(g)), tgt: L(V3(0, 0.4, -4).add(g), V3(0, 0.45, -4).add(g)), fov: 44 }; }
      case 'pack': case 'voyage': case 'arrive': {
        const g = SETS.hold.position;
        if (name === 'pack') return { pos: L(V3(5.0, 2.7, 1.3).add(g), V3(4.6, 2.6, 1.2).add(g)), tgt: L(V3(-0.6, 0.3, -0.6).add(g), V3(-0.6, 0.4, -0.6).add(g)), fov: 46 };
        if (name === 'voyage') return { pos: L(V3(3.6, 2.6, 1.6).add(g), V3(3.2, 2.5, 1.5).add(g)), tgt: L(V3(-0.6, 0.7, -0.6).add(g), V3(-0.8, 0.7, -0.6).add(g)), fov: 46 };
        return { pos: L(V3(4.8, 2.0, 1.4).add(g), V3(4.4, 2.5, 1.3).add(g)), tgt: L(V3(-0.5, 0.5, -0.5).add(g), V3(-0.4, 1.0, -0.5).add(g)), fov: 46 };
      }
      case 'tuscany': {
        const f = tuscPos(t);
        const a = V3(46, 12, 52), b = V3(18, 8, 40), c = V3(9.5, 3.4, 12.5);
        const pos = u < 0.72 ? a.clone().lerp(b, ease.inOut(u / 0.72)) : b.clone().lerp(c, ease.inOut((u - 0.72) / 0.28));
        const tg = u < 0.72 ? V3(-2, 10, 0) : V3(-2, 10, 0).lerp(V3(7.4, 2.5, 3.3), ease.inOut((u - 0.72) / 0.28));
        return { pos: pos.add(f), tgt: tg.add(f), fov: 38 };
      }
      case 'globe1': case 'globe2': {
        const c = globe.group.getWorldPosition(V3(0, 0, 0));
        const d = name === 'globe1' ? lerp(3.0, 2.7, ease.inOut(u)) : lerp(2.7, 2.55, ease.inOut(u));
        return { pos: c.clone().add(V3(0.35, 0.3, d)), tgt: c.clone().add(V3(0, -0.02, 0)), fov: 30 };
      }
      case 'calcutta': return { pos: L(cal(-8, 7.5, 21), cal(9, 4.8, 17)), tgt: L(cal(14, 3.8, 9), cal(20, 3.6, 10)), fov: 40 };
      case 'house': return { pos: L(cal(-16, 6, 22), cal(-18, 7, 24)), tgt: L(cal(22, 6, -18), cal(23, 8, -20)), fov: 42 };
      case 'crown': return { pos: L(cal(22.3, 4.25, 11.8), cal(22.0, 4.2, 11.6)), tgt: L(cal(20, 3.85, 10.6), cal(20, 3.9, 10.6)), fov: 32 };
      case 'glass': {
        // from the glass on the deckhouse back out along the hook's own path (tau = t - D) into frame 0
        const f = shipFrame(t);
        const g = brig.body.localToWorld(GLASS_AT.clone().add(V3(0, 0.07, 0)));
        const close = { pos: g.clone().add(V3(0.26, 0.1, 0.3)), tgt: g.clone().add(V3(0, -0.005, 0)) };
        const hc = hookCam(tau(t)); hc.pos.add(f); hc.tgt.add(f);
        const k = ramp(t, A.trip - 0.9, D - 2.0, ease.inOut);
        const wide = ramp(t, A.glass + 0.3, A.trip - 0.6, ease.inOut);
        const mid = { pos: g.clone().add(V3(-0.8, 1.2, 2.6)), tgt: g.clone().add(V3(0.1, -0.1, -0.3)) };
        const a = close.pos.clone().lerp(mid.pos, wide), at = close.tgt.clone().lerp(mid.tgt, wide);
        return { pos: a.lerp(hc.pos, k), tgt: at.lerp(hc.tgt, k), fov: lerp(30, 38, k) };
      }
    }
    return { pos: V3(0, 10, 30), tgt: V3(0, 0, 0), fov: 40 };
  }
  const tuscPos = (t) => ATL.clone().add(V3(3.4 * (t - 46), 0, 0));
  const setOf = { hook: 'sea', laugh: 'sea', globe1: 'study', tudor: 'sea', paper: 'study', holdMelt: 'hold', dockMelt: 'sea', prison: 'prison',
    race: 'sea', pond: 'pond', pack: 'hold', tuscany: 'sea', voyage: 'hold', globe2: 'study', arrive: 'hold', calcutta: 'sea', house: 'sea', crown: 'sea', glass: 'sea' };
  const lookOf = (name) => (name === 'tuscany' ? 'atl' : ['calcutta', 'house', 'crown'].includes(name) ? 'cal' : 'mart');

  // ================================================================== overlays
  const el = {
    scrim: ov.el('', ''),
    y1806: ov.el('1806', 't big'),
    pond: ov.el('ICE FROM A BOSTON POND', 't label'),
    mart: ov.el('→ MARTINIQUE', 't small'),
    later: ov.el('30 YEARS LATER', 't mid'),
    toIndia: ov.el('BOSTON → INDIA', 't small'),
    lBoston: ov.el('BOSTON', 't label'), lMart: ov.el('MARTINIQUE · 1806', 't label'), lCal: ov.el('CALCUTTA · 1833', 't label'),
    name: ov.el('FREDERIC TUDOR', 't mid'),
    nameLab: ov.el('ICE MERCHANT · BOSTON · 1783–1864', 't label'),
    gazette: ov.el('BOSTON GAZETTE · 1806', 't label'),
    meltWay: ov.el('MELTING ON THE WAY', 't small acc'),
    noHouse: ov.el('NOWHERE TO STORE IT', 't small acc'),
    loss: ov.el('−$4,500', 't big acc'),
    lossLab: ov.el('LOST ON THE FIRST TRIP', 't label'),
    prison: ov.el("DEBTORS' PRISON", 't mid acc'),
    prisonLab: ov.el('1812 – 1813', 't label'),
    same: ov.el('THE SAME AMOUNT OF ICE', 't label'),
    bigL: ov.el('ONE BIG BLOCK', 't small'), smallL: ov.el('SMALL PIECES', 't small'),
    slower: ov.el('BIG MELTS SLOWER', 't mid'),
    square: ov.el('CUT SQUARE', 't mid'),
    packed: ov.el('PACKED TIGHT', 't mid'),
    sawdust: ov.el('IN SAWDUST', 't mid'),
    free: ov.el('FREE FROM THE SAWMILLS', 't label'),
    y1833: ov.el('1833', 't big'),
    tons: ov.el('180 TONS', 't mid'),
    tonsLab: ov.el('OF POND ICE', 't label'),
    tusc: ov.el('THE TUSCANY', 't label'),
    days: ov.el('DAY 1', 't mid'),
    daysLab: ov.el('4 MONTHS AT SEA', 't label'),
    eq: ov.el('EQUATOR', 't small'),
    left: ov.el('100 TONS', 't big'),
    leftLab: ov.el('STILL FROZEN', 't label'),
    calLab: ov.el('CALCUTTA · 1833', 't label'),
    house: ov.el('AN ICE HOUSE', 't mid'),
    houseLab: ov.el('PAID FOR BY THE TOWN', 't label'),
    king: ov.el('THE ICE KING', 't mid'),
  };
  el.slower.style.color = P.good; el.left.style.color = P.good; el.leftLab.style.color = P.good; el.king.style.color = P.cool;
  el.square.style.color = P.cool; el.packed.style.color = P.cool; el.sawdust.style.color = '#E8C27E'; el.tons.style.color = P.cool;
  Object.assign(el.scrim.style, { width: '1080px', height: '780px', background: 'linear-gradient(rgba(4,8,12,0.55), rgba(4,8,12,0.32) 52%, rgba(4,8,12,0))' });
  el.scrim.parentNode.insertBefore(el.scrim, el.scrim.parentNode.firstChild);
  const leaders = { pond: ov.line(P.ink, 4), big: ov.line(P.ink, 4), small: ov.line(P.ink, 4), under: ov.line(P.accent, 9) };
  const setLine = (ln, pts, op = 1) => { ln.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')); ln.style.opacity = op; };
  const fadeIn = (t, a, b = a + 0.3) => ramp(t, a, b, ease.out);
  const fadeWin = (t, a, b, f = 0.28) => Math.max(0, Math.min(fadeIn(t, a, a + f), 1 - ramp(t, b - f, b, ease.inOut)));
  const popScale = (t, a) => 1 + 0.22 * Math.exp(-Math.max(0, t - a) * 10) * (t > a ? 1 : 0);
  const place = (e, x, y, o, pop = null) => { ov.place(e, x, y, { anchor: 'c', opacity: o }); if (pop && o > 0) e.style.transform += ` scale(${pop.toFixed(3)})`; };
  const hideLine = (ln) => setLine(ln, [{ x: 0, y: 0 }], 0);

  // ================================================================== update
  let lookName = 'mart';
  function applyLook(k) {
    const L = LOOK[k];
    lookName = k;
    for (const U of [OU, SU]) {
      U.uTop.value.set(L.top); U.uMid.value.set(L.mid); U.uLow.value.set(L.low); U.uHaze.value.set(L.haze); U.uSunCol.value.set(L.sun);
      U.uSunDir.value.copy(L.sunDir); U.uCloud.value = L.cloud; U.uSunSize.value = L.sunSize ?? 1;
    }
    OU.uDeep.value.set(L.deep); OU.uShallow.value.set(L.shallow); OU.uAmp.value = L.amp; OU.uFogCol.value.set(L.haze); OU.uFogDist.value = L.fogDist; OU.uMurk.value = L.murk ?? 0;
    const land = k === 'cal' ? { tex: harbC.landTex, x0: HC.x + 60, z0: HC.z } : k === 'mart' ? { tex: harbM.landTex, x0: HM.x + 60, z0: HM.z } : null;
    if (land) { OU.uLand.value = land.tex; OU.uLandBox.value.set(land.x0, land.z0, 2400, 1); } else OU.uLandBox.value.w = 0;
    sun.color.set(L.sun); sun.intensity = L.sunI;
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    scene.fog = new THREE.Fog(col(L.haze), L.fogDist * 0.35, L.fogDist * 1.4);
    scene.environment = envOf[k];
  }
  function aimSun(focus, ext) {
    const L = LOOK[lookName];
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: ext * 8 + 300 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(L.sunDir, ext * 4 + 100);
  }

  let curShot = null;
  function update(t, opt = {}) {
    const ft = opt.frameT ?? t;
    const shot = shotAt(ft)[0];
    curShot = shot;
    const setName = setOf[shot];
    for (const [k, g] of Object.entries(SETS)) g.visible = k === setName;
    scene.fog = null; scene.background = null; scene.environment = roomEnv;
    if (setName === 'sea') applyLook(lookOf(shot));
    if (setName === 'pond') { scene.background = snowSky; scene.fog = new THREE.Fog(snowSky, 60, 420); scene.environment = envOf.atl; }
    if (setName === 'hold' || setName === 'prison' || setName === 'study') scene.background = col('#07080A');
    scene.environmentIntensity = { sea: 1, hold: 0.35, prison: 0.12, study: 0.35, pond: 0.35 }[setName];
    ppl.begin();
    if (setName === 'sea') updateSea(t, shot);
    if (setName === 'hold') updateHold(t, shot);
    if (setName === 'prison') updatePrison(t);
    if (setName === 'pond') updatePond(t);
    if (setName === 'study') updateStudy(t, shot);
    ppl.commit();
    scene.updateMatrixWorld(true);

    const cam = cameraFor(shot, t);
    camera.position.copy(cam.pos); camera.fov = cam.fov;
    camera.near = setName === 'sea' ? (shot === 'glass' || shot === 'race' ? 0.03 : 0.2) : 0.02;
    camera.far = setName === 'sea' ? 12000 : 600;
    camera.updateProjectionMatrix();
    camera.lookAt(cam.tgt);
    camera.updateMatrixWorld();

    if (Q.has('cover')) {
      const c = hookCam(0.4); const f = shipFrame(0.4);
      camera.position.copy(c.pos.add(f)); camera.lookAt(c.tgt.add(f)); camera.updateMatrixWorld();
      return;
    }
    if (opt.sub) return;
    overlays(t, shot);
  }

  // ---------------------------------------------------------------- sea
  function updateSea(t, shot) {
    const tw = tau(t);                                         // wave time: continuous over the loop
    OU.uT.value = tw; SU.uTime.value = tw;
    harbM.palms.userData.mat.userData && 0;
    // the brig: sailing in the hook and the glass; moored at Saint-Pierre otherwise
    const sailing = shot === 'hook' || shot === 'glass';
    brig.group.visible = sailing || ['laugh', 'tudor', 'dockMelt', 'race'].includes(shot);
    if (sailing) {
      brig.group.updateMatrixWorld(true);
      brig.rideOn(waveAt, brigX(t), 0, 0, tw, LOOK.mart.amp);
      brig.set(tw, { wind: 1 });
      OU.uShip.value.set(brigX(t), 0, 0, VB);
    } else {
      brig.rideOn(waveAt, FAV_AT.x, FAV_AT.z, 0, tw, LOOK.mart.amp * 0.25);
      brig.set(tw, { wind: 0.35, furl: true });
      OU.uShip.value.set(FAV_AT.x, FAV_AT.z, 0, 0);
    }
    brig.group.userData.setHold(shot === 'glass' || shot === 'hook' ? 0.02 : 0.3, 1);
    // the Tuscany: under way on the Atlantic, moored at Calcutta
    tusc.group.visible = ['tuscany', 'calcutta', 'house'].includes(shot);
    if (shot === 'tuscany') {
      const p = tuscPos(t);
      tusc.rideOn(waveAt, p.x, p.z, 0, tw, LOOK.atl.amp); tusc.set(tw, { wind: 1.1 });
      OU.uShip.value.set(p.x, p.z, 0, 3.4);
      tusc.group.userData.setHold(0, 1);
    } else if (tusc.group.visible) {
      tusc.rideOn(waveAt, TUS_AT.x, TUS_AT.z, 0, tw, LOOK.cal.amp * 0.3); tusc.set(tw, { wind: 0.25, furl: true });
      OU.uShip.value.set(TUS_AT.x, TUS_AT.z, 0, 0);
      tusc.group.userData.setHold(0.45, 0.6);
    }
    OU.uShip2.value.set(0, 0, 0, -1);
    brig.group.updateMatrixWorld(true);
    if (shot === 'glass') glass.set(t, A.clink - 0.28); else glass.set(t, -100);
    glass.group.visible = shot === 'glass' || shot === 'hook';

    // ---- the pier at Saint-Pierre: ice, Tudor, the crowd
    let focus = shipFrame(t).add(V3(0, 4, 0)), ext = 24;
    dockIce.mesh.visible = ['laugh', 'tudor', 'dockMelt', 'race', 'calcutta', 'house', 'crown'].includes(shot);
    dockPud.mesh.visible = dockIce.mesh.visible;
    crown.visible = shot === 'crown';
    iceHouse.visible = ['calcutta', 'house', 'crown'].includes(shot);
    const rB = mulberry(5);
    if (['laugh', 'tudor', 'dockMelt'].includes(shot)) {
      focus = pier(-34, PIER_Y, 0); ext = 14;
      // eight blocks stacked near the pier end; in dockMelt they melt to puddles (time-lapse)
      const melt = shot === 'dockMelt' ? ramp(t, A.martinique - 0.1, A.cold + 0.4, ease.inOut) * 1.0 + ramp(t, A.cold + 0.4, A.lost + 1.6) * 0.6 : shot === 'tudor' ? 0.12 : 0.05;
      for (let k = 0; k < 40; k++) {
        if (k >= 8) { dockIce.set(k, { hide: true }); dockPud.set(k, 0, 0, 0, 0, 0); continue; }
        const x = -33 + (k % 4) * 0.62 + (rB() - 0.5) * 0.08, z = 0.0 + Math.floor(k / 4) * 0.66 + (rB() - 0.5) * 0.1;
        const mk = Math.min(1.25, melt * (0.85 + 0.3 * rB()));
        const gone = mk >= 1.2;
        dockIce.set(k, { x: pier(x, 0, z).x, y: PIER_Y, z: pier(x, 0, z).z, yaw: (rB() - 0.5) * 0.1, sx: 0.28, sy: 0.27, sz: 0.28, round: 0.06, melt: Math.min(1, mk), hide: gone });
        const pr = 0.25 + 0.55 * Math.min(1, mk) - (mk > 1 ? (mk - 1) * 2.0 : 0);
        dockPud.set(k, pier(x, 0, z).x, PIER_Y + 0.003, pier(x, 0, z).z, pr, pr * 0.85, k);
      }
      // Tudor beside his ice
      const tSad = shot === 'dockMelt' ? ramp(t, A.lost - 0.3, A.thousands + 0.5) : 0;
      ppl.set(IDX.tudor, { x: pier(-33.6, 0, -0.75).x, y: PIER_Y, z: pier(0, 0, -0.75).z, yaw: shot === 'tudor' ? -0.35 : 0.15, ...stand(0),
        headTilt: 0.05 + 0.45 * tSad, lean: 0.03 + 0.08 * tSad, arms: shot === 'laugh' ? [0.3, 0.9, 0.9, 1.3, 0.1, 0.25] : [0.1, 0.15, 0.1, 0.15, 0.06, 0.06] });
      // the crowd (laughing in 'laugh', drifting away in dockMelt)
      const leave = shot === 'dockMelt' ? ramp(t, A.martinique, A.cold + 0.6) : 0;
      for (let i = 0; i < N_ISL; i++) {
        const j = jit[IDX.isl + i];
        const a = -1.25 + (i / (N_ISL - 1)) * 2.5 + (j.a - 0.5) * 0.15, r = 2.4 + j.b * 2.6 + leave * 14 + (shot === 'tudor' ? 1.5 : 0);
        const x = -32.0 + Math.cos(a) * r, z = Math.sin(a) * r * 0.6;
        const zz = Math.max(-1.85, Math.min(1.85, z));
        const xx = x + Math.abs(z - zz) * 0.8;
        const face = Math.atan2((zz + 0.6), -(xx + 33.2));
        const pose = shot === 'laugh' ? laugh(t, i, ramp(t, A.laughed - 0.1, A.laughed + 0.3)) : shot === 'tudor' ? laugh(t * 0.6, i, 0.35) : leave > 0.05 ? walkPose(t * 7 + i, 1) : stand(i);
        ppl.set(IDX.isl + i, { x: pier(xx, 0, 0).x, y: PIER_Y, z: pier(0, 0, zz).z, yaw: leave > 0.05 ? face + Math.PI : face, scale: j.sc, ...pose, fade: leave > 0.85 ? 1 : 0 });
      }
      for (let i = 0; i < N_SAIL; i++) {
        const j = jit[IDX.sail + i];
        ppl.set(IDX.sail + i, { x: FAV_AT.x - 6 + i * 3.5, y: deckAt(-6 + i * 3.5) + brig.group.position.y + 0.06, z: FAV_AT.z + (j.a - 0.5) * 3, yaw: Math.PI / 2 + (j.b - 0.5), scale: j.sc,
          ...(shot === 'laugh' ? laugh(t, i + 5, 0.8) : stand(i)) });
      }
    } else if (shot === 'race') {
      focus = pier(-36, PIER_Y, 0); ext = 6;
      // one big block vs 27 small pieces (the same ice); each shrinks at the same rate from its faces
      const u = ramp(t, A.melts - 0.2, A.small_e + 0.4, ease.linear);
      const sB = Math.max(0, 0.6 - 0.2 * u), sS = Math.max(0, 0.2 - 0.2 * u);
      dockIce.set(0, { x: pier(-36.35, 0, 0).x, y: PIER_Y, z: pier(0, 0, -0.38).z, yaw: 0.25, sx: sB / 2, sy: sB / 2, sz: sB / 2, round: 0.05 + 0.15 * u, melt: 0.15 * u });
      dockPud.set(0, pier(-36.35, 0, 0).x, PIER_Y + 0.003, pier(0, 0, -0.38).z, 0.36 + 0.12 * u, 0.33 + 0.1 * u, 0.3);
      let k = 1;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let l = 0; l < 3; l++) {
        const h = sS / 2, sp = sS + 0.025, cx = -35.6 + (i - 1) * sp + Math.sin(k * 3.7) * 0.015, cz = 0.42 + (j - 1) * sp + Math.cos(k * 2.3) * 0.015;
        const settle = (0.2 - sS) * l;            // upper pieces sink as the lower ones melt
        dockIce.set(k, { x: pier(cx, 0, 0).x, y: PIER_Y + l * 0.205 - settle, z: pier(0, 0, cz).z, yaw: Math.sin(k) * 0.3, sx: h, sy: h, sz: h, round: 0.12 + 0.2 * u, melt: 0.3 * u, hide: sS < 0.005 });
        k++;
      }
      dockPud.set(1, pier(-35.5, 0, 0.4).x, PIER_Y + 0.003, pier(0, 0, 0.4).z, 0.38 + 0.25 * u, 0.36 + 0.22 * u, 1.1);
      for (; k < 40; k++) { dockIce.set(k, { hide: true }); dockPud.set(k, 0, 0, 0, 0, 0); }
      ppl.set(IDX.tudor, { hide: true, fade: 1, x: 0, z: 0 });
    } else if (['calcutta', 'house', 'crown'].includes(shot)) {
      focus = cal(18, 3, 4); ext = shot === 'house' ? 40 : 22;
      if (shot === 'crown') { for (let i = 0; i < N_CAL; i++) ppl.set(IDX.cal + i, { x: 0, z: 0, fade: 1 }); }
      // the unloaded blocks on the ghat steps, sweating in the heat; the crowd around them
      for (let k = 0; k < 40; k++) {
        if (k >= 10) { dockIce.set(k, { hide: true }); dockPud.set(k, 0, 0, 0, 0, 0); continue; }
        const x = 18.8 + (k % 5) * 0.64, z = 9.0 + Math.floor(k / 5) * 0.68;
        const y = harbC.height(x, z) + 0.02;
        dockIce.set(k, { x: cal(x, 0, 0).x, y: Math.max(2.82, y), z: cal(0, 0, z).z, yaw: (rB() - 0.5) * 0.12, sx: 0.29, sy: 0.28, sz: 0.29, round: 0.08, melt: 0.35 });
        dockPud.set(k, cal(x, 0, 0).x, Math.max(2.82, y) + 0.004, cal(0, 0, z).z, 0.38, 0.34, k);
      }
      if (shot === 'crown') {
        // the last block, a crown of frost growing on top
        for (let k = 0; k < 10; k++) { dockIce.set(k, { hide: true }); dockPud.set(k, 0, 0, 0, 0, 0); }
        dockIce.set(10, { x: cal(20, 0, 0).x, y: 2.82, z: cal(0, 0, 10.6).z, yaw: 0.3, sx: 0.4, sy: 0.4, sz: 0.4, round: 0.07, melt: 0.1 });
        const g = ramp(t, A.known - 0.3, A.iceking + 0.15, ease.out);
        crown.position.copy(cal(20, 3.62 + 0.04 * Math.sin(t * 2), 10.6)); crown.rotation.y = t * 0.4; crown.scale.setScalar(0.001 + g * 1.0);
      }
      const amz = ramp(t, A.amazed - 0.2, A.amazed + 0.4);
      for (let i = 0; i < N_CAL && shot !== 'crown'; i++) {
        const j = jit[IDX.cal + i];
        const a = (i / N_CAL) * Math.PI * 1.6 - 0.4 + (j.a - 0.5) * 0.15, r = 3.0 + j.b * 3.5;
        const x = 20.2 + Math.cos(a) * r, z = 9.7 + Math.sin(a) * r;
        const yaw = 0;
        const face = Math.atan2(z - 9.7, -(x - 20.2));
        void yaw;
        ppl.set(IDX.cal + i, { x: cal(x, 0, 0).x, y: Math.max(2.8, harbC.height(x, z)), z: cal(0, 0, z).z, yaw: face, scale: j.sc,
          ...(shot === 'calcutta' ? amazed(t, i, i % 3 === 0 ? 1 : amz) : amazed(t, i, 0.5 + 0.5 * (i % 2))) });
      }
      for (let i = 0; i < N_SAIL && shot !== 'crown'; i++) {
        const j = jit[IDX.sail + i];
        ppl.set(IDX.sail + i, { x: cal(15 - i * 1.1, 0, 0).x, y: 2.8, z: cal(0, 0, 8.2 + j.a).z, yaw: 0.2, scale: j.sc, ...walkPose(t * 6 + i, 0), arms: [1.2, 1.1, 1.2, 1.1, 0.2, 0.2], lean: 0.25 });
      }
      // the ice house rising (time-lapse) behind the crowd
      const b = shot === 'house' ? ramp(t, A.built - 0.1, A.forice_e + 0.3, ease.inOut) : shot === 'crown' ? 1 : 0;
      iceHouse.scale.set(1, Math.max(0.001, b), 1); iceHouse.visible = b > 0.002 || shot === 'calcutta' ? b > 0.002 : false;
    } else {
      for (let k = 0; k < 40; k++) { dockIce.set(k, { hide: true }); dockPud.set(k, 0, 0, 0, 0, 0); }
    }
    if (shot === 'tuscany') { focus = tuscPos(t).add(V3(0, 6, 0)); ext = 26; }
    dockIce.commit(); dockPud.commit();
    for (const p of [harbM.palms, harbC.palms]) p.userData.mat.userData = p.userData.mat.userData || {};
    aimSun(focus, ext);
  }

  // ---------------------------------------------------------------- hold
  function updateHold(t, shot) {
    const sway = 0.04 * Math.sin(t * 0.9) + 0.015 * Math.sin(t * 2.1);
    if (shot === 'holdMelt') {
      const m = ramp(t, startOf('holdMelt') - 0.3, endOf('holdMelt') + 0.3, ease.linear);
      hold.set({ t, melt: 0.2 + 0.75 * m, loose: 1, sawdust: 0, water: 0.3 + 0.7 * m, sway, open: 0 });
    } else if (shot === 'pack') {
      hold.set({ t, melt: 0, loose: 0, drop: ramp(t, A.packed - 0.25, A.tight_e + 0.1, ease.linear), sawdust: ramp(t, A.buried - 0.1, A.away + 0.3, ease.inOut) * 1.05,
        pour: fadeWin(t, A.buried - 0.3, A.away + 0.4, 0.2), water: 0, sway: sway * 0.3, open: 1 });
    } else if (shot === 'voyage') {
      const d = ramp(t, A.four - 0.2, A.atsea_e + 0.2, ease.linear);
      hold.set({ t, melt: 0.1 + 0.35 * d, loose: 0, sawdust: 0.85, water: 0.15 * d, sway: sway * 1.6, open: 0 });
    } else {
      hold.set({ t, melt: 0.45, loose: 0, sawdust: 0.8 - 0.2 * ramp(t, A.t100, A.stillf_e), water: 0.15, sway, open: ramp(t, A.stillf - 0.4, A.calcutta + 0.2, ease.inOut) });
    }
  }

  // ---------------------------------------------------------------- prison
  function updatePrison(t) {
    const g = SETS.prison.position;
    const look = ramp(t, A.still - 0.2, A.giveup_e + 0.1, ease.inOut);
    ppl.set(IDX.tudor, { x: g.x + prison.bench.x, y: g.y + prison.bench.y - 0.48 + 0.0, z: g.z + prison.bench.z + 0.08, yaw: -Math.PI / 2 + 0.35, sit: true,
      arms: [0.55 - 0.3 * look, 1.05 - 0.5 * look, 0.55 - 0.3 * look, 1.05 - 0.5 * look, 0.12, 0.12], lean: 0.42 - 0.38 * look, headTilt: 0.5 - 0.8 * look, headTurn: 0.25 * look, noHat: true });
    prison.beam.material.uniforms.uT.value = t;
    prison.dust.material.uniforms.uT.value = t;
    prison.sun.intensity = 120 * (1 + 0.6 * look);
  }

  // ---------------------------------------------------------------- pond
  function updatePond(t) {
    const g = SETS.pond.position;
    pond.set(t, { score: ramp(t, A.cut - 0.3, A.square_e, ease.inOut), lift: ramp(t, A.square - 0.1, A.packed, ease.inOut) });
    for (let i = 0; i < N_CUT; i++) {
      const j = jit[IDX.cut + i];
      const x = [-2.8, 2.6, -1.2, 3.6][i], z = [-2.6, -3.4, -5.2, -0.4][i];
      const saw = Math.sin(t * 7 + i * 1.3);
      ppl.set(IDX.cut + i, { x: g.x + x, y: g.y, z: g.z + z, yaw: [0.4, 2.6, 1.2, 3.0][i], scale: j.sc, lean: 0.5, arms: [1.0 + 0.25 * saw, 0.4, 1.1 + 0.25 * saw, 0.35, 0.15, 0.1], knee: 0.25, thigh: 0.2 });
    }
    pond.sun.target.position.set(g.x, 0, g.z); pond.sun.position.set(g.x + 40, 30, g.z - 60);
  }

  // ---------------------------------------------------------------- study: the Gazette and the globe
  function updateStudy(t, shot) {
    const fl = 1 + 0.06 * Math.sin(t * 11) + 0.04 * Math.sin(t * 23 + 1);
    study.candle.intensity = 2.2 * fl; study.flame.scale.set(1, 2.2 * fl, 1);
    globe.uniforms.uEq.value = 0;
    if (shot === 'globe1') {
      const u = ramp(t, A.later - 0.1, A.india0 + 0.1, ease.inOut);
      rMart.m.uniforms.uProg.value = 1; rMart.m.uniforms.uOp.value = 1 - 0.6 * ramp(t, A.later - 0.2, A.later + 0.4);
      rIndia.m.uniforms.uProg.value = u; rIndia.m.uniforms.uOp.value = 1;
      globe.setSpin(lerp(-55, 62, ramp(t, startOf('globe1') + 0.3, A.india0 + 0.4, ease.inOut)));
      globe.markerAt('india', u);
    } else if (shot === 'globe2') {
      // the voyage: the head reaches the first equator crossing on "equator", the second on "twice"
      const k1 = 4 / 17, k2 = 13 / 17;
      const u = t < A.equator ? lerp(0.08, k1, ramp(t, startOf('globe2'), A.equator + 0.05, ease.inOut))
        : t < A.twice ? lerp(k1, k2, ramp(t, A.equator + 0.05, A.twice + 0.05, ease.inOut)) : lerp(k2, 1, ramp(t, A.twice + 0.05, endOf('globe2') + 0.2, ease.inOut));
      rMart.m.uniforms.uOp.value = 0.25; rIndia.m.uniforms.uProg.value = u; rIndia.m.uniforms.uOp.value = 1;
      globe.markerAt('india', u);
      const lonAt = (uu) => { const n = ROUTE_INDIA.length - 1; const f = uu * n, i = Math.min(n - 1, Math.floor(f)); return lerp(ROUTE_INDIA[i][1], ROUTE_INDIA[i + 1][1], f - i); };
      globe.setSpin(lonAt(u) * 0.85 + 5);
      globe.tilt.rotation.x = 0.25 * Math.sin(u * Math.PI) ;
      globe.uniforms.uEq.value = Math.max(Math.exp(-Math.abs(t - A.equator - 0.05) * 6), Math.exp(-Math.abs(t - A.twice - 0.05) * 6));
    } else {
      rMart.m.uniforms.uProg.value = 0; rIndia.m.uniforms.uProg.value = 0;
    }
    if (shot !== 'globe2') globe.tilt.rotation.x = 0;
  }

  // ================================================================== overlays
  function overlays(t, name) {
    const topOn = Math.max(
      fadeWin(t, A.y1806 - 0.1, A.frozen - 0.1), fadeWin(t, A.but1 - 0.1, A.india0 + 0.4), fadeWin(t, A.name, A.newspaper - 0.4),
      fadeWin(t, A.martinique, A.worse - 0.35), fadeWin(t, A.prison - 0.2, A.secret - 0.1), fadeWin(t, A.slowly - 0.1, A.cut - 0.4, 0.2),
      fadeWin(t, A.square - 0.1, A.india - 0.1, 0.2), fadeWin(t, A.y1833 - 0.1, A.crossing - 0.25), fadeWin(t, A.t100 - 0.2, A.calcutta + 0.2, 0.2),
      fadeWin(t, A.house - 0.1, A.known - 0.6, 0.2), fadeWin(t, A.iceking - 0.3, A.end - 0.1, 0.2));
    ov.place(el.scrim, 0, 0, { anchor: 'tl', opacity: 0.85 * topOn });
    // hook
    place(el.y1806, 540, 380, fadeWin(t, A.y1806 - 0.1, A.frozen - 0.1), popScale(t, A.y1806 - 0.1));
    const pOn = name === 'hook' ? fadeWin(t, A.frozen - 0.1, A.tropical - 0.05, 0.2) : 0;
    if (pOn > 0) {
      const tip = toScreen(brig.body.localToWorld(V3(-1.2, deckAt(0) - 0.7, 0.4)), camera);
      setLine(leaders.pond, [{ x: tip.x, y: tip.y - 10 }, { x: tip.x + 30, y: 640 }], pOn);
      place(el.pond, Math.min(800, Math.max(300, tip.x + 30)), 600, pOn);
    } else hideLine(leaders.pond), (el.pond.style.opacity = 0);
    place(el.mart, 540, 470, name === 'hook' ? fadeWin(t, A.tropical, A.laughed - 0.3, 0.2) : 0, popScale(t, A.tropical));
    // the globe
    place(el.later, 540, 360, fadeWin(t, A.but1 - 0.1, A.shipping, 0.2), popScale(t, A.thirty ?? A.but1));
    place(el.toIndia, 540, 360, fadeWin(t, A.shipping - 0.05, A.india0 + 0.4, 0.2), popScale(t, A.shipping - 0.05));
    const gOn = name === 'globe1' || name === 'globe2';
    for (const [e, pl, a0] of [[el.lBoston, PLACES.boston, name === 'globe1' ? startOf('globe1') : 99], [el.lMart, PLACES.martinique, name === 'globe1' ? startOf('globe1') : 99], [el.lCal, PLACES.calcutta, name === 'globe1' ? A.halfway : A.twice]]) {
      if (!gOn) { e.style.opacity = 0; continue; }
      const w = globe.toWorld(...pl, globe.R * 1.08);
      const toCam = camera.position.clone().sub(globe.group.getWorldPosition(V3(0, 0, 0))).normalize();
      const facing = w.clone().sub(globe.group.getWorldPosition(V3(0, 0, 0))).normalize().dot(toCam);
      const s = toScreen(w, camera);
      place(e, s.x, s.y - 50, fadeIn(t, a0, a0 + 0.3) * clamp01((facing - 0.15) * 4) * (name === 'globe1' && e === el.lMart ? 1 - ramp(t, A.later, A.later + 0.5) : 1));
    }
    // Tudor
    place(el.name, 540, 360, fadeWin(t, A.name, A.newspaper - 0.4), popScale(t, A.tudor - 0.1));
    place(el.nameLab, 540, 460, fadeWin(t, A.tudor - 0.2, A.newspaper - 0.4));
    // the Gazette: underline "slippery speculation"
    place(el.gazette, 540, 1680, name === 'paper' ? fadeWin(t, A.newspaper - 0.2, A.because1 - 0.1) : 0);
    const uOn = name === 'paper' ? fadeIn(t, A.slippery - 0.1, A.slippery + 0.05) * (1 - ramp(t, A.because1 - 0.3, A.because1 - 0.1)) : 0;
    if (uOn > 0) {
      const uv2w = (u, v) => study.paper.localToWorld(V3((u - 0.5) * 0.58, (v - 0.5) * 0.8, 0.012));
      const U = study.gz.u;
      const k1 = ramp(t, A.slippery - 0.1, A.slippery + 0.35, ease.inOut), k2 = ramp(t, A.slippery + 0.3, A.plan_e, ease.inOut);
      const a = toScreen(uv2w(...U.a), camera), b = toScreen(uv2w(...U.b), camera), c = toScreen(uv2w(...U.c), camera), d = toScreen(uv2w(...U.d), camera);
      const pts = [{ x: a.x, y: a.y }, { x: lerp(a.x, b.x, k1), y: lerp(a.y, b.y, k1) }];
      setLine(leaders.under, pts, uOn * 0.9);
      if (k2 > 0) { leaders.under2 = leaders.under2 || ov.line(P.accent, 9); setLine(leaders.under2, [{ x: c.x, y: c.y }, { x: lerp(c.x, d.x, k2), y: lerp(c.y, d.y, k2) }], uOn * 0.9); }
    } else { hideLine(leaders.under); if (leaders.under2) hideLine(leaders.under2); }
    // melting, nowhere, the loss
    place(el.meltWay, 540, 400, name === 'holdMelt' ? fadeWin(t, A.melted - 0.15, endOf('holdMelt')) : 0, popScale(t, A.melted - 0.15));
    place(el.noHouse, 540, 400, fadeWin(t, A.nowhere - 0.15, A.lost - 0.1, 0.2), popScale(t, A.nowhere - 0.15));
    place(el.loss, 540, 380, fadeWin(t, A.thousands - 0.15, A.worse - 0.35, 0.2), popScale(t, A.thousands - 0.15));
    place(el.lossLab, 540, 490, fadeWin(t, A.thousands, A.worse - 0.35, 0.2));
    place(el.prison, 540, 380, fadeWin(t, A.prison - 0.2, A.secret - 0.1, 0.2), popScale(t, A.prison - 0.2));
    place(el.prisonLab, 540, 480, fadeWin(t, A.prison, A.secret - 0.1, 0.2));
    // the race
    place(el.same, 540, 330, name === 'race' ? fadeWin(t, startOf('race') + 0.2, A.slowly, 0.2) : 0);
    const rOn = name === 'race' ? fadeWin(t, A.big - 0.15, A.cut - 0.4, 0.2) : 0;
    if (rOn > 0) {
      const b = toScreen(pier(-36.35, PIER_Y + 0.62, -0.38), camera), s = toScreen(pier(-35.6, PIER_Y + 0.62, 0.42), camera);
      setLine(leaders.big, [{ x: b.x, y: b.y - 10 }, { x: b.x, y: 610 }], rOn); place(el.bigL, Math.max(240, Math.min(840, b.x)), 570, rOn);
      const sOn = fadeWin(t, A.small - 0.15, A.cut - 0.4, 0.2);
      setLine(leaders.small, [{ x: s.x, y: s.y - 10 }, { x: s.x, y: 760 }], sOn); place(el.smallL, Math.max(240, Math.min(840, s.x)), 720, sOn);
    } else { hideLine(leaders.big); hideLine(leaders.small); el.bigL.style.opacity = 0; el.smallL.style.opacity = 0; }
    place(el.slower, 540, 400, fadeWin(t, A.small_e + 0.15, A.cut - 0.4, 0.2), popScale(t, A.small_e + 0.15));
    // pond, packing
    place(el.square, 540, 400, fadeWin(t, A.square - 0.1, A.packed - 0.25, 0.2), popScale(t, A.square - 0.1));
    place(el.packed, 540, 400, fadeWin(t, A.packed - 0.15, A.buried - 0.1, 0.2), popScale(t, A.packed - 0.15));
    place(el.sawdust, 540, 400, fadeWin(t, A.buried - 0.1, A.india - 0.1, 0.2), popScale(t, A.sawdust - 0.1));
    place(el.free, 540, 500, fadeWin(t, A.sawmills - 0.15, A.india - 0.1, 0.2));
    // 1833
    place(el.y1833, 540, 380, fadeWin(t, A.y1833 - 0.1, A.t180 - 0.1, 0.2), popScale(t, A.y1833 - 0.1));
    place(el.tons, 540, 380, fadeWin(t, A.t180 - 0.1, A.ship2, 0.2), popScale(t, A.t180 - 0.1));
    place(el.tonsLab, 540, 480, fadeWin(t, A.t180 + 0.1, A.ship2, 0.2));
    place(el.tusc, 540, 380, fadeWin(t, A.tuscany - 0.1, A.four - 0.45, 0.2), popScale(t, A.tuscany - 0.1));
    const dOn = name === 'voyage' ? fadeWin(t, startOf('voyage'), A.crossing - 0.25, 0.15) : 0;
    el.days.textContent = `DAY ${Math.max(1, Math.round(1 + 119 * ramp(t, A.four - 0.1, A.atsea_e + 0.15, ease.inOut)))}`;
    place(el.days, 540, 380, dOn); place(el.daysLab, 540, 480, dOn);
    const eOn = name === 'globe2' ? Math.max(fadeWin(t, A.equator - 0.1, A.equator + 0.45, 0.1), fadeWin(t, A.twice - 0.1, A.t100 - 0.5, 0.1)) : 0;
    el.eq.textContent = t > A.twice - 0.1 ? 'EQUATOR ×2' : 'EQUATOR';
    el.eq.style.color = '#FFD27A';
    place(el.eq, 540, 380, eOn, popScale(t, t > A.twice - 0.1 ? A.twice - 0.1 : A.equator - 0.1));
    place(el.left, 540, 380, fadeWin(t, A.t100 - 0.2, A.calcutta + 0.2, 0.2), popScale(t, A.t100 - 0.2));
    place(el.leftLab, 540, 490, fadeWin(t, A.stillf - 0.1, A.calcutta + 0.2, 0.2));
    place(el.calLab, 540, 1680, name === 'calcutta' ? fadeWin(t, startOf('calcutta') + 0.2, endOf('calcutta')) : 0);
    place(el.house, 540, 380, fadeWin(t, A.house - 0.1, A.known - 0.6, 0.2), popScale(t, A.house - 0.1));
    place(el.houseLab, 540, 480, fadeWin(t, A.forice - 0.1, A.known - 0.6, 0.2));
    place(el.king, 540, 400, fadeWin(t, A.iceking - 0.3, A.end - 0.1, 0.2), popScale(t, A.iceking - 0.3));
  }

  window.shaderErrors = () => { const out = []; scene.traverse((o) => { if (!o.material) return; for (const m of [].concat(o.material)) { const p = renderer.properties.get(m).currentProgram; if (p && p.diagnostics && !p.diagnostics.runnable) out.push((o.name || o.type) + ': ' + (p.diagnostics.vertexShader.log + ' ' + p.diagnostics.fragmentShader.log).trim().slice(0, 400)); } }); return out; };
  window.__sets = SETS; window.__cam = camera;
  window.dbg = {
    cam: (t) => { const s = shotAt(t)[0]; const c = cameraFor(s, t); return { shot: s, pos: c.pos.toArray().map((v) => +v.toFixed(2)), tgt: c.tgt.toArray().map((v) => +v.toFixed(2)) }; },
  };
  return {
    scene, camera, update,
    post: Q.has('nopost') ? null : { ss: SS, msaa: Number(Q.get('msaa') ?? 0), samples: 1, shutter: 0.5, grain: 0.022, vignette: 0.3, exposure: 1.0, bloom: 0.14, bloomThreshold: 1.1, bg: P.bg },
    blurSamples(t) {
      for (const [a, b] of [[4.2, 6.9], [D - 4.6, D]]) if (t > a && t < b) return Math.max(1, Number(Q.get('blur') ?? 3));
      return 1;
    },
    look(t) { return {}; },
  };
}
