# diwali_deals: "5 Diwali decor must-haves" affiliate Short

Vertical 1080×1920, 30 fps, 22 s, Hinglish. Final video: `final/diwali_deals.mp4`.

- **Start here:** `MONEY_GUIDE.md` (how to get affiliate links and post this to earn).
- `post_kit.md`: ready captions, hashtags, WhatsApp text. `links.md`: fill in your links.

## Rebuild
```
python music.py    # out/music.wav: original synthesized track (tanpura drone, pluck melody, tabla)
python render.py   # out/diwali_deals.mp4 (needs ffmpeg, pillow with raqm, numpy)
python render.py still 5.8 13.6   # preview PNGs
```
Edit `ITEMS` in `render.py` to change the products/texts. All graphics are drawn in code and the
music is generated, so there are no copyright issues. Fonts: Inter (OFL), FreeSerif (GPL+font exception).
