# CLAUDE.md: read this first in every new chat

This repo is a small studio for **vertical science/history Shorts** (YouTube Shorts and Instagram Reels). Each Short
lives in its own folder (`<topic>_short/`) with a complete, reproducible pipeline: script, facts, voice, a three.js 3D
scene captured frame by frame, synthesized sound and music, mix and master, captions, cover and upload notes.

You don't need to ask the user to explain any of this again. To make a new Short, follow the `/new-short` skill
(`.claude/skills/new-short/SKILL.md`). Ideas not yet made are in `IDEAS.md`.

## What the user wants (standing preferences, in their words where possible)

- **Voice:** Kokoro **`af_heart`** ("kokoro heart female voice"), speed 0.95, en-us. Never another voice unless asked.
- **Length and format:** about 60 to 70 s, 1080 x 1920, 60 fps, and it **loops** (the last frame flows into the first).
- **Hook:** "we only have the first seconds to catch people's attention, so put everything on the hook". The first
  sentence carries the whole promise, and something is already moving in frame 0. The hook is **storytelling**:
  "don't break the line suddenly, use prepositions and conjunctions" (so, and, because, when, until...). No fragments,
  no mic-drop kickers.
- **Audience:** "everyone, not only science people". Informative, but **no high-level maths** a viewer has to follow.
- **Animation:** "don't compromise with animations... give me the best video possible". Detailed, finished 3D
  (three.js), with motion blur, a glow pass, film grain and careful lighting. Every visual beat lands on its word.
- **Truth:** every claim is sourced and checked in `config/facts.py` -> `facts.md` (ALL PASS) before anything is built.
  Say plainly in the delivery message what is simplified or exaggerated, and label exaggerations on screen.
- **Delivery:** send the captioned `.mp4`, `cover.png` and `upload.md` (titles, description with sources, Reels
  caption, pinned comment) with SendUserFile, then commit the finals and push.
- The user has their own copy once they've downloaded it; they say when it's uploaded.

## The pipeline (same in every `*_short/` folder)

```
python3 build.py facts     # config/facts.py -> facts.md, must say ALL PASS
python3 build.py tts       # Kokoro af_heart -> audio/voice.wav + renders/cache/timings.json (word times)
python3 build.py export    # word anchors, breath/event clocks, cues -> renders/cache/scene.json
python3 build.py stills 0 3.5 20      # PNG stills (Q="ss=1" for fast ones)
OUT=renders/preview/preview.mp4 Q="ss=1&blur=0" node tools/capture.js render --workers 2   # fast motion check
nohup node tools/capture.js render --workers 2 > renders/render.log 2>&1 &                  # the real render
python3 -m tools.assemble  # mix, master (-14 LUFS, -1 dBTP), captions -> renders/final/
python3 -m tools.cover     # cover.png
node tools/capture.js eval 7.8 "dbg.cam(7.8)"   # inspect scene state at a time (window.dbg)
```

| File | What |
|---|---|
| `config/narration.py` | the script, one paragraph per beat; captions show it verbatim |
| `config/facts.py` | every claim, its source and a check; `facts.md` is generated |
| `config/style.py` | palette, voice, caption band, safe areas |
| `tools/tts.py` | Kokoro synthesis; `IPA_FIXES` (pronunciation) and `SAY` (how numbers are spoken; captions keep digits) |
| `tools/align.py` | word times without a recogniser: phoneme share, commas pinned to pauses in the audio (about +-0.1 s) |
| `tools/export.py` | `ANCHORS` (named word times the scene and sound sync to), event clocks, cue list |
| `scenes/3d/<Scene>.js` + `lib/` | the scene: `setup(ctx)` returns `{scene, camera, update(t), post, look, blurSamples}` |
| `scenes/web/runtime.js` | deterministic `setTime(t)`, supersampling, motion blur, HDR bloom, ACES, grain, vignette |
| `tools/capture.js` | headless Chromium (SwiftShader) capture: stills, render, range, eval |
| `tools/sfx.py`, `tools/music.py` | synthesized effects and music (no samples, no licences) |
| `tools/assemble.py` | stems, ducking, two-pass loudnorm, ASS word captions + SRT, encodes |

## Lessons learned (don't relearn these)

- Kokoro reads years and some numbers badly ("1173" -> "one thousand..."): put the spoken form in `SAY`; fix stress
  with `IPA_FIXES` (check with `python3 -m tools.tts --phonemes`).
- A missing anchor in JS gives `NaN` and a **black frame** with only the overlay visible. After editing the scene,
  check every `A.xxx` used exists in `scene.json` (a 5-line Python check).
- three.js draws opaque materials before transparent ones whatever the `renderOrder`: a depth pre-pass that must
  come after transparent objects needs `transparent: true`.
- `Math.hypot` is slow in V8 hot loops; write `Math.sqrt(dx*dx+...)`.
- Anything that moves must be periodic over the video length (or end where it started) for a seamless loop.
- Keep effects under the voice: SFX are normalised 8 LU under it and ducked 5 dB; music 12 LU under and ducked 6 dB.
- The render is slow (SwiftShader on 4 CPUs): about 0.8 frames/s per worker at ss=1, roughly half that at ss=1.5.
  Always review stills, then a fast preview video, before the full render (1.5 to 2 h).
- `rm` with wildcards on renders can be blocked by the sandbox: write to a fresh directory instead.
- `.gitignore` in each Short keeps frames, stills, caches, stems and audio out of git; finals under 100 MB are committed.
- The root of the repo (chess Short, `config/`, `scenes/`, `tools/`, `HANDOFF.md`, `ENVIRONMENT.md`) is an older
  Windows-era project. Leave it alone.

## Environment

Python 3 with numpy, scipy, soundfile, pillow, kokoro-onnx; Kokoro model files in `/home/user/models`
(`kokoro-v1.0.onnx`, `voices-v1.0.bin`, from github.com/thewh1teagle/kokoro-onnx/releases/model-files-v1.0);
Node 22 with Playwright (preinstalled) and `npm ci` in each `scenes/web` for three.js; ffmpeg with libass. Start
cloud sessions on the personal environment **"youtube-videos"**: its setup script installs these. If something is
missing anyway, `bash kit/setup.sh` does it by hand (about a minute).

## Git

Work on the branch the session names, commit with the attribution lines the session gives, push, and never open a
pull request unless asked. No model names or IDs in commits or files.

## Shorts made so far

| Short | Folder | Length | Status |
|---|---|---|---|
| How fast chess explodes | repo root | 2:42 | done (2026-11) |
| How fast are you moving right now? | (deleted, see git history) | | done |
| You can calculate pi without a single circle (Buffon's needle) | `buffon_short/` | 69 s | uploaded |
| The Leaning Tower of Pisa should have fallen over | `pisa_short/` | 69 s | delivered 2026-11-21 |
| Where does the fat go when you lose weight? | `fat_short/` | 64.5 s | see its `HANDOFF.md` |
