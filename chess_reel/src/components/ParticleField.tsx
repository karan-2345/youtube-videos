import React from 'react';
import {random} from 'remotion';
import {H, W} from '../constants';
import {useCanvas} from './useCanvas';

const OLD = 3000;
const NEW = 5000;
const CLUSTERS = 14;

const gauss = (k: string) => {
  const u = Math.max(1e-6, random(k + 'u'));
  const v = random(k + 'v');
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * 10^80: a dense but finite cloud of 3000 particles (clusters with gaps and edges).
 * 10^120: up to 5000 particles streaming out of it and overflowing the frame.
 */
export const ParticleField: React.FC<{frame: number; camera: number; wave: number; oldOpacity?: number; glow?: number}> = ({
  frame,
  camera,
  wave,
  oldOpacity = 1,
  glow = 1,
}) => {
  const ref = useCanvas(
    (ctx) => {
      const cx = W / 2;
      const cy = H / 2;
      ctx.globalCompositeOperation = 'lighter';
      // finite 10^80 cloud
      for (let i = 0; i < OLD; i++) {
        const c = Math.floor(random('pc' + i) * CLUSTERS);
        const ox = (random('cl-x' + c) - 0.5) * 760;
        const oy = (random('cl-y' + c) - 0.5) * 1380;
        const spread = 60 + random('cl-s' + c) * 110;
        const z = 0.4 + random('pz' + i) * 0.6;
        const px = ox + gauss('gx' + i) * spread + Math.sin(frame / 50 + i) * 6 * z + frame * 0.15 * (z - 0.7);
        const py = oy + gauss('gy' + i) * spread + Math.cos(frame / 60 + i) * 6 * z - frame * 0.2 * (z - 0.7);
        const x = cx + px * camera;
        const y = cy + py * camera;
        ctx.globalAlpha = Math.min(1, oldOpacity * (0.55 + 0.45 * z));
        ctx.fillStyle = '#FFFFFF';
        const s = (1.6 + 1.6 * z) * Math.max(0.7, Math.sqrt(camera));
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      if (camera < 0.6 && oldOpacity > 0) {
        // the shrunken cloud glows as a small speck
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260 * camera + 40);
        g.addColorStop(0, `rgba(255,255,255,${0.25 * oldOpacity})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      // 10^120 wave
      if (wave > 0) {
        const count = Math.floor(NEW * Math.min(1, wave * 1.4));
        for (let i = 0; i < count; i++) {
          const a = random('na' + i) * Math.PI * 2;
          const rf = 30 + Math.pow(random('nr' + i), 0.75) * 1150;
          const e = random('ne' + i) * 0.55;
          const q = Math.min(1, Math.max(0, (wave - e) / 0.45));
          const eq = 1 - Math.pow(1 - q, 3);
          if (q <= 0) continue;
          const r = rf * eq * (1 + wave * 0.15);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 1.7;
          const z = 0.3 + random('nz' + i) * 0.7;
          ctx.globalAlpha = Math.min(1, Math.min(1, q * 3) * (0.5 + 0.5 * z) * glow);
          ctx.fillStyle = random('nc' + i) < 0.12 ? '#FFD98A' : '#FFFFFF';
          const s = 2 + z * 2.2;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
    },
    [frame, camera, wave, oldOpacity, glow],
  );
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
