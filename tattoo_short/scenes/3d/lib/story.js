// scenes/3d/lib/story.js -- where every ink grain and every macrophage is, shared by S01-S03 so the cuts match.
//
// Two ink spots on the cut face (where the star's front arms cross it). Each spot: three macrophages, four ink
// grains per cell. S01: the needle drops the grains, the first cells crawl in and swallow them. S02: those cells die
// and spill the grains; new cells crawl in and swallow the same grains in the same place. S03: the laser shatters
// grains into dust and the cells carry the dust down to the lymph vessel.
import * as THREE from 'three';
import { rng, clamp01, lerp, ease } from '/scenes/web/runtime.js';
import { BLK, SPOTS, FACE_Z, vec } from './cut.js';

export const CELL_R = 0.15;
export const PER_CELL = 4;
const HOMES = [[-0.07, 0.2], [0.09, -0.07], [-0.05, -0.33]];          // cell homes around a spot centre (x, y)

/** Deterministic layout: cells[{spot, home, from, from2}], grains[{spot, cell, k, rest, needle}] */
export function layout() {
  const r = rng(99);
  const cells = [], grains = [];
  for (const sp of SPOTS) {
    const side = Math.sign(sp.x);                                     // -1 = left spot, +1 = right
    HOMES.forEach(([dx, dy], j) => {
      const home = vec(sp.x + dx * side, sp.y + dy, FACE_Z - 0.01);
      // first cells (S01) crawl in from the outer edge and from below; new cells (S02) from other directions
      const from = [vec(side * 1.22, sp.y + 0.35, FACE_Z - 0.01), vec(side * 1.18, sp.y - 0.62, FACE_Z - 0.01),
                    vec(sp.x * 0.35, BLK.yDerm + 0.12, FACE_Z - 0.01)][j];
      const from2 = [vec(sp.x * 0.1, sp.y + 0.55, FACE_Z - 0.01), vec(side * 1.22, sp.y - 0.15, FACE_Z - 0.01),
                     vec(sp.x + side * 0.55, BLK.yDerm + 0.12, FACE_Z - 0.01)][j];
      cells.push({ id: cells.length, spot: sp.i, home, from, from2, j });
    });
  }
  for (const c of cells) {
    for (let k = 0; k < PER_CELL; k++) {
      const a = r() * Math.PI * 2, d = 0.06 + r() * 0.1;
      const rest = vec(c.home.x + Math.cos(a) * d, c.home.y + Math.sin(a) * d * 1.1, FACE_Z + 0.005 + r() * 0.02);
      grains.push({ id: grains.length, spot: c.spot, cell: c.id, k, rest, size: 0.028 + r() * 0.016, rot: r() * 6 });
    }
  }
  return { cells, grains };
}

/** Small random wander for a free grain (pure function of t). */
export function jiggle(g, t, amp = 0.012) {
  const s = g.id * 1.7;
  return vec(amp * Math.sin(t * 2.3 + s), amp * Math.sin(t * 1.9 + s * 1.3), 0);
}

/** A crawl from a to b between t0 and t1, with a sideways wobble; returns the position. */
export function crawl(a, b, t, t0, t1, wob = 0.05, seed = 0) {
  const u = ease.inOut(clamp01((t - t0) / (t1 - t0)));
  const p = a.clone().lerp(b, u);
  const n = vec(-(b.y - a.y), b.x - a.x, 0).normalize();
  return p.addScaledVector(n, wob * Math.sin(u * Math.PI * 3 + seed) * Math.sin(u * Math.PI));
}

/** Smoothly move a grain from `from` into a cell slot (u 0..1), with a small arc. */
export function swallowPath(from, to, u) {
  const e = ease.inOut(clamp01(u));
  const p = from.clone().lerp(to, e);
  p.z += 0.05 * Math.sin(e * Math.PI);
  return p;
}

/** Where the new cells (S02) settle: the same spots, a hair off. */
export function home2(c) {
  return c.home.clone().add(vec(0.015 * Math.sin(c.id * 2), 0.015 * Math.cos(c.id * 3), 0));
}
