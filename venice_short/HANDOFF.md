# HANDOFF: "Venice stands on a forest" (Venice Short)

## Status

In progress (2026-11-28). Measurements are filled in at delivery.

The user picked the Venice idea from `IDEAS.md` and gave the hook, used word for word: "Venice is standing on
millions of tree trunks that were hammered into the mud more than a thousand years ago, and they should have rotted
away long ago, but they're still holding the city up." Voice: Kokoro `af_heart`, speed 0.95.

## Script (`config/narration.py`, 195 words, 65.3 s)

| Beat | What happens on screen |
|---|---|
| hook | Golden light on Santa Maria della Salute, a gondolier rowing past striped mooring poles; the front of the diorama is cut open like a glass tank: green canal water, grey-brown mud, and the forest of posts in the mud ("VENICE / STANDS ON A FOREST"). "Millions of tree trunks": the posts light up in a sweep ("POSTS DRAWN BIGGER · NOT TO SCALE"). "Hammered": every post jumps and slams back with mud puffs. "1,000+ YEARS". "Should have rotted": desaturated, the posts rot white and crumble, the church sinks and leans ("WHAT SHOULD HAVE HAPPENED"); "but": rewind; "holding": a pulse up the posts ("STILL HOLDING THE CITY UP"). |
| lagoon | Time runs back: the city un-builds from the top (glowing seam), the planks lift off, the posts pull out; salt-marsh islands rise with reeds, settlers' boats arrive, huts pop up ("~1,500 YEARS AGO", "A SHALLOW LAGOON"); down the cut: mud all the way ("NO ROCK" ✗), "WATER", a stake sinking into "SOFT MUD". |
| piles | A forest grows on the lagoon ("WHOLE FORESTS") and falls toward the camera in a wave; the trunks float up, lose their needles and are sharpened ("SHARPENED"), turn tip-down ("TIP FIRST"); a pile-driving crew on a raft hauls a rammer and drives one post while the whole forest is hammered in behind ("HAMMERED IN"); top-down on the post heads ("SIDE BY SIDE"), the mud between darkens ("PACKED FIRM"); planks drop on, stone courses rise, the church builds itself up ("WOODEN PLANKS", "STONE"). |
| salute | The finished church ("SANTA MARIA DELLA SALUTE", "BUILT 1631"), its bell; the camera plunges through the water to the posts; a counter to "1,100,000+" "WOODEN POSTS UNDER ONE CHURCH" as the posts light up. |
| rot | A garden fence post in the open air: oxygen molecules drift ("O₂ OXYGEN"), white fungal threads climb from the ground, mushrooms and brackets grow ("FUNGI"), "YEAR 1 → 5", the post crumbles and falls ("A FEW YEARS"). |
| secret | Back at the cut: oxygen molecules thick in the air, fewer in the water, almost none in the mud, with three gauge bars ("ALMOST NO OXYGEN"); fungal spores drift down, land on the mud and die grey ("FUNGI CAN'T LIVE HERE" ✗). |
| slow | A flash into a microscope's view of the wood: hollow cells end-on; glowing rod bacteria nibble pits into the walls ("BACTERIA", "100 → 900 YEARS", "VERY, VERY SLOWLY"); water fills the emptied cells ("WATER FILLS THE WOOD"); back out: the posts unchanged ("KEEPS ITS SHAPE"), arrows of the church's weight ("THE WEIGHT"). |
| finale | The camera rises past the palazzi and the church (each glows as named), the posts glow; ghost tree crowns grow downward from the front posts' tips ("AN UPSIDE-DOWN FOREST", "STILL WORKING") and fade; the camera lands in the opening shot (loop). |

## Decisions

- **Facts** (`config/facts.py`, `facts.md`, ALL PASS). Web pages could not be fetched from this environment; sources were
  read through search summaries (Britannica; Pagella et al. 2025; Ceccato & Simonini; Pignatelli; Blanchette 2000;
  USDA / Kentucky extension; Venice for Visitors and Wikipedia for the Salute).
- **Simplified / exaggerated:** posts drawn 8 m long and ~2 per m² (real: 1–4 m, 10–25 cm, ~9 per m²), labelled on
  screen; "more than a thousand years ago" is true of the oldest timbers (600s), not of every post; "no rock" (there is
  firmer clay, the caranto, under parts of the city, but no bedrock); "packed firm" (the close piles improve the soft
  clay); the fence post's "YEAR 1 → 5" and the cells' "100 → 900 YEARS" are time-lapse clocks, not measurements; the
  bacteria and the cells are drawn, not to scale; the "upside-down forest" is the popular image (piles go in tip first).
- **Look:** one tank-style medium shader for everything under water (`lib/medium.js`: the ray from the camera through
  water then mud, Beer-Lambert, less light deeper down); the posts are one instanced trunk mesh (`lib/posts.js`) that
  is also the tree (crowns share its instance matrices) and the ghost crown; the Salute is procedural
  (`lib/church.js`: octagon, chapels, portal, 16 scroll buttresses, drum, lead dome, lantern, rear dome, bell towers);
  palazzi with gothic windows and funnel chimneys; figurine people from `ice_short`.
- **Loop:** the gondola rides `x = -2 + 14 sin(2πt/D)` and turns round off-screen; the water, caustics and sky use
  `t` before 38 s and `t - D` after (the switch is hidden in the fence shot); the finale camera blends into the hook's
  path `H(t - D)`; the music is 32 bars of 6/8 (4 phrases); reverb and effect tails wrap onto the start.

## Files

| Path | What |
|---|---|
| `scenes/3d/Venice.js` | the timeline: posts' life, shots, cameras, overlays |
| `scenes/3d/lib/medium.js` | the tank: water/mud medium, glass, bed (marsh islands), water surface, silt |
| `scenes/3d/lib/posts.js` | trunks / trees / ghost crowns, planks |
| `scenes/3d/lib/church.js` | the Salute, podiums, palazzi, mooring poles, stone / lead / roof materials with the build seam |
| `scenes/3d/lib/props.js` | gondola, pile-driving raft and rammer, huts, boats, reeds, mud puffs |
| `scenes/3d/lib/sets.js` | the garden fence, O₂ molecules, the wood cells |
| `tools/sfx.py`, `music.py` | pile blows, splashes, tree falls, the Salute's bell, underwater beds…; a barcarolle in 6/8 |
