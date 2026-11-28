# Beat plan v1: why fingers wrinkle in water (1080 x 1920, 60 fps, about 38 s)

**Look: "Cut-away"**, the second Short in the series. Same backdrop, type, captions and cinnabar accent as the tattoo
Short, so the two read as one channel. The real thing first, then a block of skin cut out of it.

New actors (`lib/cut.js` keeps the stage, skin layers, labels and post):
- **Fingertip:** a stylised index finger (lathe shape, nail, soft skin shading) whose pad can buckle into folds. The
  folds are a vertex displacement that grows with a "wrinkle" amount, in a fixed pattern seeded from the
  blood-vessel layout. That's what makes the S04 "same pattern" match exactly.
- **Water:** a clear tank volume with a bright, slightly rippled surface line, tinted, with no refraction. It's
  cheap on software WebGL.
- **Inside the skin block:** a yellow nerve fibre and a looping red network of blood vessels in the dermis.
  Nerve signals are glowing pulses; the vessels tighten as their radius shrinks.

| Scene | ~Time | Narration | Picture |
|---|---|---|---|
| S00_Hook | 6 s | "When your fingers wrinkle in the bath, it isn't just your skin soaking up water." | A clean fingertip dips into the water. Time-lapse: the pad wrinkles. On "isn't just", a slice lifts a small block out of the pad. |
| S01_Nerves | 9 s | "Instead, your nerves tell the blood vessels under the skin to tighten, so the fingertip shrinks and its skin buckles into folds." | Inside the block, a NERVE fires pulses into the BLOOD VESSELS. The vessels tighten, the dermis sinks a little, and the top skin buckles into folds over them. |
| S02_Test | 8 s | "And that's why a finger with a damaged nerve doesn't wrinkle, which doctors have even used as a nerve test." | Two fingertips side by side in the water. The left one's nerve fires and it wrinkles. The right one has a DAMAGED NERVE (a break in the yellow fibre, no pulses) and stays smooth: NO WRINKLES. Then a THE WRINKLE TEST label. |
| S03_Treads | 8 s | "So the wrinkles might be on purpose, working like tire treads to grip wet things, although scientists still argue about that." | A wrinkled fingertip presses on a wet glass marble and the water squeezes out along the grooves. Beside it, a tire tread on a wet road does the same (LIKE TIRE TREADS?). On "still argue", a STILL DEBATED tag. |
| S04_Same | 8 s | "And the folds even come back in the same pattern every time, because the blood vessels underneath stay in the same place." | Soak 1, wrinkles; the finger dries smooth; soak 2. A cinnabar trace of the first pattern sits exactly on the new folds (SAME PATTERN). A quick cut-away shows the vessel network underneath, unchanged. Then the finger lifts out dry, the loop back to S00's first frame. |

Sound: water plop and bubbles on the dip, soft creak as the folds form, nerve "ticks" (pulses), a squeak for the
smooth finger, wet squelch for the marble, a click for the matching pattern. Music: same family as the tattoo Short.
