# You can calculate pi without a single circle: a vertical Short (1080 x 1920, 60 fps, 69.2 s)

Buffon's needle in 3D. Drop needles as long as the floorboards are wide, and twice the drops divided by the
crossings slowly turns into pi. Then the twist: Mario Lazzarini's 1901 run landed exactly on 355/113, a fraction
for pi about 1,400 years older than his experiment, so he almost certainly stopped the moment he hit it. Narration
is Kokoro TTS, voice `af_heart`. The picture is three.js rendered headless, and the sound is synthesized in numpy.
Every number is checked in `config/facts.py`, with the results in `facts.md`.

- **Final video:** `renders/final/buffon_short.mp4` (captions burned in) and `buffon_short_clean.mp4` (no captions)
- **Cover:** `renders/final/cover.png`
- **Captions:** `renders/final/captions/buffon_short.srt`
- **Titles, description, hashtags and sources:** `renders/final/upload.md`
- **Status, decisions and file map:** `HANDOFF.md`

Rebuild everything with `python build.py all`; `build.py` lists the steps and what each one needs.
