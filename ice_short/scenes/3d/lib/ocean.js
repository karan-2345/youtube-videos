// scenes/3d/lib/ocean.js -- the sky and the sea.
//   buildSky(cfg)      a gradient dome with a sun, a haze band and soft cumulus (the same function shades the sea's
//                      reflections, so they match).
//   buildOcean(cfg)    a camera-following grid displaced by a sum of Gerstner waves (vertex shader), with detail
//                      ripples, Fresnel sky reflection, a sun glitter path, subsurface colour on the crests, crest
//                      foam, a ship's wake and bow wave, and shallow water / shore foam from a land height texture.
//   waveAt(x, z, t)    the same waves in JS: height and slope, so a ship can ride them.
// Every set (Martinique, the open Atlantic, the Hooghly at Calcutta) is a config of the same two materials.
import * as THREE from 'three';
import { NOISE } from './common.js';

// direction (deg), wavelength (m), amplitude (m), steepness
const WAVES = [
  [12, 38, 0.42, 0.55], [-25, 23, 0.26, 0.6], [48, 14, 0.14, 0.6], [-62, 9.5, 0.08, 0.55],
  [85, 6.2, 0.05, 0.5], [-8, 4.1, 0.03, 0.45],
];
const G = 9.81;
export const WAVE_DATA = WAVES.map(([deg, L, A, Q]) => {
  const k = 2 * Math.PI / L, w = Math.sqrt(G * k);
  const d = [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
  return { d, k, w, A, Q: Q / (k * A * WAVES.length) };
});

/** JS mirror of the vertex shader: height (y) and the surface normal at (x, z), time t, amplitude scale amp. */
export function waveAt(x, z, t, amp = 1) {
  let y = 0, nx = 0, nz = 0;
  for (const W of WAVE_DATA) {
    const f = W.k * (W.d[0] * x + W.d[1] * z) - W.w * t;
    const A = W.A * amp;
    y += A * Math.sin(f);
    const c = W.k * A * Math.cos(f);
    nx -= W.d[0] * c; nz -= W.d[1] * c;
  }
  const n = new THREE.Vector3(nx, 1, nz).normalize();
  return { y, n };
}

const SKY_FN = `
  uniform vec3 uTop, uMid, uLow, uSunCol, uSunDir, uHaze;
  uniform float uCloud, uTime, uSunSize;
  vec3 skyCol(vec3 d){
    float h = d.y;
    vec3 c = mix(uLow, uMid, smoothstep(-0.02, 0.18, h));
    c = mix(c, uTop, smoothstep(0.15, 0.75, h));
    c = mix(c, uLow * 0.85, smoothstep(0.0, -0.25, h));
    float s = max(dot(d, normalize(uSunDir)), 0.);
    c += uSunCol * (pow(s, 6.0) * 0.35 + pow(s, 120.0) * 0.9 + smoothstep(1. - 0.00012 * uSunSize, 1. - 0.00005 * uSunSize, s) * 40.0);
    c = mix(c, uHaze, exp(-abs(h) * 22.0) * 0.6);
    // cumulus: soft lumps above the horizon, lit on the sun side
    vec2 uv = d.xz / (max(h, 0.0) + 0.12) * 0.9 + vec2(uTime * 0.006, 0.);
    float n = fbm(uv * 1.3) * 0.75 + fbm(uv * 3.7 + 4.0) * 0.25;
    float cl = smoothstep(0.52, 0.78, n) * smoothstep(0.015, 0.09, h) * (1. - smoothstep(0.35, 0.7, h)) * uCloud;
    float lit = 0.6 + 0.4 * smoothstep(0.4, 0.95, s) + 0.25 * (n - 0.5);
    c = mix(c, mix(uMid * 1.05, vec3(1.0, 0.97, 0.92), 0.65) * lit + uSunCol * pow(s, 8.) * 0.4, cl * 0.85);
    return c;
  }`;

export function skyUniforms(cfg) {
  const C = (h) => new THREE.Color(h);
  return {
    uTop: { value: C(cfg.top) }, uMid: { value: C(cfg.mid) }, uLow: { value: C(cfg.low) }, uHaze: { value: C(cfg.haze ?? cfg.low) },
    uSunCol: { value: C(cfg.sun) }, uSunDir: { value: cfg.sunDir.clone() }, uCloud: { value: cfg.cloud ?? 1 }, uTime: { value: 0 },
    uSunSize: { value: cfg.sunSize ?? 1 },
  };
}

export function buildSky(cfg) {
  const m = new THREE.ShaderMaterial({
    uniforms: skyUniforms(cfg),
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }',
    fragmentShader: `${NOISE}\n${SKY_FN}\n varying vec3 vD; void main(){ gl_FragColor = vec4(skyCol(normalize(vD)), 1.); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 24), m);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); mesh.modelViewMatrix.multiplyMatrices(cam.matrixWorldInverse, mesh.matrixWorld); };
  return mesh;
}

/** cfg: sky colours + { deep, shallow, foam, amp, land: {tex, x0, z0, size} | null, wake: true } */
export function buildOcean(cfg) {
  const SEG = 360, R = 3200;
  const g = new THREE.PlaneGeometry(2, 2, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  // concentrate vertices near the centre: u -> sign(u) |u|^2.4 R
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setXYZ(i, Math.sign(x) * Math.abs(x) ** 2.4 * R, 0, Math.sign(z) * Math.abs(z) ** 2.4 * R);
  }
  const wd = WAVE_DATA;
  const waveGLSL = wd.map((W, i) => `
      { float f = ${W.k.toFixed(6)} * dot(vec2(${W.d[0].toFixed(6)}, ${W.d[1].toFixed(6)}), xz) - ${W.w.toFixed(6)} * uT;
        float A = ${W.A.toFixed(5)} * amp; float Qa = ${W.Q.toFixed(6)} * ${W.k.toFixed(6)} * A;
        P.x += Qa / ${W.k.toFixed(6)} * ${W.d[0].toFixed(6)} * cos(f);
        P.z += Qa / ${W.k.toFixed(6)} * ${W.d[1].toFixed(6)} * cos(f);
        P.y += A * sin(f);
        float c = ${W.k.toFixed(6)} * A * cos(f), s = ${W.k.toFixed(6)} * A * sin(f);
        N.x -= ${W.d[0].toFixed(6)} * c; N.z -= ${W.d[1].toFixed(6)} * c;
        J -= ${(W.Q * W.k).toFixed(6)} * A * sin(f); }`).join('');
  const C = (h) => new THREE.Color(h);
  const land = cfg.land || null;
  const uniforms = Object.assign(skyUniforms(cfg), {
    uT: { value: 0 }, uAmp: { value: cfg.amp ?? 1 }, uCam: { value: new THREE.Vector3() },
    uDeep: { value: C(cfg.deep) }, uShallow: { value: C(cfg.shallow) }, uFoam: { value: C(cfg.foam ?? '#F4FBFF') },
    uShip: { value: new THREE.Vector4(0, 0, 1, 0) },          // x, z, heading (rad), speed (m/s; 0 = no wake)
    uShip2: { value: new THREE.Vector4(0, 0, 1, -1) },        // a second (moored) hull: w < 0 = none
    uShipLen: { value: 26 }, uShipBeam: { value: 7.2 },
    uLand: { value: land ? land.tex : null }, uLandBox: { value: land ? new THREE.Vector4(land.x0, land.z0, land.size, 1) : new THREE.Vector4(0, 0, 1, 0) },
    uCalm: { value: new THREE.Vector4(0, 0, 0, 0) },          // x, z, radius, strength: a sheltered harbour
    uFogCol: { value: C(cfg.haze ?? cfg.low) }, uFogDist: { value: cfg.fogDist ?? 2600 },
    uMurk: { value: cfg.murk ?? 0 },
  });
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `uniform float uT, uAmp; uniform vec3 uCam; uniform vec4 uCalm, uLandBox; uniform sampler2D uLand;
      varying vec3 vW; varying vec3 vN; varying float vJ; varying float vDepth;
      void main(){
        vec3 P0 = position + vec3(floor(uCam.x / 4.0) * 4.0, 0., floor(uCam.z / 4.0) * 4.0);
        vec2 xz = P0.xz;
        float amp = uAmp;
        if (uCalm.w > 0.) amp *= mix(1., 0.25, uCalm.w * (1. - smoothstep(uCalm.z * 0.6, uCalm.z, length(xz - uCalm.xy))));
        float depth = 50.;
        if (uLandBox.w > 0.) {
          vec2 luv = (xz - uLandBox.xy) / uLandBox.z + 0.5;
          if (all(greaterThan(luv, vec2(0.))) && all(lessThan(luv, vec2(1.)))) depth = (0.5 - texture2D(uLand, luv).r) * 120.;
          amp *= smoothstep(-0.5, 6.0, depth) * 0.85 + 0.15;
        }
        vDepth = depth;
        vec3 P = P0; vec3 N = vec3(0., 1., 0.); float J = 1.;
        ${waveGLSL}
        vW = (modelMatrix * vec4(P, 1.)).xyz; vN = normalize(N); vJ = J;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.);
      }`,
    fragmentShader: `${NOISE}\n${SKY_FN}
      uniform vec3 uDeep, uShallow, uFoam, uFogCol; uniform vec4 uShip, uShip2; uniform float uShipLen, uShipBeam, uT, uFogDist, uMurk;
      varying vec3 vW; varying vec3 vN; varying float vJ; varying float vDepth;
      // ripples: the gradient of two scrolling noise layers
      vec2 ripple(vec2 p){
        float e = 0.08;
        vec2 a = p * 0.9 + vec2(uT * 0.35, uT * 0.12), b = p * 2.3 - vec2(uT * 0.22, -uT * 0.31);
        float h0 = fbm(a) + 0.5 * fbm(b);
        float hx = fbm(a + vec2(e, 0.)) + 0.5 * fbm(b + vec2(e, 0.));
        float hz = fbm(a + vec2(0., e)) + 0.5 * fbm(b + vec2(0., e));
        return vec2(hx - h0, hz - h0) / e;
      }
      // ship-local coordinates: s = along the hull (forward +), q = across
      vec2 shipLocal(vec4 S, vec2 p){ vec2 d = vec2(cos(S.z), -sin(S.z)); vec2 r = p - S.xy; return vec2(dot(r, d), dot(r, vec2(-d.y, d.x))); }
      float hullFoam(vec4 S, vec2 p, out float wake){
        wake = 0.;
        if (S.w < 0.) return 0.;
        vec2 l = shipLocal(S, p);
        float hl = uShipLen * 0.5, hb = uShipBeam * 0.5;
        float e = (l.x / hl) * (l.x / hl) + (l.y / hb) * (l.y / hb);   // the hull's waterline ellipse
        float ring = smoothstep(1.18, 1.0, e) * smoothstep(0.85, 1.0, e);
        float spd = clamp(S.w / 3.0, 0., 1.);
        // the Kelvin wedge behind the stern (~19.5 deg half angle) and the turbulent strip right behind
        float back = -l.x - hl * 0.8;
        if (back > 0.) {
          float hw = back * 0.35 + hb;
          float eq = (abs(l.y) - hw) / (0.8 + back * 0.05); float edge = exp(-eq * eq) * exp(-back / 90.);
          float sq = l.y / (hb * 0.9 + back * 0.04); float strip = exp(-sq * sq) * exp(-back / 45.);
          wake = (edge * 0.8 + strip) * spd;
        }
        float bow = smoothstep(hl * 0.2, hl * 1.05, l.x) * smoothstep(1.6, 1.0, e) * (0.6 + spd);
        return ring * (0.25 + 0.35 * spd) + bow * 0.35;
      }
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        float dist = length(cameraPosition - vW);
        vec2 r = ripple(vW.xz * 0.35) * 0.32 * smoothstep(900., 60., dist);
        vec3 N = normalize(vN + vec3(r.x, 0., r.y));
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        float F = 0.02 + 0.98 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 refl = skyCol(normalize(R));
        // body colour: deep by default, lighter where the crest is thin and faces the sun, turquoise in the shallows
        vec3 L = normalize(uSunDir);
        float sss = pow(max(dot(V, -L), 0.), 3.) * max(vW.y + 0.3, 0.) * 0.8 + max(vW.y, 0.) * 0.35;
        float shallow = 1. - smoothstep(0.5, 9.0, vDepth);
        vec3 body = mix(uDeep, uShallow, clamp(sss * 0.6 + shallow * 0.85, 0., 1.));
        body *= 0.55 + 0.45 * max(dot(N, L), 0.) ;
        body = mix(body, uShallow * 0.6 + vec3(0.12, 0.09, 0.05), uMurk * 0.5);
        vec3 col = mix(body, refl, F);
        // the sun's glitter path
        float spec = pow(max(dot(R, L), 0.), 700.) * 60. + pow(max(dot(R, L), 0.), 90.) * 1.2;
        col += uSunCol * spec * (1. - 0.6 * smoothstep(500., 2000., dist));
        // foam: steep crests, the ship, the shore
        float wake1, wake2;
        float hf = hullFoam(uShip, vW.xz, wake1) + hullFoam(uShip2, vW.xz, wake2);
        float n1 = fbm(vW.xz * 0.45 + vec2(uT * 0.2, 0.)), n2 = vnoise(vW.xz * 2.2 - uT * 0.3);
        float crest = smoothstep(0.62, 0.2, vJ) * smoothstep(0.35, 0.65, n1);
        float shore = shallow * smoothstep(1.6, 0.0, vDepth) * (0.6 + 0.4 * sin(vDepth * 3.0 - uT * 1.6));
        float foam = clamp(crest * 0.7 + (hf + wake1 + wake2) * (0.45 + 0.55 * n2) + shore * smoothstep(0.3, 0.7, n2 + 0.2), 0., 1.);
        foam *= smoothstep(0.25, 0.55, n2 * 0.7 + n1 * 0.6);
        vec3 fcol = uFoam * (0.55 + 0.45 * max(dot(N, L), 0.)) * (0.9 + 0.25 * uSunCol);
        col = mix(col, fcol, foam * 0.9);
        // distance haze
        col = mix(col, uFogCol, smoothstep(uFogDist * 0.25, uFogDist, dist) * 0.9);
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.onBeforeRender = (r, s, cam) => { m.uniforms.uCam.value.copy(cam.position); };
  return mesh;
}
