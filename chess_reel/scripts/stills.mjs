// node scripts/stills.mjs 230,400,... -> out/stills/f<frame>.png (bundles once)
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
const frames = process.argv[2].split(',').map(Number);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const composition = await selectComposition({serveUrl, id: 'Reel', browserExecutable});
for (const frame of frames) {
  await renderStill({serveUrl, composition, frame, output: `out/stills/f${frame}.png`, browserExecutable, imageFormat: 'jpeg', jpegQuality: 70});
  console.log('done', frame);
}
