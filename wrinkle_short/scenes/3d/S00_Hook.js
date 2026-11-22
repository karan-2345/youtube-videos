// S00_Hook -- "When your fingers wrinkle in the bath, it isn't just your skin soaking up water."
// A fingertip dips into the bath; time-lapse: the pad buckles into folds. It lifts out, a cut line runs round a patch
// of the pad and a small block of skin lifts off toward us (it becomes S01's specimen).
// First frame = S04's last frame (the loop).
import { ramp, ease, lerp } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as F from './lib/finger.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  const finger = F.makeFinger(pal);
  const water = F.makeWater(pal);
  const cut = F.makePadCut();
  finger.group.add(cut.group);
  const block = F.makeFoldBlock(pal);
  st.scene.add(finger.group, water.group, block.group);

  const tDip = [0.3, 0.9], tOut = [a.isnt - 0.05, a.isnt + 0.6];
  const dipT = lerp(tDip[0], tDip[1], 0.45);
  const tCut = [tOut[1] + 0.05, a.vend - 0.35], tLift = [a.vend - 0.4, end - 0.3];
  const lapse = new C.Label(overlay, 'Minutes later', 'lab');
  const notJust = new C.Label(overlay, 'Not just water', 'lab acc');

  const cues = [[tDip[0] + 0.3, 'plop', -6], [tDip[1] - 0.1, 'bubbles', -12], [tDip[1] + 0.1, 'creak', -12, a.isnt - tDip[1]],
                [tOut[0] + 0.1, 'drip', -10], [tCut[0], 'zip', -12, tCut[1] - tCut[0]], [tLift[0], 'swish', -8]];

  return {
    scene: st.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    blurSamples: (t) => ((t > tDip[0] && t < tDip[1]) || t > tLift[0] ? 2 : 1),
    update(t) {
      const target = C.camPath(camera, t, [[0, F.CAMW.c0], [tDip[1] + 0.1, F.CAMW.c0], [a.bath + 0.3, F.CAMW.pad],
        [tOut[0], F.CAMW.pad], [tOut[1] + 0.1, F.CAMW.out], [tLift[0], F.CAMW.out], [tLift[1], F.CAMW.lift]]);
      st.frame(camera, target);
      const tipY = lerp(lerp(0.6, -1.15, ramp(t, ...tDip, ease.inOut)), F.LIFT_TIP, ramp(t, ...tOut, ease.inOut));
      finger.group.position.y = tipY;
      finger.set({ wrinkle: ramp(t, tDip[1] + 0.1, a.isnt - 0.15, ease.inOut) });
      water.update(t, [{ x: 0, z: 0, tipY, dipT: t > tDip[0] ? dipT : null }]);
      const u = ramp(t, ...tLift, ease.linear);
      cut.set({ draw: ramp(t, ...tCut, ease.inOut), alpha: 1 - ramp(u, 0.05, 0.5), hole: ramp(u, 0, 0.12) });
      block.set(t, { wrinkle: 1, opacity: u > 0 ? 1 : 0 });
      F.liftPose(block, u);
      lapse.show(540, 300, C.env(t, tDip[1] + 0.1, a.isnt - 0.2, 0.25, 0.3));
      notJust.show(540, 300, C.env(t, a.isnt + 0.05, end + 1, 0.3, 0.3));
    },
  };
}
