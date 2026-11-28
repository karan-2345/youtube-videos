"""
config/narration.py -- the script, one entry per beat (a paragraph). Captions show this text verbatim.

House rules: the hook lands in the first sentence and carries the whole promise; sentences flow on conjunctions and
prepositions (And, Because, Then, So, But, When); no fragments or mic-drop kickers; no maths to follow; the last line
loops back into the hook. 185-210 words for 60-70 s. Every claim is checked in config/facts.py (facts.md).
"""

BEATS = [
    ("hook",
     "The Egyptians dragged stones heavier than a car across the desert, and for thousands of years nobody knew how, "
     "until scientists noticed a man in an ancient painting pouring water on the sand."),
    ("painting",
     "That painting is almost four thousand years old, and it shows about 170 men pulling a giant statue on a sled, "
     "while one man pours water in front of it, which experts thought was only a ritual."),
    ("lab",
     "So in 2014, physicists in Amsterdam pulled a small sled across a tray of desert sand, and on dry sand it was "
     "hard work, because the sand kept piling up in front of it like a wall."),
    ("secret",
     "But with just the right amount of water, the pull dropped to about half, because tiny drops stick the grains "
     "together, so the sand gets twice as stiff and the sled glides over it."),
    ("mud",
     "And with too much water, the sand turns to mud and the sled sinks again, so the man with the water was doing "
     "engineering, not a ritual."),
    ("end",
     "So even though that painting is seven hundred years younger than the Great Pyramid, the same trick would have "
     "let half as many people pull each of its more than two million stones across the desert."),
]
