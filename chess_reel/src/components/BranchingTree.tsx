import React, {useMemo} from 'react';
import {random} from 'remotion';
import {C, H, W} from '../constants';
import {useCanvas} from './useCanvas';

type Seg = {x0: number; y0: number; x1: number; y1: number; d: number};
const MAX_DEPTH = 9;
const ROOT_LEN = 470;
const RATIO = 0.88;
const kids = (d: number) => (d < 2 ? 2 : d < 5 ? 3 : 4);

// Built once: deterministic exponential tree (< 40k segments).
const buildTree = () => {
  const levels: Seg[][] = [];
  let tips = [{x: 0, y: 0, a: -Math.PI / 2, id: 'r'}];
  for (let d = 0; d < MAX_DEPTH; d++) {
    const segs: Seg[] = [];
    const next: typeof tips = [];
    const len = ROOT_LEN * Math.pow(RATIO, d);
    for (const t of tips) {
      const k = d === 0 ? 1 : kids(d - 1);
      const fan = 1.45 * Math.pow(0.88, d);
      for (let i = 0; i < k; i++) {
        const id = t.id + i;
        const jitter = (random('tree-' + id) - 0.5) * 0.35 * fan;
        const a = k === 1 ? t.a : t.a + (i / (k - 1) - 0.5) * fan + jitter;
        const l = len * (0.8 + random('tree-l' + id) * 0.35);
        const x1 = t.x + Math.cos(a) * l;
        const y1 = t.y + Math.sin(a) * l;
        segs.push({x0: t.x, y0: t.y, x1, y1, d});
        next.push({x: x1, y: y1, a, id});
      }
    }
    levels.push(segs);
    tips = next;
  }
  return levels;
};

// Frame at which each segment level starts growing (levels 0-2 are visible from the start).
const LEVEL_START = [-100, -100, -100, 70, 125, 185, 250, 300, 340];
const GROW = 20;

export const BranchingTree: React.FC<{
  frame: number;
  camera: number;
  opacity?: number;
  boardOpacity?: number;
  motes?: number;
}> = ({frame, camera, opacity = 1, boardOpacity = 0.25, motes = 1}) => {
  const levels = useMemo(buildTree, []);
  const ref = useCanvas(
    (ctx) => {
      ctx.globalAlpha = opacity;
      const rootX = W / 2;
      const rootY = 1760;
      ctx.translate(W / 2, H / 2);
      ctx.scale(camera, camera);
      ctx.translate(rootX - W / 2, rootY - H / 2);
      ctx.rotate(Math.sin(frame / 55) * 0.012);
      // small board at the root
      ctx.globalAlpha = opacity * boardOpacity;
      const bs = 22;
      for (let f = 0; f < 8; f++)
        for (let r = 0; r < 8; r++) {
          ctx.fillStyle = (f + r) % 2 === 0 ? C.lightSq : C.darkSq;
          ctx.fillRect(-4 * bs + f * bs, r * bs + 10, bs, bs);
        }
      ctx.globalAlpha = opacity;
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      levels.forEach((segs, d) => {
        const g = Math.min(1, Math.max(0, (frame - LEVEL_START[d]) / GROW));
        if (g <= 0) return;
        const e = 1 - Math.pow(1 - g, 3);
        const w = 6 * Math.pow(0.75, d) + 0.35;
        for (const pass of [0, 1]) {
          ctx.beginPath();
          for (const s of segs) {
            ctx.moveTo(s.x0, s.y0);
            ctx.lineTo(s.x0 + (s.x1 - s.x0) * e, s.y0 + (s.y1 - s.y0) * e);
          }
          if (pass === 0) {
            ctx.strokeStyle = 'rgba(232,176,74,0.10)';
            ctx.lineWidth = (w * 4 + 3) / camera;
          } else {
            ctx.strokeStyle = d < 6 ? 'rgba(255,217,138,0.85)' : 'rgba(232,176,74,0.6)';
            ctx.lineWidth = Math.max(0.6, w) / Math.sqrt(camera);
          }
          ctx.stroke();
        }
        // glowing tip nodes on the newest level
        if (g < 1 && d < 7) {
          ctx.fillStyle = 'rgba(255,217,138,0.8)';
          for (const s of segs) {
            ctx.beginPath();
            ctx.arc(s.x0 + (s.x1 - s.x0) * e, s.y0 + (s.y1 - s.y0) * e, 3 / camera, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
      // drifting gold motes with parallax (screen space)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < 400; i++) {
        const z = 0.3 + random('mote-z' + i) * 0.7;
        const x = (random('mote-x' + i) * W + frame * 0.6 * z) % W;
        const y = (((random('mote-y' + i) * H - frame * 1.4 * z) % H) + H) % H;
        ctx.globalAlpha = opacity * motes * (0.15 + 0.45 * z) * (0.6 + 0.4 * Math.sin(frame / 9 + i));
        ctx.fillStyle = C.goldGlow;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + 2.2 * z, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [frame, camera, opacity, boardOpacity, motes],
  );
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
