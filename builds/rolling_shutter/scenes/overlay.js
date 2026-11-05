// scenes/overlay.js -- immediate-mode type and simple vector marks over the canvas (DOM, so Inter is crisp).
// Every frame: ov.begin(); ov.text(...); ov.ring(...); ov.end() hides whatever was not drawn this frame.
const NS = 'http://www.w3.org/2000/svg';
export class Overlay {
  constructor(root, svg) { this.root = root; this.svg = svg; this.els = new Map(); this.used = new Set(); this.groups = {}; }
  group(name) {
    if (!this.groups[name]) {
      const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0;';
      const s = document.createElementNS(NS, 'svg'); s.setAttribute('width', 1080); s.setAttribute('height', 1920);
      s.style.cssText = 'position:absolute;inset:0;overflow:visible'; d.appendChild(s);
      this.root.appendChild(d); this.groups[name] = { d, s };
    }
    return this.groups[name];
  }
  begin() { this.used.clear(); for (const g of Object.values(this.groups)) g.d.style.clipPath = 'none'; }
  clip(name, y0, y1) { this.group(name).d.style.clipPath = `inset(${y0}px 0px ${1920 - y1}px 0px)`; }
  // text centred on (x, y) (y = the middle of the cap height)
  text(key, str, o = {}) { if (this.suspend) return; this._text(key, str, o); }
  _text(key, str, { x = 540, y = 960, size = 96, op = 1, color = '#f2f0ec', group = 'a', align = 'center', scale = 1 } = {}) {
    let e = this.els.get(key);
    if (!e) { e = document.createElement('div'); e.className = 't'; this.els.set(key, e); }
    const g = this.group(group);
    if (e.parentNode !== g.d) g.d.appendChild(e);
    if (e._s !== str) { e.textContent = str; e._s = str; }
    const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0%';
    e.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:auto;font-size:${size}px;opacity:${Math.max(0, Math.min(1, op))};` +
      `color:${color};transform:translate(${tx},-50%) scale(${scale});transform-origin:${align === 'center' ? '50%' : align === 'right' ? '100%' : '0%'} 50%;` +
      `white-space:nowrap;line-height:1;letter-spacing:-0.01em;`;
    e.style.display = op > 0.001 ? 'block' : 'none';
    this.used.add(key);
  }
  // a ring: track + filled arc (fraction f, clockwise from 12 o'clock)
  ring(key, o) { if (this.suspend) return; this._ring(key, o); }
  _ring(key, { x, y, r, w = 10, f = 0, op = 1, color = '#f2f0ec', track = 'rgba(242,240,236,0.16)', group = 'a' }) {
    let e = this.els.get(key);
    const g = this.group(group);
    if (!e) {
      e = document.createElementNS(NS, 'g');
      const t = document.createElementNS(NS, 'circle'), a = document.createElementNS(NS, 'path');
      t.setAttribute('fill', 'none'); a.setAttribute('fill', 'none'); a.setAttribute('stroke-linecap', 'butt');
      e.appendChild(t); e.appendChild(a); this.els.set(key, e);
    }
    if (e.parentNode !== g.s) g.s.appendChild(e);
    const [t, a] = e.childNodes;
    t.setAttribute('cx', x); t.setAttribute('cy', y); t.setAttribute('r', r); t.setAttribute('stroke', track); t.setAttribute('stroke-width', w);
    const ff = Math.max(0, Math.min(0.99999, f)), ang = ff * 2 * Math.PI;
    const ex = x + r * Math.sin(ang), ey = y - r * Math.cos(ang);
    a.setAttribute('d', ff <= 0 ? '' : `M ${x} ${y - r} A ${r} ${r} 0 ${ff > 0.5 ? 1 : 0} 1 ${ex} ${ey}`);
    a.setAttribute('stroke', color); a.setAttribute('stroke-width', w);
    e.setAttribute('opacity', Math.max(0, Math.min(1, op)));
    e.style.display = op > 0.001 ? 'inline' : 'none';
    this.used.add(key);
  }
  end() { for (const [k, e] of this.els) if (!this.used.has(k)) e.style.display = 'none'; }
}
