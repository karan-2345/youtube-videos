import React from 'react';
import {random} from 'remotion';
import {H, W} from '../constants';
import {useCanvas} from './useCanvas';

/** 600 seeded stars in 3 parallax layers + faint painterly galaxies. `t` is the GLOBAL frame for continuity. */
export const Starfield: React.FC<{t: number; opacity?: number}> = ({t, opacity = 1}) => {
  const ref = useCanvas(
    (ctx) => {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#04030A');
      bg.addColorStop(1, '#0B0716');
      ctx.globalAlpha = opacity;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // galaxies
      for (let g = 0; g < 4; g++) {
        const gx = random('gal-x' + g) * W;
        const gy = random('gal-y' + g) * H;
        const rad = 140 + random('gal-r' + g) * 220;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(random('gal-a' + g) * Math.PI + t * 0.0006);
        ctx.scale(1, 0.38);
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
        const warm = g % 2 === 0;
        gr.addColorStop(0, warm ? 'rgba(255,217,138,0.22)' : 'rgba(170,190,255,0.18)');
        gr.addColorStop(0.35, warm ? 'rgba(139,10,20,0.10)' : 'rgba(90,70,160,0.08)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.globalAlpha = opacity * 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (let i = 0; i < 600; i++) {
        const layer = i % 3; // 0 far, 2 near
        const speed = [0.05, 0.12, 0.25][layer];
        const x = (((random('st-x' + i) * W + t * speed * 0.6) % W) + W) % W;
        const y = (((random('st-y' + i) * H - t * speed) % H) + H) % H;
        const size = 1 + layer * 0.8 + random('st-s' + i) * 0.6;
        const tw = 0.55 + 0.45 * Math.sin(t / (8 + random('st-t' + i) * 20) + i);
        const kind = random('st-c' + i);
        ctx.fillStyle = kind < 0.08 ? '#FFD98A' : kind < 0.18 ? '#CFE0FF' : '#FFFFFF';
        ctx.globalAlpha = opacity * (0.35 + 0.65 * tw) * (0.5 + layer * 0.25);
        ctx.beginPath();
        ctx.arc(x, y, size / 2 + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [t, opacity],
  );
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />;
};
