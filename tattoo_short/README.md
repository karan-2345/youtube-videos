# Why tattoos don't wash off: a vertical Short (1080 x 1920, 60 fps, about 33 s)

Topic and format chosen by the user on 2026-11-21: a short "how it works" Short in the same genre as Zack D. Films
(one idea, about 30-40 s), in our own "Cut-away" look. Script v1 approved on 2026-11-21.

The forearm with a star tattoo sheds its outer skin, but the star stays. A block of skin lifts out, and inside it:
- the needle puts the ink below the outer layer;
- macrophages swallow the ink but can't digest it;
- in tattooed mice, killing those cells didn't fade the tattoo, because new cells swallowed the same ink;
- lasers shatter the ink so the cells can carry it to the lymph vessel, which is why removal takes so many sessions.

The ending loops back to the first frame.

Built with three.js and ffmpeg on the chess Short's pipeline (capture harness, Kokoro voice, word captions,
mastering). Status and file map: `HANDOFF.md`. Claims and sources: `research/notes.md`.

    python build.py tts          # voice + timings (Kokoro af_heart 0.95)
    python build.py scenes       # render S00-S03 (three.js, headless Chromium)
    python build.py final        # mix, captions, master -> renders/final/
    python build.py cover        # renders/final/cover.png
    python build.py upload       # renders/final/upload.md
