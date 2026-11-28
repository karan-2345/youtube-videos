# HANDOFF: "The pistol shrimp's snap" (vertical Short, YouTube Shorts + Instagram Reels)

## Status 2026-11-28: v1 built, waiting for the user's review

The user picked the pistol shrimp from four topics and approved script v1 ("Approved, build it") on 2026-11-28.
Built in a cloud session (Linux, no GPU). As with the other two Shorts, there was no separate look test or sample
scene: stills of every scene were checked before the full render.

| Scene | Narration | What happens |
|---|---|---|
| S00_Hook 5.37 s | "The pistol shrimp knocks out fish with a claw that never even touches them." | A goby swims up to the shrimp at its burrow (PISTOL SHRIMP). The big claw cocks and snaps shut in two frames: a jet, a bubble, a flash, a shock wave, and the fish is knocked back and rolls over. A dotted line marks the gap: NO CONTACT. The camera pushes in on the claw. |
| S01_Jet 6.38 s | "Instead, it snaps the claw so fast that the jet of water it shoots out tears open a bubble." | SLOW MOTION, close on the claw from slightly below. It re-cocks, then its near half lifts away to show the cut faces: the PLUNGER (yellow) on the moving finger and the water-filled SOCKET in the fixed one. The claw shuts, the plunger rams the socket, a WATER JET shoots out and a BUBBLE tears open inside it. |
| S02_Crack 5.84 s | "Then the bubble collapses with a crack loud enough to stun or even kill a small fish." | Pulled back with the fish in front. The bubble collapses (the claw is already shut), a SHOCK WAVE races out and hits the fish, which jolts, rolls belly-up and sinks (STUNNED). |
| S03_Flash 8.10 s | "And as it collapses, it even flashes with light, which means that for an instant it's nearly as hot as the surface of the Sun." | Extreme close-up: the bubble shrinks to a point and flashes (FLASH OF LIGHT, slowed down, brightened). The flash slides left, the Sun's surface glows on the right, and two bars rise: 4,700 °C+ vs 5,500 °C: NEARLY AS HOT AS THE SUN, ESTIMATED. |
| S04_Sonar 9.33 s | "So when thousands of these shrimp snap at once, their crackle can drown out navy sonar, which really happened in World War Two." | The camera rises off the burrow over a SHRIMP COLONY flickering with snaps, then tilts up to a submarine pinging overhead. Its SONAR screen fills with crackle until the contact is DROWNED OUT (WORLD WAR II). The camera dives back to the burrow as a new fish swims in: the opening frame (loop). |

### Final

Filled in after the render (see the commit that adds `final/`).

## Decisions

- **Same series look, underwater.** The "Cut-away" type, labels, captions and cinnabar accent stay; the backdrop is
  sea water instead of the dark studio (fog, light rays, marine snow, caustics on the sand). The cut-away is the claw
  itself: its near half lifts off and the cut faces are drawn from the exact z = 0 sections of the claw's shapes
  (`section()` in `lib/shrimp.js`), so the drawing always matches the 3D claw.
- **Our own shrimp.** A stylised, banded orange shrimp with hooded eyes, a pale stripe down its back and one huge
  claw, built from reshaped spheres (`blob()`), not modelled on any other channel's design.
- **The plunger is yellow everywhere** (the peg is visible on the open claw in S00 too), so the S01 label has a
  colour to point at.
- **Careful wording on screen.** "Nearly as hot" plus ESTIMATED (the temperature is inferred from the light, Lohse
  2001); "slowed down, brightened" on the flash (the real one is far too faint to see); no "louder than a gunshot"
  (underwater and in-air decibels aren't comparable); sonar jammed, not "subs hid in the noise" (weakly sourced).
- **Temperatures are facts, not literals:** `bubble_c` and `sun_c` in `config/facts.py` feed S03's bars.
- **The loop.** S00's first frame and S04's last frame share the camera (`CAM0`), the fish's approach line
  (`fishApproach`, negative times further out), the neighbours' claws (still) and every ambient motion (sea, antennae,
  snow, caustics), which S04 drives with `t - end`, so all of them are at time 0 on both frames.
- **Sound:** new synthesized effects in `tools/sfx.py` (amb, click, crack, jet, bubble, collapse, zing, ping, crackle,
  rise) plus the older swish, rewind, thud, bubbles and ding. Music: the series' marimba bed in G, E minor, C, D.

## Files

- `config/narration.src.md` the script (the one source of the words), `research/notes.md` claims, sources and FLAGs,
  `research/beat_plan.md` the plan the scenes follow.
- `scenes/3d/lib/shrimp.js` everything in the water: `seaStage`, `makeSeabed` (burrows, rocks, sea grass),
  `makeShrimp` (cuttable claw), `makeColony`, `makeFish`, `makeSnapFX`, `makeSun`, `makeSonar`, `makeSnapField`,
  `makeSub`, and the shared layout `heroLayout` / `fishApproach` / `CAM0`. `scenes/3d/lib/cut.js` is the series'
  shared helpers (labels, textures, noise).

## Open points

- FLAG 3 in `research/notes.md`: no Zack D. Films pistol-shrimp video turned up in web searches, but that check isn't
  conclusive and vidIQ was out of credits. Search their channel before publishing.
- Re-read the Versluis 2000 and Lohse 2001 abstracts on the laptop before publishing (the cloud session could only
  see abstracts and press coverage).

## Gotchas

- The cut planes are world-space `THREE.Plane`s recomputed from the claw every `shrimp.set()`, and the renderer needs
  `localClippingEnabled` (set by `seaStage`).
- A destructured `jet` option once shadowed the jet mesh in `makeSnapFX` (the mesh is `jetMesh` now).
- The antennae sweep toward the camera in the claw close-ups, so S01-S03 hide them (`antennae: false`).
- `assets/models` and `scenes/web/node_modules` are symlinks to the tattoo Short's copies (git-ignored).
