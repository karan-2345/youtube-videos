import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {LABELS, N, SAFE, SCENES, tall} from '../constants';
import {At, BigNumber, baseCenterOffset, fitFont} from '../components/BigNumber';
import {BranchingTree} from '../components/BranchingTree';
import {BranchWeb} from '../components/BranchWeb';
import {ChessBoard} from '../components/ChessBoard';
import {Label} from '../components/Label';
import {ParticleMorph} from '../components/ParticleMorph';
import {Painted, PaintOverlay} from '../components/PaintOverlay';
import {Starfield} from '../components/Starfield';
import {scene3Bg, sizes} from './Scene3Numbers';

const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const EO = Easing.bezier(0.22, 1, 0.36, 1);
export const NUM_Y = 700;
export const shannonFont = () => fitFont(N.shannonBase, SAFE.w, tall(400), N.shannonExp);

/** Floating, tilted board in space (also used by Scene 5's opening). */
export const SpaceBoard: React.FC<{f: number; t: number; opacity: number; scale: number}> = ({t, opacity, scale}) => {
  const rz = interpolate(t, [SCENES.s4.from, SCENES.s4.from + 240], [-12, 8], cl);
  const fy = Math.sin(t / 28) * 8;
  return (
    <div style={{position: 'absolute', left: 540 - 350, top: 1270 - 350 + fy, width: 700, height: 700, perspective: 1600, opacity, transform: `scale(${scale})`}}>
      <ChessBoard size={700} tilt={{rotateX: 58, rotateZ: rz}} rim={1} lighting={{x: 0.3, y: 0.2, strength: 0.9}} />
    </div>
  );
};

export const Scene4Shannon: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = SCENES.s4.from + f;
  const S = sizes();
  const space = interpolate(f, [0, 30], [0, 1], cl);
  const boardIn = interpolate(f, [0, 40], [0, 1], {...cl, easing: EO});
  const pull = interpolate(f, [190, 240], [1, 0.82], {...cl, easing: Easing.inOut(Easing.sin)});
  const shrinkWorld = interpolate(f, [150, 240], [1, 0.7], {...cl, easing: Easing.inOut(Easing.sin)});

  const F30 = fitFont(N.shannonChoices, SAFE.w, tall(420));
  const F10 = shannonFont();
  const in30 = spring({frame: f - 30, fps, config: {damping: 13, stiffness: 160}});
  const s30 = interpolate(f, [90, 150], [1, 0.8], cl);
  const o30 = interpolate(f, [90, 150], [1, 0.55], cl);
  const morphP = interpolate(f, [150, 176], [0, 1], cl);
  const expS = spring({frame: f - 170, fps, config: {damping: 11, stiffness: 170}});
  const show10 = interpolate(f, [172, 176], [0, 1], cl);
  const baseX = 540 + baseCenterOffset(N.shannonBase, N.shannonExp, F10);
  const shimmer = interpolate(f, [170, 178, 190], [0, 1, 0], cl);

  return (
    <AbsoluteFill style={{background: '#04030A'}}>
      <Painted>
        <AbsoluteFill style={{background: scene3Bg, opacity: 1 - space}} />
        {f < 30 ? <BranchingTree frame={360} camera={0.55} opacity={1 - space} /> : null}
        <Starfield t={t} opacity={space} />
        <AbsoluteFill style={{transform: `scale(${pull * shrinkWorld})`, transformOrigin: '50% 66%'}}>
          <BranchWeb frame={f} ox={540} oy={1230} opacity={interpolate(f, [190, 240], [1, 0.6], cl)} />
          <SpaceBoard f={f} t={t} opacity={boardIn} scale={0.9 + 0.1 * boardIn} />
        </AbsoluteFill>
      </Painted>
      {f < 20 ? (
        <At x={540} y={760}>
          <BigNumber value={N.fourEachDisplay} suffix={N.fourEachUnit} fontSize={S.f85} opacity={0.1 * (1 - f / 20)} />
        </At>
      ) : null}
      {f >= 30 && f < 152 ? (
        <>
          <At x={540} y={NUM_Y}>
            <BigNumber value={N.shannonChoices} fontSize={F30} scale={(0.6 + 0.4 * in30) * s30} opacity={Math.min(1, in30 * 2) * o30 * interpolate(f, [150, 152], [1, 0], cl)} />
          </At>
          <At x={540} y={NUM_Y + F30 * 0.55 + 50}>
            <Label text={LABELS.choices} opacity={Math.min(1, in30) * interpolate(f, [120, 150], [1, 0], cl)} />
          </At>
        </>
      ) : null}
      {f >= 150 && f < 177 ? (
        <ParticleMorph
          frame={f}
          progress={morphP}
          opacity={interpolate(f, [150, 151, 172, 176], [0.55, 1, 1, 0], cl)}
          spread={220}
          a={{text: N.shannonChoices, font: F30 * 0.8, cx: 540, cy: NUM_Y}}
          b={{text: N.shannonBase, font: F10, cx: baseX, cy: NUM_Y}}
        />
      ) : null}
      {f >= 172 ? (
        <At x={540} y={NUM_Y}>
          {shimmer > 0 ? (
            <div style={{position: 'absolute', left: baseX - 540 + F10 * 0.9, top: -F10 * 0.55, width: F10 * 1.2, height: F10 * 0.6, transform: 'translate(-20%, -50%)', borderRadius: '50%', background: `radial-gradient(ellipse, rgba(255,217,138,${0.6 * shimmer}), transparent 70%)`}} />
          ) : null}
          <BigNumber value={N.shannonBase} exponent={N.shannonExp} exponentScale={f >= 170 ? expS : 0} fontSize={F10} opacity={show10} glow={1.3 + shimmer * 0.6} />
        </At>
      ) : null}
      {f >= 195 ? (
        <At x={540} y={NUM_Y + F10 * 0.55 + 60}>
          <Label text={LABELS.shannon} opacity={interpolate(f, [195, 210], [0, 1], cl)} />
        </At>
      ) : null}
      <PaintOverlay />
    </AbsoluteFill>
  );
};
