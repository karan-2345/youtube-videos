"""Review round 2 fixes for web/main.js."""
import sys

P = "web/main.js"
s = open(P, encoding="utf-8").read()


def rep(old, new):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit(f"expected 1 match, got {n}: {old[:70]!r}")
    s = s.replace(old, new)


# galaxy core glow only once the whole galaxy is in view (it fogged the screen mid-zoom)
rep("gal.core.material.opacity = gOp * 0.9;", "gal.core.material.opacity = gOp * 0.9 * (1 - clamp(Math.log(k) / Math.log(4)));")
# Sun marker + labels wait until the camera has settled
rep("const al = smooth(ramp(t, E.galaxy + 2.6, E.galaxy + 3.6)) * (1 - smooth(ramp(t, E.payoff - 0.6, E.payoff)));",
    "const al = smooth(ramp(t, E.galaxy + 3.6, E.galaxy + 4.4)) * (1 - smooth(ramp(t, E.payoff - 0.6, E.payoff)));")
# centre label above the bright core
rep("text('centre of the Milky Way', c.x, c.y + 86,", "text('centre of the Milky Way', c.x, c.y - 120,")
# merry-go-round caption
rep("  // legend\n  const f = font(700, 34, MONO);",
    "  text('a merry-go-round, seen from above', W / 2, 300, { f: font(500, 32, MONO), color: COL.grey });\n  // legend\n  const f = font(700, 34, MONO);")

# dinosaur track: three tapering toes meeting behind a heel pad
start = s.index("function footprint(x, y, s, color) {")
end = s.index("function drawDino(")
s = s[:start] + """function footprint(x, y, s, color) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = color;
  g.beginPath(); g.ellipse(0, 44, 27, 33, 0, 0, Math.PI * 2); g.fill();
  const toe = (ang, len, w) => {
    g.save(); g.rotate(ang); g.translate(0, -2);
    g.beginPath(); g.moveTo(-w, 0);
    g.bezierCurveTo(-w * 1.15, -len * 0.45, -w * 0.7, -len * 0.85, 0, -len);
    g.bezierCurveTo(w * 0.7, -len * 0.85, w * 1.15, -len * 0.45, w, 0);
    g.quadraticCurveTo(0, w * 0.8, -w, 0); g.fill();
    g.restore();
  };
  toe(-0.62, 116, 19); toe(0, 140, 21); toe(0.62, 116, 19);
  g.restore();
}
""" + s[end:]

open(P, "w", encoding="utf-8").write(s)
print("patched")
