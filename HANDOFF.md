# HANDOFF: "How fast chess explodes" (vertical Short, YouTube Shorts + Instagram Reels)

## Status 2026-11-03: DONE. STOP 3 approved ("Approve final") on the 2:42 version (script v1)

**Video files not on disk (checked 2026-11-03):** every .mp4 in this project is gone except the look test: `renders/final/` (captioned, clean, silent), `renders/final_v2_75s/`, `renders/scenes/` and `renders/frames/`. The folder timestamps say this happened on 2026-11-01 at 20:21, after delivery; who did it is not known. They are not in the Recycle Bin, Downloads, Desktop, Videos, Documents or OneDrive. Everything else is intact (cover, upload.md, .srt, stems, all code, the audio). To rebuild: `build.py scene <id> --force` for the six scenes (about 1 h 47 min), then `build.py final` (about 20 min), then `tools/remaster.py` only if the master comes out dynamic. The user confirmed on 2026-11-03 that they have their own copy of the final, so no re-render is needed.

After approving the 75 s v2 final, the user said: "that's kinda messed up because it is too much information in
short time i think old duration was good animation is good font wise but i think our old narration was better."
So the Short is rebuilt on **script v1** (`config/narration.src.md`, 445 words, 6 scenes, 162.5 s; the audio was
cached) with the same animation and type (club.js, Inter ExtraBold, 3:4-safe). The v2 final is kept in
`renders/final_v2_75s/` and its script in `research/script_v2_75s.src.md`; there is no separate "second chess
Short" any more (v1 is this one).

| Scene (v1) | What happens |
|---|---|
| S00_Hook 19.4 s | the Giuoco Piano with every legal move as threads, the count to 84,998,978,956 (cinnabar), Lichess x10; rewind to the start; White's 20 threads on "just twenty moves" |
| S01_First 24.2 s | 16 pawn threads, 4 knight threads (counted in the sub-line); the rook, bishops, queen and king nudge and settle ("everything else is boxed in"); Black's 20; 400 |
| S02_Open 23.0 s | "x 20 = 8,000?", 1. e4 e5, 8,902 "not 20 x 400 = 8,000", the 29 moves with the bishop's and queen's in cinnabar; the opening carries on with each move's choices counted (29, 29, 27, 31, 33, 36), then the position with 34 moves: "~30 legal moves in a typical position" |
| S03_Runaway 24.4 s | the real tree grows (20, 400, 8,902, 197,281 games), fog for 119,060,324, 84,998,978,956 and 69,352,859,712,417 (cinnabar), "8,437 for every game Lichess has stored" |
| S04_Shannon 41.3 s | "1950 / Claude Shannon / Programming a computer for playing chess"; ~30, 1,000, 1,000^40, the 120 zeros and 10^120; atoms: the first 80 lit, the last 40 cinnabar; every atom a computer for 13.8 billion years, about 3 x 10^106 games: 106 zeros lit, the last 14 cinnabar, "still about 30 trillion times short" |
| S05_TryIt 32.8 s | 8,848 1/2 moves (the longest game), "29,242 digits ... at least; Shannon's estimate has 121"; 197,281 two-move games, 8 end in mate: f3, e5, g4 and the queen to h4 on a cinnabar arc (king's-side camera); reset, White's 20 threads, last frame = S00's first (loop) |

New in club.js for v1: zeros highlighted in timed phases `[t, lit, accent_from]`; `Board.nudge` (a piece lifts and
settles on its own square). Cover: S03 at 23.9 s (69 trillion). upload.md rewritten for v1 (adds Labelle).

### Final v1 (2026-11-01)

`renders/final/`: `chess_short.mp4` (captions burned in), `chess_short_clean.mp4`, `chess_short_silent.mp4`,
`captions/chess_short.srt`, `stems/`, `cover.png`, `upload.md`.
- Measured: **162.50 s (2:42.5)**, 1080 x 1920 @ 60, -14.0 LUFS integrated (ebur128 on the final file), -1.3 dBTP,
  LRA 2.4 LU; one linear gain (+5.58 dB) after the look-ahead limiter trimmed peaks above -7.7 dBFS.
- The first assembly fell back to dynamic loudnorm (the 0.8 dB limiter margin was too small for this mix), so the
  margin is now 1.3 dB and `tools/remaster.py` redid only the master from the stems and swapped it onto the videos
  without re-encoding the picture.
- 41 caption cards, text identical to the script (checked).
- Loop: last frame = first (start position, "1 / before the first move"): mean difference 1.69 / 255, no 60 px block
  above 3.4 / 255 (film grain).
- Renders (3 workers, 1.5-1.7 frames/s): S00 788 s, S01 875 s, S02 862 s, S03 998 s, S04 1627 s, S05 1246 s (1 h 47 min).
  `build.py final` about 20 min.
- Checked by eye: 30 frames of the captioned final (every beat, the atom computers, the nudge, the fool's mate), the
  cover full frame and its 3:4 crop. Audio checked by measurement only, not by listening.

### Before that: the 75 s v2 final (approved, then replaced)


Final built with STOP 2 skipped at the user's request; the user approved it the same day.

The user approved the Inter ExtraBold look test and said "build final video like this sample", so, as with the
card Short, there was no separate STOP 2 sample: all five scenes were built and rendered, then the final, the cover
and upload.md. (Results and measurements: see "Final" below.)

How the scenes are built: `scenes/3d/lib/club.js` is ONE data-driven scene (room and pieces from lib/board3d.js,
pieces on a key schedule, move threads, the count / label / sub-line in Inter ExtraBold, the real game tree with the
fog beyond ply 4, Shannon's zeros, camera / exposure / lamp keys). Each `scenes/3d/S0x_*.js` is a one-line stub;
everything it shows comes from `scenes/3d/export.py` (`Board`: real moves from config/chess.py with ids, rewinds,
thread groups and sound cues; one exporter per scene, every time a phrase anchor on the measured narration).
`LookA` (the look test) keeps its own JS and the older `Game` class.

| Scene | What happens |
|---|---|
| S00_Hook 16.0 s | the Giuoco Piano played ply by ply, every legal move as a thread, the count snapping to each exact value, 84,998,978,956 in cinnabar on "85 billion"; "10 x every rated game / ever played on Lichess: 8,220,312,882"; then the game rewinds to the start and the count steps back down to 1 |
| S01_Twenty 10.7 s | White's 16 pawn threads, then 4 knight threads ("16 pawn moves + 4 knight moves"), Black's 20, then 400 |
| S02_Climb 24.0 s | 1. e4 e5, White's 29 moves with the bishop's and queen's new ones in cinnabar ("not 20 x 400 = 8,000"); the board rewinds, the camera turns to the real tree growing out of it (20 / 400 / 8,902 / 197,281 dots, 1. e4 e5 2. Nf3 Nc6 traced); "beyond 2 moves each: too many to draw" fog rises for 119,060,324 and 84,998,978,956 (cinnabar, held 3 s) |
| S03_Shannon 13.7 s | the Giuoco Piano position after 8 plies (34 legal moves, all threads): "30 / choices in a typical position / in this position: 34", "1,000 / for each pair of moves / 30 x 30 = 900, about 1,000", "1,000^40", then the 120 zeros type out and 10^120; the board darkens and drops below the zeros |
| S04_Atoms 12.8 s | the first 80 zeros brighten ("atoms in the observable universe: about 10^80"), the last 40 turn cinnabar ("40 more zeros"); everything clears, the pieces rewind to the start, White's 20 threads glow, and the last frame is S00's first (start position, "1 / before the first move") |

Audio: wooden knocks per landing and rewind, ticks per count and thread, a firmer knock on 85 billion, typing
ticks for the zeros (`tools/sfx.py` reads the cue rows from each scene's JSON); the music bed is retuned for this
Short (`tools/music.py`: D minor 9 / B-flat maj7 / F maj7 over A / C add9, 78 bpm). Captions: word captions in
Archivo Captions (static ExtraBold semi-condensed cut, `tools/make_fonts.py`), current word in cinnabar.

### Final (2026-11-01)

`renders/final/`: `chess_short.mp4` (captions burned in), `chess_short_clean.mp4`, `chess_short_silent.mp4`,
`captions/chess_short.srt`, `stems/` (voice, sfx, music, master, per scene), `cover.png`, `upload.md`.
- Measured: **75.20 s**, 1080 x 1920 @ 60, -13.9 LUFS integrated (ebur128 on the final file), -1.65 dBTP master,
  LRA 3.1 LU; one linear gain (+5.58 dB) after the look-ahead limiter trimmed peaks above -7.2 dBFS.
- 19 caption cards, text identical to the script (checked); word captions in Archivo Captions, current word in
  cinnabar, inside the caption band.
- Loop: the last frame matches the first (start position, "1 / before the first move"): mean difference 1.8 / 255,
  no 60 px block above 3.2 / 255 (film grain).
- Renders (3 workers, 1.5-1.6 frames/s): S00 618 s, S01 414 s, S02 984 s, S03 528 s, S04 ~435 s; frame-jump check 0
  on every scene. `build.py final` (assemble only) 8 min.
- Checked by eye: 18 frames of the captioned final (every beat, the 85-billion hold, the 40 cinnabar zeros), the
  cover full frame and its 3:4 crop. Audio checked by measurement only, not by listening.
- Cover: S02 at 23.4 s (84,998,978,956 over the tree and fog) with "HOW MANY GAMES / OF CHESS ARE THERE?" in Inter
  ExtraBold on the table, inside the 3:4 crop.

### Before that: STOP 1 approved except the on-screen type

The user on v2: "everything is good but i dont like that information font at top of the animation its look too
infographic, try inter ExtraBold make sure the aspect ratio is between 16:9 or 4:3". Asked what the ratio meant,
they chose: **keep the 9:16 Short, with everything inside the middle 3:4 (y 240-1680)**, Instagram's grid crop
(`SAFE_34_Y` in `config/style.py`). Done in the look test: every number and label is Inter ExtraBold (Inter 4.001
variable copied from this laptop's installed fonts into `assets/fonts`, no download), centred, numbers fitted to
960 px, short uppercase labels; the hairline rule, letterspaced labels, serif numbers, italic notes and the
Lichess bars are gone (the Lichess comparison is two label lines). Captions unchanged (Archivo). Re-rendered:
`samples/look/A_clubroom.mp4` and all stills; `samples/look/crop34_sheet.png` shows them cropped to 3:4.
Source Serif 4 is no longer used, so the font download is only Archivo for the captions (0.66 MB; the user's
"everything is good" covers it; fetch it when STOP 2 starts). Poly Haven chess set still optional, not fetched.
Next: the user's go-ahead on the new type, then STOP 2 (S02_Climb).

### Before that: script v2

**Script v2 (current).** After STOP 1 the user approved a combined direction (relayed by the parent session): v1's
hook and accuracy plus a friend's 50 s Reel structure (one rising line, one number per beat, a held climax on 85
billion, Shannon in one clause, the atoms, a loop ending), in 3D, not SVG. The friend's prompt (Remotion/SVG, Inter,
glows, starfield) was read for reference only. v2: `config/narration.src.md` -> `narration.md`, 185 words, 5 scenes
(S00_Hook 16.0, S01_Twenty 10.7, S02_Climb 24.0, S03_Shannon 13.7, S04_Atoms 12.8 s), **75.2 s measured**
(`samples/narration_v2.wav`). The brief said "about 60-70 s"; every beat in it is there, and the big numbers set
the length. Dropping the hook's second line ("by the end of a game, more of them than atoms in the universe", the
retention line that says where the Short ends up) would give about 70.6 s: the user's call, not cut. "85 billion"
is spoken at 4.8 s, the climax holds 2.2 s, every sentence opens with a link. `research/beat_plan.md` is v2.
New look-test stills for the new shots: `D_tree.png` (the real game tree to two moves each, 197,281 games, the
hook's game traced; `game_tree()` in export.py) and `E_clouds.png` (10^80 speck inside a 10^120 cloud);
recommended for S04 is the zeros still `C_shannon.png` instead of the clouds.

**Second chess Short (saved, not in this one):** script v1 (2:42) in `research/script_v1_second_short.src.md` (+
`.rendered.md`, audio `samples/narration_v1_second_short.wav`): Shannon's 1950 backstory, the 69-trillion beat,
the atom computers since the Big Bang (30 trillion times short), Labelle's 8,848.5-move game and 29,000-digit count,
the fool's mate (still `B_foolsmate.png`). Its facts stay in `config/facts.py`.

### Earlier: STOP 1 with script v1

Topic picked by the user from four chess angles: **the game-tree explosion** (the others were the knight's tour,
eight queens and the wheat and chessboard). The project was built from `kaprekar_short` (the newest pipeline) plus
`shuffle_short/scenes/3d/lib/table.js`; junctions for `.venv`, `assets\models` and `scenes\web\node_modules` point
to `..\satellite_communication`. The copy was a whitelist of named files (no junction was followed).

### STOP 1 deliverables

- **Maths.** `config/chess.py`: our own legal move generator (0x88; castling, en passant, promotions; SAN). It
  matches the published perft tables: the start position to ply 6 (119,060,324; 4.6 min on four cores, cached in
  `renders/cache/perft.json`), the ply 4-5 counters (captures, checks, e.p., 8 and 347 checkmates), five more CPW
  test positions, and the distinct positions after 3 and 4 plies (OEIS A083276). `config/tree.py` caches the slower
  counts (`renders/cache/tree.json`). `config/cosmos.py`: atoms in the observable universe from Planck 2018
  (7.2 x 10^79), age 13.79 billion years, radius 46.1 billion light years.
- `config/facts.py` -> `facts.md`: **18/18 checks pass**; `tests/`: **28 pass**.
- **Script v1** (now the second Short, see above): 445 words, 6 sections, **2:42.5 measured** (full TTS:
  S00 19.4, S01 24.2, S02 23.0, S03 24.4, S04 41.3, S05 32.8 s, minus 5 x 0.5 s cross-fades). Under the 3-minute
  cap; the longest of the three Shorts (6174 ran 2:39), because big numbers take many spoken words ("197,281" is
  nine). Not trimmed (user rule). The hook says "85 billion" at 4.8 s and the Lichess comparison by 10 s. Every
  sentence opens with a link (first words checked). Whole narration: `samples/narration_v1_second_short.wav`.
  Voice af_heart 0.95. "Lichess" is spoken from IPA (LEE-chess).
- `research/notes.md`: 12 sources, 10 FLAGs. `research/sources/lichess_database_2026-11-01.html`: the saved page
  for the 8,220,312,882 rated games. `research/beat_plan.md`: now v2 (5 scenes).
- **Look test A "Club room"** (`samples/look/`): `A_clubroom.mp4` (11.6 s, the hook's first sentence: a real
  Giuoco Piano played ply by ply, every legal move as a thread, the count racing to 84,998,978,956 in cinnabar as
  "85 billion" is spoken, then the Lichess bars), with the real hook voice and synthesized wooden knocks; stills
  `A_hook_*.png`, `B_foolsmate.png`, `C_shannon.png`, `contact_sheet.png`. The count snaps to each exact perft
  value as the piece lands (no rolling in-between numbers). Clip render: 462 s on 3 workers (1.5 frames/s, slower
  than the 6174 board: shadows + 4 motion-blur samples at 1.5x). Clip sound: -14.5 LUFS, -1.5 dBFS peak
  (loudnorm only; not the final master). Built in `scenes/3d/LookA.js` + `scenes/3d/lib/board3d.js`
  (procedural walnut/maple board, lathe-turned Staunton pieces, extruded knight head), data from `export.py`
  (`Game` class), sound `tools/look_audio.py` + `tools/sfx.py` (tok / thock / tick).
- `config/style.py`: palette and fonts marked PROPOSED (Source Serif 4 + Archivo; the look test loads them from
  Google Fonts).

### Waiting on the user

1. Script v2 approval (75.2 s).
2. Look A approval.
3. Downloads (need an explicit OK):
   - Fonts from github.com/google/fonts (SIL OFL): `SourceSerif4[opsz,wght].ttf` 1,209,508 B,
     `SourceSerif4-Italic[opsz,wght].ttf` 855,432 B, `Archivo[wdth,wght].ttf` 658,596 B, two `OFL.txt`
     (4,400 + 4,388 B): **2.7 MB** total. Then `tools/make_fonts.py` cuts a static Archivo caption instance.
   - Optional: Poly Haven "Chess Set" by Riley Queen (CC0), https://polyhaven.com/a/chess_set, geometry only
     (`chess_set_1k.gltf` + `chess_set.bin`, **1.8 MB**; all 1k textures would be 7.0 MB but are not needed). It is a
     marble "vintage" set; only its knight (and maybe the other shapes) would replace ours, re-skinned in our wood.
     Our extruded knight reads as a flat slab from some angles (look-test still B, g1). Without the download, the
     alternative is a better procedural knight (lofted sections), about an hour more. In v2 the knights are never
     in close-up (the fool's-mate shot moved to the second Short), so this download matters less.
4. S04 picture: the zeros (recommended, `C_shannon.png`) or the two clouds (`E_clouds.png`).

## Next (after approval)

1. Fonts into `assets/fonts`, FONT_FILES in `config/style.py`, a static caption instance (`tools/make_fonts.py`);
   the scenes load local fonts instead of Google's.
2. STOP 2: one fully mixed sample scene, proposed **S02_Climb** (the real tree growing a ply per beat, the count
   to 84,998,978,956 and the 2.2 s hold). Needs a chess music bed (`tools/music.py` is still the 6174 one), event anchors in
   `config/events.py`, and the captions' accent word.
3. STOP 3: all six scenes, final, cover (`tools/cover.py`), `upload.md` (`tools/upload.py`); both still carry 6174
   text and need rewriting, as does `tools/samples.py`.

## Gotchas

- `config/chess.py` is hashed for the perft cache: editing it invalidates ply 6 (re-run `python -m config.chess
  cache 6`, ~5 min, before `build.py facts`, or facts will start it itself).
- Bash heredocs mangle backslashes and quotes: write Python edit scripts with the Write tool.
- Print Kokoro phonemes with `PYTHONIOENCODING=utf-8`.
- three r186 has no PCFSoftShadowMap (it falls back to PCF); use `THREE.PCFShadowMap`.
- LineMaterial widths are in render-target pixels: the post pass renders at 1.5x (1620 x 2880).
