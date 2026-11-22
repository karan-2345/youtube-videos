// scenes/3d/lib/sdf.js -- signed distance primitives and a surface-nets mesher.
//
// Every organic shape in the Short (the glass body, the lungs, the fat lump) is a distance function meshed here:
// smooth blends with no seams, and normals from the field's gradient, so the glass shading stays silky.
import * as THREE from 'three';

// ---------------------------------------------------------------- primitives (all in metres)
export function sphere(c, r) {
  return (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r;
}

/** Ellipsoid (the usual bound-corrected approximation, exact enough near the surface). */
export function ellipsoid(c, r) {
  return (x, y, z) => {
    const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
    const k0 = Math.hypot(px, py, pz);
    const k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
    return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : k0 * (k0 - 1) / k1;
  };
}

/** Round cone: a capsule from a (radius ra) to b (radius rb). */
export function roundCone(a, b, ra, rb) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yv = pax * bax + pay * bay + paz * baz, z0 = yv - l2;
    const xx = pax * l2 - bax * yv, xy = pay * l2 - bay * yv, xz = paz * l2 - baz * yv;
    const x2 = xx * xx + xy * xy + xz * xz, y2 = yv * yv * l2, z2 = z0 * z0 * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(z0) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra;
  };
}

export function capsule(a, b, r) { return roundCone(a, b, r, r); }

/** Polynomial smooth minimum (k = blend width in metres). */
export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a, b, k) { return -smin(-a, -b, k); }

// ---------------------------------------------------------------- surface nets
// fn(x, y, z) -> distance (negative inside). box = [[x0, y0, z0], [x1, y1, z1]], h = cell size.
// opts.attrs(x, y, z, out) may fill extra per-vertex data (opts.attrSize floats). Returns an indexed BufferGeometry
// with position, normal (from the gradient) and, if asked, 'extra'.
export function surfaceNets(fn, box, h, opts = {}) {
  const [o, e] = box;
  const nx = Math.ceil((e[0] - o[0]) / h) + 1, ny = Math.ceil((e[1] - o[1]) / h) + 1, nz = Math.ceil((e[2] - o[2]) / h) + 1;
  const field = opts.field && opts.field.length >= nx * ny * nz ? opts.field : new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    field[i + nx * (j + ny * k)] = fn(o[0] + i * h, o[1] + j * h, o[2] + k * h);
  const cellIndex = opts.cellIndex && opts.cellIndex.length >= nx * ny * nz ? opts.cellIndex : new Int32Array(nx * ny * nz);
  cellIndex.fill(-1);
  const pos = opts.pos || [], idx = opts.idx || [];
  let nv = 0, ni = 0;
  const put = opts.pos ? (arr, n, v) => { arr[n] = v; } : (arr, n, v) => { arr[n] = v; };
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = field[(i + corners[c][0]) + nx * ((j + corners[c][1]) + ny * (k + corners[c][2]))];
      cv[c] = v;
      if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const tt = va / (va - vb);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * tt;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * tt;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * tt;
      cnt++;
    }
    put(pos, nv * 3, o[0] + (i + sx / cnt) * h);
    put(pos, nv * 3 + 1, o[1] + (j + sy / cnt) * h);
    put(pos, nv * 3 + 2, o[2] + (k + sz / cnt) * h);
    cellIndex[i + nx * (j + ny * k)] = nv++;
  }
  // quads across every sign-changing grid edge
  const C = (i, j, k) => cellIndex[i + nx * (j + ny * k)];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { idx[ni++] = a; idx[ni++] = c; idx[ni++] = b; idx[ni++] = a; idx[ni++] = d; idx[ni++] = c; }
    else { idx[ni++] = a; idx[ni++] = b; idx[ni++] = c; idx[ni++] = a; idx[ni++] = c; idx[ni++] = d; }
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = field[i + nx * (j + ny * k)] < 0;
    if (i < nx - 1 && (field[i + 1 + nx * (j + ny * k)] < 0) !== v0)       // x edge: cells around it in y, z
      quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), !v0);
    if (j < ny - 1 && (field[i + nx * (j + 1 + ny * k)] < 0) !== v0)       // y edge
      quad(C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1), !v0);
    if (k < nz - 1 && (field[i + nx * (j + ny * (k + 1))] < 0) !== v0)     // z edge
      quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), !v0);
  }
  // normals from the field gradient (central differences on the function itself)
  const eps = h * 0.5;
  const nrm = opts.nrm || new Float32Array(nv * 3);
  const extra = opts.attrSize ? (opts.extra || new Float32Array(nv * opts.attrSize)) : null;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let gx = fn(x + eps, y, z) - fn(x - eps, y, z), gy = fn(x, y + eps, z) - fn(x, y - eps, z), gz = fn(x, y, z + eps) - fn(x, y, z - eps);
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[v * 3] = gx / l; nrm[v * 3 + 1] = gy / l; nrm[v * 3 + 2] = gz / l;
    if (extra) opts.attrs(x, y, z, extra, v * opts.attrSize);
  }
  return { nv, ni, pos, idx, nrm, extra, field, cellIndex };
}

/** Mesh a field once into a fresh BufferGeometry. */
export function meshSDF(fn, box, h, opts = {}) {
  const r = surfaceNets(fn, box, h, opts);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(r.pos.slice ? r.pos.slice(0, r.nv * 3) : r.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(r.nrm, 3));
  if (r.extra) g.userData.extra = r.extra;
  g.setIndex(r.idx.slice ? r.idx.slice(0, r.ni) : r.idx);
  g.computeBoundingSphere();
  return g;
}

/** A geometry that is re-meshed every frame (fixed capacity, draw range follows the mesh). */
export class LiveSDF {
  constructor(maxVerts = 120000) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(maxVerts * 3);
    this.nrm = new Float32Array(maxVerts * 3);
    this.idx = new Uint32Array(maxVerts * 6);
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.na = new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage);
    this.ia = new THREE.BufferAttribute(this.idx, 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.pa);
    this.geo.setAttribute('normal', this.na);
    this.geo.setIndex(this.ia);
    this.field = null; this.cellIndex = null;
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
  }
  update(fn, box, h) {
    const r = surfaceNets(fn, box, h, { pos: this.pos, idx: this.idx, nrm: this.nrm, field: this.field, cellIndex: this.cellIndex });
    this.field = r.field; this.cellIndex = r.cellIndex;
    this.geo.setDrawRange(0, r.ni);
    this.pa.needsUpdate = true; this.na.needsUpdate = true; this.ia.needsUpdate = true;
    this.pa.addUpdateRange?.(0, r.nv * 3); this.na.addUpdateRange?.(0, r.nv * 3); this.ia.addUpdateRange?.(0, r.ni);
    return r;
  }
}
