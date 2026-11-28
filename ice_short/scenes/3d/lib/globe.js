// scenes/3d/lib/globe.js -- an antique library globe on a brass meridian and a turned wooden stand: parchment land, a
// teal-grey sea, the graticule in brown ink, the equator as a bold red-brown line (it flashes when the route crosses
// it). Routes are drawn on the surface as ink trails that grow (uProg), with a little ship marker at the head.
//   buildGlobe(renderer) -> { group, sphere, R, setSpin(lon, lat), route(name, pts), pinAt(lat, lon), toWorld(lat, lon) }
import * as THREE from 'three';
import { NOISE } from './common.js';
import { woodMat } from './ship.js';

export const PLACES = {
  boston: [42.36, -71.06], martinique: [14.6, -61.0], calcutta: [22.57, 88.36], cape: [-34.4, 18.5],
};
// the 1833 track: down the Atlantic, round the Cape of Good Hope, up the Indian Ocean to the Hooghly
export const ROUTE_INDIA = [[42.36, -71.06], [38, -60], [28, -42], [12, -30], [0, -25], [-14, -22], [-28, -10], [-36, 5], [-37, 19], [-35, 32],
  [-28, 48], [-16, 64], [-4, 78], [0, 82], [8, 86], [16, 88.5], [21.2, 88.2], [22.57, 88.36]];
export const ROUTE_MART = [[42.36, -71.06], [36, -66], [26, -62], [18, -61], [14.6, -61.0]];

export function buildGlobe() {
  const R = 0.4;
  const group = new THREE.Group();
  const spin = new THREE.Group();           // turns about the (tilted) axis
  const tilt = new THREE.Group(); tilt.rotation.z = -23.4 * Math.PI / 180;
  tilt.add(spin); group.add(tilt);
  tilt.position.y = 0.0;
  const tex = new THREE.TextureLoader().load('/assets/land.png');
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8; tex.wrapS = THREE.RepeatWrapping;
  const uniforms = { uLand: { value: tex }, uEq: { value: 0 }, uLight: { value: new THREE.Vector3(1, 1, 1).normalize() } };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2; varying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUv2 = uv; vObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${NOISE}\nuniform sampler2D uLand; uniform float uEq; varying vec2 vUv2; varying vec3 vObj;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 L = texture2D(uLand, vUv2).rgb;
        float land = smoothstep(0.35, 0.65, L.r), coast = smoothstep(0.08, 0.5, L.g) * (1. - land);
        float edge = 1. - smoothstep(0.0, 0.18, abs(L.r - 0.5));
        float lat = (vUv2.y - 0.5) * 180., lon = (vUv2.x - 0.5) * 360.;
        vec3 sea = mix(vec3(0.33, 0.47, 0.5), vec3(0.48, 0.6, 0.6), coast * 0.8);
        sea *= 0.9 + 0.12 * fbm(vUv2 * vec2(40., 20.));
        vec3 parch = vec3(0.9, 0.82, 0.62) * (0.85 + 0.2 * fbm(vUv2 * vec2(60., 30.))) - vec3(0.06, 0.08, 0.1) * L.b;
        vec3 c = mix(sea, parch, land);
        c = mix(c, vec3(0.32, 0.2, 0.12), edge * 0.85);
        // graticule every 15 degrees (thin brown ink), the equator bold
        float gl = min(abs(fract(lat / 15. + 0.5) - 0.5) * 15., abs(fract(lon / 15. + 0.5) - 0.5) * 15. * cos(radians(lat)));
        c = mix(c, vec3(0.38, 0.27, 0.18), (1. - smoothstep(0.0, 0.22, gl)) * 0.55);
        float eq = 1. - smoothstep(0.25, 0.55, abs(lat));
        vec3 eqc = mix(vec3(0.55, 0.16, 0.1), vec3(1.0, 0.82, 0.3), uEq);
        c = mix(c, eqc, eq * (0.85 + uEq * 0.15) * step(0.5, fract(lon / 4.)) );
        // varnish: age at the poles
        c *= 0.9 + 0.1 * smoothstep(80., 40., abs(lat));
        c = mix(c, c * vec3(1.0, 0.9, 0.72), 0.25);
        diffuseColor.rgb = c;`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat eqg = 1. - smoothstep(0.2, 0.8, abs((vUv2.y - 0.5) * 180.)); totalEmissiveRadiance += vec3(1.0, 0.7, 0.25) * eqg * uEq * 2.5;');
  };
  mat.customProgramCacheKey = () => 'globe';
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), mat);
  sphere.castShadow = true; sphere.receiveShadow = true;
  spin.add(sphere);
  // the brass meridian (does not spin) and the stand
  const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color('#C49A4A'), roughness: 0.28, metalness: 1 });
  const mer = new THREE.Mesh(new THREE.TorusGeometry(R * 1.06, 0.012, 10, 120, Math.PI * 1.55), brass);
  mer.rotation.z = -Math.PI * 0.275;
  tilt.add(mer);
  const horizon = new THREE.Mesh(new THREE.TorusGeometry(R * 1.12, 0.02, 8, 120), woodMat('#5A3A22', { plank: 0.05, along: 'x' }));
  horizon.rotation.x = Math.PI / 2; horizon.position.y = -0.62; horizon.scale.setScalar(0.35); group.add(horizon);
  const legs = [];
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.75, 10), horizon.material);
    leg.position.set(Math.cos(a) * R * 1.0, -0.38, Math.sin(a) * R * 1.0); leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    group.add(leg); legs.push(leg);
  }
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.06, 20), brass); foot.position.y = -0.75; group.add(foot);

  const ll = (lat, lon, r = R) => {
    const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    // three.js SphereGeometry: u = phi/2pi from -x... x = -cos(u2pi) sin(v pi), y = cos(v pi), z = sin(u2pi) sin(v pi)
    return new THREE.Vector3(-Math.cos(th) * Math.sin(phi) * r, Math.cos(phi) * r, Math.sin(th) * Math.sin(phi) * r);
  };
  // routes: a ribbon (tube) along the surface, revealed by uProg
  const routes = {};
  function route(name, pts, color = '#A3241C', width = 0.0042) {
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = ll(...pts[i], 1), b = ll(...pts[i + 1], 1);
      for (let k = 0; k < 16; k++) dense.push(a.clone().lerp(b, k / 16).normalize().multiplyScalar(R * 1.004));
    }
    dense.push(ll(...pts[pts.length - 1], R * 1.004));
    const curve = new THREE.CatmullRomCurve3(dense);
    const g = new THREE.TubeGeometry(curve, dense.length * 2, width, 6, false);
    const m = new THREE.ShaderMaterial({
      uniforms: { uProg: { value: 0 }, uCol: { value: new THREE.Color(color) }, uOp: { value: 1 } },
      vertexShader: 'varying float vU; void main(){ vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uProg, uOp; uniform vec3 uCol; varying float vU;
        void main(){ if (vU > uProg) discard; float dash = step(0.35, fract(vU * 60.)); float head = smoothstep(uProg - 0.02, uProg, vU);
          gl_FragColor = vec4(uCol * (0.9 + 2.5 * head), uOp * (0.55 + 0.45 * dash)); }`,
      transparent: true, depthWrite: false,
    });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3;
    spin.add(mesh);
    routes[name] = { mesh, curve, m };
    return routes[name];
  }
  // pins
  const pinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#B3261E'), roughness: 0.35, metalness: 0.1, emissive: new THREE.Color('#B3261E'), emissiveIntensity: 0.4 });
  function pinAt(lat, lon) {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), pinMat); head.position.y = 0.03;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.03, 6), new THREE.MeshStandardMaterial({ color: '#CCCCCC', metalness: 1, roughness: 0.3 })); stem.position.y = 0.015;
    g.add(head, stem);
    const p = ll(lat, lon, R);
    g.position.copy(p); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
    spin.add(g);
    return g;
  }
  // a little ship marker riding the head of a route
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.024, 4), new THREE.MeshStandardMaterial({ color: '#2A1E14', roughness: 0.5 }));
  spin.add(marker); marker.visible = false;
  function markerAt(name, u) {
    const r = routes[name]; if (!r) return;
    const p = r.curve.getPointAt(Math.min(0.999, Math.max(0, u)));
    const q = r.curve.getPointAt(Math.min(1, Math.max(0, u) + 0.002));
    marker.visible = true;
    marker.position.copy(p).normalize().multiplyScalar(R * 1.012);
    marker.up.copy(p).normalize();
    marker.lookAt(marker.position.clone().add(q.clone().sub(p)));
    marker.rotateX(Math.PI / 2);
  }
  function setSpin(lonFacing) { spin.rotation.y = -(lonFacing + 90) * Math.PI / 180; }
  function toWorld(lat, lon, r = R * 1.01) { return spin.localToWorld(ll(lat, lon, r)); }
  return { group, sphere, R, spin, tilt, route, routes, pinAt, markerAt, setSpin, toWorld, uniforms };
}
