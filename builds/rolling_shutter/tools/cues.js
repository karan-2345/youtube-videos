// tools/cues.js -- the sound cues the timeline declares (window.cueList) -> cache/cues.json
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require(path.resolve(__dirname, '../web/node_modules/playwright'));
const ROOT = path.resolve(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.listen(0, '127.0.0.1', async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await pg.goto(`http://127.0.0.1:${srv.address().port}/scenes/player.html`);
  await pg.waitForFunction('window.ready === true || window.bootError !== undefined', null, { timeout: 300000 });
  const cues = await pg.evaluate(() => window.cueList().sort((a, b) => a[0] - b[0]));
  fs.writeFileSync(path.join(ROOT, 'cache/cues.json'), JSON.stringify(cues));
  console.log(`${cues.length} cues -> cache/cues.json`); console.log(JSON.stringify(cues.filter((c) => c[1] !== 'tick')));
  await b.close(); srv.close();
});
