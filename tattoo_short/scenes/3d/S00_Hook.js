// S00_Hook -- "Your skin sheds its outer layer every few weeks, so why doesn't your tattoo shed with it?"
// The forearm with its star. Time-lapse: the outer skin flakes away all over, the star stays. Then a cut line runs
// around the star and a small block of skin lifts out of the arm (it grows into the specimen of S01).
// First frame = S03's last frame (the loop).
import { ramp, ease } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';

export async function setup({ renderer, data }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  const arm = C.makeArm(pal);
  const flakes = C.makeFlakes(pal, 420, 5, C.armSpots, { size: 0.085 });
  const block = C.makeBlock(pal);
  st.scene.add(arm.group, flakes.mesh, block.group);

  const drift = { p: C.CAM.arm.p.clone().lerp(C.CAM.push.p, 0.1), t: C.CAM.arm.t.clone().lerp(C.CAM.push.t, 0.1) };
  const liftT0 = a.withit - 0.1, liftT1 = end - 0.45;

  return {
    scene: st.scene, camera,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    blurSamples: (t) => (t > liftT0 && t < liftT1 ? 2 : 1),
    update(t) {
      const target = C.camPath(camera, t, [[0, C.CAM.arm], [a.why, drift], [a.withit, C.CAM.push], [liftT1, C.CAM.lift]]);
      st.frame(camera, target);
      flakes.update(t, a.sheds - 0.15, a.why + 0.05, 1.25);
      const u = ramp(t, liftT0, liftT1, ease.linear);
      arm.set({ cutU: ramp(t, a.tattoo - 0.4, a.withit - 0.05, ease.inOut), cutAlpha: 1 - ramp(u, 0.05, 0.5),
                holeU: ramp(u, 0.0, 0.15) });
      block.set({ opacity: u > 0 ? 1 : 0 });
      C.blockPose(block, u);
    },
  };
}
