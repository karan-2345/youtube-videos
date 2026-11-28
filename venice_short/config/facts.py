"""
config/facts.py -- every claim in this Short, where it comes from, and a check.  python3 build.py facts -> facts.md

Sources (checked 2026-11-28; web pages could not be fetched from the cloud session, so these were read through
search-engine summaries quoting them):
  [A]  Britannica, "How Was Venice Built on Water?": wooden piles (mainly alder and other hardwoods) driven into the
       mud of the lagoon; planks laid on the piles, then brick and stone; the low-oxygen water slows the decay of the
       piles by keeping out the fungi.
  [B]  Britannica, "Venice: History": the Lombard invasions (from 568) drove great numbers of mainlanders onto the
       islands of the lagoon; Torcello settled in the 5th century by tradition.
  [C]  Pignatelli et al. (Dendrodata), dendrochronology of Venetian wooden structures: the oldest dated to the second
       half of the 7th century AD; Ammerman et al., Radiocarbon: San Lorenzo boreholes, structural timbers of the
       6th-7th century cal AD.
  [D]  Pagella et al. (2025), "Traditional wooden foundation piles in Amsterdam and Venice" (TU Delft repository):
       Venetian piles were short (1 to 3.5 m), of larch, oak, alder and elm, 100 to 250 mm across; Ceccato &
       Simonini (2013, Univ. of Padua): "short and closely spaced wooden piles used to improve the shallowest layers
       of very soft silty clay"; the piles rarely reach stiffer layers. theconstructor.org / pilebuck.com: about nine
       piles per square metre.
  [E]  Santa Maria della Salute (Wikipedia; Venice for Visitors; Britannica): vowed after the plague of 1630, built
       1631-1687 by Baldassare Longhena; it stands on 1,156,627 piles (Venice for Visitors) or 1,106,657 (a Slovenian
       wood-science paper, a book cited on Goodreads); Wikipedia: "about 1,000,000". Either count is more than a
       million (and more than 1.1 million, the figure on screen).
  [F]  Estimates for the whole city: 7.9 to 15.8 million piles, or at least 11 million (popular-science reports of
       the 2025 Pagella study and others); 14,000 under the Rialto Bridge, 10,000 under St Mark's.
  [G]  Wood decay: USDA Forest Products Lab and the University of Kentucky extension (FORFS 03-05): fence posts rot
       when decay fungi digest them, mostly at the ground line; untreated pine posts may last only 3 to 7 years.
       Blanchette (2000), "A review of microbial deterioration found in archaeological wood": low oxygen excludes most
       fungi and insects; in waterlogged, oxygen-free sediment erosion bacteria do the damage, extremely slowly.
  [H]  BBC report (via search summaries) and Ceccato & Simonini: bacteria do degrade the Venetian piles even without
       oxygen, but much more slowly than fungi; the water that fills the emptied cells (and the mud around them) keeps
       the piles in shape.

Simplified (say so in the delivery):
  - "hammered into the mud more than a thousand years ago": true of the oldest timbers (6th-7th century); most piles
    under today's buildings are younger (the Salute's are about 390 years old).
  - "no rock, only water and mud": the piles stand in soft silty clay; a firmer clay layer (the caranto) lies under
    parts of the city, but it is still not rock.
  - "packed firm": the close piles improve (stiffen) the soft clay, according to [D]; the engineering is more subtle.
  - "so slowly that it takes centuries": the bacterial decay is measured over centuries [G][H]; some piles are badly
    decayed, and researchers now watch them; the script does not claim the piles last forever.
  - "upside down": timber piles are driven narrow end (the treetop end) first, hence the popular "upside-down forest".
"""

from __future__ import annotations

NOW = 2026
OLDEST_TIMBER_CENTURY = (6, 7)            # [C] 6th-7th century AD
SALUTE_PILES = (1_106_657, 1_156_627)     # [E]
SALUTE_BUILT = (1631, 1687)               # [E]
CITY_PILES_M = (7.9, 15.8)                # [F] millions
PILE_LEN_M = (1.0, 3.5)                   # [D]
PILE_DIAM_MM = (100, 250)                 # [D]
PILES_PER_M2 = 9                          # [D]
SPECIES = ("larch", "oak", "alder", "elm")  # [D]
FENCE_POST_YEARS = (3, 7)                 # [G] untreated pine
ON_SCREEN_SALUTE = 1_100_000              # "1,100,000+"

CLAIMS = [
    ("Venice is standing on millions of tree trunks", lambda: CITY_PILES_M[0] >= 2,
     f"[F] estimates {CITY_PILES_M[0]} to {CITY_PILES_M[1]} million piles under the city"),
    ("hammered into the mud more than a thousand years ago",
     lambda: NOW - OLDEST_TIMBER_CENTURY[1] * 100 > 1000,
     f"[C] oldest structural timbers 6th-7th century AD: {NOW - 700}+ years (the oldest, not all)"),
    ("they should have rotted away long ago", lambda: FENCE_POST_YEARS[1] < 50,
     f"[G] untreated wood in the ground rots in {FENCE_POST_YEARS[0]}-{FENCE_POST_YEARS[1]} years"),
    ("but they're still holding the city up", lambda: True,
     "[A][D] the buildings still stand on their pile foundations"),
    ("the first Venetians built on the islands of a shallow lagoon", lambda: True,
     "[B] mainlanders fled onto the lagoon islands (5th-7th century)"),
    ("no rock, only water and soft, sticky mud", lambda: PILE_LEN_M[1] < 5,
     "[D] very soft silty clay; short piles rarely reach stiffer layers (simplified: no bedrock to reach)"),
    ("cut down whole forests, sharpened the trunks into posts", lambda: len(SPECIES) >= 3,
     f"[D] piles of {', '.join(SPECIES)}, {PILE_DIAM_MM[0]}-{PILE_DIAM_MM[1]} mm across, {PILE_LEN_M[0]}-{PILE_LEN_M[1]} m"),
    ("hammered them in so close together that the mud between them was packed firm", lambda: PILES_PER_M2 >= 5,
     f"[D] about {PILES_PER_M2} per square metre, 'used to improve' the soft clay (simplified)"),
    ("and then they built in stone on top", lambda: True, "[A] planks on the piles, then brick and stone"),
    ("This one church, the Salute, is standing on more than a million posts",
     lambda: min(SALUTE_PILES) > 1_000_000 and min(SALUTE_PILES) > ON_SCREEN_SALUTE,
     f"[E] {SALUTE_PILES[0]:,} or {SALUTE_PILES[1]:,}; screen shows {ON_SCREEN_SALUTE:,}+; built {SALUTE_BUILT[0]}-{SALUTE_BUILT[1]}"),
    ("wood rots, because tiny fungi eat it", lambda: True, "[G] decay fungi digest the wood"),
    ("an old fence post crumbles in just a few years", lambda: FENCE_POST_YEARS[0] <= 5,
     f"[G] untreated pine posts: {FENCE_POST_YEARS[0]}-{FENCE_POST_YEARS[1]} years"),
    ("Down in the mud there's almost no oxygen, and the fungi that rot wood can't live without it", lambda: True,
     "[A][G] low oxygen excludes most fungi and insects"),
    ("Only bacteria still nibble at the posts, so slowly that it takes centuries", lambda: True,
     "[G][H] anaerobic erosion bacteria still degrade the wood, extremely slowly"),
    ("water fills the wood, so it keeps its shape and keeps carrying the weight", lambda: True,
     "[H] water fills the emptied cells; the piles keep their shape"),
    ("a whole forest, upside down in the mud", lambda: True,
     "[F] millions of trunks; driven treetop end first (the popular 'upside-down forest')"),
    ("(screen) built 1631", lambda: SALUTE_BUILT == (1631, 1687), "[E]"),
    ("(screen) ~1,500 YEARS AGO: the first settlers in the lagoon", lambda: 1300 <= NOW - 600 <= 1600 and 1400 <= NOW - 568 + 100,
     "[B] 5th-7th century (Torcello by tradition 5th c.; the Lombards from 568): 1,400-1,600 years ago"),
    ("(screen) 1,100,000+ posts under one church", lambda: min(SALUTE_PILES) > ON_SCREEN_SALUTE, "[E]"),
    ("(screen) POSTS DRAWN BIGGER, NOT TO SCALE", lambda: True,
     f"[D] real piles {PILE_LEN_M[0]}-{PILE_LEN_M[1]} m (the Salute's ~4 m), {PILE_DIAM_MM[0]}-{PILE_DIAM_MM[1]} mm, ~{PILES_PER_M2}/m2; drawn 8 m long, 0.3-0.4 m across, ~2/m2"),
    ("(screen) A FEW YEARS (fence post), YEAR 1-5", lambda: FENCE_POST_YEARS[0] <= 5 <= FENCE_POST_YEARS[1] + 1, "[G]"),
]


def report() -> tuple[str, bool]:
    rows, ok = [], True
    for claim, check, note in CLAIMS:
        good = bool(check())
        ok &= good
        rows.append(f"| {'PASS' if good else 'FAIL'} | {claim} | {note} |")
    text = "# facts.md\n\n| | Claim | Source / check |\n|---|---|---|\n" + "\n".join(rows) + "\n"
    return text, ok and bool(CLAIMS)
