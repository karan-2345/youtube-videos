import React from 'react';
import {C} from '../constants';
import {Piece, PieceColor, PieceDefs, PieceType} from './Pieces';

const FILES = 'abcdefgh';
const BACK: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export type Sq = string; // e.g. "e2"
export const sqXY = (sq: Sq) => {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]);
  return {x: f * 100, y: (8 - r) * 100};
};

export const START: {sq: Sq; type: PieceType; color: PieceColor}[] = [];
for (let f = 0; f < 8; f++) {
  START.push({sq: FILES[f] + '1', type: BACK[f], color: 'w'});
  START.push({sq: FILES[f] + '2', type: 'p', color: 'w'});
  START.push({sq: FILES[f] + '7', type: 'p', color: 'b'});
  START.push({sq: FILES[f] + '8', type: BACK[f], color: 'b'});
}

type Props = {
  size: number;
  showPieces?: boolean;
  highlight?: Record<Sq, number>; // square -> glow 0..1
  moveDots?: Record<Sq, number>; // square -> scale 0..1
  dimOthers?: number; // opacity of non-highlighted pieces
  pulse?: number;
  tilt?: {rotateX: number; rotateZ: number};
  lighting?: {x: number; y: number; strength?: number}; // 0..1 light centre
  rim?: number; // gold rim light (space scene)
  dotOpacity?: number;
};

/** 8x8 board, White at the bottom, a1 dark, h1 light. viewBox 0 0 800 800. */
export const ChessBoard: React.FC<Props> = ({
  size,
  showPieces = true,
  highlight = {},
  moveDots = {},
  dimOthers = 1,
  pulse = 0,
  tilt,
  lighting = {x: 0.25, y: 0.2, strength: 0.5},
  rim = 0,
  dotOpacity = 1,
}) => {
  const squares = [];
  for (let f = 0; f < 8; f++) {
    for (let r = 1; r <= 8; r++) {
      const dark = (f + r) % 2 === 1; // a1 (f0,r1) -> dark
      squares.push(<rect key={`${f}${r}`} x={f * 100} y={(8 - r) * 100} width={100} height={100} fill={dark ? C.darkSq : C.lightSq} />);
    }
  }
  const hasHL = Object.keys(highlight).length > 0;
  return (
    <div
      style={{
        width: size,
        height: size,
        transform: tilt ? `rotateX(${tilt.rotateX}deg) rotateZ(${tilt.rotateZ}deg)` : undefined,
        transformStyle: 'preserve-3d',
        boxShadow: rim
          ? `0 0 ${60 * rim}px rgba(232,176,74,${0.45 * rim}), 0 0 ${180 * rim}px rgba(255,217,138,${0.18 * rim})`
          : '0 30px 80px rgba(0,0,0,0.6)',
      }}
    >
      <svg viewBox="-14 -14 828 828" width={size} height={size} style={{display: 'block'}}>
        <PieceDefs />
        <defs>
          <filter id="wood" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves={3} seed={3} />
            <feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.05  0 0 0 0 0.02  0 0 0 0.22 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          <radialGradient id="light" cx={lighting.x} cy={lighting.y} r="0.9">
            <stop offset="0%" stopColor="#FFE9B8" stopOpacity={0.35 * (lighting.strength ?? 0.5)} />
            <stop offset="60%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.45} />
          </radialGradient>
          <radialGradient id="dot">
            <stop offset="0%" stopColor={C.goldGlow} />
            <stop offset="45%" stopColor={C.gold} />
            <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="ring">
            <stop offset="55%" stopColor={C.gold} stopOpacity={0} />
            <stop offset="75%" stopColor={C.goldGlow} stopOpacity={0.9} />
            <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* thin gold border */}
        <rect x={-14} y={-14} width={828} height={828} fill="#1c0e0c" />
        <rect x={-6} y={-6} width={812} height={812} fill="none" stroke={C.gold} strokeWidth={3} opacity={0.8} />
        <g>{squares}</g>
        <rect x={0} y={0} width={800} height={800} fill="#fff" filter="url(#wood)" />
        {/* soft inner shadow + moving light */}
        <rect x={0} y={0} width={800} height={800} fill="url(#light)" />
        <rect x={0} y={0} width={800} height={800} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={14} />
        {Object.entries(highlight).map(([sq, t]) => {
          const {x, y} = sqXY(sq);
          return <circle key={'h' + sq} cx={x + 50} cy={y + 52} r={58 + pulse * 6} fill="url(#ring)" opacity={t} />;
        })}
        {showPieces
          ? START.map((p) => {
              const {x, y} = sqXY(p.sq);
              const op = hasHL ? (highlight[p.sq] !== undefined ? 1 : dimOthers) : dimOthers;
              return <Piece key={p.sq} type={p.type} color={p.color} x={x} y={y} opacity={op} />;
            })
          : null}
        {Object.entries(moveDots).map(([sq, s]) => {
          const {x, y} = sqXY(sq);
          return (
            <g key={'d' + sq} opacity={dotOpacity} transform={`translate(${x + 50} ${y + 50}) scale(${Math.max(0, s)})`}>
              <circle r={34} fill="url(#dot)" opacity={0.55} />
              <circle r={13} fill={C.goldGlow} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
