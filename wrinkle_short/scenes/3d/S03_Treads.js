// S03_Treads -- "So the wrinkles might be on purpose, working like tire treads to grip wet things, although scientists
// still argue about that."
// Above: a wrinkled fingertip presses on a wet glass marble and the water squeezes out along the grooves. Below: a
// tire rolls on a wet road and its grooves throw the water aside. LIKE TIRE TREADS? Then: STILL DEBATED.
import { ramp, ease, lerp } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as F from './lib/finger.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  const finger = F.makeFinger(pal);
  const marble = F.makeMarble(pal);
  const tire = F.makeTire(pal);
  const FS = 0.9, MY = 1.15;
  finger.group.scale.setScalar(FS);
  finger.group.rotation.y = 1.4;                    // three-quarter: the folded pad and the nail both show
  marble.group.position.y = MY;
  tire.group.position.y = -1.45;
  tire.group.rotation.y = -0.6;                     // three-quarter: the tread and its grooves face us
  st.scene.add(finger.group, marble.group, tire.group);
  const tPress = [0.25, 1.5], tSqueeze = [1.45, a.grip + 0.4];
  const like = new C.Label(overlay, 'Like tire treads?', 'lab');
  const debated = new C.Label(overlay, 'Still debated', 'lab big acc');

  const cues = [[tPress[1] - 0.05, 'squelch', -7], [tSqueeze[0] + 0.2, 'drip', -10], [0.0, 'road', -16, end],
                [a.argue - 0.05, 'thud', -8]];

  return {
    scene: st.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    update(t) {
      const target = C.camPath(camera, t, [[0, F.CAMW.mt], [end, { p: F.CAMW.mt.p.clone().lerp(F.CAMW.mt.t, 0.04), t: F.CAMW.mt.t }]]);
      st.frame(camera, target);
      const touch = MY + 0.42 - 0.02;
      finger.group.position.y = lerp(touch + 1.1, touch, ramp(t, ...tPress, ease.inOut)) - 0.015 * Math.sin(Math.PI * ramp(t, tPress[1], tPress[1] + 0.4));
      finger.set({ wrinkle: 1 });
      marble.set(t, { squeeze: ramp(t, ...tSqueeze, ease.out), spin: 0.6 + 0.15 * ramp(t, tPress[1], end) });
      tire.set(t);
      like.show(540, 985, C.env(t, a.treads - 0.15, end + 1, 0.3, 0.3));
      debated.show(540, 300, C.env(t, a.argue - 0.1, end + 1, 0.25, 0.3));
    },
  };
}
