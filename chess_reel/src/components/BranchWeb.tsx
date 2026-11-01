import React, {useMemo} from 'react';
import {random} from 'remotion';
import {H, W} from '../constants';
import {useCanvas} from './useCanvas';

type V3 = [number, number, number];
type Seg = {a: V3; b: V3; d: number};
const KIDS = [30, 4, 3, 4, 3];
const STARTS = [90, 102, 114, 126, 138];
const DUR = 14;

const build = () => {
  const levels: Seg[][] = [];
  let tips: {p: V3; dir: V3; id: string}[] = [];
  for (let i = 0; i < 30; i++) {
    const th = (i / 30) * Math.PI * 2;
    const el = 0.35 + random('wb-el' + i) * 0.3;
    tips.push({p: [0, 0, 0], dir: [Math.cos(th) * Math.cos(el), Math.sin(el) + 0.25, Math.sin(th) * Math.cos(el) + 0.6], id: 'w' + i});
  }
  let len = 420;
  for (let d = 0; d < KIDS.length; d++) {
    const segs: Seg[] = [];
    const next: typeof tips = [];
    for (const t of tips) {
      const k = d === 0 ? 1 : KIDS[d];
      for (let j = 0; j < k; j++) {
        const id = t.id + j;
        const jit = d === 0 ? 0 : 0.7;
        const dir: V3 = [
          t.dir[0] + (random(id + 'x') - 0.5) * jit,
          t.dir[1] + (random(id + 'y') - 0.5) * jit,
          t.dir[2] + 0.35 + random(id + 'z') * 0.4,
        ];
        const n = Math.hypot(...dir);
        const l = len * (0.75 + random(id + 'l') * 0.5);
        const b: V3 = [t.p[0] + (dir[0] / n) * l, t.p[1] + (dir[1] / n) * l, t.p[2] + (dir[2] / n) * l];
        segs.push({a: t.p, b, d});
        next.push({p: b, dir: [dir[0] / n, dir[1] / n, dir[2] / n], id});
      }
    }
    levels.push(segs);
    tips = next;
    len *= 0.72;
  }
  return levels;
};

const K = 900;
/** Gold lines branching out of the floating board into the depth: 30, 120, 360, 1440, 4320. */
export const BranchWeb: React.FC<{frame: number; ox: number; oy: number; opacity?: number}> = ({frame, ox, oy, opacity = 1}) => {
  const levels = useMemo(build, []);
  const ref = useCanvas(
    (ctx) => {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const proj = (p: V3) => {
        const s = K / (K + Math.max(-K * 0.6, p[2]));
        return [ox + p[0] * s, oy - p[1] * s, s] as const;
      };
      levels.forEach((segs, d) => {
        const g = Math.min(1, Math.max(0, (frame - STARTS[d]) / DUR));
        if (g <= 0) return;
        const e = 1 - Math.pow(1 - g, 3);
        for (const pass of [0, 1]) {
          ctx.beginPath();
          for (const s of segs) {
            const [x0, y0] = proj(s.a);
            const [x1, y1] = proj([s.a[0] + (s.b[0] - s.a[0]) * e, s.a[1] + (s.b[1] - s.a[1]) * e, s.a[2] + (s.b[2] - s.a[2]) * e]);
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
          }
          const depthFade = Math.pow(0.8, d);
          ctx.strokeStyle = pass === 0 ? `rgba(232,176,74,${0.12 * opacity})` : `rgba(255,217,138,${0.75 * depthFade * opacity})`;
          ctx.lineWidth = pass === 0 ? 7 * depthFade : Math.max(0.6, 2.4 * depthFade);
          ctx.stroke();
        }
      });
    },
    [frame, ox, oy, opacity],
  );
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
