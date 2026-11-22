// S02_Test -- "And that's why a finger with a damaged nerve doesn't wrinkle, which doctors have even used as a nerve
// test."
// Two fingertips dip into the bath. X-ray: a nerve runs down each one. The right one is broken (a cinnabar X) and its
// pulses die at the break. The left pad buckles into folds; the right stays smooth: NO WRINKLES. THE WRINKLE TEST.
import { ramp, ease, lerp } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as F from './lib/finger.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  const water = F.makeWater(pal);
  st.scene.add(water.group);
  const S = 0.78, X = 0.68;
  const fingers = [-X, X].map((x, i) => {
    const f = F.makeFinger(pal), n = F.makeFingerNerve(pal, { gap: i === 1 });
    f.group.add(n.group);
    f.group.scale.setScalar(S);
    f.group.position.x = x;
    st.scene.add(f.group);
    return { f, n, x };
  });
  const tDip = [0.15, 0.75], dipT = 0.42;
  const tX = [a.damaged - 0.1, a.damaged + 0.25], tW = [a.doesnt - 0.25, a.doesnt + 1.0];
  const dmg = new C.Label(overlay, 'Damaged nerve', 'lab acc');
  const none = new C.Label(overlay, 'No wrinkles', 'lab acc');
  const test = new C.Label(overlay, 'The wrinkle test', 'lab big');

  const cues = [[tDip[0] + 0.25, 'plop', -7], [tDip[0] + 0.32, 'plop', -9], [0.8, 'ticks', -15, a.doesnt + 1.2],
                [tX[0] + 0.05, 'snap', -8], [tW[0], 'creak', -10, tW[1] - tW[0]], [a.doctors + 0.1, 'ding', -10]];

  return {
    scene: st.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    blurSamples: (t) => (t > tDip[0] && t < tDip[1] ? 2 : 1),
    update(t) {
      const target = C.camPath(camera, t, [[0, F.CAMW.two], [end, { p: F.CAMW.two.p.clone().lerp(F.CAMW.two.t, 0.05), t: F.CAMW.two.t }]]);
      st.frame(camera, target);
      const tipY = lerp(0.45, -0.95, ramp(t, ...tDip, ease.inOut));
      const xray = ramp(t, 0.55, 1.1);
      fingers.forEach(({ f, n, x }, i) => {
        f.group.position.y = tipY;
        f.set({ wrinkle: i === 0 ? ramp(t, ...tW, ease.inOut) : 0 });
        n.set(t, { opacity: xray, firing: xray, xShow: ramp(t, ...tX, ease.out) });
      });
      water.update(t, fingers.map(({ x }) => ({ x, z: 0, tipY, dipT: t > tDip[0] ? dipT : null, s: S })));
      const right = fingers[1];
      right.f.group.updateMatrixWorld(true);
      const xw = right.n.xMark.getWorldPosition(C.vec(0, 0, 0));
      dmg.show(820, 470, C.env(t, tX[0], end + 1, 0.25, 0.3), camera, xw);
      none.show(800, 1000, C.env(t, a.doesnt + 0.6, end + 1, 0.3, 0.3));
      test.show(540, 300, C.env(t, a.doctors - 0.05, end + 1, 0.3, 0.3));
    },
  };
}
