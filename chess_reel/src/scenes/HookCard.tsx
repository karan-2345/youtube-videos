import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, EXTRA} from '../constants';
import {FONT_STACK, measure1} from '../font';
import {glowShadow} from '../components/BigNumber';
import {BrushBlobs} from '../components/PaintOverlay';

/** Stacked headline in the reel's hook typography. Lines are auto-fit to the safe zone. */
export const Headline: React.FC<{
  lines: readonly string[];
  scale: number;
  dx?: number;
  dy?: number;
  opacity?: number;
  bigIndex?: number; // line rendered at 1.6x in warm gold-white
  maxFont?: number;
  cy?: number;
}> = ({lines, scale, dx = 0, dy = 0, opacity = 1, bigIndex = -1, maxFont = 262, cy = 960}) => {
  const rel = lines.map((l, i) => (i === bigIndex ? 1.6 : 1) * measure1(l));
  const F = Math.min(maxFont, (900 / 1.04) / Math.max(...rel));
  return (
    <div
      style={{
        position: 'absolute',
        left: 540 + dx,
        top: cy + dy,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            fontFamily: FONT_STACK,
            fontWeight: 800,
            fontSize: i === bigIndex ? F * 1.6 : F,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            color: i === bigIndex ? '#FFE7BD' : C.white,
            textShadow: i === bigIndex ? glowShadow(1.4) : '0 6px 40px rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {l}
        </div>
      ))}
    </div>
  );
};

/** The red "YOU THINK CHESS IS EASY?" card (Scene 1 and the loop point of Scene 6). */
export const HookCard: React.FC<{scale: number; dx?: number; dy?: number; textOpacity?: number; t: number; vignette?: boolean}> = ({
  scale,
  dx = 0,
  dy = 0,
  textOpacity = 1,
  t,
  vignette = true,
}) => (
  <AbsoluteFill style={{background: C.hookRed}}>
    <BrushBlobs t={t} intensity={0.8} />
    {vignette ? <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(40,0,4,0.45) 100%)'}} /> : null}
    <Headline lines={EXTRA.hook} scale={scale} dx={dx} dy={dy} opacity={textOpacity} />
  </AbsoluteFill>
);
