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
- Never switch a big backdrop piece (a floor, a sky) on or off with `.visible` mid-shot: it pops. Fade it, and fade it
  back out before the loop point. Before the full render, compare a still at the last frame with one at t = 0
  (mean pixel difference should be a few levels, not 10+).
- To fix a few seconds of a finished render, re-render only those frames (`node tools/capture.js range f0 f1 out.mp4`,
  end exclusive) and splice them into `renders/scene.mp4` with ffmpeg trim + concat at crf 12, then re-run assemble.
- Keep effects under the voice: SFX are normalised 8 LU under it and ducked 5 dB; music 12 LU under and ducked 6 dB.
- The render is slow (SwiftShader on 4 CPUs): about 0.8 frames/s per worker at ss=1, roughly half that at ss=1.5.
  Always review stills, then a fast preview video, before the full render (1.5 to 2 h).
- `rm` with wildcards on renders can be blocked by the sandbox: write to a fresh directory instead.
- `.gitignore` in each Short keeps frames, stills, caches, stems and audio out of git; finals under 100 MB are committed.
- An anchor must never share a name with a beat (`mud`, `lab`, `end`...): `anchors()` writes the beats' start times
  into the same dict and silently overwrites it. A `ramp(t, a, b)` with a > b is 1 before a, not 0: check every ramp
  whose ends come from two different anchors.
- In GLSL `pow(x, 2.)` with x < 0 is undefined (NaN on SwiftShader): write `x * x`. A shader that fails to compile
  does NOT print an error in the capture log (only "program not valid"); `window.shaderErrors()` in
  `pyramid_short/scenes/3d/Pyramid.js` lists every failed program: run it with `capture.js eval <t>` after a change.
- `node tools/capture.js preview 5 renders/preview/preview.mp4 3` (pyramid_short) renders every 5th frame with the
  voice, about 20 minutes: the cheapest whole-film motion check.
- Keep the music in whole phrases over the video: lock the tempo to a scene clock that is a whole number of bars
  (pyramid_short: 8 strides = 4 bars), and wrap the reverb tail and the SFX tail round onto the start.
- Keep every set within a few km of the origin. Sets 40 km out (pyramid-style offsets) broke all shader noise in the
  ice Short (float precision: the pond went blank white, sawdust lost its grain). Put interiors below the sea instead
  (y = -1000), since only one set is visible at a time.
- A mesh moved in `onBeforeRender` (a sky dome following the camera) must update its own matrixWorld and
  modelViewMatrix there, or it lags a frame and far sets see past it (a black sky). Compute cameras after the objects
  they follow are posed, and call `scene.updateMatrixWorld(true)` before `localToWorld`.
- Measure the loop seam on the exact last frame (`-vf select=eq(n\,N-1)`), not with `-sseof -0.05`: that lands about 3
  frames early and reads 2-3x too high. Compare it with an ordinary frame step (frames 0 -> 1).
- 3 capture workers at ss=1.5 worked in the ice Short (1.15 frames/s, a 69 s film in 1 h) with no lost contexts.
- `half` is a reserved word in GLSL ES (shader fails, only "program not valid" in the log).
- `ice_short/scenes/3d/lib/` has: a Gerstner sea with a ship's wake and shore foam, a sailing ship with a cutaway
  hold, 1800s figurine people (top hats, turbans, laugh/amazed poses), a harbour town, melting ice blocks, an antique
  globe with real coastlines (`tools/landmap.py`), and formant-synth crowd laughter / "ooh" in `tools/sfx.py`.
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

## Where we left off (2026-11-27)

- The Ice King Short (`ice_short/`, Frederic Tudor) was delivered on 2026-11-27; see `ice_short/HANDOFF.md`. Pyramid
  (2026-11-23), fat (2026-11-22) and Pisa (2026-11-21) were delivered before it; the user hasn't said which are uploaded.
- Next: whichever idea the user picks from `IDEAS.md` (three older ideas and five landmarks; Venice is the closest to
  Pisa), or the user's own hook, used word for word. If the user's message still has a template placeholder instead
  of a hook, ask which idea (offer the list).
- Web pages (Wikipedia, phys.org, university sites) could not be fetched from the cloud sessions (DNS blocked);
  WebSearch summaries worked. Say so in facts.py when a source was read only through search.
- The user wants every new chat to carry on from here without re-explaining. If something in a new chat needs
  explaining anyway, write it into this file before finishing.

## Shorts made so far

| Short | Folder | Length | Status |
|---|---|---|---|
| How fast chess explodes | repo root | 2:42 | done (2026-11) |
| How fast are you moving right now? | (deleted, see git history) | | done |
| You can calculate pi without a single circle (Buffon's needle) | `buffon_short/` | 69 s | uploaded |
| The Leaning Tower of Pisa should have fallen over | `pisa_short/` | 69 s | delivered 2026-11-21 |
| Where does the fat go when you lose weight? | `fat_short/` | 64.5 s | delivered 2026-11-22 |
| How the Egyptians moved stones heavier than a car (water on the sand) | `pyramid_short/` | 69.3 s | delivered 2026-11-23 |
| The man who sold ice to the tropics (the Ice King) | `ice_short/` | 69.0 s | delivered 2026-11-27 |
