// scenes/web/runtime.js -- boots one scene: loads its key schedule (renders/cache/scenes/<Id>.json, written by
// scenes/export.py from the measured narration), the country table (data/countries.json) and the flags, then exposes
// window.setTime(t) for the capture harness.
import { setup } from '/scenes/web/lib/squares.js';

export const W = 1080, H = 1920;

export async function boot() {
  const q = new URLSearchParams(location.search);
  const id = q.get('scene');
  const [data, world] = await Promise.all([
    fetch(`/renders/cache/scenes/${id}.json`, { cache: 'no-store' }).then(r => r.json()),
    fetch('/data/countries.json', { cache: 'no-store' }).then(r => r.json()),
  ]);
  const canvas = document.getElementById('c');
  await document.fonts.load("800 40px 'Inter'");
  await document.fonts.load("600 40px 'Inter'");
  await document.fonts.ready;
  const sc = await setup({ canvas, data, world, W, H });
  window.sceneDuration = data.timing.duration;
  window.setTime = async (t) => { sc.draw(t); return true; };
  window.glInfo = 'canvas 2d';
  window.selfTest = () => null;
  window.probe = (t) => sc.probe ? sc.probe(t) : null;
  await window.setTime(0);
  window.ready = true;
  if (q.get('preview')) {                       // a normal browser: play in real time
    const t0 = performance.now();
    const loop = () => { sc.draw(((performance.now() - t0) / 1000) % data.timing.duration); requestAnimationFrame(loop); };
    loop();
  }
}
