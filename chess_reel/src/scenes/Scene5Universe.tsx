import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {EXTRA, LABELS, N, SAFE, SCENES, tall} from '../constants';
import {At, BigNumber, fitFont} from '../components/BigNumber';
import {Label} from '../components/Label';
import {ParticleField} from '../components/ParticleField';
import {Painted, PaintOverlay} from '../components/PaintOverlay';
import {Starfield} from '../components/Starfield';
import {NUM_Y, shannonFont} from './Scene4Shannon';

const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const IO = Easing.inOut(Easing.cubic);

export const Scene5Universe: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = SCENES.s5.from + f;
  const F120 = shannonFont();
  const F80 = Math.min(F120, fitFont(N.atomsBase, SAFE.w, tall(400), N.atomsExp));

  const camera =
    f < 150
      ? interpolate(f, [120, 150], [1, 0.35], {...cl, easing: IO})
      : interpolate(f, [150, 300], [0.35, 0.28], cl);
  const wave = interpolate(f, [150, 280], [0, 1], {...cl, easing: Easing.out(Easing.quad)});
  const oldOpacity = interpolate(f, [0, 20], [0, 1], cl) * interpolate(f, [200, 260], [1, 0.25], cl);

  // 10^120 out (from Scene 4), 10^80 in
  const outU = interpolate(f, [0, 20], [0, 1], {...cl, easing: IO});
  const in80 = interpolate(f, [2, 20], [0, 1], {...cl, easing: Easing.bezier(0.22, 1, 0.36, 1)});
  const breathe = 1 + 0.02 * Math.sin((f / 120) * Math.PI);
  const o80 = in80 * interpolate(f, [120, 140], [1, 0], cl);
  const sp = spring({frame: f - 150, fps, config: {damping: 12, stiffness: 160}});
  const o120 = interpolate(f, [150, 156], [0, 1], cl);
  const glow = interpolate(f, [230, 300], [1.4, 2], cl);

  return (
    <AbsoluteFill style={{background: '#04030A'}}>
      <Painted>
        <Starfield t={t} />
        <ParticleField frame={f} camera={camera} wave={wave} oldOpacity={oldOpacity} glow={interpolate(f, [230, 300], [1, 1.25], cl)} />
      </Painted>
      {f < 20 ? (
        <At x={540} y={NUM_Y}>
          <BigNumber value={N.shannonBase} exponent={N.shannonExp} fontSize={F120} scale={1 - 0.4 * outU} opacity={1 - outU} glow={1.3} />
        </At>
      ) : null}
      {o80 > 0 ? (
        <>
          <At x={540} y={NUM_Y}>
            <BigNumber value={N.atomsBase} exponent={N.atomsExp} fontSize={F80} scale={(0.6 + 0.4 * in80) * breathe} opacity={o80} glow={1.2} />
          </At>
          <At x={540} y={NUM_Y + F80 * 0.55 + 60}>
            <Label text={LABELS.atoms} opacity={interpolate(f, [10, 30], [0, 1], cl) * interpolate(f, [118, 135], [1, 0], cl)} />
          </At>
        </>
      ) : null}
      {f >= 150 ? (
        <>
          <At x={540} y={NUM_Y}>
            <BigNumber value={N.shannonBase} exponent={N.shannonExp} fontSize={F120} scale={0.6 + 0.4 * sp} opacity={o120} glow={glow} />
          </At>
          <At x={540} y={NUM_Y + F120 * 0.55 + 60}>
            <Label text={LABELS.games} opacity={interpolate(f, [160, 178], [0, 1], cl)} />
          </At>
          <At x={540} y={NUM_Y + F120 * 0.55 + 140}>
            <Label text={EXTRA.moreZeros} size={40} color="#FFD98A" opacity={interpolate(f, [240, 256], [0, 1], cl)} />
          </At>
        </>
      ) : null}
      <PaintOverlay />
    </AbsoluteFill>
  );
};
