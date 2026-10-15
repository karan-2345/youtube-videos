# Upload notes: "The flat Starlink antenna that steers without moving"

**File:** `starlink_flat_antenna.mp4` (1080×1920, 60 fps, captions burned in, −14 LUFS, ~83 s).
`starlink_flat_antenna_clean.mp4` is the same video without captions, in case you want to re-caption it in the app.
Works for YouTube Shorts and Instagram Reels (both accept vertical 9:16 up to 3 minutes; this is inside the 60–90 s you asked for).
Captions sit at about 72% of the height and the readouts stay above them, clear of the bottom UI of both apps.

## Title (pick one)
1. Starlink's flat dish steers without moving
2. How a flat antenna follows a satellite without turning
3. The panel that never turns (and still keeps up with a satellite)

## YouTube Shorts description
A flat panel on a roof follows a satellite racing at 27,000 km/h, and nothing on it turns. The trick is wave interference: every tiny antenna sends the same signal, each a few trillionths of a second after its neighbor, and the waves line up in one direction only. Change the timing and the beam leans toward the satellite.

Sources
- Satellite altitude (~550 km) and speed (~27,000 km/h), pass length, 15-second scheduling slots: APNIC / Geoff Huston, Starlink measurement slides; Pan et al., "Making Sense of Constellations", CoNEXT 2023
- Starlink terminals use electronically steered Ku-band phased arrays: SpaceX FCC application; Orbital Radar glossary; Hackaday on the Keiter teardown
- Ku-band frequencies (receive 10.7–12.7 GHz, transmit 14.0–14.5 GHz): reseller spec sheets repeating the FCC filing
- Delay between neighbouring antennas: computed from `delay = d·sin(angle) / c` with antennas half a wavelength apart (see research_notes.md)

Animation and simulation: original (Three.js). Music and sound effects: original. Narration: synthetic voice (Kokoro TTS).

#shorts #starlink #physics #phasedarray #science

## Instagram Reels caption
It never turns, and it still follows a satellite flying at 27,000 km/h. Wave interference does the aiming: change the timing between tiny antennas by trillionths of a second and the whole beam leans. Full sources in the pinned comment.

#starlink #physics #phasedarray #science #satellite #learnphysics

## Pinned comment
Two honest notes. (1) Some Starlink models have motors that tilt the whole panel to face the sky; following each satellite is done by the beam. (2) The picture is simplified: 24 antennas are drawn, water and radio waves are slowed down to be visible, and the delays assume antennas half a wavelength apart (21 ps for a 30° tilt at 11.7 GHz). SpaceX does not publish the real element count, so the video does not claim one.

## Tips
- Cover frame: `cover.png` (title card over the roof panel). On Reels pick it as the cover; on Shorts upload it as the custom thumbnail from the app.
- `captions.srt` is optional. The captions are already burned in, so only upload it if you want a separate CC track.
- The voice is synthetic and not a real person's, so neither platform's realistic-AI-content label is needed for it; if you want to be cautious, switch the "AI info" toggle on.
