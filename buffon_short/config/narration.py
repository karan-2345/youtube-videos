"""
config/narration.py -- the script, one entry per beat (a paragraph). Captions show this text verbatim.

Rules (carried over from the chess Shorts, plus the user's for this one): the hook lands in the first sentence; every
sentence after it opens with a link (So, With, And, But); no fragments, colon reveals or mic-drop kickers; one number
per idea; no decimals spoken. Every number is checked in config/facts.py.
"""

BEATS = [
    ("hook",
     "You can calculate pi without a single circle, just by dropping needles onto a wooden floor, and one "
     "mathematician who tried it got six decimal places right, but the numbers he wrote down show that he almost "
     "certainly cheated."),
    ("bridge",
     "So before we catch him, let's see how a falling needle can know anything about a circle."),
    ("rule",
     "With needles as long as the boards are wide, one lying across them always hits a crack, while one "
     "lying along them almost never does."),
    ("circle",
     "And since it can point any way around a full circle, the chance of a crossing is exactly two over pi, so "
     "twice the drops over the crossings slowly turns into pi."),
    ("slow",
     "But it's slow, because after 3,000 drops, an honest run usually gets only one decimal place right."),
    ("catch",
     "And that's what gives Lazzarini away, because his answer is exactly 355 over 113, a fraction for pi that's "
     "over a thousand years old, and his 3,408 drops are just the right number to land on it."),
    ("end",
     "So he most likely stopped the moment he hit it, which means the trick is real, but his six decimal "
     "places weren't."),
]
