# HANDOFF: "The man who sold ice to the tropics" (the Ice King Short)

## Status

**Delivered 2026-11-27.** Final `renders/final/ice_short.mp4`: 1080x1920, 60 fps, 4142 frames, 69.03 s; -13.9 LUFS integrated, true peak -2.1 dBTP (linear) / -1.5 dBFS sample peak; SRT text equals `narration.py` (201 words); loop seam (frame 4141 -> 0) mean difference 3.8 levels, the same as an ordinary frame step. Full render 3608 s on 3 workers (1.15 frames/s); the first 90 frames were re-rendered with motion blur and spliced in. The user hasn't said yet whether it's uploaded.

The user picked idea 3 from `IDEAS.md` ("the man who sold ice to the tropics") and gave the hook, used word for word.
Voice: Kokoro `af_heart`, speed 0.95.

## Script (`config/narration.py`, 201 words, 69.0 s)

| Beat | What happens on screen |
|---|---|
| hook | Golden hour in the Caribbean: a brig with her hold cut open on a cargo of glowing pond ice in sawdust ("1806", "ICE FROM A BOSTON POND"); the camera rises to Martinique ahead ("→ MARTINIQUE"); the town laughs on the pier at Tudor and his ice; an antique globe: the 1806 route, then the route round Africa to India ("30 YEARS LATER", "BOSTON → INDIA"). |
| flop | Tudor on the pier (name card); the Boston Gazette of 1806, "a slippery speculation" underlined in red; inside the hold the loose ice melts; on the pier the blocks melt into puddles ("NOWHERE TO STORE IT"). |
| debt | "−$4,500"; a debtors' cell, Tudor on the bench in a sunbeam ("DEBTORS' PRISON 1812–1813"), looking up on "still didn't give up". |
| secret | One big block vs the same ice in 27 small pieces melting on the pier ("BIG MELTS SLOWER"); a Boston pond in winter scored into a grid ("CUT SQUARE"); blocks drop tight into the hold and sawdust pours over them ("PACKED TIGHT", "IN SAWDUST", "FREE FROM THE SAWMILLS"). |
| india | The three-masted Tuscany on the Atlantic ("1833", "180 TONS", the name on her bow); the buried ice shrinking ("DAY 1 → 120"); the globe: the route crosses the equator twice (it flashes); the hatch opens on the ice left ("100 TONS STILL FROZEN"). |
| king | Calcutta: the crowd round the ice on the quay; the ice house rises (time-lapse); a crown of ice grows on a block ("THE ICE KING"). |
| end | A glass of iced drink on the brig's rail, a cube clinks in; the camera pulls back along the hook's own path into frame 0 (loop). |

## Decisions

- **Facts** (`config/facts.py`, `facts.md`, ALL PASS): Tudor (born 1783; 1806 Martinique voyage; debtors' prison
  1812–1813; the Ice King); the Boston Gazette notice; the first voyage's loss (about $4,500); sawdust as free
  insulation; the Tuscany (May–September 1833, about 180 tons loaded, about 100 tons arrived); Calcutta's ice house by
  subscription. Web pages could not be fetched from this environment; facts come from search summaries quoting them.
- **Simplified:** "everyone laughed" (the newspaper's mockery); "thirty years later" (27, rounded); "a slippery plan"
  (the paper said "speculation"); the ships are generic; Tudor is a figurine, not a likeness; the race between a big
  block and small pieces is a demonstration of the physics, not something Tudor filmed.
- **Look:** painted-figurine people (`lib/figures.js`), a Gerstner-wave sea with a ship's wake and shore foam from a
  land height texture (`lib/ocean.js`, `lib/harbour.js`), instanced melting ice blocks (rounded box in the vertex
  shader, `lib/ice.js`), an antique globe with real coastlines (world-atlas land-50m, `tools/landmap.py`).
- **Loop:** the brig's position and the sea's time are `t` in the first half and `t - D` in the second; the last
  shot (the glass on the brig's rail) pulls back along the hook camera's own path (keys at negative time), so it lands
  in frame 0. The music is 36 bars of 6/8 (9 phrases), its reverb and the effects' tails wrap onto the start.
- **Bugs met (see CLAUDE.md lessons):** sets 40 km from the origin broke every shader's noise (float precision): keep
  sets within a few km; a sky dome moved in `onBeforeRender` must update its own matrices there; `half` is a reserved
  word in GLSL ES; a camera computed before the objects it follows are updated lags a frame.

## Files

| Path | What |
|---|---|
| `scenes/3d/Ice.js` | the timeline: sets, shots, cameras, overlays |
| `scenes/3d/lib/ship.js` | the brig / ship: lofted hull, cutaway hold with ice in sawdust, masts, sails, rigging, riding the waves |
| `scenes/3d/lib/ocean.js` | sky + Gerstner sea (reflections, glitter, wake, shore foam), `waveAt` in JS |
| `scenes/3d/lib/harbour.js` | Saint-Pierre and Calcutta: terrain, pier, houses, palms, ghats |
| `scenes/3d/lib/figures.js` | 1800s people: coats, top hats, turbans, skirts; laugh / amazed / walk poses |
| `scenes/3d/lib/ice.js` | melting ice blocks, puddles |
| `scenes/3d/lib/rooms.js` | the hold, the prison, the pond, the study (Gazette), the glass |
| `scenes/3d/lib/globe.js` | the antique globe with the routes |
| `tools/sfx.py`, `music.py` | sea, gulls, creaks, laughter and "ooh" (formant synthesis), clinks; a 6/8 shanty bed |
