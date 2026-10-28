# college_bhadwa: hand-drawn stick-figure demo (~25 s)

1920×1080, 24 fps, Hindi voiceover, no on-screen text or subtitles. It covers the script's opening:
the hook, borrowing money "majboori ke naam pe", "bhai ke naam pe", turning into "baap", and the rant.

| Step | Command | Output |
|---|---|---|
| Voice (edge-tts `hi-IN-MadhurNeural`, word timings) | `python tools/voice.py` | `audio/*.wav`, `audio/lines.json` |
| Review stills | `python tools/render.py stills 3.8,14.6,22` | `renders/still_*.png` |
| Frames → video | `python tools/render.py video` | `renders/video.mp4` |
| Music + SFX + mux | `python tools/mix.py` | `audio/master.wav`, `final/college_bhadwa_demo.mp4` |

Lines are re-jittered every 3 frames ("line boil") for the hand-drawn look. Scene timing is driven by the
spoken word times, so re-voicing the lines re-syncs the animation. Music (Karplus-Strong plucks) and SFX are synthesized.
Needs: `pip install edge-tts numpy pillow`, ffmpeg.
