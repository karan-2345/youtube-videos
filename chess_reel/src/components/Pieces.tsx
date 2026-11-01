import React from 'react';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

// Silhouettes drawn in a 100x100 box, standing on y≈86.
const BASE = 'M24 88 Q24 80 32 78 H68 Q76 80 76 88 Z';
const PATHS: Record<PieceType, string[]> = {
  p: [BASE, 'M36 78 Q40 64 43 54 H57 Q60 64 64 78 Z', 'M36 55 Q36 48 50 48 Q64 48 64 55 Z', 'M50 24 A12.5 12.5 0 1 1 49.9 24 Z'],
  r: [
    BASE,
    'M31 78 L35 47 H65 L69 78 Z',
    'M30 48 V24 H39 V31 H46 V24 H54 V31 H61 V24 H70 V48 Z',
  ],
  b: [
    BASE,
    'M37 78 Q40 64 44 56 H56 Q60 64 63 78 Z',
    'M36 58 Q36 52 50 52 Q64 52 64 58 Z',
    'M50 17 C35 29 33 43 41 52 H59 C67 43 65 29 50 17 Z',
    'M50 8 A5 5 0 1 1 49.9 8 Z',
  ],
  n: [
    'M26 88 Q26 81 33 79 H71 Q77 81 77 88 Z',
    'M35 79 C35 68 40 60 47 54 C40 55 33 58 27 60 C21 56 22 49 26 45 L41 30 C43 22 47 15 52 11 L56 20 C67 22 76 36 76 52 C76 64 72 72 71 79 Z',
  ],
  q: [
    BASE,
    'M34 78 L40 53 H60 L66 78 Z',
    'M36 54 L27 29 L41 41 L42 21 L50 37 L58 21 L59 41 L73 29 L64 54 Z',
    'M27 25 A4.5 4.5 0 1 1 26.9 25 Z',
    'M42 17 A4.5 4.5 0 1 1 41.9 17 Z',
    'M58 17 A4.5 4.5 0 1 1 57.9 17 Z',
    'M73 25 A4.5 4.5 0 1 1 72.9 25 Z',
    'M50 31 A4 4 0 1 1 49.9 31 Z',
  ],
  k: [
    BASE,
    'M34 78 L40 51 H60 L66 78 Z',
    'M34 52 C28 38 40 30 50 39 C60 30 72 38 66 52 Z',
    'M47 8 H53 V15 H59 V21 H53 V33 H47 V21 H41 V15 H47 Z',
  ],
};

export const PieceDefs: React.FC = () => (
  <defs>
    <radialGradient id="pg-w" cx="32%" cy="25%" r="85%">
      <stop offset="0%" stopColor="#FFF8E8" />
      <stop offset="45%" stopColor="#F2E6CC" />
      <stop offset="85%" stopColor="#C9A86A" />
      <stop offset="100%" stopColor="#8E6A35" />
    </radialGradient>
    <radialGradient id="pg-b" cx="32%" cy="25%" r="85%">
      <stop offset="0%" stopColor="#5A2228" />
      <stop offset="40%" stopColor="#2A0F13" />
      <stop offset="100%" stopColor="#1A0A0C" />
    </radialGradient>
    <filter id="pshadow" x="-40%" y="-40%" width="200%" height="200%">
      <feDropShadow dx="7" dy="9" stdDeviation="5" floodColor="#000" floodOpacity="0.55" />
    </filter>
  </defs>
);

export const Piece: React.FC<{type: PieceType; color: PieceColor; x: number; y: number; opacity?: number}> = ({
  type,
  color,
  x,
  y,
  opacity = 1,
}) => {
  const fill = color === 'w' ? 'url(#pg-w)' : 'url(#pg-b)';
  const stroke = color === 'w' ? '#5b3e1c' : '#9b2a33'; // crimson rim light on black
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity} filter="url(#pshadow)">
      {PATHS[type].map((d, i) => (
        <path key={i} d={d} fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
      ))}
      {type === 'n' ? <circle cx={45} cy={33} r={2.6} fill={color === 'w' ? '#3a2410' : '#d0565f'} /> : null}
      {type === 'b' ? <path d="M54 27 L45 40" stroke={color === 'w' ? '#6b4a22' : '#b5434c'} strokeWidth={3} strokeLinecap="round" /> : null}
    </g>
  );
};
