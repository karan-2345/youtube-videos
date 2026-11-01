import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, EXTRA, N, SCENES} from '../constants';
import {At, BigNumber} from '../components/BigNumber';
import {ChessBoard} from '../components/ChessBoard';
import {Painted, PaintOverlay} from '../components/PaintOverlay';
import {Starfield} from '../components/Starfield';
import {Headline, HookCard} from './HookCard';
import {impact} from './Scene1Hook';
import {NUM_Y, shannonFont} from './Scene4Shannon';

const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const Scene6Close: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = SCENES.s6.from + f;
  const spaceOut = interpolate(f, [0, 30], [1, 0], cl);
  const boardSp = spring({frame: f - 20, fps, config: {damping: 15, stiffness: 120}});
  const boardO = interpolate(f, [20, 35], [0, 1], cl);
  const zoom =
    interpolate(f, [80, 240], [1, 1.12], {...cl, easing: Easing.inOut(Easing.sin)}) +
    interpolate(f, [240, 270], [0, 0.01], {...cl, easing: Easing.out(Easing.cubic)});
  const tint = interpolate(f, [240, 255], [0, 0.35], cl);
  const loop = interpolate(f, [255, 269], [0, 1], {...cl, easing: Easing.inOut(Easing.cubic)});
  const txt = impact(f, 40, fps);
  const scrim = interpolate(f, [36, 46], [0, 1], cl);
  const light = {x: 0.25 + 0.1 * Math.sin(f / 50), y: 0.2, strength: 0.8};

  return (
    <AbsoluteFill style={{background: C.nearBlack}}>
      <Painted>
        <AbsoluteFill style={{background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(139,10,20,0.55), transparent 75%)'}} />
        <div style={{position: 'absolute', left: 100, top: 520, opacity: boardO, transform: `scale(${(0.96 + 0.04 * boardSp) * zoom})`}}>
          <ChessBoard size={880} lighting={light} />
        </div>
      </Painted>
      {spaceOut > 0 ? (
        <AbsoluteFill style={{opacity: spaceOut}}>
          <Starfield t={t} />
          <At x={540} y={NUM_Y}>
            <BigNumber value={N.shannonBase} exponent={N.shannonExp} fontSize={shannonFont()} opacity={interpolate(f, [0, 20], [1, 0], cl)} glow={2} />
          </At>
        </AbsoluteFill>
      ) : null}
      {f >= 40 ? (
        <>
          <AbsoluteFill
            style={{
              opacity: scrim,
              background: 'linear-gradient(180deg, transparent 18%, rgba(10,6,7,0.78) 32%, rgba(10,6,7,0.82) 68%, transparent 82%)',
            }}
          />
          <Headline lines={EXTRA.close} bigIndex={3} scale={txt.scale} dx={txt.dx} dy={txt.dy} opacity={txt.opacity} />
        </>
      ) : null}
      <AbsoluteFill style={{background: C.hookRed, opacity: tint, mixBlendMode: 'multiply'}} />
      <PaintOverlay />
      {loop > 0 ? (
        <AbsoluteFill style={{opacity: loop}}>
          <HookCard scale={1.0} t={t} />
          <PaintOverlay vignette={false} blobs={false} grain={0.1} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
