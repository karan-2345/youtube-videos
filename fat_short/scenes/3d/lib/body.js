// scenes/3d/lib/body.js -- the glass figure: one smooth SDF body (no seams), skinned to a simple skeleton so it can
// breathe, stand, jog and pant; the lungs and airways inside it; a low-detail copy for the crowd.
//
// Model space: metres, feet on y = 0, facing +z, the figure's left side at +x.
import * as THREE from 'three';
import { ellipsoid, roundCone, capsule, sphere, smin, smax, meshSDF } from './sdf.js';

// ---------------------------------------------------------------- the skeleton (rest pose, world positions)
export const JOINTS = {
  pelvis: [0, 0.95, 0], spine: [0, 1.06, 0.0], chest: [0, 1.22, 0], neck: [0, 1.45, -0.012], head: [0, 1.56, 0],
};
for (const s of [1, -1]) {
  const L = s > 0 ? 'L' : 'R';
  Object.assign(JOINTS, {
    ['clav' + L]: [0.03 * s, 1.43, -0.01], ['upperArm' + L]: [0.185 * s, 1.385, -0.005],
    ['foreArm' + L]: [0.25 * s, 1.11, -0.025], ['hand' + L]: [0.285 * s, 0.865, 0.02],
    ['thigh' + L]: [0.092 * s, 0.925, 0.0], ['shin' + L]: [0.1 * s, 0.505, 0.012], ['foot' + L]: [0.102 * s, 0.085, -0.012],
  });
}
const PARENT = {
  spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck',
  clavL: 'chest', upperArmL: 'clavL', foreArmL: 'upperArmL', handL: 'foreArmL',
  clavR: 'chest', upperArmR: 'clavR', foreArmR: 'upperArmR', handR: 'foreArmR',
  thighL: 'pelvis', shinL: 'thighL', footL: 'shinL', thighR: 'pelvis', shinR: 'thighR', footR: 'shinR',
};
export const BONES = ['pelvis', ...Object.keys(PARENT)];

// ---------------------------------------------------------------- the body as distance-field parts, each owned by a bone
function parts() {
  const P = [];
  const add = (bone, f, k = 0.03) => P.push({ bone, f, k });
  // head
  add('head', ellipsoid([0, 1.638, -0.008], [0.077, 0.096, 0.094]), 0.0);
  add('head', ellipsoid([0, 1.586, 0.026], [0.061, 0.074, 0.07]), 0.03);
  add('head', ellipsoid([0, 1.548, 0.042], [0.043, 0.034, 0.042]), 0.025);         // jaw and chin
  add('head', ellipsoid([0, 1.634, 0.066], [0.058, 0.02, 0.03]), 0.02);           // brow
  add('head', roundCone([0, 1.622, 0.086], [0, 1.588, 0.104], 0.011, 0.016), 0.012); // nose
  add('head', ellipsoid([0, 1.562, 0.083], [0.021, 0.008, 0.012]), 0.008);        // upper lip
  add('head', ellipsoid([0, 1.549, 0.081], [0.019, 0.008, 0.012]), 0.008);        // lower lip
  for (const s of [1, -1]) {
    add('head', ellipsoid([0.077 * s, 1.598, -0.006], [0.011, 0.03, 0.02]), 0.012); // ears
    add('head', ellipsoid([0.045 * s, 1.586, 0.058], [0.022, 0.016, 0.02]), 0.02);  // cheeks
  }
  // neck and torso
  add('neck', capsule([0, 1.44, -0.012], [0, 1.555, -0.004], 0.049), 0.03);
  add('chest', ellipsoid([0, 1.29, -0.004], [0.163, 0.165, 0.105]), 0.04);
  add('chest', ellipsoid([0, 1.17, 0.003], [0.148, 0.12, 0.1]), 0.05);
  add('spine', ellipsoid([0, 1.055, 0.008], [0.133, 0.11, 0.097]), 0.05);
  add('pelvis', ellipsoid([0, 0.955, -0.004], [0.158, 0.1, 0.105]), 0.05);
  for (const s of [1, -1]) {
    add('pelvis', ellipsoid([0.068 * s, 0.905, -0.05], [0.078, 0.088, 0.075]), 0.04);   // buttocks
    add('chest', ellipsoid([0.07 * s, 1.315, 0.045], [0.074, 0.052, 0.045]), 0.05);        // chest muscles
    add('chest', capsule([0.05 * s, 1.445, -0.02], [0.165 * s, 1.405, -0.012], 0.042), 0.04); // trapezius
    add('upperArm' + (s > 0 ? 'L' : 'R'), sphere([0.188 * s, 1.37, -0.004], 0.054), 0.04); // shoulder
  }
  // arms and legs
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', J = (n) => JOINTS[n + L];
    add('upperArm' + L, roundCone(J('upperArm'), J('foreArm'), 0.045, 0.036), 0.03);
    add('upperArm' + L, ellipsoid([0.215 * s, 1.27, -0.004], [0.04, 0.075, 0.042]), 0.03);   // biceps
    add('foreArm' + L, roundCone(J('foreArm'), J('hand'), 0.037, 0.026), 0.025);
    add('foreArm' + L, ellipsoid([0.262 * s, 1.03, -0.01], [0.036, 0.07, 0.036]), 0.03);
    add('hand' + L, ellipsoid([0.293 * s, 0.79, 0.026], [0.02, 0.06, 0.038]), 0.025);
    add('hand' + L, capsule([0.288 * s, 0.84, 0.05], [0.289 * s, 0.79, 0.068], 0.011), 0.012);  // thumb
    add('thigh' + L, roundCone(J('thigh'), J('shin'), 0.078, 0.052), 0.05);
    add('thigh' + L, ellipsoid([0.1 * s, 0.75, 0.02], [0.068, 0.15, 0.07]), 0.04);           // quads
    add('shin' + L, roundCone(J('shin'), J('foot'), 0.05, 0.034), 0.03);
    add('shin' + L, ellipsoid([0.1 * s, 0.36, -0.03], [0.045, 0.1, 0.045]), 0.03);            // calf
    add('foot' + L, roundCone([0.102 * s, 0.035, -0.045], [0.108 * s, 0.026, 0.15], 0.036, 0.026), 0.03);
  }
  return P;
}

const PARTS = parts();
function bodySDF(x, y, z) {
  let d = 1e9;
  for (const p of PARTS) d = smin(d, p.f(x, y, z), p.k);
  return Math.max(d, -y + 0.004);           // flat soles
}

// ---------------------------------------------------------------- glass material
// Additive glass: a fresnel rim, two soft studio highlights, a whisper of fill; drawn after the organs, so they show
// through. A depth pre-pass keeps only the nearest surface, so overlapping parts never double up.
const GLASS_VS = /* glsl */`
  #include <common>
  #include <skinning_pars_vertex>
  uniform float uBreath;
  varying vec3 vN; varying vec3 vV; varying vec3 vRest; varying vec3 vWorld;
  varying vec3 vTint;
  void main(){
    vTint = vec3(1.);
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    float chest = smoothstep(1.08, 1.2, position.y) * (1. - smoothstep(1.36, 1.46, position.y)) * smoothstep(-0.06, 0.05, position.z);
    float belly = smoothstep(0.96, 1.04, position.y) * (1. - smoothstep(1.1, 1.18, position.y)) * smoothstep(-0.02, 0.06, position.z);
    transformed += normal * uBreath * (0.009 * chest + 0.006 * belly);
    vRest = position;
    #include <skinning_vertex>
    vec4 wp = vec4(transformed, 1.0);
    vec3 n = objectNormal;
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
      n = mat3(instanceMatrix) * n;
    #endif
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #endif
    wp = modelMatrix * wp;
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    vV = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const GLASS_FS = /* glsl */`
  uniform vec3 uColor; uniform float uAlpha, uRim, uFill, uSpec, uBack; uniform vec3 uKey, uKey2;
  uniform vec3 uWarm; uniform float uWarmAmt, uLegs;
  varying vec3 vN; varying vec3 vV; varying vec3 vRest; varying vec3 vWorld;
  varying vec3 vTint;
  void main(){
    vec3 N = normalize(vN), V = normalize(vV);
    if (uBack > 0.5) N = -N;
    float ndv = clamp(dot(N, V), 0., 1.);
    float f = pow(1. - ndv, 3.2);
    vec3 R = reflect(-V, N);
    float s1 = pow(max(dot(R, normalize(uKey)), 0.), 90.) * 1.3 + pow(max(dot(R, normalize(uKey)), 0.), 8.) * 0.06;
    float s2 = pow(max(dot(R, normalize(uKey2)), 0.), 40.) * 0.45;
    vec3 col = uColor * vTint;
    // the belly glows warm where the fat is (uWarmAmt), seen through the glass
    float warm = uWarmAmt * exp(-pow(length((vRest - vec3(0., 1.05, 0.08)) / vec3(0.12, 0.09, 0.08)), 2.));
    float legs = uLegs * (1. - smoothstep(0.78, 0.95, vRest.y)) * smoothstep(0.05, 0.2, vRest.y);
    vec3 c = col * (uFill + f * uRim) + uSpec * (s1 + s2) * vec3(1., .97, .93) + uWarm * warm * (0.3 + f)
           + vec3(1., 0.45, 0.15) * legs * (0.12 + 0.9 * f);
    gl_FragColor = vec4(c * uAlpha, 1.);
  }`;

export function glassMaterials(P) {
  const u = {
    uColor: { value: new THREE.Color(P.glass) }, uAlpha: { value: 1 }, uRim: { value: 1.5 }, uFill: { value: 0.008 },
    uSpec: { value: 1 }, uKey: { value: new THREE.Vector3(-0.5, 0.8, 0.6) }, uKey2: { value: new THREE.Vector3(0.9, 0.2, -0.3) },
    uBreath: { value: 0 }, uBack: { value: 0 }, uWarm: { value: new THREE.Color(P.fat) }, uWarmAmt: { value: 0 }, uLegs: { value: 0 },
  };
  const front = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: GLASS_VS, fragmentShader: GLASS_FS,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthFunc: THREE.LessEqualDepth,
  });
  const ub = { ...u, uBack: { value: 1 }, uAlpha: { value: 0.22 } };
  const back = new THREE.ShaderMaterial({
    uniforms: ub, vertexShader: GLASS_VS, fragmentShader: GLASS_FS, side: THREE.BackSide,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pre = new THREE.ShaderMaterial({
    uniforms: { uBreath: u.uBreath }, vertexShader: GLASS_VS,
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.); }', colorWrite: false,
    transparent: true,           // must sort with the transparent pass (after the organs), not before everything
  });
  return { front, back, pre, u, ub };
}

// ---------------------------------------------------------------- skin weights from the parts
function skinWeights(geo) {
  const pos = geo.attributes.position, n = pos.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const bi = Object.fromEntries(BONES.map((b, i) => [b, i]));
  const acc = new Float32Array(BONES.length);
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    acc.fill(0);
    for (const p of PARTS) acc[bi[p.bone]] += Math.exp(-Math.max(p.f(x, y, z), 0) / 0.012);
    const order = [...acc.keys()].sort((a, b) => acc[b] - acc[a]).slice(0, 4);
    let tot = 0;
    for (const b of order) tot += acc[b];
    order.forEach((b, k) => { si[v * 4 + k] = b; sw[v * 4 + k] = acc[b] / tot; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}

function makeSkeleton() {
  const bones = {};
  for (const name of BONES) { bones[name] = new THREE.Bone(); bones[name].name = name; }
  for (const name of BONES) {
    const p = JOINTS[name], par = PARENT[name];
    const pp = par ? JOINTS[par] : [0, 0, 0];
    bones[name].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if (par) bones[par].add(bones[name]);
  }
  bones.pelvis.updateMatrixWorld(true);       // the skeleton's inverse bind matrices come from this rest pose
  return { bones, skeleton: new THREE.Skeleton(BONES.map((b) => bones[b])) };
}

// ---------------------------------------------------------------- lungs and airways
function lungSDF(s) {         // s = +1 the figure's left lung, -1 its right lung
  const main = ellipsoid([0.074 * s, 1.262, -0.004], [0.066, 0.122, 0.074]);
  const apex = ellipsoid([0.064 * s, 1.355, -0.008], [0.042, 0.062, 0.046]);
  const dome = sphere([0.07 * s, 1.03, 0.0], 0.15);
  const med = ellipsoid([0, 1.25, 0.02], [0.026, 0.25, 0.06]);
  const heart = sphere([0.035, 1.19, 0.045], 0.058);
  return (x, y, z) => {
    let d = smin(main(x, y, z), apex(x, y, z), 0.04);
    d = smax(d, -dome(x, y, z), 0.03);
    d = smax(d, -med(x, y, z), 0.02);
    if (s > 0) d = smax(d, -heart(x, y, z), 0.03);
    return d;
  };
}

const ORGAN_VS = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.);
    vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; vP = position;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const LUNG_FS = /* glsl */`
  uniform vec3 uColor, uDeep; uniform float uAlpha, uGlow, uTime;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
  void main(){
    vec3 N = normalize(vN), V = normalize(vV);
    float ndv = abs(dot(N, V));
    float f = pow(1. - ndv, 2.);
    // alveoli: soft cells over the surface
    float n = noise(vP * 160.) * 0.6 + noise(vP * 60.) * 0.4;
    vec3 c = mix(uDeep, uColor, 0.35 + 0.65 * f) * (0.25 + 1.1 * f + 0.35 * n) * uGlow;
    gl_FragColor = vec4(c * uAlpha, 1.);
  }`;

function airways(rnd) {
  // trachea, two main bronchi, then four generations of branches into each lung
  const segs = [];
  const T0 = new THREE.Vector3(0, 1.49, 0.012), CAR = new THREE.Vector3(0, 1.315, 0.002);
  segs.push([T0, CAR, 0.0095, 0.0085]);
  const lungs = [lungSDF(1), lungSDF(-1)];
  for (const s of [1, -1]) {
    const hil = new THREE.Vector3(0.058 * s, 1.27, -0.002);
    segs.push([CAR, hil, 0.0075, 0.0062]);
    const grow = (p, dir, len, r, gen) => {
      if (gen > 4) return;
      const q = p.clone().addScaledVector(dir, len);
      const L = lungs[s > 0 ? 0 : 1];
      let tries = 0;
      while (L(q.x, q.y, q.z) > -0.006 && tries++ < 6) { len *= 0.75; q.copy(p).addScaledVector(dir, len); }
      segs.push([p.clone(), q, r, r * 0.8]);
      for (const side of [-1, 1]) {
        const axis = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(dir).normalize();
        const nd = dir.clone().applyAxisAngle(axis, side * (0.45 + 0.25 * rnd())).normalize();
        grow(q, nd, len * (0.72 + 0.1 * rnd()), r * 0.72, gen + 1);
      }
    };
    grow(hil, new THREE.Vector3(0.45 * s, 0.75, 0.05).normalize(), 0.05, 0.0058, 1);   // upper lobe
    grow(hil, new THREE.Vector3(0.35 * s, -0.9, 0.08).normalize(), 0.06, 0.0062, 1);  // lower lobe
    grow(hil, new THREE.Vector3(0.6 * s, -0.25, 0.55).normalize(), 0.045, 0.0052, 2); // middle/front
  }
  const geos = segs.map(([a, b, ra, rb]) => {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(rb, ra, len, 10, 1, false);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
    return g;
  });
  return { geos, segs };
}

function mergeGeos(geos) {
  let n = 0, ni = 0;
  for (const g of geos) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + o;
    o += g.attributes.position.count; oi += g.index.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}

// ---------------------------------------------------------------- build
export function buildBody(P, rnd, { h = 0.0062 } = {}) {
  const box = [[-0.36, -0.01, -0.17], [0.36, 1.76, 0.2]];
  const geo = meshSDF(bodySDF, box, h);
  skinWeights(geo);
  const { bones, skeleton } = makeSkeleton();
  const mats = glassMaterials(P);
  const root = new THREE.Group();
  root.add(bones.pelvis);
  const mk = (mat, order) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.frustumCulled = false; m.renderOrder = order;
    m.bind(skeleton, new THREE.Matrix4());
    root.add(m);
    return m;
  };
  const back = mk(mats.back, 20), pre = mk(mats.pre, 21), front = mk(mats.front, 22);

  // organs ride on their bones (built in rest-world coordinates, re-based onto the bone)
  const onBone = (obj, bone) => { const j = JOINTS[bone]; const g = new THREE.Group(); g.position.set(-j[0], -j[1], -j[2]); g.add(obj); bones[bone].add(g); return g; };
  const lungU = { uColor: { value: new THREE.Color(P.lung) }, uDeep: { value: new THREE.Color('#5A1420') }, uAlpha: { value: 1 },
    uGlow: { value: 1 }, uTime: { value: 0 } };
  const lungMat = new THREE.ShaderMaterial({ uniforms: lungU, vertexShader: ORGAN_VS, fragmentShader: LUNG_FS,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const lungs = new THREE.Group();
  for (const s of [1, -1]) {
    const L = lungSDF(s);
    const g = meshSDF(L, [[s > 0 ? -0.01 : -0.16, 1.1, -0.1], [s > 0 ? 0.16 : 0.01, 1.43, 0.1]], 0.004);
    const m = new THREE.Mesh(g, lungMat); m.renderOrder = 5;
    lungs.add(m);
  }
  const lungPivot = new THREE.Group();          // breathing scales the lungs about their centre
  lungPivot.position.set(0, 1.25, 0); lungs.position.set(0, -1.25, 0); lungPivot.add(lungs);
  onBone(lungPivot, 'chest');
  const aw = airways(rnd);
  const awMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#FFD2C6') }, uAlpha: { value: 1 } }, vertexShader: ORGAN_VS,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 1.5); gl_FragColor = vec4(uColor * (0.35 + 1.2 * f) * uAlpha, 1.); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const airMesh = new THREE.Mesh(mergeGeos(aw.geos), awMat); airMesh.renderOrder = 6;
  const airPivot = new THREE.Group(); airPivot.position.set(0, 1.25, 0); airMesh.position.set(0, -1.25, 0); airPivot.add(airMesh);
  onBone(airPivot, 'chest');

  // anchors for the specks' path (rest-world positions; world = bone matrix x rest)
  const anchors = {
    belly: [0, 1.05, 0.055], stomach: [0, 1.15, 0.03], carina: [0, 1.315, 0.002], throat: [0, 1.49, 0.012],
    mouth: [0, 1.556, 0.093], eyeL: [0.032, 1.613, 0.083], eyeR: [-0.032, 1.613, 0.083], brow: [0, 1.66, 0.085],
    bladder: [0, 0.93, 0.05],
  };
  const anchorBone = { belly: 'spine', stomach: 'spine', carina: 'chest', throat: 'neck', mouth: 'head', eyeL: 'head',
    eyeR: 'head', brow: 'head', bladder: 'pelvis' };

  const inv = {};
  const restInv = () => { root.updateMatrixWorld(true); for (const b of BONES) inv[b] = bones[b].matrixWorld.clone().invert(); };
  restInv();
  const tmpM = new THREE.Matrix4();
  const restQ = Object.fromEntries(BONES.map((b) => [b, bones[b].quaternion.clone()]));
  return {
    root, bones, skeleton, geo, mats, front, back, pre, lungs, lungPivot, lungU, airMesh, awMat, aw, anchors,
    lungSDF,
    /** world position of a rest-pose point carried by `bone` (call after root.updateMatrixWorld). */
    carry(p, bone, out = new THREE.Vector3()) {
      tmpM.multiplyMatrices(bones[bone].matrixWorld, inv[bone]);
      return out.set(p[0], p[1], p[2]).applyMatrix4(tmpM);
    },
    anchor(name, out) { return this.carry(this.anchors[name], anchorBone[name], out); },
    resetPose() { for (const b of BONES) bones[b].quaternion.copy(restQ[b]); bones.pelvis.position.set(...JOINTS.pelvis); },
    setVisible(v) { front.visible = back.visible = pre.visible = v; },
  };
}

/** A static, low-detail copy of the glass body for the crowd (instanced). */
export function crowdGeometry(h = 0.016) {
  return meshSDF(bodySDF, [[-0.36, -0.01, -0.17], [0.36, 1.76, 0.2]], h);
}

// ---------------------------------------------------------------- poses
const E = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));

/** Standing, breathing; `w` = jog weight 0..1, `phase` = jog cycle in radians; `pant` adds a heaving chest. */
export function pose(B, t, { jog = 0, phase = 0, breath = 0, idle = 1, dizzy = 0 } = {}) {
  const b = B.bones;
  B.resetPose();
  const sw = Math.sin(phase), cw = Math.cos(phase);
  const q = (name, x, y, z) => b[name].quaternion.multiply(E(x, y, z));
  // idle: a slow sway
  const sway = idle * 0.012 * Math.sin(t * 0.7);
  q('pelvis', 0, sway * 2, sway);
  q('chest', -0.03 * breath, 0, -sway * 0.6);
  q('head', 0.02 * Math.sin(t * 0.5) + 0.03 * breath, 0.03 * Math.sin(t * 0.37), 0);
  // arms relaxed: hang a little closer than the A-pose
  q('upperArmL', 0.02, 0, 0.1 * (1 - jog)); q('upperArmR', 0.02, 0, -0.1 * (1 - jog));
  // jog: legs and arms in opposition, knees and elbows bent, a forward lean and a bounce
  if (jog > 0) {
    const j = jog;
    b.pelvis.position.y += j * (0.025 * Math.abs(Math.cos(phase)) - 0.03);
    q('pelvis', j * 0.08, j * 0.12 * sw, 0);
    q('chest', j * 0.06, -j * 0.2 * sw, 0);
    q('head', -j * 0.1, j * 0.12 * sw, 0);
    q('thighL', -j * 0.62 * sw - j * 0.15, 0, 0); q('thighR', j * 0.62 * sw - j * 0.15, 0, 0);
    q('shinL', j * (0.25 + 0.85 * Math.max(0, Math.sin(phase + 1.2))), 0, 0);
    q('shinR', j * (0.25 + 0.85 * Math.max(0, Math.sin(phase + Math.PI + 1.2))), 0, 0);
    q('footL', -j * 0.2 * cw, 0, 0); q('footR', j * 0.2 * cw, 0, 0);
    q('upperArmL', j * 0.55 * sw, 0, j * 0.08); q('upperArmR', -j * 0.55 * sw, 0, -j * 0.08);
    q('foreArmL', -j * 1.3, 0, 0); q('foreArmR', -j * 1.3, 0, 0);
  }
  if (dizzy > 0) {
    q('head', 0.06 * dizzy * Math.sin(t * 5.1), 0, 0.12 * dizzy * Math.sin(t * 3.3));
    q('chest', 0, 0, 0.04 * dizzy * Math.sin(t * 3.3 + 0.8));
  }
  B.mats.u.uBreath.value = breath;
  const s = 1 + 0.06 * breath;
  B.lungPivot.scale.set(1 + 0.05 * breath, s, 1 + 0.07 * breath);
  B.root.updateMatrixWorld(true);
}
