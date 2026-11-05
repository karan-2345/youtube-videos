// scenes/props.js -- the other worlds: a street at dusk with a car, a desk fan with a phone, a close-up of guitar strings.
// Everything neutral (greys, metal, glass); the only colour in the film is the amber of the scan line and its capture.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makePropeller, noMask } from './engine.js';

const ni = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
const merge = (list) => mergeGeometries(list.map(ni));

// ---------------------------------------------------------------- the street
export function makeStreet(env) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16181b);            // dusk sky, nearly neutral
  scene.environment = env; scene.environmentIntensity = 0.35;
  scene.add(new THREE.HemisphereLight(0x8a9099, 0x101012, 0.9));
  const sun = new THREE.DirectionalLight(0xdfe3e8, 0.55); sun.position.set(-6, 8, 10); scene.add(sun);
  // road (x along the street, the camera looks down -z), far kerb and pavement, building fronts
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.85 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 30).rotateX(-Math.PI / 2), asphalt); road.position.set(0, 0, -6); scene.add(road);
  const marks = [];
  for (let i = -12; i <= 12; i++) marks.push(new THREE.PlaneGeometry(2.2, 0.14).rotateX(-Math.PI / 2).translate(i * 4.2, 0.005, -3.2));
  scene.add(new THREE.Mesh(merge(marks), new THREE.MeshStandardMaterial({ color: 0x9a9b9c, roughness: 0.7 })));
  const kerb = merge([new THREE.BoxGeometry(80, 0.16, 0.3).translate(0, 0.08, -7.0), new THREE.BoxGeometry(80, 0.15, 3).translate(0, 0.075, -8.6)]);
  scene.add(new THREE.Mesh(kerb, new THREE.MeshStandardMaterial({ color: 0x4a4b4d, roughness: 0.9 })));
  // buildings: blocks with a window grid drawn into an emissive texture (lit and dark windows, all neutral)
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  const g2 = cv.getContext('2d'); g2.fillStyle = '#000'; g2.fillRect(0, 0, 512, 512);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { if (rnd() < 0.42) { const v = 150 + Math.floor(rnd() * 70); g2.fillStyle = `rgb(${v},${v},${v - 6})`; g2.fillRect(c * 64 + 14, r * 64 + 12, 36, 40); } }
  const winTex = new THREE.CanvasTexture(cv); winTex.colorSpace = THREE.SRGBColorSpace; winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  const xs = [-14, -7.5, -1.5, 5, 11.5, 18];
  xs.forEach((x, i) => {
    const w = 6.2, h = 9 + (i % 3) * 3.5;
    const t = winTex.clone(); t.repeat.set(w / 5, h / 5); t.needsUpdate = true;
    const m = new THREE.MeshStandardMaterial({ color: [0x3a3b3e, 0x323336, 0x414245][i % 3], roughness: 0.9, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), m); b.position.set(x, h / 2, -12.2); scene.add(b);
  });
  // street lamps
  const lamps = [];
  for (const x of [-9, 3, 15]) { lamps.push(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 10).translate(x, 2.6, -7.4)); lamps.push(new THREE.BoxGeometry(0.9, 0.08, 0.2).translate(x + 0.4, 5.2, -7.3)); }
  scene.add(new THREE.Mesh(merge(lamps), new THREE.MeshStandardMaterial({ color: 0x202124, roughness: 0.5, metalness: 0.6 })));
  const heads = [];
  for (const x of [-9, 3, 15]) heads.push(new THREE.BoxGeometry(0.42, 0.04, 0.16).translate(x + 0.65, 5.15, -7.3));
  scene.add(new THREE.Mesh(merge(heads), new THREE.MeshBasicMaterial({ color: 0xe8e6e0 })));
  for (const x of [-9, 3, 15]) { const p = new THREE.PointLight(0xf2efe8, 9, 14, 2); p.position.set(x + 0.65, 5.0, -7.0); scene.add(p); }
  const car = makeCar();
  car.position.set(0, 0, -2.0);
  scene.add(car);
  return { scene, car };
}

// a saloon car built from a side profile (extruded), glass, four wheels with spokes
export function makeCar() {
  const g = new THREE.Group();
  const L = 4.5, Wd = 1.8;
  const prof = new THREE.Shape();
  const P = [[-2.25, 0.32], [2.25, 0.32], [2.3, 0.55], [2.2, 0.78], [1.15, 0.92], [0.55, 1.42], [-0.9, 1.45], [-1.6, 1.0], [-2.2, 0.95], [-2.3, 0.6]];
  prof.moveTo(...P[0]); for (const p of P.slice(1)) prof.lineTo(...p); prof.closePath();
  const body = new THREE.ExtrudeGeometry(prof, { depth: Wd, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 4 });
  body.translate(0, 0, -Wd / 2);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x8d9095, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  g.add(new THREE.Mesh(body, paint));
  // side glass (slightly proud of the body on the camera side)
  const win = new THREE.Shape(); const Q = [[1.05, 0.98], [0.5, 1.36], [-0.85, 1.38], [-1.5, 1.0]];
  win.moveTo(...Q[0]); for (const q of Q.slice(1)) win.lineTo(...q); win.closePath();
  const glassG = new THREE.ShapeGeometry(win).translate(0, 0, Wd / 2 + 0.085);
  const pillar = new THREE.PlaneGeometry(0.09, 0.42).translate(-0.12, 1.17, Wd / 2 + 0.09);
  g.add(new THREE.Mesh(glassG, new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, metalness: 0.2, roughness: 0.05 })));
  g.add(new THREE.Mesh(pillar, new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.6 })));
  // door lines and lights
  const trim = merge([new THREE.BoxGeometry(0.02, 0.55, 0.02).translate(0.28, 0.66, Wd / 2 + 0.09), new THREE.BoxGeometry(0.02, 0.5, 0.02).translate(-0.95, 0.68, Wd / 2 + 0.09),
    new THREE.BoxGeometry(3.6, 0.025, 0.02).translate(-0.1, 0.62, Wd / 2 + 0.095)]);
  g.add(new THREE.Mesh(trim, new THREE.MeshStandardMaterial({ color: 0x2b2c2f, roughness: 0.5 })));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.5).translate(2.32, 0.66, 0.55), new THREE.MeshBasicMaterial({ color: 0xf4f2ea })));
  // wheels: tyre + rim with five spokes, each wheel turns (rolling shutter bends spokes too)
  const tyre = new THREE.TorusGeometry(0.27, 0.085, 10, 32);
  const rimParts = [new THREE.CylinderGeometry(0.2, 0.2, 0.06, 28).rotateX(Math.PI / 2).translate(0, 0, -0.02)];
  for (let s = 0; s < 5; s++) rimParts.push(new THREE.BoxGeometry(0.05, 0.36, 0.03).translate(0, 0.0, 0.03).rotateZ(s * Math.PI * 2 / 5));
  rimParts.push(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16).rotateX(Math.PI / 2).translate(0, 0, 0.04));
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0f0f10, roughness: 0.8 });
  const alloy = new THREE.MeshPhysicalMaterial({ color: 0xbfc2c6, metalness: 1, roughness: 0.25 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), new THREE.MeshStandardMaterial({ color: 0x050505 }));
  g.userData.wheels = [];
  for (const x of [-1.45, 1.4]) for (const z of [Wd / 2 - 0.05, -Wd / 2 + 0.05]) {
    const w = new THREE.Group(); w.position.set(x, 0.36, z);
    w.add(new THREE.Mesh(tyre, rubber));
    const rim = new THREE.Mesh(merge(rimParts), alloy); w.add(rim);
    const d = disc.clone(); d.position.z = -0.04; w.add(d);
    if (z < 0) w.rotation.y = Math.PI;
    g.add(w); g.userData.wheels.push(w);
  }
  g.drive = (x) => { g.position.x = x; for (const w of g.userData.wheels) w.rotation.z = -x / 0.36 * (w.rotation.y ? -1 : 1); };
  return g;
}

// ---------------------------------------------------------------- the desk fan and the phone
export function makeDesk(env) {
  const scene = new THREE.Scene();
  scene.environment = env; scene.environmentIntensity = 2.2;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.95 }));
  back.position.z = -1.6; back.material.envMapIntensity = 0.12; scene.add(back);
  
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(20, 6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x141415, roughness: 0.7 }));
  desk.position.y = -0.42; desk.material.envMapIntensity = 0.3; scene.add(desk);
  const key = new THREE.SpotLight(0xfff4ea, 1.1, 0, 0.5, 1, 2); key.position.set(-1.2, 1.6, 2.4); key.target.position.set(0, -0.1, -0.6);
  scene.add(key, key.target);
  // the fan: the same three-blade rotor at desk-fan size, in a wire guard on a stand
  const fan = makePropeller({ R: 0.15 });
  fan.userData.stat.visible = false;                         // the fan has its own stand
  const rings = [];
  // open front (no grille), so the blades read clearly on the phone
  rings.push(new THREE.TorusGeometry(0.17, 0.004, 8, 72).translate(0, 0, 0.0));
  for (let s = 0; s < 12; s++) rings.push(new THREE.CylinderGeometry(0.0018, 0.0018, 0.17, 4).translate(0, 0.085, -0.06).rotateZ(s * Math.PI / 6));
  const wire = new THREE.MeshPhysicalMaterial({ color: 0x8a8c90, metalness: 1, roughness: 0.45 });
  const guard = new THREE.Mesh(merge(rings), noMask(wire));
  fan.add(guard);
  const standM = noMask(new THREE.MeshPhysicalMaterial({ color: 0x2a2b2e, metalness: 0.7, roughness: 0.4 }));
  const stand = merge([new THREE.CylinderGeometry(0.06, 0.07, 0.12, 32).rotateX(Math.PI / 2).translate(0, 0, -0.08),
    new THREE.CylinderGeometry(0.016, 0.016, 0.3, 12).translate(0, -0.15, -0.1), new THREE.CylinderGeometry(0.11, 0.12, 0.025, 40).translate(0, -0.41, -0.1)]);
  fan.add(new THREE.Mesh(stand, standM));
  scene.add(fan);
  // the phone: a rounded slab, a lens, and a screen that shows whatever the phone's camera makes of the fan
  const phone = new THREE.Group();
  const pw = 0.072, ph = 0.152, pd = 0.008;
  const sh = new THREE.Shape(); const rr = 0.01;
  sh.moveTo(-pw / 2 + rr, -ph / 2); sh.lineTo(pw / 2 - rr, -ph / 2); sh.quadraticCurveTo(pw / 2, -ph / 2, pw / 2, -ph / 2 + rr);
  sh.lineTo(pw / 2, ph / 2 - rr); sh.quadraticCurveTo(pw / 2, ph / 2, pw / 2 - rr, ph / 2); sh.lineTo(-pw / 2 + rr, ph / 2);
  sh.quadraticCurveTo(-pw / 2, ph / 2, -pw / 2, ph / 2 - rr); sh.lineTo(-pw / 2, -ph / 2 + rr); sh.quadraticCurveTo(-pw / 2, -ph / 2, -pw / 2 + rr, -ph / 2);
  const slab = new THREE.ExtrudeGeometry(sh, { depth: pd, bevelEnabled: true, bevelSize: 0.0015, bevelThickness: 0.0015, bevelSegments: 3, curveSegments: 8 });
  slab.translate(0, 0, -pd / 2);
  phone.add(new THREE.Mesh(slab, new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, metalness: 0.8, roughness: 0.35 })));
  const scrW = pw - 0.006, scrH = ph - 0.006;
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(scrW, scrH), screenMat);
  screen.position.z = pd / 2 + 0.0017;                 // the screen faces +z (the viewer)
  phone.add(screen);
  const pcam = new THREE.PerspectiveCamera(27, scrW / scrH, 0.05, 20);   // looks along -z: out of the phone's back
  pcam.position.set(0, 0, -pd / 2);
  phone.add(pcam);
  scene.add(phone);
  return { scene, fan, phone, pcam, screen, screenMat, scr: [scrW, scrH] };
}

// ---------------------------------------------------------------- guitar strings, close up
export function makeGuitar(env) {
  const scene = new THREE.Scene();
  scene.environment = env; scene.environmentIntensity = 1.1;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.6 }));
  top.position.z = -0.012; top.material.envMapIntensity = 0.08; scene.add(top);
  const key = new THREE.SpotLight(0xfff4ea, 0.8, 0, 0.7, 1, 2); key.position.set(-0.25, 0.35, 0.6); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  // a pickup across the strings: black cover with six pole pieces
  const pick = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.018, 0.008).translate(0, -0.035, -0.006), new THREE.MeshPhysicalMaterial({ color: 0x111113, roughness: 0.4 }));
  scene.add(pick);
  const gauges = [0.00117, 0.00091, 0.00066, 0.00043, 0.00033, 0.00025];    // low E ... high e (m)
  const spacing = 0.0105;
  const strings = [];
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd8d9dc, metalness: 1, roughness: 0.28 });
  const poles = [];
  gauges.forEach((d, i) => {
    const x = (i - 2.5) * spacing;
    poles.push(new THREE.CylinderGeometry(0.0022, 0.0022, 0.003, 16).rotateX(Math.PI / 2).translate(x, -0.035, -0.0005));
    const geo = new THREE.CylinderGeometry(d / 2, d / 2, 0.4, 12, 200, true);
    const mat = steel.clone();
    if (i === 0) {
      mat.userData.u = { uDisp: { value: 0 } };
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uDisp = mat.userData.u.uDisp;
        sh.vertexShader = 'uniform float uDisp;\n' + sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n  // fundamental mode: the visible section sits near the middle of a 648 mm string\n  float s = 0.5 + position.y / 0.648;\n  transformed.x += uDisp * sin(3.14159265 * s);');
      };
      mat.customProgramCacheKey = () => 'lowE';
    }
    const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, 0.004);
    m.frustumCulled = false;
    scene.add(m); strings.push(m);
  });
  scene.add(new THREE.Mesh(merge(poles), new THREE.MeshPhysicalMaterial({ color: 0x8e9096, metalness: 1, roughness: 0.3 })));
  return { scene, strings, lowE: strings[0] };
}
