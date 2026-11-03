// scenes/main.js -- the whole Short as one seekable timeline: window.setTime(t) draws the frame at t seconds.
// Shots are cut at the middle of the 0.8 s silences between sections. Every time is a phrase anchor on the measured
// narration (cache/data.json); every number on screen is formatted from data.json (config/facts.py) or from the same
// formulas evaluated at the fold being shown.
import * as THREE from 'three';
import { PAL, W, H, ease, ramp, keyed, win, lerp, clamp01, anchors, commas, sig, length, Type } from './lib.js';
import { Universe } from './universe.js';
import { Studio } from './studio.js';

export async function boot() {
  const data = await (await fetch('/cache/data.json', { cache: 'no-store' })).json();
  await document.fonts.load("800 100px 'InterXB'");
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true,
    preserveDrawingBuffer: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(PAL.bg, 1);
  const pmrem = new THREE.PMREMGenerator(renderer);
  // environment for reflections: a dark room with one big soft light up and to the left, where the lamp is
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0x1a1816, side: THREE.BackSide })));
  const box = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  box.material.color.setScalar(9); box.position.set(-3.5, 7, 4); box.lookAt(0, 0, 0); envScene.add(box);
  const over = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  over.material.color.setRGB(4.5, 4.2, 3.9); over.position.set(0, 8.5, 0); over.rotation.x = Math.PI / 2; envScene.add(over);
  const box2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  box2.material.color.setScalar(1.2); box2.position.set(5, 3, -5); box2.lookAt(0, 0, 0); envScene.add(box2);
  const env = pmrem.fromScene(envScene, 0.03).texture;

  const F = data.facts, at = anchors(data.sentences), sec = data.sections;
  const cut = (a, b) => (sec[a].end + sec[b].start) / 2;          // middle of the silence between two sections
  const CUT = [0, cut('S00', 'S01'), cut('S01', 'S02'), cut('S02', 'S03'), cut('S03', 'S04'), cut('S04', 'S05'), data.duration];
  const U = new Universe(renderer, F, data.table);
  U.scene.environment = env; U.scene.environmentIntensity = 0.025;
  const S = new Studio(renderer, F, env);
  const T = new Type();
  const ctx = { data, F, at, sec, CUT, U, S, T, renderer };
  const shots = [shotHook(ctx), S.shotRule(ctx), S.shotGold(ctx), S.shotCurve(ctx), S.shotTwelve(ctx), shotBack(ctx)];

  window.setTime = async (t) => {
    T.hideAll();
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.setClearColor(PAL.bg, 1); renderer.clear();
    let i = 0; while (i < shots.length - 1 && t >= CUT[i + 1]) i++;
    shots[i](t);
    return true;
  };
  window.selfTest = () => {                 // the JS formulas against the Python table
    let err = 0;
    for (const r of data.table) err = Math.max(err, Math.abs(U.stack(r.n) / r.stack_m - 1), r.length_m > 0 ? Math.abs(U.gallivan(r.n) / r.length_m - 1) : Math.abs(U.gallivan(r.n)));
    return err;
  };
  window.cuts = CUT; window.dbg = ctx;
  await window.setTime(0); await window.setTime(0);
  window.glInfo = (() => { const g = renderer.getContext(); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); })();
  window.ready = true;
}

const smax = (a, b, p = 4) => Math.pow(Math.pow(a, p) + Math.pow(b, p), 1 / p);
const smin = (a, b, p = 4) => Math.pow(Math.pow(a, -p) + Math.pow(b, -p), -1 / p);
const LY = 9.4607304725808e15;

/** The opening pose (also the last frame: the loop). */
export const OPEN = { target: [0.0, 0.0, 0.0], D: 1.3, az: -0.55, el: 0.95, fov: 34, shiftY: 150 };

// ===================================================================== S00 the hook
function shotHook({ at, U, T, F, CUT, renderer }) {
  const tFold0 = 0.75, tFold7 = 3.1, tMoon = at('S00.01', 'Moon', 'end') + 0.15;
  const tStrip = at('S00.01', 'strip'), tMilky = at('S00.01', 'Milky Way'), tWide = at('S00.01', 'wide', 'end');
  const tFormula = at('S00.02', 'a formula'), tEnd = CUT[1];
  console.log('S00 anchors', JSON.stringify({ tMoon, tStrip, tMilky, tWide, tFormula }));
  const big = T.make(250), lbl = T.make(64, PAL.dim), sub = T.make(84), moonL = T.make(46, PAL.dim), sunL = T.make(46, PAL.dim);
  const big2 = T.make(200), lbl2 = T.make(64, PAL.dim), formula = T.make(92);
  const nAt = (t) => t < tFold7 ? keyed(t, [[tFold0, 0], [tFold7, 7]], { fn: (u) => ease.sine(u) * 0.15 + u * 0.85 })
    : keyed(t, [[tFold7, 7], [tMoon, 42]], { fn: (u) => ease.inOut(u) * 0.75 + u * 0.25 });
  const tPull0 = Math.max(tMoon + 0.6, tStrip - 0.3), tPull1 = tWide + 1.3, tHold = tMoon + 0.25;
  return (t) => {
    const n = nAt(t), h = U.stack(n);
    U.state = { n, strip: 0, cloud: 1, end: 0, lamp: 1 };
    let view;
    if (t < tHold) {
      const fold = U.folder.centre(Math.min(n, 7));
      const Dfold = keyed(t, [[tFold0, OPEN.D], [tFold7 + 0.2, 0.24]], { log: true });
      const D = smax(Dfold, 3.4 * h);
      const lift = ramp(Math.log10(h), -1.8, 0.5);          // from looking down at the sheet to looking across the column
      const cx = U.s7.x0 / 2 + U.s7.x1 / 2, cz = U.s7.z0 / 2 + U.s7.z1 / 2;
      view = { target: [lerp(fold[0], cx, ramp(n, 0, 7)), lerp(fold[1], lerp(0.95, 1.15, ramp(Math.log10(h), 6, 8)) * h, lift), lerp(fold[2], cz, ramp(n, 0, 7))],
               D, az: lerp(OPEN.az, 0, ramp(Math.log10(h), -2, 1)), el: lerp(OPEN.el, 0.07, ramp(Math.log10(h), -2, 0.8)), fov: 34, shiftY: 150 * (1 - ramp(Math.log10(h), -1.5, 0)) };
      if (t < tFold0) view = { ...OPEN };
    } else {
      // log10 of the camera distance: slower past the Moon and the Sun, quicker through the empty light years
      const d0 = Math.log10(3.4 * U.stack(42)), span = tPull1 - tPull0;
      const dH = Math.log10(3.4 * U.stack(42) * 1.15), dE = Math.log10(2.75e21);
      const lg = t < tPull0 ? lerp(d0, dH, ramp(t, tHold, tPull0, ease.out))
        : t < tPull1 ? keyed(t, [[tPull0, dH], [tPull0 + 0.2 * span, 11.0], [tPull0 + 0.45 * span, 12.6], [tPull0 + 0.72 * span, 18.8], [tPull1, dE]],
          { fn: (u) => u }) : keyed(t, [[tPull1, dE], [tEnd, dE + 0.03]], { fn: ease.out });
      const D = Math.pow(10, lg);
      // the camera backs away up the strip: Earth near the bottom of the frame, the strip's end just below the type
      const y = smin(Math.max(0.2 * D, 1.15 * U.stack(42) * (1 - ramp(lg, 9.2, 10.4))), 4.3e20);
      view = { target: [0, y, 0], D, az: 0, el: lerp(0.07, 0.0, ramp(lg, 10, 13)), fov: 34 };
      U.state.strip = Math.min(data_L42(U), D * lerp(0.29, 0.42, ramp(lg, 20.7, 21.3))) * ramp(t, tStrip - 0.25, tStrip);
      U.state.stripX = 1.2e7;
      U.state.n = 42;
    }
    U.render(renderer, view);
    // ---- type
    const nShown = Math.floor(n + 1e-6);
    const opCount = win(t, tFold0 - 0.2, tStrip + 0.1, 0.3, 0.3);
    T.put(big, String(nShown), { y: 400, op: opCount });
    big.style.color = nShown >= 42 ? PAL.accent : PAL.ink;
    T.put(lbl, nShown === 1 ? 'FOLD' : 'FOLDS', { y: 560, op: opCount });
    const [hv, hu] = length(U.stack(nShown));
    T.put(sub, `${hv} ${hu}`, { y: 680, op: opCount * ramp(t, tFold0 + 0.2, tFold0 + 0.6) });
    const mp = U.screen(U.P.moon);
    T.put(moonL, 'Moon', { x: mp.x - 90, y: mp.y, op: win(t, tMoon - 0.9, tStrip + 1.6) * (mp.front ? 1 : 0) * clamp01(2 - Math.abs(Math.log10(view.D) - 9.3)) });
    const sp = U.screen(U.P.sun);
    T.put(sunL, 'Sun', { x: sp.x + 80, y: sp.y, op: sp.front ? clamp01(1.2 - Math.abs(Math.log10(view.D) - 11.9) / 1.2) : 0 });
    const L = U.state.strip;
    if (t > tStrip + 0.12) {
      const [lv, lu] = length(L, { digits: 3 });
      const done = t > tPull1 - 0.6;
      T.put(big2, lv, { y: 400, op: win(t, tStrip + 0.15, tEnd + 1, 0.35, 0.3), scale: 1 });
      big2.style.color = done ? PAL.accent : PAL.ink;
      T.put(lbl2, lu.toUpperCase() + ' OF PAPER', { y: 545, op: win(t, tStrip + 0.15, tEnd + 1, 0.35, 0.3) });
    }
    T.put(formula, FORMULA,
      { y: 1440, op: win(t, tFormula, tEnd + 1, 0.4, 0.3) });
  };
}
function data_L42(U) { return U.gallivan(42); }
const SUP = (x) => `<span style="font-size:.58em;vertical-align:.75em">${x}</span>`;
const FRAC = (a, b) => `<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;font-size:.62em;line-height:1.05;margin:0 .12em"><span style="border-bottom:.09em solid currentColor;padding:0 .08em">${a}</span><span>${b}</span></span>`;
export const FORMULA = `L = ${FRAC('πt', '6')}(2${SUP('n')} + 4)(2${SUP('n')} − 1)`;

// ===================================================================== S05 back to the Moon (split screen) and the loop
function shotBack({ at, U, T, F, CUT, data, renderer }) {
  const t0 = CUT[5], tEnd = data.duration;
  const t22 = at('S05.02', 'by fold 22'), tSky = at('S05.02', 'skyscraper', 'end'), tMoonD = at('S05.02', 'distance to the Moon', 'end');
  const t42 = at('S05.02', 'by fold 42'), tLY = at('S05.02', 'light years', 'end');
  const tPaper = at('S05.03', 'the paper itself'), tHome = at('S05.03', 'if you want'), tRoll = at('S05.03', 'a longer roll');
  const tCorr = at('S05.03', 'a very long corridor');
  const tSplitEnd = tHome - 0.2;
  const nAt = (t) => keyed(t, [[t0 + 0.6, 12], [t22 + 0.4, 22], [tMoonD + 0.6, 22], [tLY - 0.3, 42]], { fn: ease.inOut });
  const ttl = [T.make(56, PAL.dim), T.make(56, PAL.dim)], num = [T.make(120), T.make(120)], unit = [T.make(60), T.make(60)];
  const foldN = T.make(64, PAL.dim);
  const moonL = [T.make(40, PAL.dim), T.make(40, PAL.dim)];
  return (t) => {
    if (t < tSplitEnd) {
      const n = nAt(t), h = U.stack(n), L = U.gallivan(n);
      const lgh = Math.log10(h), lgL = Math.log10(L);
      // left: the stack, seen from the side; right: the strip, measured straight up beside it (same world, same scale rule)
      U.state = { n, strip: 0, cloud: 1, end: 0, lamp: 0.6, stackLine: 1 };
      const cx = (U.s7.x0 + U.s7.x1) / 2, cz = (U.s7.z0 + U.s7.z1) / 2;
      const vl = { target: [cx, 0.72 * h, cz], D: 3.4 * h, az: 0, el: lerp(0.12, 0.02, ramp(lgh, 0, 6)), fov: 34 };
      U.render(renderer, vl, [0, 0, 540, 1920]);
      const mpl = U.screen(U.P.moon);
      U.state = { n: 7, strip: L, stripX: 0.05, cloud: 1, end: 0, lamp: 0.6, stackLine: 0 };
      const vr = { target: [0.05, smin(0.72 * L, 4.6e20), 0], D: smin(3.4 * L, 3.0e21), az: 0, el: lerp(0.12, 0.0, ramp(lgL, 2, 8)), fov: 34 };
      U.render(renderer, vr, [540, 0, 540, 1920]);
      const mpr = U.screen(U.P.moon);
      // divider: a dark gap between the halves
      renderer.setScissorTest(true); renderer.setScissor(538, 0, 4, 1920); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.setScissorTest(false);
      const op = ramp(t, t0 + 0.1, t0 + 0.6);
      T.put(ttl[0], 'STACK', { x: 270, y: 320, op, maxW: 480 });
      T.put(ttl[1], 'STRIP', { x: 810, y: 320, op, maxW: 480 });
      const [hv, hu] = length(h), [lv, lu] = length(L);
      T.put(num[0], hv, { x: 270, y: 430, op, maxW: 490 });
      T.put(num[1], lv, { x: 810, y: 430, op, maxW: 490 });
      num[1].style.color = n > 41.95 ? PAL.accent : PAL.ink;
      T.put(unit[0], hu, { x: 270, y: 530, op, maxW: 480 });
      T.put(unit[1], lu, { x: 810, y: 530, op, maxW: 480 });
      T.put(foldN, `FOLD ${Math.floor(n + 1e-6)}`, { x: 540, y: 1400, op });
      T.put(moonL[0], 'Moon', { x: mpl.x + 70, y: mpl.y, op: op * clamp01(1.5 - Math.abs(lgh - 8.6)) * (mpl.x > 20 && mpl.x < 520 ? 1 : 0) });
      T.put(moonL[1], 'Moon', { x: mpr.x - 70, y: mpr.y, op: op * clamp01(1.5 - Math.abs(lgL - 9.0)) * (mpr.x > 560 && mpr.x < 1060 ? 1 : 0) });
    } else {
      // the end: a hand on a roll of toilet paper, the strip down a long corridor; then back to the opening frame
      const tBack0 = tEnd - 1.0, tBack1 = tEnd - 0.1;
      U.state = { n: 0, strip: 0, cloud: 0, end: 1, lamp: 1, endStrip: keyed(t, [[tSplitEnd, 6], [tCorr + 1.0, 60]], { log: true }),
                  handLift: 0.06 * ramp(t, tBack0 - 0.6, tBack0 + 0.6) };
      const vA = { target: [-0.6, 0.085, 0.12], D: 0.66, az: 0.75, el: 0.42, fov: 34 };
      const vB = { target: [-12.0, 0.0, 0.12], D: 11.0, az: 1.5, el: 0.12, fov: 34 };
      let v;
      if (t < tBack0) {
        const u = ramp(t, tRoll - 0.2, tBack0 + 0.05);
        v = { target: [lerp(vA.target[0], vB.target[0], u), lerp(vA.target[1], vB.target[1], u), 0.12],
              D: Math.exp(lerp(Math.log(vA.D), Math.log(vB.D), u)), az: lerp(vA.az, vB.az, u), el: lerp(vA.el, vB.el, u), fov: 34 };
      } else {
        const u = ramp(t, tBack0, tBack1, ease.inOut);
        v = { target: vB.target.map((a, i) => lerp(a, OPEN.target[i], u)), D: Math.exp(lerp(Math.log(vB.D), Math.log(OPEN.D), u)),
              az: lerp(vB.az, OPEN.az, u), el: lerp(vB.el, OPEN.el, u), fov: 34 };
        if (t >= tBack1) { v = { ...OPEN }; }   // the props stay where they are, out of this frame
      }
      U.render(renderer, v);
    }
  };
}
