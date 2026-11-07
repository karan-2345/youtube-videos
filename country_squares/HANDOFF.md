# HANDOFF: "Every country as a square" (vertical Short, YouTube Shorts + Instagram Reels)

## Status 2026-11-07: STOP 1 — script, look and a complete first cut, waiting on the user

The user's brief: "a short on the size comparison of countries' area in the form of a square. The first hook should
talk about how each country looks in square form, then show the queue of countries and talk about some of the
largest and a few of the smallest." Format (user pick): vertical Short, about 60–90 s, built with this repo's
pipeline.

Delivered at STOP 1, ahead of the usual order: the whole cut (all five scenes rendered, voice, captions, music,
SFX, master) on script v1, so the user can judge the real thing rather than a look test. Anything they want changed
is a re-export plus a re-render of the scenes it touches (about 3 minutes a scene).

| Scene | Length | What happens |
|---|---|---|
| S00_Hook | 20.0 s | the world map (Equal Earth). "EVERY COUNTRY / AS A SQUARE". Every outline morphs into its equal-area square (biggest first) on "squeezed into a perfect square"; grey "other land" fades; the squares fly into the queue in rank order, flags fade in; Russia "4,135 km"; a whip down the whole queue (counter #1 → #195, motion blur) to Vatican City "663 m", "ABOUT 8 MINUTES ON FOOT" |
| S01_Giants | 23.9 s | Russia + Canada with dimension lines, "+71% MORE AREA THAN CANADA"; Canada / US / China "ALMOST TRIPLETS / WITHIN 4%"; pull back to the first six, a bar "FIRST 6: 47% / OTHER 189: 53%" |
| S02_Middle | 13.3 s | India (#7) with Russia's outline to scale and "5.2×"; trip down to #98 Malawi (counter), "12 MALAWIS = RUSSIA'S WIDTH, 4,135 KM" as 12 flags on a ruler |
| S03_Tiny | 22.4 s | trip to the back: San Marino 7.8 km, Tuvalu 5.1 km, Nauru 4.6 km, "UNDER 8 KM WIDE"; Monaco 1.4 km; Vatican City 663 m; then a zoom all the way back out to Russia, "39 MILLION / VATICAN CITIES FIT IN RUSSIA" |
| S04_Loop | 5.4 s | the squares fly back to the map and turn back into countries, "WHERE IS / YOURS?"; the last frame is S00's first (loop) |

Script v1: `config/narration.src.md` → `narration.md`, 209 words, 82.9 s measured (5 scenes, 4 × 0.5 s
cross-fades). Every number is a fact token; `facts.md` has 12/12 checks passing; `tests/` 15 pass.

## Decisions (with the reasons)

- **Countries:** UN 193 + 2 observers = 195, read from the Factbook's own membership lines (research/notes.md FLAG 1).
- **Areas:** Factbook "total". Morocco without Western Sahara (FLAG 3), Vatican City 0.44 (FLAG 4).
- **Map:** Equal Earth with authalic latitudes, so the squares on the map are exactly to scale with it.
  Neighbours are four-coloured (DSATUR on outline adjacency) in four paper tones.
- **Morph:** each country's largest landmass is resampled to N points (20 km spacing), rotated to match a square's
  N points (least squares), and linearly interpolated. Islands shrink into the square under the mainland.
- **Queue:** bottom-aligned on one baseline, gap = 0.3 × the next square's side, so it looks evenly spaced at every
  zoom. The camera lives in "queue space" (rank in focus, zoom, offset). Long trips move in log-zoom pace and are
  motion-blurred (6 sub-frames).
- **Look "Night atlas"** (PROPOSED): deep ink blue, four paper land tones, flags on the queued squares, one
  vermilion accent for the square being talked about. Type: Inter ExtraBold (the user's pick on the chess Short).
  Captions: Archivo Captions, current word in the accent. Everything inside the middle 3:4 (y 240–1680).
- **Renderer:** Canvas 2D in headless Chromium (tools/capture.py), not three.js: the whole Short is flat 2-D, and this
  cloud machine has no GPU. 8.3–8.6 frames/s on 4 workers.
- **Sound:** a new generated bed (tools/music.py: C maj9 / A m9 / F maj7 / G6/9 at 96 bpm, mallets, sine bass,
  shaker), and SFX (tools/sfx.py): a whoosh on each camera move, a pop per accent and per square landing, a tick
  per change of the rank counter (measured from the browser's own camera by tools/probe.py), a thump under each
  big number, and a chime on arrival at the end of the queue.

## Waiting on the user

1. Script v1 (82.9 s): keep, trim, or change any line.
2. The look: palette, flags on the squares, the map, the type.
3. Anything to add or drop among the largest and smallest (e.g. name Liechtenstein, show Kazakhstan / Algeria).

## File map

| Path | What |
|---|---|
| `build.py` | every step (see its docstring) |
| `tools/build_data.py` | Factbook areas + Natural Earth outlines → `data/countries.json` (195 rows, map shapes, colours) |
| `config/geo.py` | Equal Earth, ring geometry, the morph resampling |
| `config/facts.py` | every number + checks → `facts.md` |
| `config/narration.src.md` | the script (→ `narration.md`) |
| `tools/narration.py`, `tools/tts.py` | script lint/render; Kokoro voice, timings, pronunciation fixes (Nauru, Tuvalu, Liechtenstein) |
| `scenes/export.py` | every scene's key schedule + sound cues, anchored on measured phrases |
| `scenes/web/lib/squares.js` | the one data-driven 2-D scene (map, morph, queue, camera, labels, overlays) |
| `tools/capture.py`, `tools/probe.py` | frame-exact capture; counter ticks |
| `tools/assemble.py`, `tools/music.py`, `tools/sfx.py` | the cut, captions, mix and master |
| `tools/cover.py`, `tools/upload.py` | `renders/final/cover.png`, `renders/final/upload.md` |
| `research/notes.md` | sources and FLAGs |

## Gotchas

- `renders/`, `audio/`, `assets/models/`, `assets/downloads/` and `scenes/web/node_modules/` are not in git
  (README has the setup). The final MP4s are in `renders/final/` on the machine that built them.
- Re-run `build.py export` after `build.py tts`: every key is anchored on measured phrase times.
- `tools/probe.py` (run by `build.py export`) needs the scene JSON to exist; it rewrites the cue sheets in place.
