// scenes/main.js -- boot + the timeline. window.setTime(t) draws the frame at t seconds (pure function of t).
import * as THREE from 'three';
import { W, H, SAFE, makeRenderer, makeEnvironment } from './engine.js';
import { Compositor } from './comp.js';
import { Studio, ROWS, HUB_Y } from './studio.js';
import { Overlay } from './overlay.js';
import { buildShots } from './shots.js';

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
  const { shots, cues } = buildShots(ctx);
  window.cueList = () => cues;
  window.shotList = () => shots.map((s) => [s.id, s.t0, s.t1]);
  window.setTime = async (t) => {
    ov.begin();
    const s = shots.find((x) => t >= x.t0 && t < x.t1) || shots[shots.length - 1];
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x0b0b0c, 1); renderer.clear();
    s.render(t);
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
  window.ready = true;
}
