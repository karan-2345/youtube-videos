"""
config/facts.py -- every number the viewer hears comes from here (tools/narration.py fills {{key}} tokens).

The pistol-shrimp Short speaks no numbers (script v1). The two temperatures below appear only on screen (S03's bars);
the claims and their sources are in research/notes.md. Add a Fact here before putting a number in the script.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Fact:
    value: float
    unit: str = ""
    fmt: str = ",.0f"
    source: str = ""


class _Facts(dict):
    def fact(self, key: str) -> Fact:
        return self._meta[key]

    def __init__(self, table: dict[str, Fact]):
        super().__init__({k: f.value for k, f in table.items()})
        self._meta = table


F = _Facts({
    # Lohse, Schmitz & Versluis 2001 (Nature): at least 5,000 K inside the bubble at collapse -> 4,727 C, shown as 4,700 C+
    "bubble_c": Fact(4700, "°C", ",.0f", "Lohse et al. 2001, Nature 413:477 (>= 5,000 K, inferred from the flash)"),
    # the Sun's photosphere, about 5,772 K -> 5,499 C
    "sun_c": Fact(5500, "°C", ",.0f", "IAU 2015 nominal solar effective temperature 5,772 K"),
})
