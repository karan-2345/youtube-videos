// tools/glinfo.js -- which WebGL renderer headless Chromium reports here
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  console.log(await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info');
    return { renderer: g.getParameter(e.UNMASKED_RENDERER_WEBGL), vendor: g.getParameter(e.UNMASKED_VENDOR_WEBGL), maxTex: g.getParameter(g.MAX_TEXTURE_SIZE),
      floatRT: !!g.getExtension('EXT_color_buffer_float'), samples: g.getParameter(g.MAX_SAMPLES), ua: navigator.userAgent }; }));
  await b.close();
})();
