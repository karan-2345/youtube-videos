// S03_Flash -- "And as it collapses, it even flashes with light, which means that for an instant it's nearly as hot
// as the surface of the Sun."
// Extreme close-up (slowed down a lot): the bubble collapses to a point and FLASHES. The flash slides left and the
// Sun's surface glows beside it; two bars compare the temperatures (4,700 C+ estimated vs 5,500 C): NEARLY AS HOT AS
// THE SUN, ESTIMATED.
import { ramp, ease, lerp, clamp01 } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as S from './lib/shrimp.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration, F = data.facts;
  const sea = S.seaStage(renderer, pal);
  const camera = S.makeCam();
  sea.scene.add(camera);
  const bed = S.makeSeabed(pal, sea.uni);
  const shrimp = S.makeShrimp(pal);
  const fx = S.makeSnapFX(pal);
  sea.scene.add(bed.group, shrimp.group);
  shrimp.claw.add(fx.group);
  S.heroLayout(shrimp);
  const sun = S.makeSun(camera, pal, { cx: 780, cy: 610, rad: 150 });

  const tCol = [a.collapses - 0.25, a.flashes - 0.02];      // the slow collapse, ending in the flash
  const tF = tCol[1];
  const tSide = [a.means - 0.35, a.means + 0.45];            // the flash slides left, the Sun comes in
  const tBars = [a.instant - 0.1, a.hot + 0.2];
  const lFlash = new C.Label(overlay, 'Flash of light<span class="sub">slowed down, brightened</span>', 'lab');
  const lBub = new C.Label(overlay, 'Bubble', 'lab');
  const lSun = new C.Label(overlay, "Sun's surface", 'lab');
  const lHot = new C.Label(overlay, 'Nearly as hot as the Sun<span class="sub">estimated</span>', 'lab acc');
  const fmt = (v) => v.toLocaleString('en-US');
  const nBub = new C.Label(overlay, `${fmt(F.bubble_c)} °C+`, 'lab');
  const nSun = new C.Label(overlay, `${fmt(F.sun_c)} °C`, 'lab');
  const bars = [300, 780].map(() => {
    const el = overlay.el('<div class="fill"></div>', 'bar');
    return { el, fill: el.firstChild };
  });
  const hMax = 310;

  const cues = [[0, 'amb', -18, end], [tCol[0], 'collapse', -8], [tF, 'zing', -5], [tF + 0.02, 'crack', -12],
                [tSide[0] + 0.2, 'swish', -14], [tBars[0], 'rise', -12, tBars[1] - tBars[0]], [a.hot, 'ding', -9]];

  const near = { p: shrimp.clawPoint(S.BUB.x + 0.08, S.BUB.y - 0.22, 1.35), t: shrimp.clawPoint(S.BUB.x, S.BUB.y, 0) };
  const closer = { p: shrimp.clawPoint(S.BUB.x + 0.06, S.BUB.y - 0.2, 1.15), t: shrimp.clawPoint(S.BUB.x, S.BUB.y, 0) };
  const left = { p: shrimp.clawPoint(S.BUB.x + 0.2, S.BUB.y - 0.34, 1.3), t: shrimp.clawPoint(S.BUB.x + 0.13, S.BUB.y - 0.13, 0) };
  const px = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920 }; };

  return {
    scene: sea.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.sea_deep, grain: 0.03, vignette: 0.38, exposure: 1.05 },
    blurSamples: () => 1,
    look: (t) => ({ exposure: 1.05 - 0.25 * ramp(t, ...tSide) }),
    update(t) {
      const tgt = S.camPath(camera, t, [[0, near], [tF, closer], [tSide[0], closer], [tSide[1], left], [end, left]]);
      sea.update(t, camera, tgt);
      shrimp.set({ time: t, open: 0, cut: 0, antennae: false });
      const u = clamp01((t - tCol[0]) / (tCol[1] - tCol[0]));
      const r = t < tCol[0] ? S.BUB_R : S.BUB_R * (1 - ease.in(u)) ;
      const tf = t - tF;
      // the flash: a spike, then held as a glowing point ("for an instant")
      const flashA = tf < 0 ? 0 : Math.min(1, tf / 0.06) * (0.55 + 0.45 * Math.exp(-tf * 2.5));
      fx.set({ time: t * 0.3, jet: 0, jetLen: 0, r, wob: 0.03 + 0.1 * u * u, flashA, flashS: 0.42, lightK: 0.6,
               shockR: tf > 0 ? 0.04 + tf * 0.25 : 0, shockOp: tf > 0 ? 0.7 * (1 - ramp(tf, 0.2, 1.4)) : 0, debrisT: tf > 0 ? tf * 0.35 : -1 });
      sun.update(t, ramp(t, tSide[0] + 0.2, tSide[1] + 0.2));

      const fp = shrimp.clawPoint(S.BUB.x, S.BUB.y, 0), f = px(fp);
      lFlash.show(540, 310, C.env(t, a.flashes + 0.05, tSide[0] + 0.25, 0.25, 0.25), camera, fp);
      const side = C.env(t, tSide[1] - 0.2, end, 0.3, 0.2);
      lBub.show(f.x, 440, side);
      lSun.show(sun.cx, 440, side);
      lHot.show(540, 300, C.env(t, a.hot - 0.1, end, 0.3, 0.2));
      const bShow = C.env(t, tBars[0] - 0.2, end, 0.3, 0.2);
      const rise = ease.inOut(clamp01((t - tBars[0]) / (tBars[1] - tBars[0])));
      const xs = [f.x, sun.cx];
      for (const [i, b] of bars.entries()) {
        overlay.place(b.el, xs[i], 1235, { anchor: 'b', opacity: bShow });
        const v = i === 0 ? F.bubble_c : F.sun_c;
        b.fill.style.height = `${Math.round(hMax * (v / F.sun_c) * Math.min(1, rise * (i === 0 ? 1.0 : 1.0)))}px`;
      }
      nBub.show(xs[0], 860, C.env(t, tBars[1] - 0.3, end, 0.3, 0.2));
      nSun.show(xs[1], 860, C.env(t, tBars[1] - 0.3, end, 0.3, 0.2));
    },
  };
}
