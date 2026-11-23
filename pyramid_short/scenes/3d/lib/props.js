// scenes/3d/lib/props.js -- the wooden sled and its limestone block, ropes, the colossus of the painting (a seated
// figure about 6.8 m tall on a big sledge), the water stream from a jar, splashes and puffs of dust.
// Local frames: forward = +x, up = +y.
import * as THREE from 'three';
import { patch, mulberry, tint } from './common.js';
import { mergeGeos } from './people.js';

export function woodMaterial(P) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.wood), roughness: 0.8 });
  return patch(m, {
    vHead: 'varying vec3 vL;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' },
    fHead: 'varying vec3 vL;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      float g = vnoise(vec2(vL.x * 1.5, (vL.y + vL.z) * 38.0)) * 0.6 + vnoise(vec2(vL.x * 6.0, (vL.y - vL.z) * 90.0)) * 0.4;
      diffuseColor.rgb *= 0.72 + 0.45 * g;` },
  });
}

export function stoneMaterial(P, color) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.88 });
  return patch(m, {
    vHead: 'varying vec3 vL;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvL = position;' },
    fHead: 'varying vec3 vL;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      float n = vnoise3(vL * 3.0) * 0.5 + vnoise3(vL * 11.0) * 0.3 + vnoise3(vL * 37.0) * 0.2;
      float chisel = 0.5 + 0.5 * sin((vL.x + vL.z * 0.7) * 40.0 + vnoise3(vL * 5.0) * 5.0);
      float pit = smoothstep(0.78, 0.86, vnoise3(vL * 19.0));
      diffuseColor.rgb *= (0.84 + 0.26 * n) * (0.97 + 0.03 * chisel) * (1. - 0.25 * pit);` },
  });
}

function runnerGeo(len, h, w, curl) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0); s.lineTo(len / 2 - curl, 0);
  s.quadraticCurveTo(len / 2, 0, len / 2 + curl * 0.2, h + curl * 0.6);
  s.lineTo(len / 2 + curl * 0.2 - 0.06, h + curl * 0.6);
  s.quadraticCurveTo(len / 2 - curl * 0.3, h, len / 2 - curl, h);
  s.lineTo(-len / 2, h); s.lineTo(-len / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -w / 2);
  return g;
}

/** A sled: two runners with curled fronts, cross-beams, lashings. scale 1 = the haulage sled (2.6 m). */
export function buildSled(P, { len = 2.6, width = 1.0, runnerH = 0.18, beams = 5 } = {}) {
  const wood = woodMaterial(P);
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(runnerGeo(len, runnerH, 0.14 * width / 1.0 + 0.02, 0.35 * len / 2.6), wood);
    r.position.z = s * width * 0.45; r.castShadow = true; r.receiveShadow = true; g.add(r);
  }
  for (let i = 0; i < beams; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.13 * len / 2.6, 0.1 * len / 2.6, width * 1.12), wood);
    b.position.set(-len / 2 + 0.2 + i * (len - 0.55) / (beams - 1), runnerH + 0.05 * len / 2.6, 0);
    b.castShadow = true; b.receiveShadow = true; g.add(b);
  }
  return { group: g, top: runnerH + 0.1 * len / 2.6, len, width };
}

export function buildBlock(P, [lx, ly, lz] = [1.3, 0.85, 1.0]) {
  const g = new THREE.BoxGeometry(lx, ly, lz, 6, 4, 4);
  // slightly irregular, rounded edges
  const p = g.attributes.position, rnd = mulberry(5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 - 0.035 * (Math.abs(x / lx * 2) * Math.abs(y / ly * 2) + Math.abs(y / ly * 2) * Math.abs(z / lz * 2) + Math.abs(x / lx * 2) * Math.abs(z / lz * 2)) / 3;
    p.setXYZ(i, x * k + (rnd() - 0.5) * 0.01, y * k + (rnd() - 0.5) * 0.01, z * k + (rnd() - 0.5) * 0.01);
  }
  g.computeVertexNormals();
  g.translate(0, ly / 2, 0);
  const m = new THREE.Mesh(g, stoneMaterial(P, P.limestone));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** A rope as a tube through points (rebuilt when its ends move). */
export function rope(P, r = 0.022) {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.rope), roughness: 0.9 });
  patch(mat, {
    vHead: 'varying vec2 vUv2;', vert: { '#include <uv_vertex>': '#include <uv_vertex>\nvUv2 = uv;' },
    fHead: 'varying vec2 vUv2;',
    frag: { '#include <color_fragment>': '#include <color_fragment>\ndiffuseColor.rgb *= 0.8 + 0.3 * smoothstep(0.2, 0.8, fract(vUv2.x * 900.0 + vUv2.y * 2.0));' },
  });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  let key = '';
  mesh.userData.setPoints = (pts) => {
    const k = pts.map((v) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`).join(';');
    if (k === key) return; key = k;
    mesh.geometry.dispose();
    const curve = new THREE.CatmullRomCurve3(pts);
    mesh.geometry = new THREE.TubeGeometry(curve, Math.max(16, pts.length * 6), r, 5, false);
  };
  return mesh;
}

/** The colossus of Djehutihotep's painting, simplified: a seated figure on a block throne, hands on the knees, a
 *  wig, on a plinth; about 6.8 m tall from the sledge. Built from rounded boxes, alabaster-white. */
export function buildColossus(P) {
  const mat = stoneMaterial(P, P.alabaster);
  const parts = [];
  const box = (sx, sy, sz, x, y, z, rz = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz, 2, 2, 2); g.rotateZ(rz); g.translate(x, y, z); return g; };
  const capg = (r, len, x, y, z, rz = 0, sz = 1) => { const g = new THREE.CapsuleGeometry(r, len, 4, 12); g.scale(1, 1, sz); g.rotateZ(rz); g.translate(x, y, z); return g; };
  parts.push(box(3.0, 0.45, 2.3, 0, 0.225, 0));                  // plinth
  parts.push(box(1.5, 2.6, 2.1, -0.85, 1.75, 0));                // throne
  parts.push(box(0.35, 1.1, 2.1, -1.55, 3.55, 0));               // throne back (low)
  for (const s of [-1, 1]) {
    parts.push(capg(0.3, 1.3, 0.05, 2.95, s * 0.45, Math.PI / 2 - 0.05, 1.0));   // thighs (horizontal, forward)
    parts.push(capg(0.26, 1.6, 0.85, 1.55, s * 0.45, 0, 1.0));                   // shins
    parts.push(box(0.75, 0.22, 0.42, 1.0, 0.56, s * 0.45));                      // feet
    parts.push(capg(0.16, 0.75, -0.62, 4.35, s * 0.86, 0.15, 1.0));              // upper arms
    parts.push(capg(0.14, 0.85, -0.05, 3.25, s * 0.66, Math.PI / 2 - 0.1, 1.0)); // forearms on the thighs
    parts.push(box(0.4, 0.14, 0.3, 0.55, 3.2, s * 0.6));                         // hands, flat on the knees
  }
  parts.push(box(0.85, 0.55, 1.35, -0.75, 3.05, 0));             // lap / kilt
  parts.push(capg(0.5, 1.35, -0.8, 4.35, 0, 0, 1.45));           // torso
  parts.push(capg(0.2, 0.2, -0.78, 5.55, 0, 0, 1.0));            // neck
  // head with a wig flaring to the shoulders
  const head = new THREE.SphereGeometry(0.42, 16, 12); head.scale(1.0, 1.2, 0.9); head.translate(-0.72, 6.05, 0); parts.push(head);
  const wigProf = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10; wigProf.push(new THREE.Vector2(0.48 + 0.5 * u * u, 6.45 - 1.25 * u)); }
  wigProf.push(new THREE.Vector2(0.01, 5.2));
  const wig = new THREE.LatheGeometry(wigProf.reverse(), 18, Math.PI * 0.62, Math.PI * 1.76); wig.scale(0.95, 1, 1); wig.translate(-0.82, 0, 0); parts.push(wig);
  const cap = new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5); cap.scale(1.0, 0.7, 1.0); cap.translate(-0.78, 6.3, 0); parts.push(cap);
  const beard = new THREE.CylinderGeometry(0.07, 0.1, 0.4, 8); beard.translate(-0.45, 5.62, 0); parts.push(beard);
  const nose = new THREE.ConeGeometry(0.08, 0.2, 6); nose.rotateZ(-Math.PI / 2); nose.translate(-0.28, 6.02, 0); parts.push(nose);
  const merged = mergeGeos(parts.map((g) => tint(g, '#ffffff')));
  merged.computeVertexNormals();
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/** A falling stream of water (a bent tube with flowing streaks) and a little splash of droplets where it lands. */
export function waterStream(P, radius = 0.035) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uOp: { value: 1 }, cW: { value: new THREE.Color(P.water) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT, uOp; uniform vec3 cW; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
      void main(){
        float f = 1. - abs(dot(normalize(vN), normalize(vV)));
        float s = fract(vUv.x * 7.0 - uT * 3.2 + h(floor(vUv.y * 5.)) * 0.3);
        float streak = smoothstep(0.0, 0.2, s) * smoothstep(1.0, 0.6, s);
        float a = uOp * (0.35 + 0.55 * pow(f, 1.5) + 0.25 * streak) * smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        vec3 c = mix(cW * 0.7, vec3(1.0), 0.35 * streak + 0.5 * pow(f, 3.0));
        gl_FragColor = vec4(c * 1.6 * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
  });
  mat.premultipliedAlpha = true;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.frustumCulled = false;
  let key = '';
  mesh.userData.set = (a, b, ctrl) => {
    const k = [a, b, ctrl].map((v) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`).join(';');
    if (k === key) return; key = k;
    mesh.geometry.dispose();
    const c = new THREE.QuadraticBezierCurve3(a, ctrl, b);
    const g = new THREE.TubeGeometry(c, 24, radius, 8, false);
    // taper: thin where it lands
    const p = g.attributes.position, uv = g.attributes.uv;
    const pts = c.getSpacedPoints(24);
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i), k2 = 1 - 0.45 * u;
      const ci = pts[Math.round(u * 24)];
      p.setXYZ(i, ci.x + (p.getX(i) - ci.x) * k2, ci.y + (p.getY(i) - ci.y) * k2, ci.z + (p.getZ(i) - ci.z) * k2);
    }
    mesh.geometry = g;
  };
  return mesh;
}

/** Particles: soft round sprites (dust puffs, splash droplets) with per-particle alpha and size. */
export function particles(n, color, { additive = false, soft = true } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1000 }, uCol: { value: new THREE.Color(color) }, uLight: { value: 1 } },
    vertexShader: `attribute float size, alpha; uniform float uScale; varying float vA;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = clamp(uScale * size / -mv.z, 0., 160.); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uLight; varying float vA;
      void main(){ vec2 q = gl_PointCoord - .5; float r = dot(q, q) * 4.; if (r > 1.) discard;
        float a = vA * ${soft ? '(1. - r) * (1. - r)' : 'smoothstep(1.0, 0.7, r)'};
        gl_FragColor = vec4(uCol * uLight * a, ${additive ? '0.' : 'a'}); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  mat.premultipliedAlpha = true;
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  pts.userData.n = n;
  return pts;
}
