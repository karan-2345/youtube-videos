---
name: new-short
description: Make a new vertical Short for the user's channel end to end (idea or hook in, finished captioned video, cover and upload notes out) with the repo's house pipeline -- Kokoro af_heart voice, three.js scene, synthesized sound, -14 LUFS master. Use whenever the user asks for a new Short/Reel/video, gives a hook or an idea, or says "let's make this one".
---

# Making a new Short

Read `CLAUDE.md` first (preferences, pipeline, lessons). Then work through these steps without asking the user to
re-explain anything. Keep the user posted in a line or two as each stage finishes; send files only when they're final.

## 1. Set up

- Pick a folder name `<topic>_short` (lowercase, one or two words).
- `python3 kit/new_short.py <topic>_short` copies the latest Short's pipeline (runtime, capture, TTS, alignment, export
  skeleton, assemble, cover, sheet, fonts, `.gitignore`) and links three.js. It leaves `config/narration.py`,
  `config/facts.py`, the scene, `tools/sfx.py` and `tools/music.py` for you to write.
- If the Kokoro models or Python packages are missing, run `bash kit/setup.sh`.
- Make a task list: facts, script + voice, scene + stills, preview, sound + music, render + assemble + checks, deliver.

## 2. Facts, then the script

- Research every claim (WebSearch; the web-fetch agent for pages). Write `config/facts.py` with sources and checks;
  `python3 build.py facts` must say ALL PASS. Note anything that is disputed or simplified.
- Write `config/narration.py`: about 185 to 210 words for 60 to 70 s. If the user gave a hook, use it word for word.
  Beats of one or two sentences; sentences flow on conjunctions; no maths to follow; end on a line that loops back
  into the hook.
- `python3 build.py tts`, then `python3 -m tools.tts --phonemes` to check pronunciation; fix with `SAY`/`IPA_FIXES`.

## 3. Anchors and the scene

- In `tools/export.py`, list `ANCHORS` (name, beat, phrase) for every word a visual or a sound must hit, plus any
  clocks the scene and the sound share (breaths, footsteps, counters). `python3 build.py export`.
- Build the scene in `scenes/3d/<Scene>.js` (+ `lib/`). Reuse what earlier Shorts built when it fits:
  `fat_short/scenes/3d/lib/` has a glass human body with lungs and skinning, an SDF mesher, a live metaball lump,
  ball-and-stick molecules, breath and particle systems and a studio; `pisa_short` has a diorama world with soil
  cross-sections and a procedural building; `buffon_short` has a table-top physics scene.
- Frame 0 must already move and show the promise; top text sits in y 240 to 700; captions use y 1330 to 1470;
  keep numbers inside the 3:4 crop (y 240 to 1680).
- Check that every `A.xxx` in the scene exists in `scene.json` (else black frames).
- Review stills on contact sheets (`Q="ss=1" node tools/capture.js stills ...`, `python3 tools/sheet.py name.png t...`),
  fix, repeat. Then a fast preview video of the whole thing and look at frames from it, especially the hook.

## 4. Sound

- `tools/sfx.py`: synthesize every effect and place it on anchors and the scene's clocks; voice the important moments
  (each myth busted, each reveal, each number), not every small motion.
- `tools/music.py`: a generated bed in a mood that fits; drums only in the middle so the end flows into the start.
- In `tools/assemble.py`, set the music's `drums_on`/`hush` spans for this Short.

## 5. Render, finish, check

- `nohup node tools/capture.js render --workers 2 > renders/render.log 2>&1 &`, then watch with a background
  `until` loop; it takes 1.5 to 2 h.
- `python3 -m tools.assemble` and `python3 -m tools.cover` (cover = the hook frame with a two-word title).
- Check: ffprobe frame count and duration; ebur128 says -14 LUFS and true peak below -1 dBTP; SRT text equals the
  script; last frame vs first frame; contact sheets of about 60 frames from the captioned final.
- Write `renders/final/upload.md` (4 titles, description with sources, Reels caption with hashtags, pinned comment)
  and `HANDOFF.md` (status, measurements, decisions).

## 6. Deliver

- Commit the folder (finals under 100 MB) and push to the session's branch.
- SendUserFile: the captioned mp4, cover.png and upload.md.
- Tell the user, briefly and in plain words: what happens on screen, what was checked, what wasn't (audio is checked
  by measurement only), and any fact that is simplified or disputed.
- Add the Short to the table in `CLAUDE.md` and remove it from `IDEAS.md`.
