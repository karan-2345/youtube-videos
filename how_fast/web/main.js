// "How fast are you moving right now?" — deterministic frame renderer.
// Everything is a pure function of time t (seconds): window.renderFrame(t).
import * as THREE from 'three';

const W = 1080, H = 1920;
const COL = {
  bg: '#05070F', amber: '#FCC048', white: '#FFFFFF', grey: '#A3ACBA', dim: '#687285',
  blue: '#7DB7FF', panel: 'rgba(13,18,30,0.86)', line: 'rgba(163,172,186,0.35)',
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
// visible window [a, b] with soft edges
const win = (t, a, b, fi = 0.35, fo = 0.35) => Math.min(smooth(ramp(t, a, a + fi)), 1 - smooth(ramp(t, b - fo, b)));
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let q = s; q = Math.imul(q ^ (q >>> 15), q | 1); q ^= q + Math.imul(q ^ (q >>> 7), q | 61); return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0; while (u === 0) u = r(); const v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const fmt = n => Math.round(n).toLocaleString('en-US');

let TL, E, S, F;

// ---------------------------------------------------------------- 3D
const glCanvas = document.getElementById('gl');
let renderer, scene, camera;
const R_ORBIT = 9, SUN_R = 1.25, EARTH_THETA0 = 0.55;
const KPC = 12 / 15;          // world units per kpc when the galaxy is fully zoomed out
const K0 = 5000;              // starting zoom factor for the galaxy fly-out
const W3 = {};

function srgbColor(hex) { return new THREE.Color(hex); }

function lineMat(hex, opacity, { dashes = 0, fade = false, additive = false } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uColor: { value: srgbColor(hex) }, uOpacity: { value: opacity }, uDashes: { value: dashes }, uOffset: { value: 0 }, uFade: { value: fade ? 1 : 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity, uDashes, uOffset, uFade; varying vec2 vUv;
      void main(){
        float a = uOpacity;
        if (uDashes > 0.0) { float d = fract(vUv.x * uDashes - uOffset); a *= smoothstep(0.0, 0.06, d) * (1.0 - smoothstep(0.55, 0.61, d)); }
        if (uFade > 0.5) a *= pow(vUv.x, 1.7);
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
}

function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, s] of stops) gr.addColorStop(o, s);
  x.fillStyle = gr; x.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStars() {
  const r = rng(11), N = 9000;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3(gauss(r), gauss(r), gauss(r)).normalize().multiplyScalar(4000);
    pos.set([v.x, v.y, v.z], i * 3);
    const b = 0.25 + 0.75 * Math.pow(r(), 3.5);
    const warm = r();
    const c = warm < 0.2 ? [1.0, 0.86, 0.7] : warm > 0.8 ? [0.75, 0.85, 1.0] : [1, 1, 1];
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    size[i] = 1.3 + 2.6 * Math.pow(r(), 7);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uOpacity: { value: 1 } },
    vertexShader: `attribute vec3 aColor; attribute float aSize; varying vec3 vC;
      void main(){ vC = aColor; gl_PointSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uOpacity; varying vec3 vC;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC, a * uOpacity); }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = -10;
  return { pts, mat };
}

function makeSun() {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    toneMapped: false, uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vNv; varying vec3 vP;
      void main(){ vNv = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec3 vNv; varying vec3 vP;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        float mu = clamp(vNv.z, 0.0, 1.0);
        float n = noise(vP * 7.0 + uTime * 0.25) * 0.55 + noise(vP * 17.0 - uTime * 0.18) * 0.45;
        vec3 core = vec3(1.0, 0.97, 0.86), edge = vec3(1.0, 0.52, 0.12);
        vec3 c = mix(edge, core, pow(mu, 0.55)) * (0.82 + 0.32 * n);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 64, 48), mat);
  group.add(core);
  const glowTex = radialTexture([[0, 'rgba(255,240,205,1)'], [0.12, 'rgba(255,214,140,0.85)'], [0.3, 'rgba(255,160,60,0.28)'], [0.6, 'rgba(255,120,40,0.07)'], [1, 'rgba(255,110,30,0)']]);
  const g1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  g1.scale.set(SUN_R * 8, SUN_R * 8, 1); group.add(g1);
  const g2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: 0.16 }));
  g2.scale.set(SUN_R * 13, SUN_R * 13, 1); group.add(g2);
  return { group, mat, core, g1, g2 };
}

function makeEarth(tex) {
  const orbitPos = new THREE.Group();
  const scaleG = new THREE.Group(); orbitPos.add(scaleG);
  const tilt = new THREE.Group(); scaleG.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  const sunDir = { value: new THREE.Vector3(1, 0, 0) };
  const mat = new THREE.ShaderMaterial({
    uniforms: { uDay: { value: tex.day }, uNight: { value: tex.night }, uWater: { value: tex.water }, uSunDir: sunDir },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uDay, uNight, uWater; uniform vec3 uSunDir; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 N = normalize(vN), L = normalize(uSunDir), V = normalize(cameraPosition - vW);
        float ndl = dot(N, L);
        float dayMix = smoothstep(-0.10, 0.20, ndl);
        vec3 day = texture2D(uDay, vUv).rgb;
        float lum = dot(day, vec3(0.2126, 0.7152, 0.0722));
        day = mix(vec3(lum), day, 1.22) * vec3(0.96, 1.0, 1.06);
        vec3 night = texture2D(uNight, vUv).rgb;
        night = pow(night, vec3(1.6)) * vec3(1.0, 0.72, 0.38) * 2.6;
        float water = texture2D(uWater, vUv).r;
        vec3 Hh = normalize(L + V);
        float spec = pow(max(dot(N, Hh), 0.0), 150.0) * water * 0.32;
        vec3 lit = day * (0.035 + 1.35 * max(ndl, 0.0)) + vec3(1.0, 0.93, 0.8) * spec * dayMix;
        vec3 col = mix(night, lit, dayMix);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
        col += vec3(0.22, 0.5, 1.0) * fres * (0.12 + 0.95 * smoothstep(-0.25, 0.6, ndl));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 110), mat);
  spin.add(globe);
  const atmMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uSunDir: sunDir, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vW;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSunDir; uniform float uOpacity; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 V = normalize(cameraPosition - vW), N = normalize(vN);
        float g = clamp(-dot(N, V) / 0.30, 0.0, 1.0);
        float i = pow(g, 1.8) * (0.15 + 0.85 * smoothstep(-0.35, 0.5, dot(N, normalize(uSunDir))));
        gl_FragColor = vec4(vec3(0.32, 0.62, 1.0) * i * 1.4, i * uOpacity);
        #include <colorspace_fragment>
      }`,
  });
  const atm = new THREE.Mesh(new THREE.SphereGeometry(1.05, 96, 64), atmMat);
  tilt.add(atm);
  // latitude rings (in the spinning frame, so their dashes move with the ground)
  const rings = [];
  for (const [lat, hex, dashes] of [[0, COL.amber, 72], [30, '#FFFFFF', 60], [60, '#FFFFFF', 36]]) {
    const rr = Math.cos(lat * D2R) * 1.004, y = Math.sin(lat * D2R) * 1.004;
    const m = new THREE.Mesh(new THREE.TorusGeometry(rr, lat === 0 ? 0.0085 : 0.0062, 6, 360), lineMat(hex, 0, { dashes }));
    m.rotation.x = Math.PI / 2; m.position.y = y; spin.add(m);
    rings.push({ lat, mesh: m });
  }
  const pole = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false }));
  pole.position.y = 1.006; tilt.add(pole);
  return { orbitPos, scaleG, tilt, spin, globe, atm, atmMat, rings, pole, sunDir };
}

function makeOrbitBits() {
  const ringGeo = new THREE.TorusGeometry(R_ORBIT, 0.028, 6, 400);
  const ring = new THREE.Mesh(ringGeo, lineMat('#9AA6BD', 0));
  ring.rotation.x = Math.PI / 2;
  // trail: arc from -1.1 rad to 0, rotated each frame to the Earth's angle
  const pts = [];
  for (let i = 0; i <= 120; i++) { const a = -1.1 + 1.1 * i / 120; pts.push(new THREE.Vector3(R_ORBIT * Math.cos(a), 0, -R_ORBIT * Math.sin(a))); }
  const trail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.075, 8, false), lineMat(COL.amber, 0, { fade: true, additive: true }));
  const pivot = new THREE.Group(); pivot.add(trail);
  return { ring, trail, pivot };
}

function makeGalaxy() {
  const r = rng(42);
  const pos = [], col = [], size = [];
  const pitch = 12.5 * D2R, kk = 1 / Math.tan(pitch);
  const armBase = (i, rad) => i * Math.PI / 2 + Math.log(rad / 1.6) * kk;
  const warm = [1.0, 0.86, 0.62], cool = [0.72, 0.82, 1.0], white = [1, 0.97, 0.93];
  const mix3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  function push(x, y, z, c, s) { pos.push(x, y, z); col.push(...c); size.push(s); }
  // disk + arms
  for (let n = 0; n < 78000; n++) {
    let rad = -Math.log(1 - r() * 0.99) * 3.7;
    if (rad > 16) rad = 3 + 13 * r();
    if (rad < 0.7) rad = 0.7 + r() * 2.0;
    const major = r() < 0.66;
    const i = major ? (r() < 0.5 ? 0 : 2) : (r() < 0.5 ? 1 : 3);
    const inArm = r() < (major ? 0.8 : 0.6);
    const th = inArm ? armBase(i, rad) + gauss(r) * (major ? 0.19 : 0.26) : r() * Math.PI * 2;
    const y = gauss(r) * 0.1 * (0.6 + rad / 16);
    const u = clamp((rad - 1.5) / 9);
    let c = mix3(warm, cool, u);
    if (inArm && r() < 0.4) c = mix3(c, white, 0.5);
    const b = (inArm ? 0.55 : 0.32) * (0.5 + r() * 0.8);
    push(Math.cos(th) * rad, y, Math.sin(th) * rad, c.map(v => v * b), 1.4 + Math.pow(r(), 5) * 2.4);
  }
  // bulge + bar
  for (let n = 0; n < 26000; n++) {
    const bar = r() < 0.35;
    let x, y, z;
    if (bar) { const l = gauss(r) * 2.2; const w = gauss(r) * 0.55; const a = 27 * D2R; x = Math.cos(a) * l - Math.sin(a) * w; z = Math.sin(a) * l + Math.cos(a) * w; y = gauss(r) * 0.3; }
    else { x = gauss(r) * 1.25; z = gauss(r) * 1.25; y = gauss(r) * 0.55; }
    const b = 0.35 + r() * 0.45;
    push(x, y, z, warm.map(v => v * b), 1.4 + Math.pow(r(), 4) * 2.2);
  }
  // bright young clusters in the arms
  for (let n = 0; n < 2600; n++) {
    const rad = 3 + r() * 12; const i = r() < 0.7 ? (r() < 0.5 ? 0 : 2) : (r() < 0.5 ? 1 : 3);
    const th = armBase(i, rad) + gauss(r) * 0.08;
    const c = r() < 0.35 ? [1.0, 0.55, 0.75] : [0.7, 0.85, 1.0];
    push(Math.cos(th) * rad, gauss(r) * 0.05, Math.sin(th) * rad, c.map(v => v * (0.8 + r() * 0.6)), 2.2 + r() * 2.5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uOpacity: { value: 0 }, uPx: { value: 60 } },
    vertexShader: `attribute vec3 aColor; attribute float aSize; uniform float uPx; varying vec3 vC; varying float vFade;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float z = -mv.z;
        gl_PointSize = clamp(aSize * uPx / max(z, 0.001), 1.0, 4.5);
        vFade = smoothstep(0.5, 6.0, z);
        vC = aColor; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOpacity; varying vec3 vC; varying float vFade;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC, a * uOpacity * vFade); }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  // dust lanes on the inner edge of the major arms
  const dpos = [], dsz = [];
  for (let n = 0; n < 16000; n++) {
    const rad = 2 + r() * 11; const i = r() < 0.5 ? 0 : 2;
    const th = armBase(i, rad) - 0.2 + gauss(r) * 0.07;
    dpos.push(Math.cos(th) * rad, gauss(r) * 0.04, Math.sin(th) * rad); dsz.push(3 + r() * 4);
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  dgeo.setAttribute('aSize', new THREE.Float32BufferAttribute(dsz, 1));
  const dmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uOpacity: { value: 0 }, uPx: { value: 60 } },
    vertexShader: `attribute float aSize; uniform float uPx; varying float vFade;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float z = -mv.z; gl_PointSize = clamp(aSize * uPx / max(z, 0.001), 1.0, 7.0); vFade = smoothstep(0.5, 6.0, z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOpacity; varying float vFade;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * 0.22; gl_FragColor = vec4(0.03, 0.02, 0.015, a * uOpacity * vFade); }`,
  });
  const dust = new THREE.Points(dgeo, dmat); dust.frustumCulled = false; dust.renderOrder = 2;
  const coreTex = radialTexture([[0, 'rgba(255,236,200,0.9)'], [0.25, 'rgba(255,205,140,0.35)'], [0.6, 'rgba(255,170,90,0.08)'], [1, 'rgba(255,150,80,0)']]);
  const sunAng0 = armBase(0, 8.2) + Math.PI / 4 + 0.15;
  const sunG0 = new THREE.Vector3(Math.cos(sunAng0) * 8.2, 0, Math.sin(sunAng0) * 8.2);
  const npos = [], ncol = [], nsz = [];
  for (let n = 0; n < 6000; n++) {
    const rr = Math.pow(10, -3.5 + r() * 3.3);
    const v = new THREE.Vector3(gauss(r), gauss(r) * 0.6, gauss(r)).normalize().multiplyScalar(rr);
    npos.push(sunG0.x + v.x, v.y, sunG0.z + v.z);
    const b = 0.45 + r() * 0.55, tint = r() < 0.3 ? [1, 0.85, 0.7] : [0.85, 0.9, 1];
    ncol.push(tint[0] * b, tint[1] * b, tint[2] * b); nsz.push(1.6 + Math.pow(r(), 4) * 3);
  }
  const ngeo = new THREE.BufferGeometry();
  ngeo.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3));
  ngeo.setAttribute('aColor', new THREE.Float32BufferAttribute(ncol, 3));
  ngeo.setAttribute('aSize', new THREE.Float32BufferAttribute(nsz, 1));
  const nmat = mat.clone(); nmat.uniforms = { uOpacity: { value: 0 }, uPx: { value: 70 } };
  const near = new THREE.Points(ngeo, nmat); near.frustumCulled = false;
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: 0 }));
  core.scale.set(9, 9, 1);
  const inner = new THREE.Group(); inner.add(pts); inner.add(dust); inner.add(core); inner.add(near);
  const group = new THREE.Group(); group.add(inner);
  // the Sun's place: between the two major arms at 8.2 kpc
  const sunAng = armBase(0, 8.2) + Math.PI / 4 + 0.15;
  const sunG = new THREE.Vector3(Math.cos(sunAng) * 8.2, 0, Math.sin(sunAng) * 8.2);
  return { group, inner, pts, mat, dust, dmat, core, near, nmat, sunAng, sunG };
}

async function init3D() {
  renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  scene = new THREE.Scene(); scene.background = new THREE.Color(COL.bg);
  camera = new THREE.PerspectiveCamera(30, W / H, 0.005, 30000);

  const loader = new THREE.TextureLoader();
  const base = '../assets/tex/package/example/img/';
  const [day, night, water] = await Promise.all(['earth-blue-marble.jpg', 'earth-night.jpg', 'earth-water.png'].map(f => loader.loadAsync(base + f)));
  day.colorSpace = THREE.SRGBColorSpace; night.colorSpace = THREE.SRGBColorSpace;
  for (const t of [day, night, water]) { t.anisotropy = 8; t.generateMipmaps = true; }

  W3.stars = makeStars(); scene.add(W3.stars.pts);
  W3.solar = new THREE.Group(); scene.add(W3.solar);
  W3.sun = makeSun(); W3.solar.add(W3.sun.group);
  W3.orbit = makeOrbitBits(); W3.solar.add(W3.orbit.ring); W3.solar.add(W3.orbit.pivot);
  W3.earth = makeEarth({ day, night, water }); W3.solar.add(W3.earth.orbitPos);
  W3.gal = makeGalaxy(); scene.add(W3.gal.group);
}

// Earth's angle on its orbit: still during the spin section, then speeding up
function earthTheta(t) {
  const t0 = E.orbit + 0.6, Tr = 2.5, w = 2 * Math.PI / 16;
  const tau = t - t0;
  if (tau <= 0) return EARTH_THETA0;
  return EARTH_THETA0 + (tau < Tr ? w * tau * tau / (2 * Tr) : w * (tau - Tr / 2));
}
const orbitPoint = th => new THREE.Vector3(R_ORBIT * Math.cos(th), 0, -R_ORBIT * Math.sin(th));

function sph(dir, dist) { return dir.clone().normalize().multiplyScalar(dist); }
function slerpDir(a, b, u) { const qa = new THREE.Quaternion(), q = new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize()); qa.slerp(q, u); return a.clone().normalize().applyQuaternion(qa); }

// galaxy zoom factor
function galK(t) {
  const u = inOut(ramp(t, E.galaxy - 0.1, E.galaxy + 4.4));
  return Math.exp(lerp(Math.log(K0), 0, u));
}

const state3 = { rings: [], sunScreen: null, galCentre: null, galSun: null, galTrail: [], galOrbit: [] };

function update3D(t) {
  const ea = W3.earth;
  const th = earthTheta(t);
  const ep = orbitPoint(th);
  // ---- galaxy zoom (scales the solar system down, the galaxy up)
  const k = galK(t);
  const sSolar = k / K0;
  W3.solar.scale.setScalar(sSolar);
  const gal = W3.gal;
  const galOn = t > E.galaxy - 0.2;
  gal.group.visible = galOn;
  // Sun's angle around the galaxy (one lap in the "lap" beat)
  const lapU = inOut(ramp(t, E.lap + 0.15, E.lap + 3.9));
  const sunAng = gal.sunAng - lapU * 2 * Math.PI;   // clockwise as seen from the north galactic pole
  const sunG0 = gal.sunG.clone();
  gal.group.scale.setScalar(k * KPC);
  gal.group.position.copy(sunG0).multiplyScalar(-k * KPC);
  const gOp = smooth(ramp(t, E.galaxy + 0.4, E.galaxy + 3.2));
  gal.mat.uniforms.uOpacity.value = gOp * 1.0;
  gal.dmat.uniforms.uOpacity.value = gOp;
  gal.core.material.opacity = gOp * 0.9 * (1 - clamp(Math.log(k) / Math.log(4)));
  gal.mat.uniforms.uPx.value = 70; gal.dmat.uniforms.uPx.value = 70;
  const nearIn = smooth(ramp(t, E.galaxy + 0.1, E.galaxy + 0.8));
  const nearOut = clamp((Math.log(k) - Math.log(2.5)) / (Math.log(14) - Math.log(2.5)));
  gal.nmat.uniforms.uOpacity.value = nearIn * nearOut;

  // ---- Earth
  ea.orbitPos.position.copy(ep);
  const pull = inOut(ramp(t, E.orbit - 0.1, E.orbit + 2.9));
  ea.scaleG.scale.setScalar(lerp(1, 0.5, pull));
  ea.spin.rotation.y = 2 * Math.PI * t / 10.5;
  const sunDirWorld = ep.clone().multiplyScalar(-1).normalize();
  ea.sunDir.value.copy(sunDirWorld);

  // ---- camera
  const toSun = sunDirWorld.clone();
  const up = new THREE.Vector3(0, 1, 0);
  // close-up direction: 58 degrees round from the Sun, a little above the equator
  const dirA = toSun.clone().applyAxisAngle(up, 58 * D2R).add(new THREE.Vector3(0, 0.2, 0)).normalize();
  // orbit view direction from the Sun
  const dirB = new THREE.Vector3(Math.cos(EARTH_THETA0 - 0.55), 0, -Math.sin(EARTH_THETA0 - 0.55)).add(new THREE.Vector3(0, 0.6, 0)).normalize();
  const dist0 = 9.0, dist1 = 74;
  const earthCentreA = orbitPoint(EARTH_THETA0);
  let target, camPos;
  if (t < E.galaxy - 0.1) {
    const drift = (t - E.spin) * 0.6 * D2R;
    const dA = dirA.clone().applyAxisAngle(up, drift);
    const orbitDrift = Math.max(0, t - (E.orbit + 2.9)) * 0.9 * D2R;
    const dB = dirB.clone().applyAxisAngle(up, orbitDrift);
    const dir = slerpDir(dA, dB, pull);
    const dist = Math.exp(lerp(Math.log(dist0), Math.log(dist1), pull));
    const tgtA = earthCentreA.clone().add(new THREE.Vector3(0, -0.12, 0));
    const tgtB = new THREE.Vector3(0, -1.6, 0);
    target = tgtA.clone().lerp(tgtB, pull);
    camPos = target.clone().add(sph(dir, dist));
  } else {
    // fly out to the galaxy: pivot moves from the Sun to the galaxy centre
    const u = inOut(ramp(t, E.galaxy - 0.1, E.galaxy + 4.4));
    const galCentre = sunG0.clone().multiplyScalar(-k * KPC);
    const endOrbitDrift = (E.galaxy - 0.1 - (E.orbit + 2.9)) * 0.9 * D2R;
    const dB = dirB.clone().applyAxisAngle(up, endOrbitDrift);
    // final view: from above-ish, looking at the galaxy centre
    const el = 57 * D2R;
    const dC = sunG0.clone().normalize().multiplyScalar(Math.cos(el)).add(new THREE.Vector3(0, Math.sin(el), 0)).normalize();
    const hold = Math.max(0, t - (E.galaxy + 4.4));
    const dir = slerpDir(dB, dC, u).applyAxisAngle(up, hold * 0.8 * D2R);
    const dist = Math.exp(lerp(Math.log(dist1), Math.log(62), u));
    const fC = 1 - clamp(Math.log(k) / Math.log(8));
    target = new THREE.Vector3(0, -1.6 * (1 - u), 0).lerp(galCentre.clone().multiplyScalar(0.7), smooth(fC));
    camPos = target.clone().add(sph(dir, dist));
  }
  camera.position.copy(camPos); camera.up.set(0, 1, 0); camera.lookAt(target);
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();

  // ---- Earth tilt (a gentle tilt so the northern rings read clearly)
  const toCamA = dirA.clone();
  const axis = new THREE.Vector3(0, 1, 0).multiplyScalar(0.94).add(toCamA.clone().multiplyScalar(0.34)).normalize();
  ea.tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);

  // ---- rings on the globe
  const ringOn = win(t, E.equator - 0.1, E.jet - 0.2, 0.6, 0.5) * (1 - pull);
  const eqBoost = smooth(ramp(t, E.spin_num - 0.2, E.spin_num + 0.5));
  for (const rg of ea.rings) {
    rg.mesh.material.uniforms.uOpacity.value = ringOn * (rg.lat === 0 ? lerp(0.7, 1.0, eqBoost) : 0.75);
  }
  ea.pole.material.opacity = ringOn;
  ea.atmMat.uniforms.uOpacity.value = 1;

  // ---- orbit ring + trail
  const orbOn = smooth(ramp(t, E.orbit + 0.9, E.orbit + 2.4)) * (1 - smooth(ramp(t, E.galaxy + 1.0, E.galaxy + 2.6)));
  W3.orbit.ring.material.uniforms.uOpacity.value = 0.42 * orbOn;
  W3.orbit.pivot.rotation.y = th;
  W3.orbit.trail.material.uniforms.uOpacity.value = 0.9 * orbOn * smooth(ramp(t, E.orbit + 1.6, E.orbit + 3.0));
  W3.sun.mat.uniforms.uTime.value = t;

  // ---- stars
  W3.stars.pts.position.copy(camera.position);
  W3.stars.mat.uniforms.uOpacity.value = lerp(1, 0.35, smooth(ramp(t, E.galaxy + 1, E.galaxy + 4)));

  // ---- screen positions for the 2D layer
  state3.rings = [];
  if (ringOn > 0.01) {
    const camLocal = ea.tilt.worldToLocal(camera.position.clone());
    const a = Math.atan2(camLocal.z, camLocal.x);
    for (const lat of [0, 30, 60]) {
      const rr = Math.cos(lat * D2R), y = Math.sin(lat * D2R);
      const p = ea.tilt.localToWorld(new THREE.Vector3(rr * Math.cos(a), y, rr * Math.sin(a)).multiplyScalar(1.004));
      state3.rings.push({ lat, s: toScreen(p) });
    }
    state3.pole = toScreen(ea.tilt.localToWorld(new THREE.Vector3(0, 1.006, 0)));
  }
  state3.ringOn = ringOn;
  state3.sunScreen = toScreen(new THREE.Vector3(0, 0, 0));
  state3.earthScreen = toScreen(ea.orbitPos.getWorldPosition(new THREE.Vector3()));
  if (galOn) {
    const toWorld = v => v.clone().multiplyScalar(k * KPC).add(gal.group.position);
    state3.galCentre = toScreen(toWorld(new THREE.Vector3(0, 0, 0)));
    const sunNow = new THREE.Vector3(Math.cos(sunAng) * 8.2, 0, Math.sin(sunAng) * 8.2);
    state3.galSun = toScreen(toWorld(sunNow));
    state3.galOrbit = [];
    for (let i = 0; i <= 160; i++) { const a = gal.sunAng - i / 160 * 2 * Math.PI; state3.galOrbit.push(toScreen(toWorld(new THREE.Vector3(Math.cos(a) * 8.2, 0, Math.sin(a) * 8.2)))); }
    state3.lapU = lapU;
    state3.k = k;
  } else { state3.galCentre = null; state3.galSun = null; }
}

function toScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, z: p.z, front: p.z < 1 };
}

// ---------------------------------------------------------------- 2D layer
const ui = document.getElementById('ui');
const g = ui.getContext('2d');

function font(weight, size, fam = SANS) { return `${weight} ${size}px ${fam}`; }
function text(str, x, y, { f = font(800, 40), color = COL.white, align = 'center', base = 'alphabetic', alpha = 1, shadow = 0, spacing = 0 } = {}) {
  if (alpha <= 0.002) return;
  g.save();
  g.globalAlpha *= alpha;
  g.font = f; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
  g.letterSpacing = `${spacing}px`;
  if (shadow) { g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = shadow; g.shadowOffsetY = shadow / 5; }
  g.fillText(str, x, y);
  g.restore();
}
function measure(str, f, spacing = 0) { g.save(); g.font = f; g.letterSpacing = `${spacing}px`; const w = g.measureText(str).width; g.restore(); return w; }
function rrect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fillBg(alpha) { if (alpha <= 0) return; g.save(); g.globalAlpha = alpha; g.fillStyle = COL.bg; g.fillRect(0, 0, W, H); g.restore(); }
// rich text: parts [{s, c}] centred
function richText(parts, x, y, f, alpha = 1, shadow = 0) {
  const total = parts.reduce((a, p) => a + measure(p.s, f), 0);
  let cx = x - total / 2;
  for (const p of parts) { text(p.s, cx, y, { f, color: p.c, align: 'left', alpha, shadow }); cx += measure(p.s, f); }
}

// ---------- night scene (hook + payoff)
let NIGHT;
function initNight() {
  const r = rng(5);
  const P = { x: 1210, y: -470 };  // celestial pole, off screen
  const stars = [];
  const add = (x, y, b, s) => { const dx = x - P.x, dy = y - P.y; stars.push({ r: Math.hypot(dx, dy), a: Math.atan2(dy, dx), b, s }); };
  for (let i = 0; i < 1300; i++) add(r() * 1500 - 200, r() * 1800 - 250, 0.25 + 0.75 * Math.pow(r(), 3), 1.2 + 2.2 * Math.pow(r(), 6));
  // Milky Way band: from lower left to upper right
  for (let i = 0; i < 2600; i++) {
    const u = r(); const along = lerp(-200, 1400, u); const off = gauss(r) * 95;
    const x = along * 0.72 + off * 0.69 - 60, y = 1560 - along * 0.95 + off * 0.52;
    add(x, y, 0.12 + 0.35 * Math.pow(r(), 2), 0.9 + r() * 1.1);
  }
  NIGHT = { P, stars };
}

function drawNight(t, alpha, t0) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha = alpha;
  // sky
  const sky = g.createLinearGradient(0, 0, 0, 1600);
  sky.addColorStop(0, '#03050B'); sky.addColorStop(0.62, '#070C1A'); sky.addColorStop(1, '#0E1A31');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const { P, stars } = NIGHT;
  const w = 0.055;                      // rad/s, heavily sped up
  const rot = w * (t - t0);
  const trail = Math.min(rot, 0.42);
  // band glow (rotates with the sky)
  g.save(); g.translate(P.x, P.y); g.rotate(rot); g.translate(-P.x, -P.y);
  g.save(); g.translate(560, 820); g.rotate(-52 * D2R); g.scale(1, 0.2);
  const bg = g.createRadialGradient(0, 0, 0, 0, 0, 900);
  bg.addColorStop(0, 'rgba(150,170,220,0.16)'); bg.addColorStop(0.5, 'rgba(120,140,200,0.07)'); bg.addColorStop(1, 'rgba(100,120,180,0)');
  g.fillStyle = bg; g.beginPath(); g.arc(0, 0, 900, 0, Math.PI * 2); g.fill();
  g.restore();
  g.restore();
  // stars with trails
  g.lineCap = 'round';
  for (const s of stars) {
    const a1 = s.a + rot;
    const x = P.x + s.r * Math.cos(a1), y = P.y + s.r * Math.sin(a1);
    if (y > 1700 || x < -20 || x > W + 20) continue;
    if (trail > 0.004) {
      g.strokeStyle = `rgba(220,228,255,${s.b * 0.55})`; g.lineWidth = s.s * 0.9;
      g.beginPath(); g.arc(P.x, P.y, s.r, a1 - trail, a1); g.stroke();
    }
    g.fillStyle = `rgba(255,255,255,${s.b})`;
    g.beginPath(); g.arc(x, y, s.s * 0.75, 0, Math.PI * 2); g.fill();
  }
  // horizon glow
  const hg = g.createLinearGradient(0, 1460, 0, 1680);
  hg.addColorStop(0, 'rgba(40,70,120,0)'); hg.addColorStop(1, 'rgba(40,70,120,0.28)');
  g.fillStyle = hg; g.fillRect(0, 1460, W, 220);
  // lamp glow
  const lx = 770, ly = 1418;
  const lg = g.createRadialGradient(lx, ly, 0, lx, ly, 330);
  lg.addColorStop(0, 'rgba(252,192,72,0.42)'); lg.addColorStop(0.25, 'rgba(252,170,60,0.14)'); lg.addColorStop(1, 'rgba(252,160,50,0)');
  g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, 330, 0, Math.PI * 2); g.fill();
  // hill
  g.fillStyle = '#02040A';
  g.beginPath(); g.moveTo(0, 1690); g.bezierCurveTo(260, 1612, 520, 1592, 700, 1598); g.bezierCurveTo(860, 1604, 980, 1632, W, 1652); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120,150,210,0.22)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 1690); g.bezierCurveTo(260, 1612, 520, 1592, 700, 1598); g.bezierCurveTo(860, 1604, 980, 1632, W, 1652); g.stroke();
  // lamp post
  g.fillStyle = '#02040A';
  g.fillRect(764, 1430, 12, 175);
  g.beginPath(); g.moveTo(748, 1430); g.lineTo(792, 1430); g.lineTo(784, 1406); g.lineTo(756, 1406); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,214,140,0.95)'; g.fillRect(758, 1418, 24, 10);
  // bench (seat, back, legs) sitting on the hill
  const bx = 470, by = 1556;
  g.fillStyle = '#02040A';
  rrect(bx, by, 230, 12, 3); g.fill();                 // seat
  rrect(bx + 6, by - 58, 218, 10, 3); g.fill();         // back rail top
  rrect(bx + 6, by - 34, 218, 9, 3); g.fill();          // back rail mid
  g.fillRect(bx + 16, by - 62, 9, 110); g.fillRect(bx + 205, by - 62, 9, 110);   // back legs
  g.fillRect(bx + 36, by + 8, 8, 34); g.fillRect(bx + 186, by + 8, 8, 34);       // front legs
  // warm rim light on the bench from the lamp
  g.fillStyle = 'rgba(252,192,72,0.22)'; g.fillRect(bx + 120, by, 110, 2);
  g.restore();
}

// ---------- HUD
function sectionChip(t) {
  const items = [[E.spin, E.orbit, '1', "EARTH'S SPIN"], [E.orbit, E.galaxy, '2', 'AROUND THE SUN'], [E.galaxy, E.payoff, '3', 'AROUND THE GALAXY']];
  for (const [a, b, n, label] of items) {
    const al = win(t, a - 0.05, b - 0.1, 0.5, 0.4);
    if (al <= 0) continue;
    const f = font(700, 30, MONO);
    const wLabel = measure(label, f, 3);
    const total = 44 + 16 + wLabel;
    const x0 = W / 2 - total / 2, y = 168;
    g.save(); g.globalAlpha = al;
    g.fillStyle = COL.amber; g.beginPath(); g.arc(x0 + 22, y - 10, 22, 0, Math.PI * 2); g.fill();
    text(n, x0 + 22, y, { f: font(800, 28, MONO), color: '#111', alpha: 1 });
    text(label, x0 + 60, y, { f, color: COL.white, align: 'left', spacing: 3, alpha: 1 });
    g.restore();
  }
}

function bigNumber(t) {
  const items = [
    [E.spin_num - 0.25, E.jet - 0.3, F.spin_eq_kmh, 'km/h', 'the ground at the equator', 0.9, ''],
    [E.orbit_num - 0.2, E.galaxy + 0.2, F.orbit_kmh, 'km/h', 'Earth around the Sun', 1.0, ''],
    [E.gal_num - 0.2, E.lap - 0.15, 800000, 'km/h', 'the Sun around the galaxy', 1.0, '≈'],
    [E.lap_num - 0.3, E.dinos - 0.1, 230, 'million years', 'one lap around the galaxy', 1.2, ''],
  ];
  for (const [a, b, value, unit, sub, dur, pre] of items) {
    const al = win(t, a, b, 0.3, 0.35);
    if (al <= 0) continue;
    const u = outCubic(ramp(t, a, a + dur));
    const n = pre + fmt(value * u);
    const fN = font(800, unit.length > 5 ? 96 : 108, MONO), fU = font(700, 44, MONO);
    const wN = measure(n, fN), wU = measure(' ' + unit, fU);
    const x0 = W / 2 - (wN + wU) / 2;
    const pop = lerp(0.92, 1, outBack(ramp(t, a, a + 0.35)));
    g.save(); g.translate(W / 2, 280); g.scale(pop, pop); g.translate(-W / 2, -280);
    text(n, x0, 300, { f: fN, color: COL.amber, align: 'left', alpha: al, shadow: 18 });
    text(' ' + unit, x0 + wN, 300, { f: fU, color: COL.amber, align: 'left', alpha: al, shadow: 12 });
    g.restore();
    text(sub, W / 2, 356, { f: font(500, 30, MONO), color: COL.grey, alpha: al * 0.95, shadow: 8 });
  }
}

function liveCounter(t) {
  const al = Math.min(smooth(ramp(t, 1.4, 1.9)), 1 - smooth(ramp(t, E.payoff - 0.4, E.payoff + 0.1)));
  if (al <= 0) return;
  const km = F.orbit_kms * t;
  const yHook = 470, yMain = 414;
  const y = lerp(yHook, yMain, smooth(ramp(t, E.spin - 0.4, E.spin + 0.6)));
  const label = 'SINCE YOU PRESSED PLAY', val = `${fmt(km)} km`, tail = 'around the Sun';
  const fL = font(500, 24, MONO), fV = font(800, 34, MONO), fT = font(500, 24, MONO);
  const wL = measure(label, fL, 2), wV = measure(val, fV), wT = measure(tail, fT);
  const pad = 26, gap = 16;
  const total = wL + gap + wV + gap + wT + pad * 2;
  const x0 = W / 2 - total / 2;
  g.save(); g.globalAlpha = al;
  rrect(x0, y - 36, total, 56, 28); g.fillStyle = 'rgba(10,14,24,0.72)'; g.fill();
  g.strokeStyle = 'rgba(252,192,72,0.35)'; g.lineWidth = 2; g.stroke();
  text(label, x0 + pad, y, { f: fL, color: COL.grey, align: 'left', spacing: 2 });
  text(val, x0 + pad + wL + gap, y + 1, { f: fV, color: COL.amber, align: 'left' });
  text(tail, x0 + pad + wL + gap + wV + gap, y, { f: fT, color: COL.grey, align: 'left' });
  g.restore();
}

function notes(t) {
  const range = F.gal_range_kmh.map(v => fmt(v)).join('–');
  const items = [
    [0.3, E.spin - 0.3, 'star motion sped up', 560],
    [E.spin + 0.4, E.merry - 0.35, 'spin sped up for the video'],
    [E.equator + 0.2, E.jet - 0.3, 'spin sped up for the video · dashes move with the ground'],
    [E.steady + 0.1, E.orbit - 0.25, `Earth's path does curve, but gently: about ${F.spin_accel_pct_g.toFixed(1)}% of gravity at the equator`],
    [E.orbit + 1.2, E.marathon - 0.35, 'sizes and distances not to scale · motion sped up'],
    [E.orbit_num + 0.1, E.galaxy - 0.1, 'sizes and distances not to scale · motion sped up'],
    [E.galaxy + 1.5, E.lap - 0.15, `illustration · published estimates: ${range} km/h`],
    [E.lap + 0.1, E.dinos - 0.15, `estimates: ${F.gal_year_range[0]}–${F.gal_year_range[1]} million years per lap`],
    [E.dinos + 0.2, E.payoff - 0.4, `first dinosaurs: about ${F.dinos_mya[0]}–${F.dinos_mya[1]} million years ago`],
    [E.payoff + 0.8, TL.duration, `uses Earth's mean orbital speed (${F.orbit_kms} km/s) and ≈${Math.round(F.gal_kms)} km/s for the Sun`],
  ];
  for (const [a, b, s, yy] of items) {
    const al = win(t, a, b, 0.4, 0.3);
    if (al <= 0) continue;
    const f = font(500, s.length > 60 ? 22 : 25, MONO);
    text(s, W / 2, yy || 1468, { f, color: COL.grey, alpha: al * 0.9, shadow: 8 });
  }
}

// ---------- hook bits
function hookTitle(t) {
  const al = Math.min(smooth(ramp(t, 0.0, 0.25)), 1 - smooth(ramp(t, E.spin - 0.7, E.spin - 0.1)));
  const alEnd = smooth(ramp(t, E.end + 0.6, E.end + 1.4));
  for (const [a, yo] of [[al, 0], [alEnd, 0]]) {
    if (a <= 0) continue;
    const f = font(800, 92, SANS);
    text('HOW FAST ARE YOU', W / 2, 262 + yo, { f, alpha: a, shadow: 26, spacing: 1 });
    text('MOVING RIGHT NOW?', W / 2, 364 + yo, { f, alpha: a, shadow: 26, spacing: 1 });
  }
}

function threeChips(t) {
  const al = 1 - smooth(ramp(t, E.spin - 0.8, E.spin - 0.2));
  if (t < E.three - 0.1 || al <= 0) return;
  const labels = ['SPIN', 'ORBIT', 'GALAXY'];
  const xs = [228, 540, 852];
  for (let i = 0; i < 3; i++) {
    const t0 = E.three + 0.05 + i * 0.28;
    const u = outBack(ramp(t, t0, t0 + 0.4));
    if (u <= 0) continue;
    const a = al * clamp(u);
    const f = font(700, 30, MONO);
    const wl = measure(labels[i], f, 3);
    const total = 42 + 14 + wl + 44;
    g.save(); g.globalAlpha = a; g.translate(xs[i], 1140); g.scale(lerp(0.7, 1, u), lerp(0.7, 1, u));
    rrect(-total / 2, -38, total, 64, 32); g.fillStyle = 'rgba(10,14,24,0.78)'; g.fill();
    g.strokeStyle = 'rgba(252,192,72,0.55)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = COL.amber; g.beginPath(); g.arc(-total / 2 + 22 + 21, -6, 19, 0, Math.PI * 2); g.fill();
    text(String(i + 1), -total / 2 + 43, 4, { f: font(800, 26, MONO), color: '#111' });
    text(labels[i], -total / 2 + 22 + 42 + 14, 4, { f, align: 'left', spacing: 3 });
    g.restore();
  }
}

// ---------- merry-go-round
function drawMerry(t, alpha) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha = alpha;
  fillBg(1);
  const cx = 540, cy = 790, R = 310;
  const w = 2 * Math.PI / 6.5;
  const a = w * (t - E.merry);
  // platform
  const pg = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  pg.addColorStop(0, '#1A2336'); pg.addColorStop(1, '#101828');
  g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#34405A'; g.lineWidth = 6; g.stroke();
  g.strokeStyle = 'rgba(120,135,165,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 8; i++) { const b = a + i * Math.PI / 4; g.beginPath(); g.moveTo(cx + 40 * Math.cos(b), cy + 40 * Math.sin(b)); g.lineTo(cx + (R - 8) * Math.cos(b), cy + (R - 8) * Math.sin(b)); g.stroke(); }
  g.fillStyle = '#26314A'; g.beginPath(); g.arc(cx, cy, 38, 0, Math.PI * 2); g.fill();
  // riders: trails are the same angle, so the outer one is longer = faster
  const edgeU = smooth(ramp(t, E.edge - 0.1, E.edge + 0.4));
  for (const [rad, color, size] of [[105, '#FFFFFF', 17], [290, COL.amber, 21]]) {
    const b = a + (rad > 200 ? 0.0 : Math.PI);
    const trailA = 1.1;
    for (let k = 0; k < 24; k++) {
      const a0 = b - trailA * (k + 1) / 24, a1 = b - trailA * k / 24;
      g.strokeStyle = color; g.globalAlpha = alpha * (1 - k / 24) * 0.8; g.lineWidth = size * 0.9;
      g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, rad, a0, a1); g.stroke();
    }
    g.globalAlpha = alpha;
    const x = cx + rad * Math.cos(b), y = cy + rad * Math.sin(b);
    if (rad > 200 && edgeU > 0) { g.fillStyle = `rgba(252,192,72,${0.25 * edgeU})`; g.beginPath(); g.arc(x, y, size + 18 + 10 * Math.sin(t * 8), 0, Math.PI * 2); g.fill(); }
    g.fillStyle = color; g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
  }
  text('a merry-go-round, seen from above', W / 2, 300, { f: font(500, 32, MONO), color: COL.grey });
  // legend
  const f = font(700, 34, MONO);
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(250, 1148, 12, 0, Math.PI * 2); g.fill();
  text('near the middle: slow', 276, 1160, { f, align: 'left', color: COL.white });
  g.fillStyle = COL.amber; g.beginPath(); g.arc(250, 1208, 14, 0, Math.PI * 2); g.fill();
  text('at the edge: fast', 276, 1220, { f, align: 'left', color: COL.amber, alpha: lerp(0.75, 1, edgeU) });
  g.restore();
}

// ---------- jet vs equator
function planeIcon(x, y, s, color) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = color;
  g.beginPath();
  g.moveTo(-30, -3); g.lineTo(18, -3); g.quadraticCurveTo(32, -3, 34, 0); g.quadraticCurveTo(32, 3, 18, 3); g.lineTo(-30, 3); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-2, -2); g.lineTo(-14, -24); g.lineTo(-7, -24); g.lineTo(12, -2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-2, 2); g.lineTo(-14, 24); g.lineTo(-7, 24); g.lineTo(12, 2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-26, -2); g.lineTo(-33, -12); g.lineTo(-28, -12); g.lineTo(-20, -2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-26, 2); g.lineTo(-33, 12); g.lineTo(-28, 12); g.lineTo(-20, 2); g.closePath(); g.fill();
  g.restore();
}
function drawJet(t, alpha) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha = alpha;
  fillBg(1);
  const x0 = 110, maxL = 860;
  const rows = [
    { y: 730, label: 'PASSENGER JET', v: F.jet_kmh, c: '#DCE3EE', t0: E.jet + 0.05 },
    { y: 960, label: "EARTH'S EQUATOR", v: F.spin_eq_kmh, c: COL.amber, t0: E.jet + 0.55 },
  ];
  for (const r of rows) {
    const u = outCubic(ramp(t, r.t0, r.t0 + 0.9));
    const L = maxL * r.v / F.spin_eq_kmh * u;
    text(r.label, x0, r.y - 58, { f: font(700, 32, MONO), align: 'left', color: COL.grey, spacing: 3 });
    rrect(x0, r.y - 30, maxL, 60, 12); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fill();
    if (L > 4) { rrect(x0, r.y - 30, L, 60, 12); g.fillStyle = r.c; g.fill(); }
    text(`${fmt(r.v * u)} km/h`, x0 + Math.max(L, 10) - 18, r.y + 13, { f: font(800, 36, MONO), align: 'right', color: '#0B0F18', alpha: L > 260 ? 1 : 0 });
  }
  planeIcon(x0 + maxL * F.jet_kmh / F.spin_eq_kmh * outCubic(ramp(t, rows[0].t0, rows[0].t0 + 0.9)) + 48, 730, 1.15, '#DCE3EE');
  const tu = outBack(ramp(t, E.jet_word - 0.1, E.jet_word + 0.35));
  if (tu > 0) {
    g.save(); g.translate(540, 1150); g.scale(tu, tu);
    text(`≈ ${(F.spin_eq_kmh / F.jet_kmh).toFixed(1)}× as fast`, 0, 0, { f: font(800, 56, SANS), color: COL.white });
    g.restore();
  }
  g.restore();
}

// ---------- smooth flight: pouring a drink
function drawFlight(t, alpha) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha = alpha;
  const wall = g.createLinearGradient(0, 300, 0, 1400);
  wall.addColorStop(0, '#0C1220'); wall.addColorStop(1, '#070A12');
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  richText([{ s: 'cruising at about ', c: COL.white }, { s: `${fmt(900)} km/h`, c: COL.amber }], W / 2, 300, font(700, 40, MONO), 1, 12);
  // window
  const cx = 540, cy = 690, ww = 340, wh = 440;
  rrect(cx - ww / 2 - 32, cy - wh / 2 - 32, ww + 64, wh + 64, 190); g.fillStyle = '#161E2E'; g.fill();
  g.save();
  rrect(cx - ww / 2, cy - wh / 2, ww, wh, 160); g.clip();
  const sky = g.createLinearGradient(0, cy - wh / 2, 0, cy + wh / 2);
  sky.addColorStop(0, '#2C5D9C'); sky.addColorStop(0.55, '#7FB0E0'); sky.addColorStop(1, '#D7E7F5');
  g.fillStyle = sky; g.fillRect(cx - ww, cy - wh, ww * 2, wh * 2);
  const r = rng(99);
  for (let i = 0; i < 26; i++) {
    const baseX = r() * 1400, y = cy + 40 + r() * 190, sz = 36 + r() * 60;
    const x = ((baseX - (t * 420 * (0.6 + (y - cy) / 400))) % 1400 + 1400) % 1400 - 200;
    const cg = g.createRadialGradient(x, y, 0, x, y, sz);
    cg.addColorStop(0, 'rgba(255,255,255,0.95)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, sz * 1.8, sz * 0.7, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // tray table
  const ty = 1224;
  rrect(150, ty, 780, 32, 10); g.fillStyle = '#243049'; g.fill();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(170, ty + 32, 740, 12);
  // glass
  const gx = 470, gTop = 1066, gBot = ty, wTop = 128, wBot = 100;
  const level = smooth(ramp(t, E.flight + 0.4, E.pour + 0.5));
  const liquidTop = lerp(gBot - 8, gTop + 30, level);
  const halfAt = y => lerp(wBot, wTop, (gBot - y) / (gBot - gTop)) / 2;
  if (level > 0.002) {
    g.beginPath(); g.moveTo(gx - halfAt(liquidTop) + 5, liquidTop); g.lineTo(gx + halfAt(liquidTop) - 5, liquidTop);
    g.lineTo(gx + wBot / 2 - 5, gBot - 6); g.lineTo(gx - wBot / 2 + 5, gBot - 6); g.closePath();
    const lq = g.createLinearGradient(0, liquidTop, 0, gBot); lq.addColorStop(0, '#FFD27A'); lq.addColorStop(1, '#E59A2E');
    g.fillStyle = lq; g.fill();
    g.strokeStyle = 'rgba(255,245,215,0.9)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(gx - halfAt(liquidTop) + 6, liquidTop); g.lineTo(gx + halfAt(liquidTop) - 6, liquidTop); g.stroke();
  }
  g.strokeStyle = 'rgba(230,240,255,0.75)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(gx - wTop / 2, gTop); g.lineTo(gx - wBot / 2, gBot); g.lineTo(gx + wBot / 2, gBot); g.lineTo(gx + wTop / 2, gTop); g.stroke();
  // bottle (neck at the mouth, body up to the right) and the stream
  const pourOn = win(t, E.flight + 0.15, E.pour + 0.7, 0.35, 0.35);
  if (pourOn > 0) {
    g.save(); g.globalAlpha *= pourOn;
    const mx = gx + 44, my = gTop - 30;
    g.save(); g.translate(mx, my); g.rotate(-24 * D2R);
    g.fillStyle = '#4C6184'; rrect(0, -11, 46, 22, 7); g.fill();
    g.fillStyle = '#3A4B66'; rrect(40, -32, 190, 64, 20); g.fill();
    g.fillStyle = COL.amber; g.fillRect(110, -32, 52, 64);
    g.restore();
    g.strokeStyle = '#F5B342'; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(mx + 2, my + 6); g.quadraticCurveTo(mx - 14, my + 40, gx + 10, liquidTop - 2); g.stroke();
    g.restore();
  }
  g.restore();
}

// ---------- marathon
function runner(x, y, phase, s, color) {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI);
  g.beginPath(); g.arc(4, -92, 12, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(2, -78); g.lineTo(-4, -40); g.stroke();                      // body
  g.beginPath(); g.moveTo(0, -70); g.lineTo(14 * sw, -54); g.lineTo(22 * sw + 6, -64); g.stroke();   // arm
  g.beginPath(); g.moveTo(0, -70); g.lineTo(14 * sw2, -54); g.lineTo(22 * sw2 + 6, -64); g.stroke();
  g.beginPath(); g.moveTo(-4, -40); g.lineTo(-4 + 18 * sw, -20); g.lineTo(-4 + 10 * sw - 6, 0); g.stroke();   // legs
  g.beginPath(); g.moveTo(-4, -40); g.lineTo(-4 + 18 * sw2, -20); g.lineTo(-4 + 10 * sw2 - 6, 0); g.stroke();
  g.restore();
}
function drawMarathon(t, alpha) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha = alpha;
  fillBg(1);
  const x0 = 110, x1 = 970, y = 900;
  text('MARATHON', W / 2, 700, { f: font(800, 60, MONO), color: COL.white, spacing: 4 });
  text(`${F.marathon_km.toFixed(1)} km`, W / 2, 770, { f: font(700, 40, MONO), color: COL.grey });
  g.strokeStyle = '#2B3549'; g.lineWidth = 16; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
  g.setLineDash([18, 16]); g.strokeStyle = 'rgba(200,210,230,0.35)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
  text('START', x0, y + 62, { f: font(700, 24, MONO), color: COL.grey, align: 'left', spacing: 2 });
  text('FINISH', x1, y + 62, { f: font(700, 24, MONO), color: COL.grey, align: 'right', spacing: 2 });
  // chequered flag
  g.fillStyle = '#DCE3EE'; g.fillRect(x1 - 4, y - 120, 6, 120);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? '#0B0F18' : '#FFFFFF'; g.fillRect(x1 + 2 + i * 14, y - 120 + j * 14, 14, 14); }
  // runner: a person needs hours
  runner(x0 + 34 + (t - E.marathon) * 3.0, y - 10, (t - E.marathon) * 11, 0.9, '#DCE3EE');
  // Earth dashes the full distance in 1.42 s of real time
  const tStart = E.marathon_earth + 0.25;
  const u = clamp((t - tStart) / F.marathon_s);
  const ex = lerp(x0, x1, u);
  if (t > tStart - 0.4) {
    const ea = smooth(ramp(t, tStart - 0.4, tStart));
    for (let k = 0; k < 18; k++) {
      const tx = ex - k * 22; if (tx < x0 || u <= 0) break;
      g.fillStyle = `rgba(125,183,255,${ea * 0.4 * (1 - k / 18)})`; g.beginPath(); g.arc(tx, y - 70, 22 - k * 0.7, 0, Math.PI * 2); g.fill();
    }
    const eg = g.createRadialGradient(ex - 8, y - 78, 4, ex, y - 70, 28);
    eg.addColorStop(0, '#9FD0FF'); eg.addColorStop(0.55, '#2E6FC1'); eg.addColorStop(1, '#173A6B');
    g.globalAlpha = alpha * ea; g.fillStyle = eg; g.beginPath(); g.arc(ex, y - 70, 28, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(90,170,90,0.9)'; g.beginPath(); g.ellipse(ex - 6, y - 76, 10, 7, 0.5, 0, Math.PI * 2); g.fill();
    g.globalAlpha = alpha;
    // stopwatch
    const secs = F.marathon_s * u;
    text('EARTH', W / 2, 1110, { f: font(700, 30, MONO), color: COL.grey, spacing: 4, alpha: ea });
    text(`${secs.toFixed(2)} s`, W / 2, 1200, { f: font(800, 92, MONO), color: COL.amber, alpha: ea, shadow: 16 });
  }
  g.restore();
}

// ---------- galaxy labels
function galaxyLabels(t) {
  if (!state3.galSun) return;
  const al = smooth(ramp(t, E.galaxy + 3.6, E.galaxy + 4.4)) * (1 - smooth(ramp(t, E.payoff - 0.6, E.payoff)));
  if (al <= 0) return;
  // orbit path around the centre (dashed), and the lap trail
  const orbA = al * smooth(ramp(t, E.gal_num - 0.2, E.gal_num + 0.8));
  if (orbA > 0) {
    g.save(); g.globalAlpha = orbA * 0.55; g.strokeStyle = 'rgba(220,228,245,0.8)'; g.lineWidth = 2.5; g.setLineDash([10, 12]);
    g.beginPath(); state3.galOrbit.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.setLineDash([]); g.restore();
  }
  if (state3.lapU > 0) {
    const n = Math.floor(state3.lapU * 160);
    g.save(); g.globalAlpha = al; g.strokeStyle = COL.amber; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); for (let i = 0; i <= n; i++) { const p = state3.galOrbit[i]; i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke(); g.restore();
  }
  const c = state3.galCentre;
  text('centre of the Milky Way', c.x, c.y - 120, { f: font(500, 26, MONO), color: COL.grey, alpha: al * 0.9, shadow: 10 });
  const s = state3.galSun;
  const pulse = 1 + 0.25 * Math.sin(t * 5);
  g.save(); g.globalAlpha = al;
  g.strokeStyle = COL.amber; g.lineWidth = 3; g.beginPath(); g.arc(s.x, s.y, 22 * pulse, 0, Math.PI * 2); g.stroke();
  g.fillStyle = COL.amber; g.beginPath(); g.arc(s.x, s.y, 9, 0, Math.PI * 2); g.fill();
  g.restore();
  const lx = s.x > W / 2 ? s.x - 40 : s.x + 40, align = s.x > W / 2 ? 'right' : 'left';
  text('THE SUN', lx, s.y - 6, { f: font(800, 30, MONO), color: COL.amber, align, alpha: al, shadow: 10 });
  text('(and you)', lx, s.y + 28, { f: font(500, 24, MONO), color: COL.white, align, alpha: al, shadow: 10 });
}

function solarLabels(t) {
  const al = win(t, E.orbit + 1.8, E.galaxy + 0.8, 0.5, 0.6);
  if (al <= 0) return;
  const e = state3.earthScreen, s = state3.sunScreen;
  text('EARTH', e.x, e.y - 44, { f: font(700, 26, MONO), color: COL.white, alpha: al, shadow: 10 });
  text('SUN', s.x, s.y + 92, { f: font(700, 26, MONO), color: COL.amber, alpha: al * 0.9, shadow: 10 });
}

function ringLabels(t) {
  const al = state3.ringOn;
  if (!al || al <= 0.01) return;
  const vals = { 0: F.spin_eq_kmh, 30: F.spin_30_kmh, 60: F.spin_60_kmh };
  for (const r of state3.rings) {
    const isEq = r.lat === 0;
    const u = isEq ? smooth(ramp(t, E.spin_num - 0.2, E.spin_num + 0.5)) : 0;
    const f = font(800, isEq ? lerp(32, 38, u) : 28, MONO);
    const s = `${fmt(vals[r.lat])} km/h`;
    const wS = measure(s, f);
    g.save(); g.globalAlpha = al;
    rrect(r.s.x - wS / 2 - 14, r.s.y - 58, wS + 28, isEq ? 50 : 44, 12);
    g.fillStyle = 'rgba(8,11,20,0.62)'; g.fill();
    g.restore();
    text(s, r.s.x, r.s.y - 22, { f, color: isEq ? COL.amber : COL.white, alpha: al });
  }
  if (state3.pole) text('0 km/h at the pole', state3.pole.x, state3.pole.y - 26, { f: font(700, 24, MONO), color: COL.grey, alpha: al, shadow: 8 });
}

// ---------- dinosaurs card
function footprint(x, y, s, color, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.fillStyle = color;
  g.beginPath(); g.ellipse(0, 12, 34, 30, 0, 0, Math.PI * 2); g.fill();
  const toe = (ang, len, w) => {
    g.save(); g.rotate(ang);
    rrect(-w, -len, 2 * w, len + 6, w); g.fill();
    g.beginPath(); g.moveTo(-w * 0.62, -len + w * 0.35); g.lineTo(0, -len - w * 1.25); g.lineTo(w * 0.62, -len + w * 0.35); g.closePath(); g.fill();
    g.restore();
  };
  toe(-0.62, 92, 17); toe(0, 112, 18); toe(0.62, 92, 17);
  g.restore();
}
function drawDino(t, alpha) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = 'rgba(5,7,15,0.62)'; g.fillRect(0, 0, W, H);
  const u = outBack(ramp(t, E.dinos - 0.1, E.dinos + 0.45));
  g.translate(540, 840); g.scale(lerp(0.88, 1, u), lerp(0.88, 1, u)); g.translate(-540, -840);
  rrect(140, 540, 800, 600, 36); g.fillStyle = 'rgba(13,18,30,0.93)'; g.fill();
  g.strokeStyle = 'rgba(252,192,72,0.45)'; g.lineWidth = 3; g.stroke();
  footprint(338, 900, 0.5, 'rgba(252,192,72,0.16)', -0.35);
  footprint(430, 820, 0.62, 'rgba(252,192,72,0.32)', 0.3);
  footprint(600, 770, 0.95, COL.amber, -0.2);
  text(`≈ ${F.gal_year_myr} MILLION YEARS AGO`, 540, 960, { f: font(800, 40, MONO), color: COL.amber, spacing: 1 });
  text('the first dinosaurs', 540, 1040, { f: font(800, 58, SANS), color: COL.white });
  g.restore();
}

// ---------- payoff card
function drawPayoff(t, alpha) {
  if (alpha <= 0.002) return;
  const tp = E.payoff;
  const u = outBack(ramp(t, tp + 0.1, tp + 0.6));
  const out = 1 - smooth(ramp(t, E.end + 0.3, E.end + 1.0));
  const a = alpha * clamp(u) * out;
  if (a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.translate(540, 780); g.scale(lerp(0.9, 1, u), lerp(0.9, 1, u)); g.translate(-540, -780);
  rrect(110, 470, 860, 640, 40); g.fillStyle = 'rgba(10,14,24,0.84)'; g.fill();
  g.strokeStyle = 'rgba(252,192,72,0.45)'; g.lineWidth = 3; g.stroke();
  text('SINCE YOU PRESSED PLAY', 540, 548, { f: font(700, 30, MONO), color: COL.grey, spacing: 3 });
  text(`${fmt(F.orbit_kms * t)} km`, 540, 680, { f: font(800, 116, MONO), color: COL.amber, shadow: 20 });
  text('around the Sun', 540, 740, { f: font(700, 40, SANS), color: COL.white });
  g.strokeStyle = 'rgba(163,172,186,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(200, 800); g.lineTo(880, 800); g.stroke();
  const galKm = F.gal_kms * t;
  const u2 = smooth(ramp(t, tp + 1.0, tp + 1.6));
  text(`${fmt(galKm)} km`, 540, 890, { f: font(800, 72, MONO), color: COL.white, alpha: u2 });
  text('through the galaxy', 540, 944, { f: font(700, 36, SANS), color: COL.grey, alpha: u2 });
  // Earth's width comparison bar
  const bw = 640, bx = 220, by = 1010;
  const L1 = bw * F.earth_diameter_km / galKm;
  g.globalAlpha = a * u2;
  rrect(bx, by, bw, 18, 9); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
  rrect(bx, by + 34, L1, 18, 9); g.fillStyle = '#5B9BE6'; g.fill();
  text('your trip through the galaxy', bx + bw, by - 14, { f: font(500, 24, MONO), color: COL.grey, align: 'right' });
  text(`Earth's width: ${fmt(F.earth_diameter_km)} km`, bx, by + 88, { f: font(500, 26, MONO), color: '#8CB8F0', align: 'left' });
  g.restore();
}

// ---------------------------------------------------------------- frame
function coverage(t) {
  // full-screen 2D scenes that hide the 3D layer
  return Math.max(
    1 - smooth(ramp(t, E.spin - 0.35, E.spin + 0.45)),           // hook night scene
    smooth(ramp(t, E.payoff - 0.55, E.payoff + 0.15)),            // payoff night scene
    win(t, E.merry - 0.35, E.equator - 0.1, 0.4, 0.45),
    win(t, E.jet - 0.3, E.orbit - 0.15, 0.4, 0.5),
    win(t, E.marathon - 0.3, E.orbit_num - 0.1, 0.4, 0.45),
  );
}

function draw2D(t) {
  g.clearRect(0, 0, W, H);
  const hookA = 1 - smooth(ramp(t, E.spin - 0.35, E.spin + 0.45));
  const payA = smooth(ramp(t, E.payoff - 0.55, E.payoff + 0.15));
  drawNight(t, hookA, 0);
  drawNight(t, payA, E.payoff - 0.6);
  if (t < E.payoff) {
    ringLabels(t);
    solarLabels(t);
    galaxyLabels(t);
  }
  drawMerry(t, win(t, E.merry - 0.35, E.equator - 0.1, 0.4, 0.45));
  drawJet(t, win(t, E.jet - 0.3, E.feel - 0.1, 0.4, 0.4));
  drawFlight(t, win(t, E.feel - 0.3, E.orbit - 0.15, 0.4, 0.5));
  drawMarathon(t, win(t, E.marathon - 0.3, E.orbit_num - 0.1, 0.4, 0.45));
  drawDino(t, win(t, E.dinos - 0.2, E.payoff - 0.45, 0.4, 0.45));
  drawPayoff(t, payA);
  hookTitle(t);
  threeChips(t);
  sectionChip(t);
  bigNumber(t);
  liveCounter(t);
  notes(t);
}

window.renderFrame = (t) => {
  update3D(t);
  if (coverage(t) < 0.999) renderer.render(scene, camera);
  draw2D(t);
  return true;
};

async function boot() {
  [TL, F] = await Promise.all([fetch('../config/timeline.json').then(r => r.json()), fetch('../config/facts.json').then(r => r.json())]);
  E = TL.events; S = {}; for (const s of TL.sections) S[s.name] = s;
  E.end_t = TL.duration;
  await Promise.all([font(800, 80), font(700, 40), font(600, 40), font(800, 80, MONO), font(700, 40, MONO), font(500, 30, MONO)].map(f => document.fonts.load(f)));
  initNight();
  await init3D();
  window.DURATION = TL.duration;
  window.READY = true;
}
boot().catch(e => { window.BOOT_ERROR = String(e && e.stack || e); console.error(e); });
