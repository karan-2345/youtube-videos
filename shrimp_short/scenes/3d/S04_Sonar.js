// S04_Sonar -- "So when thousands of these shrimp snap at once, their crackle can drown out navy sonar, which really
// happened in World War Two."
// The camera rises off the burrow: a whole colony snapping (tiny flashes across the seabed). It tilts up to a
// submarine pinging overhead; its SONAR screen fills with crackle until the contact is DROWNED OUT (WORLD WAR II).
// Then it dives back to the burrow as a new fish swims in: the last frame is S00's first (the loop).
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
  const colony = S.makeColony(pal, sea.uni);
  const field = S.makeSnapField(pal);
  const sub = S.makeSub(pal);
  sea.scene.add(bed.group, shrimp.group, fish.group, colony.group, field.points, sub.group);
  const L = S.heroLayout(shrimp);
  const sonar = S.makeSonar(camera, pal, { cx: 540, cy: 1010, rad: 205 });
  const SUB0 = S.vec(2.84, 10.0, -9.6);
  sub.group.rotation.set(0.0, -0.35, 0.0);

  const tUp = [a.crackle - 0.6, a.crackle + 0.6], tBack = [a.vend + 0.05, end];
  const lCol = new C.Label(overlay, 'Shrimp colony', 'lab');
  const lSonar = new C.Label(overlay, 'Sonar', 'lab');
  const lDrown = new C.Label(overlay, 'Drowned out', 'lab acc');
  const lWar = new C.Label(overlay, 'World War II', 'lab acc');

  const cues = [[0, 'amb', -17, end], [0.35, 'swish', -14], [0.6, 'crackle', -14, a.vend - 0.2], [tUp[0], 'swish', -14],
                [tUp[1] - 0.2, 'ping', -11], [tUp[1] + 1.2, 'ping', -14], [a.really + 0.3, 'ping', -17],
                [a.war - 0.1, 'thud', -12], [tBack[0], 'swish', -9]];

  const K = [
    [0, { p: S.vec(4.9, 2.9, 5.0), t: S.vec(0.5, 0.45, -0.1) }],
    [tUp[0], { p: S.vec(7.2, 7.4, 11.5), t: S.vec(0.0, 0.3, -5.0) }],
    [tUp[1] + 0.2, { p: S.vec(6.4, 4.0, 5.5), t: S.vec(2.2, 7.6, -9.5) }],
    [tBack[0], { p: S.vec(6.0, 4.3, 5.0), t: S.vec(2.4, 7.7, -9.5) }],
    [end, S.CAM0],
  ];

  return {
    scene: sea.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.sea_deep, grain: 0.03, vignette: 0.32, exposure: 1.05 },
    blurSamples: (t) => (t > tBack[0] && t < end - 0.15 ? 2 : 1),
    update(t) {
      const tau = t - end;                           // ambient time: 0 at the last frame, as at S00's first
      const tgt = S.camPath(camera, t, K);
      sea.update(tau, camera, tgt);
      shrimp.set({ time: tau, open: 0.15, cut: 0 });
      const on = ramp(t, 0.3, 1.3) * (1 - ramp(t, tBack[0] - 0.1, tBack[0] + 0.7));
      colony.set(tau, on);
      field.set(tau, on);
      sub.group.position.copy(SUB0).add(S.vec(0.12 * tau, 0, 0));
      sub.update(tau, ramp(t, tUp[0] + 0.4, tUp[1]) * (1 - ramp(t, tBack[0] - 0.2, tBack[0] + 0.3)));
      const show = ramp(t, a.crackle - 0.1, a.crackle + 0.4) * (1 - ramp(t, tBack[0] - 0.25, tBack[0] + 0.1));
      sonar.update(tau, { show, noise: ramp(t, a.crackle + 0.3, a.drown + 0.35, ease.in), blip: 1 - ramp(t, a.drown, a.sonar + 0.2) });

      // the next fish swims in during the dive back (S00 starts with it here)
      const ft = tau;
      fish.group.visible = ft > -1.7;
      fish.group.position.copy(S.fishApproach(L, ft));
      fish.group.rotation.set(0, L.face + 0.25, 0);
      fish.set({ phase: ft * 11, amp: 0.06, stun: 0 });

      lCol.show(540, 330, C.env(t, a.thousands, tUp[0] + 0.2, 0.3, 0.3));
      lSonar.show(540, 760, C.env(t, a.crackle + 0.2, a.drown + 0.05, 0.3, 0.2));
      lDrown.show(540, 760, C.env(t, a.drown + 0.1, tBack[0] - 0.1, 0.25, 0.25));
      lWar.show(540, 330, C.env(t, a.really + 0.1, tBack[0] + 0.1, 0.3, 0.3));
    },
  };
}
