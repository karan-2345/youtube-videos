// "The rounding error that a fix made deadly": deterministic frame renderer.
// Everything is a pure function of time t (seconds): window.renderFrame(t).
// One 2D canvas. Black radar-room screen, phosphor greys, one amber accent (the error).
// Content stays inside the middle 3:4 (y 240-1680); captions sit at y 1440.

const W = 1080, H = 1920, CX = 540;
const COL = {
  bg: '#060708', white: '#E9EDEF', grey: '#9BA4A9', dim: '#566066', faint: '#262C30',
  amber: '#FFB23F', amberDim: 'rgba(255,178,63,0.25)', panel: '#0C0F11', line: '#2B3236',
};
const SANS = 'InterX', MONO = 'JBM';

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const smooth = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const outCubic = u => 1 - Math.pow(1 - clamp(u), 3);
const inOut = u => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const outBack = u => { u = clamp(u); const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const fadeIn = (t, a, d = 0.35) => smooth(ramp(t, a, a + d));
const win = (t, a, b, fi = 0.35, fo = 0.35) => Math.min(smooth(ramp(t, a, a + fi)), 1 - smooth(ramp(t, b - fo, b)));
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let q = s; q = Math.imul(q ^ (q >>> 15), q | 1); q ^= q + Math.imul(q ^ (q >>> 7), q | 61); return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; }

// The Patriot numbers (checked in checks/compute1.py)
const ERR_PER_TICK = 0.1 / 1048576;               // 0.1 x 2^-20 s lost per tenth-second tick
const drift = h => h * 36000 * ERR_PER_TICK;      // seconds behind after h hours
const STORED = '0.0999999046';

let TL, E, S, DUR;
const cv = document.getElementById('ui');
const g = cv.getContext('2d');

function font(weight, size, fam = SANS) { return `${weight} ${size}px ${fam}`; }
function txt(s, x, y, o = {}) {
  const { size = 48, weight = 800, fam = SANS, color = COL.white, align = 'center', alpha = 1, spacing = 0, base = 'middle' } = o;
  if (alpha <= 0.001) return 0;
  g.save();
  g.globalAlpha *= alpha;
  g.font = font(weight, size, fam);
  g.letterSpacing = spacing + 'px';
  g.textAlign = align; g.textBaseline = base;
  g.fillStyle = color;
  g.fillText(s, x, y);
  const w = g.measureText(s).width;
  g.restore();
  return w;
}
function measure(s, size, weight = 800, fam = SANS, spacing = 0) {
  g.save(); g.font = font(weight, size, fam); g.letterSpacing = spacing + 'px';
  const w = g.measureText(s).width; g.restore(); return w;
}
// Inter ExtraBold number fitted to a max width
function bigNum(s, y, { max = 960, size = 200, color = COL.white, alpha = 1, scale = 1 } = {}) {
  const w = measure(s, size);
  const sz = Math.min(size, size * max / w) * scale;
  txt(s, CX, y, { size: sz, color, alpha });
}
function label(s, y, o = {}) { return txt(s, o.x ?? CX, y, { size: 40, weight: 800, color: COL.grey, spacing: 3, ...o }); }
function rrect(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function line(x0, y0, x1, y1, color, width = 2, alpha = 1, dash = null) {
  g.save(); g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = width;
  if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
}
function glowText(s, x, y, o) {
  g.save(); g.shadowColor = o.color; g.shadowBlur = o.blur ?? 28; txt(s, x, y, o); g.restore(); txt(s, x, y, o);
}

// ---------------------------------------------------------------- film: scanlines, vignette, grain
let SCAN, VIG, GRAIN = [];
function initFilm() {
  SCAN = document.createElement('canvas'); SCAN.width = W; SCAN.height = H;
  const s = SCAN.getContext('2d');
  s.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < H; y += 4) s.fillRect(0, y, W, 1);
  VIG = document.createElement('canvas'); VIG.width = W; VIG.height = H;
  const v = VIG.getContext('2d');
  const gr = v.createRadialGradient(CX, H / 2, 300, CX, H / 2, 1150);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)');
  v.fillStyle = gr; v.fillRect(0, 0, W, H);
  for (let k = 0; k < 8; k++) {
    const c = document.createElement('canvas'); c.width = 270; c.height = 480;
    const x = c.getContext('2d'); const img = x.createImageData(270, 480); const r = rng(100 + k);
    for (let i = 0; i < img.data.length; i += 4) { const n = 128 + (r() - 0.5) * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = n; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0); GRAIN.push(c);
  }
}
function film(t) {
  g.drawImage(SCAN, 0, 0);
  g.drawImage(VIG, 0, 0);
  g.save(); g.globalAlpha = 0.045; g.globalCompositeOperation = 'overlay';
  g.imageSmoothingEnabled = false;
  g.drawImage(GRAIN[Math.floor(t * 30) % GRAIN.length], 0, 0, W, H);
  g.restore();
}

// ---------------------------------------------------------------- console (S00 hook, S05 ending)
const CON = { x: 80, y: 600, w: 920, h: 420 };
function drawConsole(t, a, st) {
  // st: {typed: chars of input shown, answer: 0..1, zeros: 0..15 highlighted, four: 0..1, cursor: bool}
  if (a <= 0.001) return;
  g.save(); g.globalAlpha = a;
  rrect(CON.x, CON.y, CON.w, CON.h, 22); g.fillStyle = COL.panel; g.fill();
  g.lineWidth = 2; g.strokeStyle = COL.line; g.stroke();
  // title bar
  line(CON.x, CON.y + 66, CON.x + CON.w, CON.y + 66, COL.line, 2);
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(CON.x + 40 + i * 32, CON.y + 33, 9, 0, 7); g.fillStyle = COL.faint; g.fill(); }
  txt('python3', CON.x + CON.w / 2, CON.y + 34, { size: 30, weight: 500, fam: MONO, color: COL.dim });
  const fs = 66, cw = measure('0', fs, 700, MONO);
  const x0 = CON.x + 52, y1 = CON.y + 175, y2 = CON.y + 300;
  const input = '0.1 + 0.2';
  txt('>>>', x0, y1, { size: fs, weight: 700, fam: MONO, color: COL.dim, align: 'left' });
  const shown = input.slice(0, st.typed);
  txt(shown, x0 + cw * 4, y1, { size: fs, weight: 700, fam: MONO, color: COL.white, align: 'left' });
  if (st.answer > 0) {
    const ans = '0.30000000000000004';
    for (let i = 0; i < ans.length; i++) {
      const ch = ans[i];
      const isZero = i >= 3 && i < 18;
      const isFour = i === 18;
      let color = COL.white, alpha = st.answer;
      if (isZero) {
        const k = i - 3;
        const lit = clamp(st.zeros - k);
        color = lit > 0.5 ? COL.white : COL.grey;
        if (st.zeros > 0 && lit > 0) { // underline the counted zero
          g.save(); g.globalAlpha = a * lit * (1 - st.four * 0.7); g.fillStyle = COL.grey;
          g.fillRect(x0 + cw * i + 4, y2 + 44, cw - 8, 4); g.restore();
        }
      }
      if (isFour && st.four > 0) {
        const sc = 1 + 0.35 * Math.sin(Math.PI * clamp(st.four * 1.6)) * (st.four < 0.62 ? 1 : 0);
        g.save(); g.translate(x0 + cw * (i + 0.5), y2); g.scale(sc, sc);
        glowText(ch, 0, 0, { size: fs, weight: 700, fam: MONO, color: COL.amber, alpha, blur: 30 * st.four });
        g.restore();
        continue;
      }
      txt(ch, x0 + cw * (i + 0.5), y2, { size: fs, weight: 700, fam: MONO, color, alpha });
    }
  }
  if (st.cursor) {
    const cx = st.answer > 0 && st.cursorLine2 ? x0 : x0 + cw * (4 + shown.length);
    const cy = st.answer > 0 && st.cursorLine2 ? CON.y + 390 : y1;
    g.fillStyle = COL.grey; g.fillRect(cx + 2, cy - 34, cw * 0.62, 66);
  }
  g.restore();
}

// ---------------------------------------------------------------- radar scope
function drawScope(t, cx, cy, r, a, blips = true) {
  if (a <= 0.001) return;
  g.save(); g.globalAlpha = a;
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = '#080A0B'; g.fill();
  g.strokeStyle = COL.line; g.lineWidth = 2;
  for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(cx, cy, r * k / 4, 0, 7); g.stroke(); }
  for (let k = 0; k < 12; k++) {
    const an = k * Math.PI / 6;
    line(cx + Math.cos(an) * r * 0.08, cy + Math.sin(an) * r * 0.08, cx + Math.cos(an) * r, cy + Math.sin(an) * r, COL.faint, 2);
  }
  for (let k = 0; k < 72; k++) {
    const an = k * Math.PI / 36, l = k % 6 === 0 ? 22 : 10;
    line(cx + Math.cos(an) * (r - l), cy + Math.sin(an) * (r - l), cx + Math.cos(an) * r, cy + Math.sin(an) * r, COL.dim, 2);
  }
  const sweep = t * 1.15 - Math.PI / 2;
  g.save(); g.beginPath(); g.arc(cx, cy, r - 2, 0, 7); g.clip();
  const cg = g.createConicGradient(sweep - 1.2, cx, cy);
  cg.addColorStop(0, 'rgba(200,214,220,0)'); cg.addColorStop(1.2 / (2 * Math.PI), 'rgba(200,214,220,0.22)');
  cg.addColorStop(1.2 / (2 * Math.PI) + 0.001, 'rgba(200,214,220,0)'); cg.addColorStop(1, 'rgba(200,214,220,0)');
  g.fillStyle = cg; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  line(cx, cy, cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r, '#C8D6DC', 3, 0.7);
  if (blips) {
    const R = rng(5);
    for (let i = 0; i < 7; i++) {
      const an = R() * Math.PI * 2, rr = r * (0.25 + 0.65 * R());
      let d = ((sweep - an) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const b = Math.exp(-d * 1.1);
      g.beginPath(); g.arc(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr, 6, 0, 7);
      g.fillStyle = `rgba(220,230,235,${0.15 + 0.75 * b})`; g.fill();
    }
  }
  g.restore();
  g.restore();
}

// ---------------------------------------------------------------- S00 hook
function sceneHook(t) {
  const end = S.S00.end;
  const cut = E.y1991 - 0.15;
  // console
  const typeA = 0.35, typeB = E.into - 0.1;
  const typed = Math.floor(clamp((t - typeA) / (typeB - typeA)) * 9 + 1e-6);
  const conA = 1 - smooth(ramp(t, cut, cut + 0.3));
  if (conA > 0) {
    drawConsole(t, conA, {
      typed, answer: fadeIn(t, E.answer - 0.2, 0.12),
      zeros: clamp((t - E.zeros + 0.05) / 0.9) * 15,
      four: ramp(t, E.four - 0.05, E.four + 0.45),
      cursor: t < E.answer - 0.2 ? (Math.floor(t * 2) % 2 === 0 || (t > typeA && t < typeB)) : false,
    });
  }
  // radar scope with the year and the cost
  const scA = smooth(ramp(t, cut, cut + 0.45)) * (1 - smooth(ramp(t, end - 0.25, end + 0.25)));
  if (scA > 0) {
    const dimmed = lerp(1, 0.35, smooth(ramp(t, cut + 0.2, cut + 0.8)));
    drawScope(t, CX, 820, 400, scA * dimmed);
    const yA = win(t, cut + 0.1, E.dead - 0.05, 0.3, 0.3);
    bigNum('1991', 820, { size: 230, alpha: scA * yA });
    const dA = win(t, E.dead - 0.1, E.strange - 0.1, 0.3, 0.35);
    bigNum('28', 780, { size: 300, alpha: scA * dA, scale: lerp(0.94, 1, outCubic(ramp(t, E.dead - 0.1, E.dead + 0.4))) });
    label('AMERICAN SOLDIERS KILLED', 990, { alpha: scA * dA * fadeIn(t, E.dead + 0.25), size: 42 });
    const sA = fadeIn(t, E.strange - 0.05, 0.4);
    glowText('A TINY ERROR', CX, 720, { size: 92, color: COL.amber, alpha: scA * sA, blur: 20 });
    txt('+ A SOFTWARE FIX', CX, 880, { size: 92, color: COL.white, alpha: scA * fadeIn(t, E.improve - 0.05, 0.4) });
  }
}

// ---------------------------------------------------------------- S01 why one tenth breaks
// bit i (1-based) of 1/10 = 0.0 0011 0011 0011 ... ; the Patriot kept bits 1-23
const bitOfTenth = i => (i === 1 ? '0' : ((i - 2) % 4 < 2 ? '0' : '1'));
function sceneTenth(t) {
  const a = win(t, S.S01.start - 0.2, S.S01.end + 0.1, 0.4, 0.4);
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  // one third in decimal
  const t3 = E.third;
  label('ONE THIRD IN DECIMAL', 430, { alpha: fadeIn(t, t3 - 0.1) });
  const nThrees = Math.floor(clamp(t - (E.third_num - 0.35), 0, 99) * 16);
  const fs1 = 84, cw1 = measure('3', fs1, 700, MONO);
  const row1 = '0.' + '3'.repeat(Math.min(60, Math.max(1, nThrees)));
  g.save(); g.beginPath(); g.rect(60, 440, 960, 140); g.clip();
  txt(nThrees > 0 ? row1 : '', 90, 520, { size: fs1, weight: 700, fam: MONO, align: 'left', alpha: fadeIn(t, E.third_num - 0.35, 0.2) });
  g.restore();
  edgeFade(980, 440, 140);
  // one tenth in binary
  const tb = E.tenth;
  label('ONE TENTH IN BINARY', 690, { alpha: fadeIn(t, tb - 0.1) });
  const fs2 = 50, cw2 = measure('0', fs2, 700, MONO);
  const nBits = Math.floor(clamp(t - (tb + 0.25), 0, 99) * 20);
  const chopT = E.chop;
  const cutDone = ramp(t, chopT - 0.1, chopT + 0.25);
  // layout: "0.0 0011 0011 ..." -> position of bit i (1-based) with a space before every group of 4 from bit 2
  const xOf = i => { const sp = i >= 2 ? Math.floor((i - 2) / 4) + 1 : 0; return 90 + cw2 * (2 + (i - 1) + sp); };
  const by = 780;
  g.save(); g.beginPath(); g.rect(60, 700, 960, 520); g.clip();
  txt('0.', 90, by, { size: fs2, weight: 700, fam: MONO, align: 'left', alpha: nBits > 0 ? 1 : 0 });
  const maxBits = Math.min(nBits, 40);
  for (let i = 1; i <= maxBits; i++) {
    const ch = bitOfTenth(i);
    let x = xOf(i), y = by, rot = 0, al = 1;
    if (i > 23 && t > chopT) { // the tail falls away
      const dt = t - chopT - (i - 23) * 0.015;
      if (dt > 0) { y += 900 * dt * dt + 60 * dt; x += 40 * dt; rot = dt * (i % 2 ? 1.5 : -1.2); al = 1 - clamp(dt / 1.2); }
    }
    g.save(); g.translate(x + cw2 / 2, y); g.rotate(rot);
    txt(ch, 0, 0, { size: fs2, weight: 700, fam: MONO, color: i > 23 && t > chopT ? COL.grey : COL.white, alpha: al });
    g.restore();
  }
  g.restore();
  if (t < chopT) edgeFade(980, 720, 120);
  // the blade at bit 23
  if (t > chopT - 0.4) {
    const xc = xOf(24) - cw2 * 0.5 - 2;
    const u = outCubic(ramp(t, chopT - 0.35, chopT - 0.05));
    const bA = 1 - smooth(ramp(t, chopT + 1.2, chopT + 1.8)) * 0.6;
    g.save(); g.shadowColor = COL.amber; g.shadowBlur = 16;
    line(xc, 720, xc, lerp(720, 850, u), COL.amber, 5, bA);
    g.restore();
    txt('BIT 23', xc, 880, { size: 30, weight: 700, fam: MONO, color: COL.amber, alpha: fadeIn(t, chopT, 0.3) * bA });
  }
  // what the machine keeps
  const sl = E.slight;
  label('WHAT THE MACHINE KEEPS', 1010, { alpha: fadeIn(t, sl - 0.1) });
  txt(STORED, CX, 1100, { size: 92, weight: 700, fam: MONO, alpha: fadeIn(t, sl + 0.1) });
  glowText('0.1 − 0.000000095', CX, 1200, { size: 46, weight: 700, fam: MONO, color: COL.amber, alpha: fadeIn(t, sl + 0.8) * lerp(1, 0.55, fadeIn(t, E.harmless, 0.6)), blur: 12 });
  g.restore();
}
function edgeFade(x, y, h) {
  const gr = g.createLinearGradient(x - 120, 0, x + 60, 0);
  gr.addColorStop(0, 'rgba(6,7,8,0)'); gr.addColorStop(1, 'rgba(6,7,8,1)');
  g.fillStyle = gr; g.fillRect(x - 120, y, 220, h);
}

// ---------------------------------------------------------------- S02 the clock that slipped
function hhmmss(sec, dec = 2) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec - h * 3600 - m * 60;
  return `${String(h).padStart(3, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(dec).padStart(3 + dec, '0')}`;
}
function sceneClock(t) {
  const a = win(t, S.S02.start - 0.2, S.S02.end + 0.1, 0.4, 0.4);
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  txt('PATRIOT BATTERY', CX, 340, { size: 76, alpha: fadeIn(t, E.battery - 0.1) });
  label('DHAHRAN, SAUDI ARABIA', 412, { alpha: fadeIn(t, E.saudi - 0.1), size: 36 });
  label('FEBRUARY 1991', 462, { alpha: fadeIn(t, E.feb - 0.1), size: 36 });
  // phase 1: the tick counter and the multiplication
  const p1 = 1 - smooth(ramp(t, E.behind - 0.4, E.behind));
  if (p1 > 0) {
    const ticks = Math.floor(Math.max(0, t - E.clock + 0.2) * 10) + 1000000;
    const al = fadeIn(t, E.clock - 0.1) * p1;
    label('CLOCK COUNT (TENTHS OF A SECOND)', 600, { alpha: al, size: 32 });
    txt(ticks.toLocaleString('en-US'), CX, 690, { size: 96, weight: 700, fam: MONO, alpha: al });
    const m = fadeIn(t, E.multiply - 0.1) * p1;
    txt('×', CX, 800, { size: 70, weight: 700, fam: MONO, color: COL.grey, alpha: m });
    txt(STORED, CX, 900, { size: 96, weight: 700, fam: MONO, alpha: m });
    label('ITS CHOPPED-OFF 0.1', 985, { alpha: m, size: 32 });
    const sh = fadeIn(t, E.ppm - 0.1) * p1;
    glowText('SHORT BY 1 PART IN 1,000,000', CX, 1100, { size: 50, color: COL.amber, alpha: sh, blur: 14 });
  }
  // phase 2: two clocks and the hours
  const p2 = fadeIn(t, E.behind - 0.2, 0.4);
  if (p2 > 0) {
    const t0 = E.behind, t1 = Math.max(E.h100 + 0.4, E.behind + 3);
    const hours = 100 * Math.pow(inOut(ramp(t, t0, t1)), 1.25);
    const trueS = hours * 3600, sysS = trueS - drift(hours);
    label('TRUE TIME', 580, { alpha: p2, size: 32 });
    txt(hhmmss(trueS), CX, 650, { size: 88, weight: 700, fam: MONO, alpha: p2 });
    label('SYSTEM CLOCK', 760, { alpha: p2, size: 32 });
    txt(hhmmss(sysS), CX, 830, { size: 88, weight: 700, fam: MONO, alpha: p2, color: COL.white });
    // hours bar
    const bx0 = 120, bx1 = 960, byy = 1210;
    line(bx0, byy, bx1, byy, COL.line, 6, p2);
    line(bx0, byy, lerp(bx0, bx1, hours / 100), byy, COL.white, 6, p2);
    for (const h of [8, 20, 48, 72, 100]) {
      const x = lerp(bx0, bx1, h / 100), on = hours >= h - 0.01;
      line(x, byy - 14, x, byy + 14, on ? COL.white : COL.dim, 3, p2);
      txt(`${h} h`, x, byy + 46, { size: 30, weight: 700, fam: MONO, color: on ? COL.white : COL.dim, alpha: p2 });
    }
    // designed for a few hours
    const dA = fadeIn(t, E.design - 0.1) * p2;
    if (dA > 0) {
      g.save(); g.globalAlpha *= dA * 0.9; g.fillStyle = 'rgba(155,164,169,0.18)';
      g.fillRect(bx0, byy - 34, lerp(bx0, bx1, 0.08) - bx0, 68); g.restore();
      txt('DESIGNED FOR A FEW HOURS', bx0, byy - 66, { size: 28, color: COL.grey, align: 'left', alpha: dA, spacing: 2 });
    }
    // the gap
    const land = fadeIn(t, E.third_sec - 0.15, 0.3);
    const gapStr = drift(hours).toFixed(4) + ' s';
    label('BEHIND BY', 950, { alpha: p2, size: 32, color: COL.amber });
    if (land < 1) glowText(gapStr, CX, 1040, { size: 104, weight: 700, fam: MONO, color: COL.amber, alpha: p2 * (1 - land), blur: 14 });
    if (land > 0) {
      g.save(); g.translate(CX, 1040); const sc = lerp(1.25, 1, outBack(land)); g.scale(sc, sc);
      glowText('0.34 s', 0, 0, { size: 130, color: COL.amber, alpha: p2 * land, blur: 26 });
      g.restore();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- pulses on a timeline (S03, S04)
const AX = { x0: 110, x1: 970, y: 760 }, P1 = 330, P2 = 730, SHIFT = 92;
function axis(a) {
  line(AX.x0, AX.y, AX.x1, AX.y, COL.line, 3, a);
  for (let x = AX.x0; x <= AX.x1; x += 43) line(x, AX.y - 8, x, AX.y + 8, COL.faint, 2, a);
  txt('TIME →', AX.x1, AX.y + 46, { size: 26, weight: 700, fam: MONO, color: COL.dim, align: 'right', alpha: a });
}
function pulse(x, a, color = COL.white, h = 150, glow = 0) {
  if (a <= 0) return;
  g.save(); g.globalAlpha *= a;
  if (glow) { g.shadowColor = color; g.shadowBlur = glow; }
  g.fillStyle = color; g.fillRect(x - 4, AX.y - h, 8, h);
  g.beginPath(); g.arc(x, AX.y - h, 12, 0, 7); g.fill();
  g.restore();
}
function brace(x0, x1, y, a, color, text, tsize = 34) {
  if (a <= 0) return;
  line(x0, y, x1, y, color, 3, a);
  line(x0, y - 14, x0, y + 14, color, 3, a); line(x1, y - 14, x1, y + 14, color, 3, a);
  if (text) txt(text, (x0 + x1) / 2, y + 40, { size: tsize, weight: 700, fam: MONO, color, alpha: a });
}
function stamp(x, y, s, a, color) {
  if (a <= 0) return;
  g.save(); g.globalAlpha *= a;
  const w = measure(s, 28, 700, MONO) + 26;
  rrect(x - w / 2, y - 24, w, 48, 8); g.fillStyle = COL.panel; g.fill(); g.lineWidth = 2; g.strokeStyle = color; g.stroke();
  g.restore();
  txt(s, x, y + 1, { size: 28, weight: 700, fam: MONO, color, alpha: a });
}

function scenePuzzle(t) {
  const a = win(t, S.S03.start - 0.2, S.S03.end + 0.1, 0.4, 0.4);
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  const pA = 1 - smooth(ramp(t, E.watch - 0.4, E.watch));
  if (pA > 0) {
    g.save(); g.globalAlpha *= pA;
    label('RADAR PULSES', 420, { alpha: fadeIn(t, E.puzzle) });
    axis(fadeIn(t, E.puzzle));
    const tp = fadeIn(t, E.pulses - 0.2, 0.3);
    pulse(P1, tp); pulse(P2, outCubic(ramp(t, E.pulses + 0.1, E.pulses + 0.4)));
    txt('1', P1, AX.y - 200, { size: 40, color: COL.grey, alpha: tp });
    txt('2', P2, AX.y - 200, { size: 40, color: COL.grey, alpha: fadeIn(t, E.pulses + 0.1) });
    brace(P1, P2, AX.y + 60, fadeIn(t, E.pulses + 0.5), COL.white, 'TRUE GAP');
    // both stamped late by the same amount
    const bA = fadeIn(t, E.both - 0.1, 0.4);
    const sh = SHIFT * outCubic(ramp(t, E.both, E.both + 0.7));
    const tagA = bA * (1 - smooth(ramp(t, E.cancel + 0.1, E.cancel + 0.9)));
    pulse(P1 - sh, bA * 0.85, COL.amber, 110, 12); pulse(P2 - sh, bA * 0.85, COL.amber, 110, 12);
    stamp(P1 - sh, AX.y - 270, '−0.34 s', tagA, COL.amber); stamp(P2 - sh, AX.y - 270, '−0.34 s', tagA, COL.amber);
    brace(P1 - sh, P2 - sh, AX.y + 170, bA, COL.amber, 'CLOCK GAP');
    txt('SAME GAP', CX, 1110, { size: 64, alpha: fadeIn(t, E.cancel - 0.1) });
    label('THE ERROR CANCELS', 1185, { alpha: fadeIn(t, E.cancel + 0.2) });
    g.restore();
  }
  const wA = fadeIn(t, E.watch - 0.15, 0.4);
  if (wA > 0) {
    g.save(); g.globalAlpha *= wA;
    // wall clock, an hour wrong
    const c1 = { x: 290, y: 760, r: 170 };
    face(c1, COL.grey);
    const wall = 10 * 3600 + 8 * 60 + (t - E.watch) * 1; // reads 10:08, the true time is 11:08
    hands(c1, wall);
    label('AN HOUR WRONG', 1000, { x: c1.x, size: 32 });
    // stopwatch
    const c2 = { x: 790, y: 760, r: 170 };
    face(c2, COL.white, true);
    const run = 12.4 * smooth(ramp(t, E.race - 0.2, E.diff + 0.1));
    const an = run / 60 * 2 * Math.PI - Math.PI / 2;
    line(c2.x, c2.y, c2.x + Math.cos(an) * c2.r * 0.86, c2.y + Math.sin(an) * c2.r * 0.86, COL.white, 5);
    txt(run.toFixed(2) + ' s', c2.x, c2.y + 70, { size: 40, weight: 700, fam: MONO, color: COL.white });
    label('STILL RIGHT', 1000, { x: c2.x, size: 32, alpha: fadeIn(t, E.diff - 0.2) });
    txt('FINISH − START', CX, 1130, { size: 56, alpha: fadeIn(t, E.diff - 0.1) });
    g.restore();
  }
  g.restore();
}
function face(c, color, stopwatch = false) {
  g.save();
  g.beginPath(); g.arc(c.x, c.y, c.r, 0, 7); g.fillStyle = COL.panel; g.fill(); g.lineWidth = 5; g.strokeStyle = color; g.stroke();
  if (stopwatch) { g.fillStyle = color; g.fillRect(c.x - 18, c.y - c.r - 34, 36, 26); }
  const n = stopwatch ? 60 : 12;
  for (let k = 0; k < n; k++) {
    const an = k / n * 2 * Math.PI, big = stopwatch ? k % 5 === 0 : true, l = big ? 22 : 10;
    line(c.x + Math.cos(an) * (c.r - 12 - l), c.y + Math.sin(an) * (c.r - 12 - l), c.x + Math.cos(an) * (c.r - 12), c.y + Math.sin(an) * (c.r - 12), COL.grey, big ? 4 : 2);
  }
  g.beginPath(); g.arc(c.x, c.y, 9, 0, 7); g.fillStyle = color; g.fill();
  g.restore();
}
function hands(c, sec) {
  const h = (sec / 3600) % 12, m = (sec / 60) % 60;
  const ah = h / 12 * 2 * Math.PI - Math.PI / 2, am = m / 60 * 2 * Math.PI - Math.PI / 2;
  line(c.x, c.y, c.x + Math.cos(ah) * c.r * 0.5, c.y + Math.sin(ah) * c.r * 0.5, COL.grey, 9);
  line(c.x, c.y, c.x + Math.cos(am) * c.r * 0.78, c.y + Math.sin(am) * c.r * 0.78, COL.grey, 5);
}

// ---------------------------------------------------------------- S04 the patch
const BLOCKS = 6, PATCHED = [0, 2, 4], MISSED = 3;
function scenePatch(t) {
  const a = win(t, S.S04.start - 0.2, E.struck + 0.6, 0.4, 0.25);
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  // phase 1: code blocks
  const c1 = 1 - smooth(ramp(t, E.subtract - 0.4, E.subtract));
  if (c1 > 0) {
    g.save(); g.globalAlpha *= c1;
    label('THE OLD CODE', 360, { alpha: fadeIn(t, E.did - 0.1) });
    label('PATCHED FOR FAST BALLISTIC MISSILES', 410, { alpha: fadeIn(t, E.patched - 0.1), size: 32, color: COL.white });
    const R = rng(9);
    for (let b = 0; b < BLOCKS; b++) {
      const y = 470 + b * 112, x = 200, w = 680, h = 92;
      const k = PATCHED.indexOf(b);
      const pa = k >= 0 ? fadeIn(t, E.accurate + 0.25 + k * 0.35, 0.3) : 0;
      const ma = b === MISSED ? fadeIn(t, E.missed + 0.1, 0.35) : 0;
      rrect(x, y, w, h, 10); g.fillStyle = COL.panel; g.fill();
      g.lineWidth = 3; g.strokeStyle = pa > 0.5 ? COL.amber : (ma > 0.5 ? COL.white : COL.line); g.stroke();
      if (ma > 0) { g.save(); g.setLineDash([12, 10]); g.lineWidth = 4; g.strokeStyle = COL.white; g.globalAlpha *= ma; rrect(x - 10, y - 10, w + 20, h + 20, 14); g.stroke(); g.restore(); }
      for (let l = 0; l < 3; l++) {
        const lw = 140 + R() * 300;
        g.save(); g.globalAlpha *= 0.9;
        g.fillStyle = pa > 0 ? `rgba(255,178,63,${0.25 + 0.45 * pa})` : (b === MISSED ? '#565F65' : '#3A4246');
        g.fillRect(x + 28 + (l === 1 ? 30 : 0), y + 20 + l * 22, lw, 10); g.restore();
      }
      if (pa > 0) txt('ACCURATE', x + w - 24, y + h / 2, { size: 28, weight: 700, fam: MONO, color: COL.amber, align: 'right', alpha: pa });
      if (b === MISSED) txt(ma > 0 ? 'NOT UPDATED' : 'OLD', x + w - 24, y + h / 2, { size: 28, weight: 700, fam: MONO, color: ma > 0 ? COL.white : COL.dim, align: 'right', alpha: Math.max(ma, fadeIn(t, E.accurate + 1.2) * (1 - ma)) });
    }
    g.restore();
  }
  // phase 2: sloppy minus accurate
  const c2 = fadeIn(t, E.subtract - 0.2, 0.4) * (1 - smooth(ramp(t, E.mach - 0.4, E.mach)));
  if (c2 > 0) {
    g.save(); g.globalAlpha *= c2;
    label('RADAR PULSES', 420);
    axis(1);
    pulse(P1, 0.35, COL.white, 150); pulse(P2, 0.35, COL.white, 150);
    const u = outCubic(ramp(t, E.subtract + 0.2, E.subtract + 0.9));
    pulse(P1 - SHIFT * u, 1, COL.grey, 120);
    pulse(P2, 1, COL.amber, 120, 14);
    stamp(P1 - SHIFT * u, AX.y - 190, 'SLOPPY', fadeIn(t, E.subtract + 0.3), COL.grey);
    stamp(P2, AX.y - 190, 'ACCURATE', fadeIn(t, E.subtract + 0.5), COL.amber);
    brace(P1 - SHIFT, P2, AX.y + 60, fadeIn(t, E.subtract + 1.0), COL.white, 'MEASURED GAP');
    brace(P1 - SHIFT, P1, AX.y + 170, fadeIn(t, E.pop - 0.15), COL.amber, '');
    const pp = ramp(t, E.pop - 0.1, E.pop + 0.35);
    if (pp > 0) { g.save(); g.translate(CX, 1090); const sc = lerp(1.4, 1, outBack(pp)); g.scale(sc, sc);
      glowText('+0.34 s', 0, 0, { size: 130, color: COL.amber, alpha: smooth(pp * 2), blur: 26 }); g.restore(); }
    g.restore();
  }
  // phase 3: top-down radar, the search window slides off the Scud
  const c3 = fadeIn(t, E.mach - 0.3, 0.4);
  if (c3 > 0) {
    g.save(); g.globalAlpha *= c3;
    const t0 = E.mach - 0.3, t1 = E.struck + 0.6;
    const u = ramp(t, t0, t1);
    // grid
    const gx0 = 140, gx1 = 940, gy0 = 360, gy1 = 1240;
    g.save(); g.beginPath(); g.rect(gx0, gy0, gx1 - gx0, gy1 - gy0); g.clip();
    g.fillStyle = '#080A0B'; g.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    for (let x = gx0; x <= gx1; x += 80) line(x, gy0, x, gy1, COL.faint, 2);
    for (let y = gy0; y <= gy1; y += 80) line(gx0, y, gx1, y, COL.faint, 2);
    for (let k = 1; k <= 5; k++) { g.beginPath(); g.arc(CX, gy1 + 200, 220 * k, 0, 7); g.strokeStyle = COL.line; g.lineWidth = 2; g.stroke(); }
    // sweep line from the battery at the bottom
    const sw = -Math.PI / 2 + Math.sin(t * 1.4) * 0.75;
    line(CX, gy1 + 200, CX + Math.cos(sw) * 1400, gy1 + 200 + Math.sin(sw) * 1400, '#C8D6DC', 3, 0.35);
    // the Scud: moving down the screen
    const dx = lerp(470, 650, u), dy = lerp(gy0 + 60, gy1 - 120, u);
    g.beginPath(); g.arc(dx, dy, 11, 0, 7); g.fillStyle = COL.white; g.fill();
    for (let k = 1; k <= 6; k++) { g.beginPath(); g.arc(dx - (180 / 880) * k * 22, dy - k * 22, 9 - k, 0, 7); g.fillStyle = `rgba(233,237,239,${0.35 - k * 0.05})`; g.fill(); }
    // the range gate
    const s = outCubic(ramp(t, E.shift - 0.1, E.shift + 1.2));
    const off = 230 * s; // 687 m at this scale
    const bxC = dx - (180 / 880) * off, byC = dy - off;
    g.save(); g.strokeStyle = s > 0.5 ? COL.amber : COL.white; g.lineWidth = 4; g.setLineDash([18, 10]);
    if (s > 0.5) { g.shadowColor = COL.amber; g.shadowBlur = 12; }
    g.strokeRect(bxC - 80, byC - 80, 160, 160); g.restore();
    txt('SEARCH WINDOW', bxC, byC - 108, { size: 26, weight: 700, fam: MONO, color: s > 0.5 ? COL.amber : COL.white });
    g.restore();
    txt('SCUD · MACH 5', dx - 30, dy + 4, { size: 30, weight: 700, fam: MONO, color: COL.white, align: 'right', alpha: fadeIn(t, E.mach + 0.2) });
    if (s > 0.02) {
      const lx = Math.max(bxC, dx) + 120;
      line(lx, dy, lx, byC, COL.amber, 3, s);
      line(lx - 14, dy, lx + 14, dy, COL.amber, 3, s); line(lx - 14, byC, lx + 14, byC, COL.amber, 3, s);
      glowText('687 m', lx + 24, (dy + byC) / 2, { size: 56, color: COL.amber, align: 'left', alpha: fadeIn(t, E.shift + 0.5), blur: 12 });
    }
    txt('25 FEBRUARY 1991', CX, 300, { size: 52, alpha: fadeIn(t, E.d25 - 0.1) });
    g.restore();
  }
  g.restore();
}

// ---------------------------------------------------------------- S05 how close it came
function sceneClose(t) {
  const a = win(t, S.S05.start - 0.1, E.back + 0.2, 0.5, 0.45);
  if (a > 0) {
    g.save(); g.globalAlpha = a;
    const calA = 1 - smooth(ramp(t, E.reboot - 0.4, E.reboot));
    if (calA > 0) { g.save(); g.globalAlpha *= calA; calendar(t); g.restore(); }
    const rA = fadeIn(t, E.reboot - 0.2, 0.4);
    if (rA > 0) {
      g.save(); g.globalAlpha *= rA;
      label('REBOOT', 420, { size: 44, color: COL.white });
      const c = { x: CX, y: 720, r: 190 };
      const u = ramp(t, E.reboot + 0.2, E.reboot_t + 1.2);
      g.beginPath(); g.arc(c.x, c.y, c.r, 0, 7); g.strokeStyle = COL.line; g.lineWidth = 14; g.stroke();
      g.beginPath(); g.arc(c.x, c.y, c.r, -Math.PI / 2, -Math.PI / 2 + u * 2 * Math.PI); g.strokeStyle = COL.white; g.stroke();
      txt('60–90 s', c.x, c.y, { size: 76, weight: 700, fam: MONO });
      const back = smooth(ramp(t, E.reboot_t + 1.2, E.reboot_t + 1.8));
      label('CLOCK DRIFT', 1000, { size: 32 });
      glowText(back < 1 ? (0.3433 * (1 - back)).toFixed(4) + ' s' : '0.0000 s', CX, 1075, { size: 80, weight: 700, fam: MONO, color: back > 0.99 ? COL.white : COL.amber, blur: 10 });
      const nb = fadeIn(t, E.nobody - 0.1, 0.4);
      txt('WOULD IT HAVE HIT?', CX, 1190, { size: 50, alpha: nb });
      label('NOBODY CAN SAY', 1255, { alpha: fadeIn(t, E.nobody + 0.8), size: 34 });
      g.restore();
    }
    g.restore();
  }
}
const CAL = { x: 120, y: 520, cw: 120, ch: 96 };
function calendar(t) {
  txt('FEBRUARY 1991', CX, 360, { size: 64 });
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 0; i < 7; i++) txt(days[i], CAL.x + CAL.cw * (i + 0.5), 450, { size: 30, weight: 700, fam: MONO, color: COL.dim });
  const marks = {
    11: { at: E.israel, color: COL.white, text: 'ISRAELI DATA FLAGS THE DRIFT' },
    21: { at: E.israel + 1.6, color: COL.grey, text: 'ARMY WARNING MESSAGE' },
    25: { at: E.israel + 2.6, color: COL.white, text: 'THE MISSILE IS MISSED' },
    26: { at: E.d26, color: COL.amber, text: 'CORRECTED SOFTWARE ARRIVES' },
  };
  for (let d = 1; d <= 28; d++) {
    const idx = d + 4; // 1 Feb 1991 was a Friday
    const col = idx % 7, row = Math.floor(idx / 7);
    const x = CAL.x + CAL.cw * (col + 0.5), y = CAL.y + CAL.ch * row;
    const m = marks[d];
    const ma = m ? fadeIn(t, m.at - 0.1, 0.3) : 0;
    if (ma > 0) {
      g.save(); g.globalAlpha *= ma; g.lineWidth = 4; g.strokeStyle = m.color;
      if (m.color === COL.amber) { g.shadowColor = COL.amber; g.shadowBlur = 14; }
      g.beginPath(); g.arc(x, y, 40, 0, 7); g.stroke(); g.restore();
    }
    txt(String(d), x, y, { size: 38, weight: 700, fam: MONO, color: ma > 0.5 ? m.color : COL.grey });
  }
  // the legend
  let k = 0;
  for (const d of [11, 21, 25, 26]) {
    const m = marks[d], la = fadeIn(t, m.at, 0.35);
    const y = 1050 + k * 54;
    txt(`${d} FEB`, 150, y, { size: 32, weight: 700, fam: MONO, color: m.color, align: 'left', alpha: la });
    txt(m.text, 330, y, { size: 32, color: m.color === COL.grey ? COL.grey : m.color, align: 'left', alpha: la, spacing: 1 });
    k++;
  }
  glowText('ONE DAY TOO LATE', CX, 1290, { size: 58, color: COL.amber, alpha: fadeIn(t, E.d26 + 1.6, 0.4), blur: 14 });
}

// ---------------------------------------------------------------- the ending console and the loop
function sceneEnd(t) {
  const a = fadeIn(t, E.back - 0.3, 0.5);
  if (a <= 0) return;
  const clear = t >= DUR - 0.5; // Ctrl+L: back to the empty prompt of the first frame
  drawConsole(t, a, clear ? { typed: 0, answer: 0, zeros: 0, four: 0, cursor: true }
    : { typed: 9, answer: 1, zeros: 0, four: ramp(t, E.four2 - 0.05, E.four2 + 0.45), cursor: false });
}

// ---------------------------------------------------------------- frame
function draw(t) {
  g.globalAlpha = 1;
  g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
  sceneHook(t);
  sceneTenth(t);
  sceneClock(t);
  scenePuzzle(t);
  scenePatch(t);
  sceneClose(t);
  sceneEnd(t);
  // cut to black on the barracks line, held through the pause
  const blk = win(t, E.struck + 0.35, S.S05.start + 0.1, 0.25, 0.5);
  if (blk > 0) { g.globalAlpha = blk; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  film(t);
}

window.renderFrame = (t) => { draw(t); return true; };

async function boot() {
  TL = await fetch('../config/timeline.json').then(r => r.json());
  E = TL.events; S = {}; for (const s of TL.sections) S[s.name] = s;
  DUR = Math.ceil(TL.duration * 60) / 60;
  await Promise.all([font(800, 80), font(700, 40, MONO), font(500, 30, MONO)].map(f => document.fonts.load(f)));
  initFilm();
  window.DURATION = DUR;
  window.READY = true;
}
boot().catch(e => { window.BOOT_ERROR = String(e && e.stack || e); console.error(e); });
