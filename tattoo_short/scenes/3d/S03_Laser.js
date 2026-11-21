// S03_Laser -- "And that's why lasers take so many sessions to remove a tattoo, since they have to shatter the ink
// small enough for those cells to carry it away."
// The inset closes. A laser hand-piece pulses over the star, session after session (weeks apart), and the star fades
// a little each time. Then one pulse, close up: the grains in the right-hand cells shatter into dust, and the cells
// crawl down to the lymph vessel and let the dust flow away. Finally the block shrinks back into the arm and the
// camera returns to the opening shot (last frame = S00's first frame: the loop).
import { ramp, ease, clamp01, lerp } from '/scenes/web/runtime.js';
import * as C from './lib/cut.js';
import * as S from './lib/story.js';
import { rng } from '/scenes/web/runtime.js';

export async function setup({ renderer, data, overlay }) {
  const pal = data.palette, a = data.a, end = data.timing.duration;
  const st = C.stage(renderer, pal);
  const camera = C.makeCamera();
  st.scene.add(camera);
  const arm = C.makeArm(pal);
  const block = C.makeBlock(pal);
  st.scene.add(arm.group, block.group);
  const flakes = C.makeFlakes(pal, 100, 9, C.blockSpots, { size: 0.07 });
  const ink = C.makeInk(pal, 32);
  const dust = C.makeInk(pal, 12 * 8, { detail: 1 });
  const lymph = C.makeLymph(pal);
  block.inner.add(flakes.mesh, ink.mesh, dust.mesh, lymph.mesh);
  const laser = C.makeLaser(pal);
  st.scene.add(laser.group);
  const { cells, grains } = S.layout();
  const home2 = cells.map(S.home2);
  const newC = cells.map((c) => { const o = new C.Cell(pal, 400 + c.id, S.CELL_R); block.inner.add(o.group); return o; });
  const inset = C.makeInset(renderer, pal, camera);

  // ---- sessions: one flash each, weeks apart; the star fades a little every time
  const NS = 7, tS0 = a.sessions + 0.02, dS = (a.remove + 0.55 - tS0) / (NS - 1);
  const flashes = Array.from({ length: NS }, (_, k) => tS0 + k * dS);
  const spots = [[0.0, 0.3], [0.48, 0.12], [-0.46, 0.14], [0.3, 0.66], [-0.28, 0.66], [0.02, -0.38], [0.14, 0.32]];
  const starAfter = (t) => 1 - 0.065 * flashes.filter((f) => t >= f + 0.04).length;
  // ---- the close pulse at spot B, the dust and the carry
  const B = C.SPOTS[1];
  const tShot = a.shatter + 0.06;
  const carryT = (j) => { const t0 = a.small + 0.05 + 0.18 * j; return [t0, t0 + 1.15]; };
  const lymphAt = [[-0.36, 0.0], [0.0, 0.03], [0.34, -0.01]];
  const r = rng(77);
  const dustItems = [];
  for (const g of grains.filter((h) => h.spot === 1)) {
    for (let k = 0; k < 8; k++) {
      dustItems.push({ g, dir: C.vec(r() - 0.5, r() - 0.5, (r() - 0.5) * 0.4).normalize(), d: 0.02 + r() * 0.03,
                       size: 0.007 + r() * 0.005, v: 0.75 + r() * 0.5, lag: r() * 0.35, ph: r() * 6 });
    }
  }
  const tBack = a.vend - 0.05;                       // the loop back to the arm starts
  const top = { p: C.vec(2.4, 4.6, 9.4), t: C.vec(0.0, -0.95, 0.0) };
  const spotBlow = { p: C.vec(1.7, -0.75, 5.5), t: C.vec(0.6, -1.66, 0.9) };

  const mouseLab = new C.Label(overlay, 'Tattooed mouse');
  const newLab = new C.Label(overlay, 'New cells');
  const chip = new C.Label(overlay, 'Session 1', 'lab big');
  const lymLab = new C.Label(overlay, 'Lymph vessel');
  let chipN = 0;

  const cues = [[0.05, 'swish', -12], [a.lasers - 0.25, 'whir', -14], ...flashes.map((f) => [f, 'zap', -9]),
                [tShot, 'zapbig', -4], [tShot + 0.04, 'shimmer', -8], [carryT(0)[0], 'squish', -12],
                ...[0, 1, 2].map((j) => [carryT(j)[1] - 0.05, 'flow', -11]), [tBack + 0.05, 'swish', -6]];

  return {
    scene: st.scene, camera, cues,
    post: { ss: 1.0, samples: 1, msaa: 4, bg: pal.bg, grain: 0.03, vignette: 0.3, exposure: 1.05 },
    blurSamples: (t) => (t > tBack ? 2 : 1),
    update(t) {
      const target = C.camPath(camera, t, [[0, { p: C.CAM.mid2.p.clone().lerp(C.CAM.mid2.t, 0.06), t: C.CAM.mid2.t }],
        [1.05, top], [a.remove + 0.7, top], [a.shatter - 0.1, spotBlow], [tBack, spotBlow],
        [tBack + 0.95, C.CAM.lift], [end - 0.12, C.CAM.arm]]);
      st.frame(camera, target);

      // the block, and the way back into the arm
      const back = ramp(t, tBack, end - 0.3, ease.linear);   // the block is gone 0.3 s before the end
      const u = 2 - 2 * back;
      C.blockPose(block, u);
      const starOp = lerp(starAfter(t), 1, ramp(t, tBack, tBack + 0.9));
      block.set({ opacity: clamp01(u / 0.1), starOpacity: starOp });
      arm.set({ show: ramp(t, tBack + 0.2, tBack + 0.95), drop: 3.5 * (1 - ramp(t, tBack, tBack + 1.1, ease.out)),
                holeU: 1 - ramp(t, end - 0.5, end - 0.25), cutAlpha: 0 });
      flakes.update(t, -3, tBack, 1.4, 1 - ramp(t, tBack - 0.3, tBack + 0.2));
      inset.update(t, { show: 1 - ramp(t, 0.0, 0.45, ease.linear) });

      // the laser hand-piece
      let tip, tgt, pulse = 0, fsize = 0.7;
      const k = Math.max(0, Math.min(NS - 1, Math.floor((t - tS0 + dS * 0.5) / dS)));
      const sp = spots[k];
      if (t < a.shatter - 0.6) {
        const prev = spots[Math.max(0, k - 1)], mv = ramp(t, tS0 + (k - 0.5) * dS, tS0 + (k - 0.5) * dS + 0.12);
        const x = lerp(prev[0], sp[0], k ? mv : 1), z = lerp(prev[1], sp[1], k ? mv : 1);
        tip = C.vec(x, lerp(4.2, 1.45, ease.out(ramp(t, a.lasers - 0.3, a.lasers + 0.25, ease.linear))), z);
        tgt = C.vec(x, 0.003, z);
        for (const f of flashes) pulse = Math.max(pulse, Math.exp(-Math.max(0, t - f) / 0.06) * (t >= f ? 1 : 0));
      } else {
        const m = ramp(t, a.shatter - 0.6, a.shatter - 0.15);
        tip = C.vec(lerp(sp[0], B.x, m), lerp(1.45, 1.25, m), lerp(sp[1], C.FACE_Z + 0.06, m));
        tip.y += 3.0 * ramp(t, tBack - 0.6, tBack + 0.1, ease.in);
        tgt = C.vec(B.x, B.y - 0.05, C.FACE_Z + 0.06);
        pulse = t >= tShot ? Math.exp(-(t - tShot) / 0.12) : 0;
        fsize = 1.1;
      }
      laser.set({ show: ramp(t, a.lasers - 0.3, a.lasers) * (1 - ramp(t, tBack - 0.1, tBack + 0.2)),
                  tip: block.inner.localToWorld(tip.clone()), target: block.inner.localToWorld(tgt.clone()),
                  pulse, flashSize: fsize });

      // cells: the left ones keep holding; the right ones carry the dust down to the lymph vessel
      const pos = cells.map((c, i) => {
        if (c.spot === 0) return home2[i].clone();
        const [t0, t1] = carryT(c.j);
        const dest = C.vec(B.x + lymphAt[c.j][0], C.LYMPH.y + S.CELL_R * 0.55 + lymphAt[c.j][1], home2[i].z);
        return S.crawl(home2[i], dest, t, t0, t1, 0.04, c.id);
      });
      cells.forEach((c, i) => {
        const shock = c.spot === 1 ? Math.sin(Math.PI * clamp01((t - tShot) / 0.35)) : 0;
        newC[i].set(t, pos[i], { glow: 0.5 * shock, wob: 0.12 + 0.08 * shock });
      });

      // grains: left spot shrinks a little with each session; right spot shatters into dust
      ink.begin();
      for (const g of grains) {
        const p = newC[g.cell].slot(g.k, pos[g.cell]).add(S.jiggle(g, t * 3, 0.006));
        let s = g.size * 0.9;
        if (g.spot === 0) s *= lerp(1, 0.72, (1 - starAfter(t)) / 0.46);
        else s *= 1 - ramp(t, tShot, tShot + 0.12, ease.linear);
        if (s > 1e-4) ink.set(g.id, p, s, g.rot + t * 0.4);
      }
      ink.end();
      dust.begin();
      dustItems.forEach((d, i) => {
        if (t < tShot) return;
        const c = cells[d.g.cell];
        const [, t1] = carryT(c.j);
        const inCell = newC[d.g.cell].slot(d.g.k, pos[d.g.cell])
          .addScaledVector(d.dir, d.d * ease.out(clamp01((t - tShot) / 0.3))).add(S.jiggle(d.g, t * 2 + d.ph, 0.008));
        const tr = t1 - 0.1 + d.lag;
        let p = inCell, s = d.size * ease.out(clamp01((t - tShot) / 0.1));
        if (t > tr) {
          const e = clamp01((t - tr) / 0.3);
          const entry = C.vec(inCell.x, C.LYMPH.y + 0.025 * Math.sin(d.ph), C.LYMPH.z + 0.02 * Math.cos(d.ph));
          p = inCell.clone().lerp(entry, ease.inOut(e));
          if (t > tr + 0.3) p.x += d.v * (t - tr - 0.3) * (1 + 0.6 * (t - tr - 0.3));
          s *= 1 - ramp(p.x, C.BLK.w / 2 - 0.12, C.BLK.w / 2 - 0.02, ease.linear);
        }
        if (s > 1e-4) dust.set(i, p, s, d.ph + t);
      });
      dust.end();
      lymph.set(ramp(t, a.small - 0.4, a.small + 0.2) * (1 - ramp(t, tBack - 0.2, tBack + 0.3)));

      // labels
      const lo = 1 - ramp(t, 0.0, 0.35, ease.linear);
      mouseLab.show(inset.cx, inset.cy + inset.rad + 46, lo);
      newLab.show(820, 420, lo, camera, block.inner.localToWorld(pos[3].clone().add(C.vec(0, S.CELL_R * 0.8, 0.05))));
      const n = Math.max(1, flashes.filter((f) => t >= f - 0.01).length);
      if (n !== chipN) { chip.el.innerHTML = `Session ${n}<span class="sub">weeks apart</span>`; chipN = n; }
      chip.show(800, 330, C.env(t, tS0 - 0.05, a.shatter - 0.35, 0.2, 0.3));
      lymLab.show(330, 960, C.env(t, a.carry - 0.7, tBack + 0.05, 0.3, 0.25), camera,
        block.inner.localToWorld(C.vec(-0.25, C.LYMPH.y, C.LYMPH.z + C.LYMPH.r)));
    },
  };
}
