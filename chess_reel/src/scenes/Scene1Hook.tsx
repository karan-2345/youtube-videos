import React from 'react';
import {AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {HookCard} from './HookCard';
import {PaintOverlay} from '../components/PaintOverlay';

export const HOOK_SPRING = {damping: 12, stiffness: 180, mass: 0.6};

export const impact = (f: number, start: number, fps: number) => {
  const s = spring({frame: f - start, fps, config: HOOK_SPRING});
  const scale = 1.6 - 0.6 * s;
  const amp = interpolate(f, [start, start + 6], [18, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const dx = f >= start && f <= start + 6 ? (random('shx' + f) - 0.5) * 2 * amp : 0;
  const dy = f >= start && f <= start + 6 ? (random('shy' + f) - 0.5) * 2 * amp : 0;
  const opacity = interpolate(f, [start, start + 3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return {scale, dx, dy, opacity};
};

export const Scene1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (f < 6) return <AbsoluteFill style={{background: '#000'}} />;
  const {scale, dx, dy, opacity} = impact(f, 6, fps);
  const push = interpolate(f, [12, 120], [1, 1.04], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill>
      <HookCard scale={scale * push} dx={dx} dy={dy} textOpacity={opacity} t={f} />
      <PaintOverlay vignette={false} blobs={false} grain={0.1} />
    </AbsoluteFill>
  );
};
