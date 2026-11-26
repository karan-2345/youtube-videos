# HANDOFF: "How was the Great Pyramid built?" (pyramid Short)

## Status 2026-11-26: final being rendered

The user asked for a Short on the Great Pyramid (from an idea Meta's Page assistant suggested after the Pisa reel
did 20x better than the others: "tallest for 3,800 years, 2.3 million stones, no cranes, can't fit a credit card
between them, how did they do it?"), with the same animation quality as Pisa and a really interesting hook.

## Script (`config/narration.py`, 192 words, 66 s)

| Beat | What happens on screen |
|---|---|
| hook | "HOW DID THEY BUILD THIS?" over the white-cased pyramid at golden hour, birds and walkers, the camera gliding in. "tallest": a 146 m dimension line. "3,800 years": a counter while the sun races through three days and nights. "nobody had written down": a rolled papyrus flies in, "BUT HOW? NOBODY WROTE IT DOWN?". "until archaeologists found the diary": it unrolls (hieratic logbook, glowing): "THE DIARY OF MERER · FOUND IN 2013". It fills the screen and we come out on the building site. |
| merer | Merer (gold kilt) beside his crew hauling a sledge up the ramp; crane up over the site (a third built), "2,300,000 STONE BLOCKS"; the ramp seen whole, "EXACT SHAPE STILL DEBATED"; a block slides into its place on the top course, "1 BLOCK EVERY FEW MINUTES"; a time-lapse (six days and nights), the pyramid rises, "20 YEARS". |
| sledge | The quarry right beside it; a crew of 12 hauls a block toward the camera, the pyramid behind; the man on the sledge pours water, the sand darkens, the dry ridge in front flattens, half the men let go: "PULL 100% -> 50%". |
| boats | Tura: white blocks on the dock, boats loading, the pyramid across the Nile; Merer's boat under sail with its rowers, "MERER'S CREW · 40 MEN"; up the canal to the harbour as the last courses and the white casing go on. |
| casing | Dive to a casing joint: a credit card's edge against the joint, "JOINT 0.5 mm / CARD 0.76 mm"; pull back to the whole pyramid shining; the casing stones fly off toward Cairo, "1300s: TAKEN TO BUILD CAIRO", leaving today's stepped core. |
| workers | The workers' town, "SLAVES? ✕ PAID WORKERS"; bread and beer on a mat with their tombs and the king's pyramid behind, "BREAD + BEER = WAGES"; "WORKERS' TOMBS", "THE KING'S PYRAMID". |
| end | A flying saucer over the apex gets a red ✕ and zips off; "THOUSANDS OF PEOPLE" round the base and on the steps; "ROPES · BOATS · WET SAND" while the casing flies back; the camera lands on frame 0 (loop). |

## Decisions

- **Facts** (`config/facts.py`, `facts.md` ALL PASS). Wikipedia could not be fetched from the sandbox; every claim was
  checked through web search against the primary reports (Tallet, PRL 2014, Petrie, Hawass/AERA, Edwards/Lehner).
- **Hook**: "only eyewitness account" was dropped (no source says "only"); "we thought nobody had written down how
  they did it" is true of what was known before 2013.
- **Simplified**: the ramp is drawn straight (its shape is debated, labelled on screen); the Djehutihotep painting of
  water on the sand is ~700 years later than the pyramid; "every few minutes" is our arithmetic on ~20 years; casing
  stripping started before the 1300s; the crew's boat is shown much faster than real; the queens' pyramids and
  temple are shown complete in the boat beat.
- **Look**: the Pisa approach -- a floating diorama block (plateau, escarpment, Nile, canal, harbour, Tura cliffs,
  palms, quarry pit, ramp, workers' town and tombs), golden-hour sun with shadows, procedural materials. The pyramid
  is 80 courses of core plus ~9,000 mitred casing prisms animated in the vertex shader (laid, polished, stripped to
  Cairo, flown back). Figures are posable (kilt, torso, limbs) for close-ups, instanced for crowds.
- **Sound**: all synthesized (`tools/sfx.py`): a looping desert wind, papyrus rustle, time-lapse ticks, sledge
  scrape (dry, then smooth), water pour, block clunk, clock ticks, chisels, water lapping, oars, sail, the card's tap,
  stones clattering off and back, the town's murmur, a gong, the saucer. Music (`tools/music.py`): D Hijaz mode,
  drone + Karplus-Strong oud-like string + frame drum (maqsum) in the middle; 25 bars exactly, so it loops.
- **Capture**: `STEP=2` renders every other frame for a quick preview.

## Files

| Path | What |
|---|---|
| `scenes/3d/Pyramid.js` | the timeline: story clock, cameras, crews, boats, overlays |
| `scenes/3d/lib/land.js` | the diorama block: terrain, Nile, canal, harbour, quarry, sky, palms |
| `scenes/3d/lib/pyramid.js` | core courses, casing prisms (shader animation), ramp, temple and causeway |
| `scenes/3d/lib/people.js` | posable builders and the instanced crowd |
| `scenes/3d/lib/props.js` | sledge, ropes, water, boats, papyrus, credit card, bread and beer, town, tombs, saucer |
