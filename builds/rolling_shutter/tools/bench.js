// tools/bench.js -- open the player with a query string and run window[process.env.B||'bench']() (timing of live render + capture)
const path = require('path'); const fs = require('fs'); const http = require('http');
const { chromium } = require(path.resolve(__dirname, '../web/node_modules/playwright'));
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.listen(0, '127.0.0.1', async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  pg.on('console', (m) => console.log('[page]', m.text())); pg.on('pageerror', (e) => console.log('[err]', e));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/scenes/player.html${process.argv[2] || ''}`);
  await pg.waitForFunction('window.ready === true || window.bootError !== undefined', null, { timeout: 300000 });
  for (let i = 0; i < 2; i++) console.log(await pg.evaluate((n) => window[n](), process.env.B || 'bench'));
  await b.close(); srv.close();
});
