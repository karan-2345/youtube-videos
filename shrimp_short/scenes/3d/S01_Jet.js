// S01_Jet -- "Instead, it snaps the claw so fast that the jet of water it shoots out tears open a bubble."
// Close on the claw (slow motion): it re-cocks, then the near half lifts away to show the cut faces: the PLUNGER on
// the moving finger and the SOCKET in the fixed one. The claw snaps shut, the plunger rams the socket, a WATER JET
// shoots out, and a BUBBLE tears open inside the jet.
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
  const fx = S.makeSnapFX(pal);
  sea.scene.add(bed.group, shrimp.group);
  shrimp.claw.add(fx.group);
  S.heroLayout(shrimp);

  const tRe = [0.0, 0.7], tCut = [0.55, 1.45], tSnap = [a.fast + 0.0, a.jet - 0.03];
  const tJet = tSnap[1], tBub = [a.tears - 0.15, a.bubble + 0.35];
  const slow = new C.Label(overlay, 'Slow motion', 'lab dim');
  const lPlunger = new C.Label(overlay, 'Plunger', 'lab');
  const lSocket = new C.Label(overlay, 'Socket', 'lab');
  const lJet = new C.Label(overlay, 'Water jet', 'lab');
  const lBub = new C.Label(overlay, 'Bubble', 'lab acc');
  lPlunger.el.style.color = pal.plunger;

  const cues = [[0, 'amb', -18, end], [0.02, 'rewind', -13, 0.65], [tCut[0], 'swish', -12], [tSnap[0], 'swish', -15],
                [tJet, 'click', -6], [tJet + 0.02, 'jet', -9, 1.2], [tBub[0], 'bubble', -8]];

  const view = (cx, cy, d) => ({ p: shrimp.clawPoint(cx + 0.32, cy - 0.5 * d / 2.7, d), t: shrimp.clawPoint(cx, cy, 0) });
  const K = [[0, view(0.6, 0.0, 2.75)], [1.3, view(0.68, -0.02, 2.15)], [tJet - 0.1, view(0.7, -0.02, 2.1)],
             [a.tears - 0.2, view(0.98, -0.02, 2.85)], [end, view(1.04, -0.01, 2.75)]];
  const px = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920 }; };
  const clampX = (x) => Math.min(Math.max(x, 190), 890);

  return {
    scene: sea.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.sea_deep, grain: 0.03, vignette: 0.36, exposure: 1.05 },
    blurSamples: (t) => (t > tSnap[0] && t < tJet + 0.1 ? 3 : 1),
    update(t) {
      shrimp.set({ time: t, open: 0, cut: 0 });                // the claw frame doesn't depend on these
      const tgt = S.camPath(camera, t, K);
      sea.update(t, camera, tgt);
      const open = t < tSnap[0] ? ramp(t, ...tRe, ease.inOut) : 1 - ramp(t, ...tSnap, ease.in);
      const cut = ramp(t, ...tCut, ease.inOut);
      shrimp.set({ time: t, open, cut, antennae: false });
      const tj = t - tJet;
      fx.set({ time: t, jet: tj > 0 ? ramp(tj, 0, 0.12) : 0, jetLen: tj > 0 ? 0.72 * ease.out(clamp01(tj / 1.0)) : 0,
               r: S.BUB_R * ramp(t, ...tBub, ease.out), wob: 0.035 });

      slow.show(540, 300, C.env(t, 0.2, end, 0.3, 0.2));
      const peg = px(shrimp.dactyl.localToWorld(S.vec(S.PEG_X, -0.12, 0.001)));
      const sock = px(shrimp.clawPoint(0.74, -0.065, 0.001));
      lPlunger.show(clampX(peg.x - 60), Math.max(peg.y - 300, 420), C.env(t, tCut[1] - 0.15, a.jet + 0.3, 0.3, 0.3), camera,
        shrimp.dactyl.localToWorld(S.vec(S.PEG_X, -0.12, 0.001)));
      lSocket.show(clampX(sock.x + 40), Math.min(sock.y + 260, 1250), C.env(t, tCut[1] + 0.05, a.jet + 0.3, 0.3, 0.3), camera,
        shrimp.clawPoint(0.74, -0.075, 0.001));
      const jp = shrimp.clawPoint(1.2, -0.03, 0.001), j = px(jp);
      lJet.show(clampX(j.x), Math.min(j.y + 250, 1250), C.env(t, a.jet + 0.1, end, 0.3, 0.2), camera, jp);
      const bp = shrimp.clawPoint(S.BUB.x, S.BUB.y + S.BUB_R * 0.9, 0.001), b = px(bp);
      lBub.show(clampX(b.x - 40), Math.max(b.y - 260, 420), C.env(t, a.bubble - 0.15, end, 0.3, 0.2), camera, bp);
    },
  };
}
