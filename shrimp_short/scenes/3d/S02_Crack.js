// S02_Crack -- "Then the bubble collapses with a crack loud enough to stun or even kill a small fish."
// Slow motion, pulled back to show the fish: the bubble collapses (the claw is already shut), a SHOCK WAVE races out
// and hits the fish, which jolts, rolls over and sinks (STUNNED).
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
  sea.scene.add(bed.group, shrimp.group, fish.group);
  shrimp.claw.add(fx.group);
  const L = S.heroLayout(shrimp);

  const tCol = [a.collapses - 0.05, a.collapses + 0.4];     // the collapse (slow motion)
  const t0 = tCol[1];                                       // the shock wave leaves
  const SPEED = 0.75;                                       // shock wave, profile units per second (slowed down)
  const fishP = L.bub.clone().addScaledVector(L.dir, 0.72).add(S.vec(0.0, 0.26, 0.0));
  const dFish = fishP.distanceTo(L.bub) / S.CS;
  const tHit = t0 + dFish / SPEED;
  const away = fishP.clone().sub(L.bub).normalize();
  const slow = new C.Label(overlay, 'Slow motion', 'lab dim');
  const lShock = new C.Label(overlay, 'Shock wave', 'lab acc');
  const lStun = new C.Label(overlay, 'Stunned', 'lab');

  const cues = [[0, 'amb', -18, end], [tCol[0], 'collapse', -6], [t0, 'crack', -4], [tHit, 'thud', -8],
                [t0 + 0.05, 'bubbles', -15]];

  const side = { p: shrimp.clawPoint(1.36, -0.45, 2.85), t: shrimp.clawPoint(1.04, -0.01, 0) };
  const wide = { p: L.bub.clone().add(S.vec(0.3, 0.05, 3.4)), t: L.bub.clone().lerp(fishP, 0.32).add(S.vec(0.0, 0.0, 0)) };
  const wide2 = { p: L.bub.clone().add(S.vec(0.45, 0.0, 3.6)), t: L.bub.clone().lerp(fishP, 0.55).add(S.vec(0.0, -0.08, 0)) };
  const px = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920 }; };

  return {
    scene: sea.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.sea_deep, grain: 0.03, vignette: 0.34, exposure: 1.05 },
    blurSamples: () => 1,
    update(t) {
      const tgt = S.camPath(camera, t, [[0, side], [1.0, wide], [end, wide2]]);
      const kick = t > t0 ? Math.exp(-(t - t0) * 7) : 0;
      if (kick > 0.001) {
        camera.position.x += 0.03 * kick * Math.sin(t * 80);
        camera.position.y += 0.025 * kick * Math.sin(t * 67 + 1);
        camera.updateMatrixWorld();
      }
      sea.update(t, camera, tgt);
      shrimp.set({ time: t, open: 0, cut: 0, antennae: false });
      const tc = t - t0;
      const r = S.BUB_R * (1 - ease.in(clamp01((t - tCol[0]) / (tCol[1] - tCol[0]))));
      fx.set({
        time: t, jet: 0.6 * (1 - ramp(t, 0, 0.9)), jetLen: 0.72, r, wob: 0.035 + 0.08 * ramp(t, tCol[0], tCol[1]),
        shockR: tc > 0 ? tc * SPEED : 0, shockOp: tc > 0 ? Math.min(1, 1.6 - tc * 0.45) * ramp(tc, 0, 0.06) : 0,
        flashA: tc > 0 ? 0.7 * Math.exp(-tc * 6) : 0, flashS: 0.7, debrisT: tc > 0 ? tc * 0.6 : -1,
      });

      // the fish: hovering, unaware; then jolted, rolled over, sinking
      const hit = clamp01((t - tHit) / 0.6);
      const p = fishP.clone();
      p.y += 0.02 * Math.sin(t * 2.3);
      if (t > tHit) {
        p.addScaledVector(away, 0.3 * ease.out(hit));
        p.y -= 0.1 * Math.max(0, t - tHit - 0.4);
      }
      fish.group.position.copy(p);
      fish.group.rotation.set(0, L.face + 0.3 * Math.sin(Math.PI * hit), 0.25 * Math.sin(Math.PI * hit));
      fish.set({ phase: t * 9, amp: 0.035, stun: ramp(t, tHit, tHit + 0.9, ease.out) });

      slow.show(540, 300, C.env(t, -1, end, 0.3, 0.2));
      const sp = shrimp.clawPoint(S.BUB.x + Math.max(tc * SPEED, 0) * 0.7, S.BUB.y + Math.max(tc * SPEED, 0) * 0.7, 0);
      const ss = px(sp);
      lShock.show(Math.min(Math.max(ss.x - 120, 200), 880), Math.max(ss.y - 230, 420), C.env(t, a.crack - 0.2, a.stun, 0.3, 0.3), camera, sp);
      const fp = px(fish.group.position);
      lStun.show(Math.min(Math.max(fp.x, 200), 880), Math.min(fp.y + 230, 1250), C.env(t, a.stun - 0.1, end, 0.3, 0.2), camera, fish.group.position);
    },
  };
}
