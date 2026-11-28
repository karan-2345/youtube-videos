"""
config/narration.py -- the script, one entry per beat (a paragraph). Captions show this text verbatim.

House rules: the hook lands in the first sentence and carries the whole promise; sentences flow on conjunctions and
prepositions (And, Because, Then, So, But, When); no fragments or mic-drop kickers; no maths to follow; the last line
loops back into the hook. 185-210 words for 60-70 s. Every claim is checked in config/facts.py (facts.md).
"""

BEATS = [
    ("hook",
     "In 1806 a young man from Boston tried to sell frozen pond water on a tropical island, and everyone laughed at "
     "him, but thirty years later he was shipping ice halfway around the world to India."),
    ("flop",
     "His name was Frederic Tudor, and a Boston newspaper joked that it was a slippery plan, because most of the ice "
     "melted on the way, and Martinique had nowhere to keep the rest cold."),
    ("debt",
     "So he lost thousands of dollars, and it got worse until his debts put him in debtors' prison, but he still "
     "didn't give up."),
    ("secret",
     "Because he worked out that a big block melts far more slowly than small pieces, so he cut his blocks square, "
     "packed them tight and buried them in sawdust that sawmills threw away."),
    ("india",
     "So in 1833 he loaded 180 tons of pond ice onto a ship called the Tuscany, and after four months at sea, "
     "crossing the equator twice, about 100 tons were still frozen in Calcutta."),
    ("king",
     "And people there were so amazed that they built a house just for his ice, and he became known as the Ice King."),
    ("end",
     "So every clink of ice in a glass goes back to a trip that went completely wrong."),
]
