// scenes/3d/lib/medium.js -- the cut-open lagoon: a glass-fronted "tank" of canal water over lagoon mud, which you see
// into like an aquarium. Everything under the water line is shaded through the same analytic medium: the ray from the
// camera to a fragment enters the tank's box, runs through water (green, clear-ish) and mud (grey-brown, thick), and
// picks up each medium's colour on the way (Beer-Lambert, in the order the ray meets them).
//
// World: water surface y = 0, mud top (the canal bed) y = MUD_TOP, tank bottom y = BOTTOM; the tank spans
// x in [-TX, TX], z in [-TZ, 0]; the cut (the glass) is the plane z = 0, the camera looks from +z.
import * as THREE from 'three';
import { NOISE } from './common.js';

export const TANK = { TX: 30, TZ: 42, MUD_TOP: -3.0, BOTTOM: -16.0 };

export const MED = {
  uTankMin: { value: new THREE.Vector3(-TANK.TX, TANK.BOTTOM, -TANK.TZ) },
  uTankMax: { value: new THREE.Vector3(TANK.TX, 0, 0) },
  uMudTop: { value: TANK.MUD_TOP },
  uWaterK: { value: 0.085 }, uMudK: { value: 0.072 },
  uWaterCol: { value: new THREE.Color('#3E7A6C') }, uWaterDeep: { value: new THREE.Color('#1D4A44') },
  uMudCol: { value: new THREE.Color('#6A5E49') }, uMudDeep: { value: new THREE.Color('#2A241C') },
  uMedOn: { value: 1 }, uMedT: { value: 0 }, uMedLight: { value: 1 },
  uO2: { value: 0 },            // the oxygen beat: the water reads a little brighter, the mud a little darker
};

export const MEDIUM_GLSL = `
  uniform vec3 uTankMin, uTankMax, uWaterCol, uWaterDeep, uMudCol, uMudDeep;
  uniform float uMudTop, uWaterK, uMudK, uMedOn, uMedT, uMedLight, uO2;
  vec3 waterC(float y){ return mix(uWaterCol, uWaterDeep, clamp(-y / 4.0, 0., 1.)) * uMedLight; }
  vec3 mudC(float y){ return mix(uMudCol, uMudDeep, clamp((uMudTop - y) / 11.0, 0., 1.)) * uMedLight * (1. - 0.25 * uO2); }
  vec3 applyMedium(vec3 col, vec3 P){
    if (uMedOn < 0.5 || P.y > uTankMax.y + 0.002 || P.z > 0.02 || P.y < uTankMin.y - 0.02) return col;
    col *= exp(-max(-P.y, 0.) * 0.045);           // less light reaches deeper down
    vec3 C = cameraPosition, d = P - C;
    vec3 sd = vec3(d.x >= 0. ? 1. : -1., d.y >= 0. ? 1. : -1., d.z >= 0. ? 1. : -1.);
    vec3 inv = 1.0 / (d + sd * 1e-5);
    vec3 t0 = (uTankMin - C) * inv, t1 = (uTankMax - C) * inv;
    vec3 tn = min(t0, t1);
    float te = clamp(max(max(tn.x, tn.y), tn.z), 0., 1.);
    vec3 E = C + d * te;
    float L = length(P - E);
    float yE = E.y, yP = P.y, fm;
    if (yE <= uMudTop && yP <= uMudTop) fm = 1.;
    else if (yE > uMudTop && yP > uMudTop) fm = 0.;
    else { float s = (uMudTop - yE) / (yP - yE); fm = yE < uMudTop ? s : 1. - s; }
    float Lm = L * fm, Lw = L - Lm;
    float Tw = exp(-uWaterK * Lw), Tm = exp(-uMudK * Lm);
    float yMid = 0.5 * (yE + yP);
    vec3 wc = waterC(min(yMid, 0.) * (1. - fm) + uMudTop * fm * 0.6);
    vec3 mc = mudC(min(yMid, uMudTop));
    // fine drifting silt in the mud: a little texture so the medium reads as a material, not as fog
    float silt = 0.85 + 0.3 * vnoise(P.xy * 1.7 + vec2(uMedT * 0.05, 0.)) * fm;
    mc *= silt;
    if (yE > uMudTop) return col * Tw * Tm + mc * (1. - Tm) * Tw + wc * (1. - Tw);
    return col * Tm * Tw + wc * (1. - Tw) * Tm + mc * (1. - Tm);
  }`;

/** Patch a material so its result goes through the medium (call after any other onBeforeCompile patch is set). */
export function withMedium(mat, extra = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, MED, extra);
    if (!sh.vertexShader.includes('vMedW')) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMedW;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          { vec4 mw = vec4(transformed, 1.);
            #ifdef USE_INSTANCING
              mw = instanceMatrix * mw;
            #endif
            vMedW = (modelMatrix * mw).xyz; }`);
    }
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `varying vec3 vMedW;\n${sh.fragmentShader.includes('float vnoise(') ? '' : NOISE}\n${MEDIUM_GLSL}\nvoid main() {`)
      .replace('#include <dithering_fragment>', 'gl_FragColor.rgb = applyMedium(gl_FragColor.rgb, vMedW);\n#include <dithering_fragment>');
  };
  const key = (mat.customProgramCacheKey ? mat.customProgramCacheKey() : '') + '+med';
  mat.customProgramCacheKey = () => key;
  return mat;
}

// caustics: two layers of warped cells, bright where they meet
export const CAUSTIC_GLSL = `
  float caustic(vec2 p, float t){
    vec2 q = mod(p * 6.2831853 * 0.25, 6.2831853) - 250.0;
    vec2 i = q; float c = 1.0; float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * 0.5 * (1.0 - (3.5 / float(n + 1)));
      i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / inten), q.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0; c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0., 2.);
  }`;

/** The glass front (z = 0) and the side glass: a thin highlight, fine scratches, a faint sediment drawing in the mud
 *  band so the mud reads as mud, and a bright meniscus line at the water surface. */
export function buildGlass(P) {
  const { TX, TZ, MUD_TOP, BOTTOM } = TANK;
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uAlpha: { value: 1 }, uMarsh: { value: 0 } }, MED),
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${NOISE}
      uniform float uAlpha, uMudTop, uMedT; varying vec3 vW;
      void main(){
        float u = abs(vW.z) < 0.01 ? vW.x : vW.z;
        float y = vW.y;
        float a = 0.0; vec3 c = vec3(0.);
        // mud band: strata, darker lenses, pale shell flecks (low alpha, so the posts show through)
        if (y < uMudTop) {
          float n = fbm(vec2(u * 0.12, y * 0.9));
          float strata = 0.5 + 0.5 * sin(y * 5.0 + n * 7.0);
          float fleck = smoothstep(0.93, 0.97, vnoise(vec2(u, y) * 6.0));
          c = mix(vec3(0.28, 0.25, 0.2), vec3(0.42, 0.38, 0.3), strata);
          a = 0.035 + 0.03 * strata + 0.06 * smoothstep(0.6, 0.85, n);
          c = mix(c, vec3(0.6, 0.57, 0.5), fleck * 0.3); a += fleck * 0.02;
          // the canal bed line
          float bed = 1. - smoothstep(0.0, 0.12, abs(y - uMudTop - 0.03 * sin(u * 0.7)));
          c = mix(c, vec3(0.2, 0.18, 0.14), bed); a = max(a, bed * 0.55);
        }
        // meniscus: a bright line at the water surface, and a faint sheen on the glass
        float men = 1. - smoothstep(0.0, 0.06, abs(y + 0.02));
        c += vec3(0.9, 0.95, 1.0) * men * 1.6; a = max(a, men * 0.8);
        float sheen = 0.035 * smoothstep(0.6, 1.0, vnoise(vec2(u * 0.05 + y * 0.08, y * 0.02)));
        c += vec3(0.8, 0.9, 1.0) * sheen; a += sheen;
        // the glass edges (the block's corners): a thin bright frame
        float ed = abs(vW.z) < 0.01 ? abs(abs(vW.x) - ${TX.toFixed(1)}) : min(abs(vW.z), abs(vW.z + ${TZ.toFixed(1)}));
        float edge = 1. - smoothstep(0.0, 0.08, min(abs(y - ${BOTTOM.toFixed(1)}), ed));
        c += vec3(0.75, 0.82, 0.88) * edge; a = max(a, edge * 0.7);
        gl_FragColor = vec4(c, a * uAlpha);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const g = new THREE.Group();
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2 * TX, -BOTTOM), mat);
  front.position.set(0, BOTTOM / 2, 0);
  g.add(front);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(TZ, -BOTTOM), mat);
    side.rotation.y = Math.PI / 2; side.position.set(s * TX, BOTTOM / 2, -TZ / 2);
    g.add(side);
  }
  g.renderOrder = 5;
  for (const m of g.children) m.renderOrder = 5;
  return { group: g, mat };
}

/** The inside of the tank: back wall, side walls and floor, painted as mud / water (the medium does the rest). */
export function buildTankWalls() {
  const { TX, TZ, MUD_TOP, BOTTOM } = TANK;
  const mat = withMedium(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2 * TX, -BOTTOM), mat); back.position.set(0, BOTTOM / 2, -TZ);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * TX, TZ), mat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, BOTTOM, -TZ / 2);
  g.add(back, floor);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(TZ, -BOTTOM), mat);
    w.rotation.y = -s * Math.PI / 2; w.position.set(s * TX, BOTTOM / 2, -TZ / 2);
    g.add(w);
  }
  // the block's outside: dark plinth faces under the tank and the outer sides of the back wall
  const plinthMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2A2620'), roughness: 0.9 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2 * TX + 0.6, 1.2, TZ + 0.6), plinthMat);
  plinth.position.set(0, BOTTOM - 0.65, -TZ / 2);
  g.add(plinth);
  return g;
}

/** The canal bed / the lagoon floor: a height field. uMarsh = 1 raises the salt-marsh islands of the early lagoon. */
export function buildBed(P, islands) {
  const { TX, TZ, MUD_TOP } = TANK;
  const g = new THREE.PlaneGeometry(2 * TX, TZ, 240, 168);
  g.rotateX(-Math.PI / 2); g.translate(0, MUD_TOP, -TZ / 2);
  const isl = islands.map((i) => new THREE.Vector4(i[0], i[1], i[2], i[3]));
  while (isl.length < 8) isl.push(new THREE.Vector4(0, 0, 0.001, 0));
  const uni = {
    uMarsh: { value: 0 }, uFirm: { value: 0 }, uIsl: { value: isl }, uSink: { value: 0 },
    cMud: { value: new THREE.Color('#5B5040') }, cMudWet: { value: new THREE.Color('#3D3A30') }, cGrass: { value: new THREE.Color('#6E7A3E') },
    cGrass2: { value: new THREE.Color('#9A9150') }, uFoot: { value: new THREE.Vector4(0, -19, 12.6, 0) },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni, MED);
    const HEIGHT = `
      uniform float uMarsh, uSink; uniform vec4 uIsl[8];
      float marshH(vec2 p){
        float h = 0.;
        for (int i = 0; i < 8; i++) {
          vec4 I = uIsl[i];
          vec2 q = (p - I.xy) / I.z;
          float wob = 0.22 * (fbm(p * 0.13 + float(i) * 7.1) - 0.5) * 2.0;
          float r = length(q) + wob;
          h = max(h, I.w * (1. - smoothstep(0.55, 1.0, r)));
        }
        return h;
      }`;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${NOISE}\n${HEIGHT}\nvarying vec3 vW; varying float vH;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 pp = position.xz;
        float mh = marshH(pp) * uMarsh;
        float ripple = 0.06 * sin(pp.x * 1.3 + 2.0 * vnoise(pp * 0.4)) * sin(pp.y * 1.1);
        transformed.y += mh * 3.45 + ripple - uSink;
        vH = mh;
        vW = (modelMatrix * vec4(transformed, 1.)).xyz;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        { vec2 pp = position.xz; float e = 0.4;
          float hx = marshH(pp + vec2(e, 0.)) - marshH(pp - vec2(e, 0.));
          float hz = marshH(pp + vec2(0., e)) - marshH(pp - vec2(0., e));
          objectNormal = normalize(vec3(-hx * 3.45 * uMarsh / (2. * e), 1., -hz * 3.45 * uMarsh / (2. * e))); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}\n${MEDIUM_GLSL}\n${CAUSTIC_GLSL}
        uniform vec3 cMud, cMudWet, cGrass, cGrass2; uniform float uFirm, uMarsh; uniform vec4 uFoot; varying vec3 vW; varying float vH;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p = vW.xz;
        float n = fbm(p * 0.35), f = vnoise(p * 4.0);
        vec3 c = mix(cMudWet, cMud, 0.5 + 0.5 * (n - 0.5) * 2.0) * (0.9 + 0.15 * f);
        // ripple marks in the soft mud, footprints of currents
        c *= 0.92 + 0.1 * sin(p.x * 2.4 + n * 6.0);
        // the firm, packed mud between the posts (under the foundations): darker, matte, finely cracked
        float inFoot = uFirm * (1. - smoothstep(uFoot.z - 0.4, uFoot.z + 0.2, length(p - uFoot.xy)));
        float crack = smoothstep(0.04, 0.0, abs(vnoise(p * 3.0) - 0.5)) * 0.5;
        c = mix(c, vec3(0.24, 0.21, 0.17) * (1. - crack), inFoot * 0.75);
        // the marsh islands above the water: cord grass, darker wet edges
        float above = smoothstep(-0.15, 0.25, vW.y);
        vec3 gr = mix(cGrass, cGrass2, smoothstep(0.4, 0.75, fbm(p * 0.5 + 3.))) * (0.8 + 0.3 * vnoise(p * 9.0));
        c = mix(c, gr, above * uMarsh);
        c = mix(c, c * 0.6, (1. - smoothstep(-0.05, 0.12, vW.y)) * smoothstep(-0.6, -0.05, vW.y) * uMarsh);
        // caustics where the water is shallow enough to see them
        float cs = caustic(p * 0.55, uMedT) * (1. - above);
        c += c * cs * 0.9 * smoothstep(-6.0, -1.0, vW.y);
        diffuseColor.rgb *= c;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.45, 0.95, max(inFoot, smoothstep(-0.1, 0.2, vW.y)));')
      .replace('#include <dithering_fragment>', 'gl_FragColor.rgb = applyMedium(gl_FragColor.rgb, vW);\n#include <dithering_fragment>');
  };
  m.customProgramCacheKey = () => 'bed';
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  return { mesh, uni };
}

/** The water surface: gentle chop, Fresnel sky reflection, sun glints; transparent so the forest shows below. */
export function buildWater(P, skyGLSL, skyU) {
  const { TX, TZ } = TANK;
  const g = new THREE.PlaneGeometry(2 * TX, TZ, 200, 140);
  g.rotateX(-Math.PI / 2); g.translate(0, 0, -TZ / 2);
  const uni = Object.assign({ uT: { value: 0 }, uWake: { value: new THREE.Vector4(0, 0, 0, 0) }, uWaterA: { value: 1 },
    cBody: { value: new THREE.Color('#2F6B5E') } }, skyU, MED);
  const m = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: `${NOISE}
      uniform float uT; uniform vec4 uWake; varying vec3 vW; varying vec3 vN;
      float hgt(vec2 p){
        float h = 0.035 * sin(p.x * 0.9 + uT * 1.3) * sin(p.y * 0.7 - uT * 0.9)
                + 0.025 * sin(dot(p, vec2(0.8, 1.7)) * 1.4 - uT * 2.1)
                + 0.012 * sin(dot(p, vec2(-1.9, 0.6)) * 2.3 + uT * 2.7);
        // the gondola's wake: a V of ripples behind it
        vec2 r = p - uWake.xy;
        float back = -r.x * sign(uWake.z + 1e-4);
        if (uWake.w > 0. && back > 0.) {
          float ang = abs(r.y) - back * 0.36;
          h += uWake.w * 0.05 * exp(-ang * ang * 2.0) * exp(-back * 0.07) * sin(back * 4.0 - uT * 6.0);
        }
        return h;
      }
      void main(){
        vec3 p = position;
        float e = 0.15;
        float h = hgt(p.xz);
        p.y += h;
        vN = normalize(vec3(-(hgt(p.xz + vec2(e, 0.)) - h) / e, 1., -(hgt(p.xz + vec2(0., e)) - h) / e));
        vW = (modelMatrix * vec4(p, 1.)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.);
      }`,
    fragmentShader: `${NOISE}\n${skyGLSL}
      uniform float uT, uWaterA; uniform vec3 cBody; varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = vN;
        // fine ripples
        vec2 q = vW.xz * 1.6;
        float e = 0.1;
        float r0 = fbm(q + vec2(uT * 0.4, uT * 0.25)), rx = fbm(q + vec2(e, 0.) + vec2(uT * 0.4, uT * 0.25)), rz = fbm(q + vec2(0., e) + vec2(uT * 0.4, uT * 0.25));
        N = normalize(N + vec3(r0 - rx, 0., r0 - rz) * 1.1);
        if (V.y < 0.) N = -N;   // seen from below (through the glass): the underside of the surface
        float F = 0.02 + 0.98 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 refl = skyCol(normalize(R));
        vec3 L = normalize(uSunDir);
        float spec = pow(max(dot(R, L), 0.), 400.) * 30. + pow(max(dot(R, L), 0.), 60.) * 0.6;
        vec3 col = mix(cBody * 0.55, refl, F) + uSunCol * spec;
        float a = mix(0.42, 1.0, F);
        if (cameraPosition.y < 0.) { col = mix(cBody * 0.9, refl * 0.6, 0.25); a = 0.55; }
        gl_FragColor = vec4(col, a * uWaterA);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 4;
  return { mesh, uni };
}

/** Suspended silt: points drifting in the water and the mud (periodic over the loop). */
export function buildSilt(N, D, seed = 11) {
  const { TX, TZ, BOTTOM } = TANK;
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const pos = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (r() * 2 - 1) * TX * 0.95; pos[i * 3 + 1] = BOTTOM + r() * (-BOTTOM - 0.2); pos[i * 3 + 2] = -0.3 - r() * 24 * (r() < 0.7 ? 0.5 : 1);
    ph[i] = r() * 6.283;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const uni = Object.assign({ uT: { value: 0 }, uLoop: { value: D }, uSize: { value: 1 }, uA: { value: 1 } }, MED);
  const m = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: `${NOISE}\n${MEDIUM_GLSL}
      uniform float uT, uLoop, uSize, uA; attribute float aPh; varying vec3 vC; varying float vA;
      void main(){
        float w = 6.2831853 / uLoop;
        vec3 p = position + vec3(0.6 * sin(w * uT * 2. + aPh), 0.25 * sin(w * uT * 3. + aPh * 1.7), 0.3 * cos(w * uT + aPh));
        vec4 mv = viewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(uSize * (p.y < uMudTop ? 1.0 : 1.6) * 1080. * 0.035 / -mv.z, 5.0);
        vec3 base = p.y < uMudTop ? vec3(0.55, 0.48, 0.36) : vec3(0.7, 0.85, 0.75);
        vC = applyMedium(base, p);
        vA = uA * (0.06 + 0.06 * sin(aPh * 3.0)) * smoothstep(0.0, -0.3, p.y);
      }`,
    fragmentShader: `varying vec3 vC; varying float vA;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q); if (d > 0.25) discard; gl_FragColor = vec4(vC, vA * (1. - d * 4.)); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.renderOrder = 3;
  return { points: pts, uni };
}
