// S00_Hook -- "The pistol shrimp knocks out fish with a claw that never even touches them."
// A goby swims up to the shrimp at its burrow. The big claw cocks open and snaps: a flash, a shock wave, and the fish
// is knocked back, stunned, without being touched (NO CONTACT). The first frame is also S04's last (the loop).
import { ramp, ease, lerp, clamp01 } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as S from './lib/shrimp.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const sea = S.seaStage(renderer, pal);
  const camera = S.makeCam();
  sea.scene.add(camera);
  const bed = S.makeSeabed(pal, sea.uni);
  const shrimp = S.makeShrimp(pal);
  const fish = S.makeFish(pal);
  const fx = S.makeSnapFX(pal);
  const colony = S.makeColony(pal, sea.uni);       // the neighbours, still (they crackle in S04)
  sea.scene.add(bed.group, shrimp.group, fish.group, colony.group);
  shrimp.claw.add(fx.group);
  const L = S.heroLayout(shrimp);

  const tS = a.knocks - 0.08;                      // the snap
  const tHit = tS + 0.15;                          // the shock wave reaches the fish
  const away = L.hover.clone().sub(L.bub).normalize();
  const name = new C.Label(overlay, 'Pistol shrimp', 'lab');
  const noc = new C.Label(overlay, 'No contact', 'lab acc');
  const gap = overlay.line('rgba(242,235,221,0.95)', 4);
  gap.setAttribute('stroke-dasharray', '4 12');

  const cues = [[0, 'amb', -16, end], [0.62, 'click', -14], [1.3, 'click', -10], [tS, 'crack', -3], [tS + 0.02, 'jet', -12],
                [tHit, 'thud', -10], [tS + 0.15, 'bubbles', -16], [a.never, 'swish', -16]];

  const CAM_A = S.CAM0;
  const CAM_B = { p: S.vec(5.04, 2.42, 4.29), t: S.vec(0.8, 0.5, 0.05) };
  const CAM_C = { p: S.vec(1.6, 1.1, 3.9), t: S.vec(1.15, 0.5, 0.45) };

  return {
    scene: sea.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.sea_deep, grain: 0.03, vignette: 0.32, exposure: 1.05 },
    blurSamples: (t) => (t > tS - 0.02 && t < tS + 0.07 ? 4 : 1),
    update(t) {
      // camera: a slow push-in, a kick on the snap, then in toward the claw (S01 is a close-up of it)
      const tgt = S.camPath(camera, t, [[0, CAM_A], [tS - 0.1, CAM_B], [a.vend - 0.3, CAM_B], [end, CAM_C]]);
      const kick = Math.exp(-Math.max(0, t - tS) * 9) * (t > tS ? 1 : 0);
      if (kick > 0.001) {
        camera.position.x += 0.05 * kick * Math.sin(t * 90);
        camera.position.y += 0.04 * kick * Math.sin(t * 77 + 1);
        camera.updateMatrixWorld();
      }
      sea.update(t, camera, tgt);
      colony.set(t, 0);

      // the claw: relaxed, cocked open, then shut in two frames
      const open = t < tS ? lerp(0.15, 1, ramp(t, 0.55, 1.3, ease.inOut)) : 1 - ramp(t, tS, tS + 0.034, ease.in);
      shrimp.set({ time: t, open, cut: 0 });
      // the snap: jet, bubble, collapse, flash, shock wave, micro-bubbles
      const ts = t - tS;
      const r = ts < 0 ? 0 : (ts < 0.06 ? S.BUB_R * ease.out(ts / 0.06) : S.BUB_R * (1 - ease.in(clamp01((ts - 0.06) / 0.05))));
      const tc = ts - 0.11;                         // the collapse
      fx.set({
        time: t, jet: ts > 0.02 ? 1 - ramp(ts, 0.08, 0.3) : 0, jetLen: 0.5 * ramp(ts, 0.02, 0.07, ease.out), r,
        shockR: tc > 0 ? 3.4 * ease.out(clamp01(tc / 0.4)) : 0, shockOp: tc > 0 ? 1 - ramp(tc, 0.05, 0.4) : 0,
        flashA: tc > 0 ? Math.exp(-tc * 14) : 0, flashS: 0.9, debrisT: tc > 0 ? tc : -1,
      });

      // the fish: swims in, hovers, is knocked back, rolls over and sinks
      const hit = clamp01((t - tHit) / 0.55);
      const p = S.fishApproach(L, t);
      if (t > tHit) {
        p.addScaledVector(away, 0.4 * ease.out(hit));
        p.y -= 0.12 * Math.max(0, t - tHit - 0.3);
      }
      fish.group.position.copy(p);
      fish.group.rotation.set(0, L.face + 0.25 * (1 - ramp(t, 0, 1.4)) + 0.35 * Math.sin(Math.PI * hit), 0.3 * Math.sin(Math.PI * hit));
      fish.set({ phase: t * 11, amp: t < 1.4 ? 0.06 : 0.035, stun: ramp(t, tHit, tHit + 0.7, ease.out) });

      // labels
      name.show(540, 330, C.env(t, a.pistol - 0.2, tS - 0.1, 0.25, 0.15), camera, shrimp.clawPoint(0.35, 0.2).sub(S.vec(0.55, 0, 0)));
      const op = C.env(t, a.never - 0.15, end, 0.3, 0.2);
      noc.show(540, 330, op);
      const s0 = toPx(L.tip, camera), s1 = toPx(L.hover, camera);
      gap.setAttribute('points', `${s0.x},${s0.y} ${lerp(s0.x, s1.x, op)},${lerp(s0.y, s1.y, op)}`);
      gap.setAttribute('opacity', op);
    },
  };
}

function toPx(v, camera) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920 };
}
