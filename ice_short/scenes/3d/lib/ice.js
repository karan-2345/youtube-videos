// scenes/3d/lib/ice.js -- pond ice, as instanced blocks that melt.
// Each instance has a half-size (aSize, metres), a corner radius (aRound) and a melt amount (aMelt 0..1): the block
// shrinks toward its base, its edges round off and its faces go lumpy and glossy. The look: clear blue-white ice with
// milky bubbles and cracks inside, a wet clearcoat, and a faint cyan glow from light scattered inside.
//   iceBlocks(n, opts) -> { mesh, set(i, {x,y,z,yaw,sx,sy,sz,round,melt,hide}), commit() }
//   puddleMaterial()   wet planks / a puddle: dark, glossy, reflecting the environment
import * as THREE from 'three';
import { patch } from './common.js';

export function iceMaterial({ glow = 0.14, tint = '#8DBFD6' } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint), roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
    envMapIntensity: 1.4, specularIntensity: 1, ior: 1.31,
  });
  return patch(m, {
    uniforms: { uGlow: { value: glow }, uGlowCol: { value: new THREE.Color('#5FD3FF') } },
    vHead: `attribute vec3 aSize; attribute float aRound; attribute float aMelt;
      varying vec3 vLocal; varying float vMelt; varying vec3 vHalf;
      float hn(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`,
    vert: {
      '#include <beginnormal_vertex>': `
        // the unit cube [-1,1]^3 -> a rounded box of half-size h, base resting on y = 0, then the melt
        vec3 h = aSize * (1. - 0.55 * aMelt * vec3(1.0, 0.85, 1.0));
        float r = min(min(h.x, h.y), h.z) * clamp(aRound + 0.85 * aMelt, 0.02, 0.98);
        vec3 q = position * h;
        vec3 c = clamp(q, -(h - r), h - r);
        vec3 dq = q - c;
        float L = length(dq);
        vec3 nn = L > 1e-5 ? dq / L : normal;
        vec3 p = c + r * nn;
        // lumps where it melts (stable per block: seeded by the size)
        float lump = (sin(p.x * 7.1 + aSize.x * 31.) * sin(p.z * 6.3 + aSize.z * 17.) * 0.5 + sin(p.y * 9.7 + aSize.y * 11.) * 0.5);
        p += nn * lump * 0.035 * aMelt * min(h.x, h.z);
        p.y += h.y;
        vec3 objectNormal = nn;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif
        vLocal = position; vMelt = aMelt; vHalf = h;`,
      '#include <begin_vertex>': 'vec3 transformed = p;',
    },
    fHead: 'varying vec3 vLocal; varying float vMelt; varying vec3 vHalf; uniform float uGlow; uniform vec3 uGlowCol;',
    frag: {
      '#include <color_fragment>': `#include <color_fragment>
        // milky core, bubbles and cracks (in the block's own coordinates, so they travel with it)
        vec3 lp = vLocal * vHalf * 6.0;
        float core = 1. - smoothstep(0.2, 0.95, length(vLocal * vec3(1.0, 1.2, 1.0)));
        float bub = smoothstep(0.9, 0.95, vnoise3(lp * 3.1)) * 0.5 + smoothstep(0.93, 0.97, vnoise3(lp * 6.3 + 7.)) * 0.4;
        float crack = (1. - smoothstep(0.0, 0.012, abs(vnoise3(lp * 0.7 + 3.) - 0.5))) * smoothstep(0.55, 0.75, vnoise3(lp * 0.4 + 11.));
        diffuseColor.rgb = mix(diffuseColor.rgb * mix(vec3(0.62, 0.8, 0.92), vec3(1.0), core * 0.25), vec3(0.92, 0.97, 1.0), clamp(bub * 0.8 + crack * 0.45, 0., 1.));`,
      '#include <roughnessmap_fragment>': `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.08, vMelt);`,
      '#include <emissivemap_fragment>': `#include <emissivemap_fragment>
        float rim = pow(1. - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0);
        totalEmissiveRadiance += uGlowCol * uGlow * (0.25 + 1.4 * rim + 0.3 * core) * (0.6 + 0.4 * vnoise3(vLocal * 3.0));`,
    },
  });
}

export function iceBlocks(n, opts = {}) {
  const g = new THREE.BoxGeometry(2, 2, 2, 10, 10, 10);
  const size = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const round = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  const melt = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  g.setAttribute('aSize', size); g.setAttribute('aRound', round); g.setAttribute('aMelt', melt);
  const mat = iceMaterial(opts);
  const mesh = new THREE.InstancedMesh(g, mat, n);
  mesh.castShadow = opts.shadow ?? true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), T = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function set(i, s) {
    if (s.hide) { mesh.setMatrixAt(i, zero); return; }
    E.set(s.rx ?? 0, s.yaw ?? 0, s.rz ?? 0); Q.setFromEuler(E); T.set(s.x, s.y ?? 0, s.z);
    M.compose(T, Q, S); mesh.setMatrixAt(i, M);
    size.setXYZ(i, s.sx, s.sy, s.sz); round.setX(i, s.round ?? 0.08); melt.setX(i, s.melt ?? 0);
  }
  function commit() { mesh.instanceMatrix.needsUpdate = true; size.needsUpdate = true; round.needsUpdate = true; melt.needsUpdate = true; }
  return { mesh, set, commit, n };
}

/** A puddle: a flat disc of water (glossy, slightly rippled), sized and faded per instance through the matrix. */
export function puddles(n) {
  const g = new THREE.CircleGeometry(1, 40);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 1; i < p.count; i++) {   // irregular outline
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.18 * Math.sin(a * 3 + 1) + 0.1 * Math.sin(a * 7 + 2) + 0.06 * Math.sin(a * 13);
    p.setXYZ(i, x * k, 0, z * k);
  }
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#4E6670'), roughness: 0.03, metalness: 0, transparent: true, opacity: 0.55,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false });
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  const mesh = new THREE.InstancedMesh(g, m, n);
  mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.renderOrder = 2;
  const M = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    mesh,
    set(i, x, y, z, rx, rz, yaw = 0) {
      if (rx <= 0.001) { mesh.setMatrixAt(i, zero); return; }
      M.makeRotationY(yaw); M.scale(new THREE.Vector3(rx, 1, rz)); M.setPosition(x, y, z); mesh.setMatrixAt(i, M);
    },
    commit() { mesh.instanceMatrix.needsUpdate = true; },
  };
}
