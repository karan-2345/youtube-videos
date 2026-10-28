# college_bhadwa: cartoon demo (~25 s)

1920×1080, 24 fps, Hindi voiceover, no on-screen text or subtitles. It covers the script's opening:
the hook, borrowing money "majboori ke naam pe", "bhai ke naam pe", turning into "baap", and the rant.

| Step | Command | Output |
|---|---|---|
| Voice (edge-tts `hi-IN-MadhurNeural`, word timings) | `python tools/voice.py` | `audio/*.wav`, `audio/lines.json` |
| Review stills | `python tools/render.py stills 3.8,14.6,22` | `renders/still_*.png` |
| Frames → video, colour cartoon | `python tools/cartoon.py video` | `renders/cartoon.mp4` |
| Frames → video, stick figures | `python tools/render.py video` | `renders/video.mp4` |
| Music + SFX + mux | `python tools/mix.py renders/cartoon.mp4 final/college_bhadwa_cartoon.mp4` | `final/college_bhadwa_cartoon.mp4` (no args: stick version) |

Lines are re-jittered every 3 frames ("line boil") for the hand-drawn look. Scene timing is driven by the
spoken word times, so re-voicing the lines re-syncs the animation. Music (Karplus-Strong plucks) and SFX are synthesized.
Needs: `pip install edge-tts numpy pillow`, ffmpeg.

`tools/cartoon.py` is the colour version: original characters (Bunty the bhadwa, Golu the victim, three classmates) with
thick outlines, flat fills plus soft cel shading and rim highlights, painted backgrounds (campus, corridor with a
perspective tile floor and sunlight, courtyard, rainy spotlight, "baap" sunburst with flames), ground shadows, parallax
camera, depth blur and a vignette. It reuses the timeline and lip-sync from `tools/render.py`.
