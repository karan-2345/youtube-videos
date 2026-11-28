# Beat plan v1: why tattoos don't wash off (1080 x 1920, 60 fps, about 37 s)

**Look: "Cut-away".** Our own look, not a copy of another channel's characters or style. Every Short in this series
opens on the real-world thing, then a clean slice lifts out a block, like a specimen on a dark, warm backdrop, and
the story plays inside the block. The rule: one object, one slice, one idea.

- Skin block: epidermis (thin, pale, with flaky top cells), dermis (rose, with soft collagen fibres), fat (pale
  yellow globules). The layers are slightly stylised and evenly lit, with a soft rim light.
- Ink: blue-black particles (instanced). Macrophages: translucent, slightly jelly-like pale cells (physical
  material with transmission) with ink particles visible inside.
- Labels in Inter ExtraBold, word captions in Archivo Captions (the fonts you approved for the chess Short). Every
  label and number stays inside the middle 3:4 (y 240-1680), the same as the chess Short.
- Sound: soft needle buzz, wet "gulp" ticks when a cell swallows ink, a "pop" when a cell dies, a laser "snap".
  Quiet music bed.
- Loop: the last frame matches the first (the forearm with its tattoo).

| Scene | ~Time | Narration | Picture |
|---|---|---|---|
| S00_Hook | 7 s | "Your skin sheds its outer layer every few weeks, so why doesn't your tattoo shed with it?" | A forearm with a small, simple tattoo (a bold black star). Speeded-up time: the top skin flakes lift away in small sheets around and over the tattoo, but the star stays sharp. On "shed with it?" a clean slice cuts a block out from under the star and lifts it up toward the camera. |
| S01_Held | 11 s | "It's because the needle puts the ink deeper, where immune cells called macrophages swallow it but can't digest it, so they just hold on to it." | Inside the block, the needle cluster punches through the epidermis and leaves ink droplets in the dermis. The epidermis slides up and flakes off the top while the ink stays put. On "macrophages", pale cells crawl in and engulf the droplets (label: MACROPHAGE). Each cell ends up dark with ink, and seen from above the dark cells make up the star. |
| S02_Relay | 10 s | "So when scientists killed those cells in tattooed mice, the tattoos didn't fade, because new cells swallowed the spilled ink in the same spot." | Split frame. Top: a stylised lab mouse with a tattooed tail band (label: MOUSE). Bottom: the cells inside. The cells pop and spill ink, a beat of suspense, then new cells crawl in and swallow the same ink. The tail band never changes (label: STILL THERE). |
| S03_Laser | 9 s | "And that's why lasers take so many sessions to remove a tattoo, since they have to shatter the ink small enough for those cells to carry it away." | Back to the block. A laser pulse flashes and one cell's ink shatters into dust, which cells carry away down a lymph vessel. Pulse, then a "weeks later" cut, then another pulse; the star on the surface fades a little each time. Then the block drops back into the arm and the camera settles on the forearm (loop). |

## Build notes

- Base it on the chess pipeline (`build.py`, `tools/`), but the scenes are new three.js files: `lib/skin.js` (the
  layered block, the slice, flakes), `lib/cells.js` (macrophages, engulf/pop/spill, instanced ink),
  `lib/arm.js` (a simple stylised forearm with a decal tattoo), `lib/mouse.js` (a few primitives).
- Estimated render on the laptop at 1.5 frames/s on 3 workers: about 2,200 frames, so roughly 25 minutes for all
  four scenes.
- STOP 1 look test: one still per scene plus a short clip of S01 (needle, then engulfing).
