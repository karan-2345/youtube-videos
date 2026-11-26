// scenes/3d/tower.js -- the Leaning Tower of Pisa, built procedurally, one merged geometry per floor.
//
// Units are metres. Floor 0 = ground floor (blind arcade of 15 arches on engaged columns, lozenges in the lunettes),
// floors 1-6 = open galleries (30 columns and arches each, an inner wall, a moulded cornice on corbels),
// floor 7 = the bell chamber (16 arched openings, bells, a low roof). Every floor's geometry starts at y = 0 and
// ends with a cap (its cornice top) that is also the floor of the next gallery.
//
// Attributes: position, normal, color (tint x ambient occlusion, baked), aPat (arc length s, height y, joint flag)
// for the marble shader's stone courses.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const R_GROUND = 7.6;        // outer wall radius, ground floor
export const R_COL = 7.33;          // gallery columns
export const R_INNER = 5.75;        // gallery inner wall
export const R_WELL = 2.3;          // the hollow core
export const H = [10.8, 6.3, 6.3, 6.3, 6.3, 6.3, 6.3, 6.6];   // floor heights (56 m in all)
export const R_FOUND = 9.8;         // foundation ring

const TAU = Math.PI * 2;
const WHITE = [1, 1, 1];

// ------------------------------------------------------------------ helpers
function prep(g, { tint = WHITE, ao = null, joint = 0, yBase = 0 } = {}) {
  g = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = p.count;
  const col = new Float32Array(n * 3), pat = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = ao ? ao(x, y, z) : 1;
    col[i * 3] = tint[0] * a; col[i * 3 + 1] = tint[1] * a; col[i * 3 + 2] = tint[2] * a;
    const r = Math.hypot(x, z);
    pat[i * 3] = Math.atan2(z, x) * Math.max(r, 0.5);
    pat[i * 3 + 1] = y + yBase;
    pat[i * 3 + 2] = joint;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aPat', new THREE.BufferAttribute(pat, 3));
  return g;
}

/** Place a geometry at angle phi on radius r (its local +z points outward, +x along the tangent). */
function around(g, phi, r, y = 0) {
  const m = new THREE.Matrix4().makeRotationY(-phi + Math.PI / 2);   // local +z -> (cos phi, 0, sin phi)
  m.setPosition(r * Math.cos(phi), y, r * Math.sin(phi));
  return g.clone().applyMatrix4(m);
}

/** Bend a flat panel (x along the tangent, y up, z outward, z = 0 at the inner face) around a cylinder. */
function bend(g, phi0, rIn) {
  g = g.index ? g.toNonIndexed() : g.clone();
  const p = g.attributes.position, nrm = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i), v = p.getY(i), w = p.getZ(i);
    const phi = phi0 - u / rIn, r = rIn + w;       // (u, v, w) -> (tangent, up, radial): right-handed
    const c = Math.cos(phi), s = Math.sin(phi);
    p.setXYZ(i, r * c, v, r * s);
    if (nrm) {
      const nu = nrm.getX(i), nv = nrm.getY(i), nw = nrm.getZ(i);
      // tangent (s, 0, -c), up (0, 1, 0), radial (c, 0, s)
      nrm.setXYZ(i, s * nu + c * nw, nv, -c * nu + s * nw);
    }
  }
  return g;
}

function ring(rIn, rOut, y, segs = 96, up = true, litFromAbove = false) {
  const g = new THREE.RingGeometry(rIn, rOut, segs, 1);
  g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, y, 0);
  if (litFromAbove) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  return g;
}

function tube(r, y0, y1, segs = 96, inward = false) {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, segs, 1, true);
  g.translate(0, (y0 + y1) / 2, 0);
  if (inward) {                             // flip winding and normals: faces the axis
    g.scale(-1, 1, 1);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  }
  return g;
}

/** Lathe a moulding profile [[r, y], ...] (bottom to top). */
function moulding(profile, segs = 96) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

// a gallery column: base, slightly tapered shaft, flared capital, square abacus
function column(hShaft, rShaft = 0.19, seg = 12) {
  const parts = [];
  const base = new THREE.CylinderGeometry(rShaft * 1.42, rShaft * 1.55, 0.2, seg); base.translate(0, 0.1, 0); parts.push(base);
  const torus = new THREE.TorusGeometry(rShaft * 1.18, rShaft * 0.22, 5, seg); torus.rotateX(Math.PI / 2); torus.translate(0, 0.24, 0); parts.push(torus);
  const shaft = new THREE.CylinderGeometry(rShaft * 0.92, rShaft, hShaft, seg, 1, true); shaft.translate(0, 0.25 + hShaft / 2, 0); parts.push(shaft);
  const neck = new THREE.TorusGeometry(rShaft * 0.98, rShaft * 0.14, 4, seg); neck.rotateX(Math.PI / 2); neck.translate(0, 0.27 + hShaft, 0); parts.push(neck);
  const cap = new THREE.CylinderGeometry(rShaft * 1.65, rShaft * 0.95, 0.34, seg, 2); cap.translate(0, 0.25 + hShaft + 0.17, 0);
  // leaves: a little bulge halfway up the capital
  { const p = cap.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) - (0.25 + hShaft); if (Math.abs(y - 0.17) < 0.01) { p.setX(i, p.getX(i) * 1.12); p.setZ(i, p.getZ(i) * 1.12); } } cap.computeVertexNormals(); }
  parts.push(cap);
  const abacus = new THREE.BoxGeometry(rShaft * 3.6, 0.12, rShaft * 3.6); abacus.translate(0, 0.25 + hShaft + 0.34 + 0.06, 0); parts.push(abacus);
  return { geo: mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g).map((g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; })), top: 0.25 + hShaft + 0.46 };
}

/** One bay of an arcade band: a panel of width w, height h, with a round arch of radius a cut from the bottom,
 *  springing at y = 0. Thickness d. Flat, centred on x = 0, inner face z = 0. */
function arcadeBay(w, h, a, d, curve = 14) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-a, 0);
  for (let i = 1; i < curve; i++) {
    const ang = Math.PI - (i / curve) * Math.PI;
    s.lineTo(a * Math.cos(ang), a * Math.sin(ang));
  }
  s.lineTo(a, 0);
  s.lineTo(w / 2, 0);
  // the top edge in 4 pieces, so the band follows the curve of the tower
  s.lineTo(w / 2, h);
  for (let i = 1; i <= 4; i++) s.lineTo(w / 2 - (w * i) / 4, h);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: curve });
  return g;
}

/** A wall panel of width w and height h with an arched window (width ww, springing at ys, radius ww/2) cut through. */
function windowBay(w, h, ww, ys, d, curve = 12) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(0, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
  const hole = new THREE.Path();
  const a = ww / 2, yb = 0.35;
  hole.moveTo(-a, yb); hole.lineTo(a, yb); hole.lineTo(a, ys);
  for (let i = 1; i < curve; i++) { const ang = (i / curve) * Math.PI; hole.lineTo(a * Math.cos(ang), ys + a * Math.sin(ang)); }
  hole.lineTo(-a, ys); hole.lineTo(-a, yb);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: curve });
}

// ------------------------------------------------------------------ the cornice that tops every floor
function cornice(y0, rWall, rOut, rCap, nCorbel, tint, yBase) {
  const out = [];
  const prof = [[rWall, y0], [rWall + 0.04, y0 + 0.06], [rWall + 0.13, y0 + 0.13], [rWall + 0.13, y0 + 0.2],
    [rOut - 0.06, y0 + 0.26], [rOut, y0 + 0.33], [rOut, y0 + 0.45], [rOut - 0.04, y0 + 0.5], [rOut - 0.04, y0 + 0.55]];
  out.push(prep(moulding(prof), { tint, yBase, ao: (x, y) => (y < y0 + 0.2 ? 0.8 : 1) }));
  out.push(prep(ring(rCap, rOut - 0.04, y0 + 0.55), { tint, yBase }));
  // corbels under the overhang
  const corbel = new THREE.BoxGeometry(0.13, 0.16, 0.26);
  corbel.translate(0, 0, 0.13);
  for (let i = 0; i < nCorbel; i++) {
    const phi = (i + 0.5) / nCorbel * TAU;
    out.push(prep(around(corbel, phi, rWall + 0.02, y0 + 0.17), { tint, yBase, ao: () => 0.85 }));
  }
  return out;
}

// ------------------------------------------------------------------ floor 0: the ground floor
function groundFloor(c) {
  const g = [], yB = 0, h = H[0];
  const T = c.marble, T2 = c.inlay;
  // stepped plinth
  g.push(prep(moulding([[R_GROUND + 0.55, 0], [R_GROUND + 0.55, 0.32], [R_GROUND + 0.3, 0.32], [R_GROUND + 0.3, 0.62],
    [R_GROUND + 0.12, 0.66], [R_GROUND + 0.12, 0.78], [R_GROUND, 0.82]]), { tint: T, yBase: yB }));
  // the wall
  g.push(prep(tube(R_GROUND, 0.8, 10.25, 120), { tint: T, joint: 1, yBase: yB, ao: (x, y) => 0.92 + 0.08 * Math.min(1, (y - 0.8) / 3) }));
  // 15 engaged columns and the blind arches between them
  const n = 15, colH = 7.0;
  const { geo: col0, top } = column(colH, 0.36, 14);
  const archR = (TAU * R_GROUND / n) / 2 - 0.12;
  const yS = 0.8 + top;                       // springing line
  for (let i = 0; i < n; i++) {
    const phi = (i / n) * TAU + Math.PI / 2;  // a column faces +z (the camera side)
    g.push(prep(around(col0, phi, R_GROUND + 0.14, 0.8), { tint: T, yBase: yB, ao: (x, y) => 0.82 + 0.18 * Math.min(1, (y - 0.8) / 2) }));
    const mid = phi + Math.PI / n;
    // the arch moulding (two concentric rolls)
    for (const [rr, tt] of [[archR, 0.17], [archR - 0.24, 0.09]]) {
      const tor = new THREE.TorusGeometry(rr, tt, 6, 20, Math.PI);
      g.push(prep(around(tor, mid, R_GROUND + 0.05, yS), { tint: T, yBase: yB }));
    }
    // the lunette: a slightly recessed disc, a lozenge (dark green-grey inlay) and two small roundels
    const loz = new THREE.CylinderGeometry(0.62, 0.62, 0.05, 4, 1);
    loz.rotateX(Math.PI / 2); loz.scale(0.85, 1.25, 1);
    g.push(prep(around(loz, mid, R_GROUND + 0.02, yS + archR * 0.45), { tint: T2, yBase: yB }));
    const lozIn = new THREE.CylinderGeometry(0.36, 0.36, 0.06, 4, 1);
    lozIn.rotateX(Math.PI / 2); lozIn.scale(0.85, 1.25, 1);
    g.push(prep(around(lozIn, mid, R_GROUND + 0.035, yS + archR * 0.45), { tint: T, yBase: yB }));
    for (const s of [-1, 1]) {
      const rd = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 14, 1);
      rd.rotateX(Math.PI / 2);
      g.push(prep(around(rd, mid + s * 0.105, R_GROUND + 0.02, yS + 0.35), { tint: T2, yBase: yB }));
    }
    // a band of small lozenges above the arches
    const sl = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 4, 1); sl.rotateX(Math.PI / 2); sl.scale(1.0, 1.0, 1);
    g.push(prep(around(sl, phi, R_GROUND + 0.02, 9.75), { tint: T2, yBase: yB }));
  }
  // the door (facing +z, between two columns)
  const doorPhi = Math.PI / 2 + Math.PI / n;
  const door = new THREE.BoxGeometry(1.7, 3.6, 0.3); door.translate(0, 1.8, 0);
  g.push(prep(around(door, doorPhi, R_GROUND - 0.12, 0.8), { tint: c.dark, yBase: yB }));
  const lintel = new THREE.BoxGeometry(2.3, 0.35, 0.2); lintel.translate(0, 0, 0.1);
  g.push(prep(around(lintel, doorPhi, R_GROUND, 4.55), { tint: T, yBase: yB }));
  // the cornice and the floor of gallery 1 (with the hollow core open)
  g.push(...cornice(10.25, R_GROUND, R_GROUND + 0.42, R_WELL, 60, T, yB));
  g.push(prep(tube(R_WELL, h - 3.0, h, 48, true), { tint: c.dark, yBase: yB }));
  g.push(prep(ring(0, R_GROUND + 0.55, 0.0, 96, false, true), { tint: [0.8, 0.78, 0.75], yBase: yB }));
  return mergeGeometries(g);
}

// ------------------------------------------------------------------ floors 1-6: the open galleries
function gallery(k, c) {
  const g = [], h = H[k], yB = H.slice(0, k).reduce((a, b) => a + b, 0);
  const T = c.marble, n = 30;
  const bay = TAU / n;
  // the inner wall (in the gallery's shade) with doors, and the gallery ceiling
  g.push(prep(tube(R_INNER, 0, 5.75, 120), { tint: T, joint: 1, yBase: yB, ao: (x, y) => 0.36 + 0.1 * (1 - y / 5.75) }));
  const rnd = mulberry(k * 17 + 3);
  for (let d = 0; d < 2; d++) {
    const phi = rnd() * TAU;
    const door = new THREE.BoxGeometry(0.8, 1.9, 0.08); door.translate(0, 0.95, 0);
    g.push(prep(around(door, phi, R_INNER - 0.02, 0.0), { tint: c.dark, yBase: yB }));
  }
  g.push(prep(ring(R_INNER, R_COL - 0.1, 5.75, 120, false), { tint: T, yBase: yB, ao: () => 0.3 }));
  // stylobate (the step the columns stand on)
  g.push(prep(moulding([[R_COL - 0.42, 0], [R_COL + 0.42, 0], [R_COL + 0.42, 0.12], [R_COL - 0.42, 0.12]], 120), { tint: T, yBase: yB }));
  // 30 columns
  const { geo: col0, top } = column(3.75, 0.185, 10);
  const yS = 0.12 + top;
  for (let i = 0; i < n; i++) {
    const phi = (i + 0.5) * bay;
    g.push(prep(around(col0, phi, R_COL, 0.12), { tint: T, yBase: yB, ao: (x, y) => 0.8 + 0.2 * Math.min(1, y / 2) }));
  }
  // the arcade band above the columns, pierced by 30 arches, with a roll moulding on each arch
  const w = bay * R_COL, a = w / 2 - 0.16, d = 0.52;
  const bandH = 5.75 - yS;
  for (let i = 0; i < n; i++) {
    const mid = (i + 1) * bay;
    const panel = bend(arcadeBay(w, bandH, a, d), mid, R_COL - d / 2);
    panel.translate(0, yS, 0);
    g.push(prep(panel, { tint: T, joint: 1, yBase: yB, ao: (x, y, z) => (Math.hypot(x, z) < R_COL ? 0.55 : 1) }));
    const tor = new THREE.TorusGeometry(a + 0.05, 0.055, 5, 16, Math.PI);
    g.push(prep(around(tor, mid, R_COL + d / 2 + 0.01, yS), { tint: T, yBase: yB }));
  }
  g.push(...cornice(5.75, R_COL + d / 2, R_COL + 0.66, R_WELL, 60, T, yB));
  g.push(prep(tube(R_WELL, 0, h, 48, true), { tint: c.dark, yBase: yB }));
  g.push(prep(ring(R_WELL, R_COL + 0.42, 0.0, 96, false, true), { tint: [0.8, 0.78, 0.75], yBase: yB }));
  if (k === 6) {                                 // the railing around the top terrace
    const rail = new THREE.TorusGeometry(R_COL + 0.5, 0.035, 4, 160); rail.rotateX(Math.PI / 2); rail.translate(0, 6.3 + 1.0, 0);
    g.push(prep(rail, { tint: c.iron, yBase: yB }));
    const post = new THREE.BoxGeometry(0.05, 1.0, 0.05); post.translate(0, 6.3 + 0.5, 0);
    for (let i = 0; i < 72; i++) g.push(prep(around(post, (i / 72) * TAU, R_COL + 0.5), { tint: c.iron, yBase: yB }));
  }
  return mergeGeometries(g);
}

// ------------------------------------------------------------------ floor 7: the bell chamber
const R_BELL = 4.85;
function bellChamber(c) {
  const g = [], yB = H.slice(0, 7).reduce((a, b) => a + b, 0);
  const T = c.marble, n = 16, bay = TAU / n, d = 0.6;
  const w = bay * R_BELL;
  g.push(prep(moulding([[R_BELL + 0.35, 0], [R_BELL + 0.35, 0.3], [R_BELL + 0.15, 0.3], [R_BELL + 0.15, 0.45]], 96), { tint: T, yBase: yB }));
  for (let i = 0; i < n; i++) {
    const mid = (i + 0.5) * bay;
    const panel = bend(windowBay(w, 4.3, 1.05, 2.65, d), mid, R_BELL - d / 2);
    panel.translate(0, 0.45, 0);
    g.push(prep(panel, { tint: T, joint: 1, yBase: yB, ao: (x, y, z) => (Math.hypot(x, z) < R_BELL - 0.1 ? 0.35 : 1) }));
    const { geo: c0 } = column(3.1, 0.13, 8);
    g.push(prep(around(c0, mid + bay / 2, R_BELL + d / 2 + 0.05, 0.5), { tint: T, yBase: yB }));
    const tor = new THREE.TorusGeometry(0.62, 0.05, 5, 14, Math.PI);
    g.push(prep(around(tor, mid, R_BELL + d / 2 + 0.01, 0.45 + 2.65), { tint: T, yBase: yB }));
  }
  // dark interior so the openings read as deep
  g.push(prep(tube(R_BELL - d / 2 - 0.25, 0.4, 4.8, 48, true), { tint: c.dark, yBase: yB }));
  g.push(prep(ring(0, R_BELL + 0.35, 0.0, 64, false, true), { tint: [0.8, 0.78, 0.75], yBase: yB }));
  g.push(prep(ring(0, R_BELL - d / 2, 0.42, 48, true), { tint: c.dark, yBase: yB }));
  g.push(...cornice(4.75, R_BELL + d / 2, R_BELL + 0.75, 0.0, 40, T, yB));
  // the low roof and its little lantern
  g.push(prep(moulding([[R_BELL + 0.71, 5.3], [R_BELL - 0.6, 5.55], [2.0, 5.9], [1.2, 5.95], [1.2, 6.35], [1.32, 6.42], [0.0, 6.6]], 64), { tint: T, yBase: yB }));
  return mergeGeometries(g);
}

function bells(c) {
  // 7 bells hang in the chamber; the ones near the openings catch the light
  const prof = [[0.0, 0.0], [0.62, 0.0], [0.6, 0.08], [0.48, 0.3], [0.38, 0.6], [0.34, 0.8], [0.3, 0.9], [0.0, 0.95]];
  const bell = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 24);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const phi = (i / 7) * TAU + 0.2;
    const r = i % 2 ? 3.4 : 2.6;
    const s = 0.8 + 0.4 * ((i * 37) % 7) / 7;
    const b = bell.clone(); b.scale(s, s, s); b.translate(r * Math.cos(phi), 2.1, r * Math.sin(phi));
    out.push(b.index ? b.toNonIndexed() : b);
  }
  for (const g of out) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return mergeGeometries(out);
}

function foundation(c) {
  // the foundation: a stone ring, 3 m deep under the lawn (the tower base sits 0.6 m down, in the walkway)
  const g = [];
  g.push(prep(tube(R_FOUND, -2.4, 0.0, 96), { tint: c.found, joint: 1 }));
  g.push(prep(ring(R_WELL, R_FOUND, -2.4, 96, false), { tint: c.found }));
  g.push(prep(ring(R_GROUND + 0.55, R_FOUND, 0.0, 96, true), { tint: c.found }));
  return mergeGeometries(g);
}

export function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build every floor. Returns { floors: [geo x 8], bells: geo, foundation: geo, heights }. */
export function buildTower() {
  const c = {
    marble: [1, 1, 1],
    inlay: [0.42, 0.47, 0.44],      // dark green-grey marble of the lozenges
    dark: [0.06, 0.055, 0.05],
    iron: [0.12, 0.12, 0.13],
    found: [0.62, 0.58, 0.52],
  };
  const floors = [groundFloor(c)];
  for (let k = 1; k <= 6; k++) floors.push(gallery(k, c));
  floors.push(bellChamber(c));
  return { floors, bells: bells(c), foundation: foundation(c), heights: H };
}
