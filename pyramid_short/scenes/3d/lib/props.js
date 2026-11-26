// scenes/3d/lib/props.js -- everything the builders used and left: the wooden sledge with its block, ropes, the
// water jar, Old Kingdom cargo boats (bipod mast, tall sail, steering oars), Merer's papyrus diary, a credit card for
// the casing joint, bread moulds and beer jars, the workers' town and their tombs, and a flying saucer (busted).
import * as THREE from 'three';
import { NOISE, mergeGeos } from './land.js';

const std = (c, r = 0.8, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c), roughness: r }, o));
const shadowed = (m) => { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; };

// ------------------------------------------------------------------ materials
export function woodMaterial(P) {
  const m = std(P.wood, 0.85);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vL2;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvL2 = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vL2;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float gr = fbm(vec2(vL2.x * 0.8 + vL2.z * 0.8, vL2.y * 9.) );
        float ring = 0.5 + 0.5 * sin((vL2.y + vL2.z) * 40. + gr * 8.);
        diffuseColor.rgb *= 0.78 + 0.22 * ring + 0.12 * (gr - .5);`);
  };
  return m;
}

export function stoneMaterial(P, color, { rough = 0.82, scale = 1.6 } = {}) {
  const m = std(color, rough);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vL3;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvL3 = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vL3;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = vec2(vL3.x + vL3.y * 0.7, vL3.z - vL3.y * 0.4) * ${scale.toFixed(2)};
        float n = fbm(q), f = vnoise(q * 7.), pits = smoothstep(0.78, 0.84, vnoise(q * 3.3 + 7.));
        diffuseColor.rgb *= 0.86 + 0.2 * n + 0.08 * (f - .5) - 0.12 * pits;`);
  };
  return m;
}

// ------------------------------------------------------------------ sledge + block
export function buildSledge(P, { L = 3.2, blockSize = [1.7, 1.05, 1.15], white = false } = {}) {
  const g = new THREE.Group();
  const wood = woodMaterial(P);
  // runners: a curved-up front, extruded side profile
  const prof = new THREE.Shape();
  prof.moveTo(-L / 2, 0); prof.lineTo(L / 2 - 0.5, 0);
  prof.quadraticCurveTo(L / 2 + 0.05, 0.02, L / 2 + 0.15, 0.42);
  prof.lineTo(L / 2 - 0.02, 0.44); prof.quadraticCurveTo(L / 2 - 0.12, 0.2, L / 2 - 0.55, 0.18);
  prof.lineTo(-L / 2, 0.18); prof.closePath();
  const rg = new THREE.ExtrudeGeometry(prof, { depth: 0.14, bevelEnabled: false, curveSegments: 8 });
  rg.rotateY(-Math.PI / 2);                              // length along +z
  for (const sx of [-0.55, 0.55]) { const r = new THREE.Mesh(rg, wood); r.position.x = sx + 0.07; g.add(r); }
  // cross beams
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.1, 0.16), wood);
    b.position.set(0, 0.23, -L / 2 + 0.35 + i * (L - 0.9) / 4); g.add(b);
  }
  // the block, lashed down
  const blockMat = white ? stoneMaterial(P, P.casing, { rough: 0.5 }) : stoneMaterial(P, P.rock);
  const [bx, by, bz] = blockSize;
  const block = new THREE.Mesh(new THREE.BoxGeometry(bx, by, bz, 2, 2, 2), blockMat);
  block.position.set(0, 0.28 + by / 2, -0.1); g.add(block);
  const rope = std('#B49A6A', 0.95);
  for (const z of [-0.45, 0.25]) {
    const lash = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 4), rope);
    lash.scale.set(bx / 2 + 0.03, by / 2 + 0.03, 1); lash.rotation.set(0, Math.PI / 2, Math.PI / 4);
    lash.rotation.set(0, Math.PI / 2, 0); lash.position.set(0, 0.28 + by / 2, z + bz * 0.0 - 0.1);
    lash.scale.set((by / 2 + 0.04) * 1.42, (bx / 2 + 0.04) * 1.42, 1); lash.rotation.set(0, Math.PI / 2, Math.PI / 4);
    // a square lashing round the block's cross-section
    const sq = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.022, 5, 4), rope);
    sq.rotation.set(0, Math.PI / 2, Math.PI / 4); sq.scale.set(by * 1.02, bx * 1.02, 1);
    sq.position.set(0, 0.28 + by / 2, z - 0.1);
    g.add(sq);
  }
  shadowed(g);
  g.userData.front = new THREE.Vector3(0, 0.35, L / 2 + 0.1);
  return { group: g, block };
}

/** A rope as a tube through points (rebuilt when they move). */
export class Rope {
  constructor(mat, r = 0.028) { this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat); this.r = r; this.mesh.castShadow = true; }
  set(points) {
    const curve = new THREE.CatmullRomCurve3(points);
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(curve, Math.max(8, points.length * 4), this.r, 5, false);
  }
}

/** Water poured from a jar: a falling stream of drops (points), and the dark wet patch is the ground's job. */
export function buildPour(P) {
  const n = 220;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 }, uCol: { value: new THREE.Color('#CFE6F2') } },
    vertexShader: `attribute float aA; varying float vA; uniform float uPx;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * 1100. * 0.07 / -mv.z; vA = aA; }`,
    fragmentShader: `varying float vA; uniform vec3 uCol; void main(){ vec2 d = gl_PointCoord - .5; float a = smoothstep(0.5, 0.2, length(d)) * vA; gl_FragColor = vec4(uCol * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const jar = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.13, 0.02], [0.2, 0.18], [0.19, 0.34], [0.1, 0.46], [0.08, 0.52], [0.1, 0.56]].map(([r, y]) => new THREE.Vector2(r, y)), 16), std('#A2643F', 0.7));
  jar.castShadow = true;
  /** lip: world position of the jar's mouth; dir: pouring direction (horizontal); amt 0..1; t: time */
  function update(t, lip, dir, amt) {
    const p = geo.attributes.position.array, a = geo.attributes.aA.array;
    for (let i = 0; i < n; i++) {
      const life = 0.55, age = ((t * 1.0 + i / n * life) % life);
      const v0 = 1.0 + 0.25 * ((i * 37) % 11) / 11;
      const x = lip.x + dir.x * v0 * age + ((i * 13) % 7 - 3) * 0.004;
      const z = lip.z + dir.z * v0 * age + ((i * 17) % 7 - 3) * 0.004;
      const y = lip.y - 4.9 * age * age;
      p[i * 3] = x; p[i * 3 + 1] = Math.max(y, lip.y - 3); p[i * 3 + 2] = z;
      a[i] = amt * (y > lip.y - 1.7 ? 1.0 : 0);
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.aA.needsUpdate = true;
  }
  return { pts, jar, update, mat };
}

/** The ridge of dry sand that heaps up in front of each runner (amount 0..1). */
export function buildBerm(P) {
  const g = new THREE.Group();
  const mat = std(P.sand, 1.0);
  for (const sx of [-0.62, 0.62]) {
    const geo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const m = new THREE.Mesh(geo, mat); m.position.x = sx; m.receiveShadow = true; m.castShadow = true;
    g.add(m);
  }
  g.userData.set = (k) => { g.children.forEach((m) => m.scale.set(0.4 * k + 0.001, 0.26 * k + 0.001, 0.62 * k + 0.001)); g.visible = k > 0.02; };
  return g;
}

// ------------------------------------------------------------------ boats
export function buildBoat(P, { L = 22, cargo = 3, sail = true } = {}) {
  const g = new THREE.Group();
  const wood = woodMaterial(P);
  // hull: a lofted shell, the ends swept up (papyriform), length along +z
  const nu = 28, nv = 10, pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu * 2 - 1;                                   // -1 stern .. +1 bow
    const beam = 2.3 * Math.pow(1 - Math.pow(Math.abs(u), 2.2), 0.6);
    const sheer = 1.5 + 2.2 * Math.pow(Math.abs(u), 3.2);
    const keel = 0.25 * u * u;
    for (let j = 0; j <= nv; j++) {
      const v = j / nv * Math.PI;                               // 0..pi: one gunwale, the keel, the other
      const x = Math.cos(v) * beam, y = keel + (sheer - keel) * (1 - Math.sin(v)) * 0.55 + (1 - Math.sin(v)) * 0.0;
      const yy = Math.sin(v) < 0.02 ? sheer : keel + (sheer - keel) * (1 - Math.pow(Math.sin(v), 0.7));
      pos.push(x, yy, u * L / 2);
      if (i < nu && j < nv) { const a = i * (nv + 1) + j; idx.push(a, a + nv + 1, a + 1, a + 1, a + nv + 1, a + nv + 2); }
    }
  }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setIndex(idx); hg.computeVertexNormals();
  const hullMat = wood.clone(); hullMat.side = THREE.DoubleSide; hullMat.onBeforeCompile = wood.onBeforeCompile;
  const hull = new THREE.Mesh(hg, hullMat); g.add(hull);
  // deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, L * 0.72), wood); deck.position.y = 1.35; g.add(deck);
  // cargo: white blocks
  const blk = stoneMaterial(P, P.casing, { rough: 0.55 });
  for (let i = 0; i < cargo; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.7), blk);
    b.position.set((i % 2 ? 0.8 : -0.8) * (cargo > 2 ? 1 : 0), 1.92, -L * 0.18 + Math.floor(i / 2) * 2.3 + (cargo > 2 ? 0 : i * 2.2));
    b.rotation.y = (i - 1) * 0.04;
    g.add(b);
  }
  // bipod mast and the tall sail
  if (sail) {
    const pole = std('#5C3F26', 0.8);
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 11.5, 6), pole);
      m.position.set(sx * 0.9, 1.35 + 5.6, L * 0.12); m.rotation.z = -sx * 0.09; g.add(m);
    }
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6.4, 6), pole); yard.rotation.z = Math.PI / 2; yard.position.set(0, 12.1, L * 0.12 + 0.25); g.add(yard);
    const boom = yard.clone(); boom.position.y = 3.4; g.add(boom);
    const sg = new THREE.PlaneGeometry(6.2, 8.6, 8, 8);
    const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / 3.1, y = sp.getY(i) / 4.3; sp.setZ(i, 0.9 * (1 - x * x) * (1 - y * y * 0.6)); }
    sg.computeVertexNormals();
    const sailM = std(P.linen, 0.95, { side: THREE.DoubleSide });
    const sailMesh = new THREE.Mesh(sg, sailM); sailMesh.position.set(0, 7.75, L * 0.12 + 0.35); g.add(sailMesh);
  }
  // steering oars at the stern
  const oarM = std('#6B4A2C', 0.8);
  for (const sx of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 5), oarM);
    o.position.set(sx * 1.2, 1.8, -L * 0.42); o.rotation.set(0.9, 0, sx * 0.25); g.add(o);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.5), oarM); blade.position.set(sx * 1.75, -0.2, -L * 0.42 - 2.1); blade.rotation.x = 0.9; g.add(blade);
  }
  shadowed(g);
  return g;
}

// ------------------------------------------------------------------ the diary (Papyrus Jarf A/B, stylised)
export function papyrusTexture(P) {
  const W = 2048, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // fibres: the two crossed layers of papyrus strips
  x.fillStyle = P.papyrus; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 520; i++) { x.fillStyle = `rgba(${120 + r() * 60},${90 + r() * 50},${40 + r() * 30},${0.05 + r() * 0.07})`; x.fillRect(0, r() * H, W, 1 + r() * 4); }
  for (let i = 0; i < 380; i++) { x.fillStyle = `rgba(${150 + r() * 40},${110 + r() * 40},${50 + r() * 30},${0.04 + r() * 0.05})`; x.fillRect(r() * W, 0, 1 + r() * 3, H); }
  // stains and worn edges
  for (let i = 0; i < 40; i++) { const g = x.createRadialGradient(r() * W, r() * H, 0, 0, 0, 0); }
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(90,60,25,${0.04 + r() * 0.05})`; x.beginPath(); x.ellipse(r() * W, r() * H, 30 + r() * 120, 20 + r() * 70, r() * 3, 0, 7); x.fill(); }
  // the logbook's grid: a header band and day columns, written in hieratic (stylised strokes)
  x.strokeStyle = 'rgba(30,20,12,0.75)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(60, 170); x.lineTo(W - 60, 170); x.stroke();
  x.beginPath(); x.moveTo(60, 230); x.lineTo(W - 60, 230); x.stroke();
  const cols = 15;
  for (let k = 0; k <= cols; k++) { const cx = 60 + k * (W - 120) / cols; x.beginPath(); x.moveTo(cx, 230); x.lineTo(cx + (r() - 0.5) * 6, H - 70); x.stroke(); }
  const glyph = (gx, gy, sz, red) => {
    x.strokeStyle = red ? 'rgba(170,40,25,0.9)' : 'rgba(25,16,10,0.88)';
    x.lineWidth = sz * (0.14 + r() * 0.08); x.lineCap = 'round';
    const k = 1 + Math.floor(r() * 3);
    for (let i = 0; i < k; i++) {
      x.beginPath();
      const a = gx + (r() - 0.5) * sz, b = gy + (r() - 0.5) * sz;
      x.moveTo(a, b);
      x.bezierCurveTo(a + (r() - 0.5) * sz * 1.4, b + (r() - 0.3) * sz, a + (r() - 0.5) * sz * 1.4, b + r() * sz, a + (r() - 0.5) * sz, b + sz * (0.4 + r() * 0.6));
      x.stroke();
      if (r() < 0.3) { x.beginPath(); x.arc(a + sz * 0.3, b - sz * 0.2, sz * 0.08, 0, 7); x.fillStyle = x.strokeStyle; x.fill(); }
    }
  };
  // header line (red rubric first, as dates were)
  for (let gx = 90; gx < W - 90; gx += 34 + r() * 16) glyph(gx, 110 + (r() - 0.5) * 10, 34, gx < 400);
  for (let k = 0; k < cols; k++) {
    const cx = 60 + (k + 0.5) * (W - 120) / cols;
    glyph(cx, 200, 26, true);
    for (let gy = 270; gy < H - 110; gy += 40 + r() * 18) if (r() < 0.86) glyph(cx + (r() - 0.5) * 30, gy, 30, false);
  }
  // torn edges: darken the borders a little
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(70,45,15,0.35)'); gr.addColorStop(0.08, 'rgba(0,0,0,0)'); gr.addColorStop(0.92, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(70,45,15,0.4)');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

/** A sheet that unrolls from a roll at its right end: u = 0 rolled up, 1 flat. Width w, height h. */
export function buildPapyrus(P, { w = 2.4, h = 1.05 } = {}) {
  const tex = papyrusTexture(P);
  const U = { uUnroll: { value: 1 }, uW: { value: w }, uGlow: { value: 0 }, map: { value: tex } };
  const geo = new THREE.PlaneGeometry(w, h, 160, 4);
  geo.translate(w / 2, 0, 0);                                     // left edge at x = 0
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uUnroll: U.uUnroll, uW: U.uW, uGlow: U.uGlow });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uUnroll, uW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // beyond the unrolled length the sheet wraps round a roll of radius r (spiralling inward)
        float L = uW * uUnroll, r = 0.045;
        if (transformed.x > L) {
          float s = transformed.x - L;
          float rr = r * (1. - 0.25 * min(s / uW, 1.));
          float an = s / rr;
          transformed.x = L + sin(an) * rr;
          transformed.z = rr - cos(an) * rr;
        }
        // a gentle sag along its length
        transformed.z += 0.02 * sin(position.x / uW * 3.14159);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uGlow * 0.35;');
  };
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return { mesh: m, U };
}

// ------------------------------------------------------------------ a credit card (generic)
export function buildCard() {
  const c = document.createElement('canvas'); c.width = 856; c.height = 540;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 856, 540); g.addColorStop(0, '#1F3E7A'); g.addColorStop(1, '#0E1E3F');
  x.fillStyle = g; x.fillRect(0, 0, 856, 540);
  x.fillStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.ellipse(700, 120, 380, 260, 0.4, 0, 7); x.fill();
  // chip
  const cg = x.createLinearGradient(90, 200, 210, 290); cg.addColorStop(0, '#E8C978'); cg.addColorStop(1, '#B08A3A');
  x.fillStyle = cg; x.fillRect(90, 200, 120, 92);
  x.strokeStyle = 'rgba(90,60,20,0.6)'; x.lineWidth = 3; x.strokeRect(90, 200, 120, 92); x.beginPath(); x.moveTo(150, 200); x.lineTo(150, 292); x.moveTo(90, 246); x.lineTo(210, 246); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = '600 46px monospace';
  x.fillText('0000  0000  0000  0000', 90, 400);
  x.font = '600 30px monospace'; x.fillText('CARDHOLDER', 90, 470);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const shape = new THREE.Shape();
  const w = 0.0856, h = 0.054, rr = 0.003;
  shape.moveTo(-w / 2 + rr, -h / 2); shape.lineTo(w / 2 - rr, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr);
  shape.lineTo(w / 2, h / 2 - rr); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2); shape.lineTo(-w / 2 + rr, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr); shape.lineTo(-w / 2, -h / 2 + rr); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.00076, bevelEnabled: false, curveSegments: 6 });
  // map the face UVs to the card
  const uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  const face = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const m = new THREE.Mesh(geo, face);
  m.castShadow = true;
  return m;
}

// ------------------------------------------------------------------ bread and beer
export function buildRations(P) {
  const g = new THREE.Group();
  const crusty = (base, dark) => {
    const m = std(base, 0.82);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.cDark = { value: new THREE.Color(dark) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vB;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvB = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vB; uniform vec3 cDark;\n${NOISE}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 q = vec2(atan(vB.z, vB.x) * 3., vB.y * 18.);
          float n = fbm(q * 1.5), cr = smoothstep(0.55, 0.8, fbm(q * 4. + 3.));
          float top = smoothstep(0.0, 0.14, vB.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, cDark, 0.35 * top + 0.35 * cr) * (0.85 + 0.25 * n);`);
    };
    return m;
  };
  const bread = crusty('#D6A25E', '#7E4A22'), flatB = crusty('#C98F4C', '#8A5428');
  const jarM = stoneMaterial(P, '#B0704A', { rough: 0.7, scale: 9 });
  const mudM = std('#5E4532', 0.95);
  // a woven reed mat
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#C7A46C'), roughness: 0.95 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vR;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvR = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vR;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = vR.xz * 60.; float w = step(0.5, fract(floor(q.x) * 0.5 + floor(q.y) * 0.5));
        float s = w > 0.5 ? sin(fract(q.x) * 3.14) : sin(fract(q.y) * 3.14);
        diffuseColor.rgb *= 0.72 + 0.3 * s;`);
  };
  const reed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.012, 0.72), mat); reed.position.y = 0.006; g.add(reed);
  const loaves = [], jars = [];
  // tall conical loaves baked in bell-shaped moulds (bedja), and round flat ones
  for (let i = 0; i < 4; i++) {
    const prof = [[0, 0], [0.1, 0.0], [0.11, 0.03], [0.085, 0.14], [0.05, 0.24], [0.015, 0.29], [0, 0.295]].map(([r, y]) => new THREE.Vector2(r, y));
    const l = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), bread);
    l.position.set(-0.62 + i * 0.2, 0.012, -0.12 + 0.12 * (i % 2)); l.rotation.set((i - 1.5) * 0.05, i, (i - 1.5) * 0.07); g.add(l); loaves.push(l);
  }
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 10), flatB); f.scale.y = 0.38;
    f.position.set(-0.5 + i * 0.22, 0.05, 0.2 + 0.02 * i); g.add(f); loaves.push(f);
  }
  // beer jars: tall, round-bellied, with mud stoppers
  const prof = [[0, 0.02], [0.05, 0.0], [0.12, 0.08], [0.155, 0.24], [0.14, 0.42], [0.075, 0.54], [0.065, 0.6], [0.08, 0.62], [0, 0.62]].map(([r, y]) => new THREE.Vector2(r, y));
  for (let i = 0; i < 3; i++) {
    const j = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), jarM);
    j.position.set(0.28 + i * 0.3, 0.012, -0.1 + (i % 2) * 0.18); j.rotation.z = (i - 1) * 0.03;
    const st = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mudM); st.scale.y = 0.55; st.position.y = 0.63; j.add(st);
    g.add(j); jars.push(j);
  }
  shadowed(g);
  return { group: g, loaves, jars };
}

// ------------------------------------------------------------------ the workers' town and their cemetery
export function buildTown(P, heightAt, rnd) {
  const g = new THREE.Group();
  const mud = std('#A88763', 0.95);
  const mudL = std('#BFA27C', 0.95);
  const roof = std('#C9B08A', 1);
  const door = std('#2A1E15', 1);
  // long galleries in rows (Heit el-Ghurab), a walled block
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const x = 360 + c * 13, z = 205 + r * 22, y = heightAt(x, z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 17), r % 2 ? mud : mudL);
    b.position.set(x, y + 1.6, z); g.add(b);
    const rf = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.2, 16.6), roof); rf.position.set(x, y + 3.05, z); g.add(rf);
    for (const sx of [-1, 1]) { const pp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 17), r % 2 ? mud : mudL); pp.position.set(x + sx * 4.3, y + 3.45, z); g.add(pp); }
    for (let d = 0; d < 3; d++) { const dr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 1.0), door); dr.position.set(x + 4.52, y + 0.95, z - 5 + d * 5); g.add(dr); }
  }
  // bakeries with their ovens (smoke is a particle job)
  for (let i = 0; i < 3; i++) {
    const x = 440 + i * 14, z = 222, y = heightAt(x, z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(10, 2.6, 8), mudL); b.position.set(x, y + 1.3, z); g.add(b);
    const ov = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mud); ov.position.set(x + 2, y + 2.6, z); g.add(ov);
  }
  // enclosure wall
  const wall = (x, z, sx, sz) => { const y = heightAt(x, z); const w = new THREE.Mesh(new THREE.BoxGeometry(sx, 4, sz), mud); w.position.set(x, y + 2, z); g.add(w); };
  wall(396, 191, 104, 2); wall(396, 293, 104, 2); wall(344, 242, 2, 104); wall(470, 242, 2, 66);
  // the cemetery on the slope below the plateau: small tombs, some with little pyramids or domes
  const tomb = std('#B39A73', 0.9), tombW = std('#D8CCB4', 0.85);
  for (let i = 0; i < 46; i++) {
    const x = 262 + rnd() * 70, z = 150 + rnd() * 80, y = heightAt(x, z);
    const k = rnd();
    let m;
    if (k < 0.45) { m = new THREE.Mesh(new THREE.BoxGeometry(2.2 + rnd() * 2, 1.4 + rnd(), 3 + rnd() * 2.5), tomb); m.position.set(x, y + 0.6, z); }
    else if (k < 0.75) { m = new THREE.Mesh(new THREE.ConeGeometry(1.4 + rnd(), 2.4 + rnd() * 1.5, 4), tombW); m.rotation.y = Math.PI / 4; m.position.set(x, y + 1.2, z); }
    else { m = new THREE.Mesh(new THREE.SphereGeometry(1.1 + rnd() * 0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), tomb); m.position.set(x, y - 0.1, z); }
    m.rotation.y += (rnd() - 0.5) * 0.2;
    g.add(m);
  }
  shadowed(g);
  return g;
}

// ------------------------------------------------------------------ a flying saucer (it didn't build anything)
export function buildUFO() {
  const g = new THREE.Group();
  const hull = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#B8C2CC'), metalness: 0.9, roughness: 0.25, clearcoat: 1 });
  const prof = [[0, -1.2], [3.5, -0.9], [8, 0], [3.8, 0.9], [2.6, 1.3], [0, 1.4]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 48), hull));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#9FE3FF'), transmission: 0.0, roughness: 0.05, metalness: 0.1, emissive: new THREE.Color('#2A8FB8'), emissiveIntensity: 0.6 }));
  dome.position.y = 1.2; g.add(dome);
  const lights = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE08A') }));
    l.position.set(Math.cos(a) * 6.2, 0.05, Math.sin(a) * 6.2); g.add(l); lights.push(l);
  }
  shadowed(g);
  return { group: g, lights };
}
