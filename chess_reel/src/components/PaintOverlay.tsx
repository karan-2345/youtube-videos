import React from 'react';
import {AbsoluteFill, Img, random, staticFile, useCurrentFrame} from 'remotion';
import {C, H, W} from '../constants';

/** SVG filter defs for the oil-paint displacement. Rendered once in Reel. */
export const PaintDefs: React.FC = () => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <defs>
      <filter id="paint" x="-5%" y="-5%" width="110%" height="110%">
        {/* fractalNoise (baseFrequency 0.008 0.012, 3 octaves, seed 7) baked to a texture for render speed */}
        <feImage href={staticFile('fx/disp.png')} x={0} y={0} width={1080} height={1920} preserveAspectRatio="none" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={11} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>
);

/** Wrap BACKGROUND layers only (never number text) to give them painterly displacement. */
export const Painted: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <AbsoluteFill style={{filter: 'url(#paint)', ...style}}>{children}</AbsoluteFill>
);

const BLOB_COLORS = [C.crimson, C.gold, C.charcoal, C.hookRed, '#3a0d10'];

export const BrushBlobs: React.FC<{intensity?: number; t?: number}> = ({intensity = 1, t}) => {
  const f = useCurrentFrame();
  const fr = t ?? f;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {new Array(16).fill(0).map((_, i) => {
        const x = random('blob-x' + i) * W;
        const y = random('blob-y' + i) * H;
        const rx = 260 + random('blob-rx' + i) * 520;
        const ry = 200 + random('blob-ry' + i) * 480;
        const dx = Math.sin(fr / 140 + i) * 40;
        const dy = Math.cos(fr / 170 + i * 1.7) * 40;
        const op = (0.04 + random('blob-o' + i) * 0.06) * intensity;
        const col = BLOB_COLORS[i % BLOB_COLORS.length];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x - rx + dx,
              top: y - ry + dy,
              width: rx * 2,
              height: ry * 2,
              borderRadius: '50%',
              background: `radial-gradient(ellipse at center, ${col} 0%, transparent 70%)`,
              opacity: op * 2.2,
              transform: `rotate(${random('blob-r' + i) * 180}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Grain + vignette + chromatic edge + brush blobs. Sits above everything. */
export const PaintOverlay: React.FC<{vignette?: boolean; blobs?: boolean; grain?: number}> = ({
  vignette = true,
  blobs = true,
  grain = 0.12,
}) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 97;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {blobs ? <BrushBlobs /> : null}
      {/* living film grain: 12 pre-baked noise frames (feTurbulence 0.9 equivalent), new seed every 2 frames */}
      <Img
        src={staticFile(`fx/grain${seed % 12}.png`)}
        style={{position: 'absolute', width: W, height: H, mixBlendMode: 'overlay', opacity: grain}}
      />
      {vignette ? (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)'}} />
          <AbsoluteFill
            style={{
              background: 'radial-gradient(ellipse at 52% 48%, transparent 55%, rgba(139,10,20,0.28) 100%)',
              mixBlendMode: 'screen',
            }}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
