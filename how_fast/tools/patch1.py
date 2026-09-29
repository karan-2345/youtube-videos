"""Review round 1 fixes for web/main.js (exact-string replacements, each must match once)."""
import sys

P = "web/main.js"
s = open(P, encoding="utf-8").read()


def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f"expected 1 match, got {n}: {old[:70]!r}")
    s = s.replace(old, new)


# softer ocean glint
rep("float spec = pow(max(dot(N, Hh), 0.0), 60.0) * water * 0.7;", "float spec = pow(max(dot(N, Hh), 0.0), 150.0) * water * 0.32;")
# smaller, dimmer outer sun glow (it hazed the whole frame during the pull-back)
rep("opacity: 0.35 }));\n  g2.scale.set(SUN_R * 22, SUN_R * 22, 1);", "opacity: 0.16 }));\n  g2.scale.set(SUN_R * 13, SUN_R * 13, 1);")
# globe a little lower so the pole label clears the counter
rep("const tgtA = earthCentreA.clone().add(new THREE.Vector3(0, -0.24, 0));", "const tgtA = earthCentreA.clone().add(new THREE.Vector3(0, -0.12, 0));")
rep("const yHook = 470, yMain = 424;", "const yHook = 470, yMain = 414;")
# orbit view: camera on Earth's side, a bit farther out
rep("const dirB = new THREE.Vector3(Math.cos(EARTH_THETA0 - 0.9), 0, -Math.sin(EARTH_THETA0 - 0.9)).multiplyScalar(-1).add(new THREE.Vector3(0, 0.62, 0)).normalize();",
    "const dirB = new THREE.Vector3(Math.cos(EARTH_THETA0 - 0.55), 0, -Math.sin(EARTH_THETA0 - 0.55)).add(new THREE.Vector3(0, 0.6, 0)).normalize();")
rep("const dist0 = 9.0, dist1 = 64;", "const dist0 = 9.0, dist1 = 74;")
# galaxy final view: look from the Sun's side, farther out, pivot between core and Sun
rep("const dC = new THREE.Vector3(0.28, 1.0, 0.62).normalize();",
    "const el = 57 * D2R;\n    const dC = sunG0.clone().normalize().multiplyScalar(Math.cos(el)).add(new THREE.Vector3(0, Math.sin(el), 0)).normalize();")
rep("const dir = slerpDir(dB, dC, u).applyAxisAngle(up, hold * 1.1 * D2R);", "const dir = slerpDir(dB, dC, u).applyAxisAngle(up, hold * 0.8 * D2R);")
rep("const dist = Math.exp(lerp(Math.log(dist1), Math.log(40), u));", "const dist = Math.exp(lerp(Math.log(dist1), Math.log(62), u));")
rep("target = new THREE.Vector3(0, -1.6 * (1 - u), 0).lerp(galCentre.clone().add(new THREE.Vector3(0, -2.2, 0)), smooth(ramp(u, 0.35, 1)));",
    "target = new THREE.Vector3(0, -1.6 * (1 - u), 0).lerp(galCentre.clone().multiplyScalar(0.7), smooth(ramp(u, 0.35, 1)));")

# neighbour stars that stream past during the fly-out (log-spaced distances around the Sun)
rep("""  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex""", """  const sunAng0 = armBase(0, 8.2) + Math.PI / 4 + 0.15;
  const sunG0 = new THREE.Vector3(Math.cos(sunAng0) * 8.2, 0, Math.sin(sunAng0) * 8.2);
  const npos = [], ncol = [], nsz = [];
  for (let n = 0; n < 6000; n++) {
    const rr = Math.pow(10, -3.5 + r() * 3.3);
    const v = new THREE.Vector3(gauss(r), gauss(r) * 0.6, gauss(r)).normalize().multiplyScalar(rr);
    npos.push(sunG0.x + v.x, v.y, sunG0.z + v.z);
    const b = 0.45 + r() * 0.55, tint = r() < 0.3 ? [1, 0.85, 0.7] : [0.85, 0.9, 1];
    ncol.push(tint[0] * b, tint[1] * b, tint[2] * b); nsz.push(1.6 + Math.pow(r(), 4) * 3);
  }
  const ngeo = new THREE.BufferGeometry();
  ngeo.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3));
  ngeo.setAttribute('aColor', new THREE.Float32BufferAttribute(ncol, 3));
  ngeo.setAttribute('aSize', new THREE.Float32BufferAttribute(nsz, 1));
  const nmat = mat.clone(); nmat.uniforms = { uOpacity: { value: 0 }, uPx: { value: 70 } };
  const near = new THREE.Points(ngeo, nmat); near.frustumCulled = false;
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex""")
rep("const inner = new THREE.Group(); inner.add(pts); inner.add(dust); inner.add(core);", "const inner = new THREE.Group(); inner.add(pts); inner.add(dust); inner.add(core); inner.add(near);")
rep("return { group, inner, pts, mat, dust, dmat, core, sunAng, sunG };", "return { group, inner, pts, mat, dust, dmat, core, near, nmat, sunAng, sunG };")
rep("gal.mat.uniforms.uPx.value = 70; gal.dmat.uniforms.uPx.value = 70;",
    """gal.mat.uniforms.uPx.value = 70; gal.dmat.uniforms.uPx.value = 70;
  const nearIn = smooth(ramp(t, E.galaxy + 0.1, E.galaxy + 0.8));
  const nearOut = clamp((Math.log(k) - Math.log(5)) / (Math.log(50) - Math.log(5)));
  gal.nmat.uniforms.uOpacity.value = nearIn * nearOut;""")

# merry-go-round legend above the caption band
rep("g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(250, 1238, 12, 0, Math.PI * 2); g.fill();\n  text('near the middle: slow', 276, 1250,",
    "g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(250, 1148, 12, 0, Math.PI * 2); g.fill();\n  text('near the middle: slow', 276, 1160,")
rep("g.fillStyle = COL.amber; g.beginPath(); g.arc(250, 1300, 14, 0, Math.PI * 2); g.fill();\n  text('at the edge: fast', 276, 1312,",
    "g.fillStyle = COL.amber; g.beginPath(); g.arc(250, 1208, 14, 0, Math.PI * 2); g.fill();\n  text('at the edge: fast', 276, 1220,")
rep("const cx = 540, cy = 830, R = 330;", "const cx = 540, cy = 790, R = 310;")
# jet label matches the narration ("nearly twice")
rep("text(`nearly ${(F.spin_eq_kmh / F.jet_kmh).toFixed(1).replace(/\\.0$/, '')}× as fast`, 0, 0,", "text(`≈ ${(F.spin_eq_kmh / F.jet_kmh).toFixed(1)}× as fast`, 0, 0,")

# night scene: ground lower so the caption band stays clear of the lamp
rep("const hg = g.createLinearGradient(0, 1380, 0, 1600);", "const hg = g.createLinearGradient(0, 1460, 0, 1680);")
rep("g.fillStyle = hg; g.fillRect(0, 1380, W, 220);", "g.fillStyle = hg; g.fillRect(0, 1460, W, 220);")
rep("const lx = 770, ly = 1318;", "const lx = 770, ly = 1418;")
s = s.replace("g.beginPath(); g.moveTo(0, 1600); g.bezierCurveTo(260, 1520, 520, 1500, 700, 1506); g.bezierCurveTo(860, 1512, 980, 1540, W, 1560);",
              "g.beginPath(); g.moveTo(0, 1690); g.bezierCurveTo(260, 1612, 520, 1592, 700, 1598); g.bezierCurveTo(860, 1604, 980, 1632, W, 1652);")
rep("g.fillRect(764, 1330, 12, 180);\n  g.beginPath(); g.moveTo(748, 1330); g.lineTo(792, 1330); g.lineTo(784, 1306); g.lineTo(756, 1306); g.closePath(); g.fill();\n  g.fillStyle = 'rgba(255,214,140,0.95)'; g.fillRect(758, 1318, 24, 10);",
    "g.fillRect(764, 1430, 12, 175);\n  g.beginPath(); g.moveTo(748, 1430); g.lineTo(792, 1430); g.lineTo(784, 1406); g.lineTo(756, 1406); g.closePath(); g.fill();\n  g.fillStyle = 'rgba(255,214,140,0.95)'; g.fillRect(758, 1418, 24, 10);")
rep("const bx = 470, by = 1466;", "const bx = 470, by = 1556;")
rep("if (y > 1650 || x < -20 || x > W + 20) continue;", "if (y > 1700 || x < -20 || x > W + 20) continue;")
# hook note sits under the counter instead of on the bench
rep("[0.3, E.spin - 0.3, 'star motion sped up'],", "[0.3, E.spin - 0.3, 'star motion sped up', 560],")
rep("for (const [a, b, s] of items) {\n    const al = win(t, a, b, 0.4, 0.3);", "for (const [a, b, s, yy] of items) {\n    const al = win(t, a, b, 0.4, 0.3);")
rep("text(s, W / 2, 1468, { f, color: COL.grey, alpha: al * 0.9, shadow: 8 });", "text(s, W / 2, yy || 1468, { f, color: COL.grey, alpha: al * 0.9, shadow: 8 });")

# dinosaur footprint: separate toe pads, claws and a heel pad
start = s.index("function footprint(x, y, s, color) {")
end = s.index("function drawDino(")
s = s[:start] + """function footprint(x, y, s, color) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = color;
  g.beginPath(); g.moveTo(-36, 6); g.quadraticCurveTo(-44, 60, 0, 74); g.quadraticCurveTo(44, 60, 36, 6); g.quadraticCurveTo(0, -16, -36, 6); g.fill();
  const toe = (ang, len) => {
    g.save(); g.rotate(ang);
    for (let i = 0; i < 3; i++) { const yy = -24 - i * (len / 3.3); g.beginPath(); g.ellipse(0, yy, 15 - i * 2, len / 7.6, 0, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.moveTo(-9, -len + 2); g.quadraticCurveTo(0, -len - 26, 9, -len + 2); g.closePath(); g.fill();
    g.restore();
  };
  toe(-0.52, 104); toe(0, 128); toe(0.52, 104);
  g.restore();
}
""" + s[end:]
rep("footprint(540, 790, 1.15, COL.amber);", "footprint(540, 810, 1.05, COL.amber);")

# flight scene: speed label up top, window and glass re-spaced, bottle pours from the right
start = s.index("function drawFlight(t, alpha) {")
end = s.index("// ---------- marathon")
s = s[:start] + """function drawFlight(t, alpha) {
  if (alpha <= 0.002) return;
  g.save(); g.globalAlpha = alpha;
  const wall = g.createLinearGradient(0, 300, 0, 1400);
  wall.addColorStop(0, '#0C1220'); wall.addColorStop(1, '#070A12');
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  richText([{ s: 'cruising at about ', c: COL.white }, { s: `${fmt(900)} km/h`, c: COL.amber }], W / 2, 300, font(700, 40, MONO), 1, 12);
  // window
  const cx = 540, cy = 690, ww = 340, wh = 440;
  rrect(cx - ww / 2 - 32, cy - wh / 2 - 32, ww + 64, wh + 64, 190); g.fillStyle = '#161E2E'; g.fill();
  g.save();
  rrect(cx - ww / 2, cy - wh / 2, ww, wh, 160); g.clip();
  const sky = g.createLinearGradient(0, cy - wh / 2, 0, cy + wh / 2);
  sky.addColorStop(0, '#2C5D9C'); sky.addColorStop(0.55, '#7FB0E0'); sky.addColorStop(1, '#D7E7F5');
  g.fillStyle = sky; g.fillRect(cx - ww, cy - wh, ww * 2, wh * 2);
  const r = rng(99);
  for (let i = 0; i < 26; i++) {
    const baseX = r() * 1400, y = cy + 40 + r() * 190, sz = 36 + r() * 60;
    const x = ((baseX - (t * 420 * (0.6 + (y - cy) / 400))) % 1400 + 1400) % 1400 - 200;
    const cg = g.createRadialGradient(x, y, 0, x, y, sz);
    cg.addColorStop(0, 'rgba(255,255,255,0.95)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, sz * 1.8, sz * 0.7, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // tray table
  const ty = 1224;
  rrect(150, ty, 780, 32, 10); g.fillStyle = '#243049'; g.fill();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(170, ty + 32, 740, 12);
  // glass
  const gx = 470, gTop = 1066, gBot = ty, wTop = 128, wBot = 100;
  const level = smooth(ramp(t, E.flight + 0.4, E.pour + 0.5));
  const liquidTop = lerp(gBot - 8, gTop + 30, level);
  const halfAt = y => lerp(wBot, wTop, (gBot - y) / (gBot - gTop)) / 2;
  if (level > 0.002) {
    g.beginPath(); g.moveTo(gx - halfAt(liquidTop) + 5, liquidTop); g.lineTo(gx + halfAt(liquidTop) - 5, liquidTop);
    g.lineTo(gx + wBot / 2 - 5, gBot - 6); g.lineTo(gx - wBot / 2 + 5, gBot - 6); g.closePath();
    const lq = g.createLinearGradient(0, liquidTop, 0, gBot); lq.addColorStop(0, '#FFD27A'); lq.addColorStop(1, '#E59A2E');
    g.fillStyle = lq; g.fill();
    g.strokeStyle = 'rgba(255,245,215,0.9)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(gx - halfAt(liquidTop) + 6, liquidTop); g.lineTo(gx + halfAt(liquidTop) - 6, liquidTop); g.stroke();
  }
  g.strokeStyle = 'rgba(230,240,255,0.75)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(gx - wTop / 2, gTop); g.lineTo(gx - wBot / 2, gBot); g.lineTo(gx + wBot / 2, gBot); g.lineTo(gx + wTop / 2, gTop); g.stroke();
  // bottle (neck at the mouth, body up to the right) and the stream
  const pourOn = win(t, E.flight + 0.15, E.pour + 0.7, 0.35, 0.35);
  if (pourOn > 0) {
    g.save(); g.globalAlpha *= pourOn;
    const mx = gx + 44, my = gTop - 30;
    g.save(); g.translate(mx, my); g.rotate(-24 * D2R);
    g.fillStyle = '#4C6184'; rrect(0, -11, 46, 22, 7); g.fill();
    g.fillStyle = '#3A4B66'; rrect(40, -32, 190, 64, 20); g.fill();
    g.fillStyle = COL.amber; g.fillRect(110, -32, 52, 64);
    g.restore();
    g.strokeStyle = '#F5B342'; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(mx + 2, my + 6); g.quadraticCurveTo(mx - 14, my + 40, gx + 10, liquidTop - 2); g.stroke();
    g.restore();
  }
  g.restore();
}

""" + s[end:]

# payoff: label the two bars
rep("text(`Earth is ${fmt(F.earth_diameter_km)} km wide`, bx, by + 88, { f: font(500, 26, MONO), color: COL.grey, align: 'left' });",
    "text('your trip through the galaxy', bx + bw, by - 14, { f: font(500, 24, MONO), color: COL.grey, align: 'right' });\n  text(`Earth's width: ${fmt(F.earth_diameter_km)} km`, bx, by + 88, { f: font(500, 26, MONO), color: '#8CB8F0', align: 'left' });")

open(P, "w", encoding="utf-8").write(s)
print("patched")
