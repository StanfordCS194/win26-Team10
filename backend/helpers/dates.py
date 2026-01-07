from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass(frozen=True)
class StanfordTerm:
    season: str  # "Autumn" | "Winter" | "Spring" | "Summer"
    year: int

    def term_offered(self) -> str:
        return f"{self.season} {self.year}"


def _season_from_month(month: int) -> str:
    """
    Approximate Stanford quarter by month.

    - Autumn: Sep-Dec
    - Winter: Jan-Mar
    - Spring: Apr-Jun
    - Summer: Jul-Aug
    """
    if month in (9, 10, 11, 12):
        return "Autumn"
    if month in (1, 2, 3):
        return "Winter"
    if month in (4, 5, 6):
        return "Spring"
    return "Summer"


def default_term_offered(today: Optional[date] = None) -> str:
    """
    Return the default `termOffered` filter string to use for departments generation.

    Behavior requested:
    - Use **Autumn of the current calendar year** if we're currently in Autumn.
    - If we're currently in Winter/Spring/Summer, use **Autumn of (year - 1)**.

    Examples:
    - 2026-01-07 (Winter) -> "Autumn 2025"
    - 2026-10-01 (Autumn) -> "Autumn 2026"
    """
    today = today or date.today()
    season = _season_from_month(today.month)
    year = today.year if season == "Autumn" else today.year - 1
    return StanfordTerm("Autumn", year).term_offered()


