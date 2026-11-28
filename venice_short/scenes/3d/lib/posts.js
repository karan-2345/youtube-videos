// scenes/3d/lib/posts.js -- the forest of posts. One instanced trunk per post: bark, a sharpened tip, tree rings on
// the cut end. Local frame of a trunk: the butt end at y = 0, the top (thin, later the sharpened tip) at y = LEN.
// As a tree it stands upright with its crown above; as a post it is turned upside down (tip first, like real timber
// piles), its butt end flush with the canal bed. The crown (live larch foliage, or the ghost crowns of the finale)
// shares the trunk's instance matrices.
//   aState (per instance, dynamic): x = rot (0..1), y = glow, z = sharpened (0..1), w = crown scale
import * as THREE from 'three';
import { NOISE, patch, mulberry } from './common.js';
import { withMedium, MED, MEDIUM_GLSL } from './medium.js';

export const LEN = 8.0, R0 = 0.21, R1 = 0.14;

function trunkGeometry() {
  const g = new THREE.CylinderGeometry(R1, R0, LEN, 9, 14, false);
  g.translate(0, LEN / 2, 0);
  // irregular, slightly crooked trunk: bend and lumps from the vertex height (the same for every post; aSeed varies
  // the shading and the instance matrix varies the twist)
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.06 * Math.sin(a * 3 + y * 1.7) + 0.04 * Math.sin(a * 7 - y * 3.1);
    p.setXYZ(i, x * k + 0.04 * Math.sin(y * 0.9), y, z * k + 0.03 * Math.cos(y * 0.7));
  }
  g.computeVertexNormals();
  return g;
}

function crownGeometry() {
  // a larch-like spire: tiers of drooping, ragged cones from 35% of the trunk up past its top
  const parts = [];
  const tiers = 7;
  for (let k = 0; k < tiers; k++) {
    const u = k / (tiers - 1);
    const y0 = LEN * 0.35 + u * (LEN * 0.9 + 1.2);
    const r = 2.1 * (1 - u * 0.82) + 0.2;
    const c = new THREE.ConeGeometry(r, 2.6 - 0.9 * u, 11, 2, true);
    const p = c.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const rag = 1 + 0.18 * Math.sin(a * 5 + k * 1.3) + 0.1 * Math.sin(a * 11 + k);
      p.setXYZ(i, x * rag, y - 0.25 * (Math.hypot(x, z) / r) ** 2, z * rag);
    }
    c.translate(0, y0 + 0.9, 0);
    parts.push(c.toNonIndexed());
  }
  let n = 0; for (const c of parts) n += c.attributes.position.count;
  const pos = new Float32Array(n * 3); let o = 0;
  for (const c of parts) { pos.set(c.attributes.position.array, o); o += c.attributes.position.array.length; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** spots: [[x, z, group], ...] -> instanced trunks + crowns. */
export function buildPosts(spots, seed = 5) {
  const N = spots.length;
  const rnd = mulberry(seed);
  const tg = trunkGeometry();
  const seeds = new Float32Array(N); for (let i = 0; i < N; i++) seeds[i] = rnd();
  const aSeed = new THREE.InstancedBufferAttribute(seeds, 1);
  const state = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); state.setUsage(THREE.DynamicDrawUsage);
  tg.setAttribute('aSeed', aSeed); tg.setAttribute('aState', state);
  const uni = { uSilt: { value: 0 }, uWarm: { value: new THREE.Color('#FFB35A') }, uRotT: { value: 0 } };
  const bark = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  patch(bark, {
    uniforms: uni,
    vHead: `attribute float aSeed; attribute vec4 aState; varying vec3 vOP; varying float vSeed; varying vec4 vState;
      ${NOISE}`,
    vert: { '#include <begin_vertex>': `#include <begin_vertex>
      vOP = position; vSeed = aSeed; vState = aState;
      // sharpening: the last 0.7 m of the thin end draws in to a point
      float sh = aState.z * smoothstep(${(LEN - 0.75).toFixed(2)}, ${LEN.toFixed(2)}, position.y);
      transformed.xz *= 1. - 0.97 * sh;
      transformed.y -= 0.25 * sh * aState.z;
      // rot: the wood shrinks and crumbles away unevenly
      float rot = aState.x;
      if (rot > 0.) {
        float n = vnoise3(position * vec3(4., 1.3, 4.) + aSeed * 30.);
        transformed.xz *= 1. - rot * (0.35 + 0.5 * n);
        transformed.y *= 1. - rot * 0.35 * smoothstep(0.3, 1.0, n + aSeed * 0.3);
      }` },
    fHead: `varying vec3 vOP; varying float vSeed; varying vec4 vState; uniform vec3 uWarm; uniform float uSilt;`,
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        vec3 op = vOP;
        float ang = atan(op.z, op.x);
        float fiss = vnoise(vec2(ang * 3.0 + vSeed * 20., op.y * 1.6)) ;
        float fine = vnoise(vec2(ang * 14.0, op.y * 9.0 + vSeed * 5.));
        vec3 wood = mix(vec3(0.30, 0.22, 0.15), vec3(0.47, 0.36, 0.25), vSeed);
        vec3 c = wood * (0.75 + 0.35 * smoothstep(0.3, 0.7, fiss)) * (0.9 + 0.15 * fine);
        c *= 1. - 0.45 * smoothstep(0.62, 0.75, fiss);                       // deep bark fissures
        // the cut end (y ~ 0): pale sapwood, rings and radial checks
        float r = length(op.xz);
        if (op.y < 0.02) {
          float rings = 0.5 + 0.5 * sin(r * 160.0 + vnoise(op.xz * 30.) * 2.0);
          c = mix(vec3(0.62, 0.47, 0.30), vec3(0.45, 0.31, 0.19), rings * 0.6) * (0.85 + 0.2 * vSeed);
          c *= 1. - 0.5 * smoothstep(0.02, 0.0, abs(fract(ang * 1.2 + vSeed) - 0.5) - 0.48);
        }
        // the sharpened tip: fresh axe facets, paler wood
        float shp = vState.z * smoothstep(${(LEN - 0.75).toFixed(2)}, ${(LEN - 0.55).toFixed(2)}, op.y);
        c = mix(c, vec3(0.66, 0.52, 0.34) * (0.85 + 0.25 * step(0.5, fract(ang * 1.27))), shp);
        // waterlogged: a darker, greyer skin with a film of silt
        c = mix(c, c * vec3(0.66, 0.62, 0.55) + vec3(0.03, 0.026, 0.02), uSilt);
        // rot: dark punky wood under white fungal fuzz
        float rot = vState.x;
        float fz = vnoise3(op * 18.0 + vSeed * 9.);
        c = mix(c, vec3(0.16, 0.11, 0.07), rot * 0.8);
        c = mix(c, vec3(0.86, 0.84, 0.78), smoothstep(0.75 - 0.5 * rot, 0.95 - 0.5 * rot, fz) * rot);
        diffuseColor.rgb *= c;`,
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        totalEmissiveRadiance += uWarm * vState.y * 1.6;`,
    },
  });
  withMedium(bark);
  const trunks = new THREE.InstancedMesh(tg, bark, N);
  trunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trunks.frustumCulled = false;

  // crowns: the live foliage (opaque) and the ghosts (additive), both on the trunks' matrices
  const cg = crownGeometry();
  cg.setAttribute('aSeed', aSeed); cg.setAttribute('aState', state);
  const crownVert = `
    float w = aState.w;
    transformed.xz *= w;
    transformed.y = ${(LEN * 0.35).toFixed(2)} + (transformed.y - ${(LEN * 0.35).toFixed(2)}) * (0.25 + 0.75 * w);`;
  const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  patch(leaf, {
    vHead: 'attribute float aSeed; attribute vec4 aState; varying vec3 vOP; varying float vSeed;',
    vert: { '#include <begin_vertex>': `#include <begin_vertex>\nvOP = position; vSeed = aSeed;\n${crownVert}` },
    fHead: 'varying vec3 vOP; varying float vSeed;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      float n = vnoise3(vOP * 5.0 + vSeed * 7.), m = vnoise3(vOP * 17.0);
      if (m < 0.18) discard;                                               // ragged gaps in the needles
      vec3 c = mix(vec3(0.07, 0.15, 0.06), vec3(0.22, 0.32, 0.11), n * 0.8 + vSeed * 0.3);
      c *= 0.55 + 0.6 * smoothstep(0.2, 0.9, m);
      float tier = fract((vOP.y - 2.8) / 1.35);
      c *= 0.55 + 0.6 * tier;
      diffuseColor.rgb *= c;` },
  });
  withMedium(leaf);
  const crowns = new THREE.InstancedMesh(cg, leaf, N);
  crowns.instanceMatrix = trunks.instanceMatrix;
  crowns.frustumCulled = false;

  const ghostUni = Object.assign({ uGhost: { value: 0 }, uGhostCol: { value: new THREE.Color('#9BE38A') }, uGT: { value: 0 } }, MED);
  const ghostMat = new THREE.ShaderMaterial({
    uniforms: ghostUni,
    vertexShader: `${NOISE}
      attribute float aSeed; attribute vec4 aState; uniform float uGhost;
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vA; varying vec3 vOP;
      void main(){
        vec3 transformed = position;
        float gw = clamp(uGhost * 1.6 - aSeed * 0.6, 0., 1.);
        gw = gw * gw * (3. - 2. * gw);
        ${crownVert.replace('aState.w', 'gw')}
        vOP = position;
        vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vA = gw * step(aSeed, 0.22) * step(-10.5, (instanceMatrix * vec4(0., 0., 0., 1.)).z);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `${NOISE}\n${MEDIUM_GLSL}
      uniform vec3 uGhostCol; uniform float uGT; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vA; varying vec3 vOP;
      void main(){
        float f = 1. - abs(dot(normalize(vN), normalize(vV)));
        float n = vnoise3(vOP * 4.0 + vec3(0., uGT * 0.3, 0.));
        if (vA < 0.001) discard;
        float a = vA * (0.04 + 0.9 * pow(f, 3.0)) * (0.4 + 0.9 * n);
        vec3 c = uGhostCol * a * 0.6;
        // seen through the mud, the ghosts are dimmed by it too (but not coloured: they are light)
        vec3 m = applyMedium(vec3(1.), vW);
        float vis = dot(m, vec3(0.333)) ;
        gl_FragColor = vec4(c * (0.35 + 0.65 * clamp(vis * 1.4, 0., 1.)), 1.);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const ghosts = new THREE.InstancedMesh(cg, ghostMat, N);
  ghosts.instanceMatrix = trunks.instanceMatrix;
  ghosts.frustumCulled = false; ghosts.renderOrder = 6;
  return { trunks, crowns, ghosts, state, N, uni, ghostUni, bark };
}

/** The planks (the zatterone): two crossed layers of boards on the post heads, per footprint, instanced. */
export function buildPlanks(rects, y0, seed = 9) {
  const rnd = mulberry(seed);
  const list = [];
  for (const [x0, x1, z0, z1] of rects) {
    for (let x = x0; x < x1; x += 0.42) list.push([x + 0.2, (z0 + z1) / 2, 0.38, z1 - z0, 0, y0 + 0.11]);     // lower layer, along z
    for (let z = z0; z < z1; z += 0.42) list.push([(x0 + x1) / 2, z + 0.2, x1 - x0, 0.38, 1, y0 + 0.33]);     // upper layer, along x
  }
  const g = new THREE.BoxGeometry(1, 0.2, 1);
  const seeds = new Float32Array(list.length); for (let i = 0; i < list.length; i++) seeds[i] = rnd();
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  patch(m, {
    vHead: 'attribute float aSeed; varying float vSeed; varying vec3 vWP;',
    vert: { '#include <begin_vertex>': '#include <begin_vertex>\nvSeed = aSeed; vWP = (modelMatrix * instanceMatrix * vec4(position, 1.)).xyz;' },
    fHead: 'varying float vSeed; varying vec3 vWP;',
    frag: { '#include <color_fragment>': `#include <color_fragment>
      float g = vnoise(vec2((vWP.x + vWP.z) * 0.6, vWP.y * 40. + vSeed * 9.) * vec2(1., 1.)) ;
      float grain = 0.5 + 0.5 * sin((vWP.x * 0.3 + vWP.z * 0.3) * 30. + g * 6.);
      vec3 c = mix(vec3(0.36, 0.26, 0.17), vec3(0.52, 0.40, 0.27), vSeed) * (0.85 + 0.2 * grain);
      diffuseColor.rgb *= c;` },
  });
  withMedium(m);
  const mesh = new THREE.InstancedMesh(g, m, list.length);
  mesh.frustumCulled = false;
  return { mesh, list };
}
