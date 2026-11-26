"""
config/narration.py -- the script, one entry per beat (a paragraph). Captions show this text verbatim.

House rules: the hook lands in the first sentence and carries the whole promise; sentences flow on conjunctions and
prepositions (And, Because, Then, So, But, When); no fragments or mic-drop kickers; no maths to follow; the last line
loops back into the hook. 185-210 words for 60-70 s.
"""

BEATS = [
    ("hook", "The Great Pyramid was the tallest thing people built for 3,800 years, and we thought nobody had written "
             "down how they did it, until archaeologists found the diary of a man who hauled its stones."),
    ("merer", "His name was Merer, and his crew moved just a few of its 2.3 million blocks, which went up its ramps at "
              "about one every few minutes, every day, for about twenty years."),
    ("sledge", "Most were cut right beside it and dragged on wooden sledges, while someone poured water on the sand in "
               "front, because damp sand stays firm and the pull drops by half."),
    ("boats", "But the white outer stones came from across the Nile, so Merer's forty men sailed them over in boats, "
              "along canals dug almost to the pyramid."),
    ("casing", "And they were cut so precisely that some joints are thinner than a credit card, so the pyramid shone "
               "white, until people took them away to build Cairo."),
    ("workers", "And its builders weren't slaves, because they were paid in bread and beer and buried right next to "
                "their king."),
    ("end", "So it wasn't aliens that built it, but thousands of people like Merer, with ropes, boats and wet sand."),
]
