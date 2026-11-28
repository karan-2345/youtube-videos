// scenes/3d/lib/desert.js -- the Giza plateau at golden hour: the sky, the dunes, a packed haulage road along +x
// toward the Great Pyramid (under construction), and the sand shader: wind ripples, sparkle, and wet tracks where a
// sled's water-pourer has wetted the sand (dark just in front of the sled, drying out behind it).
//
// World: the road runs along +x at z = 0 (y = 0); the pyramid's centre at PYR = (PX, 0, 0).
import * as THREE from 'three';
import { NOISE, fbm, patch, mulberry } from './common.js';

export const PYR = { x: 620, z: -40, base: 230, height: 146.6, built: 0.62 };
export const ROADS = [[-0.0], [42]];        // z of the roads (the main one and a second one)

/** Ground height: flat along the roads and the work areas, dunes away from them. */
export function groundH(x, z) {
  let flat = 1;
  for (const [zr] of ROADS) flat = Math.min(flat, Math.abs(z - zr) / 18);
  const dPyr = Math.hypot(x - PYR.x, z - PYR.z);
  flat = Math.min(flat, Math.max(0, (dPyr - PYR.base * 0.75) / 90));
  // the colossus site (far off at x = -2000) is a flat plain
  const dC = Math.hypot(x + 2000, z);
  flat = Math.min(flat, Math.max(0, (dC - 60) / 80));
  const k = Math.min(1, flat) ** 1.5;
  const dunes = 7 * Math.max(0, fbm(x * 0.006, z * 0.009) - 0.3) * 2.2 + 1.5 * fbm(x * 0.03 + 3, z * 0.03);
  const swell = 0.35 * fbm(x * 0.02, z * 0.02 + 9);
  return k * dunes + swell - 0.2;
}

export function buildSky(P) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(P.sky_top) }, mid: { value: new THREE.Color(P.sky_mid) }, low: { value: new THREE.Color(P.sky_low) },
      sunDir: { value: new THREE.Vector3(0, 0.2, 1).normalize() }, sunCol: { value: new THREE.Color(P.sun) }, uTime: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 top, mid, low, sunCol, sunDir; uniform float uTime; varying vec3 vD;
      ${NOISE}
      void main(){
        vec3 d = normalize(vD);
        float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.22, h));
        c = mix(c, top, smoothstep(0.2, 0.8, h));
        c = mix(c, low * 0.9, smoothstep(0.0, -0.3, h));
        float s = max(dot(d, normalize(sunDir)), 0.);
        c += sunCol * (pow(s, 5.0) * 0.45 + pow(s, 90.0) * 1.2 + pow(s, 900.0) * 30.0);
        // a dusty haze band on the horizon, thin high cirrus
        c = mix(c, low * 1.05, exp(-abs(h) * 28.0) * 0.55);
        vec2 uv = d.xz / (abs(d.y) + 0.25) * 1.2 + vec2(uTime * 0.004, 0.);
        float cl = smoothstep(0.55, 0.9, fbm(uv * vec2(0.7, 2.6))) * smoothstep(0.05, 0.25, h) * (1. - smoothstep(0.4, 0.8, h));
        c = mix(c, mix(vec3(1.0, 0.9, 0.8), sunCol, 0.5), cl * 0.35);
        gl_FragColor = vec4(c, 1.);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), m);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}

/** Sand: lit colour with ripples, darker troughs, sparkle; wet tracks (uTracks: x = front of the wet patch, y = z
 *  centre, z = half width, w = strength) dark just in front of each sled and drying behind it. */
export function sandMaterial(P, shared) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  return patch(m, {
    uniforms: Object.assign(shared, {
      cSand: { value: new THREE.Color(P.sand) }, cDark: { value: new THREE.Color(P.sand_dark) }, cWet: { value: new THREE.Color(P.sand_wet) },
    }),
    vHead: 'varying vec3 vW;',
    vert: { '#include <worldpos_vertex>': '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.)).xyz;' },
    fHead: `varying vec3 vW; uniform vec3 cSand, cDark, cWet; uniform vec4 uTracks[4]; uniform float uRoad;
      float wetAt(vec2 p){
        float w = 0.;
        for (int i = 0; i < 4; i++){
          vec4 T = uTracks[i];
          if (T.w <= 0.) continue;
          float dz = abs(p.y - T.y), d = T.x - p.x;              // d > 0: behind the front of the wet patch
          float across = 1. - smoothstep(T.z * 0.75, T.z * 1.1 + 0.15, dz);
          float edge = (vnoise(p * 3.1) - .5) * 0.35;
          float ahead = smoothstep(-0.95 + edge, -0.55 + edge, d) ;  // the fresh patch, ~0.8 m in front of the front
          float dry = exp(-max(d, 0.) / 22.);                    // drying behind the sled
          float runner = 1. - smoothstep(0.12, 0.3, abs(dz - T.z * 0.55));
          w = max(w, T.w * across * (d < 0. ? ahead : mix(0.45 * dry + 0.5 * runner * dry, 1., exp(-d / 1.4))));
        }
        return clamp(w, 0., 1.);
      }`,
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        vec2 p = vW.xz;
        float n = fbm(p * 0.07), n2 = vnoise(p * 1.7), n3 = vnoise(p * 9.0);
        // wind ripples: a long wave across the wind (x), bent by noise
        float rip = sin(dot(p, vec2(0.35, 2.4)) * 4.2 + n * 9.0);
        vec3 c = mix(cDark, cSand, 0.55 + 0.35 * n + 0.08 * rip);
        c *= 0.94 + 0.08 * n3;
        // the packed road: a bit paler and smoother, with old drag marks
        float road = 0.;
        for (int i = 0; i < 2; i++){ float zr = i == 0 ? 0. : 42.; road = max(road, 1. - smoothstep(3.0, 5.5, abs(p.y - zr))); }
        road *= uRoad;
        float drag = 0.5 + 0.5 * sin(p.y * 7.0 + vnoise(vec2(p.x * 0.05, p.y)) * 3.);
        c = mix(c, c * (1.04 - 0.07 * drag), road * 0.8);
        float wet = wetAt(p);
        c = mix(c, cWet * (0.9 + 0.15 * n2), wet);
        diffuseColor.rgb *= c;
        float vWet = wet;`,
      '#include <roughnessmap_fragment>': '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.93, 0.42, vWet);',
      '#include <normal_fragment_maps>': `#include <normal_fragment_maps>
        { vec2 q = vW.xz; float a = dot(q, vec2(0.35, 2.4)) * 4.2 + fbm(q * 0.07) * 9.0;
          float s = cos(a) * 0.12 * (1. - vWet * 0.8);
          vec3 tb = normalize(vec3(0.35, 0., 2.4));
          vec3 vt = normalize((viewMatrix * vec4(tb, 0.)).xyz);
          normal = normalize(normal - vt * s); }`,
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        { float sp = step(0.995, vnoise(vW.xz * 41.0)) * step(0.5, vnoise(vW.xz * 7.3 + 3.));
          totalEmissiveRadiance += vec3(1.0, 0.92, 0.8) * sp * 0.25 * (1. - vWet); }`,
    },
  });
}

export function buildTerrain(P, shared) {
  const mat = sandMaterial(P, shared);
  const group = new THREE.Group();
  // near patch (fine), the far plain (coarse, a little lower so it never fights the near patch)
  const mk = (size, segs, cx, cz, drop) => {
    const g = new THREE.PlaneGeometry(size, size, segs, segs); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)) - drop);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true;
    return m;
  };
  group.add(mk(260, 260, 40, 0, 0));
  group.add(mk(5200, 260, 600, 0, 0.25));
  group.add(mk(260, 200, -2000, 0, 0));
  return { group, mat };
}

/** The Great Pyramid, about two-thirds built: a stepped core of rough courses with the smooth white casing laid on
 *  the lower part, a flat working platform on top with blocks waiting. */
export function buildPyramid(P) {
  const H = PYR.height * PYR.built, B = PYR.base, b = B * (1 - PYR.built);
  const g = new THREE.BufferGeometry();
  const v = [], n = [], uv = [];
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (let s = 0; s < 4; s++) {
    const [ax, az] = corners[s], [bx, bz] = corners[(s + 1) % 4];
    const p0 = [ax * B / 2, 0, az * B / 2], p1 = [bx * B / 2, 0, bz * B / 2], p2 = [bx * b / 2, H, bz * b / 2], p3 = [ax * b / 2, H, az * b / 2];
    const e1 = new THREE.Vector3().subVectors(new THREE.Vector3(...p1), new THREE.Vector3(...p0));
    const e2 = new THREE.Vector3().subVectors(new THREE.Vector3(...p3), new THREE.Vector3(...p0));
    const nn = new THREE.Vector3().crossVectors(e1, e2).normalize();
    for (const [p, u] of [[p0, [0, 0]], [p1, [1, 0]], [p2, [1, 1]], [p0, [0, 0]], [p2, [1, 1]], [p3, [0, 1]]]) {
      v.push(...p); n.push(nn.x, nn.y, nn.z); uv.push(u[0], u[1]);
    }
  }
  // the top platform
  for (const p of [[b / 2, H, b / 2], [b / 2, H, -b / 2], [-b / 2, H, -b / 2], [b / 2, H, b / 2], [-b / 2, H, -b / 2], [-b / 2, H, b / 2]]) { v.push(...p); n.push(0, 1, 0); uv.push(0, 0); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
  patch(mat, {
    uniforms: { cCore: { value: new THREE.Color(P.limestone) }, cCase: { value: new THREE.Color(P.casing) } },
    vHead: 'varying vec3 vL;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' },
    fHead: 'varying vec3 vL; uniform vec3 cCore, cCase;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      float y = vL.y, course = 1.15, row = floor(y / course);
      float s = abs(vL.x) > abs(vL.z) ? vL.z : vL.x;
      float sx = s / 1.6 + 0.5 * mod(row, 2.);
      vec2 cell = vec2(floor(sx), row);
      float fy = fract(y / course), fx = fract(sx);
      float jy = 1. - smoothstep(0.0, 0.09 + fwidth(y / course) * 1.5, min(fy, 1. - fy));
      float jx = 1. - smoothstep(0.0, 0.05 + fwidth(sx) * 1.5, min(fx, 1. - fx));
      float joint = max(jy, jx * 0.8);
      float caseH = 22.0 + (vnoise(vec2(s * 0.08, 1.)) - .5) * 4.0;
      float isCase = vL.y < 140.0 ? smoothstep(caseH + 0.6, caseH - 0.6, y) : 0.;
      vec3 core = cCore * (0.82 + 0.22 * h21(cell)) * (1. - 0.35 * joint) * (0.9 + 0.1 * vnoise(vL.xz * 0.3 + y));
      vec3 cas = cCase * (0.95 + 0.05 * vnoise(vec2(s, y) * 0.5)) * (1. - 0.06 * jy);
      vec3 c = mix(core, cas, isCase);
      if (vL.y > ${(H - 0.01).toFixed(2)}) c = cCore * 0.9 * (0.85 + 0.15 * vnoise(vL.xz * 0.4));
      diffuseColor.rgb *= c;
      float vCase = isCase;`,
      '#include <roughnessmap_fragment>': '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.9, 0.45, vCase);' },
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const grp = new THREE.Group(); grp.add(mesh);
  // blocks waiting on the platform
  const rnd = mulberry(77);
  const bg = new THREE.BoxGeometry(1.3, 0.9, 0.9);
  const bm = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.limestone), roughness: 0.9 });
  const blocks = new THREE.InstancedMesh(bg, bm, 90);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    const x = (rnd() - 0.5) * (b - 6), z = (rnd() - 0.5) * (b - 6);
    m4.makeRotationY(rnd() < 0.5 ? 0 : Math.PI / 2).setPosition(x, H + 0.45 + (rnd() < 0.2 ? 0.9 : 0), z);
    blocks.setMatrixAt(i, m4);
  }
  blocks.castShadow = true;
  grp.add(blocks);
  grp.position.set(PYR.x, -0.4, PYR.z);
  grp.rotation.y = 0.12;
  return { group: grp, height: H };
}

/** Warm dust in the air, lit by the sun (camera-local: a box of motes that follows the camera). */
export function buildMotes(n = 700, seed = 3) {
  const rnd = mulberry(seed);
  const pos = new Float32Array(n * 3), ph = new Float32Array(n), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = rnd(); pos[i * 3 + 1] = rnd(); pos[i * 3 + 2] = rnd(); ph[i] = rnd() * 6.28; sz[i] = 0.4 + rnd(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('aSz', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uBox: { value: 24 }, uScale: { value: 1000 }, uOp: { value: 1 }, uCol: { value: new THREE.Color('#FFE2B0') } },
    vertexShader: `attribute float aPh, aSz; uniform float uT, uBox, uScale, uOp; uniform vec3 uC; varying float vA;
      void main(){
        vec3 drift = vec3(uT * 0.35, sin(uT * 0.3 + aPh) * 0.2, uT * 0.12);
        vec3 p = mod(position * uBox + drift - uC + uBox * 0.5, uBox) + uC - uBox * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float d = -mv.z;
        gl_PointSize = clamp(uScale * 0.012 * aSz / d, 0.0, 40.0);
        vA = uOp * smoothstep(0.5, 2.0, d) * (1. - smoothstep(uBox * 0.3, uBox * 0.5, d)) * (0.5 + 0.5 * sin(uT * 1.3 + aPh * 3.));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA;
      void main(){ vec2 q = gl_PointCoord - .5; float r = dot(q, q); if (r > .25) discard; gl_FragColor = vec4(uCol * 2.0 * vA * (1. - r * 4.), 0.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  return pts;
}
