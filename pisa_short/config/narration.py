"""
config/narration.py -- the script, one entry per beat (a paragraph). Captions show this text verbatim.

Rules (from the earlier Shorts, plus the user's): the hook lands in the first sentence and carries the whole story's
promise; sentences flow on conjunctions and prepositions instead of breaking off (So, Then, When, And); no fragments
or mic-drop kickers; one number per idea. Every claim is checked in config/facts.py (facts.md).
"""

BEATS = [
    ("hook",
     "The Leaning Tower of Pisa should have fallen over more than 800 years ago, when it was only three floors "
     "tall, and what saved it wasn't some genius engineer but a war."),
    ("bridge",
     "So to see how a war could save a tower, we have to look underground."),
    ("ground",
     "In 1173, Pisa began building on soft, wet clay, with a foundation just three meters deep, and by the third "
     "floor, one side was already sinking."),
    ("war",
     "Then Pisa went to war, and the work stopped for almost a century, while the tower's weight slowly squeezed "
     "water out of the clay and made it firmer, because if they'd kept building, it would have collapsed."),
    ("banana",
     "When the builders came back, they made each new floor a little taller on one side to hide the lean, so the "
     "tower isn't straight at all but curved, like a banana."),
    ("modern",
     "By 1990 it was leaning so far that it had to close, until engineers pulled soil from under the high side and "
     "straightened it by almost half a meter."),
    ("end",
     "And that same soft clay has saved it from at least four strong earthquakes, by keeping it from swaying with "
     "the shaking, so the ground that made it lean is the reason it's still standing."),
]
