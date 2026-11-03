# Upload: The rounding error that a fix made deadly

**File:** `patriot_rounding_error.mp4` (1080×1920, 60 fps, 2:50, captions burned in). Sentence captions: `captions.srt`.
**Cover:** `cover.png` (S02 at 82.6 s: the two clocks after 100 hours, "behind by 0.34 s").

## Title (pick one)
- Why 0.1 + 0.2 isn't 0.3, and the missile it let through
- The rounding error that a fix made deadly
- A clock wrong by one part in a million. Why did it matter?

## Description
Type 0.1 + 0.2 into most programming languages and you get 0.30000000000000004. In February 1991 a flaw from the
same family helped a Scud get past a Patriot battery at Dhahran, Saudi Arabia, and kill 28 American soldiers.

But the usual telling skips the strangest part. The Patriot found missiles from the time between radar pulses, so a
clock that was uniformly slow should have cancelled out. It stopped cancelling after the software was patched for fast
ballistic missiles: a more accurate time conversion went into some parts of the code and not others, so the system
subtracted a sloppy time from an accurate one, and the whole third of a second appeared in the answer.

Sources:
- US GAO, "Patriot Missile Defense: Software Problem Led to System Failure at Dhahran, Saudi Arabia" (IMTEC-92-26, 1992): https://www.gao.gov/products/imtec-92-26
- Robert Skeel, "Roundoff Error and the Patriot Missile", SIAM News 25(4), 1992: https://www-users.cse.umn.edu/~arnold/disasters/Patriot-dharan-skeel-siam.pdf

Whether a reboot would have let the Patriot hit the Scud can't be known; the system's record against Scuds was itself
disputed.

## Tags
floating point, rounding error, 0.1 + 0.2, Patriot missile, Dhahran 1991, Gulf War, software bug, binary, computer
science, numerical analysis, fixed point, GAO, history of computing

## Notes
- Serious subject: no meme framing in the title, thumbnail or pinned comment.
- Numbers: `checks/compute1.py` (all pass). Sources and caveats: `research/notes.md`.
