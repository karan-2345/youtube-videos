# Why fingers wrinkle in water: a vertical Short (1080 x 1920, 60 fps, about 35 s)

The second Short in the "Cut-away" series, after `tattoo_short`. The user chose the topic (from new options, after
knuckle cracking turned out to be a Zack D. Films topic already) and approved script v1 on 2026-11-22.

What happens on screen:
1. A fingertip dips into the bath and its pad buckles into folds. The folds aren't just from soaking.
2. A block of skin lifts out: a nerve fires, the blood vessels tighten and the skin buckles over them.
3. A finger with a damaged nerve stays smooth: the wrinkle test.
4. The folds might work like tire treads (a fingertip on a wet marble, a tyre on a wet road), but that's still
   debated.
5. Two soaks give the same folds, because the vessels underneath stay put. The ending loops back to the first frame.

Built with three.js and ffmpeg on the same pipeline as the tattoo Short. Status and files: `HANDOFF.md`. Claims and
sources: `research/notes.md`.

    python build.py tts          # voice + timings (Kokoro af_heart 0.95)
    python build.py scenes       # render S00-S04 (three.js, headless Chromium)
    python build.py final        # mix, captions, master -> renders/final/
    python build.py cover        # renders/final/cover.png
    python build.py upload       # renders/final/upload.md

`assets/models` and `scenes/web/node_modules` are symlinks to the tattoo Short's copies (git-ignored). On the laptop,
point them at the same Kokoro files and run `npm install` in `scenes/web`.
