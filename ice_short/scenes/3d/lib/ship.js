// scenes/3d/lib/ship.js -- a wooden merchant sailing ship of the early 1800s, with its hold opened up.
//   buildShip(P, { masts: 2 | 3, name, flag, holdBlocks }) -> { group, hull, rideOn(waveFn, t), set(t, {wind}), hatch, ice }
// Local frame: forward +x, up +y, port side -z, starboard +z; the waterline is y = 0.
// The deck amidships is cut away (a clean "cutaway" opening with a coaming), so the cargo shows: pond ice packed in
// sawdust. The hull: a lofted U-section, copper sheathing below the waterline, black topsides with an ochre band,
// plank seams in the shader. Sails billow in the wind and breathe; the ship rides the sea (see rideOn).
import * as THREE from 'three';
import { patch, tint, mulberry } from './common.js';
import { mergeGeos } from './figures.js';
import { iceBlocks } from './ice.js';

export const SHIP = { L: 26, B: 7.0, T: 2.4, fb: 1.9 };

function hullShape(u) {
  const { B, T, fb } = SHIP;
  const a = Math.abs(u);
  const w = u >= 0 ? Math.pow(Math.max(0, 1 - Math.pow(u, 2.1)), 0.62) : Math.max(0, Math.pow(Math.max(0, 1 - Math.pow(a, 3.4)), 0.42)) * 0.8 + 0.2 * (1 - a) ** 0.3;
  const deckY = fb + 0.5 * u * u + (u > 0 ? 0.35 * u ** 4 : 0.15 * a ** 3);
  const sm = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  const keelY = -T * (1 - 0.9 * sm(0.5, 1.02, u) - 0.35 * sm(0.75, 1.0, -u));
  return { hb: (B / 2) * w, deckY, keelY };
}
export function deckAt(x) { return hullShape(x / (SHIP.L / 2)).deckY; }
export function halfBeam(x) { return hullShape(x / (SHIP.L / 2)).hb; }

function hullGeometry() {
  const { L } = SHIP, NX = 80, NY = 22;
  const pos = [], idx = [], col = [], loc = [];
  const C = (h) => new THREE.Color(h);
  const copper = C('#A9643A'), copperG = C('#5E8C76'), black = C('#1E1A17'), ochre = C('#9C7A42'), white = C('#E6DDCB');
  const colorAt = (y, deckY, x) => {
    if (y < 0.18) { const k = 0.5 + 0.5 * Math.sin(x * 0.7 + y * 3); return copper.clone().lerp(copperG, 0.25 + 0.2 * k); }
    if (y < 0.3) return white.clone();
    if (y > deckY - 0.75 && y < deckY - 0.38) return ochre.clone();
    return black.clone();
  };
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NX; i++) {
      const u = -1 + 2 * i / NX;
      const s0 = hullShape(Math.min(u, 0.999));
      for (let j = 0; j <= NY; j++) {
        const s = j / NY;
        const y = s0.keelY + (s0.deckY + 0.95 - s0.keelY) * s;        // up to the top of the bulwark
        const ss = Math.min(1, (y - s0.keelY) / (s0.deckY - s0.keelY));
        const full = 1 - Math.pow(1 - ss, 2.5);
        const tumble = 1 - 0.07 * Math.max(0, (ss - 0.7) / 0.3) ** 2 - (y > s0.deckY ? 0.05 * (y - s0.deckY) : 0);
        const z = side * s0.hb * full * tumble;
        const x = u * L / 2;
        pos.push(x, y, z);
        const c = colorAt(y, s0.deckY, x); col.push(c.r, c.g, c.b);
        loc.push(x, y, z);
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const a = base + i * (NY + 1) + j, b = a + NY + 1;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // the transom (stern face): a fan between the two sides at u = -1
  const tb = pos.length / 3;
  const s0 = hullShape(-1);
  for (let j = 0; j <= NY; j++) {
    const s = j / NY, y = s0.keelY + (s0.deckY + 0.95 - s0.keelY) * s;
    const ss = Math.min(1, (y - s0.keelY) / (s0.deckY - s0.keelY));
    const z = s0.hb * (1 - Math.pow(1 - ss, 2.5));
    pos.push(-L / 2, y, -z, -L / 2, y, z);
    const c = colorAt(y, s0.deckY, -L / 2); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    loc.push(-L / 2, y, -z, -L / 2, y, z);
  }
  for (let j = 0; j < NY; j++) { const a = tb + j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The deck: planks between the bulwarks, with the cargo opening (u in [h0, h1]) left out. */
function deckGeometry(h0, h1) {
  const { L } = SHIP, NX = 70, NZ = 12;
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= NX; i++) {
    const u = -1 + 2 * i / NX, s = hullShape(Math.min(u, 0.995));
    for (let j = 0; j <= NZ; j++) {
      const v = -1 + 2 * j / NZ;
      const x = u * L / 2, z = v * s.hb * 0.985, y = s.deckY - 0.02 * v * v + 0.06;
      pos.push(x, y, z); uv.push(x, z);
    }
  }
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const u = -1 + 2 * (i + 0.5) / NX, v = -1 + 2 * (j + 0.5) / NZ;
    if (u > h0 && u < h1 && Math.abs(v) < 0.74) continue;
    const a = i * (NZ + 1) + j, b = a + NZ + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function woodMat(color, { rough = 0.8, plank = 0.22, along = 'x', grain = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0 });
  return patch(m, {
    vHead: 'varying vec3 vL;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' },
    fHead: `varying vec3 vL; uniform float uPlank, uGrain;`,
    uniforms: { uPlank: { value: plank }, uGrain: { value: grain } },
    frag: { '#include <color_fragment>': `#include <color_fragment>
      vec2 pq = ${along === 'x' ? 'vec2(vL.x, vL.z)' : along === 'y' ? 'vec2(vL.y, vL.x + vL.z)' : 'vec2(vL.z, vL.x)'};
      float row = floor(pq.y / uPlank);
      float seam = smoothstep(0.0, 0.035, abs(fract(pq.y / uPlank) - 0.5) * 2. - 0.93);
      float butt = 1. - (1. - smoothstep(0.0, 0.02, abs(fract(pq.x / 4.3 + h21(vec2(row, 3.)) ) - 0.5) * 2. - 0.985));
      float grain = vnoise(vec2(pq.x * 1.2, pq.y * 40.)) * 0.5 + vnoise(vec2(pq.x * 0.3, row * 7.)) * 0.5;
      diffuseColor.rgb *= (0.78 + 0.32 * h21(vec2(row, 1.))) * (0.85 + 0.25 * grain * uGrain) * mix(0.45, 1., (1. - seam) * butt);` },
  });
}

function sailMaterial(color = '#CFC2A6') {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.85, side: THREE.DoubleSide });
  return patch(m, {
    uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) } },
    vHead: 'varying vec2 vU;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvU = uv;' },
    fHead: 'varying vec2 vU; uniform vec3 uSun;',
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        float cloth = smoothstep(0.88, 1.0, abs(fract(vU.x * 9.0) - 0.5) * 2.);      // vertical cloths (seams)
        float reef = smoothstep(0.93, 1.0, abs(fract(vU.y * 4.0) - 0.5) * 2.) * 0.6;
        float dirt = vnoise(vU * vec2(6., 3.)) * 0.12 + (1. - vU.y) * 0.06;
        diffuseColor.rgb *= (1. - cloth * 0.12 - reef * 0.08 - dirt);
        float edge = max(smoothstep(0.03, 0., vU.x) + smoothstep(0.97, 1., vU.x), smoothstep(0.03, 0., vU.y) + smoothstep(0.97, 1., vU.y));
        diffuseColor.rgb *= 1. - edge * 0.25;`,
      // light through the canvas: the back face glows warm when the sun is behind it
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        float back = gl_FrontFacing ? 0. : 1.;
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.85, 0.6) * 0.05 * back;`,
    },
  });
  return m;
}

function tube(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
  return g;
}

function nameTexture(name) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#1E1A17'; x.fillRect(0, 0, 1024, 160);
  x.fillStyle = '#E8C77A'; x.font = 'bold 104px Georgia, "DejaVu Serif", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(name, 512, 86);
  x.font = 'bold 40px Georgia, "DejaVu Serif", serif'; x.fillText('', 512, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function flagTexture() {
  const c = document.createElement('canvas'); c.width = 380; c.height = 200;
  const x = c.getContext('2d');
  for (let i = 0; i < 15; i++) { x.fillStyle = i % 2 ? '#F2EEE4' : '#B5262B'; x.fillRect(0, i * 200 / 15, 380, 200 / 15 + 1); }
  x.fillStyle = '#23305E'; x.fillRect(0, 0, 160, 107);
  x.fillStyle = '#F2EEE4';
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(18 + k * 31, 20 + r * 33, 5, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildShip(P, { masts = 2, name = '', holdBlocks = true, seed = 3, flag = true } = {}) {
  const { L } = SHIP;
  const group = new THREE.Group();
  const body = new THREE.Group();            // everything that pitches and rolls
  group.add(body);
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide });
  patch(hullMat, {
    vHead: 'varying vec3 vL;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' },
    fHead: 'varying vec3 vL;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      float row = floor(vL.y / 0.24);
      float seam = smoothstep(0.86, 1.0, abs(fract(vL.y / 0.24) - 0.5) * 2.);
      float cu = step(vL.y, 0.18);
      float plate = cu * smoothstep(0.9, 1.0, abs(fract(vL.x / 1.2 + row * 0.5) - 0.5) * 2.);
      diffuseColor.rgb *= (0.88 + 0.16 * h21(vec2(row, floor(vL.x / 5.)))) * (1. - seam * 0.35 - plate * 0.25);
      diffuseColor.rgb *= 0.9 + 0.2 * vnoise(vL.xz * vec2(0.6, 3.) + row);
      if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.22, 0.15, 0.1) * (0.8 + 0.3 * vnoise(vL.xy * 2.));` ,
      '#include <roughnessmap_fragment>': `#include <roughnessmap_fragment>
      roughnessFactor = vL.y < 0.18 ? 0.42 : (vL.y > 0.3 ? 0.55 : 0.5);
      roughnessFactor = mix(roughnessFactor, 0.2, smoothstep(0.6, -0.1, vL.y) * 0.6);`,
    },
  });
  const hull = new THREE.Mesh(hullGeometry(), hullMat);
  hull.castShadow = true; hull.receiveShadow = true;
  body.add(hull);

  // the cargo opening amidships (in hull fractions)
  const H0 = -0.42, H1 = 0.22;
  const deckMat = woodMat('#B58E62', { rough: 0.75, plank: 0.2 });
  const deck = new THREE.Mesh(deckGeometry(H0, H1), deckMat);
  deck.receiveShadow = true; deck.castShadow = true;
  body.add(deck);

  const wood = woodMat('#6B4A2E', { rough: 0.7, plank: 0.3 });
  const darkWood = woodMat('#3A2A1E', { rough: 0.7, plank: 0.3 });
  const parts = [];
  const add = (g, m, cast = true) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = cast; mesh.receiveShadow = true; body.add(mesh); parts.push(mesh); return mesh; };
  // the coaming round the opening, and the cut edge of the deck beams (the cutaway look)
  const x0 = H0 * L / 2, x1 = H1 * L / 2;
  const zw = (x) => halfBeam(x) * 0.74 * 0.985;
  const dy = (x) => deckAt(x) + 0.06;
  {
    const gs = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 24; i++) {
        const xa = x0 + (x1 - x0) * i / 24, xb = x0 + (x1 - x0) * (i + 1) / 24;
        const a = new THREE.Vector3(xa, dy(xa) + 0.1, side * zw(xa)), b = new THREE.Vector3(xb, dy(xb) + 0.1, side * zw(xb));
        const bx = new THREE.BoxGeometry(b.distanceTo(a) + 0.02, 0.32, 0.2);
        bx.rotateY(-Math.atan2(b.z - a.z, b.x - a.x));
        bx.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        gs.push(bx);
      }
    }
    for (const x of [x0, x1]) { const bx = new THREE.BoxGeometry(0.2, 0.32, zw(x) * 2 + 0.2); bx.translate(x, dy(x) + 0.1, 0); gs.push(bx); }
    // deck beams crossing the opening (cut ends visible), and the hull's frames inside
    for (let k = 1; k < 1; k++) {
      const x = x0 + (x1 - x0) * k / 5;
      const bx = new THREE.BoxGeometry(0.22, 0.24, zw(x) * 2 + 0.6); bx.translate(x, dy(x) - 0.12, 0); gs.push(bx);
    }
    add(mergeGeos(gs.map((g) => tint(g.toNonIndexed(), '#ffffff'))), wood);
  }
  // bulwark rail cap, the deckhouse aft, a raised forecastle hatch, the wheel, the capstan, barrels, the boat
  {
    const gs = [];
    for (const side of [-1, 1]) for (let i = 0; i < 60; i++) {
      const xa = -L / 2 + 0.2 + (L - 0.6) * i / 60, xb = -L / 2 + 0.2 + (L - 0.6) * (i + 1) / 60;
      const ya = deckAt(xa) + 0.95, yb = deckAt(xb) + 0.95;
      const za = side * halfBeam(xa) * 0.93, zb = side * halfBeam(xb) * 0.93;
      gs.push(tube(new THREE.Vector3(xa, ya, za), new THREE.Vector3(xb, yb, zb), 0.09, 6));
    }
    add(mergeGeos(gs.map((g) => tint(g.toNonIndexed(), '#ffffff'))), darkWood);
    const house = new THREE.BoxGeometry(4.2, 1.7, 3.4); house.translate(-L / 2 + 4.3, deckAt(-L / 2 + 4.3) + 0.85, 0);
    const roof = new THREE.BoxGeometry(4.5, 0.15, 3.7); roof.translate(-L / 2 + 4.3, deckAt(-L / 2 + 4.3) + 1.75, 0);
    const fh = new THREE.BoxGeometry(1.6, 0.6, 1.6); fh.translate(L / 2 - 6.5, deckAt(L / 2 - 6.5) + 0.3, 0);
    add(mergeGeos([house, roof, fh].map((g) => tint(g.toNonIndexed(), '#ffffff'))), woodMat('#8A6440', { plank: 0.25, along: 'y' }));
    // wheel
    const wx = -L / 2 + 1.6, wy = deckAt(wx) + 1.25;
    const wh = new THREE.TorusGeometry(0.55, 0.05, 6, 20); wh.rotateY(Math.PI / 2); wh.translate(wx, wy, 0);
    const spokes = [];
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; spokes.push(tube(new THREE.Vector3(wx, wy, 0), new THREE.Vector3(wx, wy + Math.cos(a) * 0.72, Math.sin(a) * 0.72), 0.025, 4)); }
    const post = new THREE.BoxGeometry(0.2, 1.2, 0.3); post.translate(wx - 0.1, deckAt(wx) + 0.6, 0);
    add(mergeGeos([wh, ...spokes, post].map((g) => tint(g.toNonIndexed(), '#ffffff'))), darkWood);
    const cap = new THREE.CylinderGeometry(0.35, 0.45, 0.9, 12); cap.translate(L / 2 - 8.6, deckAt(L / 2 - 8.6) + 0.45, 0);
    const brl = [];
    const r2 = mulberry(seed);
    for (let k = 0; k < 6; k++) {
      const b = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12); const bulge = b.attributes.position;
      for (let i = 0; i < bulge.count; i++) { const y = bulge.getY(i); const s = 1 + 0.12 * Math.cos(y / 0.4 * Math.PI / 2); bulge.setX(i, bulge.getX(i) * s); bulge.setZ(i, bulge.getZ(i) * s); }
      const bx = L / 2 - 4.5 + (k % 3) * 0.66 - 0.4, bz = (k < 3 ? -1 : 1) * (1.5 + 0.1 * r2());
      b.translate(bx, deckAt(bx) + 0.4, bz); brl.push(b);
    }
    add(mergeGeos([cap, ...brl].map((g) => tint(g.toNonIndexed(), '#ffffff'))), woodMat('#7A5634', { plank: 0.12, along: 'y' }));
  }
  // the stern name board
  if (name) {
    const s = hullShape(-1);
    const nb = new THREE.Mesh(new THREE.PlaneGeometry(s.hb * 1.5, s.hb * 1.5 * 160 / 1024), new THREE.MeshStandardMaterial({ map: nameTexture(name), roughness: 0.6 }));
    nb.position.set(-L / 2 - 0.03, s.deckY - 0.45, 0); nb.rotation.y = -Math.PI / 2;
    body.add(nb);
    for (const side of [-1, 1]) {
      const bx = L / 2 - 5.2, hb = halfBeam(bx);
      const bw = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), nb.material);
      bw.position.set(bx, deckAt(bx) - 0.42, side * (hb * 0.99 + 0.03)); bw.rotation.y = side > 0 ? 0 : Math.PI;
      bw.rotation.x = 0; bw.rotateY(side * -0.12);
      body.add(bw);
    }
  }

  // ---------------------------------------------------------------- masts, yards, sails, rigging
  const MASTS = masts === 3
    ? [{ x: 6.4, h: 22 }, { x: -0.6, h: 24 }, { x: -7.4, h: 18 }]
    : [{ x: 5.2, h: 22 }, { x: -2.6, h: 24 }];
  const spar = woodMat('#5A3E26', { rough: 0.6, plank: 10, along: 'y', grain: 0.6 });
  const sparG = [], rigG = [];
  const sailMat = sailMaterial();
  const sails = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const bowTip = V(L / 2 + 7.5, deckAt(L / 2) + 2.6, 0);
  sparG.push(tube(V(L / 2 - 2, deckAt(L / 2 - 2) + 0.6, 0), bowTip, 0.17, 8));
  MASTS.forEach((M, mi) => {
    const yb = deckAt(M.x);
    // the mast in three pieces (lower, top, topgallant) with tops
    sparG.push(tube(V(M.x, yb - 1, 0), V(M.x, yb + M.h * 0.5, 0), 0.32, 10));
    sparG.push(tube(V(M.x, yb + M.h * 0.45, 0), V(M.x, yb + M.h * 0.8, 0), 0.22, 8));
    sparG.push(tube(V(M.x, yb + M.h * 0.78, 0), V(M.x, yb + M.h * 1.02, 0), 0.13, 8));
    const top = new THREE.BoxGeometry(2.2, 0.18, 3.2); top.translate(M.x, yb + M.h * 0.5, 0); sparG.push(top);
    // three square sails: course, topsail, topgallant (the mizzen of a ship carries less)
    const levels = mi === 2 ? [[0.5, 0.75, 9, 7], [0.76, 0.96, 7, 5.2]] : [[0.13, 0.46, 14, 12.5], [0.5, 0.76, 11.5, 9], [0.78, 0.97, 8.5, 6.4]];
    levels.forEach(([v0, v1, wBot, wTop], li) => {
      const yTop = yb + M.h * v1, yBot = yb + M.h * v0;
      sparG.push(tube(V(M.x + 0.25, yTop, -wTop / 2 - 0.4), V(M.x + 0.25, yTop, wTop / 2 + 0.4), 0.12 - li * 0.02, 6));
      if (li > 0 || mi === 2) sparG.push(tube(V(M.x + 0.25, yBot, -wBot / 2 - 0.3), V(M.x + 0.25, yBot, wBot / 2 + 0.3), 0.13, 6));
      const g = new THREE.PlaneGeometry(1, 1, 14, 12);
      const base = g.attributes.position.array.slice();
      const mesh = new THREE.Mesh(g, sailMat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      body.add(mesh);
      sails.push({ mesh, base, x: M.x + 0.3, yTop, yBot: yBot + (li === 0 && mi !== 2 ? 1.2 : 0), wTop, wBot, depth: 0.9 + 0.35 * (yTop - yBot) / 6, seed: mi * 3 + li });
    });
    // shrouds to the channels on each side, a stay forward
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
      const hx = M.x - 1.0 + k * 0.6;
      rigG.push(tube(V(hx, deckAt(hx) + 0.9, side * halfBeam(hx) * 1.02), V(M.x, yb + M.h * 0.48, side * 0.9), 0.035, 4));
      if (k < 2) rigG.push(tube(V(M.x, yb + M.h * 0.5, side * 1.4), V(M.x, yb + M.h * 0.78, side * 0.4), 0.03, 4));
    }
    const fwd = mi === 0 ? bowTip : V(MASTS[mi - 1].x, deckAt(MASTS[mi - 1].x) + 1.2, 0);
    rigG.push(tube(V(M.x, yb + M.h * 0.5, 0), fwd, 0.05, 4));
    rigG.push(tube(V(M.x, yb + M.h * 0.98, 0), mi === 0 ? bowTip : V(MASTS[mi - 1].x, yb + MASTS[mi - 1].h * 0.78, 0), 0.03, 4));
    // backstays
    for (const side of [-1, 1]) { const hx = M.x - 4.5; rigG.push(tube(V(hx, deckAt(hx) + 0.9, side * halfBeam(hx)), V(M.x, yb + M.h * 0.95, 0), 0.025, 4)); }
  });
  // the jibs (forward of the foremast) and the spanker (aft, on a gaff)
  const fore = MASTS[0], foreY = deckAt(fore.x);
  const tri = (a, b, c, seed2) => {
    const g = new THREE.BufferGeometry();
    const N = 10, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N - i; j++) {
      const u = i / N, v = j / N;
      const p = a.clone().multiplyScalar(1 - u - v).add(b.clone().multiplyScalar(u)).add(c.clone().multiplyScalar(v));
      pos.push(p.x, p.y, p.z); uv.push(u, v);
    }
    let k = 0; const row = [];
    for (let i = 0; i <= N; i++) { row.push(k); k += N - i + 1; }
    for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
      const p0 = row[i] + j, p1 = row[i + 1] + j, p2 = row[i] + j + 1;
      idx.push(p0, p1, p2);
      if (j < N - i - 1) idx.push(p1, row[i + 1] + j + 1, p2);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, sailMat); mesh.castShadow = true; body.add(mesh);
    sails.push({ mesh, tri: true, base: g.attributes.position.array.slice(), uvs: uv, seed: seed2, normal: new THREE.Vector3(0, 0, 1) });
  };
  tri(V(fore.x + 0.5, foreY + fore.h * 0.47, 0), V(bowTip.x - 0.3, bowTip.y, 0), V(L / 2 + 1.0, deckAt(L / 2) + 1.4, 0), 21);
  tri(V(fore.x + 0.5, foreY + fore.h * 0.8, 0), V(bowTip.x + 2.6, bowTip.y + 0.7, 0), V(L / 2 + 3.5, deckAt(L / 2) + 1.9, 0), 22);
  const aft = MASTS[MASTS.length - 1], aftY = deckAt(aft.x);
  sparG.push(tube(V(aft.x - 0.3, aftY + 1.9, 0), V(-L / 2 - 2.5, aftY + 2.6, 0), 0.11, 6));     // boom
  sparG.push(tube(V(aft.x - 0.3, aftY + aft.h * 0.45, 0), V(aft.x - 7.5, aftY + aft.h * 0.56, 0), 0.1, 6));  // gaff
  tri(V(aft.x - 0.4, aftY + 2.1, 0), V(aft.x - 0.4, aftY + aft.h * 0.44, 0), V(-L / 2 - 2.2, aftY + 2.6, 0), 31);
  tri(V(aft.x - 0.4, aftY + aft.h * 0.44, 0), V(aft.x - 7.3, aftY + aft.h * 0.55, 0), V(-L / 2 - 2.2, aftY + 2.6, 0), 32);
  add(mergeGeos(sparG.map((g) => tint(g.index ? g.toNonIndexed() : g, '#ffffff'))), spar);
  const rig = add(mergeGeos(rigG.map((g) => tint(g.toNonIndexed(), '#ffffff'))), new THREE.MeshStandardMaterial({ color: new THREE.Color('#2A2018'), roughness: 0.8 }), false);

  // the ensign at the gaff end
  let flagMesh = null;
  if (flag) {
    const fg = new THREE.PlaneGeometry(2.6, 1.4, 12, 4); fg.translate(1.3, 0, 0);
    flagMesh = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.8 }));
    flagMesh.userData.base = fg.attributes.position.array.slice();
    flagMesh.position.set(aft.x - 7.5, aftY + aft.h * 0.56 - 0.8, 0); flagMesh.rotation.y = Math.PI;
    body.add(flagMesh);
  }

  // ---------------------------------------------------------------- the cargo: ice packed in sawdust
  let ice = null, sawdust = null;
  if (holdBlocks) {
    const cols = 11, rows = 5;
    ice = iceBlocks(cols * rows * 2, { glow: 0.3 });
    body.add(ice.mesh);
    const sdMat = sawdustMaterial();
    const sg = new THREE.PlaneGeometry(x1 - x0 + 0.4, 2 * zw(0) + 0.4, 40, 16); sg.rotateX(-Math.PI / 2);
    sawdust = new THREE.Mesh(sg, sdMat);
    sawdust.position.set((x0 + x1) / 2, deckAt(0) - 0.55, 0); sawdust.receiveShadow = true;
    body.add(sawdust);
    const r3 = mulberry(seed + 11);
    const layout = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = x0 + 0.55 + (x1 - x0 - 1.1) * (i + 0.5) / cols, w = zw(x) - 0.5;
      const z = -w + 2 * w * (j + 0.5) / rows;
      layout.push({ x: x + (r3() - 0.5) * 0.06, z: z + (r3() - 0.5) * 0.06, yaw: (r3() - 0.5) * 0.1, s: 0.9 + 0.12 * r3() });
    }
    group.userData.layout = layout;
    const n = layout.length;
    const setHold = (meltK = 0, level = 1) => {
      const y0 = deckAt(0) - 0.95;
      layout.forEach((b, i) => {
        const m = Math.min(1, meltK * (0.8 + 0.4 * ((i * 0.618) % 1)));
        ice.set(i, { x: b.x, y: y0 + 0.09 * Math.sin(i * 2.7), z: b.z, yaw: b.yaw, rx: 0.04 * Math.sin(i * 1.3), rz: 0.04 * Math.cos(i * 1.9), sx: 0.44 * b.s, sy: 0.38, sz: 0.44 * b.s, round: 0.1, melt: m });
        ice.set(i + n, { hide: true });
      });
      ice.commit();
      sawdust.position.y = y0 + 0.4 * level;
    };
    setHold(0, 1);
    group.userData.setHold = setHold;
  }

  // ---------------------------------------------------------------- per-frame
  const tmp = new THREE.Vector3();
  function set(t, { wind = 1, gust = 0, furl = false } = {}) {
    for (const s of sails) s.mesh.visible = !furl;
    for (const s of sails) {
      if (furl) continue;
      const p = s.mesh.geometry.attributes.position;
      if (s.tri) {
        // fore-and-aft sails: belly out to starboard, breathing
        for (let i = 0; i < p.count; i++) {
          const u = s.uvs[i * 2], v = s.uvs[i * 2 + 1], w = 1 - u - v;
          const belly = 4 * u * v * w * 2.6 * (0.9 + 0.1 * Math.sin(t * 1.3 + s.seed)) * wind;
          p.setXYZ(i, s.base[i * 3], s.base[i * 3 + 1], s.base[i * 3 + 2] + belly + 0.04 * Math.sin(t * 5 + u * 9 + s.seed) * w);
        }
      } else {
        for (let i = 0; i < p.count; i++) {
          const u = s.base[i * 3] + 0.5, v = s.base[i * 3 + 1] + 0.5;        // u across, v up
          const width = s.wBot + (s.wTop - s.wBot) * v;
          const y = s.yBot + (s.yTop - s.yBot) * v;
          const z = (u - 0.5) * width;
          const shape = Math.sin(Math.PI * u) ** 0.8 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, v * 0.9 + 0.1)));
          const breathe = 0.92 + 0.06 * Math.sin(t * 0.9 + s.seed) + 0.03 * Math.sin(t * 2.3 + s.seed * 2) + gust;
          const ripple = 0.03 * Math.sin(t * 6 + u * 10 + v * 4 + s.seed) * (1 - v);
          p.setXYZ(i, s.x + s.depth * shape * breathe * wind + ripple, y, z);
          if (i < 0) tmp.set(0, 0, 0);
        }
      }
      p.needsUpdate = true;
      s.mesh.geometry.computeVertexNormals();
    }
    if (flagMesh) {
      const p = flagMesh.geometry.attributes.position, b = flagMesh.userData.base;
      for (let i = 0; i < p.count; i++) {
        const x = b[i * 3];
        p.setZ(i, 0.22 * x / 2.6 * Math.sin(t * 7 - x * 2.4) + 0.08 * Math.sin(t * 11 - x * 4));
        p.setY(i, b[i * 3 + 1] - 0.05 * x);
      }
      p.needsUpdate = true; flagMesh.geometry.computeVertexNormals();
    }
  }
  /** Ride the sea: heave, pitch and roll from the wave field sampled at the bow, stern and both sides. */
  function rideOn(wave, x, z, heading, t, amp = 1) {
    const d = V(Math.cos(heading), 0, -Math.sin(heading)), s = V(-d.z, 0, d.x);
    const hl = L * 0.36, hb = SHIP.B * 0.45;
    const at = (a, b) => wave(x + d.x * a + s.x * b, z + d.z * a + s.z * b, t, amp).y;
    const hB = at(hl, 0), hS = at(-hl, 0), hP = at(0, -hb), hSt = at(0, hb), hC = at(0, 0);
    const heave = 0.35 * hC + 0.65 * (hB + hS + hP + hSt) / 4;
    const pitch = Math.atan2(hB - hS, 2 * hl) * 0.8;
    const roll = Math.atan2(hSt - hP, 2 * hb) * 0.7 + 0.035;      // heeling a little to leeward
    group.position.set(x, heave - 0.1, z);
    group.rotation.set(0, heading, 0);
    body.rotation.set(roll, 0, pitch, 'XZY');
    return { heave, pitch, roll };
  }
  return { group, body, hull, deck, sails, ice, sawdust, set, rideOn, hatch: { x0, x1, zw: zw(0) }, rig };
}

export function sawdustMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#B48650'), roughness: 0.95 });
  return patch(m, {
    vHead: 'varying vec3 vW2;',
    vert: { '#include <worldpos_vertex>': '#include <worldpos_vertex>\nvW2 = (modelMatrix * vec4(transformed, 1.)).xyz;' },
    fHead: 'varying vec3 vW2; float h12(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      vec3 q = vW2;
      float flake = vnoise3(q * 140.) * 0.45 + vnoise3(q * 47.) * 0.35 + vnoise3(q * 13.) * 0.2;
      float clump = vnoise3(q * 3.5) * 0.6 + vnoise3(q * 9.) * 0.4;
      diffuseColor.rgb *= (0.62 + 0.55 * flake) * (0.78 + 0.35 * clump);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.74, 0.5), smoothstep(0.78, 0.86, vnoise3(q * 210.)) * 0.5);` },
  });
}
