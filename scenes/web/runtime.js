// scenes/web/runtime.js -- shared runtime for every web/three.js scene.
//
// A scene module (scenes/3d/<Id>.js) exports  async setup(ctx) -> { scene, camera, update(t), selfTest? }
// ctx = { THREE, renderer, data, overlay, W, H }. `data` is renders/cache/scenes/<Id>.json,
// written by scenes/3d/export.py (numbers from config/facts.py, timings from the TTS).
import * as THREE from 'three';

export const W = 1080, H = 1920;   // vertical Short

// ---------------------------------------------------------------- easing / tracks
export const ease = {
  linear: t => t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
};
export const clamp01 = x => Math.min(1, Math.max(0, x));
export const lerp = (a, b, u) => a + (b - a) * u;

/** 0 -> 1 between t0 and t1 with easing. */
export function ramp(t, t0, t1, fn = ease.inOut) { return fn(clamp01((t - t0) / (t1 - t0))); }

/** Piecewise keyframes [[time, value], ...]; eased between keys, held outside. log=true for zooms. */
export function track(t, keys, { fn = ease.inOut, log = false } = {}) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    if (t <= t1) {
      const u = fn(clamp01((t - t0) / Math.max(t1 - t0, 1e-9)));
      return log ? Math.exp(lerp(Math.log(v0), Math.log(v1), u)) : lerp(v0, v1, u);
    }
  }
  return keys[keys.length - 1][1];
}

/** Integral of a piecewise-linear rate (keys [[t, rate], ...]) from 0 to t. Used for time-lapse. */
export function integrateRate(t, keys) {
  let acc = 0, prevT = 0, prevR = keys[0][1];
  for (const [kt, kr] of keys) {
    if (kt <= prevT) { prevR = kr; continue; }
    const end = Math.min(t, kt);
    if (end > prevT) {
      const rEnd = prevR + (kr - prevR) * (end - prevT) / (kt - prevT);
      acc += 0.5 * (prevR + rEnd) * (end - prevT);
    }
    if (t <= kt) return acc;
    prevT = kt; prevR = kr;
  }
  return acc + prevR * (t - prevT);
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- overlay (DOM labels)
export class Overlay {
  constructor() {
    this.root = document.getElementById('overlay');
    this.svg = document.getElementById('leaders');
  }
  el(html, cls = '', accent = null) {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    if (accent) d.style.setProperty('--accent', accent);
    // Every overlay element is positioned only by place(): take it out of the normal flow so
    // elements never stack under one another.
    d.style.position = 'absolute';
    d.style.left = '0';
    d.style.top = '0';
    d.style.opacity = 0;
    this.root.appendChild(d);
    return d;
  }
  /** Position an element; anchor = which point of the box sits at (x, y): 'l','r','t','b','c','tl','tr'... */
  place(d, x, y, { anchor = 'l', opacity = 1, dy = 0 } = {}) {
    const w = d.offsetWidth, h = d.offsetHeight;
    let ox = 0, oy = -h / 2;
    if (anchor.includes('r')) ox = -w;
    if (anchor === 'c' || anchor === 't' || anchor === 'b') ox = -w / 2;
    if (anchor.includes('t')) oy = 0;
    if (anchor.includes('b')) oy = -h;
    d.style.transform = `translate(${Math.round(x + ox)}px, ${Math.round(y + oy + dy)}px)`;
    d.style.opacity = opacity;
    return { x: x + ox, y: y + oy + dy, w, h };
  }
  line(color, width = 2) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', width);
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    this.svg.appendChild(p);
    return p;
  }
  dot(color, r = 5) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', r);
    c.setAttribute('fill', color);
    this.svg.appendChild(c);
    return c;
  }
}

/** World position -> pixel coordinates (+ whether it is in front of the camera). */
export function toScreen(v, camera) {
  camera.updateMatrixWorld();             // the camera may have moved this frame, before any render
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, front: p.z < 1 };
}

// ---------------------------------------------------------------- post: supersampling, motion blur, film look
// cfg = { ss: render scale (1.5 = 2880x1620), samples: sub-frames per frame, shutter: fraction of a frame (0.5 =
// a 180-degree shutter), grain, vignette, exposure }. Everything is rendered linear (half float) and tone-mapped
// once at the end (ACES fit), so the blur averages light, not display values.
function makePost(renderer, cfg) {
  const ss = cfg.ss || 1.5;
  const w = Math.round(W * ss), h = Math.round(H * ss);
  const opts = { type: THREE.HalfFloatType, depthBuffer: true, samples: cfg.msaa ?? 4 };
  const sub = new THREE.WebGLRenderTarget(w, h, opts);
  const acc = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)); return s; };
  const accMat = new THREE.ShaderMaterial({
    uniforms: { src: { value: sub.texture }, wgt: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    // alpha 1: AdditiveBlending is (SRC_ALPHA, ONE), so alpha = wgt would weight every sub-frame by wgt twice
    fragmentShader: 'uniform sampler2D src; uniform float wgt; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(src, vUv).rgb * wgt, 1.0); }',
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
  });
  const outMat = new THREE.ShaderMaterial({
    uniforms: {
      src: { value: acc.texture }, texel: { value: new THREE.Vector2(1 / w, 1 / h) }, seed: { value: 0 },
      grain: { value: cfg.grain ?? 0.035 }, vignette: { value: cfg.vignette ?? 0.22 }, exposure: { value: cfg.exposure ?? 1.0 },
      fade: { value: 0 }, fadeColor: { value: new THREE.Color(cfg.bg ?? 0x0b110f) }, mono: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D src; uniform vec2 texel; uniform float seed, grain, vignette, exposure, fade, mono; uniform vec3 fadeColor;
      varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0., 1.); }
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4))-0.055, step(0.0031308, c)); }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
      void main(){
        // 4-tap box downsample from the supersampled buffer (bilinear taps at +-0.5 texel)
        vec3 c = 0.25*(texture2D(src, vUv+texel*vec2(-.5,-.5)).rgb + texture2D(src, vUv+texel*vec2(.5,-.5)).rgb
                     + texture2D(src, vUv+texel*vec2(-.5,.5)).rgb + texture2D(src, vUv+texel*vec2(.5,.5)).rgb);
        c = aces(c * exposure);
        float l = dot(c, vec3(.2126,.7152,.0722)); c = mix(c, vec3(l), mono);
        vec2 q = vUv - .5; c *= 1. - vignette * dot(q, q) * 2.2;
        c = toSRGB(c);
        c += (hash(vUv * vec2(1080., 1920.)) - .5) * grain;
        c = mix(c, fadeColor, fade);
        gl_FragColor = vec4(c, 1.);
      }`,
    depthTest: false, depthWrite: false,
  });
  const accScene = quad(accMat), outScene = quad(outMat);
  return {
    samples: cfg.samples ?? 6, shutter: cfg.shutter ?? 0.5,
    accumulate(scene, camera, k, K) {
      renderer.autoClear = false;                      // the accumulation buffer must survive between passes
      renderer.setRenderTarget(sub);
      renderer.setClearColor(cfg.bg ?? 0x0b110f, 1);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(acc);
      if (k === 0) { renderer.setClearColor(0x000000, 0); renderer.clear(); }
      accMat.uniforms.wgt.value = 1 / K;
      renderer.render(accScene, quadCam);
    },
    finish(t, look) {
      const u = outMat.uniforms;
      u.seed.value = (Math.round(t * 60) % 997) * 1.37;
      u.fade.value = look.fade ?? 0; u.mono.value = look.mono ?? 0;
      u.exposure.value = look.exposure ?? (cfg.exposure ?? 1.0);
      u.grain.value = look.grain ?? (cfg.grain ?? 0.035);
      renderer.setRenderTarget(null);
      renderer.render(outScene, quadCam);
    },
  };
}

// ---------------------------------------------------------------- boot
export async function boot() {
  const id = new URLSearchParams(location.search).get('scene');
  const data = await (await fetch(`/renders/cache/scenes/${id}.json`, { cache: 'no-store' })).json();
  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('gl'), antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  // a lost GPU context (memory pressure with several capture workers) is counted, so the capture can re-render
  const canvas = document.getElementById('gl');
  window.ctxLost = 0; window.ctxRestored = 0;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); window.ctxLost++; });
  canvas.addEventListener('webglcontextrestored', () => { window.ctxRestored++; });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(new THREE.Color(data.palette.bg), 1);
  const mod = await import(`/scenes/3d/${id}.js`);
  const ctx = { THREE, renderer, data, overlay: new Overlay(), W, H };
  const sc = await mod.setup(ctx);
  await document.fonts.ready;
  window.sceneDuration = data.timing.duration;
  const post = sc.post ? makePost(renderer, sc.post) : null;
  window.setTime = async (t) => {
    if (!post) {
      await sc.update(t);            // a scene may return a promise (e.g. archive film frames decoding)
      renderer.render(sc.scene, sc.camera);
      return true;
    }
    // motion blur: average K sub-frames spread over the shutter interval, rendered supersampled in linear HDR;
    // then one exact update at t (so DOM overlays sit at t) and the film pass (tone map, grain, vignette)
    const K = sc.blurSamples ? sc.blurSamples(t) : post.samples;
    for (let k = 0; k < K; k++) {
      const tk = K > 1 ? t + ((k + 0.5) / K - 0.5) * post.shutter / data.fps : t;
      await sc.update(tk, { sub: true, frameT: t });   // frameT: shot cuts follow the frame, not the sub-frame
      post.accumulate(sc.scene, sc.camera, k, K);
    }
    await sc.update(t, { sub: false, frameT: t });
    post.finish(t, sc.look ? sc.look(t) : {});
    return true;
  };
  await window.setTime(0);           // warm-up: the first render compiles shaders and builds the environment map,
  await window.setTime(0);           // which left frame 0 darker than frame 1 (S04, 2026-10-17)
  window.selfTest = () => (sc.selfTest ? sc.selfTest() : null);
  window.glInfo = renderer.getContext().getParameter(renderer.getContext().RENDERER);
  window.ready = true;
}
