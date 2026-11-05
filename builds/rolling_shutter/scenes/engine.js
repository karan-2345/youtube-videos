// scenes/engine.js -- the renderer, the studio look, and the rolling-shutter capture.
//
// The rolling shutter is simulated, never drawn: captureRows() renders the real 3D scene once per sensor row,
// each time with the scene set to that row's own moment, t(row) = t0 + (row / rows) * sweep, and a scissor strip
// so only that row is written. The bent blades are whatever those renders add up to.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const W = 1080, H = 1920;
export const SAFE = { x: 0, y: 240, w: 1080, h: 1440 };      // the middle 3:4
export const AMBER = new THREE.Color('#ffae42');               // the one accent

export function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  r.setPixelRatio(1);
  r.setSize(W, H, false);
  r.outputColorSpace = THREE.LinearSRGBColorSpace;   // the composite shader does tone mapping + sRGB itself
  r.toneMapping = THREE.NoToneMapping;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  return r;
}

export function rtFloat(w, h, samples = 0) {
  return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, colorSpace: THREE.LinearSRGBColorSpace });
}

// ---------------------------------------------------------------- studio environment (reflections): one big softbox
export function makeEnvironment(renderer) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0b0b0c, side: THREE.BackSide }));
  s.add(room);
  const box = (w, h, pos, c, look = new THREE.Vector3()) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(look); s.add(m); return m;
  };
  box(12, 9, new THREE.Vector3(-3.0, 4.0, 9), new THREE.Color(1, 0.98, 0.95).multiplyScalar(6.0));   // the key softbox
  box(30, 6, new THREE.Vector3(0, -7, 8), new THREE.Color(1, 1, 1).multiplyScalar(0.06));     // faint floor bounce
  box(1.5, 12, new THREE.Vector3(8, 0, 6), new THREE.Color(1, 1, 1).multiplyScalar(0.7));     // a thin edge strip
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return env;
}

// ---------------------------------------------------------------- materials
export function metal(rough = 0.24, color = 0xd9dbdf) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough });
}
// a material that renders normally but writes alpha 0, so the capture's alpha is "propeller here" only
export function noMask(mat) {
  mat.blending = THREE.NoBlending;
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, '  gl_FragColor.a = 0.0;\n}'); };
  mat.customProgramCacheKey = () => 'nomask';
  return mat;
}
// a material whose alpha is a given mask value (0..1): lets one blade be tinted while the others stay neutral
export function maskValue(mat, v) {
  mat.blending = THREE.NoBlending;
  mat.userData.mask = { value: v };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = mat.userData.mask;
    sh.fragmentShader = 'uniform float uMask;\n' + sh.fragmentShader.replace(/}\s*$/, '  gl_FragColor.a = uMask;\n}');
  };
  mat.customProgramCacheKey = () => 'mask';
  return mat;
}

// ---------------------------------------------------------------- the propeller (procedural, real airfoil sections)
function naca(x, t) {   // NACA 4-digit half thickness at chord position x in [0,1]
  return 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
}
export function bladeGeometry({ R = 1, root = 0.15, N = 56, M = 30, cmax = 0.27, pitch = 1.25, sweep = 0.07 } = {}) {
  const pos = [], idx = [];
  const ring = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const r = root + (R - root) * s;
    let c = cmax * (0.58 + 0.42 * Math.sin(Math.PI * Math.min(1, s * 0.95 + 0.18)));
    if (s > 0.86) c *= Math.sqrt(Math.max(0.012, 1 - ((s - 0.86) / 0.14) ** 2));
    const shank = Math.max(0, 1 - s / 0.12);                                    // round shank at the root
    const beta = Math.atan(pitch / (2 * Math.PI * Math.max(r, 0.2)));
    const tk = (0.13 - 0.06 * s);                                                // relative thickness
    const camber = 0.035;
    const skew = sweep * s * s;                                                  // scimitar sweep of the mid-chord
    const yUp = r - Math.max(0, s - 0.86) / 0.14 * 0.02;
    for (let j = 0; j < M; j++) {
      // around the section: j=0 trailing edge, upper surface to the leading edge, back along the lower surface
      const u = j / M * 2;
      const x = u <= 1 ? 1 - u : u - 1;                                          // 1 -> 0 -> 1
      const xs = 0.5 - 0.5 * Math.cos(Math.PI * x);                              // cosine spacing
      const yc = camber * 4 * xs * (1 - xs);
      let yt = naca(xs, tk);
      let px = (xs - 0.5) * c, pz = (yc + (u <= 1 ? yt : -yt)) * c;
      // blend to an ellipse at the shank
      const ang = Math.PI * 2 * j / M;
      const ex = Math.cos(ang) * 0.055, ez = Math.sin(ang) * 0.045;
      px = px * (1 - shank) + ex * shank; pz = pz * (1 - shank) + ez * shank;
      // twist: chord tilted by beta out of the rotation plane (axis z)
      const X = -(px * Math.cos(beta) - pz * Math.sin(beta)) + skew;
      const Z = px * Math.sin(beta) + pz * Math.cos(beta);
      pos.push(X, yUp, Z);
    }
    ring.push(i * M);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c2 = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M;
    idx.push(a, c2, b, b, c2, d);
  }
  // tip cap
  const tip = pos.length / 3;
  let cx = 0, cy = 0, cz = 0;
  for (let j = 0; j < M; j++) { cx += pos[(N * M + j) * 3]; cy += pos[(N * M + j) * 3 + 1]; cz += pos[(N * M + j) * 3 + 2]; }
  pos.push(cx / M, cy / M + 0.004, cz / M);
  for (let j = 0; j < M; j++) idx.push(N * M + j, tip, N * M + (j + 1) % M);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function spinnerGeometry(rb = 0.2, len = 0.34) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI / 2; pts.push(new THREE.Vector2(rb * Math.cos(a), len * Math.sin(a))); }
  pts.reverse();
  const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.x, p.y)), 48);
  g.rotateX(Math.PI / 2);   // lathe axis y -> z (nose toward the camera)
  return g;
}

// A propeller on a motor and a post, built as two meshes so each row of a capture costs few draw calls:
// the rotor (blade 0, hub, blade 1, blade 2 merged, with a per-vertex blade id) and the static motor + post.
// The rotor material writes alpha = uMaskV[blade id] (0..1): the capture's "propeller here" mask, per blade.
// prop.spin(a) turns the rotor (clockwise seen from the front); prop.setBlades(n) shows 1..3 blades.
function tagged(g, id) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count;
  g.setAttribute('aBlade', new THREE.Float32BufferAttribute(new Float32Array(n).fill(id), 1));
  return g;
}
export function rotorMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xd9dbdf, metalness: 1, roughness: 0.24 });
  mat.blending = THREE.NoBlending;
  mat.userData.maskV = { value: new THREE.Vector4(1, 1, 1, 1) };
  mat.userData.tintV = { value: new THREE.Vector4(0, 0, 0, 0) };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMaskV = mat.userData.maskV;
    sh.vertexShader = 'attribute float aBlade;\nvarying float vBlade;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlade = aBlade;');
    sh.fragmentShader = 'uniform vec4 uMaskV;\nvarying float vBlade;\n' +
      sh.fragmentShader
        .replace(/}\s*$/, '  int bi = int(vBlade + 0.5);\n  gl_FragColor.a = bi == 0 ? uMaskV.x : bi == 1 ? uMaskV.y : bi == 2 ? uMaskV.z : uMaskV.w;\n}');
  };
  mat.customProgramCacheKey = () => 'rotor';
  return mat;
}
export function makePropeller({ blades = 3, R = 1 } = {}) {
  const g = new THREE.Group();
  const blade = bladeGeometry({ R });
  const parts = [];
  const bl = (b) => tagged(blade.clone().rotateZ(-b * Math.PI * 2 / blades), b);
  const pieces = [];
  for (let b = 0; b < blades; b++) pieces.push(bl(b));
  const counts = pieces.map((p) => p.attributes.position.count);
  const geo = mergeGeometries(pieces);
  geo.computeBoundingSphere();
  const mat = rotorMaterial();
  const rotor = new THREE.Mesh(geo, mat);
  rotor.castShadow = true;
  g.add(rotor);
  // the hub is a solid of revolution about the spin axis, so turning it changes no pixel: it lives with the static parts
  const sp = spinnerGeometry(0.205 * R, 0.3 * R).translate(0, 0, 0.02 * R);
  const plate = new THREE.CylinderGeometry(0.215 * R, 0.215 * R, 0.08 * R, 48).rotateX(Math.PI / 2).translate(0, 0, -0.02 * R);
  const hubMat = maskValue(new THREE.MeshPhysicalMaterial({ color: 0x4c4e52, metalness: 1, roughness: 0.26 }), 0.0);
  const hub = new THREE.Mesh(mergeGeometries([sp.toNonIndexed(), plate.toNonIndexed()].map((x) => { x.deleteAttribute('uv'); return x; })), hubMat);
  hub.castShadow = true;
  g.add(hub);
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x2a2b2e, metalness: 0.8, roughness: 0.42 });
  const motor = new THREE.CylinderGeometry(0.17 * R, 0.19 * R, 0.42 * R, 48).rotateX(Math.PI / 2).translate(0, 0, -0.29 * R);
  const post = new THREE.CylinderGeometry(0.045 * R, 0.05 * R, 6 * R, 20).translate(0, -3 * R, -0.36 * R);
  const stat = new THREE.Mesh(mergeGeometries([motor.toNonIndexed(), post.toNonIndexed()]), noMask(dark));
  stat.castShadow = true;
  g.add(stat);
  g.userData = { rotor, mat, stat, dark, counts, hub, hubMat };
  g.spin = (a) => { rotor.rotation.z = -a; };
  g.setBlades = (n) => { geo.setDrawRange(0, n >= blades ? Infinity : counts.slice(0, n).reduce((x, y) => x + y, 0)); };
  g.setMask = (a, b, c, h = 0.5) => { mat.userData.maskV.value.set(a, b, c, 1); hubMat.userData.mask.value = h; };
  return g;
}

// ---------------------------------------------------------------- one studio: backdrop, key light, the propeller
export function makeStudio(env) {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 1.0;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 8, 8), noMask(new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.95, metalness: 0 })));
  back.position.z = -2.2; back.receiveShadow = true;
  back.material.envMapIntensity = 0.12;
  scene.add(back);
  const key = new THREE.SpotLight(0xfff4ea, 140, 0, 0.55, 1, 2);
  key.position.set(-3.2, 4.2, 6.5);
  key.target.position.set(0.3, -0.4, -2.2);
  key.castShadow = false;   // no cast shadows in captured scenes: see REPORT.md (a shadow pass per row costs 4x)
  key.shadow.mapSize.set(512, 512);
  key.shadow.radius = 3;
  key.shadow.bias = -0.0004;
  key.shadow.camera.near = 3; key.shadow.camera.far = 16;
  scene.add(key, key.target);
  const prop = makePropeller({});
  scene.add(prop);
  return { scene, back, key, prop };
}

// ---------------------------------------------------------------- the capture
// Render rows [r0, r1) of a W x H photo (camera view-offset decides what the photo sees) into rt (ss x supersampled),
// each row at its own time. setState(tScene) poses the scene; timeOfRow(row) gives each row's time.
// dir 'down': rows are horizontal (scan top -> bottom); 'right': rows are columns (scan left -> right), for a phone held sideways.
export function captureRows(renderer, { scene, camera, rt, rows, ss = 2, setState, timeOfRow, r0 = 0, r1 = rows, dir = 'down', clearFirst = true }) {
  const prevAuto = renderer.autoClear;
  // one clear for the whole target, then no clear per row: each row strip is written exactly once
  if (clearFirst) { rt.scissorTest = false; renderer.setRenderTarget(rt); renderer.clear(); }
  renderer.autoClear = false;
  rt.scissorTest = true;
  const across = dir === 'down' ? rt.width : rt.height;
  for (let r = r0; r < r1; r++) {
    setState(timeOfRow(r));
    if (dir === 'down') rt.scissor.set(0, rt.height - (r + 1) * ss, across, ss);   // GL rows count from the bottom: row 0 = top (checked by a per-row colour readback)
    else rt.scissor.set(r * ss, 0, ss, across);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
  }
  rt.scissorTest = false;
  renderer.setRenderTarget(null);
  renderer.autoClear = prevAuto;
}
