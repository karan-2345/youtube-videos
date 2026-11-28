// S02_Relay -- "So when scientists killed those cells in tattooed mice, the tattoos didn't fade, because new cells
// swallowed the spilled ink in the same spot."
// The tattooed lab mouse pops up in an inset. The ink-filled macrophages burst one by one and spill their grains,
// which stay where they are; the mouse's tail band never changes ("STILL THERE"). New macrophages crawl in from other
// directions and swallow the same grains in the same places.
import { ramp, ease, clamp01, lerp } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as S from './lib/story.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  st.scene.add(camera);
  const block = C.makeBlock(pal);
  st.scene.add(block.group);
  const flakes = C.makeFlakes(pal, 100, 9, C.blockSpots, { size: 0.07 });
  const ink = C.makeInk(pal, 32);
  const burst = C.makeBurst(pal);
  block.inner.add(flakes.mesh, ink.mesh, burst.mesh);
  const { cells, grains } = S.layout();
  const oldC = cells.map((c) => { const o = new C.Cell(pal, 300 + c.id, S.CELL_R); block.inner.add(o.group); return o; });
  const newC = cells.map((c) => { const o = new C.Cell(pal, 400 + c.id, S.CELL_R); block.inner.add(o.group); return o; });
  const inset = C.makeInset(renderer, pal, camera);

  const order = [0, 3, 1, 4, 2, 5];
  const n = (c) => order.indexOf(c.id);
  const tBurst = (c) => a.killed + 0.12 + 0.13 * n(c);
  const crawl2 = (c) => { const t0 = a.newc - 0.35 + 0.1 * n(c); return [t0, t0 + 1.05]; };
  const tEat = (c) => crawl2(c)[1] - 0.12;
  const home2 = cells.map(S.home2);
  // where each grain spills to when its cell dies
  const spill = grains.map((g) => {
    const c = cells[g.cell], slot = oldC[g.cell].slot(g.k, c.home);
    const d = slot.clone().sub(c.home).setZ(0).normalize();
    return slot.clone().addScaledVector(d, 0.05 + 0.03 * ((g.id * 7) % 3)).setZ(C.FACE_Z + 0.02);
  });

  const mouseLab = new C.Label(overlay, 'Tattooed mouse');
  const still = new C.Label(overlay, 'Still there', 'lab acc');
  const newLab = new C.Label(overlay, 'New cells');
  const midPush = { p: C.CAM.mid2.p.clone().lerp(C.CAM.mid2.t, 0.06), t: C.CAM.mid2.t };

  const cues = [[a.sci - 0.2, 'swish', -10], ...cells.map((c) => [tBurst(c), 'pop', -4]), [a.fade, 'ding', -9],
                [crawl2(cells[0])[0], 'squish', -12], ...cells.map((c) => [tEat(c) + 0.22, 'gulp', -5])];

  return {
    scene: st.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    update(t, { sub } = {}) {
      const target = C.camPath(camera, t, [[0, C.CAM.mid], [1.1, C.CAM.mid2], [end, midPush]]);
      st.frame(camera, target);
      block.set({ opacity: 1 });
      flakes.update(t, -3, end + 0.8, 1.4);

      // old cells: hold, then burst
      cells.forEach((c, i) => {
        const tb = tBurst(c), u = clamp01((t - tb) / 0.2);
        oldC[i].set(t, c.home, { opacity: 1 - u, scale: 1 + 0.3 * ease.out(u), glow: 0.4 * Math.sin(Math.PI * clamp01((t - tb + 0.25) / 0.3)) });
      });
      burst.update(t, cells.map((c) => ({ p: c.home, t0: tBurst(c), r: S.CELL_R, seed: 50 + c.id })));
      // new cells: crawl in, swallow
      const pos2 = cells.map((c, i) => S.crawl(c.from2, home2[i], t, ...crawl2(c), 0.05, c.id + 3));
      cells.forEach((c, i) => {
        const [t0] = crawl2(c), te = tEat(c);
        const first = grains.find((g) => g.cell === c.id);
        const reach = Math.max(ramp(t, t0, t0 + 0.35) * (1 - ramp(t, t0 + 0.8, t0 + 1.05)) * 0.45,
                               ramp(t, te, te + 0.3) * (1 - ramp(t, te + 0.45, te + 0.9)));
        const reachTo = t < te ? pos2[i].clone().add(home2[i]).sub(c.from2) : spill[first.id];
        newC[i].set(t, pos2[i], { opacity: ramp(t, t0, t0 + 0.3), reach, reachTo });
      });

      // grains: inside the old cell -> spilled (stay put, wander a little) -> into a new cell
      ink.begin();
      for (const g of grains) {
        const c = cells[g.cell], tb = tBurst(c), te = tEat(c) + 0.08 + 0.09 * g.k;
        let p = oldC[g.cell].slot(g.k, c.home).add(S.jiggle(g, t * 3, 0.006));
        if (t > tb) p = p.lerp(spill[g.id].clone().add(S.jiggle(g, t, 0.012)), ease.out(clamp01((t - tb) / 0.7)));
        if (t > te) p = S.swallowPath(p, newC[g.cell].slot(g.k, pos2[g.cell]).add(S.jiggle(g, t * 3, 0.006)), (t - te) / 0.42);
        ink.set(g.id, p, g.size * 0.9, g.rot + t * 0.4);
      }
      ink.end();

      // the mouse inset
      inset.update(t, { show: ramp(t, a.sci - 0.3, a.sci + 0.25, ease.linear), pulse: Math.sin(Math.PI * clamp01((t - a.fade + 0.1) / 1.3)) });
      const lm = C.env(t, a.mice - 0.25, end + 5, 0.3, 0.3);
      mouseLab.show(inset.cx, inset.cy + inset.rad + 46, lm);
      const bp = inset.bandPx();
      const ls = C.env(t, a.fade - 0.1, a.newc - 0.15, 0.25, 0.3);
      still.show(inset.cx + inset.rad + 175, inset.cy - 40, ls, null, bp);
      const ln = C.env(t, a.newc - 0.1, end + 5, 0.3, 0.3);
      newLab.show(820, 420, ln, camera, block.inner.localToWorld(pos2[3].clone().add(C.vec(0, S.CELL_R * 0.8, 0.05))));
    },
  };
}
