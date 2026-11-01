import React, {useMemo} from 'react';
import {Easing, random} from 'remotion';
import {noise3D} from '@remotion/noise';
import {H, W} from '../constants';
import {FONT} from '../font';
import {useCanvas} from './useCanvas';

const NPTS = 6000;

type TextSpec = {text: string; font: number; cx: number; cy: number};

// Rasterise a string with the real font at its on-screen size and sample lit pixels.
const sample = (spec: TextSpec, seed: string) => {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', {willReadFrequently: true})!;
  ctx.font = `800 ${spec.font}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  // letter-spacing -0.02em to match the DOM text
  (ctx as unknown as {letterSpacing: string}).letterSpacing = `${-0.02 * spec.font}px`;
  ctx.fillText(spec.text, spec.cx, spec.cy + spec.font * 0.035);
  const x0 = 0;
  const y0 = Math.max(0, Math.floor(spec.cy - spec.font));
  const h = Math.min(H - y0, Math.ceil(spec.font * 2));
  const data = ctx.getImageData(x0, y0, W, h).data;
  const pts: [number, number][] = [];
  const step = 4;
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y + y0]);
  // resample to a fixed count
  const out: [number, number][] = [];
  for (let i = 0; i < NPTS; i++) {
    const p = pts[i < pts.length && pts.length >= NPTS ? Math.floor((i / NPTS) * pts.length) : Math.floor(random(seed + i) * pts.length)];
    out.push([p[0] + (random(seed + 'jx' + i) - 0.5) * 2, p[1] + (random(seed + 'jy' + i) - 0.5) * 2]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return out;
};

/**
 * Particle morph between two strings. progress 0..1:
 *  0-0.33 break apart, 0.33-0.66 spread (up to ~300px), 0.66-1 reform into B.
 */
export const ParticleMorph: React.FC<{
  a: TextSpec;
  b: TextSpec;
  progress: number;
  frame: number;
  opacity?: number;
  camera?: number;
  spread?: number;
}> = ({a, b, progress, frame, opacity = 1, camera = 1, spread = 300}) => {
  const A = useMemo(() => sample(a, 'pa'), [a.text, a.font, a.cx, a.cy]);
  const B = useMemo(() => sample(b, 'pb'), [b.text, b.font, b.cx, b.cy]);
  const ref = useCanvas(
    (ctx) => {
      if (opacity <= 0) return;
      const u = Math.min(1, Math.max(0, progress));
      const s =
        u < 0.33
          ? Easing.out(Easing.cubic)(u / 0.33) * 0.35
          : u < 0.66
            ? 0.35 + 0.65 * Easing.inOut(Easing.sin)((u - 0.33) / 0.33)
            : 1 - Easing.inOut(Easing.cubic)((u - 0.66) / 0.34);
      const m = Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, (u - 0.5) / 0.5)));
      // tiny overshoot at the end of the reform
      const over = u > 0.9 ? Math.sin(((u - 0.9) / 0.1) * Math.PI) * 0.04 : 0;
      const ccx = (a.cx + b.cx) / 2;
      const ccy = (a.cy + b.cy) / 2;
      ctx.translate(W / 2, H / 2);
      ctx.scale(camera, camera);
      ctx.translate(-W / 2, -H / 2);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < NPTS; i++) {
        const ax = A[i][0];
        const ay = A[i][1];
        let x = ax + (B[i][0] - ax) * m;
        let y = ay + (B[i][1] - ay) * m;
        const dx = x - ccx;
        const dy = y - ccy;
        const dl = Math.hypot(dx, dy) + 1e-3;
        const r = spread * (0.35 + 0.65 * random('pr' + i));
        const nx = noise3D('cx', x * 0.004, y * 0.004, frame * 0.03);
        const ny = noise3D('cy', x * 0.004, y * 0.004, frame * 0.03);
        x += (dx / dl) * r * s + nx * 70 * s + dx * over;
        y += (dy / dl) * r * s + ny * 70 * s + dy * over;
        ctx.globalAlpha = opacity * 0.18;
        ctx.fillStyle = '#FFD98A';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.globalAlpha = opacity * 0.9;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
      }
    },
    [progress, frame, opacity, camera, A, B],
  );
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
