"""
config/narration.py -- the script, one entry per beat (a paragraph). Captions show this text verbatim.

Rules (from the earlier Shorts, plus the user's): the hook lands in the first sentence and carries the whole story's
promise; sentences flow on conjunctions and prepositions instead of breaking off (And, Because, Then, So, But); no
fragments or mic-drop kickers; one number per idea; no maths a viewer has to follow. The hook is the user's own
line, word for word. Every claim is checked in config/facts.py (facts.md).
"""

BEATS = [
    ("hook",
     "When you lose weight, the fat doesn't melt away or turn into muscle, and you don't sweat it out either, "
     "because most of it leaves your body every time you breathe out."),
    ("survey",
     "And when scientists asked 150 doctors, dietitians and personal trainers where the fat goes, only three of "
     "them got it right."),
    ("atoms",
     "Because fat is made of just three kinds of atoms, carbon, hydrogen and oxygen, and when your body needs "
     "energy, it breaks the fat apart with the oxygen you breathe in."),
    ("split",
     "Then the pieces join up again as carbon dioxide, the gas you breathe out, and as water, which leaves in your "
     "sweat, your tears, your pee and even your breath."),
    ("numbers",
     "So if you lose 10 kg of fat, 8.4 kg of it leave through your lungs, and only 1.6 kg turn into water."),
    ("twist",
     "But breathing faster won't help, because your body only burns more fat when it needs more energy, like when "
     "you move, and panting on purpose just makes you dizzy."),
    ("end",
     "So even right now, as you watch this, a tiny bit of you is leaving every time you breathe out."),
]
