// scenes/studio.js -- S01-S04: the floor under one lamp, in metres (true scale; the camera's near/far follow its distance).
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { PAL, ease, ramp, keyed, win, lerp, clamp01, commas, length, floorTexture, layerTexture, Folder, person, roll } from './lib.js';

export class Studio {
  constructor(renderer, F, env) {
    this.F = F; this.R = renderer;
    const s = this.scene = new THREE.Scene();
    s.environment = env; s.environmentIntensity = 0.025;
    this.camera = new THREE.PerspectiveCamera(34, 1080 / 1920, 0.001, 1e6);
    this.ftex = floorTexture();
    this.floorMat = new THREE.MeshStandardMaterial({ color: PAL.floor, roughness: 0.92, bumpMap: this.ftex, bumpScale: 0.08 });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 120, 120).rotateX(-Math.PI / 2), this.floorMat);
    this.floor.receiveShadow = true; s.add(this.floor);
    this.spot = new THREE.SpotLight(0xfff1e0, 5.5, 0, 0.62, 0.85, 0);
    this.spot.castShadow = true; this.spot.shadow.mapSize.set(2048, 2048); this.spot.shadow.bias = -0.00015;
    s.add(this.spot, this.spot.target);
    this.fill = new THREE.HemisphereLight(0xcfd6e0, 0x141210, 0.08); s.add(this.fill);
    this.ltex = layerTexture();
    this.sheet = new Folder(s, { a: 0.297, b: 0.210, t: F.T, tex: this.ltex, maxFolds: 8 });
    this.gold = new Folder(s, { a: 0.08, b: 0.08, t: F.GOLD_T, metal: true, tex: this.ltex, maxFolds: 12, minH: 4e-6 });  // drawn >= 4 um thick (invisible either way) so its normals stay well-conditioned
    this.goldMats = [...new Set([...this.gold.base.material, ...this.gold.flap.material])];
    for (const m of this.goldMats) { m.envMap = env; m.envMapIntensity = 1.0; }
    this.front = new THREE.DirectionalLight(0xffffff, 0); s.add(this.front, this.front.target);
    this.section = this._section();
    this.paperMat = new THREE.MeshStandardMaterial({ color: PAL.paper, roughness: 0.88 });
    this.strip = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.paperMat); this.strip.castShadow = false; this.strip.receiveShadow = false; s.add(this.strip);
    this.top = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.paperMat); this.top.castShadow = true; this.top.receiveShadow = false; s.add(this.top);
    this.roll = roll(); s.add(this.roll);
    this.walker = person(); s.add(this.walker);
    const line = (color, w) => {
      const g = new LineGeometry(); g.setPositions([0, 0, 0, 1, 0, 0]);
      const l = new Line2(g, new LineMaterial({ color, linewidth: w, transparent: true, depthWrite: false }));
      l.frustumCulled = false; l.renderOrder = 3; s.add(l); return l;
    };
    this.lineA = line(0xf1eee7, 9); this.lineB = line(PAL.accentHex, 9);
    this.all = [this.sheet.group, this.gold.group, this.section.group, this.strip, this.top, this.roll, this.walker, this.lineA, this.lineB];
  }

  only(...objs) { for (const o of this.all) o.visible = objs.includes(o); this.front.intensity = 0; }

  /** view = { target, D, az, el }; lamp = where the spot sits relative to the target, in units of D (or metres). */
  render(view, { lampAt = null, lampScale = null } = {}) {
    if (!view.keepFront) { /* set per shot */ }
    const { target: tg, D, az, el } = view, ce = Math.cos(el);
    const c = this.camera;
    c.position.set(tg[0] + D * ce * Math.sin(az), tg[1] + D * Math.sin(el), tg[2] + D * ce * Math.cos(az));
    c.near = D * 2e-3; c.far = D * 2e3; c.fov = view.fov || 34; c.aspect = 1080 / 1920;
    if (view.shiftY ?? 150) c.setViewOffset(1080, 1920, 0, -(view.shiftY ?? 150), 1080, 1920); c.updateProjectionMatrix();
    c.up.set(0, 1, 0); c.lookAt(...tg);
    const fs = Math.max(400 * D, 6);
    this.floor.scale.set(fs, 1, fs); this.floor.position.set(tg[0], -(D < 20 ? Math.min(D * 1e-4, 0.002) : D * 3e-4), tg[2]);
    this.ftex.repeat.set(fs / 0.6, fs / 0.6);
    const ls = lampScale ?? 1;
    const lp = lampAt ?? [tg[0] - 0.75 * ls, 1.55 * ls, tg[2] + 0.95 * ls];
    this.spot.position.set(...lp); this.spot.target.position.set(tg[0], 0, tg[2]);
    this.spot.shadow.camera.near = 0.3 * ls; this.spot.shadow.camera.far = 6 * ls; this.spot.shadow.camera.updateProjectionMatrix();
    for (const l of [this.lineA, this.lineB]) l.material.resolution.set(1080, 1920);
    this.R.setViewport(0, 0, 1080, 1920);
    this.R.render(this.scene, c);
  }

  screen(p) {
    const v = new THREE.Vector3(...p).project(this.camera);
    return { x: (v.x + 1) / 2 * 1080, y: (1 - v.y) / 2 * 1920 };
  }

  // ------------------------------------------------------------------ cross-section of a fold (S03)
  // Up to 64 layers folded once: layer i (inner to outer) bends round a half circle of radius r0 + (i + 0.5) p.
  _section() {
    const g = new THREE.Group(), p = 0.0036, w = 0.0016, depth = 0.18, leg = 0.32, r0 = 0.0015, N = 32;
    const white = new THREE.MeshStandardMaterial({ color: PAL.paper, roughness: 0.85 });
    const layers = [];
    for (let i = 0; i < N; i++) {
      const r = r0 + (i + 0.5) * p, ro = r + w / 2, ri = r - w / 2;
      const arcShape = new THREE.Shape();
      arcShape.absarc(0, 0, ro, -Math.PI / 2, Math.PI / 2, false);
      arcShape.absarc(0, 0, ri, Math.PI / 2, -Math.PI / 2, true);
      const opt = { depth, bevelEnabled: false, curveSegments: 48 };
      const arc = new THREE.Mesh(new THREE.ExtrudeGeometry(arcShape, opt), white.clone());
      const legs = [];
      for (const sgn of [1, -1]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, sgn * ri); sh.lineTo(-leg, sgn * ri); sh.lineTo(-leg, sgn * ro); sh.lineTo(0, sgn * ro); sh.closePath();
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), white);
        legs.push(m); g.add(m);
      }
      for (const m of [arc, ...legs]) { m.castShadow = true; m.receiveShadow = false; m.position.z = -depth; }
      g.add(arc);
      layers.push({ arc, legs, r });
    }
    this.scene.add(g);
    return { group: g, layers, p, N, leg };
  }
  /** m layers visible (fractional = the next one growing in); hot[i] in 0..1 = how much layer i's bend glows. */
  setSection(m, hot) {
    const { layers } = this.section;
    const acc = new THREE.Color(PAL.accentHex), wh = new THREE.Color(PAL.paper);
    layers.forEach((L, i) => {
      const vis = clamp01(m - i);
      const sc = vis > 0 ? 0.3 + 0.7 * ease.out(vis) : 0;
      for (const o of [L.arc, ...L.legs]) { o.visible = vis > 0.001; o.scale.set(1, 1, Math.max(sc, 0.001)); }
      const h = hot(i);
      L.arc.material.color.copy(wh).lerp(acc, h);
      L.arc.material.emissive = L.arc.material.emissive || new THREE.Color();
      L.arc.material.emissive.copy(acc).multiplyScalar(0.22 * h);
    });
  }

  // ===================================================================== S01 the rule
  shotRule({ at, T, CUT }) {
    const t0 = CUT[1];
    const tA = at('S01.01', 'if you try it') + 0.2, t7 = at('S01.01', 'after seven folds', 'end');
    const tStiff = at('S01.01', 'stiff little block'), t128 = at('S01.01', '128 layers'), tEnd1 = at('S01.01', 'thick', 'end');
    const t2001 = at('S01.02', 'in 2001'), tFold = at('S01.02', 'to fold something'), t12 = at('S01.02', '12 times');
    const dt = (t7 - tA) / 7;
    const big = T.make(260), lbl = T.make(64, PAL.dim), mm = T.make(84);
    const yr = T.make(230), l1 = T.make(104), l2 = T.make(104);
    const foldAt = (t) => { let f = 0; for (let k = 0; k < 7; k++) f += ramp(t, tA + k * dt, tA + k * dt + 0.62 * dt, ease.inOut); return f; };
    return (t) => {
      this.only(this.sheet.group);
      const f = foldAt(t);
      // the eighth fold refuses: the top lifts a few degrees, strains, and drops back
      const tryU = ramp(t, tStiff - 0.25, tStiff + 0.35) * (1 - ramp(t, t128 + 0.2, t128 + 0.6));
      const lift = tryU * (0.11 + 0.025 * Math.sin((t - tStiff) * 38) * Math.exp(-Math.max(0, t - tStiff) * 1.5));
      this.sheet.set(f, { lift: f >= 6.999 ? lift : 0 });
      const c = this.sheet.centre(f);
      const D = keyed(t, [[t0, 1.3], [tA, 1.15], [t7 + 0.4, 0.2], [CUT[2], 0.18]], { log: true });
      const az = lerp(-0.55, 0.35, ramp(t, t0, CUT[2], ease.linear));
      const el = keyed(t, [[t0, 0.98], [t7 + 0.4, 0.55], [CUT[2], 0.5]]);
      this.render({ target: [c[0], c[1], c[2]], D, az, el });
      const k = Math.floor(f + 1e-6);
      const op = win(t, tA + 0.62 * dt - 0.1, t2001 - 0.2, 0.25, 0.4);
      T.put(big, commas(Math.pow(2, k)), { y: 400, op });
      big.style.color = k >= 7 ? PAL.accent : PAL.ink;
      T.put(lbl, 'LAYERS', { y: 560, op });
      T.put(mm, `${(this.F.T * Math.pow(2, k) * 1000).toFixed(1)} mm`, { y: 680, op: op * ramp(t, t7 - 0.2, t7 + 0.3) });
      T.put(yr, String(this.F.YEAR_CHALLENGE), { y: 420, op: win(t, t2001 - 0.1, CUT[2] + 1, 0.35, 0.3) });
      const opL = win(t, tFold - 0.1, CUT[2] + 1, 0.35, 0.3);
      T.put(l1, 'FOLD SOMETHING', { y: 620, op: opL });
      T.put(l2, `IN HALF <span style="color:${PAL.accent}">${this.F.FOLDS_GOAL}</span> TIMES`, { y: 740, op: opL * ramp(t, t12 - 0.5, t12 - 0.1) + 0 });
    };
  }

  // ===================================================================== S02 the gold foil
  shotGold({ at, T, CUT }) {
    const t0 = CUT[2], tGold = at('S02.01', 'did it with gold foil'), tEnd = at('S02.01', 'visible light', 'end');
    const tMis = at('S02.02', 'misspoken'), tPaper = at('S02.02', 'he meant paper'), tSat = at('S02.02', 'she sat down');
    const tF0 = tGold - 0.1, dt = (tEnd + 0.3 - tF0) / 12;
    const big = T.make(260), lbl = T.make(64, PAL.dim), lay = T.make(84);
    const l1 = T.make(104), l1b = T.make(104), l2 = T.make(104);
    const strike = document.createElement('div');
    Object.assign(strike.style, { position: 'absolute', height: '12px', background: PAL.accent, left: '0', top: '0', opacity: 0, borderRadius: '6px' });
    document.getElementById('ov').appendChild(strike); T.items.push(strike);
    return (t) => {
      this.only(this.gold.group);
      let f = 0; for (let k = 0; k < 12; k++) f += ramp(t, tF0 + k * dt, tF0 + k * dt + 0.7 * dt, ease.inOut);
      this.gold.set(f);
      const c = this.gold.centre(f);
      const D = keyed(t, [[t0, 0.34], [tF0, 0.3], [tF0 + 12 * dt + 0.3, 0.0105], [tMis, 0.0095], [CUT[3], 0.0085]], { log: true });
      const az = lerp(-0.2, 0.5, ramp(t, t0, CUT[3], ease.linear));
      const el = keyed(t, [[t0, 1.05], [tF0 + 12 * dt, 0.62], [CUT[3], 0.55]]);
      this.render({ target: [c[0], c[1], c[2]], D, az, el }, { lampScale: Math.max(0.05, D / 0.9) });
      const k = Math.floor(f + 1e-6);
      const op = win(t, tF0 + 0.5 * dt, tMis - 0.3, 0.25, 0.4);
      T.put(big, String(k), { y: 400, op });
      big.style.color = k >= 12 ? PAL.accent : PAL.ink;
      T.put(lbl, k === 1 ? 'FOLD' : 'FOLDS', { y: 560, op });
      T.put(lay, `${commas(Math.pow(2, k))} layers`, { y: 680, op: op * ramp(t, tF0 + 12 * dt - 0.2, tF0 + 12 * dt + 0.2) });
      // FOLD SOMETHING IN HALF 12 TIMES -> SOMETHING struck through -> PAPER
      const opL = win(t, tMis - 0.6, CUT[3] + 1, 0.35, 0.3);
      const swap = ramp(t, tPaper - 0.1, tPaper + 0.45);
      T.put(l1, 'FOLD SOMETHING', { y: 560 - 60 * swap, op: opL * (1 - 0.55 * swap) });
      T.put(l1b, `FOLD <span style="color:${PAL.accent}">PAPER</span>`, { y: 700 - 50 * swap + 50, op: opL * swap });
      T.put(l2, `IN HALF ${this.F.FOLDS_GOAL} TIMES`, { y: 680 + 140 * swap, op: opL });
      const sU = ramp(t, tMis, tMis + 0.45, ease.out);
      if (opL > 0.01 && sU > 0) {
        // the strike sits over "SOMETHING" (the right part of line 1)
        const w = l1._w, x0 = 540 - w / 2 + w * 0.36, x1 = 540 + w / 2;
        Object.assign(strike.style, { width: `${(x1 - x0) * sU}px`, transform: `translate(${x0}px, ${560 - 60 * swap - 4}px)`, opacity: opL * (1 - 0.55 * swap) });
      } else strike.style.opacity = 0;
    };
  }

  // ===================================================================== S03 what stops you
  shotCurve({ at, T, CUT }) {
    const t0 = CUT[3], tCurve = at('S03.01', 'the curve'), tWrap = at('S03.01', 'wrap the outer layers'), tUse = at('S03.01', "paper you can't use");
    const tTwice = at('S03.02', 'twice as thick'), tBig = at('S03.02', 'twice as big'), tMany = at('S03.02', 'twice as many layers');
    const tFour = at('S03.02', 'which means'), tEnd = at('S03.02', 'as much paper', 'end');
    const sStart = tFour - 0.2, sStep = (tEnd + 0.4 - sStart) / 3;
    const big = T.make(260), lbl = T.make(64, PAL.dim);
    const P = this.section.p;
    return (t) => {
      this.only(this.section.group, this.strip);
      const m = keyed(t, [[t0, 8], [tTwice - 0.1, 8], [tBig + 0.2, 16]]);
      const outer = Math.ceil(m) - 1;
      const glowOuter = ramp(t, tWrap, tWrap + 0.5) * (1 - ramp(t, tUse - 0.2, tUse + 0.2));
      const glowAll = ramp(t, tUse - 0.2, tUse + 0.3) * (1 - ramp(t, tTwice - 0.4, tTwice));
      const glowNew = ramp(t, tBig, tBig + 0.4);
      this.setSection(m, (i) => {
        const isOuter = i >= Math.floor(m) - 2;
        return Math.max(glowOuter * (i >= 6 ? 1 : 0), glowAll, glowNew * (i >= 8 && i <= outer ? ramp(t, tMany - 0.3, tMany + 0.2) * 1 : (isOuter ? 1 : 0)) * (i >= 14 || t > tMany - 0.3 ? 1 : 0));
      });
      // the section stands on the floor (bend at +x); the strip lies in front of it
      const R = 0.0015 + m * P;
      this.section.group.position.set(0, R + 0.002, 0);
      this.section.group.scale.set(1, 1, 1);
      // strip growing 1 -> 4 -> 16 -> 64 (unit = the leg length / 4)
      const u0 = 0.05;
      let mult = 1; for (let k = 0; k < 3; k++) mult *= Math.pow(4, ramp(t, sStart + k * sStep, sStart + (k + 0.7) * sStep, ease.inOut));
      const sl = u0 * mult;
      this.strip.visible = t > sStart - 0.5;
      const sOp = ramp(t, sStart - 0.5, sStart);
      this.strip.scale.set(sl, 0.0006, 0.04 * Math.max(sOp, 0.01)); this.strip.position.set(-0.32 + sl / 2, 0.0003, 0.12);
      const D = keyed(t, [[t0, 0.42], [tTwice, 0.4], [tBig + 0.4, 0.55], [sStart, 0.6], [tEnd + 0.4, 0.6 + 0.62 * u0 * 64], [CUT[4], 0.62 + 0.64 * u0 * 64]], { log: true });
      const tx = keyed(t, [[sStart, -0.035], [tEnd + 0.4, -0.32 + u0 * 32], [CUT[4], -0.32 + u0 * 32]]);
      this.front.intensity = 1.6; this.front.position.set(0.3, 0.5, 1); this.front.target.position.set(0, 0, 0);
      const el = keyed(t, [[t0, 0.25], [sStart, 0.3], [tEnd + 0.4, 0.95]]);
      this.render({ target: [tx, keyed(t, [[t0, 0.05], [sStart, 0.05], [tEnd, 0.0]]), 0.05], D, az: keyed(t, [[t0, 0.18], [CUT[4], 0.05]]), el },
        { lampScale: Math.max(1, D / 0.7) });
      const step = Math.round(Math.log(mult) / Math.log(4));
      const op = win(t, sStart - 0.2, CUT[4] + 1, 0.3, 0.3);
      T.put(big, `${commas(Math.pow(4, step))}×`, { y: 400, op });
      big.style.color = step >= 3 ? PAL.accent : PAL.ink;
      T.put(lbl, 'THE PAPER', { y: 560, op });
    };
  }

  // ===================================================================== S04 twelve folds
  shotTwelve({ at, T, CUT }) {
    const t0 = CUT[4], F = this.F;
    const tJan = at('S04.01', 'in January 2002'), tRoll = at('S04.01', 'a single roll'), tKm = at('S04.01', '1.2 kilometres');
    const tLaid = at('S04.01', 'laid it out'), tEnd1 = at('S04.01', 'the floor', 'end');
    const tHours = at('S04.02', 'eight hours'), t12 = at('S04.02', 'fold number 12'), tRule = at('S04.02', 'the seven-fold rule');
    const t2011 = at('S04.03', 'in 2011'), tMore = at('S04.03', 'one more fold'), t16 = at('S04.03', '16 kilometres');
    const L0 = F.ROLL_2002_M, L16 = F.TAPE_2011_M, TW = 0.11;
    const tU0 = tRoll - 0.3, tU1 = tEnd1 + 0.2;                       // unrolling
    const tF0 = tEnd1 + 0.5, tF12 = t12 + 0.3, dt = (tF12 - tF0) / 12; // twelve folds (time-lapse)
    const tC0 = tRule + 0.2;                                           // comparison
    const big = T.make(250), lbl = T.make(64, PAL.dim), yr = T.make(200), yr2 = T.make(200), km = T.make(110), lA = T.make(52), lB = T.make(52, PAL.accent);
    const hours = T.make(64, PAL.dim), more = T.make(104);
    return (t) => {
      let view;
      if (t < tF0) {
        // the roll runs out along the floor, the camera rises to see all 1.2 km
        this.only(this.strip, this.roll);
        const x = keyed(t, [[tU0, 0.25], [tU1, L0]], { log: true, fn: ease.inOut });
        const R = 0.055 * Math.sqrt(Math.max(0.06, 1 - x / L0)) + 0.022 * 0;
        this.roll.position.set(x + R, R, 0); this.roll.children[0].rotation.y = -x / 0.04; this.roll.scale.setScalar(Math.max(0.42, R / 0.055));
        this.strip.scale.set(x, 0.0002, TW); this.strip.position.set(x / 2, 0.0001, 0);
        const D = smax(keyed(t, [[t0, 0.75], [tU0, 0.7]], { log: true }), 1.05 * x + 0.3 * x * 0);
        view = { target: [x * 0.5, 0, 0], D, az: -Math.PI / 2 + 0.06, el: keyed(t, [[t0, 0.5], [tU1, 1.25]]) };
        this.lineA.visible = true; this.lineA.material.opacity = clamp01((D - 60) / 200);
        this.lineA.geometry.setPositions([0, 0.0003 * D, 0, x, 0.0003 * D, 0]); this.lineA.material.linewidth = 4;
        this.render(view, { lampScale: Math.max(1, D / 1.2) });
      } else if (t < tC0) {
        // folds: the far end is carried back to the start; each fold halves the length and doubles the layers
        this.only(this.strip, this.top, this.walker, this.lineA);
        const fk = clamp01((t - tF0) / (tF12 - tF0)) * 12, k = Math.min(11, Math.floor(fk)), u = fk - k;
        const Lk = L0 / Math.pow(2, k), walk = 0.35, uc = ramp(u, walk, 1, ease.inOut);
        const b = Lk * (1 - uc / 2), e = Lk * (1 - uc);
        const th = 1e-4 * Math.pow(2, k);                              // true thickness: 0.1 mm per layer
        this.strip.scale.set(b, th, TW); this.strip.position.set(b / 2, th / 2, 0);
        const done = fk >= 12;
        this.top.visible = !done && uc > 0;
        this.top.scale.set(Math.max(1e-4, b - e), th, TW); this.top.position.set((b + e) / 2, th * 1.5, 0);
        // the walker: out to the far end, then carrying it back
        const wx = u < walk ? lerp(Lk * 0.5 * (k > 0 ? 1 : 0) + (k === 0 ? 0 : 0), Lk, ramp(u, 0, walk, ease.inOut)) : e;
        const wxx = done ? 0.6 : (k === 0 && u < walk ? lerp(0, Lk, ramp(u, 0, walk)) : wx);
        this.walker.position.set(wxx, 0, -0.55);
        const dir = u < walk ? 1 : -1;
        this.walker.rotation.y = dir > 0 ? 0 : Math.PI;
        this.walker.userData.walk(wxx * 2.2, done ? 0 : 1);
        const Lshow = done ? L0 / 4096 : Lk;
        const D = keyed(t, [[tF0, 1.05 * L0], [tF12, 5.5]], { log: true, fn: (q) => q });
        view = { target: [Math.min(Lshow, D) * 0.5, 0.3, -0.2], D: Math.max(D, 5.5), az: -Math.PI / 2 + 0.06 + 0.5 * ramp(t, tF0, tF12), el: keyed(t, [[tF0, 1.25], [tF12, 0.75]]) };
        this.lineA.material.opacity = clamp01((view.D - 60) / 200);
        this.lineA.geometry.setPositions([0, 0.0003 * view.D, 0, b, 0.0003 * view.D, 0]); this.lineA.material.linewidth = 4;
        this.render(view, { lampScale: Math.max(1, view.D / 1.2) });
        const kk = Math.floor(fk + 1e-6);
        T.put(big, String(kk), { y: 400, op: win(t, tF0 + 0.2, tC0, 0.25, 0.3) });
        big.style.color = kk >= 12 ? PAL.accent : PAL.ink;
        T.put(lbl, kk === 1 ? 'FOLD' : 'FOLDS', { y: 560, op: win(t, tF0 + 0.2, tC0, 0.25, 0.3) });
      } else {
        // 1.2 km beside 16 km: the camera climbs from the folded stack to see the whole 16 km
        this.only(this.lineA, this.lineB, this.top, this.walker);
        this.top.scale.set(L0 / 4096, 1e-4 * 4096, TW); this.top.position.set(L0 / 8192, 0.2048, 0); this.top.visible = true;
        this.walker.position.set(0.6, 0, -0.55); this.walker.rotation.y = Math.PI; this.walker.userData.walk(0, 0);
        const grow = ramp(t, t16 - 1.2, t16 + 0.5, ease.inOut);
        const xA = keyed(t, [[tC0, 0.3], [t2011, L0]], { log: true });
        const xB = keyed(t, [[t2011 + 0.2, 1], [t16 + 0.6, L16]], { log: true });
        const D = keyed(t, [[tC0, 5.5], [t2011 + 0.2, 1.3 * L0], [t16 + 0.9, 1.35 * L16], [CUT[5], 1.42 * L16]], { log: true });
        const off = Math.max(D * 0.012, 0.25);
        this.lineA.geometry.setPositions([0, 0.002, off, xA, 0.002, off]); this.lineA.material.opacity = 1; this.lineA.material.linewidth = 10;
        this.lineB.geometry.setPositions([0, 0.002, -off, Math.max(xB, 0.01), 0.002, -off]); this.lineB.material.opacity = ramp(t, t2011, t2011 + 0.3); this.lineB.material.linewidth = 10;
        this.lineB.visible = t > t2011;
        view = { target: [Math.max(xA, xB) * 0.5, 0, 0], D, az: -Math.PI / 2 + 0.06, el: keyed(t, [[tC0, 0.75], [t2011 + 0.2, 1.3]]) };
        this.render(view, { lampScale: Math.max(1, D / 1.2) });
        const pA = this.screen([xA, 0, off]), pB = this.screen([xB, 0, -off]);
        T.put(lA, `${String(L0 / 1000).replace(/\.0$/, '')} km`, { x: pA.x + 105, y: pA.y, op: win(t, tC0 + 0.6, CUT[5] + 1) });
        T.put(lB, `${commas(L16 / 1000)} km`, { x: pB.x - 95, y: pB.y, op: win(t, t16 - 0.2, CUT[5] + 1) });
        T.put(yr2, String(F.YEAR_2011), { y: 400, op: win(t, t2011 - 0.1, CUT[5] + 1) });
        T.put(more, `<span style="color:${PAL.accent}">${F.FOLDS_2011}</span> FOLDS`, { y: 580, op: win(t, tMore, CUT[5] + 1) });
      }
      T.put(yr, `JANUARY ${F.YEAR_RECORD}`, { y: 400, op: win(t, tJan - 0.1, tF0 + 0.1, 0.3, 0.3), maxW: 980 });
      T.put(km, `${String(L0 / 1000).replace(/\.0$/, '')} km`, { y: 560, op: win(t, tKm - 0.1, tF0 + 0.1, 0.3, 0.3) });
      T.put(hours, `≈ ${F.HOURS_2002} HOURS`, { y: 1380, op: win(t, tHours - 0.1, tC0, 0.3, 0.3) });
    };
  }
}

const smax = (a, b, p = 4) => Math.pow(Math.pow(a, p) + Math.pow(b, p), 1 / p);
