import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {LABELS, N, SAFE, tall} from '../constants';
import {At, BigNumber, fitFont} from '../components/BigNumber';
import {BranchingTree} from '../components/BranchingTree';
import {Label} from '../components/Label';
import {ParticleMorph} from '../components/ParticleMorph';
import {Painted, PaintOverlay} from '../components/PaintOverlay';

const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const IO = Easing.inOut(Easing.cubic);
const CY = 900;
const BIG_CY = 760; // centre of the "85" line

export const scene3Bg = 'radial-gradient(ellipse 80% 60% at 50% 55%, #4a0710 0%, #1a0508 55%, #0A0607 100%)';

// Visual presence grows at each step (width coverage of the safe zone).
export const sizes = () => ({
  f400: fitFont(N.oneEach, SAFE.w, tall(250)),
  f8902: fitFont(N.threeHalf, SAFE.w * 0.78),
  f197: fitFont(N.twoEach, SAFE.w * 0.85),
  f119: fitFont(N.threeEach, SAFE.w * 0.92),
  f84: fitFont(N.fourEachExact, SAFE.w * 0.94),
  f85: fitFont(N.fourEachDisplay, SAFE.w, tall(560)),
});

type Layer = {value: string; font: number; scale?: number; scaleX?: number; opacity?: number; blur?: number; glow?: number; origin?: string; suffix?: string};

const stretch = (f: number, s: number, e: number, out: Layer, inc: Layer): Layer[] => {
  const d = e - s;
  const ou = interpolate(f, [s, s + d * 0.6 + 2], [0, 1], {...cl, easing: IO});
  const iu = interpolate(f, [s + d * 0.4 - 2, e], [0, 1], {...cl, easing: IO});
  return [
    {...out, scale: (out.scale ?? 1) * (1 + 0.35 * ou), scaleX: 1 + 0.5 * ou, opacity: 1 - ou, blur: 14 * ou},
    {
      ...inc,
      scale: 0.7 + 0.3 * iu,
      scaleX: interpolate(iu, [0, 0.8, 1], [0.6, 1.04, 1]),
      opacity: iu,
      blur: 14 * (1 - iu),
    },
  ];
};

export const Scene3Numbers: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const S = sizes();
  const camera = interpolate(f, [0, 360], [1, 0.55], {...cl, easing: Easing.inOut(Easing.sin)});
  const sceneIn = interpolate(f, [0, 10], [0, 1], cl);

  const L400: Layer = {value: N.oneEach, font: S.f400, glow: 1};
  const L8902: Layer = {value: N.threeHalf, font: S.f8902, glow: 1.1};
  const L197: Layer = {value: N.twoEach, font: S.f197, glow: 1.25};
  const L119: Layer = {value: N.threeEach, font: S.f119, glow: 1.4};
  const L84: Layer = {value: N.fourEachExact, font: S.f84, glow: 1.55};

  let layers: Layer[] = [];
  let label: {text: string; o: number}[] = [];
  const s400 = interpolate(f, [0, 45], [1, 1.1], cl);
  if (f < 45) {
    layers = [{...L400, scale: s400, opacity: sceneIn}];
    label = [{text: LABELS.oneEach, o: sceneIn}];
  } else if (f < 105) {
    const crossOut = interpolate(f, [45, 47], [1, 0], cl);
    const crossIn = interpolate(f, [71, 75], [0, 1], cl);
    layers = [
      {...L400, scale: 1.1, opacity: crossOut},
      {...L8902, opacity: crossIn},
    ];
    const lx = interpolate(f, [52, 66], [0, 1], cl);
    label = [
      {text: LABELS.oneEach, o: 1 - lx},
      {text: LABELS.threeHalf, o: lx},
    ];
  } else if (f < 165) {
    layers = stretch(f, 105, 125, L8902, L197);
    const lx = interpolate(f, [110, 120], [0, 1], cl);
    label = [
      {text: LABELS.threeHalf, o: 1 - lx},
      {text: LABELS.twoEach, o: lx},
    ];
  } else if (f < 225) {
    layers = stretch(f, 165, 185, L197, L119);
    const lx = interpolate(f, [170, 180], [0, 1], cl);
    label = [
      {text: LABELS.twoEach, o: 1 - lx},
      {text: LABELS.threeEach, o: lx},
    ];
  } else if (f < 280) {
    if (f < 250) {
      layers = stretch(f, 225, 250, L119, L84);
    } else {
      layers = [{...L84, scaleX: interpolate(f, [250, 280], [1, 1.06], cl)}];
    }
    const lx = interpolate(f, [231, 243], [0, 1], cl);
    label = [
      {text: LABELS.threeEach, o: 1 - lx},
      {text: LABELS.fourEach, o: lx},
    ];
  } else {
    // collapse toward the left, then re-form as 85 BILLION
    const cu = interpolate(f, [280, 292], [0, 1], {...cl, easing: Easing.in(Easing.cubic)});
    const sp = spring({frame: f - 288, fps, config: {damping: 13, stiffness: 150}});
    const push = interpolate(f, [300, 360], [1, 1.04], cl);
    layers = [
      {...L84, scaleX: 1.06 * (1 - 0.92 * cu), origin: 'left center', opacity: 1 - cu, blur: 10 * cu},
      {value: N.fourEachDisplay, suffix: N.fourEachUnit, font: S.f85, glow: 1.7, scale: (0.5 + 0.5 * sp) * push, opacity: interpolate(f, [288, 292], [0, 1], cl)},
    ];
    label = [{text: LABELS.fourEach, o: 1}];
  }

  const big = f >= 280;
  const sufF = Math.min(S.f85 * 0.5, fitFont(N.fourEachUnit, SAFE.w));
  const labelY = big ? BIG_CY + S.f85 * 0.475 + sufF * 0.99 + 70 : CY + 230;
  const bloom = interpolate(f, [284, 292, 320], [0, 1, 0.45], cl);
  const morphP = interpolate(f, [45, 75], [0, 1], cl);
  const particleCam = interpolate(f, [55, 65, 75], [1, 0.9, 1], {...cl, easing: IO});

  return (
    <AbsoluteFill style={{background: '#0A0607'}}>
      <Painted>
        <AbsoluteFill style={{background: scene3Bg}} />
        <BranchingTree frame={f} camera={camera} opacity={sceneIn} />
      </Painted>
      {bloom > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 50% 28% at 50% ${((BIG_CY + S.f85 * 0.3) / 1920) * 100}%, rgba(255,217,138,${0.55 * bloom}), rgba(179,16,28,${0.35 * bloom}) 45%, transparent 75%)`,
          }}
        />
      ) : null}
      {f >= 45 && f < 76 ? (
        <ParticleMorph
          frame={f}
          progress={morphP}
          camera={particleCam}
          opacity={interpolate(f, [45, 46, 71, 75], [0, 1, 1, 0], cl)}
          a={{text: N.oneEach, font: S.f400 * 1.1, cx: 540, cy: CY}}
          b={{text: N.threeHalf, font: S.f8902, cx: 540, cy: CY}}
        />
      ) : null}
      {layers.map((l, i) =>
        (l.opacity ?? 1) > 0.001 ? (
          <At key={l.value + i} x={540} y={l.suffix ? BIG_CY : CY}>
            <BigNumber
              value={l.value}
              suffix={l.suffix}
              fontSize={l.font}
              scale={l.scale ?? 1}
              scaleX={l.scaleX ?? 1}
              opacity={l.opacity ?? 1}
              blur={l.blur ?? 0}
              glow={l.glow ?? 1}
              origin={l.origin}
              style={l.suffix ? {transform: `translate(-50%, -${(0.95 * l.font) / 2}px) scale(${l.scale ?? 1})`} : undefined}
            />
          </At>
        ) : null,
      )}
      {label.map((lb, i) =>
        lb.o > 0.001 ? (
          <At key={lb.text + i} x={540} y={labelY}>
            <Label text={lb.text} opacity={lb.o} />
          </At>
        ) : null,
      )}
      <PaintOverlay />
    </AbsoluteFill>
  );
};
