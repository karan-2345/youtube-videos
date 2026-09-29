// Frame driver.
//   node web/render.mjs stills 1.0,9.5,17 renders/stills         -> PNG stills
//   node web/render.mjs video <startFrame> <endFrame> <out.mp4>  -> frames piped to ffmpeg (60 fps)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from './node_modules/playwright-core/index.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FPS = 60;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function open(srv) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/web/index.html`);
  await page.waitForFunction(() => window.READY === true || window.BOOT_ERROR, null, { timeout: 120000 });
  const bootErr = await page.evaluate(() => window.BOOT_ERROR);
  if (bootErr) throw new Error(bootErr);
  const cdp = await page.context().newCDPSession(page);
  return { browser, page, cdp, errors };
}

async function grab(cdp) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
  return Buffer.from(data, 'base64');
}

const [mode, a, b, c] = process.argv.slice(2);
const srv = await serve();
const { browser, page, cdp, errors } = await open(srv);
try {
  if (mode === 'stills') {
    const times = a.split(',').map(Number);
    const out = path.resolve(ROOT, b || 'renders/stills');
    fs.mkdirSync(out, { recursive: true });
    for (const t of times) {
      await page.evaluate(t => window.renderFrame(t), t);
      fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`), await grab(cdp));
    }
    console.log(`stills: ${times.length} -> ${out}`);
  } else if (mode === 'video') {
    const f0 = Number(a), f1 = Number(b), out = path.resolve(ROOT, c);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      await page.evaluate(t => window.renderFrame(t), f / FPS);
      const buf = await grab(cdp);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 300 === 0) console.log(`frame ${f} (${((Date.now() - t0) / 1000 / Math.max(1, f - f0)).toFixed(3)} s/frame)`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log(`done ${f0}-${f1} in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${out}`);
  }
  if (errors.length) console.log('page errors:', errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
  srv.close();
}
