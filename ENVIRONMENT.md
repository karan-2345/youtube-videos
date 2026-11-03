# ENVIRONMENT.md: toolchain, measurements, and why each scene uses what it uses

Checked on 2026-09-24/25. Re-verify at any time with `python build.py doctor --webgl`.

## Machine

| | |
|---|---|
| CPU | Intel Core i5-8350U, 4 cores / 8 threads, 1.7 GHz (laptop) |
| RAM | 7.9 GB |
| GPU | Intel UHD Graphics 620 (integrated), no CUDA or discrete GPU |
| Disk | ~55 GB free on C: |
| OS | Windows 11 Pro |

**Resolution decision: 1920×1080 at 60 fps.** 4K would quadruple Manim's Cairo cost and the
capture cost on a 4-core laptop with an integrated GPU, so it is not comfortable here.

## Installed and verified

| Tool | Version | Status |
|---|---|---|
| Python (project venv `.venv`, created with uv) | 3.13.2 | new venv |
| Manim Community (Cairo renderer) | 0.21.0 | installed in venv |
| numpy / scipy / matplotlib | 2.5.3 / 1.18.1 / 3.11.2 | installed in venv |
| cartopy / shapely / pyproj | 0.26.0 / 2.1.2 / 3.8.0 | installed in venv |
| skyfield / sgp4 | 1.55 / 2.27 | installed in venv (used to *validate* our orbit code) |
| Playwright (Python) + Chromium build 1243 | 1.63.0 | installed; Chromium download ~196 MB |
| kokoro-onnx + model `kokoro-v1.0.onnx` + `voices-v1.0.bin` | 0.6.1 | installed; model files 326 MB + 28 MB in `assets/models/` |
| three.js / GSAP (npm, `scenes/web/node_modules`) | 0.186.1 / 3.15.0 | installed, 29 MB |
| ffmpeg | 8.1.2 (gyan.dev full build, includes libass, libx264) | already present |
| LaTeX | MiKTeX 25.12, pdfTeX 4.23, dvisvgm 3.4.3 | already present |
| Node.js / npm | 22.18.0 / 10.9.3 | already present |
| Fonts | Inter (variable + statics), JetBrains Mono | already present |
| Blender | none | **not installed** (see below) |
| ElevenLabs | no `ELEVENLABS_API_KEY` found | not used |

No single install exceeded the 500 MB threshold. The largest was the Kokoro model at 326 MB.

## Measurements that drove the decisions

| Test | Result |
|---|---|
| Headless Chromium WebGL | **Hardware-accelerated**: `ANGLE (Intel UHD Graphics 620, Direct3D11)` |
| three.js render only (1,584 instanced satellites + shaded 256×128 sphere) | **~10 ms/frame** |
| Frame capture, Playwright `page.screenshot` PNG | 263–293 ms/frame |
| Frame capture, CDP `captureScreenshot` with `optimizeForSpeed` | **90–175 ms/frame**, used in production with 3 parallel workers |
| Kokoro TTS on CPU | real-time factor ≈ 0.8 (9 min of narration ≈ 8 min to synthesize) |
| Manim + LaTeX, `cmbright` sans maths | **broken**: dvisvgm drops the glyphs |
| Manim + LaTeX, `sfmath` sans maths | works, and pairs well with Inter → chosen |
| Kokoro phonemes | "LNB" → *el-en-bee* ✓, numbers with commas and decimals ✓, "1945" → *nineteen hundred forty-five* ✗ (fixed by a speech-only override in the TTS step, captions unaffected) |

## Tool per scene, and why

| Scene | Tool | Why this tool |
|---|---|---|
| S00 Cold open | three.js (Playwright capture) | A continuous 5 m → 120,000 km pull-back needs a real 3D camera and a logarithmic depth buffer. Real-time on the iGPU, deterministic via `setTime(t)`. |
| S01 Title | Web: HTML/CSS + GSAP, same capture harness | Real typography (Inter, kerning, tracking) and seekable GSAP timelines (`tl.seek(t)`) give frame-exact kinetic type. |
| S02 Line of sight | Manim | Exact 2D geometry (tangents, caps) driven by `ValueTracker`s, plus equations. Manim's strength. |
| S03a Orbits to scale | three.js | True-scale 3D orbits and the rotating-frame "GEO freezes" reveal need a 3D camera. |
| S03b Kepler's law | Manim | A graph, a moving dot and equations. |
| S03c Trade-offs | Manim + cartopy basemap | Latency race and table in Manim; the footprint map is a cartopy-rendered basemap with geodesic circles computed in numpy. |
| S04 Transponder | Manim | Block diagram, spectrum inset and log bars: 2D and explanatory. |
| S05a Inverse square | three.js | The 1-4-9 area law is a 3D effect. A 2D version would wrongly suggest 1/r. |
| S05b Path loss | Manim | Equation transforms and log ladders. |
| S06a Access schemes | Manim | Time-frequency canvas morphs, waveforms and correlation (real Walsh and GPS C/A codes from numpy). |
| S06b Spot beams | three.js | Beams must be projected onto a sphere, where they stretch toward the limb correctly. That needs a shader. |
| S07 Link budget | Manim | Waterfall chart with camera follow: 2D data visualisation. |
| S08a Satellite TV | three.js | Parallax between a moving Earth, a fixed satellite and many dishes. |
| S08b GPS | Manim + cartopy | Ground tracks on a basemap, ranging circles and a sky plot. |
| S08c LEO constellation | three.js | 1,584 instanced satellites, laser links and computed handovers: a 3D hero shot. |
| S09 Recap | Web typography over a three.js plate | Kinetic type composited over the S03a assets. |
| Compositing, captions, mix | ffmpeg (`xfade`, `sidechaincompress`, `loudnorm`, `subtitles`) | One tool, scriptable, deterministic. |
| Voice | Kokoro (local, Apache-2.0) | Best local quality available, no network or licence issues for YouTube, and word-exact captions because text and audio come from the same beats. |
| SFX, music | numpy synthesis | Fully owned. There are no third-party audio licences. |
| Orbital positions | Our own Kepler/Walker code (`config/orbits.py`) | Brief requirement. Validated against skyfield's two-body propagator (2 µm agreement) and against SGP4 (30 km after a full LEO orbit, due to J2; see facts.md). |

## Tools considered and not used

| Tool | Decision |
|---|---|
| **Blender** (brief's first choice for 3D) | **Not installed; recommend skipping.** The download is ~350 MB and ~1.2 GB unpacked, over your threshold, so I'm asking rather than installing. On a UHD 620, Eevee at 1080p is expected to take seconds per frame and Cycles minutes per frame, and a 30 s hero shot at 60 fps is 1,800 frames. three.js renders the same stylised look in ~10 ms. **If you want it anyway:** only S08c (hero shot) and S00 would move to Eevee, at about 1–3 h of extra render time. |
| Remotion / Motion Canvas | Node is available, but only two scenes (title and recap) are typography. They run through the same Playwright harness as the 3D scenes, with GSAP timelines and the same `style.css`. That avoids a second ~300 MB renderer doing the same job (headless Chrome + screenshots). Easy to switch if you prefer Remotion. |
| Manim `ThreeDScene` | Fallback only. The Cairo 3D renderer is slow and flat-shaded. |
| edge-tts | Online service with unclear terms for commercial YouTube use. Kokoro is local and Apache-2.0. |
| Piper | Works offline but sounds noticeably less natural than Kokoro. |
| Photoreal NASA Blue Marble texture | Available (public domain, 1.9 MB at 5400×2700), but a photoreal Earth clashes with the flat Manim diagrams. **Stylised Earth recommended**; Blue Marble is kept as an option. |

## Assets (downloaded after approval)

| Asset | Source | Licence | Size |
|---|---|---|---|
| Land, lakes, coastlines 1:50m | Natural Earth (via cartopy) | Public domain | < 5 MB |
| Night lights: Black Marble 2016, 3 km | NASA Earth Observatory | Public domain (NASA) | 8.1 MB |
| (optional) Blue Marble Dec 2004, 5400×2700 | NASA Visible Earth | Public domain (NASA) | 1.9 MB |

## Measured on the test clip

| | |
|---|---|
| three.js scene S03a (36 s, 2,161 frames), 3 capture workers | ~5 min wall (≈ 7 frames/s) |
| Manim scene S03b (28 s, 1,677 frames), Cairo, 1080p60 | ~20 min (live text readouts re-typeset every frame) |
| JS orbit propagator vs `config/orbits.py` (selfTest) | max difference 4 × 10⁻¹⁵ Earth radii |
| Final loudness after 2-pass loudnorm | −14.2 LUFS integrated, −1.0 dBTP |

## Known quirks

- A single shared HTTP server refused connections when 3 browsers loaded modules at once (Windows'
  default listen backlog is 5). Each capture worker now runs its own server with a 256 backlog.
- Captions use libass with `fontsdir=C:/Windows/Fonts` and the static face "Inter 24pt SemiBold".

- Python 3.13 prints `SyntaxWarning` lines from `pydub` (a Manim dependency). They are harmless.
- On Windows, set `PYTHONIOENCODING=utf-8` when printing IPA phonemes to the console.
- Playwright pins its own Chromium (build 1243). The older cached build 1208 is unused.
