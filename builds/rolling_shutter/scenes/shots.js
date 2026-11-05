// scenes/shots.js -- every shot of the Short. Times come from the measured narration (phrase anchors), numbers from facts.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
export const ramp = (t, a, b) => smooth((t - a) / (b - a));
// trapezoidal velocity: accelerate over the first e, cruise, decelerate over the last e (position 0..1)
export function trap(u, e = 0.12) {
  if (u <= 0) return 0; if (u >= 1) return 1;
  const v = 1 / (1 - e);
  if (u < e) return v * u * u / (2 * e);
  if (u < 1 - e) return v * (u - e / 2);
  return 1 - v * (1 - u) ** 2 / (2 * e);
}

import * as THREE from 'three';
import { View } from './view.js';
import { makeStreet, makeDesk, makeGuitar } from './props.js';
import { rtFloat, noMask } from './engine.js';

export function buildShots(ctx) {
  const { studio, ov, data, F, ROWS, renderer, comp, env } = ctx;
  const S = Object.fromEntries(data.sentences.map((s) => [s.id, s]));
  // the moment a phrase starts, by its share of the sentence's characters
  const at = (id, phrase) => {
    const s = S[id]; const i = s.text.indexOf(phrase);
    if (i < 0) throw new Error(`phrase not found: ${id} "${phrase}"`);
    return s.start + (s.end - s.start) * (i / s.text.length);
  };
  const cues = [];
  const cue = (t, name, v = 1) => cues.push([+t.toFixed(3), name, v]);
  const shots = [];
  const fmt1 = (x) => x.toFixed(1);


  const KP = F.K_PHOTO, SW = F.SWEEP_S;
  const passK = (k, extra = {}) => ({ k, rate: k / SW, phase: 0, blades: 3, hubMask: 0.5, ...extra });   // sweep fixed at 1/70 s
  const P0 = passK(KP);                                   // the hook's picture: the real photo's 2.39 turns per sweep
  const V0 = 290;                                         // hook / loop scan speed, rows per second on screen
  const R0 = 600;                                         // rows already read at the first frame
  const NFR = Math.round(data.duration * 60), T_LAST = (NFR - 1) / 60;
  const neutralize = (root, keep) => root.traverse((o) => { if (o.isMesh && !keep(o)) noMask(o.material); });

  // ------------------------------------------------------------------ S00 The hook
  {
    const t0 = 0, t1 = S['S00.02'].end + 0.4;
    const tRev = at('S00.01', 'even though') - 0.7, tFr = at('S00.01', 'and that') - 0.2;
    const ang = new THREE.PerspectiveCamera(30, ctx.W / ctx.H, 0.5, 80);
    ang.position.set(6.0, 2.1, 9.0); ang.lookAt(0, 0.85, 0);
    const rtAng = rtFloat(ctx.W, ctx.H, 4);
    cue(0, 'sweep_on'); cue(tRev, 'reveal'); cue(tFr, 'freeze');
    shots.push({ id: 'S00', t0, t1, render(t) {
      const scan = Math.min(ROWS, R0 + V0 * t);
      const tsLive = (R0 + V0 * t) / ROWS * (P0.k / P0.rate);         // the true propeller keeps turning at the slowed rate
      const u = ramp(t, tRev, tRev + 1.5) * (1 - ramp(t, tFr, tFr + 1.4));
      const z = ramp(t, tFr, tFr + 1.4);
      if (u > 0.001) studio.drawFrom(ang, rtAng, P0, tsLive, { gain: u });
      const s = lerp(1, 0.5, u) * lerp(1, 1.2, z) * (1 + 0.03 * ramp(t, tFr + 1.4, t1));
      const cy = lerp(ctx.HUB_Y, 505, u);
      const vy = lerp(ctx.HUB_Y, 560, z);
      studio.draw({ pass: P0, scan, ghost: 0, line: 1 - ramp(t, 3.0, 3.6), amberLen: 1e6, cut: u, clear: u <= 0.001,
        disp: [540, lerp(cy, ctx.HUB_Y - 40, z), s, 1], dispView: [540, vy] });
    } });
  }

  // ------------------------------------------------------------------ S01 No such thing as one instant
  {
    const t0 = S['S00.02'].end + 0.4, t1 = S['S01.02'].end + 0.4;
    const st = makeStreet(env);
    neutralize(st.scene, (o) => { let p = o; while (p) { if (p === st.car) return true; p = p.parent; } return false; });
    st.car.traverse((o) => o.layers.enable(2));
    const fov = 2 * Math.atan(960 / 405 * Math.tan(Math.atan(2.1 / 5.5))) * 180 / Math.PI;
    const cam = new THREE.PerspectiveCamera(fov, ctx.W / ctx.H, 0.1, 200);
    cam.position.set(0, 0.85, 3.5); cam.lookAt(0, 0.85, -2);
    const RECT = [0, 555, 1080, 810];
    const T = F.VIDEO_SWEEP_S, v = F.CAR_KMH / 3.6;
    const view = new View(renderer, comp, { scene: st.scene, cam, capRect: RECT, view: [ctx.W, ctx.H], movingLayer: 2,
      pose: (ts) => st.car.drive(v * ts) });
    const PI = { T: 0, t0: -T / 2 }, PS = { T, t0: -T / 2 };
    const tI = at('S01.01', 'one single instant') + 0.25, tClr = at('S01.01', 'but most') - 0.1;
    const tP0 = at('S01.01', 'one row at a time') - 0.2, tP1 = S['S01.01'].end + 0.2;
    const tG = at('S01.02', 'but it does mean');
    cue(tI, 'shutter'); cue(tP0, 'sweep_start'); cue(tP1, 'sweep_end');
    shots.push({ id: 'S01', t0, t1, wipe: { from: 'S00', a: t0, b: t0 + 0.9 }, render(t) {
      let ts;
      if (t < tI) ts = lerp(-8 / v, -T / 2, 1 - (1 - clamp((t - t0) / (tI - t0))) ** 3);
      else ts = -T / 2 + clamp((t - tP0) / (tP1 - tP0)) * T;
      const scan = clamp((t - tP0) / (tP1 - tP0)) * RECT[3];
      const inst = t >= tI && t < tP0;
      const o = inst ? { pass: PI, scan: RECT[3], capGain: 1 - ramp(t, tClr, tClr + 0.5), line: 0 }
        : { pass: PS, scan, line: ramp(t, tP0 - 0.3, tP0) * (1 - ramp(t, tP1 + 0.5, tP1 + 1.0)), ghost: 0.5 * ramp(t, tG, tG + 0.8) };
      view.draw({ ...o, ts, outside: 0.07, amberLen: 420 }, ctx.out);
      const ms = (r) => `${(r / RECT[3] * T * 1000).toFixed(1)} MS`;
      if (!inst && t >= tP0 - 0.3) {
        ov.text('s01ro', ms(scan), { x: 1040, y: RECT[1] + scan - 26, size: 38, align: 'right', op: ramp(t, tP0 - 0.3, tP0) });
        ov.text('s01top', ms(0), { x: 1040, y: RECT[1] + 26, size: 38, align: 'right', op: ramp(t, tP0 + 0.6, tP0 + 1.0) * clamp(scan / 60) });
      }
    } });
  }
  // ------------------------------------------------------------------ S02 Drawing the banana
  {
    const rate = F.RATE_HZ, K = F.K_S02;
    const PA = { k: K, rate, phase: 0, blades: 1 };            // one blade, pointing straight up at row 0
    const PB = { k: K, rate, phase: 0, blades: 3 };
    const TA = K / rate;
    const t0 = S['S01.02'].end + 0.4, t1 = S['S02.03'].end + 0.4;
    const tPre = t0 + 0.6, tUp = at('S02.01', 'imagine one blade') + 0.5;
    const tGo = at('S02.01', 'because the first rows') - 0.15;
    const tEndA = at('S02.02', 'a straight blade turns') + 0.2;
    const tScrub = at('S02.02', 'even though at every');
    const tB = at('S02.03', 'For example');
    const tRpm = at('S02.03', '2,400') - 0.15, tHz = at('S02.03', 'turns 40') - 0.1, tSw = at('S02.03', 'so if your phone') - 0.1;
    const tB0 = at('S02.03', 'a seventieth') + 0.2, tB1 = at('S02.03', 'before the picture is finished') + 0.7;
    const A = 0.8 / rate;                                          // pre-roll: the blade turns slowly and comes to rest pointing up
    const rowScrub = 470;
    cue(tGo, 'sweep_start'); cue(tEndA, 'sweep_end'); cue(tRpm, 'text'); cue(tHz, 'text'); cue(tSw, 'text'); cue(tB0, 'sweep_start'); cue(tB1, 'sweep_end');
    shots.push({ id: 'S02', t0, t1, wipe: { from: 'S01', a: t0, b: t0 + 0.9 }, render(t) {
      // pass A: one blade, very slow
      const uA = trap((t - tGo) / (tEndA - tGo), 0.1);
      let scanA = uA * ROWS;
      let ts;
      if (t < tPre) ts = -A - (tPre - t) * (2 * A / (tUp - tPre));
      else if (t < tUp) ts = -A * (1 - (t - tPre) / (tUp - tPre)) ** 2;
      else if (t < tGo) ts = 0;
      else if (t < tEndA) ts = scanA / ROWS * TA;
      else ts = lerp(TA, rowScrub / ROWS * TA, ramp(t, tScrub - 0.3, tScrub + 2.2));
      const toGhost = ramp(t, tGo - 0.9, tGo - 0.1);
      const lineA = ramp(t, tUp - 0.2, tUp + 0.4) * (1 - ramp(t, tEndA + 0.3, tEndA + 0.9));
      if (t < tB + 0.4) {
        const ghostOut = 1 - ramp(t, tB - 0.2, tB + 0.4);
        studio.draw({ pass: PA, scan: scanA, ghostTs: ts, live: 1 - toGhost, ghost: 0.42 * toGhost * ghostOut, line: lineA, amberLen: 1e6 });
      } else {
        // pass B: all three blades at the same 0.57 turns per sweep, over the one-blade picture
        const uB = (t - tB0) / (tB1 - tB0);
        const scanB = clamp(uB) * ROWS;
        const tsB = Math.min(uB, 1) * TA;
        const gIn = ramp(t, tB + 0.4, tB + 1.4);
        const lineB = ramp(t, tB0 - 0.4, tB0) * (1 - ramp(t, tB1 + 0.3, tB1 + 0.9));
        studio.draw({ pass: PB, prev: PA, scan: scanB, ghostTs: tsB, ghost: 0.42 * gIn, line: lineB, amberLen: 1e6,
          prevAmber: 1 - 0.75 * ramp(t, tB, tB + 1.2) });
      }
      // the numbers, one idea at a time, below the propeller
      const y1 = 1300, y2 = 1412;
      const rpmOp = ramp(t, tRpm, tRpm + 0.35) * (1 - ramp(t, tSw - 0.3, tSw));
      ov.text('s02rpm', `${F.RPM.toLocaleString('en-US')} RPM`, { y: y1, size: 112, op: rpmOp });
      ov.text('s02hz', `= ${F.RATE_HZ} TURNS A SECOND`, { y: y2, size: 64, op: ramp(t, tHz, tHz + 0.35) * (1 - ramp(t, tSw - 0.3, tSw)) });
      ov.text('s02sw', `1/${Math.round(1 / F.SWEEP_S)} SECOND SWEEP`, { y: y1, size: 92, op: ramp(t, tSw, tSw + 0.35) });
      // ring: the fraction of a turn the blade has made since the sweep began (= k x rows read / rows)
      const frac = F.K_S02 * clamp((t - tB0) / (tB1 - tB0));
      const ringOp = ramp(t, tB0 - 0.5, tB0);
      const pct = Math.round(frac * 100);
      const label = `${pct}% OF A TURN`;
      const tw = 0.6 * 72 * label.length;                         // approximate width, for centring ring + label as one group
      const gx = 540 - (112 + 28 + tw) / 2;
      ov.ring('s02ring', { x: gx + 56, y: y2, r: 46, w: 11, f: frac, op: ringOp });
      ov.text('s02pct', label, { x: gx + 112 + 28, y: y2, size: 72, op: ringOp, align: 'left' });
    } });
  }


  // ------------------------------------------------------------------ S03 The floating pieces
  {
    const t0 = S['S02.03'].end + 0.4, t1 = S['S03.02'].end + 0.4;
    const P3 = passK(KP, { mask: [1, 0.5, 0.5], hubMask: 0 });
    const PB = { k: F.K_S02, rate: F.RATE_HZ, phase: 0, blades: 3 };
    const T = P3.k / P3.rate;
    const tP0 = at('S03.01', 'because a blade') - 0.2, tP1 = at('S03.01', 'so it gets caught') + 1.0;
    const tQ0 = S['S03.02'].start - 0.1, tQ1 = S['S03.02'].end + 0.2;
    let slices = null;
    // the tracked blade's separate slices, read back from the capture itself (alpha 1 = tracked blade)
    const findSlices = () => {
      const rt = studio.capture(P3);
      const w = rt.width, h = rt.height, buf = new Uint16Array(w * h * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      const S4 = 4, cw = Math.floor(1080 / S4), ch = Math.floor(1440 / S4);
      const on = new Uint8Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const gy = h - 1 - (y * S4 + 2) * 2, gx = (x * S4 + 2) * 2;
        on[y * cw + x] = THREE.DataUtils.fromHalfFloat(buf[(gy * w + gx) * 4 + 3]) > 0.8 ? 1 : 0;
      }
      const lab = new Int32Array(cw * ch).fill(-1), comps = [];
      for (let i = 0; i < on.length; i++) {
        if (!on[i] || lab[i] >= 0) continue;
        const c = { n: 0, r0: 1e9, r1: -1, x0: 1e9, x1: -1, y0: 0, y1: 0, sx: 0, sr: 0 }, st = [i]; lab[i] = comps.length;
        while (st.length) {
          const j = st.pop(), x = j % cw, y = (j / cw) | 0;
          c.n++; c.r0 = Math.min(c.r0, y); c.r1 = Math.max(c.r1, y); if (x > c.x1) { c.x1 = x; c.y1 = y; } if (x < c.x0) { c.x0 = x; c.y0 = y; } c.sx += x; c.sr += y;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) continue;
            const k = yy * cw + xx; if (on[k] && lab[k] < 0) { lab[k] = comps.length; st.push(k); }
          }
        }
        comps.push(c);
      }
      slices = comps.filter((c) => c.n > 40).map((c) => {
        const rm = c.sr / c.n * S4;
        // label at the slice's right end, on its middle row
        let xr = -1; const ym = Math.round(c.sr / c.n);
        for (let x = 0; x < cw; x++) if (lab[ym * cw + x] >= 0 && comps[lab[ym * cw + x]] === c) xr = x;
        const right = c.x1 * S4 - 540 > 540 - c.x0 * S4;
        return { r0: c.r0 * S4, r1: c.r1 * S4, rm, t: rm / ROWS * T, right,
          x: Math.min(930, Math.max(150, c.sx / c.n * S4)), y: 240 + c.r0 * S4 - 30 };
      }).sort((a, b) => a.t - b.t);
      window.__slices = slices;
    };
    cue(tP0, 'sweep_start'); cue(tP1, 'sweep_end');
    shots.push({ id: 'S03', t0, t1, render(t) {
      if (!slices) findSlices();
      const uP = (t - tP0) / (tP1 - tP0);
      const scan = clamp(uP) * ROWS;
      let ts = uP * T;
      if (t > tQ0 && slices.length) {                         // replay: the tracked blade shown at each slice's own moment
        const q = clamp((t - tQ0) / (tQ1 - tQ0)) * slices.length;
        const i = Math.min(slices.length - 1, Math.floor(q)), f = smooth((q - i) * 3);
        const a = i === 0 ? Math.min(uP, 1) * T : slices[i - 1].t;
        ts = lerp(i === 0 ? T : slices[i - 1].t, slices[i].t, i === 0 ? smooth(q * 3) : f);
      }
      const tr = ramp(t, t0 + 0.6, t0 + 1.6);
      studio.draw({ pass: P3, prev: PB, scan, ghostTs: ts, ghost: 0.42, track: tr, liveMask: [1, 0.5, 0.5], amberLen: 1e6,
        line: ramp(t, tP0 - 0.4, tP0) * (1 - ramp(t, tP1 + 0.3, tP1 + 0.9)), prevAmber: 0.25 });
      const qi = t > tQ0 ? Math.min(slices.length - 1, Math.floor(clamp((t - tQ0) / (tQ1 - tQ0)) * slices.length)) : -1;
      slices.forEach((sl, i) => {
        const op = ramp(scan, sl.r1 + 10, sl.r1 + 60) * (qi < 0 ? 1 : i === qi ? 1 : 0.4);
        ov.text('s03l' + i, `${(sl.t * 1000).toFixed(1)} MS`, { x: sl.x, y: sl.y, size: 40, op });
      });
    } });
  }

  // ------------------------------------------------------------------ S04 Try it: a desk fan, then a guitar string
  {
    const t0 = S['S03.02'].end + 0.4, tG = S['S04.01'].end + 0.2, t1 = S['S04.02'].end + 0.4;
    const dk = makeDesk(env);
    neutralize(dk.scene, (o) => o === dk.fan.userData.rotor || o === dk.screen);
    const wcam = new THREE.PerspectiveCamera(34, ctx.W / ctx.H, 0.02, 30);
    const SV = [520, 1150];
    const screenRT = rtFloat(SV[0], SV[1], 0);
    dk.screenMat.map = screenRT.texture; dk.screenMat.color.setScalar(1.0); dk.screenMat.needsUpdate = true;
    const phonePos = new THREE.Vector3(0.0, -0.109, 1.2);   // framed so phone and fan both sit inside the middle 3:4, above the captions
    const fanC = new THREE.Vector3(0, 0.0, 0);   // the phone's camera (on its centre line) aims at the fan's hub
    const setPhone = (roll) => {
      dk.phone.position.copy(phonePos);
      dk.phone.lookAt(phonePos.clone().multiplyScalar(2).sub(fanC));
      dk.phone.rotateZ(roll);
      dk.phone.updateMatrixWorld(true);
    };
    dk.pcam.aspect = SV[0] / SV[1]; dk.pcam.updateProjectionMatrix();
    const pview = new View(renderer, comp, { scene: dk.scene, cam: dk.pcam, capRect: [0, 0, SV[0], SV[1]], view: SV,
      pose: (ts, p) => { dk.fan.spin(2 * Math.PI * F.FAN_HZ * ts); setPhone(p ? p.roll : 0); } });
    const rtW = rtFloat(ctx.W, ctx.H, 4);
    const T = F.VIDEO_SWEEP_S, D = 2.4;
    const tA0 = at('S04.01', 'if you film it') + 0.1, tA1 = tA0 + D;
    const tR0 = Math.max(at('S04.01', 'turn your phone sideways'), tA1 + 0.25), tR1 = tR0 + 1.1;
    const tB0 = Math.max(tR1 + 0.15, at('S04.01', 'the bend changes') - 0.2), tB1 = tB0 + D;
    const tsOf = (t) => (t - tA0) / D * T;
    const FA = { T, t0: 0, roll: 0 }, FB = { T, t0: tsOf(tB0), roll: Math.PI / 2 };
    // guitar
    const gt = makeGuitar(env);
    neutralize(gt.scene, (o) => o === gt.lowE);
    const gcam = new THREE.PerspectiveCamera(2 * Math.atan(0.08 / 0.25) * 180 / Math.PI, ctx.W / ctx.H, 0.01, 10);
    gcam.position.set(0, 0.012, 0.25); gcam.lookAt(0, 0.012, 0);
    const AMP = 0.0026, DG = 5.0;
    const tG0 = at('S04.02', 'which can look like') - 0.4, tG1 = tG0 + DG, tPluck = tG0 - 1.4;
    const gts = (t) => (t - tG0) / DG * T;
    const gview = new View(renderer, comp, { scene: gt.scene, cam: gcam, capRect: [0, 240, 1080, 1440], view: [ctx.W, ctx.H],
      pose: (ts) => { const a = ts < gts(tPluck) ? 0 : AMP; gt.lowE.material.userData.u.uDisp.value = a * Math.cos(2 * Math.PI * F.E2_HZ * (ts - gts(tPluck))); } });
    const GS = { T, t0: gts(tG0) };
    cue(tA0, 'sweep_start'); cue(tR0, 'turn'); cue(tB0, 'sweep_start'); cue(tPluck, 'pluck'); cue(tG0, 'sweep_start');
    shots.push({ id: 'S04', t0, t1, wipe: { from: 'S03', a: t0, b: t0 + 0.9 }, wipe2: { from: 'S04', at: tG - 0.02, a: tG, b: tG + 0.9 }, render(t) {
      if (t < tG) {
        const roll = Math.PI / 2 * smooth((t - tR0) / (tR1 - tR0));
        const inB = t >= tB0 - 0.4;
        const pass = inB ? FB : FA, a = inB ? tB0 : tA0, b = inB ? tB1 : tA1;
        const scan = clamp((t - a) / (b - a)) * SV[1];
        pview.draw({ pass, prev: inB ? FA : null, prevAmber: 0, scan, ts: tsOf(t), line: ramp(t, a - 0.3, a) * (1 - ramp(t, b + 0.2, b + 0.6)) * (inB || t < tR0 ? 1 : 0),
          amberLen: 420, lineW: 4, linearOut: 1 }, screenRT, SV);
        if (window.SHOWSCREEN === 2) { renderer.setRenderTarget(null); renderer.setViewport(0, 0, 1080, 1920); dk.pcam.aspect = 1080 / 1920; dk.pcam.updateProjectionMatrix(); setPhone(inB ? Math.PI / 2 : 0); renderer.render(dk.scene, dk.pcam); console.log('readback pcam', JSON.stringify(dk.pcam.getWorldPosition(new THREE.Vector3())), JSON.stringify(dk.pcam.getWorldDirection(new THREE.Vector3()))); return; }
        if (window.SHOWSCREEN) { pview.draw({ pass, prev: inB ? FA : null, prevAmber: 0, scan, ts: tsOf(t), line: 1, amberLen: 420, lineW: 4 }, null, SV); return; }
        // pose the live world (the same fan, the phone at its current roll)
        dk.fan.spin(2 * Math.PI * F.FAN_HZ * tsOf(t)); setPhone(roll);
        const push = ramp(t, t0, tG);
        wcam.position.set(0.012, 0.03, lerp(1.98, 1.93, push)); wcam.lookAt(0.012, -0.199, 0);
        renderer.setRenderTarget(rtW); renderer.setClearColor(0, 1); renderer.clear(); renderer.render(dk.scene, wcam);
        comp.draw({ tBg: rtW.texture, tProp: pview.empty.texture, tCap: null, showLine: 0 }, ctx.out, true);
      } else {
        const scan = clamp((t - tG0) / DG) * 1440;
        gview.draw({ pass: GS, scan, ts: gts(t), line: ramp(t, tG0 - 0.3, tG0) * (1 - ramp(t, tG1 + 0.2, tG1 + 0.7)), amberLen: 1e6, lineW: 3 }, ctx.out);
      }
    } });
  }

  // ------------------------------------------------------------------ S05 Reading the bend
  {
    const t0 = S['S04.02'].end + 0.4, t1 = data.duration + 1;
    const tC0 = t0 + 1.0, tC1 = at('S05.01', 'which is how many') + 1.2;
    const tD0 = at('S05.02', 'and worked backwards'), tD1 = at('S05.02', 'finding that') + 1.6;
    const tU0 = at('S05.02', 'which was then enough') - 0.2, tU1 = S['S05.02'].end + 0.3;
    const tLoop0 = T_LAST - R0 / V0;
    const tF0 = tLoop0 - 1.5;
    const PSTR = passK(1e-9, { rate: KP / SW, phase: 2 * Math.PI * KP * 0.5 });   // one instant: the middle of the sweep
    const kOf = (t) => {
      if (t < tD0) return 0.1 * 50 ** trap((t - tC0) / (tC1 - tC0), 0.2);
      return 5 * (KP / 5) ** trap((t - tD0) / (tD1 - tD0), 0.3);
    };
    for (let i = 0; i < 40; i++) cue(lerp(tC0, tC1, i / 40), 'tick', 1);
    cue(tU0, 'sweep_start'); cue(tLoop0, 'sweep_on');
    shots.push({ id: 'S05', t0, t1, wipe: { from: 'S04', a: t0, b: t0 + 0.8 }, render(t) {
      const numOp = ramp(t, tC0 - 0.4, tC0) * (1 - ramp(t, at('S05.03', 'because if you know') - 0.5, at('S05.03', 'because if you know')));
      if (t < tU0) {
        const k = t < tC0 ? 0.1 : kOf(t);
        const kk = t >= tD1 ? KP : Math.round(k * 1000) / 1000;
        const pass = kk === KP ? P0 : passK(kk, { volatile: true });
        studio.draw({ pass, scan: ROWS, line: 0, amberLen: 1e6, ghost: 0 });
        ov.text('s05k', kk.toFixed(1), { y: 1318, size: 168, op: numOp });
      } else if (t < tLoop0) {
        const u = trap((t - tU0) / (tU1 - tU0), 0.15);
        const fade = 1 - ramp(t, tF0, tLoop0 - 0.1);
        studio.draw({ pass: P0, scan: ROWS * (1 - u), prev: PSTR, prevAmber: 0, prevGain: fade, line: ramp(t, tU0 - 0.3, tU0) * (1 - ramp(t, tU1 + 0.2, tU1 + 0.7)),
          amberLen: 1e6, ghost: 0 });
        ov.text('s05k', KP.toFixed(1), { y: 1318, size: 168, op: numOp });
      } else {
        const scan = V0 * (t - tLoop0);                            // the hook's pass again: the last frame is the first
        studio.draw({ pass: P0, scan, ghost: 0, line: 1, amberLen: 1e6 });
      }
      ov.text('s05sub', 'TURNS PER SWEEP', { y: 1436, size: 54, op: numOp });
      ov.text('s05sim', 'our simulation', { y: 300, size: 36, color: '#a8a6a1', op: ramp(t, tD0, tD0 + 0.5) * (1 - ramp(t, tU1 + 1.5, tU1 + 2.2)) });
    } });
  }
  shots.sort((a, b) => a.t0 - b.t0);
  return { shots, cues };
}
