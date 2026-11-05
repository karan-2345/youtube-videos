// scenes/main.js -- boot + the timeline. window.setTime(t) draws the frame at t seconds (pure function of t).
import * as THREE from 'three';
import { W, H, SAFE, makeRenderer, makeEnvironment } from './engine.js';
import { Compositor } from './comp.js';
import { Studio, ROWS, HUB_Y } from './studio.js';
import { Overlay } from './overlay.js';
import { buildShots, trap } from './shots.js';

export async function boot() {
  const data = await (await fetch('/cache/data.json')).json();
  await document.fonts.load('800 100px InterXB');
  const renderer = makeRenderer(document.getElementById('gl'));
  const g = renderer.getContext();
  const dbg = g.getExtension('WEBGL_debug_renderer_info');
  window.glInfo = dbg ? g.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
  const env = makeEnvironment(renderer);
  const comp = new Compositor(renderer);
  const studio = new Studio(renderer, env, comp);
  const ov = new Overlay(document.getElementById('ov'), document.getElementById('svg'));
  const ctx = { THREE, renderer, env, comp, studio, ov, data, F: data.facts, W, H, SAFE, ROWS, HUB_Y };
  ctx.out = null;
  const { shots, cues } = buildShots(ctx);
  // scan-line wipes: the earlier shot's frozen frame stays below the line, the new shot appears above it
  const rtScreen = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.NoColorSpace });
  const wipeMat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
    uniforms: { tPrev: { value: rtScreen.texture }, uY: { value: 0 }, uAmber: { value: new THREE.Color('#ffae42') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D tPrev; uniform float uY; uniform vec3 uAmber;
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
      void main(){ float y = (1.0 - vUv.y) * 1920.0; float d = abs(y - uY);
        float core = 1.0 - smoothstep(1.0, 2.0, d);
        vec3 lineCol = mix(vec3(1.0, 0.86, 0.62), toSRGB(uAmber), 0.35);
        if (y < uY - 2.0) { gl_FragColor = vec4(0.0); return; }
        vec4 p = texture2D(tPrev, vUv);
        gl_FragColor = vec4(mix(p.rgb, lineCol, core), 1.0); }` });
  const wipeScene = new THREE.Scene(); const wq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), wipeMat); wq.frustumCulled = false; wipeScene.add(wq);
  const ocam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const byId = Object.fromEntries(shots.map((s) => [s.id, s]));
  let prevKey = null;
  const renderPrev = (from, at) => {
    const key = from + '@' + at;
    if (prevKey === key) return;
    ctx.out = rtScreen; studio.target = rtScreen;
    ov.suspend = true;
    byId[from].render(at);
    ov.suspend = false;
    ctx.out = null; studio.target = null;
    prevKey = key;
  };
  window.cueList = () => cues;
  window.shotList = () => shots.map((s) => [s.id, s.t0, s.t1]);
  window.setTime = async (t) => {
    ov.begin();
    const s = shots.find((x) => t >= x.t0 && t < x.t1) || shots[shots.length - 1];
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x0b0b0c, 1); renderer.clear();
    let wp = null;
    for (const w of [s.wipe, s.wipe2]) if (w && t >= w.a && t < w.b) wp = w;
    if (wp) renderPrev(wp.from, wp.at ?? byId[wp.from].t1 - 1 / 60);
    renderer.setRenderTarget(null);
    s.render(t);
    if (wp) {
      wipeMat.uniforms.uY.value = 240 + 1440 * trap((t - wp.a) / (wp.b - wp.a), 0.25);
      renderer.setRenderTarget(null); const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.render(wipeScene, ocam); renderer.autoClear = ac;
      ov.clip('a', 0, wipeMat.uniforms.uY.value);
    }
    ov.end();
    const px = new Uint8Array(4);
    g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);     // wait for the GPU before the screenshot
  };
  window.dbg = (k, b, ph, step = 0) => { studio.draw({ pass: { k, rate: 40, phase: ph, blades: b, debugStep: step }, scan: 1440, ghost: 0, line: 0 }); };
  window.dbgGrad = async () => {
    const { captureRows, rtFloat } = await import('./engine.js');
    const sc = new THREE.Scene(); const rt = rtFloat(2160, 2880, 0);
    const pm = new THREE.MeshBasicMaterial({ color: 0xffffff }); const pl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), pm); pl.position.z = 0; sc.add(pl);
    captureRows(renderer, { scene: sc, camera: studio.capCam, rt, rows: 1440, ss: 2, setState: (v) => { sc.background = new THREE.Color(0, 1, 0); pm.color.setRGB(v, 0, 1 - v); }, timeOfRow: (r) => r / 1440 });
    const out = [];
    for (const y of [10, 700, 1400, 2100, 2870]) { const px = new Uint16Array(4); renderer.readRenderTargetPixels(rt, 100, y, 1, 1, px); out.push([y, THREE.DataUtils.fromHalfFloat(px[0]).toFixed(3)]); }
    console.log('readback (GL y from bottom, red = row/1440):', JSON.stringify(out));
    studio.comp.draw({ tBg: studio.rtBg.texture, tProp: studio.rtProp.texture, tCap: rt.texture, scan: 1440, line: 0 });
  };
  window.dbgBands = (k, b, ph) => {
    const pass = { k, rate: 40, phase: ph, blades: b };
    const rt = studio.capture(pass);
    const buf = new Uint16Array(2160 * 2880 * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, 2160, 2880, buf);
    const res = [];
    for (let row = 0; row < 1440; row += 60) {
      const gy = 2880 - 1 - row * 2; let n = 0, sx = 0;
      for (let x = 0; x < 2160; x++) { const a = THREE.DataUtils.fromHalfFloat(buf[(gy * 2160 + x) * 4 + 3]); if (a > 0.5) { n++; sx += x; } }
      res.push(`${row}:${n ? Math.round(sx / n / 2) : '-'}`);
    }
    console.log('readback bands row:meanX ' + res.join(' '));
  };
  window.shotAt = async (t, flag) => { window.SHOWSCREEN = flag; await window.setTime(t); };
  window.ready = true;
}
