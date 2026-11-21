// scenes/3d/lib/cut.js -- the "Cut-away" look for the tattoo Short: the stage, the forearm, the skin block cut out of
// it, the tattoo needle, the ink, the macrophages, the lab mouse, the laser and the lymph vessel, plus DOM labels.
//
// Everything is a pure function of time: the scenes (S0x_*.js) call the update helpers with t, and nothing here
// reads a clock or Math.random (rng(seed) is deterministic).
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { rng, ramp, ease, clamp01, lerp, toScreen } from '/scenes/web/runtime.js';

// ---------------------------------------------------------------- dimensions (world units)
// The block is a magnified sample: on the arm its footprint is S0 times smaller and almost flat.
export const BLK = { w: 2.6, d: 1.8, epi: 0.22, derm: 1.9, fat: 0.9 };
BLK.front = BLK.d / 2;                       // the cut face the story plays on (z = +0.9)
BLK.yEpi = -BLK.epi;                         // bottom of the outer layer
BLK.yDerm = BLK.yEpi - BLK.derm;             // bottom of the dermis
BLK.yFat = BLK.yDerm - BLK.fat;              // bottom of the block
export const ARM_R = 1.1;
export const S0 = 0.32;                      // footprint scale on the arm
export const FACE_Z = BLK.front + 0.004;     // just in front of the cut face

// The tattoo: a bold five-pointed star on the block's top (x right, z toward the viewer), one point to the back.
// Its two front points run off the cut face, so the cut face shows the ink exactly where the star's arms cross it.
export const STAR = (() => {
  const cz = 0.25, R = 1.1, r = 0.42, pts = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 5;
    const rad = k % 2 ? r : R;
    pts.push([rad * Math.cos(a), cz + rad * Math.sin(a)]);
  }
  return pts;
})();

/** x-intervals where the star crosses the line z = const (sorted [x0, x1] pairs). */
export function starSegments(z) {
  const xs = [];
  for (let i = 0; i < STAR.length; i++) {
    const [x0, z0] = STAR[i], [x1, z1] = STAR[(i + 1) % STAR.length];
    if ((z0 - z) * (z1 - z) < 0) xs.push(x0 + (x1 - x0) * (z - z0) / (z1 - z0));
  }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

/** The ink spots on the cut face: one per star arm that crosses it. */
export const SPOTS = starSegments(BLK.front).map(([x0, x1], i) => ({
  i, x: (x0 + x1) / 2, half: (x1 - x0) / 2, y: -0.92,
}));

// ---------------------------------------------------------------- small helpers
export const smooth = (t, a, b) => ramp(t, a, b, ease.inOut);
export const vec = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

function canvasTex(w, h, draw, { srgb = true, wrap = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function radialTex(inner, outer, size = 512) {
  return canvasTex(size, size, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
}

function glowTex(color, size = 256) {
  return canvasTex(size, size, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, color);
    gr.addColorStop(0.25, color + '88');
    gr.addColorStop(1, color + '00');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  });
}

/** Draw `n` copies of a shape so that a tile wraps seamlessly. */
function wrapped(g, w, h, x, y, r, fn) {
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    if (x + dx + r < 0 || x + dx - r > w || y + dy + r < 0 || y + dy - r > h) continue;
    fn(x + dx, y + dy);
  }
}

// ---------------------------------------------------------------- the stage
export function stage(renderer, pal) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight(0xfff1e6, 0x2a1712, 0.55));
  const key = new THREE.DirectionalLight(0xfff0e2, 2.4);
  key.position.set(-6, 7, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffc4a0, 2.0);
  rim.position.set(5, 3, -6);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xc4d4ff, 0.45);
  fill.position.set(6, -2, 6);
  scene.add(fill);
  // the backdrop: a soft pool of warm light behind the subject, always facing the camera
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: radialTex(pal.bg_glow, pal.bg), depthWrite: false }));
  glow.renderOrder = -10;
  scene.add(glow);
  return {
    scene,
    /** Put the glow card behind `target` as seen from the camera. */
    frame(camera, target, size = 26) {
      const dir = target.clone().sub(camera.position).normalize();
      glow.position.copy(target).addScaledVector(dir, 9);
      glow.scale.setScalar(size);
      glow.quaternion.copy(camera.quaternion);
    },
  };
}

export function makeCamera() {
  return new THREE.PerspectiveCamera(30, 1080 / 1920, 0.05, 200);
}

/** Camera poses: {p: position, t: look-at target}. Shared by the scenes so the cuts line up. */
export const CAM = {
  arm:   { p: vec(0.0, 7.6, 3.9), t: vec(0.0, -0.5, -0.45) },    // the forearm, star on top (S00 start = S03 end)
  push:  { p: vec(0.0, 4.6, 2.6), t: vec(0.0, -0.05, 0.0) },     // closer on the star, the cut
  lift:  { p: vec(0.9, 4.4, 5.6), t: vec(0.0, 0.45, 0.1) },      // the block lifted out (S00 end = S01 start)
  block: { p: vec(3.0, 2.0, 10.6), t: vec(0.0, -1.62, 0.0) },    // the cut face, three-quarter view
  spotA: { p: vec(-0.1, 0.2, 5.0), t: vec(-0.45, -0.9, 0.5) },    // close on the left ink spot
  mid:   { p: vec(1.3, 0.3, 6.3), t: vec(0.0, -1.02, 0.6) },     // both ink spots (S01 end = S02 start)
  mid2:  { p: vec(1.1, 0.1, 6.0), t: vec(0.0, -1.05, 0.6) },     // both spots, room above for the mouse inset
};

export function setCam(camera, a, b, u) {
  camera.position.lerpVectors(a.p, b.p, u);
  const t = a.t.clone().lerp(b.t, u);
  camera.lookAt(t);
  camera.updateMatrixWorld();
  return t;
}

/** Piecewise camera path: keys [[time, pose], ...], eased between keys. */
export function camPath(camera, t, keys) {
  if (t <= keys[0][0]) return setCam(camera, keys[0][1], keys[0][1], 0);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) return setCam(camera, keys[i - 1][1], keys[i][1], smooth(t, keys[i - 1][0], keys[i][0]));
  }
  const last = keys[keys.length - 1][1];
  return setCam(camera, last, last, 0);
}

// ---------------------------------------------------------------- textures
function skinTile(pal, seed, bump = false) {
  const r = rng(seed);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = bump ? '#808080' : pal.skin;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {                     // soft mottling
      const x = r() * w, y = r() * h, rad = 30 + r() * 70;
      wrapped(g, w, h, x, y, rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        const c = bump ? (r() > 0.5 ? '255,255,255' : '0,0,0') : (r() > 0.5 ? '255,214,190' : '170,96,72');
        gr.addColorStop(0, `rgba(${c},${bump ? 0.04 : 0.05})`);
        gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr;
        g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
    for (let i = 0; i < 26; i++) {                     // fine creases
      g.strokeStyle = bump ? 'rgba(0,0,0,0.35)' : 'rgba(150,84,62,0.16)';
      g.lineWidth = 1.2;
      let x = r() * w, y = r() * h;
      const a = r() * Math.PI;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += Math.cos(a + (r() - 0.5) * 0.6) * 22;
        y += Math.sin(a + (r() - 0.5) * 0.6) * 22;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 900; i++) {                    // pores
      const x = r() * w, y = r() * h, rad = 0.8 + r() * 1.6;
      wrapped(g, w, h, x, y, rad, (px, py) => {
        g.fillStyle = bump ? 'rgba(0,0,0,0.6)' : 'rgba(140,72,52,0.28)';
        g.beginPath();
        g.arc(px, py, rad, 0, Math.PI * 2);
        g.fill();
      });
    }
  }, { srgb: !bump, wrap: true });
}

/** The star, drawn in block-top coordinates through `map(x, z) -> [px, py]` (scale = px per unit). */
function drawStar(g, map, scale, pal, seed) {
  const r = rng(seed);
  g.save();
  g.beginPath();
  STAR.forEach(([x, z], i) => { const [px, py] = map(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.closePath();
  g.fillStyle = pal.ink;
  g.shadowColor = 'rgba(27,33,48,0.55)';            // a little ink bleed at the edges
  g.shadowBlur = 0.035 * scale;
  g.fill();
  g.shadowBlur = 0;
  g.clip();
  for (let i = 0; i < 1400; i++) {                   // grain: healed ink is never perfectly flat
    const [px, py] = map((r() - 0.5) * 2.4, (r() - 0.5) * 2.4 + 0.25);
    g.fillStyle = r() > 0.5 ? 'rgba(80,90,120,0.10)' : 'rgba(0,0,0,0.18)';
    g.fillRect(px, py, 0.012 * scale, 0.012 * scale);
  }
  g.restore();
}

/** Star on a transparent canvas covering block-top coordinates x in [-hw, hw], z in [-hd, hd]. */
function starTex(pal, hw, hd, ppu = 360) {
  const W = Math.round(2 * hw * ppu), H = Math.round(2 * hd * ppu);
  return canvasTex(W, H, (g) => {
    drawStar(g, (x, z) => [(x + hw) * ppu, (z + hd) * ppu], ppu, pal, 7);
  });
}

/** A cut face of one layer: kind = 'epi' | 'derm' | 'fat', size in units. */
function layerTex(kind, wu, hu, pal, seed, ppu = 300) {
  const r = rng(seed);
  const W = Math.max(8, Math.round(wu * ppu)), H = Math.max(8, Math.round(hu * ppu));
  return canvasTex(W, H, (g) => {
    const U = ppu;
    if (kind === 'epi') {
      g.fillStyle = pal.epidermis;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#E2B08C';                          // the dead outer skin (stratum corneum)
      g.fillRect(0, 0, W, 0.045 * U);
      for (let row = 0; row < 4; row++) {               // rows of flattened cells
        const y = (0.06 + row * 0.04) * U, ch = 0.032 * U;
        let x = -r() * 0.05 * U;
        while (x < W) {
          const cw = (0.06 + r() * 0.05) * U;
          g.strokeStyle = 'rgba(176,112,84,0.45)';
          g.lineWidth = 1.4;
          g.beginPath();
          g.roundRect(x + 2, y, cw - 4, ch, ch / 2);
          g.stroke();
          g.fillStyle = 'rgba(160,96,74,0.35)';
          g.beginPath();
          g.ellipse(x + cw / 2, y + ch / 2, cw * 0.12, ch * 0.18, 0, 0, Math.PI * 2);
          g.fill();
          x += cw;
        }
      }
      for (let i = 0; i < W / 9; i++) {                 // melanin dots at the base
        g.fillStyle = 'rgba(120,70,50,0.35)';
        g.fillRect(r() * W, H - (0.012 + r() * 0.02) * U, 2, 2);
      }
    } else if (kind === 'derm') {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#E9958A');
      gr.addColorStop(0.25, pal.dermis);
      gr.addColorStop(1, '#C9675F');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < W / 26; i++) {                // dermal papillae under the outer layer
        const x = r() * W;
        g.fillStyle = 'rgba(248,190,178,0.35)';
        g.beginPath();
        g.ellipse(x, 0, 0.05 * U, 0.07 * U, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.lineCap = 'round';
      for (let i = 0; i < (W * H) / 900; i++) {         // collagen strands
        const x = r() * W, y = r() * H, len = (0.15 + r() * 0.35) * U, a = (r() - 0.5) * 0.7;
        g.strokeStyle = `rgba(246,178,166,${0.25 + r() * 0.35})`;
        g.lineWidth = (0.008 + r() * 0.012) * U;
        g.beginPath();
        g.moveTo(x, y);
        g.bezierCurveTo(x + len * 0.33, y + Math.sin(a) * len * 0.3 + 0.03 * U, x + len * 0.66,
          y + Math.sin(a) * len * 0.6 - 0.03 * U, x + len, y + Math.sin(a) * len);
        g.stroke();
      }
      for (let i = 0; i < (W * H) / 3500; i++) {        // fibroblast nuclei
        g.fillStyle = 'rgba(150,62,70,0.45)';
        g.beginPath();
        g.ellipse(r() * W, r() * H, 0.022 * U, 0.008 * U, (r() - 0.5) * 0.8, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillStyle = '#E9C470';
      g.fillRect(0, 0, W, H);
      const cells = [];
      for (let i = 0; i < 600 && cells.length < (W * H) / 2600; i++) {
        const x = r() * W, y = r() * H, rad = (0.07 + r() * 0.06) * U;
        if (cells.every(([cx, cy, cr]) => Math.hypot(cx - x, cy - y) > (cr + rad) * 0.92)) cells.push([x, y, rad]);
      }
      for (const [x, y, rad] of cells) {                // fat globules
        const gr = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, rad * 0.1, x, y, rad);
        gr.addColorStop(0, '#FBEBB4');
        gr.addColorStop(0.75, pal.fat);
        gr.addColorStop(1, pal.fat_edge);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, rad, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(200,120,90,0.35)';
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
  });
}

// ---------------------------------------------------------------- the forearm
export function makeArm(pal) {
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const y = -7 + 14 * i / 80;
    pts.push(new THREE.Vector2(ARM_R * (1 - 0.03 * y) * (1 - 0.02 * Math.cos(y * 0.9)), y));
  }
  const geo = new THREE.LatheGeometry(pts, 160);
  const map = skinTile(pal, 11), bump = skinTile(pal, 11, true);
  for (const tx of [map, bump]) tx.repeat.set(3, 7);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map, bumpMap: bump, bumpScale: 1.2, roughness: 0.58, sheen: 0.7,
    sheenColor: new THREE.Color('#ff9c86'), sheenRoughness: 0.45, transparent: true, opacity: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;                // lathe axis -> world z (the wrist toward the camera)
  mesh.position.y = -ARM_R;                     // the top of the arm passes through the origin
  const group = new THREE.Group();
  group.add(mesh);
  group.updateMatrixWorld(true);

  // the star: a decal projected down onto the arm, covering block-top coords [-1.3, 1.3]^2 (x S0)
  const starMat = new THREE.MeshPhysicalMaterial({
    map: starTex(pal, 1.3, 1.3), transparent: true, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -4, roughness: 0.6, opacity: 1,
  });
  const decalOri = new THREE.Euler(-Math.PI / 2, 0, 0);
  const star = new THREE.Mesh(new DecalGeometry(mesh, vec(0, 0, 0), decalOri, vec(2.6 * S0, 2.6 * S0, 0.6)), starMat);
  group.add(star);

  // the hole left when the block lifts out
  const holeTex = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#3a0f0d';
    g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(10,2,2,0.9)');
    gr.addColorStop(1, 'rgba(120,40,34,0.2)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const holeMat = new THREE.MeshStandardMaterial({
    map: holeTex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6,
    roughness: 0.9,
  });
  const hole = new THREE.Mesh(new DecalGeometry(mesh, vec(0, 0, 0), decalOri, vec(BLK.w * S0, BLK.d * S0, 0.6)), holeMat);
  group.add(hole);

  // the cut line drawn around the footprint
  const hw = BLK.w * S0 / 2, hd = BLK.d * S0 / 2;
  const onTop = (x, z) => vec(x, Math.sqrt(ARM_R * ARM_R - x * x) - ARM_R + 0.006, z);
  const path = new THREE.CurvePath();
  const corners = [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd], [-hw, hd]];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i], [x1, z1] = corners[i + 1];
    const seg = [];
    for (let k = 0; k <= 12; k++) seg.push(onTop(lerp(x0, x1, k / 12), lerp(z0, z1, k / 12)));
    path.add(new THREE.CatmullRomCurve3(seg));
  }
  const cutGeo = new THREE.TubeGeometry(path, 240, 0.0065, 6, false);
  const cutMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFF1DC').multiplyScalar(3.0), transparent: true });
  const cut = new THREE.Mesh(cutGeo, cutMat);
  group.add(cut);
  const cutTotal = cutGeo.index.count;

  return {
    group, mesh, star, hole, cut,
    /** show = 0..1 (fade), drop = how far it has sunk out of frame, cutU = cut line drawn 0..1, hole 0..1 */
    set({ show = 1, drop = 0, cutU = 0, cutAlpha = 1, holeU = 0, starOpacity = 1 }) {
      group.position.y = -drop;
      group.visible = show > 0.001;
      mat.opacity = show;
      mat.transparent = show < 0.999;
      mat.depthWrite = show > 0.5;
      starMat.opacity = show * starOpacity;
      holeMat.opacity = show * holeU;
      const n = Math.floor(cutTotal * clamp01(cutU) / 36) * 36;
      cutGeo.setDrawRange(0, n);
      cut.visible = n > 0 && cutAlpha > 0.001;
      cutMat.opacity = cutAlpha * show;
    },
  };
}

/** Skin flakes peeling off a surface (time-lapse shedding). spots(i, r) -> {p, n} picks where flake i sits. */
export function makeFlakes(pal, count, seed, spots, { size = 0.05 } = {}) {
  const r = rng(seed);
  const geo = new THREE.PlaneGeometry(1, 0.72, 4, 3);
  const pos = geo.attributes.position;                // a slight curl
  for (let i = 0; i < pos.count; i++) pos.setZ(i, 0.12 * (pos.getX(i) ** 2 + pos.getY(i) ** 2));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#D39A7C'), roughness: 1, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  const items = [];
  for (let i = 0; i < count; i++) {
    const s = spots(i, r);
    items.push({
      ...s, u: r(), sz: size * (0.6 + r() * 0.8), spin: vec(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
      spinRate: 2 + r() * 4, drift: vec(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.6), roll: r() * 6.28,
    });
  }
  const up = vec(0, 1, 0), zAxis = vec(0, 0, 1), dummyQ = new THREE.Quaternion(), spinQ = new THREE.Quaternion();
  return {
    mesh,
    /** Flakes start (each at its own moment) between t0 and t1; each lives `life` seconds. */
    update(t, t0, t1, life = 1.1, gain = 1) {
      let k = 0;
      for (const f of items) {
        const ts = t0 + f.u * (t1 - t0), a = (t - ts) / life;
        if (a <= 0 || a >= 1 || gain <= 0) { tmpS.set(0, 0, 0); tmpM.compose(f.p, tmpQ.identity(), tmpS); mesh.setMatrixAt(k++, tmpM); continue; }
        const grow = clamp01(a / 0.18), lift = Math.max(0, (a - 0.25) / 0.75);
        tmpP.copy(f.p).addScaledVector(f.n, 0.004 + 1.6 * f.sz * lift * lift)
          .addScaledVector(up, 0.35 * lift * lift).addScaledVector(f.drift, 0.5 * lift);
        dummyQ.setFromUnitVectors(zAxis, f.n);
        dummyQ.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, f.roll));
        spinQ.setFromAxisAngle(f.spin, f.spinRate * lift * lift);
        tmpQ.copy(spinQ).multiply(dummyQ);
        const sc = f.sz * grow * (1 - Math.max(0, (a - 0.8) / 0.2)) * gain;
        tmpS.set(sc, sc, sc);
        tmpM.compose(tmpP, tmpQ, tmpS);
        mesh.setMatrixAt(k++, tmpM);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Flakes spread over the top of the arm (visible side). */
export function armSpots(i, r) {
  const z = (r() - 0.5) * 7.0, phi = (r() - 0.5) * 2.0;
  const n = vec(Math.sin(phi), Math.cos(phi), 0);
  const p = vec(ARM_R * Math.sin(phi), -ARM_R + ARM_R * Math.cos(phi), z);
  return { p, n };
}

/** Flakes over the top of the block. */
export function blockSpots(i, r) {
  return { p: vec((r() - 0.5) * BLK.w * 0.96, 0.002, (r() - 0.5) * BLK.d * 0.96), n: vec(0, 1, 0) };
}

// ---------------------------------------------------------------- the skin block
export function makeBlock(pal) {
  const group = new THREE.Group();
  const inner = new THREE.Group();             // scaled for the lift; group carries position / rotation
  group.add(inner);
  const cutMat = (tex) => new THREE.MeshPhysicalMaterial({
    map: tex, roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.35, transparent: true, opacity: 1,
  });
  const layer = (kind, h, y, seed) => {
    const front = cutMat(layerTex(kind, BLK.w, h, pal, seed));
    const side = cutMat(layerTex(kind, BLK.d, h, pal, seed + 1));
    const back = cutMat(layerTex(kind, BLK.w, h, pal, seed + 2));
    const cap = new THREE.MeshPhysicalMaterial({ color: kind === 'fat' ? pal.fat : pal.dermis, roughness: 0.6, transparent: true });
    const mats = [side, side, cap, cap, front, back];
    const m = new THREE.Mesh(new THREE.BoxGeometry(BLK.w, h, BLK.d), mats);
    m.position.y = y;
    inner.add(m);
    return mats;
  };
  const mats = [
    ...layer('epi', BLK.epi, -BLK.epi / 2, 21),
    ...layer('derm', BLK.derm, BLK.yEpi - BLK.derm / 2, 31),
    ...layer('fat', BLK.fat, BLK.yDerm - BLK.fat / 2, 41),
  ];
  // the skin on top (a separate plane so the star can sit on it and fade)
  const skinMap = skinTile(pal, 12), skinBump = skinTile(pal, 12, true);
  for (const tx of [skinMap, skinBump]) tx.repeat.set(BLK.w / 1.2, BLK.d / 1.2);
  const topMat = new THREE.MeshPhysicalMaterial({
    map: skinMap, bumpMap: skinBump, bumpScale: 1.2, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color('#ff9c86'),
    transparent: true,
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(BLK.w, BLK.d), topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.0012;
  inner.add(top);
  const starMat = new THREE.MeshPhysicalMaterial({
    map: starTex(pal, BLK.w / 2, BLK.d / 2), transparent: true, depthWrite: false, roughness: 0.6,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  const star = new THREE.Mesh(new THREE.PlaneGeometry(BLK.w, BLK.d), starMat);
  star.rotation.x = -Math.PI / 2;
  star.position.y = 0.0024;
  inner.add(star);
  mats.push(topMat);
  return {
    group, inner, star,
    set({ opacity = 1, starOpacity = 1 }) {
      group.visible = opacity > 0.001;
      for (const m of mats) { m.opacity = opacity; m.transparent = opacity < 0.999; m.depthWrite = opacity > 0.5; }
      starMat.opacity = opacity * starOpacity;
    },
  };
}

/** The block's pose through the lift: u = 0 (flat footprint on the arm) .. 1 (lifted, half size) .. 2 (full size,
 *  centred where the S01 camera looks). */
export function blockPose(block, u) {
  const g = block.group, s = block.inner.scale;
  if (u <= 1) {
    const e = ease.inOut(clamp01(u));
    const sxz = lerp(S0, 0.42, e), sy = lerp(0.012, 0.42, Math.pow(e, 0.8));
    s.set(sxz, sy, sxz);
    g.position.set(0, lerp(0.0, 0.95, e), lerp(0, 0.15, e));
    g.rotation.set(lerp(0, 0.22, e), lerp(0, -0.35, e), 0);
  } else {
    const e = ease.inOut(clamp01(u - 1));
    const sc = lerp(0.42, 1, e);
    s.set(sc, sc, sc);
    g.position.set(0, lerp(0.95, 0, e), lerp(0.15, 0, e));
    g.rotation.set(lerp(0.22, 0, e), lerp(-0.35, 0, e), 0);
  }
  g.updateMatrixWorld(true);
}

// ---------------------------------------------------------------- the tattoo needle
export function makeNeedle(pal) {
  const group = new THREE.Group();
  const steel = new THREE.MeshPhysicalMaterial({ color: pal.steel, metalness: 1, roughness: 0.22 });
  const r = 0.016, len = 2.6;
  const one = () => {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), steel);
    shaft.position.y = len / 2 + 0.06;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(r, 0.06, 12), steel);
    tip.rotation.x = Math.PI;
    tip.position.y = 0.03;
    g.add(shaft, tip);
    return g;
  };
  const offs = [[0, 0], [0.034, 0], [-0.034, 0], [0.017, 0.03], [-0.017, 0.03], [0.017, -0.03], [-0.017, -0.03]];
  for (const [x, z] of offs) { const n = one(); n.position.set(x, 0.01 * Math.hypot(x, z) * 10, z); group.add(n); }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 2.0, 24),
    new THREE.MeshPhysicalMaterial({ color: '#4a4f57', metalness: 0.9, roughness: 0.35 }));
  tube.position.y = 0.9 + 1.0;
  group.add(tube);
  // a wet ink sheen on the tips
  const inkTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12),
    new THREE.MeshPhysicalMaterial({ color: pal.ink, roughness: 0.2, clearcoat: 1 }));
  inkTip.scale.set(1, 1.6, 1);
  inkTip.position.y = 0.09;
  group.add(inkTip);
  group.visible = false;
  return { group };
}

// ---------------------------------------------------------------- ink particles (instanced)
export function makeInk(pal, n, { detail = 3, rough = 0.3 } = {}) {
  // drawn after the cells' membranes (transparent list, renderOrder 5), so swallowed ink stays crisp and dark
  const mat = new THREE.MeshPhysicalMaterial({ color: pal.ink, roughness: rough, clearcoat: 0.9, clearcoatRoughness: 0.2,
                                               transparent: true, opacity: 1 });
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, detail), mat, n);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  const hide = () => { for (let i = 0; i < n; i++) { tmpM.makeScale(0, 0, 0); mesh.setMatrixAt(i, tmpM); } };
  hide();
  return {
    mesh, n,
    begin: hide,
    set(i, p, s, rotY = 0) {
      tmpQ.setFromAxisAngle(vec(0.3, 1, 0.2).normalize(), rotY);
      tmpS.set(s, s * 0.85, s);
      tmpM.compose(p, tmpQ, tmpS);
      mesh.setMatrixAt(i, tmpM);
    },
    end() { mesh.instanceMatrix.needsUpdate = true; },
  };
}

// ---------------------------------------------------------------- macrophages
const NOISE_GLSL = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export class Cell {
  constructor(pal, seed, radius = 0.15) {
    this.r = radius;
    this.seed = seed;
    const rr = rng(seed);
    this.phase = rr() * 10;
    this.u = { uT: { value: 0 }, uReach: { value: vec(1, 0, 0) }, uReachAmt: { value: 0 }, uWob: { value: 0.12 },
               uSeed: { value: rr() * 50 } };
    const u = this.u;
    this.mat = new THREE.MeshPhysicalMaterial({
      color: pal.cell, roughness: 0.3, transparent: true, opacity: 1, depthWrite: false, clearcoat: 1,
      clearcoatRoughness: 0.15, sheen: 0.35, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.3,
      emissive: new THREE.Color(pal.cell), emissiveIntensity: 0.03,
    });
    this.mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uT, uReachAmt, uWob, uSeed; uniform vec3 uReach;
${NOISE_GLSL}`)
        .replace('#include <begin_vertex>', `
vec3 dir = normalize(position);
float n = snoise(dir * 1.6 + vec3(uSeed, uT * 0.35, uSeed - uT * 0.3));
float reach = pow(max(dot(dir, normalize(uReach)), 0.0), 5.0);
vec3 transformed = position * (1.0 + uWob * n + uReachAmt * reach);`);
      // a membrane: nearly clear where we look straight through, solid at the rim
      sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
float fres = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
gl_FragColor.a *= mix(0.16, 0.95, pow(fres, 1.6));`);
    };
    this.mat.customProgramCacheKey = () => 'macrophage';
    this.body = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 12), this.mat);
    this.body.renderOrder = 3;
    this.nucMat = new THREE.MeshPhysicalMaterial({ color: pal.cell_nucleus, roughness: 0.45, clearcoat: 0.5, transparent: true });
    this.nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.36, 5), this.nucMat);
    this.nucleus.position.set(radius * 0.22, radius * 0.18, -radius * 0.25);
    this.nucleus.scale.set(1.2, 0.85, 1);
    this.group = new THREE.Group();
    this.group.add(this.body, this.nucleus);
    this.group.visible = false;
    // where swallowed ink sits inside (offsets, filled in order)
    this.slots = [];
    for (let i = 0; i < 12; i++) {
      const a = rr() * Math.PI * 2, b = (rr() - 0.5) * 1.6, d = radius * (0.25 + rr() * 0.4);
      this.slots.push(vec(Math.cos(a) * d - radius * 0.05, Math.sin(b) * d * 0.9, radius * (0.2 + 0.3 * rr())));
    }
  }

  /** p: position; o: {opacity, scale, reachTo (world point or null), reach 0..1, wob, glow, squash} */
  set(t, p, o = {}) {
    const g = this.group;
    const op = o.opacity ?? 1;
    g.visible = op > 0.002 && (o.scale ?? 1) > 0.002;
    g.position.copy(p);
    const sc = o.scale ?? 1;
    const breathe = 1 + 0.03 * Math.sin(t * 2.1 + this.phase);
    g.scale.set(sc * breathe, sc / breathe * (o.squash ?? 1), sc * breathe);
    this.u.uT.value = t + this.phase;
    this.u.uWob.value = o.wob ?? 0.12;
    this.u.uReachAmt.value = 0.9 * (o.reach ?? 0);
    if (o.reachTo) this.u.uReach.value.copy(o.reachTo).sub(p).normalize();
    this.mat.opacity = op;
    this.mat.emissiveIntensity = 0.05 + 0.6 * (o.glow ?? 0);
    this.nucMat.opacity = op;
    this.nucMat.transparent = op < 0.999;
    this.nucleus.position.set(this.r * 0.22 + 0.01 * Math.sin(t * 1.3 + this.phase), this.r * 0.18, -this.r * 0.25);
  }

  /** World position of ink slot k for a cell at p (follows the cell's scale). */
  slot(k, p, scale = 1) {
    return p.clone().addScaledVector(this.slots[k % this.slots.length], scale);
  }
}

/** Fragments of a cell's membrane flying apart when it dies. */
export function makeBurst(pal, n = 120) {
  const mat = new THREE.MeshPhysicalMaterial({ color: pal.cell, roughness: 0.4, transparent: true, opacity: 0.6,
                                               depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 6), mat, n);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return {
    mesh,
    /** bursts: [{p, t0, r, seed}], each throws 12 fragments */
    update(t, bursts) {
      let k = 0;
      for (const b of bursts) {
        const rr = rng(b.seed);
        for (let j = 0; j < 12 && k < n; j++, k++) {
          const d = vec(rr() - 0.5, rr() - 0.5, (rr() - 0.2) * 0.6).normalize();
          const a = (t - b.t0) / 0.55;
          if (a <= 0 || a >= 1) { tmpM.makeScale(0, 0, 0); mesh.setMatrixAt(k, tmpM); continue; }
          tmpP.copy(b.p).addScaledVector(d, b.r * (0.9 + 1.4 * ease.out(a)));
          tmpQ.setFromEuler(new THREE.Euler(rr() * 6 + a * 4, rr() * 6, rr() * 6 + a * 3));
          const s = b.r * (0.18 + rr() * 0.15) * (1 - a);
          tmpS.set(s, s, s);
          tmpM.compose(tmpP, tmpQ, tmpS);
          mesh.setMatrixAt(k, tmpM);
        }
      }
      for (; k < n; k++) { tmpM.makeScale(0, 0, 0); mesh.setMatrixAt(k, tmpM); }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- the lab mouse
function taperedTube(curve, segs, r0, r1, radial = 12) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, p = curve.getPointAt(u), r = lerp(r0, r1, u);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      const n = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);          // counter-clockwise seen from outside
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export function makeMouse(pal) {
  const group = new THREE.Group();
  const fur = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(pal.fur).multiplyScalar(0.8), roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ffffff'),
                                               sheenRoughness: 0.6, transparent: true });
  const pink = new THREE.MeshPhysicalMaterial({ color: pal.pink, roughness: 0.55, sheen: 0.5, transparent: true });
  const dark = new THREE.MeshPhysicalMaterial({ color: '#120d0c', roughness: 0.1, clearcoat: 1, transparent: true });
  const inkM = new THREE.MeshPhysicalMaterial({ color: pal.ink, roughness: 0.5, transparent: true,
                                                emissive: new THREE.Color(pal.accent), emissiveIntensity: 0 });
  const mats = [fur, pink, dark, inkM];
  const add = (geo, mat, p, s = [1, 1, 1], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.scale.set(...s); m.rotation.set(...rot);
    group.add(m);
    return m;
  };
  const sph = new THREE.SphereGeometry(1, 40, 28);
  const body = add(sph, fur, [0, 0.42, 0], [0.78, 0.46, 0.5]);
  add(sph, fur, [0.62, 0.52, 0], [0.4, 0.33, 0.34], [0, 0, -0.25]);                 // head
  add(sph, fur, [0.92, 0.45, 0], [0.18, 0.13, 0.14], [0, 0, -0.35]);               // snout
  add(sph, pink, [1.08, 0.43, 0], [0.045, 0.04, 0.045]);                           // nose
  for (const s of [-1, 1]) {
    add(sph, fur, [0.52, 0.86, 0.2 * s], [0.17, 0.2, 0.06], [0.2 * s, 0.4 * s, 0]);  // ear
    add(sph, pink, [0.54, 0.86, 0.215 * s], [0.12, 0.15, 0.03], [0.2 * s, 0.4 * s, 0]);
    add(sph, dark, [0.76, 0.6, 0.255 * s], [0.055, 0.06, 0.045]);                  // eye
    add(sph, pink, [0.38, 0.03, 0.22 * s], [0.12, 0.04, 0.07]);                    // front foot
    add(sph, pink, [-0.42, 0.03, 0.24 * s], [0.16, 0.045, 0.08]);                  // back foot
  }
  // whiskers
  const wh = new THREE.MeshBasicMaterial({ color: '#d8d0c6', transparent: true });
  mats.push(wh);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const w = add(new THREE.CylinderGeometry(0.004, 0.002, 0.42, 4), wh, [1.06, 0.45 + (k - 1) * 0.03, 0.12 * s],
      [1, 1, 1], [0, 0, Math.PI / 2 + (k - 1) * 0.18]);
    w.rotation.y = s * (0.5 + k * 0.12);
  }
  // the tail, with a tattooed band
  const tail = new THREE.CatmullRomCurve3([vec(-0.72, 0.36, 0), vec(-1.12, 0.16, 0.22), vec(-1.2, 0.03, 0.62),
    vec(-0.85, 0.02, 0.95), vec(-0.25, 0.03, 1.05), vec(0.3, 0.05, 0.98)]);
  add(taperedTube(tail, 80, 0.095, 0.035), pink, [0, 0, 0]);
  const bandU = [0.44, 0.7];
  const band = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => tail.getPointAt(lerp(bandU[0], bandU[1], i / 8))));
  const r0 = lerp(0.095, 0.035, bandU[0]) + 0.006, r1 = lerp(0.095, 0.035, bandU[1]) + 0.006;
  add(taperedTube(band, 20, r0, r1), inkM, [0, 0, 0]);
  const bandCenter = tail.getPointAt((bandU[0] + bandU[1]) / 2);
  return {
    group, body, bandCenter,
    set(t, { opacity = 1, glow = 0 } = {}) {
      inkM.emissiveIntensity = 0;
      group.visible = opacity > 0.002;
      for (const m of mats) { m.opacity = opacity; m.transparent = opacity < 0.999; m.depthWrite = opacity > 0.5; }
      body.scale.y = 0.46 * (1 + 0.025 * Math.sin(t * 7.0));       // quick mouse breathing
    },
    bandWorld() { group.updateMatrixWorld(true); return bandCenter.clone().applyMatrix4(group.matrixWorld); },
  };
}

// ---------------------------------------------------------------- the laser
export function makeLaser(pal) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.8, 32),
    new THREE.MeshPhysicalMaterial({ color: '#2c3036', metalness: 0.6, roughness: 0.3, clearcoat: 0.8 }));
  body.position.y = 1.15;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.06, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.laser).multiplyScalar(1.6) }));
  ring.position.y = 0.55;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.25, 32),
    new THREE.MeshPhysicalMaterial({ color: '#9aa1aa', metalness: 1, roughness: 0.25 }));
  nozzle.position.y = 0.13;
  group.add(body, ring, nozzle);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.laser).multiplyScalar(2.2), transparent: true,
                                                 blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 16, 1, true), beamMat);
  const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.laser), transparent: true,
                                                 blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 16, 1, true), haloMat);
  const flashMat = new THREE.SpriteMaterial({ map: glowTex('#b8ffbf'), transparent: true, blending: THREE.AdditiveBlending,
                                              depthWrite: false, depthTest: false });
  const flash = new THREE.Sprite(flashMat);
  const scene = new THREE.Group();
  scene.add(group, beam, halo, flash);
  group.visible = beam.visible = halo.visible = flash.visible = false;
  return {
    group: scene,
    /** tip: where the nozzle is; target: where the pulse lands; pulse 0..1 brightness */
    set({ show = 0, tip, target, pulse = 0, flashSize = 0.9 }) {
      group.visible = show > 0.01;
      group.position.copy(tip);
      const on = pulse > 0.01;
      beam.visible = halo.visible = flash.visible = on;
      if (on) {
        const len = tip.distanceTo(target);
        for (const m of [beam, halo]) {
          m.position.copy(tip).add(target).multiplyScalar(0.5);
          m.scale.set(1, len, 1);
          m.quaternion.setFromUnitVectors(vec(0, 1, 0), target.clone().sub(tip).normalize());
        }
        beamMat.opacity = pulse;
        haloMat.opacity = 0.35 * pulse;
        flash.position.copy(target);
        flash.scale.setScalar(flashSize * (0.6 + 0.4 * pulse));
        flashMat.opacity = pulse;
      }
    },
  };
}

// ---------------------------------------------------------------- the lymph vessel
export const LYMPH = { y: BLK.yDerm + 0.2, z: BLK.front - 0.05, r: 0.085 };
export function makeLymph(pal) {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const x = -BLK.w / 2 + 0.02 + (BLK.w - 0.04) * i / 20;
    pts.push(vec(x, LYMPH.y + 0.04 * Math.sin(i * 0.9), LYMPH.z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const mat = new THREE.MeshPhysicalMaterial({ color: pal.lymph, roughness: 0.15, clearcoat: 1, transparent: true,
                                               opacity: 0, depthWrite: false, sheen: 1, sheenColor: new THREE.Color('#ffffff') });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, LYMPH.r, 20, false), mat);
  mesh.renderOrder = 2;
  return { mesh, curve, set(op) { mat.opacity = 0.42 * op; mesh.visible = op > 0.01; } };
}

// ---------------------------------------------------------------- labels (DOM overlay)
export class Label {
  constructor(overlay, text, cls = 'lab') {
    this.o = overlay;
    this.el = overlay.el(text, cls);
    this.line = overlay.line('rgba(242,235,221,0.9)', 3);
    this.dot = overlay.dot('rgba(242,235,221,0.95)', 6);
  }
  /** Place the label at (x, y) px; optional leader from the label edge to a world point. */
  show(x, y, opacity, camera = null, to = null, { anchor = 'c', dy = 0 } = {}) {
    const box = this.o.place(this.el, x, y, { anchor, opacity, dy: dy * (1 - opacity) });
    if (to && (camera || !to.isVector3) && opacity > 0.01) {
      const s = to.isVector3 ? toScreen(to, camera) : to;           // a world point, or {x, y} in pixels
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const sy = s.y < cy ? box.y - 8 : box.y + box.h + 6;
      const sx = Math.min(Math.max(s.x, box.x + 20), box.x + box.w - 20);
      const ex = lerp(sx, s.x, opacity), ey = lerp(sy, s.y, opacity);
      this.line.setAttribute('points', `${sx},${sy} ${ex},${ey}`);
      this.line.setAttribute('opacity', opacity);
      this.dot.setAttribute('cx', ex);
      this.dot.setAttribute('cy', ey);
      this.dot.setAttribute('opacity', opacity);
    } else {
      this.line.setAttribute('opacity', 0);
      this.dot.setAttribute('opacity', 0);
    }
    return box;
  }
}

/** opacity envelope: fades in over `fi` from t0, out over `fo` ending at t1 */
export function env(t, t0, t1, fi = 0.25, fo = 0.25) {
  return Math.min(ramp(t, t0, t0 + fi, ease.out), 1 - ramp(t, t1 - fo, t1, ease.inOut));
}

// ---------------------------------------------------------------- the mouse inset (picture in picture)
/** A circular inset in the top-left showing the tattooed lab mouse, rendered into its own target each frame. */
export function makeInset(renderer, pal, camera, { cx = 290, cy = 420, rad = 175 } = {}) {
  const st = stage(renderer, pal);
  const mouse = makeMouse(pal);
  mouse.group.rotation.y = -0.22;
  st.scene.add(mouse.group);
  const mcam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  mcam.position.set(-0.15, 1.65, 4.75);
  const look = vec(-0.32, 0.2, 0.42);
  mcam.lookAt(look);
  const rt = new THREE.WebGLRenderTarget(640, 640, { type: THREE.HalfFloatType, samples: 4 });
  // the HUD: a disc 2 units in front of the main camera
  const D = 2, halfH = D * Math.tan(THREE.MathUtils.degToRad(15)), pxU = halfH * 2 / 1920;
  const hud = new THREE.Group();
  hud.position.set((cx - 540) * pxU, (960 - cy) * pxU, -D);
  camera.add(hud);
  const discMat = new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, depthTest: false, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(rad * pxU, 96), discMat);
  disc.renderOrder = 100;
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.ink_text), transparent: true, depthTest: false, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(rad * pxU, (rad + 6) * pxU, 96), ringMat);
  ring.renderOrder = 101;
  hud.add(disc, ring);
  return {
    mouse,
    update(t, { show = 1, pulse = 0 } = {}) {
      const s = ease.out(clamp01(show)) * (1 + 0.06 * Math.sin(Math.PI * clamp01(show)));
      hud.scale.setScalar(Math.max(s, 1e-4));
      hud.visible = show > 0.001;
      discMat.opacity = ringMat.opacity = clamp01(show * 1.5);
      if (!hud.visible) return;
      mouse.set(t, { glow: pulse });
      st.frame(mcam, look, 14);
      const prev = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(new THREE.Color(pal.bg_glow), 1);
      renderer.clear();
      renderer.render(st.scene, mcam);
      renderer.setRenderTarget(prev);
      renderer.autoClear = prevAuto;
    },
    /** screen px of the tattooed band inside the inset */
    bandPx() {
      const p = mouse.bandWorld().project(mcam);
      return { x: cx + p.x * rad, y: cy - p.y * rad };
    },
    cx, cy, rad,
  };
}
