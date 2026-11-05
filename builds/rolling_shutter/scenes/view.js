// scenes/view.js -- a generic rolling-shutter view of any scene (street, phone camera, guitar).
// pose(ts) sets the scene to scene time ts; a pass is { T (sweep s), t0, key }; row r is read at t0 + r / rows * T.
import * as THREE from 'three';
import { rtFloat, captureRows } from './engine.js';

export class View {
  // capRect in view px (x, y, w, h); view = [vw, vh] (the camera's full frame in px)
  constructor(renderer, comp, { scene, cam, capRect, view, pose, movingLayer = null, ss = 2, liveSamples = 4 }) {
    Object.assign(this, { r: renderer, comp, scene, cam, capRect, view, pose, movingLayer, ss });
    this.capCam = cam.clone();
    this.rows = capRect[3];
    this.rtLive = rtFloat(view[0], view[1], liveSamples);
    this.rtMove = movingLayer !== null ? rtFloat(view[0], view[1], liveSamples) : null;
    this.caps = new Map();
    this.empty = rtFloat(4, 4, 0);
  }
  syncCam() {
    this.cam.updateMatrixWorld(true);
    this.capCam.copy(this.cam);
    // the camera may be a child (the phone's camera): use its world transform
    this.cam.matrixWorld.decompose(this.capCam.position, this.capCam.quaternion, this.capCam.scale);
    const [vw, vh] = this.view, [x, y, w, h] = this.capRect;
    this.capCam.setViewOffset(vw, vh, x, y, w, h);
    this.capCam.layers.enableAll();
  }
  capture(pass) {
    const key = JSON.stringify(pass);
    if (this.caps.has(key)) return this.caps.get(key);
    let rt;
    if (this.caps.size >= 3) { const [k0, v0] = this.caps.entries().next().value; this.caps.delete(k0); rt = v0; }
    else rt = rtFloat(this.capRect[2] * this.ss, this.capRect[3] * this.ss, 0);
    this.pose(pass.t0, pass);
    this.syncCam();
    this.r.setClearColor(0x000000, 0);
    captureRows(this.r, { scene: this.scene, camera: this.capCam, rt, rows: this.rows, ss: this.ss,
      setState: (ts) => this.pose(ts, pass), timeOfRow: (row) => pass.t0 + row / this.rows * pass.T });
    this.caps.set(key, rt);
    return rt;
  }
  renderLive(ts, pass) {
    this.pose(ts, pass);
    this.cam.layers.enableAll();
    this.r.setRenderTarget(this.rtLive); this.r.setClearColor(0x000000, 1); this.r.clear(); this.r.render(this.scene, this.cam);
    if (this.rtMove) {
      this.cam.layers.set(this.movingLayer);
      const bgc = this.scene.background; this.scene.background = null;
      this.r.setRenderTarget(this.rtMove); this.r.setClearColor(0x000000, 0); this.r.clear(); this.r.render(this.scene, this.cam);
      this.scene.background = bgc;
      this.cam.layers.enableAll();
    }
  }
  // o: { pass, ts (live), scan, prev, line, ghost, amberLen, outside, disp, capGain }
  draw(o, target = null, screen = null) {
    this.renderLive(o.ts, o.pass);
    const cap = o.pass && o.scan > 0 ? this.capture(o.pass) : null;
    const prev = o.prev ? this.capture(o.prev) : null;
    const [vw, vh] = this.view;
    this.comp.draw({
      tBg: this.rtLive.texture, tProp: this.rtMove ? this.rtMove.texture : this.empty.texture,
      tCap: cap ? cap.texture : null, tPrev: prev ? prev.texture : null,
      capRect: this.capRect, rows: this.rows, scan: o.scan ?? 0, showLine: o.line ?? 1, belowGain: 1, ghost: o.ghost ?? 0, live: 0,
      amberLen: o.amberLen ?? 1e6, amberAmt: o.amberAmt ?? 1, prevAmber: o.prevAmber ?? 0, capGain: o.capGain ?? 1,
      exposure: o.exposure ?? 1, linearOut: o.linearOut ?? 0, prevGain: o.prevGain ?? 1, outGain: o.outGain ?? 1, outside: o.outside ?? 1, view: [vw, vh], screen: screen || [vw, vh],
      disp: o.disp || [vw / 2, vh / 2, 1, 1], dispView: o.dispView || [vw / 2, vh / 2], lineW: o.lineW ?? 3,
    }, target, o.clear ?? true);
  }
}
