// scenes/3d/lib/church.js -- Santa Maria della Salute, procedural: the octagon with its seven chapel fronts and the
// triumphal-arch portal (four columns, pediment, statues), the attic with sixteen great scroll buttresses (the
// "orecchioni"), the windowed drum, the lead-covered dome with ribs, the lantern with the Virgin on top, and behind it
// the presbytery with a second, smaller dome between two bell towers; the steps down to the water.
// Local frame: origin at the centre of the campo level (podium top), the portal faces +z.
//
// Also: the stone podiums (Istrian stone courses, a green-black tide band at the water line), Venetian palazzi
// (stucco, white-framed gothic windows, a water gate, tiled roofs, funnel chimneys), mooring poles.
// Every building material takes uBuild (a world height: above it, nothing yet; a glowing seam at the edge).
import * as THREE from 'three';
import { NOISE, patch, mulberry, tint } from './common.js';
import { mergeGeos } from './figures.js';
import { withMedium } from './medium.js';

const STONE = '#ECE6DA', STONE2 = '#D9D1C1', DARK = '#1E2126', DOOR = '#3A2A1E', SHADOW = '#B9B0A0';
const OCT = Math.PI / 4;

function box(w, h, d, x, y, z, c = STONE) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return tint(g, c); }
function cyl(r0, r1, h, x, y, z, seg = 16, c = STONE) { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(x, y + h / 2, z); return tint(g, c); }
function rotY(g, a) { g.rotateY(a); return g; }

/** An extruded 2D shape (in the xy plane) with depth along +z, front face at z = z0 + depth. */
function slab(shape, depth, x, y, z0, c) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  g.translate(x, y, z0);
  return tint(g, c);
}
function archShape(w, h) {   // a rectangle with a round top: total height h, width w
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return s;
}
function triShape(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0); return s; }
function halfDisc(r) { const s = new THREE.Shape(); s.moveTo(-r, 0); s.lineTo(r, 0); s.absarc(0, 0, r, 0, Math.PI, false); return s; }
function ogee(w, h) {   // a Venetian gothic (ogee) window: straight sides, a pointed top with a flick
  const s = new THREE.Shape(), r = w / 2, hs = h - w * 0.95;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, hs);
  s.bezierCurveTo(r, hs + w * 0.45, w * 0.06, hs + w * 0.4, 0, h);
  s.bezierCurveTo(-w * 0.06, hs + w * 0.4, -r, hs + w * 0.45, -r, hs);
  s.lineTo(-r, 0);
  return s;
}

/** A small standing statue (draped figure on a plinth), height ~h. */
function statue(h, x, y, z, rot = 0) {
  const parts = [];
  const plinth = new THREE.BoxGeometry(0.42 * h, 0.16 * h, 0.42 * h); plinth.translate(0, 0.08 * h, 0); parts.push(plinth);
  const robe = new THREE.CylinderGeometry(0.11 * h, 0.2 * h, 0.58 * h, 10); robe.translate(0, 0.45 * h, 0); parts.push(robe);
  const chest = new THREE.SphereGeometry(0.13 * h, 10, 8); chest.scale(1, 1.2, 0.8); chest.translate(0, 0.76 * h, 0); parts.push(chest);
  const head = new THREE.SphereGeometry(0.075 * h, 10, 8); head.translate(0, 0.93 * h, 0); parts.push(head);
  const arm = new THREE.CapsuleGeometry(0.035 * h, 0.28 * h, 2, 6); arm.rotateZ(-0.9); arm.translate(0.14 * h, 0.8 * h, 0.05 * h); parts.push(arm);
  const arm2 = new THREE.CapsuleGeometry(0.035 * h, 0.25 * h, 2, 6); arm2.rotateZ(0.3); arm2.translate(-0.13 * h, 0.66 * h, 0.03 * h); parts.push(arm2);
  const g = mergeGeos(parts.map((p) => tint(p, STONE)));
  g.rotateY(rot); g.translate(x, y, z);
  return g;
}

/** A thick ribbon along a 2D polyline in the (r, y) plane, extruded +-d/2 across; returns geometry in (x=r, y, z). */
function ribbon(pts, wHalf, dHalf, c) {
  const n = pts.length, pos = [], idx = [];
  const nrm = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    nrm.push([-ty / l, tx / l]);
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i], [nx, ny] = nrm[i];
    for (const [s, dz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) pos.push(x + s * nx * wHalf, y + s * ny * wHalf, dz * dHalf);
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 4; k++) {
    const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c2 = a + 4, d = b + 4;
    idx.push(a, c2, b, b, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  return tint(ng, c);
}

/** One scroll buttress in the (r, y) plane: big curl at the outer foot, an arm, a small curl against the drum. */
function volute() {
  const pts = [];
  const Cs = [6.75, 18.55], Cb = [7.75, 15.65];
  // small curl (from its eye outwards), clockwise in (r, y)
  for (let i = 0; i <= 40; i++) { const u = i / 40; const th = Math.PI * 0.5 + (1 - u) * Math.PI * 2.0; const r = 0.12 + 0.36 * u; pts.push([Cs[0] + r * Math.cos(th), Cs[1] + r * Math.sin(th)]); }
  // the arm: from the bottom of the small curl down and out to the top of the big curl
  const a0 = pts[pts.length - 1], a1 = [Cb[0], Cb[1] + 0.95];
  for (let i = 1; i <= 24; i++) {
    const u = i / 24;
    const x = a0[0] + (a1[0] - a0[0]) * (u * u * (3 - 2 * u)) + 0.25 * Math.sin(Math.PI * u);
    const y = a0[1] + (a1[1] - a0[1]) * u - 0.15 * Math.sin(Math.PI * u);
    pts.push([x, y]);
  }
  // big curl: from its top outward and down, curling in to its eye
  for (let i = 1; i <= 60; i++) { const u = i / 60; const th = Math.PI * 0.5 - u * Math.PI * 2.3; const r = 0.95 - 0.7 * u; pts.push([Cb[0] + r * Math.cos(th), Cb[1] + r * Math.sin(th)]); }
  const parts = [ribbon(pts, 0.17, 0.36, STONE)];
  // the solid web inside the scroll
  const web = new THREE.Shape();
  web.moveTo(6.3, 14.8); web.lineTo(8.45, 14.8); web.lineTo(8.6, 15.6); web.lineTo(Cb[0], Cb[1] + 0.85);
  web.bezierCurveTo(7.3, 16.9, 7.0, 17.6, 6.95, 18.2); web.lineTo(6.3, 18.6); web.lineTo(6.3, 14.8);
  parts.push(slab(web, 0.5, 0, 0, -0.25, STONE2));
  return { geo: mergeGeos(parts), top: [Cb[0], Cb[1] + 0.95 + 0.17] };
}

export function buildChurch() {
  const parts = [], lead = [];
  const R = 8, a = R * Math.cos(Math.PI / 8);
  // --------------------------------------------------------- the octagon
  { const g = new THREE.CylinderGeometry(R, R, 14, 8, 1, false, Math.PI / 8); g.translate(0, 7, 0); parts.push(tint(g, STONE2)); }
  { const g = new THREE.CylinderGeometry(R + 0.25, R + 0.25, 0.8, 8, 1, false, Math.PI / 8); g.translate(0, 0.4, 0); parts.push(tint(g, SHADOW)); }   // base course
  for (const [y, h, dr] of [[12.9, 0.5, 0.35], [13.4, 0.7, 0.55], [14.1, 0.45, 0.8]]) {   // entablature and cornice
    const g = new THREE.CylinderGeometry(R + dr, R + dr, h, 8, 1, false, Math.PI / 8); g.translate(0, y + h / 2, 0); parts.push(tint(g, STONE));
  }
  // paired corner pilasters
  for (let k = 0; k < 8; k++) {
    const ang = Math.PI / 8 + k * OCT;
    for (const off of [-0.5, 0.5]) {
      const g = box(0.55, 12.4, 0.45, off, 6.6, R - 0.05, STONE);
      parts.push(rotY(g, ang));
      const cap = box(0.75, 0.45, 0.6, off, 12.85, R, STONE); parts.push(rotY(cap, ang));
    }
  }
  // --------------------------------------------------------- the seven chapel fronts
  for (let k = 1; k < 8; k++) {
    const ang = k * OCT, list = [];
    list.push(box(4.8, 10.6, 1.4, 0, 5.3, a + 0.5, STONE2));
    for (const s of [-1, 1]) { list.push(box(0.55, 9.8, 0.35, s * 2.05, 5.2, a + 1.3, STONE)); list.push(box(0.8, 0.45, 0.5, s * 2.05, 10.2, a + 1.3, STONE)); }
    list.push(box(5.4, 0.85, 1.8, 0, 10.85, a + 0.6, STONE));
    list.push(slab(triShape(5.6, 1.7), 1.5, 0, 11.27, a - 0.2, STONE));
    list.push(slab(triShape(4.6, 1.2), 0.1, 0, 11.45, a + 1.3, SHADOW));
    list.push(slab(halfDisc(1.35), 0.05, 0, 6.6, a + 1.2, DARK));                         // thermal window
    const ring = new THREE.Shape(); ring.absarc(0, 0, 1.6, 0, Math.PI, false); ring.lineTo(-1.35, 0); ring.absarc(0, 0, 1.35, Math.PI, 0, true); ring.lineTo(1.6, 0);
    list.push(slab(ring, 0.12, 0, 6.6, a + 1.2, STONE));
    for (const s of [-0.68, 0, 0.68]) list.push(box(0.09, 1.3, 0.1, s, 7.1, a + 1.28, STONE));   // mullions
    list.push(slab(archShape(1.2, 2.7), 0.05, 0, 1.0, a + 1.2, DARK));
    list.push(box(1.7, 0.25, 0.3, 0, 3.85, a + 1.3, STONE));
    for (const g of list) parts.push(rotY(g, ang));
  }
  // --------------------------------------------------------- the portal (a triumphal arch)
  {
    const z0 = a - 0.2, list = [];
    list.push(box(7.6, 13.2, 2.8, 0, 6.6, z0 + 1.4, STONE2));
    const zf = z0 + 2.8;
    for (const x of [-3.05, -1.35, 1.35, 3.05]) {
      list.push(box(1.15, 1.7, 1.15, x, 0.85, zf + 0.45, STONE));
      list.push(cyl(0.46, 0.4, 9.4, x, 1.7, zf + 0.45, 18, STONE));
      list.push(box(1.05, 0.55, 1.05, x, 11.38, zf + 0.45, STONE));
      list.push(box(0.9, 0.2, 0.9, x, 1.8, zf + 0.45, STONE));
    }
    list.push(box(8.2, 1.1, 1.6, 0, 12.2, zf + 0.15, STONE));
    list.push(slab(triShape(8.6, 2.3), 2.0, 0, 12.75, z0 + 0.9, STONE));
    list.push(slab(triShape(7.2, 1.6), 0.1, 0, 13.0, zf + 0.95, SHADOW));
    list.push(slab(archShape(3.0, 7.4), 0.05, 0, 0.0, zf + 0.02, DARK));
    list.push(slab(archShape(2.4, 4.6), 0.05, 0, 0.0, zf + 0.04, DOOR));                     // the doors inside the arch
    const fr = new THREE.Shape(); fr.moveTo(-1.85, 0); fr.lineTo(-1.5, 0); fr.lineTo(-1.5, 5.9); fr.absarc(0, 5.9, 1.5, Math.PI, 0, true);
    fr.lineTo(1.5, 0); fr.lineTo(1.85, 0); fr.lineTo(1.85, 5.9); fr.absarc(0, 5.9, 1.85, 0, Math.PI, false); fr.lineTo(-1.85, 0);
    list.push(slab(fr, 0.2, 0, 0, zf, STONE));
    list.push(box(0.5, 0.9, 0.3, 0, 7.6, zf + 0.1, STONE));                                  // keystone
    list.push(slab(archShape(1.5, 2.0), 0.05, 0, 8.9, zf + 0.02, DARK));                     // window over the arch
    for (const s of [-1, 1]) {                                                                // niches with statues
      list.push(slab(archShape(0.9, 2.6), 0.05, s * 2.2, 4.0, zf + 0.02, '#8D8577'));
      list.push(statue(2.2, s * 2.2, 4.1, zf + 0.25));
    }
    list.push(statue(2.4, 0, 15.0, z0 + 1.8)); list.push(statue(2.0, -3.9, 12.75, z0 + 2.0)); list.push(statue(2.0, 3.9, 12.75, z0 + 2.0));
    for (const g of list) parts.push(g);
  }
  // --------------------------------------------------------- attic, the sixteen scrolls and their statues
  { const g = new THREE.CylinderGeometry(7.5, 7.5, 1.7, 8, 1, false, Math.PI / 8); g.translate(0, 14.55 + 0.85, 0); parts.push(tint(g, STONE2)); }
  const V = volute();
  for (let k = 0; k < 8; k++) for (const off of [-0.16, 0.16]) {
    const ang = Math.PI / 8 + k * OCT + off;
    const g = V.geo.clone();
    g.rotateY(-Math.PI / 2);          // the scroll's r axis (x) -> +z, then turn to its angle
    g.rotateY(ang);
    parts.push(g);
    const st = statue(1.6, 0, 0, 0); st.translate(0, V.top[1], V.top[0]); st.rotateY(ang);
    parts.push(st);
  }
  // --------------------------------------------------------- drum
  parts.push(cyl(6.25, 6.25, 5.4, 0, 16.2, 0, 32, STONE2));
  parts.push(cyl(6.5, 6.5, 0.5, 0, 16.2, 0, 32, STONE));
  parts.push(cyl(6.75, 6.75, 0.55, 0, 21.55, 0, 32, STONE));
  for (let k = 0; k < 16; k++) {
    const ang = (k + 0.5) * Math.PI / 8;
    parts.push(rotY(box(0.42, 5.0, 0.35, 0, 18.9, 6.3, STONE), ang));
    const w = slab(archShape(1.05, 2.5), 0.04, 0, 17.6, 6.28, DARK); parts.push(rotY(w, ang + Math.PI / 16));
    const f = slab(archShape(1.4, 2.75), 0.03, 0, 17.48, 6.26, STONE); parts.push(rotY(f, ang + Math.PI / 16));
  }
  // --------------------------------------------------------- dome (lead), ribs, lantern
  const prof = [[6.45, 22.0], [6.4, 22.9], [6.15, 24.1], [5.65, 25.4], [4.85, 26.6], [3.75, 27.6], [2.4, 28.35], [1.25, 28.75], [0.0, 28.9]];
  { const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48); lead.push(tint(g, '#9AA1A6')); }
  for (let k = 0; k < 16; k++) {
    const ang = k * Math.PI / 8;
    const pts = prof.slice(0, -1).map(([r, y]) => new THREE.Vector3((r + 0.06) * Math.sin(ang), y, (r + 0.06) * Math.cos(ang)));
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 5); lead.push(tint(g, '#B9BFC2'));
  }
  parts.push(cyl(1.35, 1.35, 0.4, 0, 28.6, 0, 16, STONE));
  parts.push(cyl(1.1, 1.1, 2.1, 0, 29.0, 0, 16, DARK));
  for (let k = 0; k < 8; k++) { const ang = k * OCT; parts.push(cyl(0.12, 0.12, 2.1, 1.22 * Math.sin(ang), 29.0, 1.22 * Math.cos(ang), 8, STONE)); }
  parts.push(cyl(1.45, 1.45, 0.3, 0, 31.1, 0, 16, STONE));
  { const g = new THREE.SphereGeometry(1.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.85, 1); g.translate(0, 31.4, 0); lead.push(tint(g, '#9AA1A6')); }
  parts.push(cyl(0.25, 0.18, 0.8, 0, 32.4, 0, 10, STONE));
  parts.push(statue(1.9, 0, 33.1, 0));
  // --------------------------------------------------------- presbytery, second dome, two bell towers
  parts.push(box(11.2, 12.4, 9.0, 0, 6.2, -11.6, STONE2));
  parts.push(box(11.8, 0.7, 9.6, 0, 12.6, -11.6, STONE));
  for (const x of [-5.6, -2.0, 2.0, 5.6]) for (const s of [-1, 1]) parts.push(box(0.45, 11.6, 0.3, x, 6.0, -11.6 + s * 4.55, STONE));
  parts.push(cyl(3.3, 3.3, 3.2, 0, 12.9, -11.6, 24, STONE2));
  parts.push(cyl(3.55, 3.55, 0.4, 0, 16.0, -11.6, 24, STONE));
  for (let k = 0; k < 8; k++) { const ang = (k + 0.5) * OCT; const w = slab(archShape(0.8, 1.7), 0.04, 0, 13.6, 3.32, DARK); w.translate(0, 0, 0); w.rotateY(ang); w.translate(0, 0, -11.6); parts.push(w); }
  { const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * 0.55, 16.3 + (y - 22) * 0.55)), 32); g.translate(0, 0, -11.6); lead.push(tint(g, '#9AA1A6')); }
  parts.push(cyl(0.7, 0.7, 1.3, 0, 20.0, -11.6, 12, STONE));
  { const g = new THREE.SphereGeometry(0.75, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, 21.3, -11.6); lead.push(tint(g, '#9AA1A6')); }
  parts.push(cyl(0.12, 0.08, 0.9, 0, 21.9, -11.6, 6, STONE));
  for (const s of [-1, 1]) {
    const x = s * 5.2, z = -17.2;
    parts.push(box(2.3, 19.4, 2.3, x, 9.7, z, STONE2));
    for (const y of [6.5, 12.8]) parts.push(box(2.5, 0.35, 2.5, x, y, z, STONE));
    for (let k = 0; k < 4; k++) { const w = slab(archShape(0.75, 2.2), 0.04, 0, 15.6, 1.16, DARK); w.rotateY(k * Math.PI / 2); w.translate(x, 0, z); parts.push(w); }
    parts.push(box(2.6, 0.45, 2.6, x, 19.55, z, STONE));
    { const g = new THREE.CylinderGeometry(0.95, 1.05, 1.3, 8); g.translate(x, 20.4, z); parts.push(tint(g, STONE)); }
    { const g = new THREE.ConeGeometry(1.0, 2.6, 8); g.translate(x, 22.35, z); lead.push(tint(g, '#9AA1A6')); }
    { const g = new THREE.SphereGeometry(0.2, 8, 6); g.translate(x, 23.75, z); lead.push(tint(g, '#C9A24A')); }
  }
  // --------------------------------------------------------- the steps down to the water (local y 0 -> -1.6)
  for (let i = 0; i < 7; i++) parts.push(box(11.5 - i * 0.2, 0.25, 0.42, 0, -0.125 - i * 0.24, 11.0 + i * 0.4, i < 4 ? STONE : '#A9A291'));
  return { stone: mergeGeos(parts), lead: mergeGeos(lead) };
}

// ------------------------------------------------------------------------ materials
const BUILD_HEAD = `uniform float uBuild, uBuildGlow; varying vec3 vBW;`;
const BUILD_FRAG = `
  if (vBW.y > uBuild) discard;
  float seam = 1. - smoothstep(0.0, 0.5, uBuild - vBW.y);`;

/** Istrian stone with weathering, grime, and the water-line tide band; kind: 'church' | 'podium' | 'house'. */
export function stoneMaterial(shared, { courses = false, stucco = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, vertexColors: true });
  patch(m, {
    uniforms: shared,
    vHead: 'varying vec3 vBW; varying vec3 vBN;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvBW = (modelMatrix * vec4(transformed, 1.)).xyz; vBN = normalize(mat3(modelMatrix) * normal);' },
    fHead: `${BUILD_HEAD} varying vec3 vBN; uniform vec3 uGlowCol; uniform float uHi;`,
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        ${BUILD_FRAG}
        vec3 p = vBW;
        vec2 q = abs(vBN.x) > abs(vBN.z) ? p.zy : p.xy;
        if (abs(vBN.y) > 0.7) q = p.xz;
        float n = fbm(q * 0.8), f = vnoise(q * 7.0), ff = vnoise(q * 25.0);
        float w = 0.93 + 0.1 * (n - 0.5) + 0.05 * (f - 0.5) + 0.03 * (ff - 0.5);
        // rain streaks below ledges and darker grime low down
        float streak = smoothstep(0.55, 0.85, vnoise(vec2(q.x * 3.0, q.y * 0.25))) * 0.12;
        float grime = 0.18 * (1. - smoothstep(0.5, 6.0, p.y));
        vec3 c = diffuseColor.rgb * w * (1. - streak - grime);
        ${courses ? `
        // ashlar courses
        float row = floor(p.y / 0.55);
        float jx = fract((q.x + mod(row, 2.) * 0.6) / 1.2), jy = fract(p.y / 0.55);
        float joint = 1. - smoothstep(0.0, 0.035, min(min(jx, 1. - jx) * 2.2, min(jy, 1. - jy)));
        c *= (0.92 + 0.12 * h21(vec2(floor((q.x + mod(row, 2.) * 0.6) / 1.2), row))) * (1. - 0.3 * joint);` : ''}
        ${stucco ? `
        // stucco: soft blotches, flaked patches showing the brick underneath
        float blot = fbm(q * 0.35 + 3.0);
        c *= 0.88 + 0.22 * blot;
        float flake = smoothstep(0.66, 0.7, fbm(q * 0.6 + 9.0)) * step(0.4, p.y);
        vec2 br = vec2(q.x / 0.26 + mod(floor(p.y / 0.08), 2.) * 0.5, p.y / 0.08);
        vec3 brick = vec3(0.55, 0.27, 0.18) * (0.8 + 0.3 * h21(floor(br))) * (1. - 0.4 * (1. - smoothstep(0.0, 0.12, min(fract(br.x), fract(br.y)))));
        c = mix(c, brick, flake * 0.9);` : ''}
        // the tide band: green-black algae just under and over the water line, darker below
        float tide = smoothstep(-0.9, -0.1, p.y) * (1. - smoothstep(0.35, 0.75 + 0.2 * f, p.y));
        c = mix(c, vec3(0.13, 0.17, 0.1) * (0.8 + 0.4 * n), tide * 0.85);
        c = mix(c, c * 0.45 + vec3(0.03, 0.06, 0.04), smoothstep(-0.8, -2.0, p.y));
        diffuseColor.rgb = c;`,
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlowCol * (seam * uBuildGlow * 3.0 + uHi * 0.35);`,
    },
  });
  withMedium(m);
  return m;
}

export function leadMaterial(shared) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.55, vertexColors: true });
  patch(m, {
    uniforms: shared,
    vHead: 'varying vec3 vBW;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvBW = (modelMatrix * vec4(transformed, 1.)).xyz;' },
    fHead: `${BUILD_HEAD} uniform vec3 uGlowCol; uniform float uHi;`,
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        ${BUILD_FRAG}
        float ang = atan(vBW.z, vBW.x);
        float sheet = fract(vBW.y / 0.9 + 0.5 * step(0.5, fract(ang * 8.0)));
        float n = fbm(vBW.xz * 0.5 + vBW.y * 0.3);
        diffuseColor.rgb *= (0.86 + 0.18 * n) * (1. - 0.12 * smoothstep(0.92, 1.0, sheet));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 1.0, 1.02), smoothstep(0.5, 0.8, n));`,
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlowCol * (seam * uBuildGlow * 3.0 + uHi * 0.35);`,
    },
  });
  return m;
}

// ------------------------------------------------------------------------ podiums
/** A stone podium: an octagon (r) and boxes, from y0 to y1 (world coordinates, merged). */
export function podiumGeometry(list, y0, y1) {
  const parts = [];
  for (const it of list) {
    if (it.oct) { const g = new THREE.CylinderGeometry(it.oct, it.oct, y1 - y0, 8, 4, false, Math.PI / 8); g.translate(it.x, (y0 + y1) / 2, it.z); parts.push(tint(g, STONE2)); }
    else { const g = new THREE.BoxGeometry(it.w, (it.top ?? y1) - y0, it.d, 4, 4, 4); g.translate(it.x, (y0 + (it.top ?? y1)) / 2, it.z); parts.push(tint(g, it.c || STONE2)); }
  }
  return mergeGeos(parts);
}

// ------------------------------------------------------------------------ palazzi
/** One Venetian house, its front to +z, its foot (ground floor) at y = 0, x centred; w wide, d deep, h tall. */
export function palazzo(w, d, h, color, seed) {
  const rnd = mulberry(seed);
  const walls = [], roof = [];
  walls.push(box(w, h, d, 0, h / 2, -d / 2, color));
  walls.push(box(w + 0.3, 0.35, d + 0.3, 0, h + 0.1, -d / 2, STONE));                     // eaves cornice
  walls.push(box(w + 0.05, 0.9, d + 0.05, 0, 0.45, -d / 2, '#CFC6B4'));                  // stone ground course
  const floors = h > 11 ? 3 : 2, fh = (h - 1.6) / floors;
  const nWin = Math.max(3, Math.round(w / 1.9));
  for (let f = 0; f < floors; f++) {
    const y = 1.6 + f * fh + fh * 0.22, wh = Math.min(2.3, fh * 0.6);
    const noble = f === floors - 2 || floors === 2 && f === 0;
    for (let i = 0; i < nWin; i++) {
      const x = (i - (nWin - 1) / 2) * (w / nWin);
      const mid = Math.abs(x) < w * 0.22 && noble;
      const ww = mid ? 0.7 : 0.82;
      walls.push(slab(ogee(ww + 0.32, wh + 0.28), 0.05, x, y - 0.14, 0.0, STONE));
      walls.push(slab(ogee(ww, wh), 0.05, x, y, 0.03, DARK));
      walls.push(box(ww + 0.5, 0.12, 0.25, x, y - 0.2, 0.1, STONE));                      // sill
      if (!mid && rnd() < 0.6) {                                                          // green shutters, some open
        for (const s of [-1, 1]) walls.push(box(ww * 0.5, wh * 0.72, 0.06, x + s * (ww * 0.5 + 0.28), y + wh * 0.36, 0.06, rnd() < 0.5 ? '#3E5B45' : '#4B6150'));
      }
    }
    if (noble) walls.push(box(w * 0.5, 0.15, 0.7, 0, y - 0.25, 0.35, STONE));              // balcony slab
  }
  walls.push(slab(archShape(1.9, 2.6), 0.05, -w * 0.15, -0.6, 0.03, '#241B14'));          // water gate
  walls.push(slab(archShape(2.3, 2.85), 0.04, -w * 0.15, -0.65, 0.0, STONE));
  // roof: a low hipped roof of tiles
  const rh = 1.6;
  { const g = new THREE.CylinderGeometry(0.0001, 1, rh, 4, 1); g.rotateY(Math.PI / 4); g.scale((w + 0.6) / Math.SQRT2, 1, (d + 0.6) / Math.SQRT2); g.translate(0, h + 0.25 + rh / 2, -d / 2); roof.push(tint(g, '#B4583A')); }
  // funnel chimneys
  const nc = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < nc; i++) {
    const x = (rnd() - 0.5) * w * 0.6, z = -d * (0.25 + rnd() * 0.5), yb = h + 0.6;
    walls.push(box(0.45, 2.0, 0.45, x, yb + 1.0, z, '#C47A5A'));
    const fun = new THREE.CylinderGeometry(0.55, 0.22, 0.9, 10, 1, false); fun.translate(x, yb + 2.4, z); walls.push(tint(fun, '#B86E50'));
    walls.push(box(0.6, 0.12, 0.6, x, yb + 2.9, z, '#7A4A36'));
  }
  return { walls: mergeGeos(walls), roof: mergeGeos(roof) };
}

export function roofMaterial(shared) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, vertexColors: true });
  patch(m, {
    uniforms: shared,
    vHead: 'varying vec3 vBW;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvBW = (modelMatrix * vec4(transformed, 1.)).xyz;' },
    fHead: `${BUILD_HEAD} uniform vec3 uGlowCol; uniform float uHi;`,
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        ${BUILD_FRAG}
        vec2 q = vec2(vBW.x + vBW.z, vBW.y);
        float row = fract(q.y / 0.22), col = fract(q.x / 0.3 + 0.5 * mod(floor(q.y / 0.22), 2.));
        float tile = (0.75 + 0.25 * smoothstep(0.0, 0.6, row)) * (0.85 + 0.15 * sin(col * 6.283));
        float n = fbm(q * 0.7);
        diffuseColor.rgb *= tile * (0.8 + 0.35 * n) * (0.9 + 0.2 * h21(floor(vec2(q.x / 0.3, q.y / 0.22))));`,
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlowCol * (seam * uBuildGlow * 3.0 + uHi * 0.35);`,
    },
  });
  return m;
}

/** A mooring pole (palina): a spiral-striped pole with a gilded knob, from yb to yt. */
export function palinaGeometry(x, z, yb, yt, c1, c2) {
  const g = new THREE.CylinderGeometry(0.11, 0.13, yt - yb, 10, 40);
  g.translate(x, (yb + yt) / 2, z);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const A = new THREE.Color(c1), B = new THREE.Color(c2), W = new THREE.Color('#5E4A36');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), a = Math.atan2(p.getZ(i) - z, p.getX(i) - x);
    const s = Math.sin(a + y * 4.2) > 0 ? A : B;
    const c = y < -0.2 ? W : s;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const k = new THREE.SphereGeometry(0.2, 10, 8); k.scale(1, 1.3, 1); k.translate(x, yt + 0.15, z);
  return mergeGeos([g, tint(k, '#D9AE4E')]);
}
