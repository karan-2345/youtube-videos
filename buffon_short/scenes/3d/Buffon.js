// scenes/3d/Buffon.js -- the whole Short as one continuous 3D scene: steel needles falling on oak floorboards.
//
// Everything is a pure function of t (seconds). Needle drops, phrase times and sound cues come from
// renders/cache/scene.json (tools/export.py); the rain counter is computed from exactly the needles that have landed.
// World: floor y = 0, planks 1 wide running along z, cracks at every integer x; needles 1 long (as long as a board
// is wide), direction (cos th, sin th) in (x, z).
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { track, ramp, ease, clamp01, lerp } from '/scenes/web/runtime.js';

export async function setup({ THREE, renderer, data, overlay, W, H }) {
  const A = data.anchors, P = data.palette, D = data.duration;
  const Q = new URLSearchParams(location.search);
  const col = (h) => new THREE.Color(h);
  const scene = new THREE.Scene();
  scene.background = col(P.bg);
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 120);

  renderer.shadowMap.enabled = !Q.has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // reflections for the steel only:
  if (Q.has('sceneenv')) { scene.environment = envTex; scene.environmentIntensity = 0.3; }  // the floor skips the cube lookups

  // ------------------------------------------------------------------ the floor: oiled oak planks, procedural
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0, envMapIntensity: 0.35 });
  if (!Q.has('plain')) floorMat.onBeforeCompile = (sh) => {
    sh.uniforms.cOak = { value: col(P.oak) };
    sh.uniforms.cLight = { value: col(P.oak_light) };
    sh.uniforms.cDark = { value: col(P.oak_dark) };
    sh.uniforms.cCrack = { value: col(P.crack) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; uniform vec3 cOak, cLight, cDark, cCrack;
        float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= .5; } return s; }
        vec3 wood(vec2 xz, out float crack){
          float plank = floor(xz.x), u = xz.x - plank, r = h1(plank + 3.7), r2 = h1(plank * 7.1 + 1.3);
          float tone = fbm(vec2(plank * 3.1 + 0.5, xz.y * 0.16));
          float warp = fbm(vec2(u * 2.2 + r * 9., xz.y * 0.21)) * 2.2 + 0.5 * sin(xz.y * 0.37 + r * 6.);
          float lines = abs(fract(u * (7.0 + 6.0 * r2) + warp * 1.5) - 0.5) * 2.0;
          float grain = smoothstep(0.78, 1.0, lines) * (0.45 + 0.55 * fbm(vec2(u * 18., xz.y * 0.45)));
          float pores = fbm(vec2(u * 150., xz.y * 2.4 + r * 11.));
          vec3 base = mix(cDark, cOak, clamp(0.5 + 0.35 * r + 0.5 * (tone - 0.5), 0., 1.));
          base = mix(base, cLight, 0.22 * smoothstep(0.45, 0.8, tone));
          base *= 0.84 + 0.24 * pores;
          base = mix(base, cDark * 0.7, 0.42 * grain);
          float d = min(u, 1.0 - u);
          float fw = fwidth(xz.x);
          crack = 1.0 - smoothstep(0.007, 0.007 + fw * 1.5, d);
          base *= mix(0.55, 1.0, smoothstep(0.0, 0.045, d));
          return mix(base, cCrack, crack);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float crackM; diffuseColor.rgb *= wood(vWPos.xz, crackM);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.42, 0.95, crackM);`);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ------------------------------------------------------------------ light: one warm lamp overhead
  const lamp = new THREE.SpotLight(col(P.lamp), 3.4, 0, 0.5, 0.85, 0);
  lamp.position.set(0.3, 13, 0.8);
  lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0002;
  lamp.shadow.normalBias = 0.004;
  lamp.shadow.camera.near = 6;
  lamp.shadow.camera.far = 22;
  scene.add(lamp, lamp.target);
  scene.add(new THREE.HemisphereLight(0xffe2c0, 0x120a05, 0.12));

  // ------------------------------------------------------------------ needles
  const R = 0.017;                                      // shaft radius (needle length 1)
  const shaft = new THREE.CylinderGeometry(R, R, 0.84, 12, 1, false); shaft.rotateZ(Math.PI / 2); shaft.translate(-0.08, 0, 0);
  const tip = new THREE.CylinderGeometry(0, R, 0.16, 12, 1, false); tip.rotateZ(-Math.PI / 2); tip.translate(0.42, 0, 0);
  const head = new THREE.SphereGeometry(R, 12, 8); head.translate(-0.5, 0, 0);
  const needleGeo = mergeGeometries([shaft, tip, head]);
  const steelMat = new THREE.MeshStandardMaterial({ color: col(P.steel), metalness: 0.6, roughness: 0.32, envMap: envTex, envMapIntensity: 1.2 });
  const redMat = new THREE.MeshStandardMaterial({ color: col(P.accent), metalness: 0.35, roughness: 0.3,
    emissive: col(P.accent), emissiveIntensity: 0.55, envMap: envTex, envMapIntensity: 0.4 });

  const needles = data.needles.map((n) => ({ ...n }));
  const hero = needles.find((n) => n.g === 'hero');
  needles.push({ ...hero, g: 'hero2' });                // the loop: the same drop, one duration later
  const NN = needles.length;
  const steel = new THREE.InstancedMesh(needleGeo, steelMat, NN);
  const red = new THREE.InstancedMesh(needleGeo, redMat, NN);
  for (const m of [steel, red]) {
    m.castShadow = true; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), qt = new THREE.Quaternion();
  const pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), Yax = new THREE.Vector3(0, 1, 0), Zax = new THREE.Vector3(0, 0, 1);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), grow = new THREE.Vector3();

  /** Pose of a dropped needle at needle-time tau into m4; 0 = not dropped yet, 1 = falling, 2 = landed. */
  function pose(n, tau) {
    if (tau < n.td) return 0;
    const u = (tau - n.td) / n.tf;
    let y, th, tilt, state;
    if (u < 1) {
      const k = 1 - u;
      y = R + n.h * (1 - u * u); th = n.th + n.spin * k * k; tilt = n.tilt * Math.pow(k, 1.5); state = 1;
    } else {
      const dt = tau - n.td - n.tf;
      y = R + 0.05 * Math.exp(-dt / 0.05) * Math.abs(Math.sin(dt * 36));
      th = n.th; tilt = 0.07 * Math.exp(-dt / 0.07) * Math.sin(dt * 48); state = 2;
    }
    qy.setFromAxisAngle(Yax, -th); qt.setFromAxisAngle(Zax, tilt); q.multiplyQuaternions(qy, qt);
    pos.set(n.x, y, n.z);
    const g = Math.min(1, u / 0.1);                     // grow in at the top of the fall (no pop-in mid-air)
    grow.set(g, g, g);
    m4.compose(pos, q, grow);
    return state;
  }

  const tF = A.cheated, tR = A.bridge, tHit = A.hit_it, tE = A.werent + 0.1;
  const rw = (t, t0, dur, from, to) => lerp(from, to, ease.inOut(clamp01((t - t0) / dur)));
  const rainEnd = data.rain.end + 0.6;
  const lazFirst = Math.min(...needles.filter((n) => n.g === 'laz' || n.g === 'lazfreeze').map((n) => n.td));
  const HERO2_SHOW = A.end_end;                          // hero2 enters (above the frame) only for the loop
  function tau(g, t) {
    switch (g) {
      case 'hero': case 'hook': case 'freeze':
        return t < tF ? t : t < tR ? tF : rw(t, tR, 1.3, tF, -4.4);
      case 'rain':
        return t < tE ? t : rw(t, tE, 0.85, rainEnd, data.rain.start - 1.2);
      case 'laz': case 'lazfreeze':
        return t < tE ? Math.min(t, tHit) : rw(t, tE, 0.85, tHit, lazFirst - 0.2);
      case 'hero2':
        return t < HERO2_SHOW ? -1e9 : t - D;
    }
    return t;
  }

  // rain bookkeeping: landing order = array order
  const rain = needles.filter((n) => n.g === 'rain');
  const rainLand = rain.map((n) => n.td + n.tf);
  const rainCross = [0];
  for (const n of rain) rainCross.push(rainCross[rainCross.length - 1] + (n.c ? 1 : 0));
  function landedRain(tauR) {                           // how many rain needles have landed by needle-time tauR
    let lo = 0, hi = rainLand.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (rainLand[mid] <= tauR) lo = mid + 1; else hi = mid; }
    return lo;
  }
  const laz = needles.filter((n) => n.g === 'laz');

  function updateNeedles(t) {
    for (let i = 0; i < NN; i++) {
      const n = needles[i];
      const s = pose(n, tau(n.g, t));
      if (s === 0) { steel.setMatrixAt(i, ZERO); red.setMatrixAt(i, ZERO); continue; }
      const isRed = s === 2 && n.c;
      (isRed ? red : steel).setMatrixAt(i, m4);
      (isRed ? steel : red).setMatrixAt(i, ZERO);
    }
    steel.instanceMatrix.needsUpdate = true; red.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ the demo needle (bridge, rule, circle)
  const demoMat = new THREE.MeshStandardMaterial({ color: col(P.steel), metalness: 0.6, roughness: 0.32, envMap: envTex, envMapIntensity: 1.2,
    emissive: col(P.accent), emissiveIntensity: 0 });
  const demo = new THREE.Mesh(needleGeo, demoMat);
  demo.castShadow = true;
  scene.add(demo);
  const cSteel = col(P.steel), cRed = col(P.accent);

  // rings traced by the tip (flat ribbons on the floor, drawn progressively from the start angle)
  const SEG = 240;
  function ring(cx, cz, a0, dir, colorAt) {
    const pos = [], cols = [];
    const r0 = 0.5 - 0.012, r1 = 0.5 + 0.012;
    for (let i = 0; i < SEG; i++) {
      const a = a0 + dir * 2 * Math.PI * i / SEG, b = a0 + dir * 2 * Math.PI * (i + 1) / SEG;
      const p = (rr, ang) => [cx + rr * Math.cos(ang), 0.004, cz + rr * Math.sin(ang)];
      const v = [p(r0, a), p(r1, a), p(r1, b), p(r0, a), p(r1, b), p(r0, b)];
      const c = colorAt((a + b) / 2);
      for (const x of v) { pos.push(...x); cols.push(c.r, c.g, c.b); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 2;
    scene.add(m);
    return m;
  }
  const inkL = col(P.ink).multiplyScalar(1.3), redL = col(P.accent).multiplyScalar(1.6);

  // the bridge drop: lands at the middle of board [0, 1], having spun once while falling
  const B = { x: 0.5, z: 0.0, th: 0.62, h: 3.0, td: A.falling - 0.75, land: A.a_circle + 0.05 };
  B.tf = B.land - B.td;
  const ring1 = ring(B.x, B.z, B.th + 2 * Math.PI, -1, () => inkL);
  // the circle beat: centre at distance cos(1)/2 from the crack at x = 1, where the share of directions that cross
  // is exactly 2/pi (crossing when |cos a| >= 2d)
  const Cc = { x: 1 + Math.cos(1) / 2, z: 0.0 };
  const crossAt = (a) => 0.5 * Math.abs(Math.cos(a)) >= Cc.x - 1;
  const SPIN0 = A.any_way + 0.15, SPIN1 = A.full_circle + 0.75;
  const ring2 = ring(Cc.x, Cc.z, Math.PI, 1, (a) => (crossAt(a) ? redL : inkL));

  // crossing dots where the demo needle meets a crack
  const dotGeo = new THREE.CircleGeometry(0.04, 24); dotGeo.rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: col(P.accent).multiplyScalar(2.2), transparent: true, depthWrite: false });
  const dots = [0, 1].map(() => { const d = new THREE.Mesh(dotGeo, dotMat); d.renderOrder = 3; scene.add(d); return d; });

  // the board-width band ('as long as the boards are wide')
  const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.6), new THREE.MeshBasicMaterial({ color: col(P.lamp),
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  band.rotation.x = -Math.PI / 2; band.position.set(0.5, 0.003, 0);
  scene.add(band);

  // demo pose keys: [t, x, z, th]
  const ACROSS = [
    [A.rule + 0.05, B.x, B.z, B.th], [A.rule + 1.3, 0.5, 0, 0],
    [A.across + 0.1, 0.5, 0, 0], [A.across + 0.8, 1.35, 0, 0], [A.hits + 0.25, 0.72, 0, 0], [A.along - 0.05, 1.1, 0, 0],
    [A.along + 0.75, 1.1, 0, Math.PI / 2], [A.never - 0.55, 1.18, 0, Math.PI / 2], [A.rule_end - 0.05, 2.55, 0, Math.PI / 2],
    [A.circ + 0.95, Cc.x, Cc.z, Math.PI], [SPIN0, Cc.x, Cc.z, Math.PI],
  ];
  function keyed(t, keys) {
    let i = 1;
    while (i < keys.length - 1 && t > keys[i][0]) i++;
    const a = keys[i - 1], b = keys[i];
    const u = ease.inOut(clamp01((t - a[0]) / Math.max(1e-6, b[0] - a[0])));
    return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
  }

  function updateDemo(t) {
    let x, z, th, y = R, tilt = 0, vis = true;
    ring1.material.opacity = 0; ring2.material.opacity = 0;
    if (t < B.td || t > A.twice + 1.4) vis = false;
    else if (t < B.land) {                                // falling and spinning once: the tip draws ring1
      const u = clamp01((t - B.td) / B.tf), k = 1 - u;
      const p = 1 - Math.pow(k, 1.25);
      x = B.x; z = B.z; th = B.th + 2 * Math.PI * (1 - p);
      y = R + B.h * (1 - u * u); tilt = 0.5 * Math.pow(k, 1.5);
      ring1.geometry.setDrawRange(0, 6 * Math.floor(p * SEG));
      ring1.material.opacity = 1;
    } else if (t < SPIN0) {
      if (t < A.rule) { x = B.x; z = B.z; th = B.th; } else [x, z, th] = keyed(t, ACROSS);
      const dt = t - B.land;
      y = R + 0.04 * Math.exp(-dt / 0.05) * Math.abs(Math.sin(dt * 36));
      ring1.geometry.setDrawRange(0, 6 * SEG);
      ring1.material.opacity = 1 - ramp(t, A.rule - 0.1, A.rule + 0.6);
    } else {                                              // the full turn: the tip draws ring2, red where it crosses
      const p = ease.inOut(clamp01((t - SPIN0) / (SPIN1 - SPIN0)));
      x = Cc.x; z = Cc.z; th = Math.PI + 2 * Math.PI * p;
      ring2.geometry.setDrawRange(0, 6 * Math.floor(p * SEG + 0.5));
      ring2.material.opacity = 1 - ramp(t, A.twice + 0.3, A.twice + 1.1);
      const up = ramp(t, A.twice + 0.2, A.twice + 1.3, ease.in);
      y = R + up * 7;
    }
    demo.visible = vis;
    if (!vis) { dots.forEach((d) => (d.visible = false)); band.material.opacity = 0; return; }
    qy.setFromAxisAngle(Yax, -th); qt.setFromAxisAngle(Zax, tilt); q.multiplyQuaternions(qy, qt);
    demo.position.set(x, y, z); demo.quaternion.copy(q);
    // crossing: the needle's x-extent reaches a crack (touching counts); lying flat only
    const ext = 0.5 * Math.abs(Math.cos(th));
    const flat = y < R + 0.02;
    const hits = [];
    if (flat) for (let k = Math.ceil(x - ext - R); k <= Math.floor(x + ext + R); k++) {
      const s = Math.abs(Math.cos(th)) > 1e-3 ? (k - x) / Math.cos(th) : 0;      // distance along the needle
      if (Math.abs(s) <= 0.5 + 1e-6 || Math.abs(Math.cos(th)) <= 1e-3) hits.push([k, z + s * Math.sin(th)]);
    }
    let crossing = hits.length > 0;
    if (t > A.rule + 1.0 && t < A.across + 0.1) crossing = false;   // lying exactly across one board: shown as a fit
    const glow = crossing ? 1 : 0;
    demoMat.color.copy(cSteel).lerp(cRed, glow);
    demoMat.metalness = lerp(0.6, 0.35, glow);
    demoMat.emissiveIntensity = 0.55 * glow;
    dots.forEach((d, i) => {
      d.visible = crossing && i < hits.length;
      if (d.visible) d.position.set(hits[i][0], 0.006, hits[i][1]);
    });
    band.material.opacity = 0.07 * ramp(t, A.rule + 1.0, A.rule + 1.5) * (1 - ramp(t, A.across + 0.2, A.across + 0.8));
  }

  // ------------------------------------------------------------------ camera
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SHOTS = [
    [0, V(0.95, 2.55, 3.35), V(0.12, 0.3, 0.12)],                 // the opening close-up (also the last frame)
    [A.dropping - 0.2, V(0.95, 2.55, 3.35), V(0.12, 0.3, 0.12)],
    [A.floor + 0.7, V(1.5, 6.4, 7.6), V(0.1, 0, -0.2)],            // pull back: the shower
    [tR, V(-0.7, 6.8, 7.8), V(0.1, 0, -0.1)],                      // slow drift through the freeze
    [A.falling + 0.3, V(1.0, 7.6, 2.4), V(1.0, 0, -0.35)],         // top-down on three boards
    [A.twice + 0.1, V(1.1, 7.4, 2.2), V(1.05, 0, -0.35)],
    [A.twice + 1.9, V(0.0, 30.5, 6.0), V(0, 0, -0.9)],             // up: the rain (pile y 790-1290, numbers above)
    [A.catch + 0.2, V(0.15, 30.0, 5.8), V(0, 0, -0.9)],
    [A.thousand, V(-8.56, 32.36, 20.38), V(1.0, 0, -1.1)],          // slow orbit; the pile stays under the numbers
    [A.end - 0.1, V(8.13, 30.34, 20.78), V(-0.75, 0, -1.2)],
    [A.trick, V(4.65, 32.44, 18.37), V(-0.25, 0, -1.3)],
    [A.end_end + 0.06, V(0.65, 30.9, 15.19), V(-0.5, 0, -1.2)],
    [D - 0.1, V(0.95, 2.55, 3.35), V(0.12, 0.3, 0.12)],           // dive home: the loop
    [D + 1, V(0.95, 2.55, 3.35), V(0.12, 0.3, 0.12)],
  ];
  const look = new THREE.Vector3();
  function updateCamera(t) {
    let i = 1;
    while (i < SHOTS.length - 1 && t > SHOTS[i][0]) i++;
    const [t0, p0, l0] = SHOTS[i - 1], [t1, p1, l1] = SHOTS[i];
    const u = ease.inOut(clamp01((t - t0) / (t1 - t0)));
    camera.position.lerpVectors(p0, p1, u);
    look.lerpVectors(l0, l1, u);
    camera.lookAt(look);
  }

  // ------------------------------------------------------------------ on-screen type
  const items = [];
  const X = W / 2;
  function txt(html, cls, y, tIn, tOut, extra = {}) {
    const el = overlay.el(html, `t ${cls}`);
    const it = { el, y, tIn, tOut, html, ...extra };
    items.push(it);
    return it;
  }
  const setHTML = (it, h) => { if (it.html !== h) { it.el.innerHTML = h; it.html = h; } };
  const fmt = (n) => n.toLocaleString('en-US');
  const Y_LABEL = 330, Y_BIG = 480, Y_SUB = 630, Y_SUB2 = 710;

  // hook
  txt('π', 'huge', Y_BIG, A.pi - 0.1, A.mathematician - 0.35);
  txt('Mario Lazzarini · 1901', 'label', Y_LABEL, A.mathematician + 0.1, tR - 0.3);
  const PI6 = '141592';
  const hookNum = txt('', 'big', Y_BIG, A.six - 0.35, tR - 0.3, {
    update(t) {
      const n = Math.floor(clamp01((t - A.six) / (A.right - A.six + 0.2)) * 6.999);
      setHTML(this, `3.<span>${PI6.slice(0, n)}</span><span class="ghost">${PI6.slice(n)}</span>`);
    },
  });
  const hookDrops = txt('', 'small', Y_SUB + 10, A.numbers + 0.35, tR - 0.3, {
    update(t) { setHTML(this, `<span class="${t >= tF - 0.05 ? 'acc' : ''}">3,408</span> <span class="dim">DROPS</span>`); },
  });
  txt('1,808 <span class="dim">CROSSINGS</span>', 'small', Y_SUB2 + 30, A.numbers + 0.75, tR - 0.3);

  // circle beat
  txt('Chance of a crossing', 'label', Y_LABEL, A.chance, A.twice - 0.15);
  txt('2/π', 'huge', Y_BIG, A.two_over_pi - 0.3, A.twice - 0.15);
  txt('about 64%', 'label', Y_SUB + 20, A.two_over_pi + 0.7, A.twice - 0.15);
  const FRAC = (a, b) => `<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle">` +
    `<span>${a}</span><span style="display:block;height:9px;width:100%;background:currentColor;border-radius:5px;margin:10px 0 12px"></span><span>${b}</span></span>`;
  const RAIN_UI = A.twice + 2.4;
  txt(`<span style="display:inline-flex;align-items:center;gap:34px"><span>π ≈</span>${FRAC('2 × DROPS', 'CROSSINGS')}</span>`,
    'small', Y_BIG, A.twice - 0.05, RAIN_UI - 0.3);
  txt('π ≈ 2 × drops ÷ crossings', 'label', Y_LABEL, RAIN_UI, A.catch - 0.3);
  const estimate = txt('', 'big', Y_BIG, RAIN_UI, A.catch - 0.3, {
    update(t) {
      const n = landedRain(tau('rain', t)), c = rainCross[n];
      if (!c) return setHTML(this, '<span class="dim">–</span>');
      const s = (2 * n / c).toFixed(4);
      if (n < rain.length) return setHTML(this, s);
      const hot = t >= A.one_decimal - 0.05;
      setHTML(this, `<span class="${hot ? 'acc' : ''}">${s.slice(0, 3)}</span><span class="dim">${s.slice(3)}</span>`);
    },
  });
  const counts = txt('', 'label', Y_SUB, RAIN_UI, A.catch - 0.3, {
    update(t) {
      const n = landedRain(tau('rain', t));
      setHTML(this, `${fmt(n)} drops · ${fmt(rainCross[n])} crossings`);
    },
  });
  txt('real π = 3.14159…', 'label dim', Y_SUB2, A.honest - 0.1, A.catch - 0.3);

  // the catch
  txt('Mario Lazzarini · 1901', 'label', Y_LABEL, A.away - 0.2, A.old - 0.1);
  txt('Zu Chongzhi · China · about AD 480', 'label', Y_LABEL, A.old + 0.05, A.drops3408 - 0.25);
  txt('355/113', 'big', Y_BIG, A.frac - 0.3, A.drops3408 - 0.25);
  txt('= 3.1415929…', 'small dim', Y_SUB + 10, A.frac_end - 0.4, A.drops3408 - 0.25);
  const hotT = A.right_number + 0.3;
  txt('', 'small', Y_LABEL + 5, A.drops3408 - 0.05, A.catch_end + 0.15, {
    update(t) { setHTML(this, `<span class="dim">355/</span><span class="${t >= hotT ? 'acc' : 'dim'}">113</span>`); },
  });
  txt('3,408 = 16 × 213', 'small', Y_BIG, A.drops3408, A.catch_end + 0.15);
  txt('', 'small', Y_SUB, A.drops3408 + 0.45, A.catch_end + 0.15, {
    update(t) { setHTML(this, `1,808 = 16 × <span class="${t >= hotT ? 'acc' : ''}">113</span>`); },
  });

  // the end: his count climbs to 1,808 and stops; then his six decimals are struck out
  txt('Lazzarini’s count', 'label', Y_LABEL, A.end + 0.05, A.trick - 0.25);
  const lazLand = laz.map((n) => n.td + n.tf);
  const lazN = (t) => lazLand.filter((x) => x <= Math.min(t, tHit)).length;
  txt('', 'big', Y_BIG, A.end + 0.05, A.trick - 0.25, {
    update(t) { const k = lazN(t); setHTML(this, `<span class="${k === 3 ? 'acc' : ''}">${fmt(1805 + k)}</span>`); },
  });
  txt('', 'label', Y_SUB, A.end + 0.05, A.trick - 0.25, {
    update(t) { setHTML(this, `crossings · ${fmt(3405 + lazN(t))} drops`); },
  });
  txt('His six decimals', 'label', Y_LABEL, A.trick - 0.05, A.end_end - 0.1);
  const struck = txt('3.<span class="strike">141592</span>', 'big', Y_BIG, A.trick - 0.05, A.end_end - 0.1, {
    update(t) {
      const s = this.el.querySelector('.strike');
      const w = s.offsetWidth * ease.inOut(clamp01((t - A.but_his - 0.35) / 1.1));
      s.style.setProperty('--sw', `${w.toFixed(1)}px`);
    },
  });

  function updateType(t) {
    for (const it of items) {
      const a = ramp(t, it.tIn, it.tIn + 0.3, ease.out) * (1 - ramp(t, it.tOut, it.tOut + 0.3, ease.inOut));
      if (a <= 0.001) { if (it.el.style.opacity !== '0') it.el.style.opacity = 0; continue; }
      if (it.update) it.update(t);
      const dy = (1 - ramp(t, it.tIn, it.tIn + 0.45, ease.out)) * 18;
      overlay.place(it.el, X, it.y, { anchor: 'c', opacity: a, dy });
    }
  }

  // ------------------------------------------------------------------ lamp and grade
  const LAMP = [[0, 3.4], [A.catch, 3.4], [A.catch + 1.5, 2.2], [A.end_end - 0.6, 2.4], [D - 0.3, 3.4], [D + 1, 3.4]];

  return {
    scene, camera,
    post: Q.has('nopost') ? null : { ss: Number(Q.get('ss') || 1.5), msaa: Number(Q.get('msaa') ?? 0), samples: 1, shutter: 0.5, grain: 0.028, vignette: 0.5, exposure: 1.0, bg: P.bg },
    blurSamples(t) {
      const fast = (t > tR - 0.05 && t < tR + 1.4) || (t > tE - 0.05 && t < D);
      return fast ? 4 : 1;
    },
    update(t) {
      updateNeedles(t);
      updateDemo(t);
      updateCamera(t);
      lamp.intensity = track(t, LAMP);
      updateType(t);
    },
    look(t) {
      const frz = ramp(t, tF - 0.05, tF + 0.25) * (1 - ramp(t, tR, tR + 0.4))
        + ramp(t, tHit - 0.05, tHit + 0.25) * (1 - ramp(t, tE, tE + 0.4));
      return { mono: 0.3 * frz, exposure: 1.0 };
    },
  };
}
