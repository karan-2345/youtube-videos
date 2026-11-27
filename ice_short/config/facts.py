"""
config/facts.py -- every claim in this Short, where it comes from, and a check.  python3 build.py facts -> facts.md

Sources (checked 2026-11-27; the web pages could not be fetched from the cloud session, so these were read through
search-engine summaries quoting them):
  [A]  "Frederic Tudor", Wikipedia: born Boston 1783, died 1864 aged 80; in 1806 sent the brig Favorite with about
       130 tons of ice from Charlestown to Martinique (about 1,500 miles); no ice houses on the island; spent parts of
       1812 and 1813 in debtors' prison; built ice houses in Calcutta, Bombay and Madras; known as the "Ice King".
  [B]  G. Weightman, "The Frozen Water Trade" (2003); American Heritage, "Cold Mine"; Smithsonian, "The Ice King
       Cometh" (2012); Mental Floss, "The Surprisingly Cool History of Ice": the Boston Gazette notice of 1806
       ("we hope this will not prove to be a slippery speculation"); the first voyage sold at a loss of about $4,500;
       jailed for debt (Mental Floss: three times between 1809 and 1813); the insulation experiments that ended on
       sawdust, a free waste product of the sawmills; Wyeth's horse-drawn cutter for square blocks (1825).
  [C]  "Ice trade", Wikipedia; Wired, "Sept. 13, 1833: Imported Ice Chills, Thrills India" (2010); Down To Earth,
       "America's frozen aid"; The Telegraph (Kolkata), on Tudor and Calcutta; puronokolkata.com, "Ice House,
       Calcutta, c1833": the Tuscany left Boston in May 1833 with about 180 tons, arrived in September after a
       four-month voyage with about 100 tons; Calcutta's residents raised a subscription for an ice house within
       days; India became Tudor's most lucrative market for about twenty years.
  [D]  Geography: Boston 42.4 N 71.1 W; Cape of Good Hope 34.4 S; Calcutta (Kolkata) 22.6 N 88.4 E; Martinique 14.6 N.
  [E]  Physics (any textbook): ice melts through its surface, and a big block has far less surface for its weight than
       the same ice broken into small pieces, so it melts far more slowly.

Simplified (say so in the delivery):
  - "everyone laughed at him": storytelling for the Boston Gazette's mocking notice and a city that thought him mad.
  - "thirty years later": the Calcutta voyage was in 1833, 27 years after 1806 (rounded).
  - "a slippery plan": the newspaper's words were "a slippery speculation".
  - the ship is drawn as a generic brig/full-rigged ship of the time, not a plan of the Favorite or the Tuscany;
    Tudor is a figure in period dress, not a likeness.
  - "a house just for his ice": the residents' subscription paid for the first ice house (land from the Governor
    General); later houses were built by Tudor's company.
"""

from __future__ import annotations

YEAR_FIRST = 1806          # [A]
YEAR_INDIA = 1833          # [C]
BORN = 1783                # [A]
FIRST_TONS = 130           # [A] (some sources say 80)
LOSS_USD = 4500            # [B]
PRISON_YEARS = (1812, 1813)  # [A]
SHIPPED_T = 180            # [C]
ARRIVED_T = 100            # [C] "nearly 100 tons"
VOYAGE_MONTHS = 4          # [C] May -> September
LAT = {"boston": 42.4, "cape": -34.4, "calcutta": 22.6, "martinique": 14.6}   # [D]
LON = {"boston": -71.1, "calcutta": 88.4}                                     # [D]


def _crossings(lats):
    return sum(1 for a, b in zip(lats, lats[1:]) if a * b < 0)


CLAIMS = [
    ("In 1806 a young man from Boston", lambda: YEAR_FIRST == 1806 and YEAR_FIRST - BORN <= 25,
     f"[A] Tudor, born in Boston {BORN}, was {YEAR_FIRST - BORN} in 1806"),
    ("tried to sell frozen pond water on a tropical island", lambda: 10 <= LAT["martinique"] <= 23.4,
     f"[A] about {FIRST_TONS} tons of pond ice to Martinique ({LAT['martinique']} N, inside the tropics)"),
    ("and everyone laughed at him", lambda: True,
     "[B] the Boston Gazette mocked the voyage; storytelling for a city that thought it mad"),
    ("thirty years later he was shipping ice ... to India", lambda: abs(YEAR_INDIA - YEAR_FIRST - 30) <= 3,
     f"[C] Calcutta voyage {YEAR_INDIA}: {YEAR_INDIA - YEAR_FIRST} years later (rounded to thirty)"),
    ("halfway around the world", lambda: abs(LON["calcutta"] - LON["boston"]) >= 150,
     f"[D] Calcutta is {abs(LON['calcutta'] - LON['boston']):.0f} degrees of longitude from Boston (180 = opposite)"),
    ("His name was Frederic Tudor", lambda: True, "[A]"),
    ("a Boston newspaper joked that it was a slippery plan", lambda: True,
     "[B] Boston Gazette 1806: \"we hope this will not prove to be a slippery speculation\""),
    ("most of the ice melted on the way, and Martinique had nowhere to keep the rest cold",
     lambda: True, "[A]/[B] much of the cargo melted; Martinique had no ice houses"),
    ("So he lost thousands of dollars", lambda: LOSS_USD >= 2000, f"[B] the first voyage lost about ${LOSS_USD:,}"),
    ("his debts put him in debtors' prison", lambda: len(PRISON_YEARS) >= 1,
     f"[A] parts of {PRISON_YEARS[0]} and {PRISON_YEARS[1]} in debtors' prison ([B]: up to three times, 1809-1813)"),
    ("a big block melts far more slowly than small pieces", lambda: (2 ** 2) / (2 ** 3) < 1,
     "[E] a block twice as big each way holds 8x the ice but has only 4x the surface"),
    ("he cut his blocks square, packed them tight and buried them in sawdust that sawmills threw away",
     lambda: True, "[B] Wyeth's cutter (1825) made uniform blocks that packed tightly; sawdust, a free waste product"),
    ("in 1833 he loaded 180 tons of pond ice onto a ship called the Tuscany", lambda: SHIPPED_T == 180,
     "[C] the Tuscany, Boston, May 1833, about 180 tons"),
    ("after four months at sea", lambda: VOYAGE_MONTHS == 4, "[C] May to September 1833"),
    ("crossing the equator twice",
     lambda: _crossings([LAT["boston"], LAT["cape"], LAT["calcutta"]]) == 2,
     "[D] Boston (N) -> round the Cape of Good Hope (S) -> Calcutta (N)"),
    ("about 100 tons were still frozen in Calcutta", lambda: abs(ARRIVED_T - 100) <= 10,
     "[C] nearly 100 tons arrived (more than a third melted)"),
    ("they built a house just for his ice", lambda: True,
     "[C] residents raised a subscription for an ice house within days of the arrival"),
    ("he became known as the Ice King", lambda: True, "[A]/[B]; [C] India became his most lucrative market for ~20 years"),
]


def report() -> tuple[str, bool]:
    rows, ok = [], True
    for claim, check, note in CLAIMS:
        good = bool(check())
        ok &= good
        rows.append(f"| {'PASS' if good else 'FAIL'} | {claim} | {note} |")
    text = "# facts.md\n\n| | Claim | Source / check |\n|---|---|---|\n" + "\n".join(rows) + "\n"
    return text, ok and bool(CLAIMS)
