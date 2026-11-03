// scenes/3d/lib/table.js -- the card table every shuffle scene shares: green felt under a warm lamp, and a deck of
// 52 cards (63 x 88 mm, units = cm) whose backs are tinted by each card's starting position, so the order a
// shuffle leaves behind is visible at a glance. Everything is a pure function of the scene data and t.
import * as THREE from 'three';
import { rng } from '/scenes/web/runtime.js';

export const CW = 6.3, CH = 8.8, CT = 0.035;          // card width, height, thickness (cm)

function feltCanvas(pal, seed = 4) {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = rng(seed);
  g.fillStyle = pal.felt; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 90000; i++) {                      // fibres
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.025 + r() * 0.035})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1);
  }
  return cv;
}

function backCanvas(seed = 7) {
  // white card back with a fine diamond lattice and a border; the material colour tints it per card
  const W = 256, H = 358, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f2f2f2'; g.beginPath(); g.roundRect(12, 12, W - 24, H - 24, 10); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
  for (let k = -H; k < W + H; k += 16) {
    g.beginPath(); g.moveTo(k, 12); g.lineTo(k + H, H + 12); g.stroke();
    g.beginPath(); g.moveTo(k + H, 12); g.lineTo(k, H + 12); g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 4; g.beginPath(); g.roundRect(12, 12, W - 24, H - 24, 10); g.stroke();
  return cv;
}

function roundedCard() {
  const w = CW, h = CH, r = 0.35;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: CT, bevelEnabled: false, curveSegments: 4 });
  // UVs from x, y (the extrude generator's are world-scaled)
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[2 * i] = p.getX(i) / w + 0.5; uv[2 * i + 1] = p.getY(i) / h + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.rotateX(-Math.PI / 2);                                // lie flat, back facing up (+Y), long side along -Z
  return g;
}

export function buildTable(scene, pal, centre, { lamp = 3.4 } = {}) {
  scene.background = new THREE.Color(pal.bg);
  const tex = new THREE.CanvasTexture(feltCanvas(pal));
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 10);
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200),
                              new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true;
  scene.add(felt);
  const key = new THREE.SpotLight(0xfff0dc, lamp, 0, 30 * Math.PI / 180, 0.8, 0);
  key.position.copy(centre).add(new THREE.Vector3(-60, 220, -80));
  key.target.position.copy(centre);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 100; key.shadow.camera.far = 400; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0xc8d6e6, 0x0b1a14, 0.5));
  return { key, felt };
}

/** 52 card meshes, back up, each tinted by its starting position (colors[i] for card i). */
export function buildDeck(scene, colors) {
  const geom = roundedCard();
  const backTex = new THREE.CanvasTexture(backCanvas()); backTex.colorSpace = THREE.SRGBColorSpace;
  const edge = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.8 });
  const cards = colors.map((c) => {
    const back = new THREE.MeshStandardMaterial({ map: backTex, color: new THREE.Color(c), roughness: 0.55 });
    // ExtrudeGeometry groups: 0 = the two caps, 1 = the side wall
    const m = new THREE.Mesh(geom, [back, edge]);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    return m;
  });
  return cards;
}
