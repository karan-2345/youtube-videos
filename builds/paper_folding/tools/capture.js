// tools/capture.js -- frame-exact capture of scenes/player.html in headless Chromium.
//   node tools/capture.js <f0> <f1> <out.mp4|dir-for-pngs> [--png t1,t2,...]
// Each frame: await window.setTime(f / FPS) -> CDP Page.captureScreenshot (PNG) -> ffmpeg stdin (x264 CRF 12).
// Every pixel is a pure function of t (no requestAnimationFrame, no clock), so workers can split the frame range.
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const ROOT = path.resolve(__dirname, '..');
const FPS = 60, W = 1080, H = 1920;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.css': 'text/css', '.png': 'image/png' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function open() {
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--force-color-profile=srgb', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`  [page ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`  [page exception] ${e}`));
  await page.goto(`http://127.0.0.1:${srv.address().port}/scenes/player.html`);
  await page.waitForFunction('window.ready === true || window.bootError !== undefined', null, { timeout: 300000 });
  const err = await page.evaluate('window.bootError');
  if (err) throw new Error('boot failed: ' + err);
  const cdp = await page.context().newCDPSession(page);
  const shot = async () => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true })).data, 'base64');
  return { srv, browser, page, shot };
}

(async () => {
  const [f0, f1, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
  const pngIdx = process.argv.indexOf('--png');
  const { srv, browser, page, shot } = await open();
  if (pngIdx > 0) {                         // stills: --png t1,t2 (seconds)
    fs.mkdirSync(out, { recursive: true });
    console.log('  renderer:', await page.evaluate('window.glInfo'));
    for (const t of process.argv[pngIdx + 1].split(',').map(Number)) {
      await page.evaluate((x) => window.setTime(x), t);
      const f = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(f, await shot());
      console.log('  ' + f);
    }
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-f', 'image2pipe', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '12',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      await page.evaluate((x) => window.setTime(x), f / FPS);
      const png = await shot();
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((f - f0) % 120 === 119) console.log(`  worker ${f0}-${f1}: ${f - f0 + 1}/${f1 - f0} (${((f - f0 + 1) / ((Date.now() - t0) / 1000)).toFixed(2)} fps)`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
  }
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
