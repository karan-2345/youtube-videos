import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, EXTRA, N, tall} from '../constants';
import {At, BigNumber} from '../components/BigNumber';
import {ChessBoard} from '../components/ChessBoard';
import {Label} from '../components/Label';
import {Painted, PaintOverlay} from '../components/PaintOverlay';

const cl = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const EO = Easing.bezier(0.22, 1, 0.36, 1);
const FILES = 'abcdefgh';
const BOARD = 880;
const BOARD_CY = 820;

export const Scene2Moves: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();

  // board entrance + final zoom into the board
  const boardIn = interpolate(f, [0, 20], [0, 1], {...cl, easing: EO});
  const zoom = interpolate(f, [185, 210], [1, 3.2], {...cl, easing: Easing.in(Easing.cubic)});
  const boardOpacity = boardIn * interpolate(f, [150, 175], [1, 0.25], cl);
  const blur = interpolate(f, [185, 210], [0, 7], cl);

  // highlights: 8 pawns then 2 knights, 2-frame stagger
  const hlOrder = [...FILES.split('').map((c) => c + '2'), 'b1', 'g1'];
  const highlight: Record<string, number> = {};
  hlOrder.forEach((sq, i) => {
    highlight[sq] = interpolate(f, [20 + 2 * i, 28 + 2 * i], [0, 1], cl) * interpolate(f, [150, 175], [1, 0.3], cl);
  });
  const dim = interpolate(f, [20, 35], [1, 0.4], cl);

  // destinations: 16 pawn dots left to right, then the 4 knight dots
  const moveDots: Record<string, number> = {};
  FILES.split('').forEach((c, k) => {
    [3, 4].forEach((r, j) => {
      const st = 30 + 2 * (2 * k + j);
      moveDots[c + r] = spring({frame: f - st, fps, config: {damping: 14, stiffness: 160}});
    });
  });
  ['a3', 'c3', 'f3', 'h3'].forEach((sq, i) => {
    const st = 70 + 4 * i;
    const extra = spring({frame: f - st, fps, config: {damping: 9, stiffness: 160}});
    moveDots[sq] = (moveDots[sq] ?? 0) + 0.35 * extra; // knight dots pop bigger
  });
  const dotOpacity = interpolate(f, [150, 170], [1, 0.25], cl);

  // numbers row
  const F = tall(150);
  const n16 = spring({frame: f - 60, fps, config: {damping: 12, stiffness: 170}});
  const n4 = spring({frame: f - 100, fps, config: {damping: 12, stiffness: 170}});
  const merge = interpolate(f, [130, 142], [0, 1], {...cl, easing: Easing.inOut(Easing.cubic)});
  const n20 = spring({frame: f - 134, fps, config: {damping: 12, stiffness: 170}});
  const x16 = interpolate(merge, [0, 1], [330, 540]);
  const x4 = interpolate(merge, [0, 1], [730, 540]);
  const rowY = 1440;
  // 20 grows to ~420px tall and moves to the centre
  const grow = interpolate(f, [150, 178], [0, 1], {...cl, easing: Easing.inOut(Easing.cubic)});
  const y20 = interpolate(grow, [0, 1], [rowY, 960]);
  const s20 = interpolate(grow, [0, 1], [1, tall(420) / F]);
  const settle = f > 168 ? 1 + 0.08 * Math.sin(Math.min(1, (f - 168) / 18) * Math.PI) * Math.exp(-Math.max(0, f - 168) / 30) : 1;
  const o20 = interpolate(f, [185, 200], [1, 0], cl);
  const darken = interpolate(f, [192, 210], [0, 0.85], cl);
  const light = {x: 0.22 + 0.12 * Math.sin(f / 45), y: 0.18 + 0.06 * Math.cos(f / 60), strength: 0.8};

  return (
    <AbsoluteFill style={{background: C.nearBlack}}>
      <Painted>
        <AbsoluteFill style={{background: `radial-gradient(ellipse 60% 40% at 50% ${(BOARD_CY / 1920) * 100}%, rgba(139,10,20,0.55), transparent 75%)`}} />
        <div
          style={{
            position: 'absolute',
            left: 540 - BOARD / 2,
            top: BOARD_CY - BOARD / 2,
            opacity: boardOpacity,
            transform: `scale(${(0.92 + 0.08 * boardIn) * zoom})`,
            filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
          }}
        >
          <ChessBoard size={BOARD} highlight={highlight} dimOthers={dim} moveDots={moveDots} dotOpacity={dotOpacity} lighting={light} />
        </div>
      </Painted>
      {/* numbers (never displaced) */}
      {f >= 60 && merge < 1 ? (
        <At x={x16} y={rowY}>
          <BigNumber value={N.pawnMoves} fontSize={F} scale={0.6 + 0.4 * n16} opacity={Math.min(1, n16 * 2) * (1 - merge)} />
        </At>
      ) : null}
      {f >= 100 && merge < 1 ? (
        <At x={x4} y={rowY}>
          <BigNumber value={EXTRA.plus4} fontSize={F} scale={0.6 + 0.4 * n4} opacity={Math.min(1, n4 * 2) * (1 - merge)} />
        </At>
      ) : null}
      {f >= 60 ? (
        <At x={330} y={rowY + 150}>
          <Label text={EXTRA.pawnMoves} size={40} opacity={Math.min(1, n16) * interpolate(f, [128, 140], [1, 0], cl)} />
        </At>
      ) : null}
      {f >= 100 ? (
        <At x={730} y={rowY + 150}>
          <Label text={EXTRA.knightMoves} size={40} opacity={Math.min(1, n4) * interpolate(f, [128, 140], [1, 0], cl)} />
        </At>
      ) : null}
      {f >= 134 ? (
        <At x={540} y={y20}>
          <BigNumber value={N.moves20} fontSize={F} scale={(0.6 + 0.4 * n20) * s20 * settle} opacity={Math.min(1, n20 * 2) * o20} glow={1 + grow * 0.4} />
        </At>
      ) : null}
      <AbsoluteFill style={{background: '#050304', opacity: darken}} />
      <PaintOverlay />
    </AbsoluteFill>
  );
};
