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

export function buildShots(ctx) {
  const { studio, ov, data, F, ROWS } = ctx;
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
    shots.push({ id: 'S02', t0, t1, render(t) {
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

  shots.sort((a, b) => a.t0 - b.t0);
  return { shots, cues };
}
