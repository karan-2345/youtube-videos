import {staticFile} from 'remotion';

export const FONT = 'InterXB';
export const FONT_STACK = `${FONT}, Inter, sans-serif`;

// Inter ExtraBold (800), bundled locally so renders never depend on the network.
let promise: Promise<void> | null = null;
export const loadInter = () => {
  if (!promise) {
    const face = new FontFace(FONT, `url(${staticFile('fonts/Inter-ExtraBold.otf')})`, {weight: '800'});
    const img = (src: string) =>
      new Promise<void>((res) => {
        const i = new Image();
        i.onload = () => res();
        i.onerror = () => res();
        i.src = staticFile(src);
      });
    promise = Promise.all([
      face.load().then((f) => {
        (document.fonts as unknown as {add: (x: FontFace) => void}).add(f);
      }),
      img('fx/disp.png'),
    ]).then(() => undefined);
  }
  return promise;
};

const cvs = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const cache = new Map<string, number>();
// Width of `text` at 1px font size (letter-spacing -0.02em included).
export const measure1 = (text: string) => {
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const ctx = cvs!.getContext('2d')!;
  ctx.font = `800 100px ${FONT}`;
  const w = (ctx.measureText(text).width - 0.02 * 100 * text.length) / 100;
  cache.set(text, w);
  return w;
};
