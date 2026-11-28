# CLAUDE.md: how to make a "Cut-away" Short in this repo

Read this first in every new chat. The user makes short 3D-animated "how it works" videos for YouTube Shorts and
Instagram Reels: the same genre as Zack D. Films (one surprising fact, about 30-40 s), but in our own look, with our own
characters and scripts. Never copy another channel's characters, style, scripts or titles.

The user writes short messages in simple English. Answer in short, plain sentences. Show pictures (stills, contact
sheets) instead of describing them.

## Where things are

| Folder | What |
|---|---|
| `tattoo_short/` | Short 1: why tattoos don't wash off (done) |
| `wrinkle_short/` | Short 2: why fingers wrinkle in water (done, v2 with the realistic finger) |
| `shrimp_short/` | Short 3: the pistol shrimp's snap (the newest; copy from this one) |
| repo root (`build.py`, `scenes/`, `config/`, ...) | an older, longer chess Short on a different pipeline: leave it alone |

Each Short folder has `README.md` (what happens, commands), `HANDOFF.md` (status, measurements, decisions, gotchas),
`research/notes.md` (every claim with its source and FLAGs) and `final/` (the delivered video, clean video, .srt,
cover and upload notes, kept in git).

## The workflow (stop for the user's OK at the two marked steps)

1. **Topic.** Offer 4 topics with AskUserQuestion. For each, give the hook sentence, the mechanism in one line, what we
   would show, and mark one "(Recommended)". Prefer solid, surprising science that the "Cut-away" look can show (the
   real thing first, then a slice of it). Check that Zack D. Films hasn't made it: search their channel
   (`@zackdfilms`) with vidIQ if it has credits, otherwise web search, and say that a web search isn't conclusive.
   Already covered by them (drop): knuckle cracking, bruises, onions, goosebumps, quicksand.
2. **Research.** Find the primary papers and write `research/notes.md`: one row per claim, the source, and FLAGs for
   anything contested or estimated. The script must not say more than the sources do.
3. **Script, STOP 1.** Write `config/narration.src.md` (about 95-100 words, 4-5 beats, one scene per beat, about 35 s)
   and `research/beat_plan.md` (what each scene shows). Rules: the hook lands in the first sentence; every sentence
   starts with a connective or an explicit link to the one before; no fragments, colon reveals or mic-drop kickers;
   every spoken number is a `{{fact}}` token from `config/facts.py`. Send the script as a table (scene, narration,
   what you see) with the careful-wording notes, commit it, and wait for "approved".
4. **Build.** Copy the newest Short folder (see "Starting a new Short" below). `python build.py tts` measures the
   voice; put phrase anchors in `scenes/3d/export.py`; write the actors in `scenes/3d/lib/<topic>.js` and one file per
   scene (`scenes/3d/S0x_*.js`, every event on a phrase anchor). Check key moments with
   `python build.py stills <scene> t1 t2 ...` and look at the PNGs before rendering anything.
5. **Render.** `python build.py scenes --workers 3`, run in the background (about 1-1.5 h on the cloud machine's
   software WebGL). Then contact sheets of every scene, `build.py final`, and check: loudness about -14 LUFS (ebur128
   on the final file), caption text == script, the loop (first frame vs last frame of the _clean video), a contact
   sheet of the captioned final. Then `build.py cover`, `build.py upload` (fix the .srt path in upload.md to
   `<name>.srt`), copy the deliverables to `final/`, write the Final section of `HANDOFF.md`.
6. **Deliver, STOP 2.** Commit, push, send the video and the cover with SendUserFile, and summarise in a few lines.
   Changes the user asks for afterwards go in as v2 (keep the HANDOFF honest about what changed).

## The look ("Cut-away")

- 1080 x 1920, 60 fps. Everything that matters stays inside the middle 3:4 (y 240-1680), Instagram's grid crop.
  Word captions sit in the band y 1330-1490, so labels and subjects stay above it.
- The real thing first, then a clean slice or block cut out of it, lit like a specimen. One idea per scene.
- Labels: Inter ExtraBold, short, uppercase, on dark pills (`.lab` in `scenes/web/overlay.css`). Cinnabar `#E0502F`
  is the one accent: the spoken word in the captions and the one label that matters per scene.
- One concept = one colour in every scene (`config/style.py`), and every coloured thing is also labelled.
- Hedges on screen too: if the script says "might" or "estimated", a label says so (STILL DEBATED, ESTIMATED).
- The last frame equals the first frame (the loop). Drive all ambient motion from a time that is 0 at both ends.
- Voice: Kokoro `af_heart` at 0.95. Music: the series' marimba bed (`tools/music.py`) moved to a new key for each Short.
  Every sound effect is synthesized in `tools/sfx.py` (no third-party audio); scenes list their cues as
  `[t, sound, dB, (length)]`.

## Starting a new Short

Copy from the newest folder: `.gitignore`, `build.py`, `config/` (`__init__.py`, `events.py`, `facts.py`,
`style.py`), `tools/*.py`, `scenes/web/` (not `node_modules`), `scenes/3d/export.py`, `scenes/3d/lib/cut.js`,
`assets/fonts/`. Symlink `assets/models` -> `../../tattoo_short/assets/models` and `scenes/web/node_modules` ->
`../../../tattoo_short/scenes/web/node_modules`. Then rename: the output name in `build.py` (`cmd_final`), the title in
`tools/narration.py`, the palette and `SCENE_ORDER` in `config/style.py`, `tools/cover.py` (frame and title lines),
`tools/upload.py` (titles, description, sources, hashtags, pinned comment), `tools/music.py` (new key).

## Technical gotchas

- Rendering is three.js in headless Chromium with SwiftShader (no GPU): about 0.5 frames/s on 3 workers. Keep shaders
  cheap, avoid transmission and extra render passes, and check stills before a full render.
- Every frame is a pure function of t: no `Math.random`, no clock (use `rng(seed)` from `runtime.js`).
- Motion-blur sub-frames can ask for negative times, so wrap phases as `((x % 1) + 1) % 1`.
- A scene's `setup()` returns `{scene, camera, post, blurSamples, update(t), cues}`; `look(t)` can change exposure.
- Labels and HUD discs are placed in pixels; keep them inside x 64-1016 and y 240-1300.
- `renders/`, `audio/`, `narration.md`, `assets/models` and `node_modules` are git-ignored; `final/` is committed.

## Git and privacy

- Work on the branch the session names, commit with the attribution lines the session gives, and push. Don't open a
  pull request unless the user asks.
- No model names or IDs in commits or files. The user's email and personal details stay private.
