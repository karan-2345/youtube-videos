# Narration source: why tattoos don't wash off (vertical Short, 30-40 s)

> Edit this file, then `python build.py narration`. One line = one beat (a paragraph; 0.8 s after it).
> Sentences inside a beat get 0.4 s. `@pause N` adds silence after the previous beat. `@lead N` adds a picture-only
> moment before the next beat. Every number is a {{fact}} token, and no decimal is ever spoken (this script has none).
> v1 (2026-11-21). 95 words, 4 beats, estimated 36-39 s (measure with `build.py tts`; no voice model in the cloud
> session). Rules carried over: the hook lands in the first sentence; every sentence starts with a connective or an
> explicit link to the one before; no fragments, colon reveals or mic-drop kickers.
> Spine: the outer skin sheds, the tattoo doesn't -> the ink sits deeper, inside immune cells that can't digest it ->
> kill those cells (mice) and new ones swallow the same ink -> that's why lasers need many sessions.
> Say-check: "macrophages" = MAK-ruh-fay-jiz. If Kokoro gets it wrong, add an IPA override as was done for "Lichess".

## S00 · The skin sheds, the tattoo stays
@scene S00_Hook
@lead 0.4
Your skin sheds its outer layer every few weeks, so why doesn't your tattoo shed with it?

## S01 · Held by immune cells
@scene S01_Held
It's because the needle puts the ink deeper, where immune cells called macrophages swallow it but can't digest it, so they just hold on to it.

## S02 · The mouse experiment
@scene S02_Relay
So when scientists killed those cells in tattooed mice, the tattoos didn't fade, because new cells swallowed the spilled ink in the same spot.

## S03 · Why removal is so slow
@scene S03_Laser
And that's why lasers take so many sessions to remove a tattoo, since they have to shatter the ink small enough for those cells to carry it away.
@pause 0.6
