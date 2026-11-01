// ABSOLUTE RULE: these strings are never computed, rounded or reformatted.
export const N = {
  moves20: '20',
  pawnMoves: '16',
  knightMoves: '4',
  oneEach: '400',
  threeHalf: '8,902',
  twoEach: '197,281',
  threeEach: '119,060,324',
  fourEachExact: '84,998,978,956',
  fourEachDisplay: '85',
  fourEachUnit: 'BILLION',
  shannonChoices: '30',
  shannonBase: '10',
  shannonExp: '120',
  atomsBase: '10',
  atomsExp: '80',
} as const;

export const LABELS = {
  oneEach: '1 MOVE EACH',
  threeHalf: '3 HALF-MOVES',
  twoEach: '2 MOVES EACH',
  threeEach: '3 MOVES EACH',
  fourEach: '4 MOVES EACH',
  choices: '~30 CHOICES PER TURN',
  shannon: "SHANNON'S ESTIMATE",
  atoms: 'ATOMS IN THE OBSERVABLE UNIVERSE',
  games: 'POSSIBLE CHESS GAMES',
} as const;

// Extra labels used inline by the scene descriptions.
export const EXTRA = {
  pawnMoves: 'PAWN MOVES',
  knightMoves: 'KNIGHT MOVES',
  plus4: '+ 4',
  moreZeros: '40 MORE ZEROS',
  hook: ['YOU THINK', 'CHESS IS', 'EASY?'],
  close: ['AND IT ALL', 'STARTS WITH', 'JUST', '20', 'MOVES.'],
} as const;

export const C = {
  crimson: '#8B0A14',
  hookRed: '#B3101C',
  nearBlack: '#0A0607',
  charcoal: '#16100F',
  gold: '#E8B04A',
  goldGlow: '#FFD98A',
  white: '#FFFFFF',
  lightSq: '#D9C7A3',
  darkSq: '#5A1D1F',
  ivory: '#F2E6CC',
  blackPiece: '#1A0A0C',
  spaceA: '#04030A',
  spaceB: '#0B0716',
} as const;

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const DURATION = 1500;

// Safe zone for all important text.
export const SAFE = {x0: 60, x1: 1020, y0: 250, y1: 1670, w: 960, h: 1420} as const;

export const SCENES = {
  s1: {from: 0, dur: 120},
  s2: {from: 120, dur: 210},
  s3: {from: 330, dur: 360},
  s4: {from: 690, dur: 240},
  s5: {from: 930, dur: 300},
  s6: {from: 1230, dur: 270},
} as const;

// Inter digit/cap height as a fraction of font size: px tall -> font size.
export const CAP = 0.727;
export const tall = (px: number) => px / CAP;
