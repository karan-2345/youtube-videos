// scenes/studio.js -- the propeller studio as a "view": cached backdrop, a live rotor layer (the ghost), cached captures.
//
// A pass is one rolling-shutter exposure: { k, rate, phase, blades, mask }.
//   sweep time T = k / rate (k = turns per sweep, the one shape parameter), row r is read at t(r) = r / rows * T,
//   and the rotor angle at scene time t is 2*pi*rate*t + phase. Nothing else decides the shape.
import * as THREE from 'three';
import { W, H, SAFE, makeStudio, rtFloat, captureRows } from './engine.js';

export const ROWS = SAFE.h;                 // sensor rows: the middle 3:4, y 240..1680
export const HUB_Y = 760;                    // hub on screen
const PROP_LAYER = 1;

export class Studio {
  constructor(renderer, env, comp) {
    this.r = renderer; this.comp = comp;
    const st = makeStudio(env);
    Object.assign(this, st);
    this.prop.userData.rotor.layers.set(PROP_LAYER);
    this.cam = new THREE.PerspectiveCamera(30, W / H, 0.5, 60);
    const unitPx = H / (2 * 7.6 * Math.tan(15 * Math.PI / 180));        // px per world unit at the rotor plane
    this.unitPx = unitPx;
    const dy = (HUB_Y - H / 2) / unitPx;   // world units; screen y grows downward
    this.cam.position.set(0, dy, 7.6); this.cam.lookAt(0, dy, 0);          // dy < 0: camera below the hub, so the hub sits above centre
    this.capCam = this.cam.clone(); this.capCam.setViewOffset(W, H, SAFE.x, SAFE.y, SAFE.w, SAFE.h);
    this.capCam.layers.enableAll();
    this.rtBg = rtFloat(W, H, 4); this.rtProp = rtFloat(W, H, 4);
    this.bgKey = null;
    this.caps = new Map();
    this.R_PX = unitPx;                      // rotor radius (1 unit) in px
  }
  pose(pass, ts) {
    const p = this.prop;
    p.setBlades(pass.blades ?? 3);
    const m = pass.mask || [1, 1, 1];
    p.setMask(m[0], m[1], m[2], pass.hubMask ?? 0);
    p.spin(2 * Math.PI * pass.rate * ts + (pass.phase || 0));
  }
  T(pass) { return pass.k / pass.rate; }
  timeOfRow(pass, r) { return r / ROWS * this.T(pass) + (pass.t0 || 0); }
  // the photo: every row rendered at its own moment (cached: a pass is a pure function of its parameters)
  capture(pass) {
    const key = JSON.stringify(pass);
    if (this.caps.has(key)) { const v = this.caps.get(key); this.caps.delete(key); this.caps.set(key, v); return v; }
    let rt;
    if (this.caps.size >= (pass.volatile ? 2 : 5)) { const [k0, v0] = this.caps.entries().next().value; this.caps.delete(k0); rt = v0; }
    else rt = rtFloat(SAFE.w * 2, SAFE.h * 2, 0);
    this.r.setClearColor(0x000000, 0);
    captureRows(this.r, { scene: this.scene, camera: this.capCam, rt, rows: ROWS, ss: 2,
      setState: (ts) => this.pose(pass, ts), timeOfRow: (row) => pass.debugStep ? (row < pass.debugStep ? 0.25 / pass.rate : 0) : this.timeOfRow(pass, row) });
    this.caps.set(key, rt);
    return rt;
  }
  renderBg() {
    const key = this.cam.matrixWorld.elements.join(',');
    if (this.bgKey === key) return;
    this.cam.layers.set(0);
    this.r.setRenderTarget(this.rtBg); this.r.setClearColor(0x000000, 1); this.r.clear(); this.r.render(this.scene, this.cam);
    this.cam.layers.enableAll();
    this.bgKey = key;
  }
  // the live rotor at scene time ts (alpha = mask x coverage)
  renderLive(pass, ts, blades = null, mask = null) {
    this.pose({ ...pass, blades: blades ?? pass.blades, mask: mask ?? pass.mask }, ts);
    this.cam.layers.set(PROP_LAYER);
    this.back.visible = false;
    this.r.setRenderTarget(this.rtProp); this.r.setClearColor(0x000000, 0); this.r.clear(); this.r.render(this.scene, this.cam);
    this.back.visible = true;
    this.cam.layers.enableAll();
  }
  // the studio seen from another camera (no rolling shutter): the true propeller, live
  drawFrom(cam, rt, pass, ts, o = {}) {
    this.pose(pass, ts);
    cam.layers.enableAll();
    this.r.setRenderTarget(rt); this.r.setClearColor(0x000000, 1); this.r.clear(); this.r.render(this.scene, cam);
    this.comp.draw({ tBg: rt.texture, tProp: this.rtProp.texture, tCap: null, showLine: 0, outGain: o.gain ?? 1, exposure: o.exposure ?? 1 },
      this.target ?? null, o.clear ?? true);
  }
  // one frame of the studio view. o: { pass, scan (rows), ghostTs, ghost, live, belowGain, amberLen, amberAmt, prev (pass), line, disp }
  draw(o, target = null) {
    this.renderBg();
    const pass = o.pass;
    const ts = o.ghostTs ?? (pass ? this.timeOfRow(pass, o.scan ?? 0) : 0);
    this.renderLive(o.livePass || pass, ts, o.liveBlades, o.liveMask);
    const cap = pass && o.scan > 0 ? this.capture(pass) : null;
    const prev = o.prev ? this.capture(o.prev) : null;
    this.comp.draw({
      tBg: this.rtBg.texture, tProp: this.rtProp.texture, tCap: cap ? cap.texture : null, tPrev: prev ? prev.texture : null,
      capRect: [SAFE.x, SAFE.y, SAFE.w, SAFE.h], rows: ROWS, scan: o.scan ?? 0, showLine: o.line ?? 1,
      belowGain: o.belowGain ?? 1, ghost: o.ghost ?? 0, live: o.live ?? 0, amberLen: o.amberLen ?? 1e6, amberAmt: o.amberAmt ?? 1,
      prevAmber: o.prevAmber ?? 1, track: o.track ?? 0,
      exposure: o.exposure ?? 1, cut: o.cut ?? 0, prevGain: o.prevGain ?? 1, outside: o.outside ?? 1, disp: o.disp || [540, 960, 1, 1], dispView: o.dispView || [540, 960], capGain: o.capGain ?? 1,
    }, target ?? this.target ?? null, o.clear ?? true);
  }
}
