// "The flat Starlink antenna that steers without moving" — deterministic frame renderer.
// Everything is a pure function of time t (seconds): window.renderFrame(t).
//   SKY   scene: roof, flat panel, time-lapse satellite pass, beam that swings while the panel stays put.
//   FIELD scene: a real wave-interference simulation (every source adds its own ripple in the shader),
//                shown first as a pond, then as radio waves from a row of antennas.
import * as THREE from 'three';

const W = 1080, H = 1920;
const COL = {
  bg: '#05070F', amber: '#FCC048', white: '#FFFFFF', grey: '#A3ACBA', dim: '#687285',
  blue: '#7DB7FF', cyan: '#6FE3FF', panel: 'rgba(13,18,30,0.86)', line: 'rgba(163,172,186,0.35)',
};
const SANS = 'InterX', MONO = 'JBM';
const D2R = Math.PI / 180;

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const smooth = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const inOut = u => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const outCubic = u => 1 - Math.pow(1 - clamp(u), 3);
const outBack = u => { u = clamp(u); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const win = (t, a, b, fi = 0.35, fo = 0.35) => Math.min(smooth(ramp(t, a, a + fi)), 1 - smooth(ramp(t, b - fo, b)));
const fmt = n => Math.round(n).toLocaleString('en-US');

let TL, E, F;

// ---------------------------------------------------------------- wave model (shared by shader + overlay)
const LAMBDA = 1, K = 2 * Math.PI / LAMBDA;
const PERIOD = 0.6, OMEGA = 2 * Math.PI / PERIOD, C_PHASE = LAMBDA / PERIOD;
const CF = 3.6;                       // speed of the ripple front (how fast the field fills in)
const NEL = 24, DX = 0.5 * LAMBDA;    // antennas / stones in the row, half a wavelength apart
const elX = i => (i - (NEL - 1) / 2) * DX;
const TAPER = Array.from({ length: NEL }, (_, i) => Math.exp(-3.0 * Math.pow((i - (NEL - 1) / 2) / ((NEL - 1) / 2), 2)));
const TAPER_SUM = TAPER.reduce((a, b) => a + b, 0);
const STEP_DT = 0.15;                 // pond: each stone lands 0.15 s after its neighbour (= 30 degrees, see below)
const THETA_DROP = Math.asin(OMEGA * STEP_DT / (K * DX));   // 30 degrees
const NSRC = 2 + 2 * NEL;             // 2 stones + row (in phase) + row (staggered)
const ROW2 = 2 + NEL;
const Z_ARRAY = 0;                    // the row of stones / antennas sits on this line (shore / panel edge)

// ---------------------------------------------------------------- renderer + 2D layer
const glCanvas = document.getElementById('gl');
const ui = document.getElementById('ui');
const g = ui.getContext('2d');
let renderer;

function font(weight, size, fam = SANS) { return `${weight} ${size}px ${fam}`; }
function text(str, x, y, { f = font(800, 40), color = COL.white, align = 'center', base = 'alphabetic', alpha = 1, shadow = 0, spacing = 0 } = {}) {
  if (alpha <= 0.002) return;
  g.save();
  g.globalAlpha *= alpha;
  g.font = f; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
  g.letterSpacing = `${spacing}px`;
  if (shadow) { g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = shadow; g.shadowOffsetY = shadow / 5; }
  g.fillText(str, x, y);
  g.restore();
}
function measure(str, f, spacing = 0) { g.save(); g.font = f; g.letterSpacing = `${spacing}px`; const w = g.measureText(str).width; g.restore(); return w; }
function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function card(x, y, w, h, alpha = 1, r = 22) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha *= alpha;
  rrect(x, y, w, h, r); g.fillStyle = COL.panel; g.fill();
  g.strokeStyle = COL.line; g.lineWidth = 1.5; g.stroke();
  g.restore();
}
function dashedLine(x0, y0, x1, y1, color, width, dash, alpha = 1) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
}
function glowDot(x, y, r, color, alpha = 1) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha *= alpha; g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
}
function fillBg(alpha) { if (alpha <= 0) return; g.save(); g.globalAlpha = alpha; g.fillStyle = COL.bg; g.fillRect(0, 0, W, H); g.restore(); }
function iris(cx, cy, r) {
  if (r >= 1900) return;
  g.save(); g.fillStyle = COL.bg; g.beginPath(); g.rect(0, 0, W, H);
  if (r > 0.5) g.arc(cx, cy, r, 0, Math.PI * 2, true);
  g.fill('evenodd'); g.restore();
}
function toScreen(cam, v) {
  const p = v.clone().project(cam);
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, front: p.z < 1 };
}

// ---------------------------------------------------------------- shared GL bits
function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, s] of stops) gr.addColorStop(o, s);
  x.fillStyle = gr; x.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function glowSprite(tex, size, color = 0xffffff, opacity = 1, depthTest = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, depthTest, transparent: true, toneMapped: false, opacity }));
  s.scale.set(size, size, 1); return s;
}
function std(color, rough = 0.5, metal = 0.1, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }); }
// place a unit-height cylinder so it spans a -> b
const UP = new THREE.Vector3(0, 1, 0);
function span(mesh, a, b) {
  const d = b.clone().sub(a), len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, d.normalize());
  mesh.scale.set(1, len, 1);
  return len;
}

// =====================================================================================================
// SKY SCENE
// =====================================================================================================
const SKY = {};
const XR = 11.8, YR = 14.0;                       // satellite path: an ellipse over the panel (not to scale)
const BEAM_BASE = new THREE.Vector3(0, 0.9, 0);
const PASS = {};
const domePos = u => { const a = lerp(-78, 78, u) * D2R; return new THREE.Vector3(XR * Math.sin(a), YR * Math.cos(a) + 0.5, 0); };
const passU = (p, t) => (t - p.t0) / p.dur;
const angleOf = v => Math.atan2(v.x - BEAM_BASE.x, v.y - BEAM_BASE.y);

function initPasses() {
  PASS.A = { t0: E.sat - 0.3, dur: 8.0 };
  PASS.B = { t0: E.how - 0.15, dur: 9.5 };
  PASS.C1 = { t0: 58.9, dur: 11.0 };               // sinks at the right horizon as the beam jumps ("aims there")
  PASS.C2 = { t0: 67.9, dur: 11.0 };               // rises on the word "rises"
  PASS.C3 = { t0: 76.9, dur: 9.0 };
}
const H1 = 69.45, H2 = 77.9, SWEEP = 0.5;         // hand-off times (beam jumps to the next satellite)
function trackedPass(t) {
  if (t < 14.9) return 'A';
  if (t < 59) return 'B';
  if (t < H1) return 'C1';
  if (t < H2) return 'C2';
  return 'C3';
}
function passTarget(key, t) {
  const p = PASS[key], u = clamp(passU(p, t), 0, 1), v = domePos(u).sub(BEAM_BASE);
  return { angle: Math.atan2(v.x, v.y), len: v.length(), u: passU(p, t) };
}
// where the beam points at time t: {angle, len, alpha}
function beamAt(t) {
  const key = trackedPass(t);
  let { angle, len, u } = passTarget(key, t);
  const hand = (h, from) => {
    const tau = ramp(t, h, h + SWEEP);
    if (tau < 1) { const o = passTarget(from, h); const e = inOut(tau); angle = lerp(o.angle, angle, e); len = lerp(o.len, len, e); }
  };
  if (key === 'C2') hand(H1, 'C1');
  if (key === 'C3') hand(H2, 'C2');
  let alpha = smooth(ramp(u, 0.0, 0.05)) * (1 - smooth(ramp(u, 0.93, 1.0)));
  if (key === 'A') alpha *= smooth(ramp(t, E.sat, E.sat + 0.4));
  if (key === 'C2' || key === 'C3') alpha = 1;      // the old beam jumps, it does not fade
  return { angle, len, alpha };
}
// rate-limited motor dish chasing satellite B (deterministic integration)
const DISH_RATE = 6.0 * D2R;
function dishAngle(t) {
  const t0 = E.motor;
  let th = passTarget('B', t0).angle;
  const dt = 1 / 120;
  for (let s = t0; s < t; s += dt) {
    const want = passTarget('B', s).angle, d = want - th;
    th += clamp(d, -DISH_RATE * dt, DISH_RATE * dt);
  }
  return th;
}

function skyBackground(horizon = 0.28, range = 0.67) {
  return new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uH: { value: horizon }, uHR: { value: range } },
    vertexShader: `void main(){ gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: `uniform float uTime, uH, uHR; uniform vec2 uRes;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*vn(p); p *= 2.07; a *= 0.5; } return s; }
      float starLayer(vec2 fc, float cell, float dens, float seed){
        vec2 c = floor(fc / cell);
        float r1 = h21(c + seed), r2 = h21(c + seed + 7.3), r3 = h21(c + seed + 19.1);
        if (r1 < dens) return 0.0;
        vec2 pos = (c + 0.2 + 0.6 * vec2(r2, r3)) * cell;
        float d = length(fc - pos);
        float size = 0.7 + 1.6 * pow(r3, 4.0) * (cell / 20.0);
        float tw = 0.78 + 0.22 * sin(uTime * (0.8 + 3.0 * r2) + r1 * 60.0);
        return smoothstep(size, 0.0, d) * (0.35 + 0.65 * pow(r2, 2.0)) * tw;
      }
      void main(){
        vec2 fc = gl_FragCoord.xy; vec2 uv = fc / uRes;
        vec3 zen = vec3(0.004, 0.008, 0.028), hor = vec3(0.02, 0.04, 0.095);
        vec3 col = mix(hor, zen, smoothstep(uH, uH + uHR, uv.y));
        float d = (uv.x - 0.5) * 0.85 + (uv.y - 0.62) * 0.6;
        float band = exp(-pow(d * 3.6, 2.0));
        col += vec3(0.30, 0.36, 0.62) * band * (0.25 + 0.75 * fbm(uv * vec2(7.0, 11.0))) * 0.045;
        float s = starLayer(fc, 24.0, 0.80, 1.0) + 0.7 * starLayer(fc, 11.0, 0.87, 5.0);
        col += vec3(0.85, 0.9, 1.0) * s * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
}

function gridTexture(w, h, cols, rows, base, cell, edge, margin = 0.06) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  const mx = w * margin, my = h * margin, cw = (w - 2 * mx) / cols, ch = (h - 2 * my) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = mx + i * cw + cw * 0.12, py = my + j * ch + ch * 0.12;
    x.fillStyle = cell; x.strokeStyle = edge; x.lineWidth = 1.5;
    x.beginPath(); x.roundRect(px, py, cw * 0.76, ch * 0.76, 4); x.fill(); x.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function makeSat() {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 0.16), std(0xc9d0de, 0.35, 0.55));
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.12), std(0x8d97aa, 0.5, 0.6)); arm.position.x = 1.35;
  const tex = gridTexture(512, 128, 12, 3, '#0a1230', '#16306b', '#2c58b8', 0.03);
  const arr = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.5, 0.05), std(0xffffff, 0.3, 0.4, { map: tex, emissive: 0x0b1c4a, emissiveIntensity: 0.6 }));
  arr.position.x = 4.9;
  grp.add(body, arm, arr);
  const glow = glowSprite(SKY.glowTex, 4.2, 0xfff2cf, 0.9); glow.position.set(0, 0, 0.3); grp.add(glow);
  grp.scale.setScalar(0.9);
  return grp;
}

function buildSky() {
  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, W / H, 1, 600);
  SKY.glowTex = radialTexture([[0, 'rgba(255,244,214,1)'], [0.12, 'rgba(255,214,140,0.8)'], [0.35, 'rgba(255,170,70,0.22)'], [1, 'rgba(255,120,30,0)']]);
  const bg = skyBackground(); bg.frustumCulled = false; bg.renderOrder = -100; sc.add(bg); SKY.bg = bg;

  sc.add(new THREE.HemisphereLight(0xb4bfdc, 0x0a0d18, 1.0));
  const moon = new THREE.DirectionalLight(0xffffff, 1.35); moon.position.set(-30, 45, 40); sc.add(moon);
  const spill = new THREE.PointLight(0xffb74a, 0, 40, 1.6); spill.position.set(0, 3.5, 2); sc.add(spill); SKY.spill = spill;

  // house: gable roof seen from the long side, ridge along x
  const hs = new THREE.Shape();
  const eaveY = -3.5 - 9 * Math.tan(25 * D2R);
  hs.moveTo(-9, -40); hs.lineTo(9, -40); hs.lineTo(9, eaveY); hs.lineTo(0, -3.5); hs.lineTo(-9, eaveY); hs.closePath();
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 60, bevelEnabled: false });
  hg.rotateY(Math.PI / 2); hg.translate(-30, 0, 0);
  const house = new THREE.Mesh(hg, std(0x0c121c, 0.95, 0));
  sc.add(house);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(60, 0.18, 0.18), new THREE.MeshBasicMaterial({ color: 0x35507d }));
  ridge.position.set(0, -3.5, 0); sc.add(ridge);
  const eave = ridge.clone(); eave.position.set(0, eaveY, 9); sc.add(eave);
  // one warm window: somebody is home
  const wc = document.createElement('canvas'); wc.width = 256; wc.height = 192; const wx = wc.getContext('2d');
  const wgr = wx.createLinearGradient(0, 0, 0, 192); wgr.addColorStop(0, '#b87a2c'); wgr.addColorStop(1, '#e8a64a');
  wx.fillStyle = wgr; wx.fillRect(0, 0, 256, 192); wx.fillStyle = '#1a1209'; wx.fillRect(122, 0, 12, 192); wx.fillRect(0, 90, 256, 12);
  wx.strokeStyle = '#1a1209'; wx.lineWidth = 14; wx.strokeRect(0, 0, 256, 192);
  const wtex = new THREE.CanvasTexture(wc); wtex.colorSpace = THREE.SRGBColorSpace;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshBasicMaterial({ map: wtex, toneMapped: false }));
  win.position.set(-6.5, eaveY - 3.6, 9.05); sc.add(win);
  const winGlow = glowSprite(SKY.glowTex, 11, 0xffb04a, 0.4); winGlow.position.set(-6.5, eaveY - 3.6, 9.6); sc.add(winGlow);

  // mast + flat panel
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 3.4, 16), std(0x1a2230, 0.7, 0.4));
  mast.position.set(0, -1.9, 0); sc.add(mast);

  const panel = new THREE.Group(); sc.add(panel); SKY.panel = panel;
  const pg = new THREE.ExtrudeGeometry(roundedRectShape(12, 9, 1.0), { depth: 0.5, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 3, curveSegments: 14 });
  pg.rotateX(-Math.PI / 2);
  const pm = new THREE.Mesh(pg, std(0xf6f7fa, 0.5, 0.05)); panel.add(pm);
  const topTex = gridTexture(1024, 768, 20, 15, '#f3f5f9', '#dde2ec', '#c3cad8', 0.055);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 8.6), new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.55, metalness: 0.05 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.66; panel.add(top);
  const feed = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), new THREE.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(255,200,100,0.9)'], [0.5, 'rgba(255,170,60,0.25)'], [1, 'rgba(255,150,40,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }));
  feed.rotation.x = -Math.PI / 2; feed.position.y = 0.7; panel.add(feed); SKY.feed = feed;
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x59ffa6, toneMapped: false });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), ledMat); led.position.set(5.2, 0.7, 3.9); panel.add(led); SKY.led = ledMat;

  // old-style motor dish (appears for one sentence)
  const dish = new THREE.Group(); dish.position.set(0, 1.0, 0); sc.add(dish); SKY.dish = dish;
  const pts = []; const f = 3.0;
  for (let i = 0; i <= 24; i++) { const r = 5.2 * i / 24; pts.push(new THREE.Vector2(r, r * r / (4 * f))); }
  for (let i = 24; i >= 0; i--) { const r = 5.2 * i / 24; pts.push(new THREE.Vector2(r, r * r / (4 * f) - 0.12)); }
  const dishMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), std(0xdfe5f0, 0.4, 0.2, { side: THREE.DoubleSide }));
  dish.add(dishMesh);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, f, 8), std(0x7e889b, 0.5, 0.5)); horn.position.y = f / 2; dish.add(horn);
  const hornTip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), std(0x9aa5ba, 0.4, 0.5)); hornTip.position.y = f; dish.add(hornTip);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.6, 12), std(0x6c7588, 0.6, 0.5)); post.position.set(0, 0.2, 0); sc.add(post); SKY.post = post;
  dish.scale.setScalar(0.001);

  // dome path + satellites
  const dp = []; for (let i = 0; i <= 90; i++) dp.push(...domePos(i / 90).toArray());
  const pathGeo = new THREE.BufferGeometry(); pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  const path = new THREE.Points(pathGeo, new THREE.PointsMaterial({ color: 0x7f97c8, size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0.38, depthWrite: false }));
  sc.add(path); SKY.path = path;
  SKY.sats = {};
  for (const k of ['A', 'B', 'C1', 'C2', 'C3']) { const s = makeSat(); s.visible = false; sc.add(s); SKY.sats[k] = s; }

  // beam: a soft cone with wave bands running along it
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(COL.amber) }, uAlpha: { value: 0 }, uTime: { value: 0 }, uLen: { value: 10 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha, uTime, uLen; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.4);
        float bands = 0.55 + 0.45 * sin(vUv.y * uLen * 2.4 - uTime * 11.0);
        float fade = smoothstep(0.0, 0.05, vUv.y) * (1.0 - 0.55 * smoothstep(0.7, 1.0, vUv.y));
        float a = uAlpha * edge * (0.35 + 0.65 * bands) * fade * (0.9 - 0.35 * vUv.y);
        gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.95, 0.8), edge * 0.5), a * 0.62);
        #include <colorspace_fragment>
      }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 3.3, 1, 40, 1, true), beamMat);  // top (satellite) narrow, bottom (panel) wide
  beam.frustumCulled = false; sc.add(beam); SKY.beam = beam; SKY.beamMat = beamMat;
  // where the dish is really pointing (grey) vs where the satellite is (amber, dashed)
  const lineMat = (hex) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(hex) }, uAlpha: { value: 0 }, uDash: { value: 0 }, uLen: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha, uDash, uLen; varying vec2 vUv;
      void main(){
        float a = uAlpha;
        if (uDash > 0.0) { float d = fract(vUv.y * uLen / uDash); a *= smoothstep(0.0, 0.1, d) * (1.0 - smoothstep(0.5, 0.6, d)); }
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
  SKY.dishLine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true), lineMat(0xe8eefc)); SKY.dishLine.frustumCulled = false;
  SKY.satLine = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true), lineMat(COL.amber)); SKY.satLine.frustumCulled = false;
  sc.add(SKY.dishLine, SKY.satLine);
  SKY.sc = sc; SKY.cam = cam;
}

// camera: elevated, slow drift. screen y of the panel centre stays near 1130 px
function skyCamera(t) {
  const cam = SKY.cam, el = 20 * D2R, dist = 96 * (1 - 0.035 * ramp(t, 0, 6));
  const tx = 1.6 * Math.sin(t * 0.13), ty = 1.06;
  cam.position.set(tx, ty + dist * Math.sin(el), dist * Math.cos(el));
  cam.lookAt(tx * 0.4, ty, 0);
  cam.updateMatrixWorld();
}
const panelScreen = () => toScreen(SKY.cam, new THREE.Vector3(0, 0.5, 0));

function updateSky(t) {
  skyCamera(t);
  SKY.bg.material.uniforms.uTime.value = t;
  // panel <-> motor dish swap
  const dishOn = smooth(ramp(t, E.motor, E.motor + 0.4)) * (1 - smooth(ramp(t, E.steer - 0.05, E.steer + 0.35)));
  SKY.panel.scale.setScalar(Math.max(0.001, 1 - dishOn));
  SKY.dish.scale.setScalar(Math.max(0.001, dishOn));
  SKY.post.scale.setScalar(Math.max(0.001, dishOn));
  const dAng = (t >= E.motor - 0.01 && t <= E.steer + 0.5) ? dishAngle(Math.min(t, E.steer + 0.4)) : 0;
  SKY.dish.rotation.z = -dAng;
  SKY.dish.position.y = 1.0;
  SKY.led.color.setRGB(0.1, 1.0, 0.45).multiplyScalar(0.6 + 0.4 * Math.sin(t * 3.0) ** 2);

  // satellites
  for (const k of Object.keys(SKY.sats)) {
    const s = SKY.sats[k], u = passU(PASS[k], t);
    s.visible = u > -0.001 && u < 1.001;
    if (s.visible) {
      const p = domePos(clamp(u, 0, 1)); s.position.copy(p);
      s.lookAt(0, 0, 0);
      const f = smooth(ramp(u, 0, 0.04)) * (1 - smooth(ramp(u, 0.96, 1)));
      s.scale.setScalar(0.9 * Math.max(0.001, f));
    }
  }
  // beam
  const b = beamAt(t);
  const k = trackedPass(t);
  let beamAlpha = b.alpha;
  if (t < E.sat) beamAlpha = 0;
  beamAlpha *= (1 - dishOn);
  // beam appears when the panel takes over again: bright flash on lock-on
  const lock = smooth(ramp(t, E.steer + 0.1, E.steer + 0.5));
  if (t >= E.motor - 0.2 && t < E.steer + 0.1) beamAlpha = 0;
  if (t >= E.steer + 0.1 && t < 25) beamAlpha *= lock;
  const dir = new THREE.Vector3(Math.sin(b.angle), Math.cos(b.angle), 0);
  const tip = BEAM_BASE.clone().addScaledVector(dir, b.len);
  const len = span(SKY.beam, BEAM_BASE, tip);
  SKY.beamMat.uniforms.uAlpha.value = beamAlpha;
  SKY.beamMat.uniforms.uTime.value = t;
  SKY.beamMat.uniforms.uLen.value = len;
  SKY.feed.material.opacity = beamAlpha * 0.26;
  SKY.spill.intensity = beamAlpha * 22;
  // dish pointing line vs satellite line (motor section only)
  const dl = dishOn > 0.02 ? 1 : 0;
  const dishBase = new THREE.Vector3(0, 1.0, 0);
  const dLen = 17;
  const dTip = dishBase.clone().add(new THREE.Vector3(Math.sin(dAng), Math.cos(dAng), 0).multiplyScalar(dLen));
  span(SKY.dishLine, dishBase, dTip);
  SKY.dishLine.material.uniforms.uAlpha.value = dl * dishOn * 0.55;
  SKY.dishLine.material.uniforms.uLen.value = dLen; SKY.dishLine.material.uniforms.uDash.value = 0.0;
  const bt = passTarget('B', t);
  const sTip = dishBase.clone().add(new THREE.Vector3(Math.sin(bt.angle), Math.cos(bt.angle), 0).multiplyScalar(bt.len));
  const sLen = span(SKY.satLine, dishBase, sTip);
  SKY.satLine.material.uniforms.uAlpha.value = dl * dishOn * 0.7;
  SKY.satLine.material.uniforms.uLen.value = sLen; SKY.satLine.material.uniforms.uDash.value = 0.9;
  SKY.info = { dishAng: dAng, beamAng: b.angle, satAng: passTarget('B', t).angle, beamAlpha, dishOn };
}

// =====================================================================================================
// FIELD SCENE (pond -> radio)
// =====================================================================================================
const FLD = {};
const stoneT = () => [E.stones, E.stones + PERIOD];            // the two stones: one period apart, so they ripple in step
const STONE_X = 2.4, STONE_Z = -6;
function rowOn(t) { return E.row + 0.55; }                      // row of stones lands (all together)
function rowOff() { return E.late + 0.07; }
function row2T0() { return E.late + 0.25; }                      // staggered row starts landing

// beam angle of the row (radians): 0 for the in-phase row, then 30 degrees, then follows the satellite glyph
function thetaField(t) {
  if (t < row2T0()) return 0;
  let th = THETA_DROP;
  const toSat = ramp(t, E.tilt, E.tilt + 0.9);
  th = lerp(th, 44 * D2R, inOut(toSat));
  th = lerp(th, 38 * D2R, inOut(ramp(t, E.tilt + 1.0, E.tilt + 2.2)));
  return th;
}
// constant chosen so the steered phases equal the phases the staggered stone drops produced (no jump when steering starts)
const phi0 = () => OMEGA * row2T0() + 0.5 * (NEL - 1) * OMEGA * STEP_DT;
function rowPhase(i, th) { return K * elX(i) * Math.sin(th) + phi0(); }
function row2Onset(i) { return row2T0() + STEP_DT * i; }

function fieldSources(t) {
  const src = new Array(NSRC), off = new Array(NSRC), ph = new Array(NSRC);
  const OFFNEVER = 1e9;
  const [s1, s2] = stoneT();
  const stoneOff = E.row - 0.05;
  const sw = 0.5;
  src[0] = new THREE.Vector4(-STONE_X, STONE_Z, s1, sw); off[0] = stoneOff; ph[0] = OMEGA * s1;
  src[1] = new THREE.Vector4(STONE_X, STONE_Z, s2, sw); off[1] = stoneOff; ph[1] = OMEGA * s2;
  const th = thetaField(t);
  for (let i = 0; i < NEL; i++) {
    const w = TAPER[i] / TAPER_SUM;
    // in-phase row
    src[2 + i] = new THREE.Vector4(elX(i), Z_ARRAY, rowOn(t), w); off[2 + i] = rowOff(); ph[2 + i] = 0;
    // staggered / steered row
    src[ROW2 + i] = new THREE.Vector4(elX(i), Z_ARRAY, row2Onset(i), w); off[ROW2 + i] = OFFNEVER; ph[ROW2 + i] = rowPhase(i, th);
  }
  return { src, off, ph };
}

function buildField() {
  const sc = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, W / H, 0.5, 400);
  const geo = new THREE.PlaneGeometry(28, 54, 350, 675); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -7);   // z from -34 to 20
  const uniforms = {
    uTime: { value: 0 }, uK: { value: K }, uOmega: { value: OMEGA }, uCf: { value: CF },
    uSrc: { value: Array.from({ length: NSRC }, () => new THREE.Vector4(0, 0, 1e9, 0)) },
    uOff: { value: new Array(NSRC).fill(1e9) }, uPh: { value: new Array(NSRC).fill(0) },
    uBaffle: { value: 0 }, uZA: { value: Z_ARRAY }, uHS: { value: 0.12 }, uRadio: { value: 0 }, uGlow: { value: 0 },
    uCam: { value: new THREE.Vector3() }, uRowLine: { value: 0 }, uFog: { value: new THREE.Vector3(0.0075, 0.014, 0.043) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, toneMapped: false,
    vertexShader: `uniform float uTime, uK, uOmega, uCf, uBaffle, uZA, uHS;
      uniform vec4 uSrc[${NSRC}]; uniform float uOff[${NSRC}]; uniform float uPh[${NSRC}];
      varying vec3 vW; varying float vH; varying vec2 vRI; varying vec2 vG; varying float vMask;
      void main(){
        vec3 p = position;
        float re = 0., im = 0., reX = 0., imX = 0., reZ = 0., imZ = 0.;
        for (int i = 0; i < ${NSRC}; i++) {
          vec4 s = uSrc[i];
          vec2 d = p.xz - s.xy;
          float r = length(d);
          float on = uCf * (uTime - s.z) - r;            // >0 once the first ripple has arrived
          if (on < 0.0) continue;
          float stop = r - uCf * (uTime - uOff[i]);       // >0 once the last ripple has passed
          float env = smoothstep(0.0, 1.6, on) * smoothstep(0.0, 1.6, stop);
          if (env <= 0.0) continue;
          float a = s.w * env * inversesqrt(1.0 + 0.25 * r);
          float th = uK * r + uPh[i];
          float c = cos(th), sn = sin(th);
          vec2 u = d / max(r, 0.001);
          re += a * c; im += a * sn;
          reX += a * c * u.x; imX += a * sn * u.x; reZ += a * c * u.y; imZ += a * sn * u.y;
        }
        float m = 1.0 - uBaffle * smoothstep(uZA - 0.05, uZA + 0.25, p.z);
        re *= m; im *= m; reX *= m; imX *= m; reZ *= m; imZ *= m;
        float ct = cos(uOmega * uTime), st = sin(uOmega * uTime);
        float h = re * ct + im * st;
        vH = h; vRI = vec2(re, im); vMask = m;
        vG = vec2(-uK * (imX * ct - reX * st), -uK * (imZ * ct - reZ * st));
        p.y = uHS * h;
        vW = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform float uHS, uBaffle, uZA, uRadio, uGlow, uRowLine; uniform vec3 uCam, uFog;
      varying vec3 vW; varying float vH; varying vec2 vRI; varying vec2 vG; varying float vMask;
      vec3 S(vec3 c){ return pow(c, vec3(2.2)); }
      void main(){
        float I = dot(vRI, vRI);
        vec3 V = normalize(uCam - vW);
        vec3 N = normalize(vec3(-2.6 * uHS * vG.x, 1.0, -2.6 * uHS * vG.y));
        // ---- pond
        vec3 deep = S(vec3(0.02, 0.07, 0.14)), shallow = S(vec3(0.05, 0.28, 0.42));
        vec3 L = normalize(vec3(-0.35, 0.85, -0.4));
        float diff = max(dot(N, L), 0.0);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 R = reflect(-V, N);
        float spec = pow(max(dot(R, L), 0.0), 90.0);
        float crest = pow(0.5 + 0.5 * clamp(vH * 1.7, -1.0, 1.0), 1.4);
        vec3 pond = mix(deep, shallow, crest) * (0.5 + 0.9 * diff) + S(vec3(0.35, 0.6, 0.85)) * fres * 0.5 + S(vec3(0.9, 0.97, 1.0)) * spec * 0.55;
        pond += S(vec3(0.55, 0.85, 1.0)) * smoothstep(0.55, 1.0, crest) * 0.35;
        // seen from straight above there is no glint, so colour by wave height instead
        float topView = smoothstep(0.55, 0.95, V.y);
        vec3 pondTop = mix(S(vec3(0.004, 0.02, 0.05)), S(vec3(0.16, 0.62, 0.85)), pow(crest, 1.5)) + S(vec3(0.8, 0.97, 1.0)) * smoothstep(0.8, 1.0, crest) * 0.45;
        pond = mix(pond, pondTop, topView);
        pond += S(vec3(0.05, 0.38, 0.62)) * pow(I, 0.8) * 0.5 * uGlow * (1.0 - 0.7 * topView);
        // ---- radio: crest = cyan/white, trough = amber, nothing = black
        float v = clamp(vH * 1.25, -1.0, 1.0);
        float pv = max(v, 0.0), nv = max(-v, 0.0);
        vec3 radio = S(vec3(0.0, 0.55, 0.9)) * pow(pv, 0.9) + S(vec3(0.7, 0.95, 1.0)) * pow(pv, 3.0) * 0.8 + S(vec3(1.0, 0.62, 0.1)) * pow(nv, 1.0) * 0.55;
        radio += S(vec3(0.05, 0.1, 0.35)) * pow(I, 0.7) * 0.7 * uGlow + S(vec3(0.01, 0.015, 0.04));
        vec3 col = mix(pond, radio, uRadio);
        // ---- ground behind the row (shore / circuit board)
        float gmask = uBaffle * smoothstep(uZA + 0.02, uZA + 0.22, vW.z);
        vec2 gp = vW.xz / 0.5;
        float grid = max(smoothstep(0.96, 1.0, abs(fract(gp.x + 0.5) - 0.5) * 2.0), smoothstep(0.96, 1.0, abs(fract(gp.y + 0.5) - 0.5) * 2.0));
        vec3 ground = mix(S(vec3(0.075, 0.07, 0.07)), S(vec3(0.02, 0.03, 0.06)), uRadio) + S(vec3(0.12, 0.2, 0.4)) * grid * 0.35 * uRadio;
        ground += S(vec3(0.7, 0.85, 0.95)) * (1.0 - smoothstep(0.0, 0.14, abs(vW.z - uZA - 0.06))) * uBaffle * (1.0 - uRadio) * 0.5;
        col = mix(col, ground, gmask);
        // ---- distance fade into the dark
        float dist = distance(uCam.xz, vW.xz);      // horizontal, so the overhead camera is not fogged
        col = mix(col, uFog, smoothstep(14.0, 40.0, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(geo, mat); water.frustumCulled = false; sc.add(water);
  const fbg = skyBackground(0.79, 0.2); fbg.frustumCulled = false; fbg.renderOrder = -100; sc.add(fbg); FLD.bg = fbg;
  FLD.mat = mat; FLD.u = uniforms;

  // stones (two) that fall into the pond
  FLD.stones = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd98a, toneMapped: false }));
    const gl = glowSprite(SKY.glowTex, 1.3, 0xffc766, 0.6, false); m.add(gl); m.visible = false; sc.add(m); return m;
  });
  FLD.splash = [0, 1].map(() => { const s = glowSprite(SKY.glowTex, 3.0, 0xbfe6ff, 0, false); s.position.y = 0.1; sc.add(s); return s; });

  // markers for the two rows (round "stones" -> square antennas)
  const markGeo = new THREE.PlaneGeometry(0.44, 0.44); markGeo.rotateX(-Math.PI / 2);
  const markMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uAlpha: { value: 0 }, uPulse: { value: 0 }, uSq: { value: 0 }, uColor: { value: new THREE.Color('#FFE3A3') } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uAlpha, uPulse, uSq; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0; float rad = mix(1.0, 0.22, uSq);
        vec2 q = abs(p) - (1.0 - rad); float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rad;
        float fill = 1.0 - smoothstep(-0.04, 0.05, d);
        float ring = smoothstep(-0.28, -0.12, d) * (1.0 - smoothstep(-0.12, 0.04, d));
        vec3 c = uColor * (0.55 + 0.75 * uPulse) * mix(0.6, 1.0, ring);
        float halo = (1.0 - smoothstep(0.0, 1.0, length(p))) * 0.25;
        gl_FragColor = vec4(c + vec3(0.25) * halo, (fill * 0.95 + halo) * uAlpha);
        #include <colorspace_fragment>
      }`,
  });
  FLD.marks1 = []; FLD.marks2 = [];
  for (let i = 0; i < NEL; i++) {
    const m1 = new THREE.Mesh(markGeo, markMat()); m1.position.set(elX(i), 0.06, Z_ARRAY); m1.frustumCulled = false; sc.add(m1); FLD.marks1.push(m1);
    const m2 = new THREE.Mesh(markGeo, markMat()); m2.position.set(elX(i), 0.07, Z_ARRAY); m2.frustumCulled = false; sc.add(m2); FLD.marks2.push(m2);
  }
  FLD.sc = sc; FLD.cam = cam;
  // camera keyframes: oblique over the pond -> straight down
  const a = new THREE.PerspectiveCamera(); a.position.set(0, 8.2, 13.5); a.up.set(0, 1, 0); a.lookAt(0, 0.0, -6.5); a.updateMatrixWorld();
  const b = new THREE.PerspectiveCamera(); b.position.set(0, 63.4, -0.7); b.up.set(0, 0, -1); b.lookAt(0, 0, -0.7); b.updateMatrixWorld();
  FLD.camA = { p: a.position.clone(), q: a.quaternion.clone(), fov: 42 };
  FLD.camB = { p: b.position.clone(), q: b.quaternion.clone(), fov: 30 };
}

function fieldCamera(t) {
  const cam = FLD.cam;
  const u = inOut(ramp(t, E.row - 1.0, E.row + 2.7));
  cam.position.lerpVectors(FLD.camA.p, FLD.camB.p, u);
  cam.quaternion.slerpQuaternions(FLD.camA.q, FLD.camB.q, u);
  // a gentle drift while the pond is oblique
  const drift = (1 - u) * (1 - u);
  cam.position.x += 0.8 * Math.sin(t * 0.4) * drift;
  cam.fov = lerp(FLD.camA.fov, FLD.camB.fov, u);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  return u;
}

function updateField(t) {
  const camU = fieldCamera(t);
  FLD.bg.material.uniforms.uTime.value = t;
  const u = FLD.u, { src, off, ph } = fieldSources(t);
  u.uTime.value = t;
  for (let i = 0; i < NSRC; i++) { u.uSrc.value[i].copy(src[i]); u.uOff.value[i] = off[i]; u.uPh.value[i] = ph[i]; }
  u.uCam.value.copy(FLD.cam.position);
  u.uBaffle.value = smooth(ramp(t, E.row - 0.6, E.row + 1.2));
  const radio = smooth(ramp(t, E.panel + 0.1, E.panel + 2.2));
  u.uRadio.value = radio;
  u.uHS.value = 0.12 * (1 - radio);
  u.uGlow.value = smooth(ramp(t, E.cross - 0.4, E.cross + 1.6)) * (0.6 + 0.4 * radio);

  // falling stones
  const [s1, s2] = stoneT();
  [s1, s2].forEach((T, i) => {
    const m = FLD.stones[i], x = i ? STONE_X : -STONE_X;
    const fall = 0.36, tt = t - (T - fall);
    if (tt < 0 || t > T + 0.35) { m.visible = false; } else {
      m.visible = true;
      const y = tt < fall ? 4.5 * (1 - (tt / fall) ** 2) + 0.05 : -0.45 * ramp(t, T, T + 0.3);
      m.position.set(x, y, STONE_Z);
      m.material.opacity = 1;
      m.scale.setScalar(tt < fall ? 1 : 1 - ramp(t, T, T + 0.3));
    }
    const fl = Math.max(0, 1 - Math.abs(t - T - 0.05) / 0.3);
    FLD.splash[i].position.set(x, 0.15, STONE_Z); FLD.splash[i].material.opacity = fl * 0.9; FLD.splash[i].scale.setScalar(2 + 5 * (1 - fl));
  });

  // row markers
  const sq = smooth(ramp(t, E.panel + 0.3, E.panel + 1.8));
  for (let i = 0; i < NEL; i++) {
    const m1 = FLD.marks1[i], m2 = FLD.marks2[i];
    const a1 = smooth(ramp(t, rowOn(t), rowOn(t) + 0.3)) * (1 - smooth(ramp(t, rowOff() - 0.15, rowOff() + 0.1)));
    const pop1 = a1 > 0 ? outBack(ramp(t, rowOn(t), rowOn(t) + 0.45)) : 0;
    m1.material.uniforms.uAlpha.value = a1; m1.material.uniforms.uSq.value = sq;
    m1.material.uniforms.uPulse.value = 0.5 + 0.5 * Math.cos(OMEGA * t - 0);
    m1.scale.setScalar(Math.max(0.01, pop1));
    const T = row2Onset(i);
    const a2 = smooth(ramp(t, T - 0.1, T + 0.2));
    const pop2 = a2 > 0 ? outBack(ramp(t, T - 0.1, T + 0.4)) : 0;
    m2.material.uniforms.uAlpha.value = a2; m2.material.uniforms.uSq.value = sq;
    m2.material.uniforms.uPulse.value = 0.5 + 0.5 * Math.cos(OMEGA * t - ph[ROW2 + i]);
    m2.scale.setScalar(Math.max(0.01, pop2));
    const c = new THREE.Color().lerpColors(new THREE.Color('#FFE3A3'), new THREE.Color('#9FE9FF'), radio);
    m1.material.uniforms.uColor.value.copy(c); m2.material.uniforms.uColor.value.copy(c);
  }
  FLD.info = { camU, theta: thetaField(t), radio };
}

// =====================================================================================================
// 2D overlay
// =====================================================================================================
const IRIS1 = () => [E.pond + 0.1, E.pond + 0.9];             // sky closes on the panel
const SW1 = () => E.pond + 0.9;
const IRIS2 = () => [E.tilt + 1.45, E.tilt + 2.25];           // field closes on the array
const SW2 = () => E.tilt + 2.25;
const ARRAY_PX = { x: 540, y: 1000 };
const showSky = t => t < SW1() || t >= SW2();

function titleCard(t) {
  const a = win(t, 0.3, 5.6, 0.5, 0.6);
  text('STARLINK’S FLAT DISH', 540, 236, { f: font(700, 34, MONO), color: COL.amber, alpha: a, spacing: 6, shadow: 14 });
  text('steers without moving', 540, 326, { f: font(800, 76), alpha: a, shadow: 18 });
}

function angleCard(t) {
  const info = SKY.info; if (!info) return;
  const inDish = t >= E.motor && t < E.steer + 0.4;
  const a = Math.max(win(t, E.sat - 0.9, E.pond + 0.2, 0.5, 0.4), win(t, SW2() + 0.5, TL.duration + 10, 0.5, 0.1));
  if (a <= 0.002) return;
  const deg = v => { const d = v / D2R; return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(0)}°`; };
  const l1 = inDish ? 'DISH' : 'PANEL', v1 = inDish ? deg(info.dishAng) : '0°';
  const l2 = inDish ? 'SATELLITE' : 'BEAM', v2 = inDish ? deg(info.satAng) : (info.beamAlpha > 0.05 || t > SW2() ? deg(info.beamAng) : '—');
  card(52, 150, 520, 156, a * 0.9, 24);
  text(l1, 92, 200, { f: font(700, 26, MONO), color: COL.grey, align: 'left', alpha: a, spacing: 3 });
  text(v1, 92, 278, { f: font(800, 74), color: COL.white, align: 'left', alpha: a });
  text(l2, 322, 200, { f: font(700, 26, MONO), color: COL.grey, align: 'left', alpha: a, spacing: 3 });
  text(v2, 322, 278, { f: font(800, 74), color: inDish ? COL.white : COL.amber, align: 'left', alpha: a });
  g.save(); g.globalAlpha *= a; g.strokeStyle = COL.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(296, 178); g.lineTo(296, 286); g.stroke(); g.restore();
  // "the only thing that moves is time": the panel stays at 0, the timing does the work
  const hi = win(t, E.payoff - 0.1, E.payoff + 2.6, 0.3, 0.6);
  if (hi > 0.01) {
    g.save(); g.globalAlpha *= hi * (0.7 + 0.3 * Math.sin(t * 7)); g.strokeStyle = COL.white; g.lineWidth = 4; rrect(60, 158, 228, 140, 18); g.stroke(); g.restore();
    text('fixed', 174, 330, { f: font(700, 28, MONO), color: COL.white, alpha: hi * a, spacing: 2 });
  }
}

function speedCard(t) {
  const a = win(t, E.sat_num - 0.2, 14.9, 0.4, 0.5);
  if (a <= 0.002) return;
  const v = 27000 * outCubic(ramp(t, E.sat_num, E.sat_num + 1.1));
  card(190, 1158, 700, 160, a * 0.92, 24);
  text('SATELLITE SPEED', 540, 1203, { f: font(700, 26, MONO), color: COL.grey, alpha: a, spacing: 3 });
  const nw = measure(fmt(27000), font(800, 92)), full = nw + 18 + measure('km/h', font(700, 40));
  text(fmt(v), 540 - full / 2 + nw, 1292, { f: font(800, 92), color: COL.amber, align: 'right', alpha: a });
  text('km/h', 540 - full / 2 + nw + 18, 1292, { f: font(700, 40), color: COL.white, align: 'left', alpha: a });
}

function footnote(str, a) { text(str, 540, 1500, { f: font(500, 26, MONO), color: COL.dim, alpha: a, spacing: 1 }); }

function timingBars(x0, y0, theta, a, unitText, valueText, { maxH = 118, labelDy = 156, valueDy = 212 } = {}) {
  // staircase of delays: the antenna that fires last is on the side the beam leans toward
  if (a <= 0.002) return;
  const s = Math.sin(theta), mag = Math.abs(s);
  const pitch = 25, bw = 17;
  for (let i = 0; i < NEL; i++) {
    const rank = s >= 0 ? i : NEL - 1 - i;
    const h = 6 + maxH * mag * (rank / (NEL - 1));
    const x = x0 + (i - (NEL - 1) / 2) * pitch;
    g.save(); g.globalAlpha *= a;
    const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, 'rgba(252,192,72,0.95)'); gr.addColorStop(1, 'rgba(252,192,72,0.25)');
    g.fillStyle = gr; rrect(x - bw / 2, y0, bw, h, 5); g.fill(); g.restore();
  }
  text(unitText, x0, y0 + labelDy, { f: font(700, 24, MONO), color: COL.grey, alpha: a, spacing: 1 });
  text(valueText, x0, y0 + valueDy, { f: font(800, 52, MONO), color: COL.amber, alpha: a });
}

function skyHUD(t) {
  const a = showSky(t) ? 1 : 0;
  titleCard(t);
  angleCard(t);
  speedCard(t);
  // timing bars under the panel (follow + payoff), live with the beam angle
  const info = SKY.info;
  const ta = win(t, SW2() + 0.7, TL.duration + 10, 0.6, 0.1);
  if (info && ta > 0.01) {
    const dt = F.ps_per_sin * Math.sin(info.beamAng);
    timingBars(540, 1166, info.beamAng, ta, 'EACH ANTENNA FIRES LATER THAN ITS NEIGHBOR BY', `${Math.abs(dt).toFixed(0)} ps`, { maxH: 70, labelDy: 106, valueDy: 160 });
  }
  footnote('time-lapse · satellite and panel not to scale', a * win(t, 4, 24, 1, 0.5));
  footnote('time-lapse · satellite and panel not to scale', a * win(t, SW2() + 1, TL.duration + 10, 1, 0.1));
}

// ---- field HUD
function fieldTo(x, z, y = 0) { return toScreen(FLD.cam, new THREE.Vector3(x, y, z)); }
function sineCard(t) {
  const a = win(t, E.cross - 0.4, E.row + 0.5, 0.5, 0.5);
  if (a <= 0.002) return;
  const x0 = 70, y0 = 200, w = 940, h = 392;
  card(x0, y0, w, h, a * 0.92, 26);
  text('TWO RIPPLES MEET', x0 + 34, y0 + 52, { f: font(700, 26, MONO), color: COL.grey, align: 'left', alpha: a, spacing: 3 });
  const delta = Math.PI * inOut(ramp(t, E.down - 0.15, E.down + 0.9));
  const rows = [{ y: y0 + 130, k: 'A', col: COL.blue }, { y: y0 + 215, k: 'B', col: COL.amber }, { y: y0 + 322, k: 'SUM', col: COL.white }];
  const xl = x0 + 180, xr = x0 + w - 36, amp = 26;
  const f = (x, ph) => Math.sin((x - xl) / (xr - xl) * 5 * Math.PI * 2 - t * 5.2 + ph);
  const lab = (s, y, c) => text(s, x0 + 34, y + 8, { f: font(700, 26, MONO), color: c, align: 'left', alpha: a });
  lab('RIPPLE 1', rows[0].y, rows[0].col); lab('RIPPLE 2', rows[1].y, rows[1].col); lab('TOGETHER', rows[2].y, rows[2].col);
  const trace = (y, fn, color, width, scale = 1) => {
    g.save(); g.globalAlpha *= a; g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.beginPath();
    for (let x = xl; x <= xr; x += 4) { const yy = y - amp * scale * fn(x); if (x === xl) g.moveTo(x, yy); else g.lineTo(x, yy); }
    g.stroke(); g.restore();
  };
  trace(rows[0].y, x => f(x, 0), COL.blue, 4);
  trace(rows[1].y, x => f(x, delta), COL.amber, 4);
  trace(rows[2].y, x => f(x, 0) + f(x, delta), COL.white, 5, 1.0);
  g.save(); g.globalAlpha *= a * 0.35; g.strokeStyle = COL.grey; g.lineWidth = 1; g.setLineDash([4, 8]);
  for (const r of rows) { g.beginPath(); g.moveTo(xl, r.y); g.lineTo(xr, r.y); g.stroke(); } g.restore();
  const same = 1 - smooth(ramp(t, E.down - 0.15, E.down + 0.9));
  text('crest meets crest: higher', x0 + w - 36, y0 + 52, { f: font(700, 30), color: COL.white, align: 'right', alpha: a * same * smooth(ramp(t, E.up - 0.1, E.up + 0.35)) });
  text('crest meets trough: flat', x0 + w - 36, y0 + 52, { f: font(700, 30), color: COL.white, align: 'right', alpha: a * (1 - same) });
}

// two spots on the pond where the ripples add / cancel (found numerically)
let SPOTS;
function findSpots() {
  const z = -13.5, A = [-STONE_X, STONE_Z], B = [STONE_X, STONE_Z];
  const dd = x => Math.hypot(x - A[0], z - A[1]) - Math.hypot(x - B[0], z - B[1]);
  let xd = 0; for (let x = 0; x < 3; x += 0.001) { if (Math.abs(dd(x) - 0.5 * LAMBDA) < 0.002) { xd = x; break; } }
  SPOTS = { up: [0, z], down: [xd, z] };
}
function spotMarker(t) {
  if (!SPOTS) findSpots();
  const mk = (p, t0, t1, label, color) => {
    const a = win(t, t0, t1, 0.3, 0.4); if (a <= 0.002) return;
    const s = fieldTo(p[0], p[1]); if (!s.front) return;
    const pulse = 1 + 0.12 * Math.sin(t * 7);
    g.save(); g.globalAlpha *= a; g.strokeStyle = color; g.lineWidth = 4; g.beginPath(); g.arc(s.x, s.y, 34 * pulse, 0, Math.PI * 2); g.stroke(); g.restore();
    text(label, s.x + (p[0] > 0.1 ? 52 : 0), s.y - 52, { f: font(800, 38), color, alpha: a, shadow: 12, align: p[0] > 0.1 ? 'left' : 'center' });
  };
  mk(SPOTS.up, E.up - 0.1, E.down - 0.15, 'higher', COL.white);
  mk(SPOTS.down, E.down - 0.1, E.row - 0.1, 'flat', COL.amber);
}

function axisOverlay(t, theta, a, label) {
  if (a <= 0.002) return;
  const cx = ARRAY_PX.x, cy = ARRAY_PX.y - 6, L = 640;
  const ex = cx + Math.sin(theta) * L, ey = cy - Math.cos(theta) * L;
  dashedLine(cx, cy, ex, ey, COL.amber, 5, [20, 16], a * 0.95);
  dashedLine(cx, cy, cx, cy - L * 0.72, 'rgba(255,255,255,0.55)', 3, [6, 12], a * (theta > 2 * D2R ? 1 : 0));
  // arrow head
  g.save(); g.globalAlpha *= a; g.fillStyle = COL.amber; g.translate(ex, ey); g.rotate(theta);
  g.beginPath(); g.moveTo(0, -18); g.lineTo(-20, 22); g.lineTo(20, 22); g.closePath(); g.fill(); g.restore();
  if (theta > 2 * D2R) {
    g.save(); g.globalAlpha *= a; g.strokeStyle = COL.white; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 190, -Math.PI / 2, -Math.PI / 2 + theta); g.stroke(); g.restore();
    const mid = -Math.PI / 2 + theta / 2;
    text(`${(theta / D2R).toFixed(0)}°`, cx + Math.cos(mid) * 238, cy + Math.sin(mid) * 238 + 14, { f: font(800, 46), color: COL.white, alpha: a, shadow: 12 });
  } else if (label) {
    text(label, cx + 24, cy - L * 0.45, { f: font(800, 44), color: COL.amber, align: 'left', alpha: a, shadow: 14 });
  }
}

function satGlyph(x, y, ang, a) {
  if (a <= 0.002) return;
  glowDot(x, y, 70, 'rgba(255,214,140,0.8)', a);
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(ang);
  g.fillStyle = '#C9D0DE'; rrect(-18, -12, 36, 24, 4); g.fill();
  g.fillStyle = '#2C58B8'; g.fillRect(-84, -9, 56, 18); g.fillRect(28, -9, 56, 18);
  g.strokeStyle = '#7C95D6'; g.lineWidth = 1.5; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 11, -9); g.lineTo(k * 11, 9); g.stroke(); }
  g.restore();
}

function fieldHUD(t) {
  const inField = !showSky(t);
  if (!inField && !(t > SW2() - 1.2 && t < SW2())) { return; }
  const info = FLD.info; const theta = info.theta, radio = info.radio;
  sineCard(t);
  spotMarker(t);
  // straight ahead
  axisOverlay(t, 0, win(t, E.ahead - 0.2, E.late - 0.1, 0.4, 0.4), 'straight ahead');
  // 30 degree lean and onwards
  const aTilt = win(t, E.slant - 0.2, IRIS2()[0] + 0.5, 0.5, 0.5);
  axisOverlay(t, theta, aTilt, '');
  // stone-by-stone timing (pond), then picoseconds (radio)
  const pondA = win(t, E.late + 0.2, E.panel + 0.8, 0.4, 0.8);
  const radioA = win(t, E.panel + 0.7, IRIS2()[0] + 0.4, 0.6, 0.5);
  const barsA = Math.max(pondA, radioA);
  if (barsA > 0.01) {
    const s = Math.sin(theta);
    const ps = F.ps_per_sin * s;
    timingBars(540, 1036, theta === 0 ? THETA_DROP : theta, barsA, pondA > radioA ? 'EACH STONE LANDS LATER THAN ITS NEIGHBOR BY' : 'EACH ANTENNA FIRES LATER THAN ITS NEIGHBOR BY',
      pondA > radioA ? `${STEP_DT.toFixed(2)} s` : `${Math.abs(ps).toFixed(0)} ps`);
    if (radioA > pondA) text('trillionths of a second', 540, 1036 + 262, { f: font(700, 30), color: COL.white, alpha: radioA * smooth(ramp(t, E.ps - 0.15, E.ps + 0.4)) });
  }
  // radio label + satellite glyph
  const rl = win(t, E.panel + 0.4, IRIS2()[0] + 0.3, 0.6, 0.5);
  text('RADIO WAVES', 540, 236, { f: font(700, 34, MONO), color: COL.cyan, alpha: rl, spacing: 6, shadow: 12 });
  text('wavelength ≈ 2.5 cm', 540, 312, { f: font(800, 64), alpha: rl, shadow: 16 });
  const ga = win(t, E.tilt - 0.4, IRIS2()[0] + 0.5, 0.5, 0.5);
  if (ga > 0.01) {
    const R = 560, gx = ARRAY_PX.x + Math.sin(theta) * R, gy = ARRAY_PX.y - 6 - Math.cos(theta) * R;
    satGlyph(gx, gy, theta, ga);
  }
  footnote(radio > 0.5 ? `waves slowed down · simplified drawing: ${NEL} antennas` : 'water ripples slowed down for the video', win(t, E.cross, IRIS2()[0] + 0.5, 0.8, 0.5));
}

function drawVignette() {
  const gr = g.createRadialGradient(540, 960, 520, 540, 960, 1180);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

function draw2D(t) {
  g.clearRect(0, 0, W, H);
  drawVignette();
  skyHUD(t);
  fieldHUD(t);
  // irises: sky -> field around the panel, field -> sky around the array
  const [a0, a1] = IRIS1(), [b0, b1] = IRIS2();
  const R0 = 1500;
  if (t >= a0 && t < SW1()) { const ps = panelScreen(); iris(ps.x, ps.y, R0 * (1 - inOut(ramp(t, a0, a1)))); }
  else if (t >= SW1() && t < SW1() + 1.0) { iris(ARRAY_PX.x, ARRAY_PX.y, R0 * inOut(ramp(t, SW1(), SW1() + 1.0))); }
  else if (t >= b0 && t < SW2()) { iris(ARRAY_PX.x, ARRAY_PX.y, R0 * (1 - inOut(ramp(t, b0, b1)))); }
  else if (t >= SW2() && t < SW2() + 1.0) { const ps = panelScreen(); iris(ps.x, ps.y, R0 * inOut(ramp(t, SW2(), SW2() + 1.0))); }
  fillBg(1 - smooth(ramp(t, 0, 0.5)));
  fillBg(smooth(ramp(t, TL.duration - 0.6, TL.duration)));
}

// =====================================================================================================
window.renderFrame = (t) => {
  if (showSky(t)) { updateSky(t); renderer.render(SKY.sc, SKY.cam); }
  else { skyCamera(t); updateField(t); renderer.render(FLD.sc, FLD.cam); }
  draw2D(t);
  return true;
};

async function boot() {
  [TL, F] = await Promise.all([fetch('../config/timeline.json').then(r => r.json()), fetch('../config/facts.json').then(r => r.json())]);
  E = TL.events;
  F.ps_per_sin = 0.5 / (F.f_down_ghz * 1e9) * 1e12;     // d = lambda/2 -> delay = d*sin(theta)/c = sin(theta) / (2 f)
  await Promise.all([font(800, 80), font(700, 40), font(600, 40), font(800, 80, MONO), font(700, 40, MONO), font(500, 30, MONO)].map(f => document.fonts.load(f)));
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x05070f, 1);
  initPasses();
  buildSky();
  buildField();
  window.DURATION = TL.duration;
  window.READY = true;
}
boot().catch(e => { window.BOOT_ERROR = String(e && e.stack || e); console.error(e); });
