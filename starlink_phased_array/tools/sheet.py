"""Contact sheets from stills: python tools/sheet.py renders/stills renders/sheets [cols] [rows]"""
import glob
import os
import sys

from PIL import Image, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
rows = int(sys.argv[4]) if len(sys.argv) > 4 else 2
os.makedirs(dst, exist_ok=True)
files = sorted(glob.glob(os.path.join(src, "t*.png")))
tw, th = 360, 640
per = cols * rows
for n in range(0, len(files), per):
    sheet = Image.new("RGB", (cols * tw, rows * th), (20, 20, 24))
    for k, f in enumerate(files[n:n + per]):
        im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 92, 24], fill=(0, 0, 0))
        d.text((6, 5), os.path.basename(f)[1:-4] + " s", fill=(255, 220, 120))
        sheet.paste(im, ((k % cols) * tw, (k // cols) * th))
    out = os.path.join(dst, f"sheet{n // per + 1}.png")
    sheet.save(out)
    print(out)
