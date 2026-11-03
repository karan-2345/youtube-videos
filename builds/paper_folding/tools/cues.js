// tools/cues.js -- dry pass over every frame (no rendering): records the sound cues the shots emit -> cache/cues.json
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(r); });
srv.listen(0, '127.0.0.1', async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await pg.goto(`http://127.0.0.1:${srv.address().port}/scenes/player.html`);
  await pg.waitForFunction('window.ready === true || window.bootError !== undefined', null, { timeout: 300000 });
  const cues = await pg.evaluate(async () => {
    window.DRY = true; const d = (await (await fetch('/cache/data.json')).json()).duration;
    for (let f = 0; f < Math.round(d * 60); f++) await window.setTime(f / 60);
    return window.__cues || [];
  });
  fs.writeFileSync(path.join(ROOT, 'cache/cues.json'), JSON.stringify(cues, null, 0));
  console.log(`${cues.length} cues -> cache/cues.json`);
  await b.close(); srv.close();
});
