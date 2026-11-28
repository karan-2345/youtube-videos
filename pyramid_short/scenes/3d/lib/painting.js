// scenes/3d/lib/painting.js -- the wall painting from Djehutihotep's tomb, redrawn procedurally in the Egyptian
// manner (flat colour, red-brown men, white kilts, black wigs, registers, a hieroglyph band): the colossus seated on
// its sledge at the left, a man on its knee clapping the rhythm, a man on the front of the sledge pouring water on
// the ground, and 4 rows of 43 men (172) hauling on the ropes. Not a copy of the original (which is lost: destroyed
// in 1890); a clear, readable re-drawing of what it shows.
//
// Two canvases: colour, and a mask (R = index of each hauler 1..172, G = the pourer, B = the water).
import * as THREE from 'three';
import { NOISE, mulberry, patch } from './common.js';

export const PW = 4096, PH = 2048;
export const WALL = { w: 8.0, h: 4.0 };
export const ROWS = 4, PER_ROW = 43;
export const REG = { y0: 380, rowH: 375, x0: 1480, x1: 4020 };
export const SLEDGE = { x0: 150, x1: 1380, y: 1850 };
export const POURER = { x: 1300, y: 1792, h: 300 };            // where the pourer stands (feet)
export const WATER = { x0: 1395, y0: 1560, x1: 1470, y1: 1850 }; // the stream, from the jar to the ground
export const STATUE = { x: 640, y: 1790 };

const SKIN = '#9B4A2C', SKIN2 = '#8A3F25', KILT = '#F3ECDE', WIG = '#1C1916', LINE = '#3A2414', BLUE = '#2F7DB5', ROPE = '#6B4A24';

function drawMan(c, m, x, y, h, { pose = 'pull', phase = 0, maskIdx = 0, maskG = 0 } = {}) {
  const k = h;
  const fill = (col, mcol) => { c.fillStyle = col; c.fill(); if (m) { m.fillStyle = mcol; m.fill(); } };
  const path = (fn) => { c.beginPath(); if (m) m.beginPath(); fn(c); if (m) fn(m); };
  const mc = `rgb(${maskIdx},${maskG},0)`;
  const sx = Math.sin(phase) * 0.03 * k;
  // back leg, front leg (stride)
  const lean = pose === 'pull' ? 0.07 * k : 0;
  const hipX = x + lean * 0.4, hipY = y - 0.47 * k;
  const legs = [[x - 0.13 * k - sx, y], [x + 0.15 * k + sx, y]];
  for (const [fx, fy] of legs) {
    path((g) => { g.moveTo(hipX - 0.035 * k, hipY); g.lineTo(fx - 0.03 * k, fy - 0.04 * k); g.lineTo(fx + 0.06 * k, fy - 0.03 * k); g.lineTo(fx + 0.075 * k, fy);
      g.lineTo(fx - 0.04 * k, fy); g.lineTo(fx - 0.045 * k, fy - 0.05 * k); g.lineTo(hipX + 0.045 * k, hipY); g.closePath(); });
    fill(SKIN2, mc);
  }
  // torso (shoulders seen from the front, as in Egyptian drawing), leaning into the rope
  const shX = x + lean, shY = y - 0.8 * k;
  path((g) => { g.moveTo(hipX - 0.06 * k, hipY - 0.02 * k); g.lineTo(shX - 0.13 * k, shY); g.lineTo(shX + 0.13 * k, shY); g.lineTo(hipX + 0.06 * k, hipY - 0.02 * k); g.closePath(); });
  fill(SKIN, mc);
  // kilt
  path((g) => { g.moveTo(hipX - 0.075 * k, hipY - 0.06 * k); g.lineTo(hipX + 0.075 * k, hipY - 0.06 * k); g.lineTo(hipX + 0.15 * k, y - 0.31 * k); g.lineTo(hipX - 0.09 * k, y - 0.33 * k); g.closePath(); });
  fill(KILT, mc);
  c.strokeStyle = LINE; c.lineWidth = 2; c.stroke();
  // head: wig and face, in profile facing +x
  const hx = shX + 0.03 * k, hy = y - 0.9 * k;
  path((g) => { g.ellipse(hx + 0.01 * k, hy, 0.062 * k, 0.07 * k, 0, 0, Math.PI * 2); });
  fill(SKIN, mc);
  path((g) => { g.ellipse(hx - 0.012 * k, hy - 0.012 * k, 0.062 * k, 0.07 * k, 0, Math.PI * 0.55, Math.PI * 1.95); g.lineTo(hx - 0.012 * k, hy + 0.03 * k); g.closePath(); });
  fill(WIG, mc);
  c.fillStyle = '#F4EFE6'; c.beginPath(); c.ellipse(hx + 0.035 * k, hy - 0.008 * k, 0.012 * k, 0.007 * k, 0, 0, 6.28); c.fill();
  c.fillStyle = WIG; c.beginPath(); c.arc(hx + 0.039 * k, hy - 0.008 * k, 0.005 * k, 0, 6.28); c.fill();
  // arms
  c.lineCap = 'round'; c.lineWidth = 0.045 * k; c.strokeStyle = SKIN;
  if (m) { m.lineCap = 'round'; m.lineWidth = 0.045 * k; m.strokeStyle = mc; }
  const arm = (ax, ay, ex, ey, hx2, hy2) => {
    for (const g of m ? [c, m] : [c]) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.lineTo(hx2, hy2); g.stroke(); }
  };
  if (pose === 'pull') {
    arm(shX - 0.1 * k, shY + 0.02 * k, shX + 0.02 * k, shY + 0.14 * k, shX + 0.17 * k, shY - 0.01 * k);
    arm(shX + 0.1 * k, shY + 0.02 * k, shX + 0.18 * k, shY + 0.12 * k, shX + 0.26 * k, shY + 0.02 * k);
  } else if (pose === 'pour') {
    arm(shX - 0.1 * k, shY + 0.02 * k, shX + 0.05 * k, shY + 0.1 * k, shX + 0.2 * k, shY + 0.02 * k);
    arm(shX + 0.1 * k, shY + 0.02 * k, shX + 0.2 * k, shY + 0.12 * k, shX + 0.28 * k, shY + 0.06 * k);
    // the jar, tipped forward
    c.save(); c.translate(shX + 0.27 * k, shY + 0.02 * k); c.rotate(0.9);
    c.fillStyle = '#A0522D'; c.beginPath(); c.ellipse(0, 0, 0.085 * k, 0.12 * k, 0, 0, 6.28); c.fill();
    c.fillStyle = '#7A3C1E'; c.fillRect(-0.035 * k, -0.15 * k, 0.07 * k, 0.05 * k);
    c.strokeStyle = LINE; c.lineWidth = 2; c.stroke(); c.restore();
    if (m) { m.save(); m.translate(shX + 0.27 * k, shY + 0.02 * k); m.rotate(0.9); m.fillStyle = mc; m.beginPath(); m.ellipse(0, 0, 0.085 * k, 0.12 * k, 0, 0, 6.28); m.fill(); m.restore(); }
  } else if (pose === 'clap') {
    arm(shX - 0.1 * k, shY + 0.02 * k, shX + 0.0 * k, shY - 0.12 * k, shX + 0.1 * k, shY - 0.22 * k);
    arm(shX + 0.1 * k, shY + 0.02 * k, shX + 0.2 * k, shY - 0.08 * k, shX + 0.12 * k, shY - 0.22 * k);
  } else if (pose === 'carry') {
    arm(shX + 0.1 * k, shY + 0.02 * k, shX + 0.12 * k, shY - 0.1 * k, shX + 0.05 * k, shY - 0.2 * k);
    c.fillStyle = '#A0522D'; c.beginPath(); c.ellipse(hx, hy - 0.16 * k, 0.07 * k, 0.09 * k, 0, 0, 6.28); c.fill();
  }
}

function glyph(c, x, y, s, r) {
  // a few hieroglyph-like signs: bird, reed, water ripple, eye, loaf, arm, seated man, ankh-ish loop
  c.save(); c.translate(x, y); c.lineWidth = s * 0.08; c.lineCap = 'round'; c.lineJoin = 'round';
  const k = Math.floor(r * 8);
  c.beginPath();
  if (k === 0) { c.ellipse(0, 0, s * 0.3, s * 0.18, -0.2, 0, 6.28); c.moveTo(s * 0.25, -s * 0.1); c.lineTo(s * 0.42, -s * 0.28); c.moveTo(-s * 0.1, s * 0.15); c.lineTo(-s * 0.15, s * 0.42); c.moveTo(s * 0.05, s * 0.15); c.lineTo(s * 0.05, s * 0.42); c.stroke(); }
  else if (k === 1) { c.moveTo(0, s * 0.45); c.lineTo(0, -s * 0.3); c.quadraticCurveTo(s * 0.25, -s * 0.45, s * 0.05, -s * 0.05); c.stroke(); }
  else if (k === 2) { for (let i = -2; i <= 2; i++) { c.moveTo(-s * 0.45, i * s * 0.15); for (let j = 0; j < 6; j++) c.lineTo(-s * 0.45 + (j + 0.5) * s * 0.15, i * s * 0.15 + (j % 2 ? -1 : 1) * s * 0.05); } c.stroke(); }
  else if (k === 3) { c.ellipse(0, 0, s * 0.38, s * 0.16, 0, 0, 6.28); c.stroke(); c.beginPath(); c.arc(0, 0, s * 0.1, 0, 6.28); c.fill(); }
  else if (k === 4) { c.ellipse(0, s * 0.1, s * 0.35, s * 0.25, 0, Math.PI, 0); c.closePath(); c.fill(); }
  else if (k === 5) { c.moveTo(-s * 0.4, s * 0.1); c.lineTo(s * 0.3, s * 0.1); c.lineTo(s * 0.4, -s * 0.1); c.stroke(); }
  else if (k === 6) { c.arc(0, -s * 0.3, s * 0.1, 0, 6.28); c.moveTo(0, -s * 0.2); c.lineTo(0, s * 0.15); c.lineTo(s * 0.25, s * 0.15); c.lineTo(s * 0.25, s * 0.42); c.moveTo(0, -s * 0.05); c.lineTo(s * 0.25, -s * 0.15); c.stroke(); }
  else { c.ellipse(0, -s * 0.22, s * 0.14, s * 0.2, 0, 0, 6.28); c.moveTo(0, -s * 0.02); c.lineTo(0, s * 0.45); c.moveTo(-s * 0.25, s * 0.05); c.lineTo(s * 0.25, s * 0.05); c.stroke(); }
  c.restore();
}

export function drawPainting() {
  const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
  const mk = document.createElement('canvas'); mk.width = PW; mk.height = PH;
  const c = cv.getContext('2d'), m = mk.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, PW, PH);
  const rnd = mulberry(11);
  // plaster ground
  const grd = c.createLinearGradient(0, 0, 0, PH);
  grd.addColorStop(0, '#DDC596'); grd.addColorStop(0.5, '#D6BC88'); grd.addColorStop(1, '#C9AC78');
  c.fillStyle = grd; c.fillRect(0, 0, PW, PH);
  // friezes
  const frieze = (y0, h) => {
    const cols = ['#2F7DB5', '#A8432A', '#3E8A5A', '#E2C27A'];
    for (let x = 0, i = 0; x < PW; x += 46, i++) { c.fillStyle = cols[i % 4]; c.fillRect(x + 4, y0 + 6, 38, h - 12); }
    c.fillStyle = '#1D1A18'; c.fillRect(0, y0, PW, 6); c.fillRect(0, y0 + h - 6, PW, 6);
  };
  frieze(0, 70); frieze(PH - 80, 80);
  // the hieroglyph band
  c.strokeStyle = '#1F3A55'; c.fillStyle = '#1F3A55';
  for (let x = 40; x < PW - 40; x += 92) {
    c.fillStyle = '#1D1A18'; c.fillRect(x - 2, 82, 4, 250);
    c.fillStyle = '#1F3A55'; c.strokeStyle = '#1F3A55';
    for (let j = 0; j < 4; j++) glyph(c, x + 46, 120 + j * 58, 50, rnd());
  }
  c.fillStyle = '#1D1A18'; c.fillRect(0, 340, PW, 6);
  // register lines
  for (let r = 0; r < ROWS; r++) { const yb = REG.y0 + REG.rowH * (r + 1) - 28; c.fillStyle = '#5B3B22'; c.fillRect(REG.x0 - 60, yb, PW - REG.x0 + 60, 7); }
  // the ground under the sledge
  c.fillStyle = '#5B3B22'; c.fillRect(60, SLEDGE.y + 2, REG.x0 - 60, 7);
  // the ropes: from the sledge's front to each register, at shoulder height
  const sx0 = SLEDGE.x1 - 30, sy0 = SLEDGE.y - 70;
  c.strokeStyle = ROPE; c.lineWidth = 9;
  for (let r = 0; r < ROWS; r++) {
    const yb = REG.y0 + REG.rowH * (r + 1) - 28, ys = yb - 0.8 * 300 + 6;
    c.beginPath(); c.moveTo(sx0, sy0 - r * 6); c.quadraticCurveTo(REG.x0 - 60, ys + 30, REG.x0, ys); c.lineTo(REG.x1, ys + 4); c.stroke();
  }
  // the haulers: 4 rows of 43, numbered 1..172 from the front of the sledge outwards, row by row
  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    const yb = REG.y0 + REG.rowH * (r + 1) - 30;
    for (let i = 0; i < PER_ROW; i++) {
      idx++;
      const x = REG.x0 + 20 + i * (REG.x1 - REG.x0 - 60) / (PER_ROW - 1);
      drawMan(c, m, x, yb, 300 - 6 * rnd(), { pose: 'pull', phase: i * 1.3 + r, maskIdx: idx });
    }
  }
  // the sledge
  c.fillStyle = '#7A4A26';
  c.beginPath(); c.moveTo(SLEDGE.x0, SLEDGE.y); c.lineTo(SLEDGE.x1 - 60, SLEDGE.y); c.quadraticCurveTo(SLEDGE.x1 + 10, SLEDGE.y, SLEDGE.x1 + 10, SLEDGE.y - 70);
  c.lineTo(SLEDGE.x1 - 20, SLEDGE.y - 70); c.quadraticCurveTo(SLEDGE.x1 - 30, SLEDGE.y - 36, SLEDGE.x1 - 80, SLEDGE.y - 36); c.lineTo(SLEDGE.x0, SLEDGE.y - 36); c.closePath(); c.fill();
  c.strokeStyle = LINE; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#6A3E1F'; c.fillRect(SLEDGE.x0 + 30, SLEDGE.y - 58, SLEDGE.x1 - SLEDGE.x0 - 140, 24);
  // the colossus, seated, facing right (alabaster white with red outline)
  const S = STATUE, st = (fn) => { c.beginPath(); fn(); c.fill(); c.stroke(); };
  c.fillStyle = '#F0E7D3'; c.strokeStyle = '#8C3A22'; c.lineWidth = 5;
  st(() => c.rect(S.x - 330, S.y - 90, 760, 90));                          // plinth
  st(() => c.rect(S.x - 300, S.y - 700, 330, 610));                         // throne
  c.fillStyle = '#E8DDC6';
  st(() => { c.moveTo(S.x + 20, S.y - 90); c.lineTo(S.x + 20, S.y - 520); c.lineTo(S.x + 360, S.y - 520); c.lineTo(S.x + 330, S.y - 90); c.lineTo(S.x + 260, S.y - 90); c.lineTo(S.x + 260, S.y - 430); c.lineTo(S.x + 60, S.y - 430); c.lineTo(S.x + 60, S.y - 90); c.closePath(); });   // lap and legs
  c.fillStyle = '#F0E7D3';
  st(() => c.rect(S.x + 230, S.y - 130, 180, 40));                          // feet
  st(() => { c.moveTo(S.x - 160, S.y - 520); c.lineTo(S.x - 210, S.y - 1050); c.lineTo(S.x + 90, S.y - 1050); c.lineTo(S.x + 70, S.y - 520); c.closePath(); });   // torso
  st(() => { c.moveTo(S.x + 50, S.y - 1000); c.lineTo(S.x + 140, S.y - 700); c.lineTo(S.x + 330, S.y - 560); c.lineTo(S.x + 330, S.y - 510); c.lineTo(S.x + 100, S.y - 640); c.lineTo(S.x - 20, S.y - 960); c.closePath(); });   // arm to the knee
  c.fillStyle = '#E8DDC6';
  st(() => c.ellipse(S.x - 20, S.y - 1160, 120, 140, 0, 0, 6.28));        // head
  c.fillStyle = '#2E3A6B';
  st(() => { c.moveTo(S.x - 150, S.y - 1260); c.quadraticCurveTo(S.x - 20, S.y - 1360, S.x + 80, S.y - 1240); c.lineTo(S.x + 40, S.y - 1160); c.lineTo(S.x - 60, S.y - 1180); c.lineTo(S.x - 110, S.y - 940); c.lineTo(S.x - 230, S.y - 960); c.closePath(); });   // wig
  c.fillStyle = '#F4EFE6'; c.beginPath(); c.ellipse(S.x + 50, S.y - 1175, 22, 12, 0, 0, 6.28); c.fill();
  c.fillStyle = '#1D1A18'; c.beginPath(); c.arc(S.x + 58, S.y - 1175, 8, 0, 6.28); c.fill();
  c.fillStyle = '#5A3A22'; c.fillRect(S.x + 70, S.y - 1080, 22, 70);       // beard
  // the man on the statue's knee, clapping the rhythm
  drawMan(c, null, S.x + 260, S.y - 520, 270, { pose: 'clap' });
  // the pourer on the front of the sledge, and the water
  drawMan(c, m, POURER.x, POURER.y, POURER.h, { pose: 'pour', maskG: 255 });
  c.strokeStyle = BLUE; c.lineWidth = 16; m.strokeStyle = 'rgb(0,0,255)'; m.lineWidth = 34;
  for (const g of [c, m]) {
    g.beginPath(); g.moveTo(WATER.x0, WATER.y0);
    const n = 9;
    for (let i = 1; i <= n; i++) { const u = i / n; g.lineTo(WATER.x0 + (WATER.x1 - WATER.x0) * u + (i % 2 ? 16 : -16), WATER.y0 + (WATER.y1 - WATER.y0) * u); }
    g.stroke();
  }
  c.fillStyle = BLUE; c.beginPath(); c.ellipse(WATER.x1 + 10, WATER.y1 - 6, 70, 12, 0, 0, 6.28); c.fill();
  m.fillStyle = 'rgb(0,0,255)'; m.beginPath(); m.ellipse(WATER.x1 + 10, WATER.y1 - 6, 80, 18, 0, 0, 6.28); m.fill();
  // behind the statue: men bringing water jars
  for (let i = 0; i < 3; i++) drawMan(c, null, 90 + i * 32, SLEDGE.y - 330 - i * 260 + 200, 230, { pose: 'carry' });
  // age: flaking, losses, cracks, soot
  for (let i = 0; i < 900; i++) {
    const x = rnd() * PW, y = rnd() * PH, r = 2 + rnd() ** 3 * 26;
    c.fillStyle = `rgba(${200 + rnd() * 30},${175 + rnd() * 25},${130 + rnd() * 20},${0.35 + 0.5 * rnd()})`;
    c.beginPath(); c.ellipse(x, y, r, r * (0.5 + rnd()), rnd() * 3, 0, 6.28); c.fill();
  }
  for (let i = 0; i < 14; i++) {      // larger losses of plaster (kept away from the pourer)
    let x = rnd() * PW, y = 400 + rnd() * (PH - 500);
    if (Math.abs(x - POURER.x) < 420 && y > 1350) x += 900;
    c.fillStyle = 'rgba(190,165,120,0.92)';
    c.beginPath();
    const R = 40 + rnd() * 90;
    for (let a = 0; a < 6.28; a += 0.5) c.lineTo(x + Math.cos(a) * R * (0.6 + 0.6 * rnd()), y + Math.sin(a) * R * (0.6 + 0.6 * rnd()));
    c.closePath(); c.fill();
  }
  c.strokeStyle = 'rgba(70,48,28,0.55)'; c.lineWidth = 2.5;
  for (let i = 0; i < 26; i++) {
    let x = rnd() * PW, y = rnd() * PH;
    c.beginPath(); c.moveTo(x, y);
    for (let j = 0; j < 14; j++) { x += (rnd() - 0.4) * 60; y += (rnd() - 0.5) * 60; c.lineTo(x, y); }
    c.stroke();
  }
  const soot = c.createRadialGradient(PW * 0.5, -300, 100, PW * 0.5, -300, 1600);
  soot.addColorStop(0, 'rgba(40,25,10,0.35)'); soot.addColorStop(1, 'rgba(40,25,10,0)');
  c.fillStyle = soot; c.fillRect(0, 0, PW, PH);
  return { color: cv, mask: mk };
}

export function paintingTextures(renderer) {
  const { color, mask } = drawPainting();
  const tc = new THREE.CanvasTexture(color); tc.colorSpace = THREE.SRGBColorSpace; tc.anisotropy = 8;
  tc.generateMipmaps = true; tc.minFilter = THREE.LinearMipmapLinearFilter;
  const tm = new THREE.CanvasTexture(mask); tm.minFilter = THREE.NearestFilter; tm.magFilter = THREE.NearestFilter; tm.generateMipmaps = false;
  return { color: tc, mask: tm };
}

const HL = `
  uniform sampler2D tMask; uniform float uCount, uPour, uFlow, uLitAll, uT; uniform vec3 cHL, cWater;
  vec3 highlight(vec2 uv, vec3 c, out float glow){
    vec4 mk = texture2D(tMask, uv);
    float idx = floor(mk.r * 255. + .5);
    glow = 0.;
    if (idx > 0.5 && idx <= uCount + 0.5) {
      float age = clamp((uCount - idx) / 8.0, 0., 1.);
      glow = mix(1.0, 0.45, age) * uLitAll;
      c = mix(c, c * 1.15 + vec3(0.10, 0.07, 0.0), uLitAll);
    }
    if (mk.g > 0.5) { glow = max(glow, uPour); c = mix(c, c * 1.3, uPour); }
    if (mk.b > 0.5) {
      // the painted water flows: bright ripples running down the stream
      float r = fract(uv.y * 90.0 + uT * 2.2);
      float fl = smoothstep(0.0, 0.3, r) * smoothstep(0.9, 0.5, r);
      c = mix(c, c + cWater * fl * 0.6, uFlow);
      glow = max(glow, uFlow * 0.6);
    }
    return c;
  }`;

/** The wall itself: plaster with relief, the painting, and the highlights (a torch lights it). */
export function wallMaterial(P, tex) {
  const u = {
    tMask: { value: tex.mask }, uCount: { value: 0 }, uPour: { value: 0 }, uFlow: { value: 0 }, uLitAll: { value: 1 }, uT: { value: 0 },
    cHL: { value: new THREE.Color(P.good) }, cWater: { value: new THREE.Color(P.water) },
  };
  const m = new THREE.MeshStandardMaterial({ map: tex.color, roughness: 0.92, metalness: 0 });
  patch(m, {
    uniforms: u,
    fHead: HL,
    frag: {
      '#include <map_fragment>': `#include <map_fragment>
        float gl0; diffuseColor.rgb = highlight(vMapUv, diffuseColor.rgb, gl0);
        diffuseColor.rgb *= 0.9 + 0.12 * vnoise(vMapUv * vec2(400., 200.));`,
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * gl0 * 0.55;`,
      '#include <normal_fragment_maps>': `#include <normal_fragment_maps>
        { vec2 q = vMapUv * vec2(160., 80.); float e = 0.02;
          float h0 = vnoise(q) + 0.3 * vnoise(q * 4.1), hx = vnoise(q + vec2(e * 40., 0.)) + 0.3 * vnoise((q + vec2(e * 40., 0.)) * 4.1), hy = vnoise(q + vec2(0., e * 40.)) + 0.3 * vnoise((q + vec2(0., e * 40.)) * 4.1);
          normal = normalize(normal + vec3(h0 - hx, h0 - hy, 0.) * 0.6); }`,
    },
  });
  m.userData.u = u;
  return m;
}

/** A camera-attached sheet that shows a window of the painting (uv centre and half size), revealed by brush
 *  strokes (uReveal 0..1); used to paint the live 3D scene over into the painting, and to wipe the painting away
 *  into the 3D re-creation. */
export function paintOverMaterial(P, tex) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      tCol: { value: tex.color }, tMask: { value: tex.mask }, uCenter: { value: new THREE.Vector2(0.3, 0.2) }, uHalf: { value: new THREE.Vector2(0.1, 0.1) },
      uReveal: { value: 0 }, uGain: { value: 1 }, uDir: { value: 1 },
      uCount: { value: 0 }, uPour: { value: 0 }, uFlow: { value: 0 }, uLitAll: { value: 1 }, uT: { value: 0 },
      cHL: { value: new THREE.Color(P.good) }, cWater: { value: new THREE.Color(P.water) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D tCol; uniform vec2 uCenter, uHalf; uniform float uReveal, uGain, uDir; varying vec2 vUv;
      ${NOISE}
      ${HL}
      vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
      void main(){
        vec2 uv = uCenter + (vUv - .5) * 2. * uHalf;
        vec3 c = toLin(texture2D(tCol, uv).rgb);
        float gl0; c = highlight(uv, c, gl0);
        // brush strokes: wide diagonal bands with ragged, bristly edges, laid down one after another
        float band = (vUv.y * 0.75 + vUv.x * 0.35) * 5.0;
        float bi = floor(band);
        float along = uDir > 0. ? vUv.x : 1. - vUv.x;
        float order = (bi + along * 0.9) / 6.2;
        float bristle = vnoise(vec2(vUv.x * 6., band * 40.)) * 0.12 + vnoise(vUv * 30.) * 0.05;
        float a = smoothstep(order - 0.02, order + 0.02, uReveal * 1.15 - 0.08 + bristle);
        gl_FragColor = vec4(c * uGain * (1. + gl0 * 0.4), a);
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  return m;
}
