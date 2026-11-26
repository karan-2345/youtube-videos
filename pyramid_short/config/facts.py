"""
config/facts.py -- every claim in the Great Pyramid Short, where it comes from, and a check.
python3 build.py facts -> facts.md

Sources (checked 2026-11-26):
  [H]  Height and record: Great Pyramid of Giza (Wikipedia; History.com "tallest buildings in history"; HistoryRevealed
       "What overtook the Great Pyramid"): original height ~146.6 m; tallest human-made structure for ~3,800 years,
       until Lincoln Cathedral's spire (~160 m), finished c. 1311.
  [B]  Blocks: NOVA/PBS "Pyramids -- the inside story"; Smarthistory "Pyramid of Khufu"; National Geographic "How were
       the pyramids of Giza built?": an estimated 2.3 million blocks, averaging about 2.3-2.5 t; built for Khufu c. 2560
       BC; about 20 years (Herodotus' figure, broadly accepted; Khufu reigned about 23-27 years).
  [M]  Diary of Merer: P. Tallet (Paris-Sorbonne), found 2013 at Wadi al-Jarf on the Red Sea; Egyptian Ministry of
       Antiquities display 2016 (Times of Israel, Gulf Times, Hyperallergic); Smithsonian "The world's oldest papyrus";
       Wikipedia "Diary of Merer". The oldest known inscribed papyri, about 4,500 years old, year 27 of Khufu. Merer, an
       inspector, led a crew (phyle) of about 40 men shipping white limestone from the Tura quarries, across the Nile,
       to Giza ("Akhet-Khufu") by boat, through canals and a harbour basin ("She-Khufu") dug at the foot of the Giza
       plateau. (Tallet: the stones were most likely for the casing; the diary does not say so in words.)
  [Q]  Quarries: Edwards (2003), citing Lehner, The Complete Pyramids: most core stone was quarried close by the
       pyramid; the white casing limestone came from Tura, across the Nile; granite from Aswan.
  [S]  Wet sand: A. Fall, D. Bonn et al., "Sliding friction on wet and dry sand", Physical Review Letters 112, 175502
       (29 April 2014); University of Amsterdam press release: the right amount of water roughly halves the pulling
       force (dry sand heaps up in front of the sledge). The tomb painting of Djehutihotep (c. 1880 BC) shows a man
       pouring water in front of a sledge hauled by 172 men. (Caveat: the halving depends on the sand and the amount of
       water; too much water is worse again.)
  [R]  Ramps: archaeologists agree blocks were hauled up ramps, but not on their shape (straight, zig-zag, spiral,
       internal); a steep ramp with post holes from Khufu's reign was found at the Hatnub quarry in 2018 (Liverpool /
       IFAO; Scientific American, Live Science).
  [P]  Precision: W. M. F. Petrie, The Pyramids and Temples of Gizeh (1883): on the surviving casing stones "the mean
       opening of the joint was but 1/50 inch" (0.5 mm), "equal to opticians' work of the present day, but on a scale
       of acres". A credit card (ISO/IEC 7810 ID-1) is 0.76 mm thick.
  [C]  Casing removed: a 1303 earthquake loosened many casing stones, said to have been carted away by Sultan an-Nasir
       Hasan in 1356 for buildings in Cairo; Muhammad Ali took more in the 1800s (Wikipedia; Live Science citing
       Lehner: stripping had begun much earlier).
  [W]  Workers: Z. Hawass's excavations of the workers' cemetery beside the pyramids (2010; CBC, Discover, Mail &
       Guardian: "these tombs were built beside the king's pyramid, which indicates that these people were not by any
       means slaves"); AERA / M. Lehner, Heit el-Ghurab: bakeries and breweries; bread and beer rations were the wages
       (no money yet); workforce estimates 10,000-30,000 (Verner: no more than 30,000).
  [A]  "Not aliens": every source above -- quarries, tools, ramps, boats, workers' town and tombs, and the builders'
       own diary -- shows people built it.
"""

from __future__ import annotations

# ---------------------------------------------------------------- the numbers the script and the scene use
HEIGHT_M = 146.6              # original height [H]
TODAY_M = 138.5               # height today (capstone and top courses gone) [H]
BASE_M = 230.3                # side of the base [H]
BUILT_BC = 2560               # completed about 2560 BC [B]
LINCOLN_AD = 1311             # Lincoln Cathedral spire finished [H]
LINCOLN_M = 160               # its spire (fell in 1548) [H]
RECORD_YEARS = 3800           # as said: "for 3,800 years"
BLOCKS = 2_300_000            # estimate [B]
YEARS_TO_BUILD = 20           # about [B]
WORK_HOURS = 10               # a working day (assumption for the "every few minutes" arithmetic)
MERER_YEAR = 2013             # the diary found [M]
MERER_CREW = 40               # about 40 men [M]
JOINT_MM = 0.5                # mean casing joint, Petrie [P]
CARD_MM = 0.76                # credit card thickness, ISO/IEC 7810 [P]
PULL_DRY = 1.0                # relative pulling force on dry sand
PULL_WET = 0.5                # with the right amount of water [S]
QUAKE_AD = 1303               # [C]


def record_years():
    """Years between completion (c. 2560 BC) and Lincoln's spire (1311 AD); no year zero."""
    return BUILT_BC + LINCOLN_AD - 1


def minutes_per_block(hours_per_day=WORK_HOURS):
    return YEARS_TO_BUILD * 365 * hours_per_day * 60 / BLOCKS


CLAIMS = [
    ("The Great Pyramid was the tallest thing people built for 3,800 years",
     lambda: 3800 <= record_years() < 3900 and LINCOLN_M > HEIGHT_M,
     f"[H] c. {BUILT_BC} BC to Lincoln Cathedral's spire ({LINCOLN_M} m) in {LINCOLN_AD}: {record_years()} years; "
     f"the pyramid was {HEIGHT_M} m"),
    ("we thought nobody had written down how they did it, until archaeologists found the diary of a man who hauled "
     "its stones",
     lambda: MERER_YEAR == 2013,
     "[M] found 2013 at Wadi al-Jarf; the oldest inscribed papyri known, c. 4,500 years old; before them no written "
     "record from the builders' own time was known (Herodotus wrote about 2,000 years later). Simplified: 'hauled' = "
     "shipped limestone to Giza by boat"),
    ("His name was Merer", lambda: True, "[M] Merer, an inspector, wrote the logbook (Papyrus Jarf A and B)"),
    ("its 2.3 million blocks", lambda: BLOCKS == 2_300_000,
     "[B] an estimate (NOVA, Smarthistory, National Geographic); average about 2.3-2.5 t"),
    ("which went up its ramps", lambda: True,
     "[R] ramps are agreed; their shape is still argued over -- the scene labels the ramp 'exact shape unknown'"),
    ("at about one every few minutes, every day, for about twenty years",
     lambda: 1 <= minutes_per_block(10) <= 5 and minutes_per_block(24) <= 5,
     f"[B] {BLOCKS:,} blocks in {YEARS_TO_BUILD} years = {BLOCKS / (YEARS_TO_BUILD * 365):.0f} a day: one every "
     f"{minutes_per_block(10):.1f} min over a 10-hour day, {minutes_per_block(24):.1f} min round the clock"),
    ("Most were cut right beside it", lambda: True, "[Q] Edwards 2003 / Lehner: most core stone quarried close by"),
    ("and dragged on wooden sledges, while someone poured water on the sand in front", lambda: True,
     "[S] the Djehutihotep tomb painting shows exactly this (c. 1880 BC, a later dynasty: simplified)"),
    ("because damp sand stays firm and the pull drops by half", lambda: PULL_WET / PULL_DRY == 0.5,
     "[S] Fall et al., PRL 2014: the right amount of water roughly halves the force; too much is worse again"),
    ("the white outer stones came from across the Nile", lambda: True,
     "[Q][M] fine white limestone from Tura, on the east bank; Giza is on the west bank"),
    ("so Merer's forty men sailed them over in boats, along canals dug almost to the pyramid",
     lambda: MERER_CREW == 40,
     "[M] a crew of about 40; the diary names the harbour basin 'She-Khufu' at the foot of the Giza plateau"),
    ("they were cut so precisely that some joints are thinner than a credit card",
     lambda: JOINT_MM < CARD_MM,
     f"[P] Petrie: mean joint {JOINT_MM} mm (1/50 inch) on the surviving casing stones; a card is {CARD_MM} mm. "
     "Only a few casing stones survive at the base"),
    ("so the pyramid shone white, until people took them away to build Cairo",
     lambda: QUAKE_AD == 1303,
     "[C] loosened by the 1303 earthquake and carted off to Cairo (1356; more under Muhammad Ali); stripping had "
     "begun earlier (simplified)"),
    ("its builders weren't slaves, because they were paid in bread and beer", lambda: True,
     "[W] rations of bread and beer were the wages (AERA, Heit el-Ghurab bakeries and breweries)"),
    ("and buried right next to their king", lambda: True,
     "[W] Hawass: workers' tombs 'built beside the king's pyramid' (the cemetery is a few hundred metres south: "
     "'right next to' is simplified)"),
    ("thousands of people like Merer", lambda: True, "[W] workforce estimates 10,000-30,000"),
    ("So it wasn't aliens that built it", lambda: True, "[A] quarries, tools, ramps, boats, town, tombs and the diary"),
]


def report() -> tuple[str, bool]:
    rows, ok = [], True
    for claim, check, note in CLAIMS:
        good = bool(check())
        ok &= good
        rows.append(f"| {'PASS' if good else 'FAIL'} | {claim} | {note} |")
    text = ("# facts.md -- the Great Pyramid Short\n\n"
            f"{'ALL PASS' if ok else 'SOMETHING FAILED'}\n\n| | Claim | Source / check |\n|---|---|---|\n"
            + "\n".join(rows) + "\n")
    return text, ok and bool(CLAIMS)
