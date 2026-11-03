"""Contact sheet of PNG stills: python tools/sheet.py <dir> <out.png> [cols] [width]"""
import os
import sys

from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
w = int(sys.argv[4]) if len(sys.argv) > 4 else 270
files = sorted(f for f in os.listdir(d) if f.endswith(".png"))
h = w * 16 // 9
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * (h + 22)), "white")
dr = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(d, f)).convert("RGB").resize((w, h), Image.LANCZOS)
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    sheet.paste(im, (x, y + 22))
    dr.text((x + 4, y + 4), f, fill="black")
sheet.save(out)
print(out, sheet.size)
