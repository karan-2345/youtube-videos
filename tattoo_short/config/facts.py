"""
config/facts.py -- every number the viewer hears comes from here (tools/narration.py fills {{key}} tokens).

The tattoo Short speaks no numbers (script v1), so the table is empty; the claims and their sources are in
research/notes.md. Add a Fact here before putting a number in the script.
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


F = _Facts({})
