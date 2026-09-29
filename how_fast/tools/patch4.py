"""Review round 4: clearer dinosaur track (a short trackway), neighbour stars linger a little longer."""
import sys

P = "web/main.js"
s = open(P, encoding="utf-8").read()


def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f"expected 1 match, got {n}: {old[:70]!r}")
    s = s.replace(old, new)


rep("const nearOut = clamp((Math.log(k) - Math.log(5)) / (Math.log(50) - Math.log(5)));",
    "const nearOut = clamp((Math.log(k) - Math.log(2.5)) / (Math.log(14) - Math.log(2.5)));")

start = s.index("function footprint(x, y, s, color) {")
end = s.index("function drawDino(")
s = s[:start] + """function footprint(x, y, s, color, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.fillStyle = color;
  g.beginPath(); g.ellipse(0, 12, 34, 30, 0, 0, Math.PI * 2); g.fill();
  const toe = (ang, len, w) => {
    g.save(); g.rotate(ang);
    rrect(-w, -len, 2 * w, len + 6, w); g.fill();
    g.beginPath(); g.moveTo(-w * 0.62, -len + w * 0.35); g.lineTo(0, -len - w * 1.25); g.lineTo(w * 0.62, -len + w * 0.35); g.closePath(); g.fill();
    g.restore();
  };
  toe(-0.62, 92, 17); toe(0, 112, 18); toe(0.62, 92, 17);
  g.restore();
}
""" + s[end:]
rep("footprint(540, 810, 1.05, COL.amber);",
    "footprint(338, 900, 0.5, 'rgba(252,192,72,0.16)', -0.35);\n  footprint(430, 820, 0.62, 'rgba(252,192,72,0.32)', 0.3);\n  footprint(600, 770, 0.95, COL.amber, -0.2);")

open(P, "w", encoding="utf-8").write(s)
print("patched")
