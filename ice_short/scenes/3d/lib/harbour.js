// scenes/3d/lib/harbour.js -- a tropical harbour, in two dressings:
//   'martinique'  Saint-Pierre in 1806: a black-sand-and-gold beach, a wooden pier, a waterfront of stone houses with
//                 ochre and pastel walls and red tile roofs, palms, and green volcanic hills (Mont Pelee) behind.
//   'calcutta'    the Hooghly in 1833: stone ghats down to brown water, white colonnaded buildings with flat roofs and
//                 balustrades, a few domes, palms in the haze, and the ice house (built on its own later in the film).
// buildHarbour(P, kind) -> { group, height(x, z), landTex (for the sea's shallows/foam), box, pier: {x, z, y, len, dir} }
// Local coordinates: the shore runs along z, the sea is toward -x, the pier sticks out along -x at z = 0.
import * as THREE from 'three';
import { patch, tint, mulberry, fbm, vnoise } from './common.js';
import { mergeGeos } from './figures.js';
import { woodMat } from './ship.js';

const SIZE = 2400;              // the terrain patch (m), centred on the pier root

export function makeHeight(kind) {
  const cal = kind === 'calcutta';
  return (x, z) => {
    // shore line wiggles a little; land rises toward +x
    const shore = 8 * Math.sin(z * 0.004 + 1) + 5 * fbm(z * 0.01, 3.3) + (cal ? 0 : 22 * Math.max(0, Math.abs(z) / 300 - 1) ** 1.4);
    const d = x - shore;                                      // > 0 inland
    let h;
    if (d < 0) h = Math.max(-40, d * (cal ? 0.12 : 0.09)) - 0.4;                // the sea floor shelving away
    else if (d < 30) h = cal ? Math.min(2.8, d * 0.35) : 2.4 * (1 - Math.exp(-d / 9)); // beach / ghat bank
    else h = cal ? 2.8 + 0.5 * fbm(x * 0.01, z * 0.01) : 2.4 + (d - 30) * 0.035;
    if (!cal) {
      // the hills: Mont Pelee and its shoulders, rising behind the town
      const hx = x - 900, hz = z - 300;
      h += 260 * Math.exp(-(hx * hx + hz * hz) / (2 * 520 * 520)) * Math.min(1, Math.max(0, (d - 140) / 300));
      h += 70 * Math.max(0, fbm(x * 0.004, z * 0.004) - 0.35) * Math.min(1, Math.max(0, (d - 90) / 200));
      h += 1.2 * (fbm(x * 0.05, z * 0.05) - 0.5) * Math.min(1, Math.max(0, d / 40));
    }
    // a flat quay strip where the town sits
    if (d > 6 && d < 70) h = h * 0.3 + (cal ? 2.8 : 2.6) * 0.7;
    return h;
  };
}

function terrain(kind, H) {
  const N = 260, R = SIZE / 2;
  const g = new THREE.PlaneGeometry(2, 2, N, N); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const C = (h) => new THREE.Color(h);
  const cal = kind === 'calcutta';
  const sand = C(cal ? '#9A8466' : '#C9A774'), wetSand = C(cal ? '#5E5040' : '#7A6448'), grass = C(cal ? '#7E8A4E' : '#4E7A34'),
    jungle = C(cal ? '#56683A' : '#2C5422'), rock = C('#6A6258'), seabed = C(cal ? '#4A4232' : '#3E7A70');
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getZ(i);
    const x = Math.sign(u) * Math.abs(u) ** 2.0 * R + 60, z = Math.sign(v) * Math.abs(v) ** 2.0 * R;
    const y = H(x, z);
    p.setXYZ(i, x, y, z);
    let c;
    if (y < -0.6) c = seabed.clone().lerp(sand, Math.max(0, 1 + y / 4) * 0.7);
    else if (y < 0.5) c = wetSand.clone();
    else if (y < 2.2) c = sand.clone().lerp(wetSand, Math.max(0, 1 - y) * 0.6);
    else {
      const n = fbm(x * 0.02, z * 0.02);
      c = grass.clone().lerp(jungle, Math.min(1, Math.max(0, (y - 10) / 40) + n * 0.5));
      if (y > 160) c.lerp(rock, Math.min(1, (y - 160) / 80) * 0.5);
    }
    const k = 0.85 + 0.3 * vnoise(x * 0.3, z * 0.3);
    col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  patch(m, {
    vHead: 'varying vec3 vW3;',
    vert: { '#include <worldpos_vertex>': '#include <worldpos_vertex>\nvW3 = (modelMatrix * vec4(transformed, 1.)).xyz;' },
    fHead: 'varying vec3 vW3;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      diffuseColor.rgb *= 0.86 + 0.28 * fbm(vW3.xz * 0.7) ;
      diffuseColor.rgb *= 0.92 + 0.12 * vnoise(vW3.xz * 9.);` },
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true; mesh.castShadow = false;
  return mesh;
}

function landTexture(H) {
  const N = 256, data = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -SIZE / 2 + SIZE * (i + 0.5) / N + 60, z = -SIZE / 2 + SIZE * (j + 0.5) / N;
    data[j * N + i] = THREE.DataUtils.toHalfFloat(Math.min(1, Math.max(0, 0.5 + H(x, z) / 120)));
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------- palms
function palmGeometry(seed) {
  const r = mulberry(seed);
  const parts = [];
  const hgt = 7 + r() * 5, bend = 0.8 + r() * 1.6, segs = 14;
  const pts = [];
  for (let i = 0; i <= segs; i++) { const u = i / segs; pts.push(new THREE.Vector3(bend * u * u, hgt * u, 0)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.TubeGeometry(curve, 24, 0.17, 8, false);
  const tp = trunk.attributes.position, tuv = trunk.attributes.uv;
  for (let i = 0; i < tp.count; i++) {
    const u = tuv.getX(i); const c = curve.getPoint(u);
    const k = (1.25 - 0.4 * u) * (1 + 0.07 * Math.sin(u * segs * 2 * Math.PI * 2.5));
    tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * k, tp.getY(i), c.z + (tp.getZ(i) - c.z) * k);
  }
  trunk.computeVertexNormals();
  parts.push(tint(trunk, '#7A6650'));
  const top = pts[segs];
  const nF = 11;
  for (let f = 0; f < nF; f++) {
    const a = f / nF * Math.PI * 2 + r() * 0.3, len = 3.6 + r() * 1.4, droop = 0.6 + r() * 0.5;
    const pos = [], idx = [], col = [];
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const cx = Math.cos(a) * len * u, cz = Math.sin(a) * len * u, cy = 0.9 * u - droop * 2.4 * u * u;
      const w = 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - 0.3 * u);
      const px = -Math.sin(a), pz = Math.cos(a);
      for (const s of [-1, 0, 1]) {
        const jag = s === 0 ? 0 : (i % 2 ? 0.75 : 1);
        pos.push(top.x + cx + px * w * s * jag, top.y + cy - (s === 0 ? -0.08 : 0.18 * Math.abs(s)) * u, top.z + cz + pz * w * s * jag);
        const g = 0.8 + 0.2 * (s === 0 ? 1 : 0);
        col.push(0.25 * g, 0.45 * g, 0.16 * g);
      }
    }
    for (let i = 0; i < N; i++) { const b = i * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    parts.push(g);
  }
  const nuts = new THREE.SphereGeometry(0.35, 8, 6); nuts.translate(top.x, top.y - 0.25, top.z); parts.push(tint(nuts, '#4E5A2A'));
  return mergeGeos(parts);
}

export function palms(list, seed = 5) {
  const group = new THREE.Group();
  const variants = [0, 1, 2].map((k) => palmGeometry(seed * 10 + k));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  patch(mat, { uniforms: { uT: { value: 0 } }, vHead: 'uniform float uT;',
    vert: { '#include <begin_vertex>': `#include <begin_vertex>
      float sway = max(position.y - 5., 0.) * 0.012;
      vec4 ip = instanceMatrix * vec4(0., 0., 0., 1.);
      transformed.x += sway * sin(uT * 1.3 + ip.x * 0.1 + ip.z * 0.07) ; transformed.z += sway * 0.6 * cos(uT * 1.1 + ip.z * 0.1);` } });
  const byV = [[], [], []];
  list.forEach((p, i) => byV[i % 3].push(p));
  const meshes = [];
  byV.forEach((ps, k) => {
    const m = new THREE.InstancedMesh(variants[k], mat, Math.max(1, ps.length));
    const M = new THREE.Matrix4();
    ps.forEach((p, i) => { M.makeRotationY(p.yaw); M.scale(new THREE.Vector3(p.s, p.s, p.s)); M.setPosition(p.x, p.y, p.z); m.setMatrixAt(i, M); });
    m.count = ps.length; m.castShadow = true; m.receiveShadow = true;
    group.add(m); meshes.push(m);
  });
  group.userData.mat = mat;
  return group;
}

// ---------------------------------------------------------------- buildings
function houseMaterial(kind) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  return patch(m, {
    vHead: 'varying vec3 vL3; varying vec3 vN3; attribute float aWall;  varying float vWall;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL3 = (instanceMatrix * vec4(position, 1.)).xyz; vN3 = normal; vWall = aWall;' },
    fHead: 'varying vec3 vL3; varying vec3 vN3; varying float vWall;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      if (vWall > 0.5) {
        // windows and doors with shutters, in a regular bay rhythm; plaster stains low down
        vec2 q = vec2(abs(vN3.x) > 0.5 ? vL3.z : vL3.x, vL3.y);
        vec2 cell = vec2(fract(q.x / 3.2), fract((q.y - 0.4) / 3.6));
        float win = step(0.32, cell.x) * step(cell.x, 0.68) * step(0.25, cell.y) * step(cell.y, 0.82) * step(1.0, q.y);
        float sh = (step(0.2, cell.x) * step(cell.x, 0.32) + step(0.68, cell.x) * step(cell.x, 0.8)) * step(0.25, cell.y) * step(cell.y, 0.82) * step(1.0, q.y);
        vec3 shutter = ${kind === 'calcutta' ? 'vec3(0.18, 0.32, 0.22)' : 'vec3(0.16, 0.3, 0.2)'};
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.04, 0.035), win);
        diffuseColor.rgb = mix(diffuseColor.rgb, shutter * (0.8 + 0.3 * step(0.5, fract(q.y * 6.))), sh);
        diffuseColor.rgb *= 0.88 + 0.16 * fbm(q * 0.7) - 0.12 * smoothstep(1.2, 0.0, q.y - floor(q.y / 100.) * 100.);
      } else {
        // roof tiles
        float rows = smoothstep(0.75, 1.0, abs(fract(vL3.y * 4.5) - 0.5) * 2.);
        diffuseColor.rgb *= 0.85 + 0.25 * vnoise(vL3.xz * 3.) - rows * 0.18;
      }` },
  });
}

function houseGeometry(kind) {
  // unit house: 1 x 1 x 1 walls (centred in x/z, base at 0) and a hip roof (Martinique) or a flat roof with a
  // balustrade and a colonnade (Calcutta)
  const walls = new THREE.BoxGeometry(1, 1, 1); walls.translate(0, 0.5, 0);
  const wallAttr = (g, v) => { g.setAttribute('aWall', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1)); return g; };
  const parts = kind === 'roofonly' ? [] : [wallAttr(tint(walls.toNonIndexed(), '#ffffff'), 1)];
  if (kind === 'calcutta') {
    const cornice = new THREE.BoxGeometry(1.06, 0.06, 1.06); cornice.translate(0, 1.0, 0);
    const bal = new THREE.BoxGeometry(1.04, 0.1, 1.04); bal.translate(0, 1.1, 0);
    parts.push(wallAttr(tint(cornice.toNonIndexed(), '#F4F0E8'), 1), wallAttr(tint(bal.toNonIndexed(), '#ECE6DA'), 1));
    for (let k = 0; k < 8; k++) {
      const c = new THREE.CylinderGeometry(0.022, 0.026, 0.62, 8); c.translate(-0.44 + k * 0.125, 0.31, -0.56);
      parts.push(wallAttr(tint(c.toNonIndexed(), '#F6F2EA'), 1));
    }
    const ver = new THREE.BoxGeometry(1.02, 0.04, 0.14); ver.translate(0, 0.64, -0.55); parts.push(wallAttr(tint(ver.toNonIndexed(), '#ECE6DA'), 1));
  } else {
    const roof = new THREE.ConeGeometry(0.78, 0.45, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1, 1, 1); roof.translate(0, 1.22, 0);
    parts.push(wallAttr(tint(roof.toNonIndexed(), '#ffffff'), 0));
  }
  return mergeGeos(parts.map((g) => g)).setAttribute('aWall', mergeAttr(parts, 'aWall'));
}
function mergeAttr(parts, name) {
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const a = new Float32Array(n); let o = 0;
  for (const g of parts) { a.set(g.attributes[name].array, o); o += g.attributes.position.count; }
  return new THREE.BufferAttribute(a, 1);
}

export function buildHarbour(P, kind = 'martinique', seed = 3) {
  const cal = kind === 'calcutta';
  const H = makeHeight(kind);
  const group = new THREE.Group();
  group.add(terrain(kind, H));
  const landTex = landTexture(H);
  const r = mulberry(seed);
  // the pier: from the shore out into the sea along -x
  const pier = { x0: 12, x1: -46, z: 0, y: 2.25, w: 4.2 };
  const pw = woodMat(cal ? '#8A7458' : '#9A7650', { plank: 0.28, along: 'z' });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(pier.x0 - pier.x1, 0.24, pier.w), pw);
  deck.position.set((pier.x0 + pier.x1) / 2, pier.y, pier.z); deck.castShadow = true; deck.receiveShadow = true;
  group.add(deck);
  const postG = [];
  for (let k = 0; k <= 14; k++) for (const s of [-1, 1]) {
    const x = pier.x1 + 0.3 + (pier.x0 - pier.x1 - 0.6) * k / 14;
    const c = new THREE.CylinderGeometry(0.17, 0.2, 9, 8); c.translate(x, pier.y - 4.4 + 0.25, s * (pier.w / 2 - 0.1)); postG.push(tint(c, '#ffffff'));
    if (k % 3 === 0) { const b = new THREE.CylinderGeometry(0.16, 0.2, 0.45, 10); b.translate(x, pier.y + 0.32, s * (pier.w / 2 - 0.3)); postG.push(tint(b, '#ffffff')); }
  }
  const posts = new THREE.Mesh(mergeGeos(postG), woodMat('#4A3826', { plank: 1, along: 'y' }));
  posts.castShadow = true; posts.receiveShadow = true; group.add(posts);
  // stone steps (ghats) or a sea wall along the shore
  const stepG = [];
  for (let k = 0; k < (cal ? 12 : 3); k++) {
    const b = new THREE.BoxGeometry(cal ? 1.2 : 2.0, 0.3, cal ? 160 : 60);
    b.translate(14 - k * (cal ? 1.1 : 1.6), 2.5 - k * 0.3 - 0.15, cal ? -10 : 40);
    stepG.push(tint(b, cal ? '#B9A88C' : '#77706A'));
  }
  const steps = new THREE.Mesh(mergeGeos(stepG), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  steps.receiveShadow = true; steps.castShadow = true; group.add(steps);
  // the waterfront: rows of houses along the quay (z), a street in front (x ~ 22..30)
  const hg = houseGeometry(kind);
  const hm = houseMaterial(kind);
  const list = [];
  const walls = cal ? ['#F2EEE4', '#EDE5D4', '#E9DCC4', '#F4EFE4', '#E2D2B6'] : ['#E2B76A', '#D99A5B', '#EAD3A4', '#C9C29E', '#E8E0CC', '#D3A07A', '#BFD3C7'];
  for (let row = 0; row < (cal ? 3 : 4); row++) {
    let z = -260;
    while (z < 260) {
      const w = (cal ? 16 : 9) + r() * (cal ? 12 : 7), d = (cal ? 13 : 9) + r() * 4, h = (cal ? 8.5 : 6.5) + r() * (cal ? 4 : 3) + (row === 0 ? 0 : 2.5);
      const x = 34 + row * (cal ? 26 : 16) + r() * 3;
      if (!(Math.abs(z + w / 2) < 9 && row === 0 && !cal)) list.push({ x, z: z + w / 2, w, d, h, c: walls[Math.floor(r() * walls.length)] });
      z += w + (cal ? 4 : 1.2) + r() * (cal ? 6 : 2);
    }
  }
  const houses = new THREE.InstancedMesh(hg, hm, list.length);
  const M = new THREE.Matrix4();
  list.forEach((b, i) => {
    const y = H(b.x, b.z) - 0.2;
    M.makeScale(b.d, b.h, b.w); M.setPosition(b.x, y, b.z); houses.setMatrixAt(i, M);
    houses.setColorAt(i, new THREE.Color(b.c));
  });
  houses.castShadow = true; houses.receiveShadow = true;
  group.add(houses);
  // roof colour (Martinique: red tiles): the roof parts carry white vertex colour -> tinted by the instance colour;
  // give the roofs their own instanced copy so they can be red
  if (!cal) {
    const roofs = new THREE.InstancedMesh(houseGeometry('roofonly'), hm, list.length);
    list.forEach((b, i) => {
      const y = H(b.x, b.z) - 0.2;
      M.makeScale(b.d * 1.04, b.h, b.w * 1.04); M.setPosition(b.x, y + 0.01, b.z); roofs.setMatrixAt(i, M);
      roofs.setColorAt(i, new THREE.Color(['#A8452E', '#B4553A', '#9A3E2A', '#8E4A34'][i % 4]));
    });
    roofs.castShadow = true; roofs.receiveShadow = true;
    // hide the walls of this copy by scaling them into the roof (only roofs show over the coloured walls)
    group.add(roofs);
  }
  // a church tower / a dome for the skyline
  const lm = new THREE.MeshStandardMaterial({ color: new THREE.Color(cal ? '#F2EDE2' : '#E8DEC8'), roughness: 0.8 });
  if (cal) {
    for (const [x, z, s] of [[95, -120, 1], [110, 160, 0.8], [130, 40, 1.2]]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(7 * s, 7 * s, 8 * s, 24), lm); drum.position.set(x, H(x, z) + 18 * s, z);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(7.4 * s, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lm); dome.position.set(x, H(x, z) + 22 * s, z);
      drum.castShadow = dome.castShadow = true; group.add(drum, dome);
    }
  } else {
    const t = new THREE.Mesh(new THREE.BoxGeometry(6, 18, 6), lm); t.position.set(56, H(56, -40) + 9, -40); t.castShadow = true; group.add(t);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(4.6, 6, 4), new THREE.MeshStandardMaterial({ color: '#7A3A2A', roughness: 0.8 })); sp.rotation.y = Math.PI / 4; sp.position.set(56, H(56, -40) + 21, -40); group.add(sp);
  }
  // palms along the shore and up the hills; jungle lumps on the hills (Martinique)
  const pl = [];
  for (let k = 0; k < (cal ? 70 : 140); k++) {
    const z = -420 + r() * 840, x = (k % 3 === 0 ? 14 + r() * 10 : 30 + r() * (cal ? 200 : 260));
    if (Math.abs(z) < 7 && x < 30) continue;
    if (cal && x > 4 && x < 40 && z > -36 && z < 28) continue;
    if (list.some((b) => Math.abs(b.x - x) < b.d / 2 + 2 && Math.abs(b.z - z) < b.w / 2 + 2)) continue;
    pl.push({ x, y: H(x, z) - 0.3, z, yaw: r() * 6.28, s: 0.85 + r() * 0.4 });
  }
  const palmGroup = palms(pl, seed);
  group.add(palmGroup);
  if (!cal) {
    const jg = new THREE.IcosahedronGeometry(1, 1);
    const jungle = new THREE.InstancedMesh(jg, new THREE.MeshStandardMaterial({ color: new THREE.Color('#2E5A26'), roughness: 0.9, flatShading: true }), 1400);
    let n = 0;
    for (let k = 0; k < 4000 && n < 1400; k++) {
      const x = 120 + r() * 1000, z = -700 + r() * 1400, y = H(x, z);
      if (y < 8) continue;
      const s = 6 + r() * 10;
      M.makeScale(s, s * 0.7, s); M.setPosition(x, y + s * 0.2, z); jungle.setMatrixAt(n, M);
      const g = 0.75 + 0.4 * r(); jungle.setColorAt(n, new THREE.Color(0.18 * g, 0.36 * g, 0.15 * g)); n++;
    }
    jungle.count = n; jungle.receiveShadow = true;
    group.add(jungle);
  }
  return { group, height: H, landTex, box: { x0: 60, z0: 0, size: SIZE }, pier, palms: palmGroup };
}
