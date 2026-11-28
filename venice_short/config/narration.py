"""
config/narration.py -- the script, one entry per beat (a paragraph). Captions show this text verbatim.

House rules: the hook lands in the first sentence and carries the whole promise; sentences flow on conjunctions and
prepositions (And, Because, Then, So, But, When); no fragments or mic-drop kickers; no maths to follow; the last line
loops back into the hook. 185-210 words for 60-70 s. Every claim is checked in config/facts.py (facts.md).
"""

BEATS = [
    ("hook",
     "Venice is standing on millions of tree trunks that were hammered into the mud more than a thousand years ago, "
     "and they should have rotted away long ago, but they're still holding the city up."),
    ("lagoon",
     "Because the first Venetians built on the islands of a shallow lagoon, where there was no rock, only water and "
     "soft, sticky mud."),
    ("piles",
     "So they cut down whole forests, sharpened the trunks into posts, and hammered them in so close together that "
     "the mud between them was packed firm, and then they built in stone on top."),
    ("salute",
     "This one church, the Salute, is standing on more than a million posts."),
    ("rot",
     "But wood rots, because tiny fungi eat it, and that's why an old fence post crumbles in just a few years."),
    ("secret",
     "Down in the mud, though, there's almost no oxygen, and the fungi that rot wood can't live without it."),
    ("slow",
     "Only bacteria still nibble at the posts, so slowly that it takes centuries, while water fills the wood, so it "
     "keeps its shape and keeps carrying the weight."),
    ("finale",
     "So under every palace and every church in Venice there's a whole forest, upside down in the mud, and it's "
     "still working."),
]
