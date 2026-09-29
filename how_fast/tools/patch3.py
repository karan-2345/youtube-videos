"""Review round 3 fixes for web/main.js."""
import sys

P = "web/main.js"
s = open(P, encoding="utf-8").read()


def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f"expected 1 match, got {n}: {old[:70]!r}")
    s = s.replace(old, new)


# disk stars below 0.6 kpc were all clamped to exactly 0.6 kpc -> a bright ring round the core
rep("rad = Math.max(rad, 0.6);", "if (rad < 0.7) rad = 0.7 + r() * 2.0;")
# camera keeps the Sun centred until the galaxy is compact, then eases to the centre
rep("target = new THREE.Vector3(0, -1.6 * (1 - u), 0).lerp(galCentre.clone().multiplyScalar(0.7), smooth(ramp(u, 0.35, 1)));",
    "const fC = 1 - clamp(Math.log(k) / Math.log(8));\n    target = new THREE.Vector3(0, -1.6 * (1 - u), 0).lerp(galCentre.clone().multiplyScalar(0.7), smooth(fC));")

# tridactyl track: three slim toes with claw tips, joined at a heel pad
start = s.index("function footprint(x, y, s, color) {")
end = s.index("function drawDino(")
s = s[:start] + """function footprint(x, y, s, color) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = color;
  g.beginPath(); g.ellipse(0, 16, 30, 34, 0, 0, Math.PI * 2); g.fill();
  const toe = (ang, len, w) => {
    g.save(); g.rotate(ang);
    g.beginPath(); g.moveTo(-w, 0);
    g.lineTo(-w * 0.9, -len * 0.72);
    g.quadraticCurveTo(-w * 0.8, -len * 0.92, 0, -len - 18);
    g.quadraticCurveTo(w * 0.8, -len * 0.92, w * 0.9, -len * 0.72);
    g.lineTo(w, 0); g.closePath(); g.fill();
    g.restore();
  };
  toe(-0.5, 104, 14); toe(0, 126, 15); toe(0.5, 104, 14);
  g.restore();
}
""" + s[end:]

open(P, "w", encoding="utf-8").write(s)
print("patched")
