# Rolling shutter: why your phone bends propellers. A vertical Short, built in a cloud session

Everything for this Short is in `builds/rolling_shutter/` on branch `rolling-shutter-short` (made from
`paper-folding-short`). Nothing else in the repo was changed.

## Result

**`final.mp4` is finished and checked.** Download:
https://github.com/karan-2345/youtube-videos/raw/rolling-shutter-short/builds/rolling_shutter/final.mp4
(25.3 MB: a normal Git file, no Release or LFS needed.)

| Check (on `final.mp4`) | Result |
|---|---|
| Video (ffprobe) | H.264 High, yuv420p, **1080 x 1920, 60 fps**, 9,066 frames, BT.709 |
| Audio (ffprobe) | AAC-LC, 48 kHz, stereo, 256 kb/s |
| Duration | **151.10 s (2:31.1)**, video 151.100 s, audio 151.096 s |
| Loudness (ebur128) | **-13.9 LUFS integrated**, peak -1.9 dBFS, LRA 2.5 LU (master: one linear gain after a look-ahead limiter; loudnorm stayed `linear`) |
| Decode | `ffmpeg -v error -i final.mp4 -f null -`: no errors |
| Loop | last frame vs first frame: PSNR 47.7 dB; an amplified difference image shows only encoder noise on edges, no moved shape (both frames are the same pass at row 600 of 1,440) |
| Captions | 468 word events, text identical to the script (asserted in `tools/captions.py`) |

Also built: `renders/final_clean.mp4` (no burned-in captions; not committed, `tools/assemble.sh` makes it).

## Machine (the cloud container)

| | |
|---|---|
| CPU | 4 cores (Intel Xeon) |
| RAM | 15 GB |
| GPU | **none** (no `/dev/dri`, no CUDA) |
| WebGL in headless Chromium 153 | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`: WebGL 2 in software on the CPU; float render targets OK, max texture 8192, 4x MSAA |
| Tools | Python 3.13, Node 22, ffmpeg 6.1.1; venv: kokoro-onnx, soundfile, scipy, fonttools; npm: three 0.186.1; Playwright + Chromium were pre-installed |
| Downloads | `kokoro-v1.0.onnx` (325.5 MB) and `voices-v1.0.bin` (28.2 MB) from the kokoro-onnx GitHub release, both HTTP 200. **Nothing was blocked.** Inter was already in the repo (SIL OFL); the static ExtraBold cuts were copied from `builds/paper_folding/fonts`. |

## Voice

Kokoro `af_heart`, speed 0.95, kokoro-onnx, one sentence at a time; 0.4 s between sentences, 0.8 s between
sections, plus the scripted 1 s after S05.03; 0.6 s lead-in. No silence added to reach a length.
**Measured: 151.10 s (2:31.1)**, 468 words, synthesised in 43 s. Phonemes checked (not listened to): "2,400" ->
"two thousand four hundred", "un-bend", "modelled", "seventieth", "mid-air" all correct.

### Narration: lines I would flag (used word for word)

1. **S05.02 "about two and a half turns per sweep"**: the brief's figure for that photo is 2.39, which rounds to 2.4,
   not 2.5. "About two and a half" is generous but not wrong; the screen shows **2.4** (from `K_PHOTO`).
2. **The 204° in the brief**: a sweep of exactly 1/70 s at 40 turns/s is 0.5714 turn = **205.7°**. 204° is what
   14.2 ms gives (0.568 turn). The code uses exactly 1/70 s, so the ring shows 57%. The narration itself ("more than
   halfway round") is right either way.
3. Everything else checks: 2,400 rpm = 40 turns/s; low E = 440 x 2^(-29/12) = 82.41 Hz.

## The simulation (how the bent images are made)

No bent shape is drawn. `scenes/engine.js` `captureRows()` renders the actual three.js scene **once per sensor
row**, with the scene posed at that row's moment, t(row) = t0 + (row / rows) x sweep, writing only that row
(a GL scissor strip). The rows are written once into a 2x supersampled float target and box-filtered. The rotor
angle is 2 pi x rate x t, so the shape depends only on **k = turns per sweep = rate x sweep time**, which every
pass is built from (`passK(k)` in `scenes/shots.js`). On screen the sweep is slowed (for example 14.3 ms shown over
about 13 s). The ghost propeller and the scan line are driven by the same t(row), so the ghost meets the captured
rows exactly at the line. The same capture code makes the street, the phone's picture of the fan, and the guitar
string. Each capture costs about 1.4 s for 1,440 rows.

Checks that it is real: a per-row colour readback proved row 0 is read first and every strip is separate. The S05
count recomputes all 1,440 rows for every frame. The S03 slice labels are found by reading back the capture itself:
connected regions of the tracked blade's mask, each labelled with its own mean row time.

**Where the result differed from what I expected (I trusted the simulation):**
- At 0.57 turns per sweep (the worked example), a single blade that starts pointing up is caught only **above the
  hub**. Below the hub it turns away faster than the scan comes down, so it never appears there. The S02 banana is
  therefore one curve from a nearly upright tip into the hub, not an arc around it.
- In this framing (propeller about 2/3 of the sensor height), detached pieces only start at about 1.6 turns per
  sweep. So the hook and S03 use the real photo's 2.39, which gives clear floating slices (S03 labels them 4.6 ms and 8.6 ms).
- At 1/30 s and 120 km/h the car leans about 15°: visible but modest. A real car at city speed leans less.
- Turning the phone sideways rotates the scan with the phone. The fan's bend on the phone screen changes from
  bananas curving one way to bananas curving the other way (both computed, `FA` and `FB` in S04).

## What the Short shows

| Section | Picture |
|---|---|
| S00 | Opens mid-pass on the 2.39 turns/sweep picture: amber bent blades and floating slices, the line still descending. The photo shrinks to the top, a solid 3/4-view metal propeller spins below it (stacked, inside 3:4), then the photo returns and pushes in on the floating pieces. |
| S01 | Scan-line wipe to a street at dusk (neutral greys). A car rolls in; "one single instant" is a capture with sweep 0 (upright car). Then the real pass: the line paints the 4:3 photo row by row, a time readout riding on it (0.0 -> 33.3 ms), the 0.0 ms stamp left at the top; the car comes out leaning; a pale ghost of the true car on top. |
| S02 | Wipe to the studio. One blade turns, comes to rest pointing up; the sweep starts (very slow); each row freezes in amber behind the line under the pale ghost; hold, then the ghost is scrubbed back over the curve. "2,400 RPM / = 40 TURNS A SECOND", "1/70 SECOND SWEEP", then a 3-blade pass with a small white ring filling to 57% ("57% OF A TURN") in step with the line. |
| S03 | Same studio, 2.39 turns per sweep over the S02 picture; one blade tinted (amber in the capture, amber-pale in the ghost), slices labelled with their times; the ghost then replays the blade at each slice's moment. |
| S04 | Wipe to a desk fan (the same rotor in a guard) and a 3D phone whose screen shows its camera's simulated picture. Pass in portrait, the phone turns 90° (its camera rolls with it), second pass: a different bend. Wipe to a close-up of six strings over a pickup; a plucked low E (82.41 Hz, fundamental mode) and the line sweeps down: 2.75 waves of "snake" appear. |
| S05 | Wipe back to the studio: the picture recomputed live as the number counts 0.1 -> 5.0 turns per sweep (slight bend, banana, broken pieces), back down to 2.4, "our simulation" small at the top; the line rises and the rows below it become one instant: three straight blades (neutral). Fade, then the hook's pass starts again; **the last frame is the first frame**. |

Art direction: near-black studio, procedural three-blade aluminium propeller (NACA sections, twist, scimitar sweep),
one softbox in the environment map for the reflections, amber (#FFAE42) only for the scan line and what it
captured. Inter ExtraBold, centred, no letterspacing; all type and content inside the middle 3:4 (y 240-1680), with
captions at y 1590.

## What failed or was changed

- **Choices not in the brief** (all in `config/facts.py`): S01 and S04 use a phone in video mode with a **1/30 s**
  readout (typical); car **120 km/h**; fan **1,200 rpm** (0.67 turns per sweep); guitar amplitude 2.6 mm; S03 uses
  2.39 turns per sweep (the hook's value) at a 1/70 s sweep.
- **No cast shadows in captured scenes.** A shadow pass per row cost 4x (5.4 s vs 1.4 s per capture: the framebuffer
  switch every row stalls SwiftShader). The key light's pool on the backdrop remains.
- **Captions:** the pipeline burns in word captions, so they are included, but the current word is white, not the
  accent: amber is kept for the scan line only.
- **The desk fan has an open front** (outer rim and rear spokes only): with a full front grille the bent blades did
  not read on the phone screen.
- Bugs found in test stills and fixed before the full render: the studio camera offset had the wrong sign (the hub sat
  at y 1157, so the one-blade capture looked wrong. Diagnosed with a per-row readback, not a simulation fault); the
  phone's capture camera used the camera's local transform (it sat inside the fan); the blade geometry did not scale with
  the rotor radius (the desk fan had zero-length blades); the phone screen was sRGB-encoded twice (washed out; now
  written in linear light); the sky filled the street ghost layer; S04 was framed outside the 3:4 (reframed; that
  render worker was restarted after 3 minutes).
- Render speed was lower than the S02 test: 0.29-0.59 frames/s per worker in the full run (S00 draws two views, S05
  recomputes a capture every frame), versus 0.8 in the test.
- Branch: you asked for `rolling-shutter-short`; the session's default branch was `claude/new-session-jstu55`. I used yours.

## Timing (wall clock, UTC, 5 November 2026)

| Step | Time |
|---|---|
| Read the paper-folding report and pipeline, set up, download Kokoro (< 1 min), WebGL check | ~10 min (06:48-06:58) |
| Voice (14 sentences) | 43 s |
| Engine, studio, S02 look iterations | ~25 min |
| **S02 speed test**: 600 frames on 4 workers | **184 s = 3.3 frames/s** (0.8 per worker) |
| Estimate from that for 9,066 frames | ~46 min (it took longer, see above) |
| Remaining shots and fixes (about 12 rounds of stills) | ~35 min |
| **Full render**, 9,066 frames, 4 workers | **7,458 s = 2 h 04 min (1.22 frames/s)** |
| Cues, SFX + music + master, captions | ~1 min |
| Assemble final + clean copy (x264 slow, CRF 18) | 224 s |
| **Total, start to checked final** | **about 3 h 10 min** (06:48-09:58) |

## Rebuild

From a fresh clone (Linux, Python 3.10+, Node 20+, ffmpeg with libx264 and libass, Playwright with Chromium):

```bash
cd builds/rolling_shutter
./build.sh
```

`build.sh` creates the venv, downloads the two Kokoro files if missing, installs three.js, checks the facts,
synthesises the voice, exports the scene data, records the sound cues, mixes and masters, writes the captions,
renders every frame (`WORKERS=4`; finished segments are skipped on a re-run) and assembles `final.mp4`. Expect about
2 hours of rendering on 4 CPU cores. Run it detached (`nohup ./build.sh &`), so no tool timeout owns it.

| Step | Command | Output |
|---|---|---|
| facts | `.venv/bin/python config/facts.py` | prints and asserts every number |
| voice | `.venv/bin/python tools/tts.py` | `audio/voice.wav`, `cache/timings.json` |
| scene data | `.venv/bin/python tools/export.py` | `cache/data.json` |
| stills | `node tools/capture.js 0 0 stills/x --png 47,53` | PNGs at those times |
| frames | `./tools/render.sh 4` | `renders/picture.mp4` |
| sound | `node tools/cues.js && .venv/bin/python tools/audio.py` | `audio/master.wav` |
| captions | `.venv/bin/python tools/captions.py` | `cache/captions.ass`, `captions.srt` |
| final | `./tools/assemble.sh` | `final.mp4`, `renders/final_clean.mp4` |

Not in Git (re-created by `build.sh`): `.venv/`, `models/`, `web/node_modules/`, `frames/`, `cache/`, `audio/`, `renders/`.

## Files

- `final.mp4`: the Short (captions burned in). `cover.png`: 1080x1920 cover (the hook's picture at 3.4 s, "WHY YOUR
  PHONE / BENDS PROPELLERS" inside the 3:4). `captions.srt`: subtitles for upload.
- `stills/test_S02_47.00.png`, `53.00`, `61.00`, `76.50`: the four S02 test stills (blade up as the line starts; the
  banana growing behind the line under the ghost; the finished curve with the straight ghost on it; the 3-blade pass with
  the ring at 57%). `stills/final_contact_sheet.png`: 20 frames of the final, captions included.
- Code: `config/` (facts, narration), `scenes/` (engine: renderer, propeller, row capture; comp: composite shader;
  studio; view; props: street, car, fan, phone, guitar; shots: the timeline), `tools/` (tts, export, capture, render,
  cues, audio, captions, assemble, plus debug helpers bench/dbg/glinfo), `build.sh`.
