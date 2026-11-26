// scenes/3d/lib/studio.js -- the dark studio: a graded backdrop with a soft glow behind the subject, a floor that
// catches a pool of light (with a moving grid for the jog), floating motes for depth, and an environment map for the
// glossy things (fat, atoms, water).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function buildStudio(P, renderer, rnd) {
  const g = new THREE.Group();
  const U = {
    uTop: { value: new THREE.Color(P.bg_top) }, uLow: { value: new THREE.Color(P.bg_low) },
    uGlow: { value: new THREE.Color('#1E3550') }, uGlowAmt: { value: 1 }, uGlowDir: { value: new THREE.Vector3(0, 0.1, -1) },
    uWarm: { value: new THREE.Color(P.fat_deep) }, uWarmAmt: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
      uniform vec3 uTop, uLow, uGlow, uWarm, uTint; uniform float uGlowAmt, uWarmAmt; uniform vec3 uGlowDir; varying vec3 vD;
      void main(){
        float y = vD.y;
        vec3 c = mix(uLow, uTop, smoothstep(-0.35, 0.6, y));
        float g = max(dot(vD, normalize(uGlowDir)), 0.);
        c += uGlow * pow(g, 6.) * 0.9 * uGlowAmt + uGlow * pow(g, 2.) * 0.25 * uGlowAmt;
        c += uWarm * pow(g, 5.) * uWarmAmt;
        gl_FragColor = vec4(c * uTint, 1.);
      }`,
  }));
  sky.renderOrder = -10;
  g.add(sky);

  // floor: dark, slightly glossy, a pool of light under the figure; grid lines that scroll while jogging
  const FU = { uPool: { value: 1 }, uScroll: { value: 0 }, uGrid: { value: 0 }, uCol: { value: new THREE.Color('#1A2A3C') },
    uLine: { value: new THREE.Color('#5A86B0') }, uAlpha: { value: 1 } };
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 96), new THREE.ShaderMaterial({
    uniforms: FU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `
      uniform float uPool, uScroll, uGrid, uAlpha; uniform vec3 uCol, uLine; varying vec2 vP;
      void main(){
        float r = length(vP);
        float pool = exp(-r * r / 1.3) * uPool;
        vec2 q = vec2(vP.x, vP.y + uScroll);
        vec2 gl = abs(fract(q / 0.5) - 0.5) / fwidth(q / 0.5);
        float line = (1. - min(min(gl.x, gl.y), 1.)) * uGrid * exp(-r * r / 6.);
        vec3 c = uCol * (0.25 + 1.4 * pool) + uLine * line * 0.5;
        float a = smoothstep(9., 2.5, r);
        gl_FragColor = vec4(c, a * uAlpha);
      }`,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = -5;
  g.add(floor);

  // contact shadow under the feet
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), new THREE.ShaderMaterial({
    uniforms: { uAmt: { value: 1 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform float uAmt; varying vec2 vP; void main(){ float r = length(vP / vec2(1., 0.7)); gl_FragColor = vec4(0., 0., 0., 0.55 * exp(-r * r / 0.06) * uAmt); }',
  }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.renderOrder = -4;
  g.add(shadow);

  // motes: soft out-of-focus specks drifting in the air
  const N = 260, mp = new Float32Array(N * 3), ms = new Float32Array(N), mseed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 1.2 + rnd() * 6, a = rnd() * Math.PI * 2;
    mp.set([Math.cos(a) * r, rnd() * 3.2, Math.sin(a) * r - 1], i * 3);
    ms[i] = 6 + rnd() * 22; mseed[i] = rnd() * 100;
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  mg.setAttribute('aSize', new THREE.BufferAttribute(ms, 1));
  mg.setAttribute('aSeed', new THREE.BufferAttribute(mseed, 1));
  const MU = { uTime: { value: 0 }, uAlpha: { value: 0.5 }, uColor: { value: new THREE.Color('#9CC4EA') }, uScale: { value: 1 } };
  const motes = new THREE.Points(mg, new THREE.ShaderMaterial({
    uniforms: MU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize, aSeed; uniform float uTime, uScale; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime * 2. + aSeed) * 0.25, sin(uTime * 3. + aSeed * 0.7) * 0.15, cos(uTime * 2. + aSeed * 1.7) * 0.25);   // uTime = phase over the whole video
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = aSize * uScale * (3.0 / -mv.z);
        vA = 0.4 + 0.6 * fract(aSeed * 7.13);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAlpha; varying float vA;
      void main(){ vec2 q = gl_PointCoord - .5; float d = dot(q, q) * 4.; if (d > 1.) discard;
        float a = (1. - d) * (1. - d) * vA * uAlpha; gl_FragColor = vec4(uColor * a * 0.25, 1.); }`,
  }));
  motes.renderOrder = -3;
  motes.frustumCulled = false;
  g.add(motes);

  // the environment for reflections (deterministic, built once)
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;

  return { group: g, U, FU, MU, env, floor, shadow, sky, motes };
}
