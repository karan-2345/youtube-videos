// scenes/3d/lib/lab.js -- the 2014 Amsterdam experiment as a table-top: a steel tray of pale desert sand (80 x 30
// cm), a small wooden sled loaded with brass weights, pulled along by a thread to a force sensor on a motor rail;
// a glass beaker pours water. The sand surface is shaped in the vertex shader: the heap that builds in front of the
// sled on dry sand, the groove behind it, the dark wet sand, and mud (glossy, puddled, the sled sinking).
//
// Lab frame (the group's local space): the tray's centre at the origin, its long axis along x, sand top at y = 0.
import * as THREE from 'three';
import { patch, mulberry } from './common.js';
import { woodMaterial } from './props.js';

export const TRAY = { lx: 0.8, lz: 0.3, depth: 0.05 };
export const SLED = { lx: 0.14, lz: 0.09, h: 0.022 };

const HEIGHT = `
  uniform float uSledX, uSledZ, uHeap, uGroove, uSink, uMud, uWet, uStart, uLevel;
  float sandH(vec2 p){
    float x = p.x, z = p.y;
    float rough = (vnoise(p * 180.) - .5) * 0.0012 + (vnoise(p * 60.) - .5) * 0.0018;
    float h = rough * (1. - 0.85 * clamp(uMud, 0., 1.));
    float front = uSledX + ${(SLED.lx / 2).toFixed(4)}, back = uSledX - ${(SLED.lx / 2).toFixed(4)};
    float acrossIn = 1. - smoothstep(${(SLED.lz / 2 - 0.004).toFixed(4)}, ${(SLED.lz / 2 + 0.01).toFixed(4)}, abs(z - uSledZ));
    // the groove the sled has ploughed (from where it started to its back), with low berms each side
    float along = smoothstep(uStart - 0.02, uStart, x) * (1. - smoothstep(back - 0.004, back + 0.006, x));
    float bq = (abs(z - uSledZ) - ${(SLED.lz / 2 + 0.012).toFixed(4)}) / 0.008;
    float berm = exp(-bq * bq) * smoothstep(uStart - 0.02, uStart + 0.02, x) * (1. - smoothstep(back, front + 0.01, x));
    h += uLevel * (-uGroove * acrossIn * along + uGroove * 0.6 * berm);
    // the heap pushed up in front of the sled: a ridge that spills round the sides
    float dx = x - front;
    float rq = (dx - 0.012 - uHeap * 0.5) / (0.012 + uHeap * 0.9);
    float ridge = exp(-rq * rq) * step(-0.01, dx);
    float wide = 1. - smoothstep(${(SLED.lz / 2).toFixed(4)}, ${(SLED.lz / 2 + 0.03).toFixed(4)}, abs(z - uSledZ));
    h += uLevel * uHeap * ridge * wide * (0.85 + 0.3 * vnoise(p * 70.));
    // under the sled: pressed down (sinking in the mud)
    float under = acrossIn * smoothstep(back - 0.01, back + 0.005, x) * (1. - smoothstep(front - 0.005, front + 0.01, x));
    h -= uSink * under;
    // mud slumps the surface a little and makes it smooth
    h -= 0.004 * clamp(uMud, 0., 1.);
    return h;
  }`;

export function buildLab(P, renderer) {
  const g = new THREE.Group();
  const U = {
    uSledX: { value: -0.25 }, uSledZ: { value: 0 }, uHeap: { value: 0 }, uGroove: { value: 0 }, uSink: { value: 0 }, uMud: { value: 0 },
    uWet: { value: 0 }, uWetC: { value: new THREE.Vector2(0, 0) }, uWetR: { value: 0 }, uStart: { value: -0.25 }, uLevel: { value: 1 },
    cSand: { value: new THREE.Color('#D9B47C') }, cWet: { value: new THREE.Color(P.sand_wet) }, cMud: { value: new THREE.Color('#3E2C1E') },
  };
  // ---- table and room
  const tableMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2B211B'), roughness: 0.55 });
  patch(tableMat, { vHead: 'varying vec3 vL;', vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' }, fHead: 'varying vec3 vL;',
    frag: { '#include <color_fragment>': '#include <color_fragment>\ndiffuseColor.rgb *= 0.75 + 0.4 * vnoise(vec2(vL.x * 3., vL.z * 60.)) * (0.7 + 0.3 * vnoise(vec2(vL.x * 30., vL.z * 300.)));' } });
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 1.6), tableMat);
  table.position.y = -TRAY.depth - 0.03 - 0.004; table.receiveShadow = true; g.add(table);
  // ---- the tray
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.steel), roughness: 0.32, metalness: 0.85 });
  const wallT = 0.006, rimH = 0.012;
  const addBox = (sx, sy, sz, x, y, z, mat = steel) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  addBox(TRAY.lx + 2 * wallT, TRAY.depth + rimH, wallT, 0, (rimH - TRAY.depth) / 2, TRAY.lz / 2 + wallT / 2);
  addBox(TRAY.lx + 2 * wallT, TRAY.depth + rimH, wallT, 0, (rimH - TRAY.depth) / 2, -TRAY.lz / 2 - wallT / 2);
  addBox(wallT, TRAY.depth + rimH, TRAY.lz, TRAY.lx / 2 + wallT / 2, (rimH - TRAY.depth) / 2, 0);
  addBox(wallT, TRAY.depth + rimH, TRAY.lz, -TRAY.lx / 2 - wallT / 2, (rimH - TRAY.depth) / 2, 0);
  addBox(TRAY.lx + 2 * wallT, 0.004, TRAY.lz + 2 * wallT, 0, -TRAY.depth - 0.002, 0);
  // ---- the sand surface (displaced in the shader)
  const sg = new THREE.PlaneGeometry(TRAY.lx, TRAY.lz, 320, 120); sg.rotateX(-Math.PI / 2);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  patch(sandMat, {
    uniforms: U,
    vHead: `${HEIGHT_NOISE}${HEIGHT} varying vec3 vL;`,
    vert: {
      '#include <beginnormal_vertex>': `#include <beginnormal_vertex>
        { float e = 0.0015; vec2 p = position.xz;
          float h0 = sandH(p), hx = sandH(p + vec2(e, 0.)), hz = sandH(p + vec2(0., e));
          objectNormal = normalize(vec3(-(hx - h0) / e, 1., -(hz - h0) / e)); }`,
      '#include <begin_vertex>': '#include <begin_vertex>\ntransformed.y += sandH(position.xz); vL = transformed;',
    },
    fHead: 'varying vec3 vL; uniform float uWet, uMud, uWetR; uniform vec2 uWetC; uniform vec3 cSand, cWet, cMud;',
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        vec2 p = vL.xz;
        float grain = vnoise(p * 900.) * 0.5 + vnoise(p * 300.) * 0.5;
        vec3 c = cSand * (0.86 + 0.2 * grain) * (0.95 + 0.1 * vnoise(p * 40.));
        // the wet front spreads from where the water lands
        float r = length((p - uWetC) * vec2(0.8, 1.0));
        float wet = uWet * (1. - smoothstep(uWetR - 0.03, uWetR + 0.03 + 0.02 * vnoise(p * 50.), r));
        vec3 w = cWet * (0.85 + 0.2 * grain);
        c = mix(c, w, clamp(wet, 0., 1.));
        float mud = clamp(uMud, 0., 1.);
        c = mix(c, cMud * (0.9 + 0.15 * vnoise(p * 30.)), mud);
        diffuseColor.rgb *= c;
        float vWet = clamp(wet, 0., 1.);
        float vMud = mud;`,
      '#include <roughnessmap_fragment>': '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(0.95, 0.6, vWet), 0.3, vMud);',
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * step(0.993, vnoise(vL.xz * 1400.)) * 0.35 * (1. - vWet);`,
    },
  });
  const sand = new THREE.Mesh(sg, sandMat); sand.receiveShadow = true; sand.castShadow = false;
  g.add(sand);
  // ---- puddles of water standing on the mud
  const puddleMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#222A30'), roughness: 0.02, metalness: 0.2, transparent: true, opacity: 0 });
  const puddleU = { uP: { value: 0 } };
  patch(puddleMat, { uniforms: puddleU, vHead: 'varying vec3 vL;', vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' },
    fHead: 'varying vec3 vL; uniform float uP;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      float n = fbm(vL.xz * 9.) * 0.75 + vnoise(vL.xz * 41.) * 0.25;
      float a = smoothstep(0.6 - 0.12 * uP, 0.63 - 0.12 * uP, n) * uP;
      diffuseColor.a = a * 0.85;` } });
  const puddles = new THREE.Mesh(new THREE.PlaneGeometry(TRAY.lx, TRAY.lz), puddleMat);
  puddles.rotation.x = -Math.PI / 2; puddles.position.y = -0.0035; g.add(puddles);

  // ---- the sled with its weights
  const sled = new THREE.Group();
  const wood = woodMaterial(P);
  const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#C9A24A'), roughness: 0.25, metalness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(SLED.lx, SLED.h * 0.45, SLED.lz), wood); base.position.y = SLED.h * 0.225; base.castShadow = true; sled.add(base);
  for (const s of [-1, 1]) {
    const run = new THREE.Mesh(new THREE.BoxGeometry(SLED.lx * 1.04, SLED.h * 0.55, 0.012), wood);
    run.position.set(0.002, SLED.h * 0.27, s * (SLED.lz / 2 - 0.006)); run.castShadow = true; sled.add(run);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(SLED.h * 0.28, SLED.h * 0.28, 0.012, 12), wood);
    tip.rotation.x = Math.PI / 2; tip.position.set(SLED.lx / 2 + 0.002, SLED.h * 0.3, s * (SLED.lz / 2 - 0.006)); sled.add(tip);
  }
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.024 - i * 0.004, 0.024 - i * 0.004, 0.016, 28), brass);
    w.position.set(-0.005, SLED.h * 0.45 + 0.008 + i * 0.017, 0); w.castShadow = true; sled.add(w);
  }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0015, 6, 14), steel); hook.position.set(SLED.lx / 2 + 0.004, SLED.h * 0.35, 0); sled.add(hook);
  g.add(sled);
  // ---- the rail, the carriage with the force sensor, the thread
  const black = new THREE.MeshStandardMaterial({ color: new THREE.Color('#15181C'), roughness: 0.4, metalness: 0.4 });
  addBox(1.2, 0.03, 0.06, 0.85, -0.02, 0, black);
  const carriage = new THREE.Group();
  const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.08), black); cBody.position.y = 0.025; cBody.castShadow = true; carriage.add(cBody);
  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 20), steel); sensor.rotation.z = Math.PI / 2; sensor.position.set(-0.07, 0.03, 0); sensor.castShadow = true; carriage.add(sensor);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(P.good) })); led.position.set(0, 0.057, 0.03); carriage.add(led);
  g.add(carriage);
  const threadMat = new THREE.MeshStandardMaterial({ color: 0xF4F0E8, roughness: 0.6 });
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 1, 6), threadMat); thread.castShadow = true; g.add(thread);
  // ---- the beaker (glass with water inside)
  const glassMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#DDEFFA'), roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.22, depthWrite: false });
  const beaker = new THREE.Group();
  const bg = new THREE.CylinderGeometry(0.04, 0.038, 0.11, 32, 1, true); bg.translate(0, 0.055, 0);
  const bm = new THREE.Mesh(bg, glassMat); beaker.add(bm);
  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0022, 6, 32), glassMat); spout.rotation.x = Math.PI / 2; spout.position.y = 0.11; beaker.add(spout);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.038, 32), glassMat); bottom.rotation.x = -Math.PI / 2; beaker.add(bottom);
  const waterIn = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0365, 1, 28), new THREE.MeshStandardMaterial({ color: new THREE.Color(P.water), roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }));
  beaker.add(waterIn);
  // marks on the glass
  for (let i = 1; i <= 4; i++) { const mk = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0012, 0.001), new THREE.MeshBasicMaterial({ color: 0xffffff })); mk.position.set(0, i * 0.02, 0.0405); beaker.add(mk); }
  g.add(beaker);

  /** state: { sledX, start, heap, groove, sink, tilt (sled pitch, rad), wet, wetR, wetC: [x, z], mud, puddle, level, beaker: { x, z, y, tilt, fill } } */
  function set(s) {
    U.uSledX.value = s.sledX; U.uStart.value = s.start; U.uHeap.value = s.heap; U.uGroove.value = s.groove; U.uSink.value = s.sink;
    U.uWet.value = s.wet; U.uWetR.value = s.wetR; U.uWetC.value.set(s.wetC[0], s.wetC[1]); U.uMud.value = s.mud; U.uLevel.value = s.level ?? 1;
    puddleMat.opacity = 1;
    puddles.visible = s.puddle > 0.001;
    puddleU.uP.value = s.puddle;
    sled.position.set(s.sledX, -s.sink * 0.9 + (s.ride ?? 0), 0);
    sled.rotation.z = s.tilt ?? 0;
    const cx = s.sledX + 0.55;
    carriage.position.set(cx, 0.0, 0);
    // thread from the sled's hook to the sensor
    const a = new THREE.Vector3(s.sledX + SLED.lx / 2 + 0.008, SLED.h * 0.35 - s.sink * 0.9, 0), b = new THREE.Vector3(cx - 0.105, 0.03, 0);
    thread.position.copy(a).add(b).multiplyScalar(0.5);
    thread.scale.set(1, a.distanceTo(b), 1);
    thread.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const bk = s.beaker;
    beaker.visible = bk.on > 0.001;
    beaker.position.set(bk.x, bk.y, bk.z);
    beaker.rotation.set(0, 0, bk.tilt);
    const f = Math.max(0.002, bk.fill * 0.1);
    waterIn.scale.set(1, f, 1); waterIn.position.y = f / 2 + 0.001;
    return { lip: beaker.localToWorld(new THREE.Vector3(-0.04, 0.11, 0)) };
  }
  return { group: g, set, U, sled, beaker, sand };
}

const HEIGHT_NOISE = `
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
`;
