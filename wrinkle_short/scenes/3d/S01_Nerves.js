// S01_Nerves -- "Instead, your nerves tell the blood vessels under the skin to tighten, so the fingertip shrinks and
// its skin buckles into folds."
// The lifted block turns into the standard view and its folds rewind flat. A NERVE fires pulses up to the BLOOD
// VESSELS (a plexus with a loop under every future valley); the vessels tighten, the dermis sinks a little, and the
// skin on top buckles into folds, valleys right over the loops.
import { ramp, ease, clamp01 } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as F from './lib/finger.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  const finger = F.makeFinger(pal);
  finger.group.position.y = F.LIFT_TIP;
  const water = F.makeWater(pal);
  const cut = F.makePadCut();
  finger.group.add(cut.group);
  const block = F.makeFoldBlock(pal);
  st.scene.add(finger.group, water.group, block.group);

  const nerve = new C.Label(overlay, 'Nerve');
  const vess = new C.Label(overlay, 'Blood vessels');
  const folds = new C.Label(overlay, 'Folds', 'lab acc');
  const mid = Math.floor(block.valleys.length / 2);
  const tTight = [a.tighten - 0.05, a.tighten + 0.9], tSink = [a.shrinks - 0.1, a.shrinks + 0.8];
  const tBuckle = [a.shrinks + 0.4, a.buckles + 0.7];

  const cues = [[0.12, 'rewind', -10], [a.nerves - 0.05, 'ticks', -14, a.tighten - a.nerves + 0.6],
                [tTight[0], 'squeeze', -9], [tBuckle[0], 'creak', -9, tBuckle[1] - tBuckle[0]]];

  return {
    scene: st.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    blurSamples: (t) => (t < 1.2 ? 2 : 1),
    update(t) {
      const target = C.camPath(camera, t, [[0, F.CAMW.lift], [1.25, F.CAMW.blk], [a.tighten - 0.3, F.CAMW.blk],
        [a.shrinks + 0.3, F.CAMW.blk2], [end, F.CAMW.blk2]]);
      st.frame(camera, target);
      // the block settles into the standard view; the finger and the water sink away
      F.liftPose(block, 1 + ramp(t, 0, 1.15, ease.linear));
      const away = ramp(t, 0.1, 0.9);
      finger.group.position.y = F.LIFT_TIP - 4 * ramp(t, 0, 1.1, ease.in);
      finger.set({ wrinkle: 1, opacity: 1 - away });
      cut.set({ draw: 1, alpha: 0, hole: 1 - away });
      water.group.position.y = -4 * ramp(t, 0, 1.1, ease.in);
      water.group.visible = away < 0.999;
      const firing = ramp(t, a.nerves - 0.2, a.nerves + 0.3) * (1 - ramp(t, a.buckles + 0.2, a.buckles + 0.9));
      block.set(t, { wrinkle: Math.max(1 - ramp(t, 0.12, 0.8), ramp(t, ...tBuckle, ease.inOut)),
                     tighten: ramp(t, ...tTight, ease.inOut), sink: ramp(t, ...tSink, ease.inOut), firing });
      const w = (v) => block.inner.localToWorld(v.clone());
      nerve.show(300, 1180, C.env(t, a.nerves - 0.1, a.vessels + 1.0, 0.3, 0.3), camera, w(block.nerveMain.getPointAt(0.3)));
      vess.el.classList.toggle('acc', t > tTight[0]);
      vess.show(720, 330, C.env(t, a.vessels - 0.1, a.shrinks + 0.2, 0.3, 0.3), camera, w(block.loopTop(mid + 1)));
      const top = block.valleys[mid];
      folds.show(720, 330, C.env(t, a.buckles - 0.2, end + 1, 0.3, 0.3), camera, w(C.vec(top, -0.04, C.BLK.front - 0.05)));
    },
  };
}
