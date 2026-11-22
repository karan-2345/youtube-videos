// scenes/3d/lib/specks.js -- the breath clock, the golden specks (fat on its way out) and the breath vapour.
//
// Every speck is a pure function of time: born on the lump, carried up to a point inside a lung, held there, then
// swept up the airway and out of the mouth by the next breath out, and away into the air.
import * as THREE from 'three';

// ---------------------------------------------------------------- breathing: explicit cycles, timed to the words
// cycles: [{ in0, ex0, ex1, amp }] -- inhale from in0 to ex0, exhale from ex0 to ex1 (seconds), amp 0..1
export class Breath {
  constructor(cycles) { this.c = cycles.slice().sort((a, b) => a.in0 - b.in0); }
  /** lung inflation 0..1 */
  at(t) {
    for (const c of this.c) {
      if (t < c.in0) break;
      if (t < c.ex0) return c.amp * (0.5 - 0.5 * Math.cos(Math.PI * (t - c.in0) / (c.ex0 - c.in0)));
      if (t < c.ex1) return c.amp * (0.5 + 0.5 * Math.cos(Math.PI * (t - c.ex0) / (c.ex1 - c.ex0)));
    }
    return 0;
  }
  /** the first exhale that starts at or after t (or the one under way if it has just begun) */
  nextExhale(t) {
    for (const c of this.c) if (c.ex0 >= t - 0.15 * (c.ex1 - c.ex0) && c.ex1 > t) return c;
    return null;
  }
  /** exhales that started in (t - span, t] */
  recent(t, span) { return this.c.filter((c) => c.ex0 <= t && t - c.ex0 < span); }
}

/** regular breaths from t0 to t1: period, the share spent breathing in, amplitude */
export function regular(t0, t1, period, amp, inShare = 0.42) {
  const out = [];
  for (let s = t0; s + period <= t1 + 1e-6; s += period)
    out.push({ in0: s, ex0: s + period * inShare, ex1: s + period, amp });
  return out;
}

// ---------------------------------------------------------------- point sprites
function pointsMaterial(color, { core = 1.0, halo = 0.6, additive = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPx: { value: 1 }, uGain: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSize, aAlpha; uniform float uPx; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_PointSize = aSize * uPx * (1.0 / -mv.z);
        vA = aAlpha;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uGain; varying float vA;
      void main(){
        vec2 q = gl_PointCoord - .5; float d2 = dot(q, q) * 4.;
        if (d2 > 1. || vA <= 0.) discard;
        float c = exp(-d2 * 9.) * ${core.toFixed(2)} + exp(-d2 * 2.5) * ${halo.toFixed(2)} * (1. - d2);
        gl_FragColor = vec4(uColor * c * vA * uGain, 1.);
      }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function pointCloud(n, mat) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return { pts, pos, size, alpha, g, flush() { for (const k of ['position', 'aSize', 'aAlpha']) g.attributes[k].needsUpdate = true; } };
}

const cl = (x) => Math.min(1, Math.max(0, x));
const sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };

// ---------------------------------------------------------------- golden specks through the body
// episodes: [{ n, b0, b1, travel, size }] -- n specks born on the lump between b0 and b1
export function buildSpecks(P, B, F, breath, rnd, episodes) {
  const total = episodes.reduce((s, e) => s + e.n, 0);
  const cloud = pointCloud(total, pointsMaterial(P.fat_glow, { core: 2.2, halo: 0.9 }));
  cloud.pts.renderOrder = 8;
  // inside-lung targets (rest pose), by rejection sampling
  const lungPts = [];
  const L = [B.lungSDF(1), B.lungSDF(-1)];
  while (lungPts.length < 900) {
    const s = rnd() < 0.5 ? 1 : -1;
    const x = s * (0.015 + rnd() * 0.13), y = 1.14 + rnd() * 0.27, z = -0.07 + rnd() * 0.14;
    if (L[s > 0 ? 0 : 1](x, y, z) < -0.012) lungPts.push([x, y, z]);
  }
  const P_ = [];
  for (const e of episodes) for (let i = 0; i < e.n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    P_.push({
      e, tb: e.b0 + (e.b1 - e.b0) * Math.pow(rnd(), 0.8), dir: [s * Math.cos(a), u, s * Math.sin(a)],
      lung: lungPts[Math.floor(rnd() * lungPts.length)], mid: [(rnd() - 0.5) * 0.12, 1.12 + rnd() * 0.08, 0.02 + rnd() * 0.05],
      travel: e.travel * (0.8 + 0.4 * rnd()), jit: rnd(), ph: rnd() * 6.28, size: e.size * (0.6 + 0.8 * rnd()),
      spread: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), sp: 0.7 + 0.6 * rnd(),
    });
  }
  // the exit time of each speck depends only on the breath clock: cache it
  for (const p of P_) {
    const arrive = p.tb + p.travel;
    const c = breath.nextExhale(arrive);
    p.exit = c ? c.ex0 + (c.ex1 - c.ex0) * 0.45 * p.jit : 1e9;
    p.exitDur = c ? Math.min(0.55, (c.ex1 - c.ex0) * 0.5) : 1;
  }
  const W = {}, tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), lumpW = new THREE.Vector3();
  const anchors = ['carina', 'throat', 'mouth'];
  const fwd = new THREE.Vector3(), upv = new THREE.Vector3();
  const cat = (p0, p1, p2, p3, u, out) => {
    const u2 = u * u, u3 = u2 * u;
    return out.set(
      0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
      0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
      0.5 * ((2 * p1.z) + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3));
  };
  const Lw = new THREE.Vector3(), Mw = new THREE.Vector3(), Pp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  function update(t, { gain = 1, lumpScale = 1, plumeDir = null } = {}) {
    for (const a of anchors) W[a] = B.anchor(a, W[a] || new THREE.Vector3());
    // the face's forward direction (for the plume)
    B.carry([0, 1.556, 0.25], 'head', fwd).sub(W.mouth).normalize();
    if (plumeDir) fwd.lerp(plumeDir, 0.5).normalize();
    F.group.updateMatrixWorld(true);
    for (let i = 0; i < P_.length; i++) {
      const p = P_[i];
      let a = 0, s = 0;
      const age = t - p.tb;
      const out = tmp;
      if (age < 0) { cloud.alpha[i] = 0; continue; }
      if (t < p.exit) {
        // born on the lump surface, rises through the belly to its point in a lung
        F.surfacePoint(p.dir, lumpW).multiplyScalar(lumpScale);
        lumpW.applyMatrix4(F.group.matrixWorld);
        B.carry(p.lung, 'chest', Lw);
        B.carry(p.mid, 'spine', Mw);
        const u = sm(age / p.travel);
        // quadratic bezier lump -> mid -> lung
        out.copy(lumpW).multiplyScalar((1 - u) * (1 - u)).addScaledVector(Mw, 2 * u * (1 - u)).addScaledVector(Lw, u * u);
        if (u >= 1) out.add(tmp2.set(Math.sin(t * 2 + p.ph), Math.cos(t * 1.7 + p.ph), Math.sin(t * 1.3 + p.ph * 2)).multiplyScalar(0.006));
        a = Math.min(1, age * 6) * (0.75 + 0.25 * Math.sin(t * 9 + p.ph));
        s = p.size;
      } else {
        const ex = t - p.exit;
        if (ex < p.exitDur) {
          // up the airway and out of the mouth
          B.carry(p.lung, 'chest', Pp[0]);
          Pp[1].copy(W.carina); Pp[2].copy(W.throat); Pp[3].copy(W.mouth);
          Pp[4].copy(W.mouth).addScaledVector(fwd, 0.1);
          const u = sm(ex / p.exitDur) * 3;
          const k = Math.min(2, Math.floor(u));
          cat(Pp[Math.max(0, k - 1)], Pp[k], Pp[k + 1], Pp[k + 2], u - k, out);
          a = 1; s = p.size;
        } else {
          // the plume: forward and up, spreading and fading
          const g = ex - p.exitDur;
          out.copy(W.mouth)
            .addScaledVector(fwd, (0.42 * Math.pow(g, 0.55)) * p.sp)
            .addScaledVector(p.spread, 0.11 * g * p.sp)
            .add(tmp2.set(Math.sin(g * 2.1 + p.ph) * 0.02 * g, 0.05 * g + 0.035 * g * g, Math.cos(g * 1.8 + p.ph) * 0.02 * g));
          a = Math.max(0, 1 - g / 2.6) * (0.75 + 0.25 * Math.sin(t * 9 + p.ph));
          s = p.size * (1 + 0.3 * g);
        }
      }
      cloud.pos[i * 3] = out.x; cloud.pos[i * 3 + 1] = out.y; cloud.pos[i * 3 + 2] = out.z;
      cloud.alpha[i] = a * gain * p.e.gain; cloud.size[i] = s;
    }
    cloud.flush();
  }
  return { pts: cloud.pts, update, P: P_, mat: cloud.pts.material };
}

// ---------------------------------------------------------------- the visible breath: soft vapour on every exhale
export function buildVapor(P, B, breath, rnd, n = 240) {
  const cloud = pointCloud(n, pointsMaterial(P.breath, { core: 0.25, halo: 0.5 }));
  cloud.pts.renderOrder = 9;
  const D = Array.from({ length: n }, () => ({ k: rnd(), sp: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5), ph: rnd() * 6.28,
    v: 0.6 + 0.6 * rnd(), size: 0.6 + 0.8 * rnd() }));
  const m = new THREE.Vector3(), fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  function update(t, gain = 1) {
    B.anchor('mouth', m);
    B.carry([0, 1.556, 0.25], 'head', fwd).sub(m).normalize();
    const rec = breath.recent(t, 2.4);
    D.forEach((d, i) => {
      const c = rec[rec.length - 1 - (i % Math.max(1, rec.length))];
      if (!c || gain <= 0) { cloud.alpha[i] = 0; return; }
      const dur = c.ex1 - c.ex0;
      const age = t - (c.ex0 + d.k * dur * 0.8);
      if (age < 0) { cloud.alpha[i] = 0; return; }
      const strength = c.amp * (c.vapor ?? 1);
      tmp.copy(m).addScaledVector(fwd, (0.05 + 0.32 * Math.pow(age, 0.6)) * d.v)
        .addScaledVector(d.sp, 0.07 * age + 0.012).add(new THREE.Vector3(0, 0.05 * age, 0));
      cloud.pos.set([tmp.x, tmp.y, tmp.z], i * 3);
      cloud.alpha[i] = gain * strength * 0.16 * Math.max(0, 1 - age / 1.8) * Math.min(1, age * 8);
      cloud.size[i] = (40 + 140 * age) * d.size;
    });
    cloud.flush();
  }
  return { pts: cloud.pts, update, mat: cloud.pts.material };
}

export { pointCloud, pointsMaterial };
