// scenes/universe.js -- one true-scale world, from a sheet of paper on a floor to the Milky Way (S00, S05, the loop).
//
// Every position is kept in metres in JS doubles. Each render puts the camera at the origin and moves/scales every
// object by (P - eye) / D, where D is the camera's distance to what it looks at, so float32 on the GPU only ever sees
// numbers near 1 (a floating origin plus a floating scale). A logarithmic depth buffer covers the rest.
// Objects too small to see (the stack at 400,000 km, the strip at 10^21 m) are also drawn as lines of a minimum pixel
// width, so they stay visible without ever being drawn bigger than they are where they are big enough to see.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { PAL, clamp01, lerp, ramp, rng, floorTexture, cloudTexture, layerTexture, Folder, hand, roll, ease } from './lib.js';

const LY = 9.4607304725808e15;

export class Universe {
  constructor(renderer, F, table) {
    this.F = F; this.table = table;
    const R_E = F.EARTH_R_M;
    this.P = {
      earth: [0, -R_E, 0],
      moon: [-6.0e6, Math.sqrt(F.MOON_M ** 2 - 6.0e6 ** 2) - R_E, 0],   // beside the stack, 384,400 km from Earth's centre
      sun: [2.4e10, F.AU_M, 0],                                          // beside the strip, 1 AU out along it
      galaxy: [0, 26000 * LY, 0],                                         // the Sun sits ~26,000 ly from the centre; the disc faces the camera
    };
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1080 / 1920, 1e-5, 1e12);

    // ---- local: the floor, the paper, the lamp, the clouds (a group in metres around the fold site)
    const L = this.local = new THREE.Group(); s.add(L);
    const ftex = floorTexture(); ftex.repeat.set(30, 30);
    this.floorMat = new THREE.MeshStandardMaterial({ color: PAL.floor, roughness: 0.92, bumpMap: ftex, bumpScale: 0.08, transparent: true });
    this.floor = new THREE.Mesh(new THREE.RingGeometry(1e-4, 1, 128, 80).rotateX(-Math.PI / 2), this.floorMat);
    this.floor.receiveShadow = true; L.add(this.floor);
    { // the floor fades out towards its rim, so it never ends in a hard edge
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, '#fff'); g.addColorStop(0.45, '#fff'); g.addColorStop(1, '#000');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256); this.floorMat.alphaMap = new THREE.CanvasTexture(c);
    }
    this.ftex = ftex;
    this.ltex = layerTexture();
    this.folder = new Folder(L, { a: 0.297, b: 0.210, t: F.T, tex: this.ltex, maxFolds: 8 });
    const s7 = this.folder.states[7];
    this.s7 = s7;
    this.col = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [0, 0, 0, 0, 0, 0].map((_, i) => (i === 2 || i === 3)
      ? new THREE.MeshStandardMaterial({ color: PAL.paper, roughness: 0.82 })
      : new THREE.MeshStandardMaterial({ color: 0xffffff, map: this.ltex.clone(), roughness: 0.9 })));
    this.col.material[0].map.needsUpdate = true;
    for (let i of [1, 4, 5]) this.col.material[i] = this.col.material[0];
    this.col.castShadow = true; this.col.receiveShadow = false; L.add(this.col);

    // the end of the Short: a hand on a roll of toilet paper, its strip running away down a long corridor
    this.endRoll = roll(); this.endRoll.position.set(-0.55, this.endRoll.userData.R, 0.12); L.add(this.endRoll);
    this.endHand = hand(); this.endHand.position.set(-0.585, 2 * this.endRoll.userData.R, 0.125);
    this.endHand.rotation.set(0, 0.5, 0); L.add(this.endHand);
    this.endStrip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: PAL.paper, roughness: 0.88 }));
    this.endStrip.receiveShadow = true; L.add(this.endStrip);
    this.endWalls = [];
    for (const z of [-1.3, 1.5]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(80, 2.6, 0.08), new THREE.MeshStandardMaterial({ color: 0x1d1c1a, roughness: 0.95 }));
      w.position.set(-0.6 - 40 - 1.2, 1.3, z); w.receiveShadow = true; L.add(w); this.endWalls.push(w);
    }
    for (const w of this.endWalls) w.visible = false;
    this.endGroup = [this.endRoll, this.endHand, this.endStrip];

    this.clouds = [];
    const r = rng(11), ctex = [cloudTexture(3), cloudTexture(5), cloudTexture(9)];
    for (let i = 0; i < 90; i++) {
      const m = new THREE.SpriteMaterial({ map: ctex[i % 3], transparent: true, depthWrite: false, color: 0xd9d6d0, opacity: 0 });
      const sp = new THREE.Sprite(m);
      const a = r() * Math.PI * 2, rad = 250 + Math.pow(r(), 0.7) * 16000;
      const size = 500 + r() * 2600;
      sp.position.set(Math.cos(a) * rad, 1800 + r() * 900, Math.sin(a) * rad);
      sp.scale.set(size, size * 0.42, 1);
      sp.userData.base = 0.55 + 0.4 * r();
      L.add(sp); this.clouds.push(sp);
    }

    // lamp (close shots), key light (the column in the sky), the Sun (planets)
    this.spot = new THREE.SpotLight(0xfff1e0, 0, 0, 0.62, 0.85, 0);
    this.spot.castShadow = true; this.spot.shadow.mapSize.set(2048, 2048); this.spot.shadow.bias = -0.0002;
    this.spot.shadow.normalBias = 0.0;
    L.add(this.spot); L.add(this.spot.target);
    this.spotLocal = [-0.75, 1.55, 0.95];
    this.key = new THREE.DirectionalLight(0xfff3e6, 0); s.add(this.key); s.add(this.key.target);
    this.fill = new THREE.HemisphereLight(0xcfd6e0, 0x141210, 0.0); s.add(this.fill);
    this.sunLight = new THREE.DirectionalLight(0xfff6ec, 0); s.add(this.sunLight); s.add(this.sunLight.target);

    // ---- planets
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120),
      new THREE.MeshStandardMaterial({ color: 0x33414f, roughness: 0.85 }));
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshStandardMaterial({ color: 0x9c9993, roughness: 0.95, bumpMap: ftex, bumpScale: 2 }));
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: 0xfff2dc }));
    s.add(this.earth, this.moon, this.sun);
    const dotMat = (c) => new THREE.PointsMaterial({ color: c, size: 7, sizeAttenuation: false, transparent: true, depthWrite: false });
    const dot = (c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)); const p = new THREE.Points(g, dotMat(c)); s.add(p); return p; };
    this.dots = { earth: dot(0x7d93a8), moon: dot(0xcfccc6), sun: dot(0xfff2dc) };

    // ---- the Milky Way: a barred spiral of points in the floor plane (xz), 100,000 ly across
    this.galaxy = this._galaxy(); s.add(this.galaxy);

    // ---- min-width lines: the stack and the strip
    const line = (color, w) => {
      const g = new LineGeometry(); g.setPositions([0, 0, 0, 1, 0, 0]);
      const m = new LineMaterial({ color, linewidth: w, transparent: true, opacity: 1, depthWrite: false, worldUnits: false });
      const l = new Line2(g, m); l.frustumCulled = false; l.renderOrder = 3; s.add(l); return l;
    };
    this.stackLine = line(0xf1eee7, 5);
    this.stripLine = line(0xf1eee7, 5);
    this.state = { n: 0, strip: 0, stripTip: 0, end: 0, cloud: 1, galaxyOp: 1 };
    this.scene.fog = new THREE.Fog(PAL.bg, 1e9, 2e9);       // in units of D: the floor falls off into the dark, close up only
  }

  _galaxy() {
    const r = rng(42), N = 420000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / Math.sqrt(0.5); };
    for (let i = 0; i < N; i++) {
      let x, z, y, c;
      const kind = r();
      if (kind < 0.1) {                    // bulge and bar
        const a = 0.44;                     // bar angle
        const bx = gauss() * 5200, bz = gauss() * 1900;
        x = bx * Math.cos(a) - bz * Math.sin(a); z = bx * Math.sin(a) + bz * Math.cos(a); y = gauss() * 900;
        c = [0.5, 0.45, 0.38];
      } else if (kind < 0.86) {             // four arms (two major) on log spirals
        const arm = Math.floor(r() * 4), major = arm % 2 === 0;
        const rr = 4500 + Math.pow(r(), major ? 0.85 : 1.1) * 46000;
        const pitch = 0.22, th = Math.log(rr / 4500) / Math.tan(pitch) + arm * Math.PI / 2 + 0.44;
        const spread = (major ? 900 : 1300) + rr * 0.045;
        x = rr * Math.cos(th) + gauss() * spread; z = rr * Math.sin(th) + gauss() * spread; y = gauss() * 350;
        const w = 0.78 + 0.22 * r();
        c = [0.86 * w, 0.89 * w, 0.95 * w];
      } else {                              // the disc between the arms
        const rr = Math.pow(r(), 0.6) * 50000, th = r() * Math.PI * 2;
        x = rr * Math.cos(th); z = rr * Math.sin(th); y = gauss() * 400;
        c = [0.75, 0.74, 0.72];
      }
      pos.set([x, z, y], i * 3); col.set(c, i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Points(g, m); p.frustumCulled = false;
    return p;
  }

  stack(n) { return this.F.T * Math.pow(2, n); }
  gallivan(n) { return Math.PI * this.F.T / 6 * (Math.pow(2, n) + 4) * (Math.pow(2, n) - 1); }

  /** view = { target:[x,y,z] m, D: m, az, el (rad), fov }; vp = [x, y, w, h] pixels (bottom-left origin). */
  render(renderer, view, vp = [0, 0, 1080, 1920]) {
    const st = this.state, F = this.F, D = view.D;
    const tg = view.target, ce = Math.cos(view.el);
    const eye = [tg[0] + D * ce * Math.sin(view.az), tg[1] + D * Math.sin(view.el), tg[2] + D * ce * Math.cos(view.az)];
    const k = 1 / D;
    const rel = (p) => [(p[0] - eye[0]) * k, (p[1] - eye[1]) * k, (p[2] - eye[2]) * k];
    const cam = this.camera;
    cam.aspect = vp[2] / vp[3]; cam.fov = view.fov || 34; cam.updateProjectionMatrix();
    if (view.shiftY) cam.setViewOffset(vp[2], vp[3], 0, -view.shiftY, vp[2], vp[3]); else cam.clearViewOffset();
    cam.position.set(0, 0, 0); cam.up.set(0, 1, 0); cam.lookAt(...rel(tg)); cam.updateMatrixWorld();
    const pxPerRad = (vp[3] / 2) / Math.tan(cam.fov * Math.PI / 360);
    const pxSize = (R, p) => { const q = rel(p); return R * k / Math.hypot(...q) * pxPerRad; };

    // local group
    this.local.position.set(...rel([0, 0, 0])); this.local.scale.setScalar(k);
    const fr = Math.min(80 * D, 3e5);
    this.floor.scale.setScalar(fr); this.floor.position.set(tg[0], -Math.min(2e-4 * D, 0.5), tg[2]);
    this.ftex.repeat.set(fr / 0.6, fr / 0.6);
    this.floorMat.opacity = 1 - ramp(D, 1.2e4, 4e4);
    this.floor.visible = this.floorMat.opacity > 0.002;

    // the paper: folds 0-7 as hinged halves, then a column growing as 0.1 mm x 2^n
    const n = st.n;
    if (n <= 7) {
      this.folder.group.visible = true; this.col.visible = false;
      this.folder.set(n, { lift: st.lift || 0 });
    } else {
      this.folder.group.visible = false; this.col.visible = true;
      const h = this.stack(n), s7 = this.s7;
      this.col.scale.set(s7.x1 - s7.x0, h, s7.z1 - s7.z0);
      this.col.position.set((s7.x0 + s7.x1) / 2, h / 2, (s7.z0 + s7.z1) / 2);
      this.col.material[0].map.repeat.set(1, Math.min(Math.pow(2, n), 4096));
    }
    const top = n <= 7 ? this.folder.centre(n)[1] * 2 : this.stack(n);
    const cxz = n <= 7 ? this.folder.centre(n) : [(this.s7.x0 + this.s7.x1) / 2, 0, (this.s7.z0 + this.s7.z1) / 2];
    // stack line where the column is thinner than ~5 px
    const colPx = pxSize(0.013, [cxz[0], top / 2, cxz[2]]);
    this.stackLine.geometry.setPositions([...rel([cxz[0], 0, cxz[2]]), ...rel([cxz[0], top, cxz[2]])]);
    this.stackLine.material.opacity = (st.stackLine ?? 1) * clamp01((4 - colPx) / 3) * (n > 7 ? 1 : 0);
    this.stackLine.visible = this.stackLine.material.opacity > 0.003;

    // the strip, measured out from the fold site straight up beside the stack (a line: it is only 21 cm wide)
    const sl = st.strip, sx = st.stripX ?? 0.06;
    this.stripLine.geometry.setPositions([...rel([sx, 0, 0]), ...rel([sx, Math.max(sl, 1e-6), 0])]);
    this.stripLine.material.opacity = sl > 0 ? (st.stripOp ?? 1) : 0;
    this.stripLine.visible = this.stripLine.material.opacity > 0.003;
    for (const l of [this.stackLine, this.stripLine]) { l.material.resolution.set(vp[2], vp[3]); l.computeLineDistances(); }

    // end props (the loop): visible only when asked
    for (const o of this.endGroup) o.visible = st.end > 0;
    if (st.end > 0) {
      const len = st.endStrip ?? 40;
      this.endStrip.scale.set(len, 1, 0.105); this.endStrip.position.set(-0.6 - len / 2, 0.0002, 0.12);
      this.endHand.position.y = 2 * this.endRoll.userData.R - 0.004 + (st.handLift || 0);
    }

    // clouds: at about 2 km, visible while the camera is between ~300 m and ~60 km
    const cOp = st.cloud * ramp(D, 300, 1200) * (1 - ramp(D, 2.5e4, 8e4));
    for (const c of this.clouds) { c.material.opacity = cOp * c.userData.base; c.visible = cOp > 0.003; }

    // lights
    const close = 1 - ramp(Math.log10(D), Math.log10(3), Math.log10(40));
    this.spot.intensity = 5.5 * close * (st.lamp ?? 1);
    this.spot.position.set(...this.spotLocal); this.spot.target.position.set(0, 0, 0);
    this.spot.shadow.camera.near = 0.3 * k; this.spot.shadow.camera.far = 6 * k; this.spot.shadow.camera.updateProjectionMatrix();
    const mid = (1 - close) * (1 - ramp(Math.log10(D), 4, 5.5));
    this.key.intensity = 2.6 * mid + 2.0 * (st.end > 0 ? 1 : 0) * clamp01((D - 1.4) / 2);   // zero at the opening distance (1.3 m), so the loop frame matches this.key.position.set(-0.5, 0.75, 0.6); this.key.target.position.set(0, 0, 0);
    this.fill.intensity = 0.06 + 0.4 * mid;
    const far = ramp(Math.log10(D), 3.5, 5);
    this.sunLight.intensity = 3.2 * far;
    this.sunLight.position.set(0.55, 0.45, 0.7).normalize(); this.sunLight.target.position.set(0, 0, 0);

    // planets + their dots
    const place = (mesh, dot, P, R, show) => {
      const px = pxSize(R, P);
      mesh.position.set(...rel(P)); mesh.scale.setScalar(R * k); mesh.visible = show && px > 0.6;
      dot.position.set(...rel(P)); dot.material.opacity = show ? clamp01((3.2 - px) / 2) : 0; dot.visible = dot.material.opacity > 0.003;
      return px;
    };
    place(this.earth, this.dots.earth, this.P.earth, F.EARTH_R_M, D > 2.2e4);
    const eo = ramp(Math.log10(D), Math.log10(2.2e4), 4.85);            // the ground fades in under the clouds, no pop
    this.earth.material.transparent = true; this.earth.material.opacity = eo; this.earth.visible = this.earth.visible && eo > 0.002;
    place(this.moon, this.dots.moon, this.P.moon, F.MOON_R_M, D > 1e5);
    place(this.sun, this.dots.sun, this.P.sun, F.SUN_R_M, D > 1e8);
    // galaxy
    const gop = ramp(Math.log10(D), 18.3, 20.2) * (st.galaxyOp ?? 1);
    this.galaxy.position.set(...rel(this.P.galaxy)); this.galaxy.scale.setScalar(LY * k);
    this.galaxy.material.opacity = 0.26 * gop; this.galaxy.visible = gop > 0.003;

    const fogOn = 1 - ramp(Math.log10(D), 1.3, 1.8);
    this.scene.fog.near = fogOn > 0 ? 1.7 / fogOn : 1e9; this.scene.fog.far = fogOn > 0 ? 5.5 / fogOn : 2e9;
    this.view = { eye, k, vp, cam };
    if (window.DRY) return;
    renderer.setViewport(...vp); renderer.setScissor(...vp); renderer.setScissorTest(true);
    renderer.render(this.scene, cam);
    renderer.setScissorTest(false);
  }

  /** Screen position (CSS pixels, top-left origin) of a world point, after render(). */
  screen(P) {
    const { eye, k, vp, cam } = this.view;
    const v = new THREE.Vector3((P[0] - eye[0]) * k, (P[1] - eye[1]) * k, (P[2] - eye[2]) * k).project(cam);
    return { x: vp[0] + (v.x + 1) / 2 * vp[2], y: 1920 - (vp[1] + (v.y + 1) / 2 * vp[3]), front: v.z < 1 };
  }
}
