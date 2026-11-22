// S04_Same -- "And the folds even come back in the same pattern every time, because the blood vessels underneath stay
// in the same place."
// Soak 1: a cinnabar trace is drawn along every fold. The finger lifts out and dries smooth (the trace stays), dips
// again, and the folds come back exactly under the trace: SAME PATTERN. X-ray: the BLOOD VESSELS sit right under the
// valleys and don't move. Then the finger lifts out dry and the camera returns to the opening shot (the loop).
import { ramp, ease, lerp, clamp01 } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as F from './lib/finger.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  const finger = F.makeFinger(pal);
  const water = F.makeWater(pal);
  const trace = F.makeValleyLines(pal.accent, { lift: 0.008, radius: 0.0065, glow: 1.5 });
  const vess = F.makeValleyLines(pal.vessel, { inset: 0.06, lift: 0, radius: 0.012, glow: 1.25 });
  finger.group.add(trace.group, vess.group);
  st.scene.add(finger.group, water.group);

  const tTrace = [0.1, 0.95], tOut = [1.0, 1.5], tDry = [1.05, 1.75], tIn = [1.75, 2.15], tWet = [2.1, 2.75];
  const tX = [a.because, a.because + 0.55], tV = [a.vessels - 0.2, a.vessels + 0.8];
  const tBack = a.vend - 0.2;
  const soak = new C.Label(overlay, 'Soak 1', 'lab');
  const same = new C.Label(overlay, 'Same pattern', 'lab acc');
  const vlab = new C.Label(overlay, 'Blood vessels', 'lab');
  let soakN = 1;

  const cues = [[tTrace[0], 'zip', -13, tTrace[1] - tTrace[0]], [tOut[0] + 0.05, 'drip', -10], [tIn[0] + 0.15, 'plop', -7],
                [tWet[0], 'creak', -11, tWet[1] - tWet[0]], [tWet[1] - 0.05, 'ding', -8], [tX[0], 'swish', -12],
                [tBack + 0.1, 'swish', -8]];

  const tipAt = (t) => {
    let y = -1.15;
    y = lerp(y, 0.2, ramp(t, ...tOut, ease.inOut));
    y = lerp(y, -1.15, ramp(t, ...tIn, ease.inOut));
    y = lerp(y, 0.6, ramp(t, tBack + 0.1, end - 0.5, ease.inOut));
    return y;
  };
  const padCam = (tip) => ({ p: C.vec(0.75, tip + 1.0, 4.4), t: C.vec(0.0, tip + 0.65, 0.0) });

  return {
    scene: st.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    blurSamples: (t) => ((t > tOut[0] && t < tIn[1]) || t > tBack ? 2 : 1),
    update(t) {
      const tipY = tipAt(t);
      const follow = padCam(Math.min(tipY, 0.2));
      const back = ramp(t, tBack, end - 0.25, ease.inOut);
      C.setCam(camera, follow, F.CAMW.c0, back);
      st.frame(camera, F.CAMW.c0.t);
      finger.group.position.y = tipY;
      const wr = Math.max(1 - ramp(t, ...tDry, ease.inOut), ramp(t, ...tWet, ease.inOut)) * (1 - ramp(t, tBack + 0.2, end - 0.5, ease.inOut));
      const xr = ramp(t, ...tX, ease.inOut) * (1 - ramp(t, tBack - 0.3, tBack + 0.3));
      finger.set({ wrinkle: wr, opacity: 1 - 0.55 * xr });
      trace.set({ draw: ramp(t, ...tTrace, ease.inOut), opacity: 1 - ramp(t, tX[0], tX[1] + 0.2) });
      vess.set({ draw: ramp(t, ...tV, ease.inOut), opacity: xr * (0.85 + 0.15 * Math.sin(Math.PI * clamp01((t - a.place + 0.1) / 0.6))) });
      water.update(t, [{ x: 0, z: 0, tipY, dipT: t > tIn[0] ? lerp(tIn[0], tIn[1], 0.4) : -10 }]);
      const n = t > tIn[0] ? 2 : 1;
      if (n !== soakN) { soak.el.textContent = `Soak ${n}`; soakN = n; }
      soak.show(540, 300, C.env(t, -1, tWet[1] - 0.15, 0.25, 0.2));
      same.show(540, 300, C.env(t, tWet[1] - 0.1, tX[0] + 0.2, 0.25, 0.3));
      const vp = finger.group.localToWorld(C.vec(0.0, 0.95, F.fingerR(0.95) * F.FING.sz - 0.06));
      vlab.show(780, 420, C.env(t, a.vessels, tBack, 0.3, 0.3), camera, vp);
    },
  };
}
