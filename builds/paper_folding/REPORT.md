# How many times can you fold paper? A vertical Short, built in a cloud session

Everything for this Short is in `builds/paper_folding/`. Nothing else in the repo was changed.

## Result

**`final.mp4` is finished and checked.** Download:
https://github.com/karan-2345/youtube-videos/raw/paper-folding-short/builds/paper_folding/final.mp4
(65.7 MB, so it is in Git as a normal file: no Release or LFS needed.)

| Check (ffprobe / ebur128 on `final.mp4`) | Result |
|---|---|
| Video | H.264 High, yuv420p, **1080 x 1920, 60 fps**, 9,232 frames, BT.709 tagged |
| Audio | AAC-LC, 48 kHz, stereo, 256 kb/s |
| Duration | **153.87 s (2:33.9)**; video and audio both 153.87 s from 0.000 |
| Loudness | **-14.0 LUFS integrated**, true peak **-1.6 dBTP**, LRA 2.5 LU (one linear gain after a look-ahead limiter; `loudnorm` stayed linear) |
| Decode | `ffmpeg -v error -i final.mp4 -f null -`: no errors |
| Loop | first vs last frame of `final.mp4`: mean difference 0.058/255; 0.1% of pixels differ by more than 8/255 (encoder noise on the sheet's edges); the same frames straight from the browser were identical (difference 0) |
| Captions | 451 word-caption events, text identical to the script (asserted in `tools/captions.py`) |
| Jumps | a frame-to-frame difference scan of the whole picture shows only the 6 intended cuts; everything else is continuous (see "What failed") |

Also built: `renders/final_clean.mp4` (same, no burned-in captions; 64 MB, not committed, `tools/assemble.sh` makes it).

## Machine (the cloud container)

| | |
|---|---|
| CPU | Intel Xeon @ 2.10 GHz, **4 cores** (1 thread per core) |
| RAM | 15 GB |
| GPU | **none** (no `/dev/dri`, no CUDA) |
| WebGL in headless Chromium 153 | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`: WebGL 2 on the CPU (software), float render targets OK, max texture 8192 |
| OS / tools | Linux 6.18, Python 3.13, Node 22, ffmpeg 6.1.1 (libx264, AAC, libass, loudnorm, ebur128) |
| Installed here | venv: kokoro-onnx 0.6.1, onnxruntime 1.31.1, soundfile, scipy, fonttools; npm: three 0.186.1; Playwright 1.63 + Chromium were pre-installed |
| Downloads | Kokoro `kokoro-v1.0.onnx` (325.5 MB) and `voices-v1.0.bin` (28.2 MB) from the kokoro-onnx GitHub release: both HTTP 200, nothing blocked. Inter: no download needed, the repo already had `assets/fonts/Inter-VariableFont_opsz,wght.ttf` (SIL OFL); I copied it and cut a static ExtraBold (wght 800) with fonttools. |

## Voice

Kokoro `af_heart`, speed 0.95, kokoro-onnx, one sentence at a time. 0.4 s between sentences, 0.8 s between sections,
plus the scripted 1 s after S05.03; 0.6 s of lead-in before the first word. No silence was added to reach a length.

**Measured length: 153.86 s (2:33.9)**, 451 words, synthesised in 46 s on the CPU. Speech-only fixes (the captions and
the script are unchanged): "1.2" is spoken "one point two" (espeak reads the point as a full stop) and years are
read as years. "Gallivan", "misspoken", "kilometres" phonemise correctly (checked, not listened to).

| Section | Voice from - to (s) |
|---|---|
| S00 The hook | 0.60 - 21.79 |
| S01 The rule | 22.59 - 46.31 |
| S02 The gold foil | 47.11 - 64.73 |
| S03 What stops you | 65.53 - 87.50 |
| S04 Twelve folds | 88.30 - 118.75 |
| S05 Back to the Moon | 119.55 - 152.87 (+ 1 s pause, end 153.86) |

### Narration: lines I would flag (used word for word, not changed)

1. **S04.02 "after about eight hours"**: most accounts of Gallivan's January 2002 fold that I know give about
   **seven** hours. Worth checking against her own booklet before publishing. (The on-screen "≈ 8 HOURS" follows the
   narration, from `HOURS_2002` in `config/facts.py`.)
2. **S04.03 "when a school team tried again in 2011"**: the St Mark's School (Massachusetts) 13-fold attempt with
   ~16 km of toilet paper is reported as December 2011 by some outlets and January 2012 by others. "2011" is defensible.
3. Everything else checks out against the numbers below: 2^7 = 128 layers; 0.1 mm x 2^42 = 439,805 km > 384,400 km;
   Gallivan's L for 22 folds = 921,125 km (past the Moon) and for 42 folds = 1.013 x 10^21 m = 107,052 light years
   (about the Milky Way's 100,000 ly); gold leaf (~0.1 µm) is thinner than visible light (380-700 nm); L grows
   about 4x per fold.

## Numbers on screen

`config/facts.py` recomputes everything and asserts the brief's values (`python config/facts.py` prints them):
fold 7 = 128 layers / 12.8 mm; fold 22 = 419.43 m; fold 42 = 439,805 km; L(22) = 921,125 km; L(42) = 1.0128e21 m =
107,052 ly. `tools/export.py` writes these and the full table for n = 0..42 to `cache/data.json`; the scene formats
them (and evaluates the same two formulas for in-between folds; `window.selfTest()` checks the JS against the Python
table: max relative error 0). Dates, 12, 13, 1.2 km, 16 km and 8 hours are named constants in the same file.

## What the Short shows

| Section | Picture |
|---|---|
| S00 | An A4 sheet on a dark floor under one lamp folds (real hinged folds) while the counter climbs; from fold 7 the 128-layer block grows as 0.1 mm x 2^n, the camera flies up with it through a cloud layer at ~2 km, out past Earth's curve until the stack passes the Moon at fold 42 (439,805 km). Then the strip appears beside it and the camera backs away up the strip, past the Moon and the Sun, out through empty light years until the Milky Way fills the frame with the strip running 107,000 ly across it; the formula appears on "a formula". One continuous true-scale flight, 0.1 mm to 10^21 m. |
| S01 | The sheet folds at hand speed, 2, 4, 8 ... 128 layers (12.8 mm); the eighth fold lifts a few degrees, strains and drops back. "2001 / FOLD SOMETHING / IN HALF 12 TIMES". |
| S02 | A gold-leaf square (the accent colour) folds 12 times with the count (4,096 layers); the camera follows it down to the 1.25 mm block. "SOMETHING" is struck through and PAPER replaces it. |
| S03 | Close-up cross-section: layers bending round a fold; the outer curves light up amber, then the whole bend; the stack doubles and so does the bend; a strip beside it grows 1x, 4x, 16x, 64x as the camera rises to keep it in frame. |
| S04 | A roll unrolls 1.2 km along the floor as the camera climbs overhead; a small figure walks it out and carries the end back, 12 times (time-lapse, the strip halving each time, the camera coming down with it); then 1.2 km beside 16 km (accent), the camera climbing to see all 16 km: "2011 / 13 FOLDS". |
| S05 | Split screen in the same true-scale world: STACK on the left, STRIP on the right, both counters running from fold 12; fold 22: 419 m beside 921,125 km (past the Moon); fold 42: 439,805 km (the Moon) beside 107,000 light years (the Milky Way). Then a hand resting on a roll of toilet paper, its strip running away down a long dark floor, and the camera flies back to the opening sheet: **the last frame is the first frame** (pixel difference 0). |

Art direction: one white strip/sheet, a near-black floor, one warm lamp with real shadows and fog fall-off, one accent
(amber #F2A93B, also the gold), Inter ExtraBold centred type, no serif, no letterspacing, no tiles, gradients-as-decor,
glows or starfields (the galaxy is the subject, drawn as 420,000 points). All type and the captions sit inside the
middle 3:4 (y 240-1680).

## Pipeline: what was reused and what changed

The repo's root pipeline (`build.py`, `HANDOFF.md`, `scenes/`, `tools/`) is the chess Short's, written for a Windows
laptop with a GPU. I read it and reused its design and code patterns **inside this folder** rather than importing it
(it is hard-wired to the chess config, and the rule was not to change anything else):

- seekable `window.setTime(t)` scenes in three.js, captured with CDP `Page.captureScreenshot` into ffmpeg, split into
  contiguous frame ranges across workers (`tools/capture.js`, `tools/render.sh`; Node instead of Python Playwright,
  because Node Playwright and its Chromium were pre-installed);
- sentence-by-sentence cached Kokoro TTS with speech-only fixes and measured timings (`tools/tts.py`), phrase anchors
  placed by spoken-character share;
- numbers only from a facts module;
- synthesised SFX placed from cue rows, a generated music bed ducked under the voice by sidechain, stems set from
  measured loudness, and the two-pass `loudnorm` master with a look-ahead limiter so the gain stays linear
  (`tools/audio.py`);
- burned-in word captions with the current word in the accent (`tools/captions.py`). They are in Inter ExtraBold,
  not the chess Short's Archivo, because this brief asks for Inter ExtraBold type. A caption-free copy is also built.

Changed for the cloud: **no GPU**, so WebGL runs on SwiftShader (CPU). The chess pipeline's post pass (1.5x
supersampling, 4-6 motion-blur sub-frames, film grain) would have cost 6-9x per frame, so it is not used; frames are
rendered once with 4x MSAA and ACES tone mapping. Cues for the SFX come from a dry pass over the same timeline
(`tools/cues.js`), so sound and picture cannot drift.

## What failed or was changed on the way

- **Interpretation, flagged:** to fit 9:16, the strip in the cosmic shots (S00, S05) is measured straight up beside the
  stack rather than lying along a floor (it does lie on the floor in S04 and at the end); past fold 7 the column keeps
  the 7-fold footprint (real folding would keep halving it); the stack and the strip are drawn as lines at least 5 px
  wide where their true width would be sub-pixel (positions and lengths stay true scale); the gold leaf is drawn at
  least 4 µm thick (invisible either way) because a 0.1 µm box broke its normals in float32; the S04 fold walk is a
  time-lapse.
- Found in the test stills and fixed before the full render: blown-out paper and self-shadowing (black paper and
  strips), the gold rendering black (three.js r186 ignores `envMapIntensity` with `scene.environment`, so the gold has
  its own environment map), a giant floor quad that hid the strip in SwiftShader (fixed by subdividing it), text
  colliding with the block and the Moon label, a 0-light-year readout, the strip not reaching 107,000 at the end of
  S00, walls blocking the last camera move (removed), a hard horizon (fog).
- **The render did not go in one pass.** What happened, in order:
  - The studio shots (S01-S04) were slower than S00 on SwiftShader, and S03's cross-section much slower (0.13 frames/s
    per worker): the logarithmic depth buffer writes `gl_FragDepth`, so no hidden layer is ever skipped. The studio shots
    now use a second renderer without log depth, and the section is 7 cm deep instead of 18 cm. Measured A/B on the same
    frame: about 2x faster.
  - While checking that I found S03's camera lost the growing strip (1x, 4x, 16x, 64x) for about a second (old bug); the
    strip now runs beside the fold and the camera follows its length. All S03 and S04 frames were re-rendered with this
    code by four new workers; the old workers were stopped at the right frame (killing only the browser lets the encoder
    finish the file).
  - My background command that ran `render.sh` hit its 2-hour limit and was killed, which also killed the worker for
    frames 6924-9232 (S04 end to the loop) at frame ~2160 of 2308, leaving an MP4 with no index. I rebuilt it: the
    H.264 data in `mdat` was intact, so I re-wrapped it with the SPS/PPS of a segment encoded with identical settings
    (2,129 frames recovered, decoded without errors) and rendered only the missing 179 frames.
  - A frame-difference scan of the stitched picture then found four real pops, all fixed in code and re-rendered locally
    (`tools/pieces_this_build.txt` lists every piece): the Earth switched on in one frame near 22 km (now fades in); the
    end of fold 12 snapped the camera and the walker; the studio camera kept a stale view offset, so a frame could depend
    on the frame rendered before it (now cleared every frame: renders are again pure functions of t); the ending's extra
    key light left the last frame 0.5 brighter than the first. The "Moon" label crossing the km readout at ~6 s and the
    "1.2 km" label entering the caption band at ~117 s were also moved.
  - In all, 11,171 frames were rendered for the 9,232 used; a clean rebuild with the current code renders each frame
    once.
- The full render was slower than S00's test: S00 ran at 2.4 frames/s on 4 workers; the studio shots run at
  ~0.35 frames/s per worker.
- Git: my second commit accidentally included ~39 MB of scratch test stills. They are removed in the next commit, but
  the force-push to drop them from history was blocked by the session's safety rules, so they stay in the branch
  history (commit `6153d62`).
- Branch: you asked for `paper-folding-short`; the session's default branch was `claude/adoring-bohr-oicuvo`. I used
  yours.

## Timing

All times are wall clock in this session (UTC, 3 November 2026).

| Step | Time |
|---|---|
| Read the repo's pipeline, set up tools, download Kokoro (354 MB, < 1 min), WebGL check | ~3 min (19:09-19:12) |
| Voice (Kokoro, 14 sentences) | 46 s |
| Scene code and look iterations (about 15 rounds of stills, each 10-20 s to render) | ~45 min |
| **S00 test render**: 1,331 frames on 4 workers | **555 s = 2.4 frames/s** |
| Estimate from that speed for 9,232 frames | ~64 min; the studio shots turned out slower |
| Full render, including the restarts above | 2 h 16 min (19:58-22:14) |
| Seam scan, fixes, five re-rendered windows (1,378 frames) | ~45 min, 18 min of it rendering |
| Sound cues (dry pass over all frames, no rendering) | 74 s |
| SFX + music + mix + master | 51 s |
| Stitch (30 pieces, CRF 12) | ~2 min |
| Assemble `final.mp4` + clean copy (x264 slow, CRF 18) | 246 s |
| **Total, start to checked final** | **about 4 h 05 min** |

Measured render speed per worker (4 workers on 4 cores unless noted; frames/s): S00 0.6 (2.4 total; mostly dark
space), S01-S02 0.35-0.5, S03 0.13 with 7 processes on the 4 cores (before the fix it was the slowest), S04 0.38 (1.5
total), S05 0.4. **For a clean rebuild of this Short on this machine, expect about 1 h 45 min of rendering** (9,232
frames at ~1.5 frames/s) plus ~10 minutes for everything else.

### Is it the same as a local build?

As far as I can judge, yes: it is the same code, and SwiftShader is a conformant WebGL 2 implementation. Shadows, MSAA,
tone mapping and fog are computed the same way they would be on a GPU, and every frame is a pure function of t. The
difference from **your chess Short** is the post pass, not the cloud: that pipeline rendered 1.5x supersampled with 4-6
motion-blur samples and film grain, which would cost 6-9x per frame here, so this Short has 4x MSAA only. Fast moves
(the fold flaps, the rocket) are therefore sharper and less filmic, and the thin lines and the point galaxy shimmer a
little more than they would after supersampling. Audio is identical in kind (all synthesised, measured). I checked the
picture by eye (about 150 stills, a 16-frame contact sheet of the final) and the sound by measurement only; I did not
listen to it.

### Would I build the other Shorts this way?

Yes, with conditions:
- Budget **~40 s of render per second of video** on these 4 CPU cores for this level of scene; 2.5 minutes is about
  1.5-2 hours. Supersampling or motion blur would multiply that 6-9x; for that, use a GPU machine or a smaller cloud
  render with a GPU.
- Run the frame render as a detached process (`nohup ./tools/render.sh`). A tool or session timeout must not own it
  (that is what killed one worker here). Commit after every milestone, as this run did.
- Keep studio scenes light on overdraw (no stacks of large overlapping faces), and run the frame-difference seam scan
  before assembling: it found every real pop in this build.

## Rebuild

From a fresh clone (Linux, Python 3.10+, Node 20+, ffmpeg with libx264/libass, Playwright with Chromium):

```bash
cd builds/paper_folding
./build.sh
```

`build.sh` creates the venv, downloads the two Kokoro files (354 MB) if missing, installs three.js, recomputes the
facts, synthesises the voice, exports the scene data, records the sound cues, mixes and masters the audio, writes the
captions, renders every frame (`WORKERS=4` by default; segments that finished are skipped on a re-run), splices any
patches and assembles `final.mp4` (+ `renders/final_clean.mp4`). Individual steps:

| Step | Command | Output |
|---|---|---|
| facts | `.venv/bin/python config/facts.py` | prints and asserts every number |
| voice | `.venv/bin/python tools/tts.py` | `audio/voice.wav`, `cache/timings.json` |
| scene data | `.venv/bin/python tools/export.py` | `cache/data.json` |
| stills | `node tools/capture.js 0 0 stills/x --png 2.5,6.4` | PNGs at those times |
| frames | `./tools/render.sh 4` | `renders/picture.mp4` |
| a fix after the render | `node tools/capture.js F0 F1 frames/patches/p_F0_F1.mp4`, then `tools/splice.py` (or `tools/stitch.py LIST` for arbitrary pieces, as in this build: `tools/pieces_this_build.txt`) | `renders/picture_final.mp4` |
| sound | `node tools/cues.js && .venv/bin/python tools/audio.py` | `audio/master.wav` |
| captions | `.venv/bin/python tools/captions.py` | `cache/captions.ass`, `captions.srt` |
| final | `./tools/assemble.sh` | `final.mp4` |

Not in Git (re-created by `build.sh`): `.venv/`, `models/`, `web/node_modules/`, `frames/`, `cache/`, `audio/`,
`renders/`.

## Files

- `final.mp4`: the Short (1080x1920, 60 fps, H.264 + AAC, 153.87 s, -14.0 LUFS, word captions burned in).
- `cover.png`: 1080x1920 cover (frame 17.0 s: the Milky Way with the 107,000-light-year strip).
- `stills/test_S00_t2.5.png`, `t6.4`, `t10.6`, `t18.0`: the four stills from the first S00 test render that I checked.
  What they showed and I fixed before the full render: the "Moon" label and the km readout collide (t6.4); the
  pull-back past the Moon and the Sun was too fast to read (t10.6); the strip ended at 106,000 instead of 107,000, the
  galaxy sat off-centre and the formula crossed the core (t18.0).
- `stills/final_contact_sheet.png`: 16 frames of the final, captions included.
- `captions.srt`: the narration as subtitles (for upload).
- Code: `config/` (facts, narration), `scenes/` (player, main timeline, true-scale universe, studio shots, helpers),
  `tools/` (TTS, export, capture, render, cues, audio, captions, splice, assemble), `build.sh`.
