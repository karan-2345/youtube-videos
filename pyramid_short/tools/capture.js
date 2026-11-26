// tools/capture.js -- render the scene frame-exactly with headless Chromium (Linux port of the chess Short's capture).
//
//   node tools/capture.js stills 0 3.5 20          PNG stills -> renders/stills/
//   node tools/capture.js render --workers 3        full render -> renders/scene.mp4
//   node tools/capture.js range f0 f1 out.mp4       (one worker)
//
// Each frame: window.setTime(frame / fps) -> CDP screenshot (PNG) -> ffmpeg stdin (x264 CRF 12, BT.709).
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCENE = JSON.parse(fs.readFileSync(path.join(ROOT, 'renders/cache/scene.json'), 'utf8'));
const FPS = SCENE.fps, FRAMES = SCENE.frames;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.ttf': 'font/ttf', '.png': 'image/png' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, resp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(p, (err, buf) => {
        if (err) { resp.writeHead(404); resp.end(); return; }
        resp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        resp.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function open() {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`    [page ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`    [page exception] ${e}`));
  await page.goto(`http://127.0.0.1:${srv.address().port}/scenes/web/player.html?${process.env.Q || ''}`);
  await page.waitForFunction('window.ready === true || window.bootError !== undefined', null, { timeout: 300000 });
  const err = await page.evaluate('window.bootError');
  if (err) throw new Error(`scene failed to boot:\n${err}`);
  const cdp = await page.context().newCDPSession(page);
  return { srv, browser, page, cdp };
}

async function shot(cdp) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(r.data, 'base64');
}

const STEP = Number(process.env.STEP || 1);          // preview: every STEP-th frame, encoded at FPS / STEP
function encoder(out) {
  return spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS / STEP), '-f', 'image2pipe', '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium',
    '-crf', '12', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS / STEP), out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
}

async function stills(times) {
  const { srv, browser, page, cdp } = await open();
  const dir = path.join(ROOT, 'renders/stills');
  fs.mkdirSync(dir, { recursive: true });
  console.log(`  renderer: ${await page.evaluate('window.glInfo')}`);
  for (const t of times) {
    const t0 = Date.now();
    await page.evaluate(`window.setTime(${t})`);
    const png = await shot(cdp);
    const f = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, png);
    console.log(`  ${path.relative(ROOT, f)}  (${Date.now() - t0} ms)`);
  }
  await browser.close(); srv.close();
}

async function range(f0, f1, out) {
  const { srv, browser, page, cdp } = await open();
  const ff = encoder(out);
  const t0 = Date.now();
  for (let f = f0; f < f1; f += STEP) {
    await page.evaluate(`window.setTime(${f / FPS})`);
    const png = await shot(cdp);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % (100 * STEP) === 99 * STEP) {
      const rate = (f - f0 + 1) / ((Date.now() - t0) / 1000);
      console.log(`    worker ${f0}-${f1}: ${f - f0 + 1}/${f1 - f0} (${rate.toFixed(2)} fps)`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close(); srv.close();
}

async function render(workers, f0 = 0, f1 = FRAMES) {
  const segDir = path.join(ROOT, 'renders/frames');
  fs.mkdirSync(segDir, { recursive: true });
  const n = f1 - f0;
  const bounds = Array.from({ length: workers + 1 }, (_, i) => f0 + Math.round(i * n / workers));
  const segs = [];
  const t0 = Date.now();
  console.log(`  ${n} frames on ${workers} workers`);
  await Promise.all(Array.from({ length: workers }, (_, i) => new Promise((res, rej) => {
    const seg = path.join(segDir, `seg${String(i).padStart(2, '0')}.mp4`);
    segs.push(seg);
    const p = spawn(process.execPath, [__filename, 'range', String(bounds[i]), String(bounds[i + 1]), seg], { stdio: 'inherit' });
    p.on('close', (c) => (c ? rej(new Error(`worker ${i} failed`)) : res()));
  })));
  segs.sort();
  const list = path.join(segDir, 'segments.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s}'\n`).join(''));
  const out = path.join(ROOT, process.env.OUT || 'renders/scene.mp4');
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out],
    { stdio: 'inherit' }).on('close', (c) => (c ? rej(new Error('concat failed')) : res())));
  const dt = (Date.now() - t0) / 1000;
  console.log(`  -> ${path.relative(ROOT, out)}  (${dt.toFixed(0)} s wall, ${(n / dt).toFixed(2)} frames/s)`);
}

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === 'stills') await stills(a.map(Number));
  else if (cmd === 'bench') {
    const { srv, browser, page, cdp } = await open();
    for (const t of a.map(Number)) {
      let t0 = Date.now();
      await page.evaluate(`window.setTime(${t})`);
      const t1 = Date.now();
      await page.evaluate(`new Promise(r => requestAnimationFrame(() => r()))`);
      const t2 = Date.now();
      const png = await shot(cdp);
      const t3 = Date.now();
      const r2 = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 100, optimizeForSpeed: true });
      const t4 = Date.now();
      console.log(`  t=${t}: setTime ${t1 - t0} ms, raf ${t2 - t1} ms, png ${t3 - t2} ms (${png.length >> 10} KB), jpeg ${t4 - t3} ms`);
    }
    await browser.close(); srv.close();
  }
  else if (cmd === 'eval') {                       // node tools/capture.js eval <t> "<js expression>"
    const { srv, browser, page } = await open();
    await page.evaluate(`window.setTime(${Number(a[0])})`);
    console.log(JSON.stringify(await page.evaluate(a[1]), null, 1));
    await browser.close(); srv.close();
  }
  else if (cmd === 'range') await range(Number(a[0]), Number(a[1]), a[2]);
  else if (cmd === 'render') {
    const w = a.includes('--workers') ? Number(a[a.indexOf('--workers') + 1]) : 3;
    await render(w);
  } else throw new Error('usage: stills | render | range');
})().catch((e) => { console.error(e); process.exit(1); });
