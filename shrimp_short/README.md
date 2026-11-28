# The pistol shrimp's snap: a vertical Short (1080 x 1920, 60 fps, about 33 s)

The third Short in the "Cut-away" series, after `tattoo_short` and `wrinkle_short`. The user chose the topic on
2026-11-28 (from four options; onions, goosebumps and quicksand were dropped because Zack D. Films has covered them)
and approved script v1 the same day.

What happens on screen:
1. A goby swims up to a pistol shrimp at its burrow. The big claw snaps and the fish is knocked out without being
   touched (NO CONTACT).
2. The claw is cut open in slow motion: the PLUNGER on the moving finger rams the SOCKET, a WATER JET shoots out and
   a BUBBLE tears open inside it.
3. The bubble collapses; the SHOCK WAVE stuns the fish.
4. The collapse flashes; the flash glows beside the Sun's surface, and two bars compare the temperatures (NEARLY AS
   HOT AS THE SUN, ESTIMATED).
5. A whole colony crackles and a submarine's sonar is DROWNED OUT (WORLD WAR II). The ending loops back to the first
   frame.

Built with three.js and ffmpeg on the same pipeline as the other Shorts. Status and files: `HANDOFF.md`. Claims and
sources: `research/notes.md`.

    python build.py tts          # voice + timings (Kokoro af_heart 0.95)
    python build.py stills S01_Jet 1.6 2.9   # PNG stills of a scene at chosen times
    python build.py scenes       # render S00-S04 (three.js, headless Chromium)
    python build.py final        # mix, captions, master -> renders/final/
    python build.py cover        # renders/final/cover.png
    python build.py upload       # renders/final/upload.md

`assets/models` and `scenes/web/node_modules` are symlinks to the tattoo Short's copies (git-ignored). On the laptop,
point them at the same Kokoro files and run `npm install` in `scenes/web`.
