"""tools/sheet.py -- contact sheet of stills: python tools/sheet.py out.png t1 t2 ... (reads renders/stills/tXXX.XX.png)"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
d = Path(__file__).resolve().parents[1] / "renders" / "stills"
out, ts = sys.argv[1], [float(x) for x in sys.argv[2:]]
s, cols = 0.25, min(len(ts), 8)
w, h = int(1080 * s), int(1920 * s)
rows = (len(ts) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + 8), rows * (h + 30)), "white")
for i, t in enumerate(ts):
    im = Image.open(d / f"t{t:06.2f}.png").convert("RGB").resize((w, h))
    x, y = (i % cols) * (w + 8), (i // cols) * (h + 30)
    sheet.paste(im, (x, y + 26))
    ImageDraw.Draw(sheet).text((x + 4, y + 6), f"{t:.2f} s", fill="black")
sheet.save(d / out)
