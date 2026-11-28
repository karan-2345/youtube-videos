"""
config/facts.py -- every claim in this Short, where it comes from, and a check.  python3 build.py facts -> facts.md

Sources (checked 2026-11-23):
  [A]  Fall, Weber, Pakpour, Lenoir, Shahidzadeh, Fiscina, Wagner, Bonn, "Sliding Friction on Wet and Dry Sand",
       Physical Review Letters 112, 175502 (29 April 2014). University of Amsterdam / FOM.
       Press release: iop.uva.nl/content/news/2014/00/prl-egyptian-pyramids.html
  [B]  Coverage of [A] quoting the release and D. Bonn: Live Science / NBC News "Solved! How Ancient Egyptians Moved
       Massive Pyramid Stones" (2014); phys.org "Ancient Egyptians transported pyramid stones over wet sand" (2014);
       Physics World "Did slippery sand help Egyptians build the pyramids?"; Smithsonian "Simple trick may have
       helped Egyptians build pyramids" (2014); Archaeology magazine (2 May 2014).
  [C]  Djehutihotep (Wikipedia; Deir El Bersha, Wikipedia; Newberry, El Bersheh I, 1895): Twelfth Dynasty nomarch of
       the Hare nome, served under Amenemhat II, Senusret II and Senusret III (c. 1900-1850 BC); his tomb at Deir
       el-Bersha shows a colossal statue (about 6.8 m) dragged on a sledge by 172 workers, a man pouring water in
       front of the sledge. Newberry (1895): "perhaps only the ceremonial act".
  [D]  Great Pyramid of Giza (National Geographic, "How were the Pyramids of Giza built?"; Wikipedia; New World
       Encyclopedia): built for Khufu, finished about 2560 BC; about 2.3 million blocks (estimates 2 to 2.8 million),
       averaging about 2.5 tonnes.
  [E]  US EPA Automotive Trends Report: average new US vehicle about 4,300 lb (1.95 t); a typical European car is
       about 1.3 to 1.5 t.

Simplified / disputed (say so in the delivery):
  - "for thousands of years nobody knew how" is the hook's storytelling; there were many theories, and how the
    pyramids were built is still debated. The 2014 study explains why the water helps; it does not prove the
    pyramid builders used it (the painting shows a statue, ~700 years after the Great Pyramid). Some Egyptologists
    are sceptical; the script says the trick "would have" let half as many people pull each block.
  - "half the force" / "half as many people": the release says the pulling force can drop by up to about 50 %
    with the right water (about 2 to 5 % of the sand's volume), so roughly half the workers.
"""

from __future__ import annotations

GREAT_PYRAMID_BC = 2560           # [D] finished about
PAINTING_BC = 1850                # [C] Senusret III era, c. 1878-1839 BC (range c. 1900-1850)
TODAY = 2026
BLOCKS = 2_300_000                # [D] about
BLOCK_T = 2.5                     # [D] average, tonnes
CAR_T = 1.95                      # [E] average new US vehicle, tonnes (a European car is lighter)
WORKERS = 172                     # [C]
FORCE_DROP = 0.50                 # [A]/[B] up to about 50 %
STIFFER = 2.0                     # [B] "about twice as stiff as dry sand"
WATER_OPT = (0.02, 0.05)          # [B] optimum water, fraction of the sand's volume
STUDY_YEAR = 2014                 # [A]

CLAIMS = [
    ("The Egyptians dragged stones heavier than a car (an average Great Pyramid block, ~2.5 t, outweighs a car)",
     lambda: BLOCK_T > CAR_T, "[D] ~2.5 t average block vs [E] 1.95 t average new US vehicle (EU cars ~1.4 t)"),
    ("a man in an ancient painting pouring water on the sand", lambda: True,
     "[C] Djehutihotep's tomb, Deir el-Bersha: a man on the sledge pours water in front of it"),
    ("That painting is almost four thousand years old",
     lambda: 3700 <= TODAY + PAINTING_BC <= 4000, f"[C] c. 1900-1850 BC -> {TODAY + PAINTING_BC} to {TODAY + 1900} years"),
    ("it shows about 170 men pulling a giant statue on a sled", lambda: abs(WORKERS - 170) <= 5,
     "[C] 172 workers, a colossus about 6.8 m tall, on a sledge"),
    ("which experts thought was only a ritual", lambda: True,
     "[B] Bonn: \"Egyptologists thought it was a purely ceremonial act\"; [C] Newberry 1895: \"perhaps only the ceremonial act\""),
    ("in 2014, physicists in Amsterdam pulled a small sled across a tray of desert sand",
     lambda: STUDY_YEAR == 2014, "[A] University of Amsterdam (Bonn's group); [B] \"a laboratory version of the Egyptian sledge in a tray of sand\""),
    ("on dry sand ... the sand kept piling up in front of it like a wall", lambda: True,
     "[A]/[B] on dry sand a heap of sand builds up in front of the sledge; with water the heap shrinks"),
    ("with just the right amount of water, the pull dropped to about half", lambda: FORCE_DROP >= 0.45,
     "[B] Bonn: the reduction is as much as 50 %; optimum about 2-5 % water"),
    ("tiny drops stick the grains together, so the sand gets twice as stiff", lambda: STIFFER == 2.0,
     "[A] capillary water bridges between grains raise the shear modulus; [B] \"about twice as stiff as dry sand\""),
    ("with too much water, the sand turns to mud and the sled sinks again", lambda: True,
     "[B] Bonn: \"if the sand is too wet, it won't work either\"; [A] the bridges merge and the stiffness drops"),
    ("that painting is seven hundred years younger than the Great Pyramid",
     lambda: 650 <= GREAT_PYRAMID_BC - PAINTING_BC <= 750, f"[C]/[D] {GREAT_PYRAMID_BC} - {PAINTING_BC} BC = {GREAT_PYRAMID_BC - PAINTING_BC} years"),
    ("the same trick would have let half as many people pull each block", lambda: FORCE_DROP >= 0.45,
     "[B] phys.org: with the right amount of water the Egyptians could halve the number of workers (a would-have)"),
    ("its more than two million stones", lambda: BLOCKS > 2_000_000, "[D] about 2.3 million (estimates 2 to 2.8 million)"),
]


def report() -> tuple[str, bool]:
    rows, ok = [], True
    for claim, check, note in CLAIMS:
        good = bool(check())
        ok &= good
        rows.append(f"| {'PASS' if good else 'FAIL'} | {claim} | {note} |")
    text = "# facts.md\n\n| | Claim | Source / check |\n|---|---|---|\n" + "\n".join(rows) + "\n"
    return text, ok and bool(CLAIMS)
