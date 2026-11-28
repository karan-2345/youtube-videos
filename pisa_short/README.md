# The Leaning Tower of Pisa should have fallen over: a vertical Short (1080 x 1920, 60 fps, about 69 s)

The tower started sinking in 1178, when it was only three floors tall, and it should have collapsed. What saved it
was a war: building stopped for almost a century, and the clay underneath firmed up. Then the curved upper floors,
the 1990 closure, the soil drilled out from under the high side, and the earthquakes the soft ground soaks up.

Everything is procedural three.js, rendered headless: the tower (8 floors, 211 arches on their columns, cornices on
corbels, bells), a floating block of the Piazza lawn whose front half drops away to show the soil layers, the
collapse with debris and dust, the freeze and rewind, the water squeezed out of the clay, and the sound and music,
synthesized in numpy. Narration is Kokoro TTS, voice `af_heart`. Every claim is checked in `config/facts.py`
(results in `facts.md`).

- **Final video:** `renders/final/pisa_short.mp4` (captions burned in) and `pisa_short_clean.mp4` (no captions)
- **Cover:** `renders/final/cover.png`
- **Captions:** `renders/final/captions/pisa_short.srt`
- **Titles, description, hashtags and sources:** `renders/final/upload.md`
- **Status, decisions and file map:** `HANDOFF.md`

Rebuild everything with `python build.py all`; `build.py` lists the steps and what each one needs.
