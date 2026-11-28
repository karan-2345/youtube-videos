// S01_Held -- "It's because the needle puts the ink deeper, where immune cells called macrophages swallow it but
// can't digest it, so they just hold on to it."
// The lifted block grows into the specimen (the arm sinks away). The needle punches ink through the outer layer
// into the dermis at the two places where the star crosses the cut face; the top keeps flaking off (time-lapse).
// Macrophages crawl in, reach out and swallow the grains, glow as they try to digest them, and keep them.
import * as THREE from 'three';
import { ramp, ease, clamp01, lerp } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as S from './lib/story.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  const arm = C.makeArm(pal);
  const block = C.makeBlock(pal);
  st.scene.add(arm.group, block.group);
  const flakes = C.makeFlakes(pal, 100, 9, C.blockSpots, { size: 0.07 });
  const needle = C.makeNeedle(pal);
  const ink = C.makeInk(pal, 32);
  block.inner.add(flakes.mesh, needle.group, ink.mesh);
  const { cells, grains } = S.layout();
  const cellObjs = cells.map((c) => { const o = new C.Cell(pal, 300 + c.id, S.CELL_R); block.inner.add(o.group); return o; });

  // ---- the needle: five punches at each spot
  const P = 0.16, HOVER = 0.28;
  const spotA = C.SPOTS[0], spotB = C.SPOTS[1];
  const tA = a.needle + 0.02, tMove = tA + 5 * P, tB = tMove + 0.25, tOut = tB + 5 * P;
  const punches = [];
  for (let k = 0; k < 5; k++) punches.push({ spot: 0, t: tA + k * P, depth: -0.78 - 0.14 * (k % 3) });
  for (let k = 0; k < 5; k++) punches.push({ spot: 1, t: tB + k * P, depth: -0.78 - 0.14 * ((k + 1) % 3) });
  const bottom = (p) => p.t + P / 2;
  // each grain drops at one punch of its spot
  for (const g of grains) {
    const idx = grains.filter((h) => h.spot === g.spot).indexOf(g);
    const pu = punches.filter((p) => p.spot === g.spot)[Math.floor(idx * 5 / 12)];
    g.td = bottom(pu);
    g.drop = C.vec(C.SPOTS[g.spot].x + (g.rest.x - C.SPOTS[g.spot].x) * 0.3, pu.depth + 0.06, C.FACE_Z + 0.02);
  }
  function needlePos(t) {
    const enterX = spotA.x, p = C.vec(enterX, 3.6, C.FACE_Z + 0.035);
    if (t < tA) { p.y = lerp(3.6, HOVER, ease.out(clamp01((t - (tA - 0.3)) / 0.3))); return p; }
    if (t < tMove) {
      const k = Math.floor((t - tA) / P), ph = (t - tA) / P - k;
      p.y = lerp(HOVER, punches[k].depth, 0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
      return p;
    }
    if (t < tB) { p.x = lerp(spotA.x, spotB.x, ease.inOut((t - tMove) / (tB - tMove))); p.y = HOVER + 0.08 * Math.sin(Math.PI * (t - tMove) / (tB - tMove)); return p; }
    p.x = spotB.x;
    if (t < tOut) {
      const k = 5 + Math.floor((t - tB) / P), ph = (t - tB) / P - Math.floor((t - tB) / P);
      p.y = lerp(HOVER, punches[k].depth, 0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
      return p;
    }
    p.y = lerp(HOVER, 3.8, ease.in(clamp01((t - tOut) / 0.4)));
    return p;
  }

  // ---- the cells: crawl in, then swallow
  const order = [0, 3, 1, 4, 2, 5];
  const crawlT = (c) => { const n = order.indexOf(c.id); const t0 = a.immune - 0.2 + 0.11 * n; return [t0, t0 + 1.25]; };
  const eatT = (c) => a.swallow - 0.3 + 0.13 * order.indexOf(c.id);

  const outer = new C.Label(overlay, 'Outer layer');
  const mac = new C.Label(overlay, 'Macrophage', 'lab acc');

  const cues = [[0.05, 'swish', -8], [tA - 0.3, 'buzz', -9, tOut - tA + 0.35], ...punches.map((p) => [bottom(p), 'punch', -10]),
                ...cells.map((c) => [eatT(c) + 0.22, 'gulp', -5]), [a.digest + 0.05, 'fizz', -12], [crawlT(cells[0])[0], 'squish', -12]];

  return {
    scene: st.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    blurSamples: (t) => (t > tA - 0.3 && t < tOut + 0.4 ? 2 : 1),
    update(t) {
      const target = C.camPath(camera, t, [[0, C.CAM.lift], [1.25, C.CAM.block], [a.immune - 0.1, C.CAM.block],
        [a.macro + 0.25, C.CAM.spotA], [a.digest + 0.7, C.CAM.spotA], [end - 0.45, C.CAM.mid]]);
      st.frame(camera, target);
      // the block grows into the specimen, the arm sinks away
      C.blockPose(block, 1 + ramp(t, 0, 1.15, ease.linear));
      block.set({ opacity: 1 });
      arm.set({ show: 1 - ramp(t, 0.15, 0.85), drop: 3.5 * ramp(t, 0.0, 1.1, ease.in), holeU: 1, cutAlpha: 0 });
      flakes.update(t, 2.2, end + 0.8, 1.4);

      // needle
      needle.group.visible = t > tA - 0.32 && t < tOut + 0.42;
      needle.group.position.copy(needlePos(t));

      // cells
      const cellPos = cells.map((c) => {
        const [t0, t1] = crawlT(c);
        return S.crawl(c.from, c.home, t, t0, t1, 0.05, c.id);
      });
      cells.forEach((c, i) => {
        const [t0] = crawlT(c), te = eatT(c);
        const first = grains.find((g) => g.cell === c.id);
        const reach = Math.max(ramp(t, t0, t0 + 0.4) * (1 - ramp(t, t0 + 1.0, t0 + 1.3)) * 0.45,
                               ramp(t, te, te + 0.3) * (1 - ramp(t, te + 0.45, te + 0.9)));
        const reachTo = t < te ? c.home.clone().add(C.vec(0, 0, 0)).sub(c.from).add(cellPos[i]) : first.rest;
        const glow = Math.sin(Math.PI * clamp01((t - a.digest + 0.05 * i) / 0.9)) * 0.55;
        cellObjs[i].set(t, cellPos[i], { opacity: ramp(t, t0, t0 + 0.3), reach, reachTo, glow,
                                         wob: 0.1 + 0.05 * Math.sin(t * 3 + i) });
      });

      // ink grains
      ink.begin();
      for (const g of grains) {
        if (t < g.td) continue;
        const c = cells[g.cell], te = eatT(c) + 0.08 + 0.09 * g.k;
        const settle = ease.out(clamp01((t - g.td) / 0.35));
        let p = g.drop.clone().lerp(g.rest, settle).add(S.jiggle(g, t, 0.01 * settle));
        let s = g.size * ease.out(clamp01((t - g.td) / 0.08));
        if (t > te) {
          const slot = cellObjs[g.cell].slot(g.k, cellPos[g.cell]);
          const shake = 0.006 + 0.01 * Math.sin(Math.PI * clamp01((t - a.digest) / 0.9));
          slot.add(S.jiggle(g, t * 3, shake));
          p = S.swallowPath(p, slot, (t - te) / 0.42);
          s *= lerp(1, 0.9, clamp01((t - te) / 0.42));
        }
        ink.set(g.id, p, s, g.rot + t * 0.4);
      }
      ink.end();

      // labels
      const lo = C.env(t, a.needle - 0.05, a.immune + 0.1, 0.3, 0.3);
      outer.show(330, 330, lo, camera, block.inner.localToWorld(C.vec(-0.95, -0.1, C.FACE_Z)));
      const lm = C.env(t, a.macro - 0.12, end - 0.6, 0.3, 0.4);
      mac.show(540, 330, lm, camera, block.inner.localToWorld(cellPos[0].clone().add(C.vec(0, S.CELL_R * 0.8, 0.05))));
    },
  };
}
