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


def term_id_to_flow(term_id: int) -> str:
    """
    Convert legacy term IDs used in some review/eval exports to a course "flow".

    Example mapping (from historical data notes):
    - 1212 = Autumn 2020/21
    - 1214 = Winter 2020/21
    - 1216 = Spring 2020/21
    - 1218 = Summer 2020/21

    Returns:
        "YYYY-q" where q is 0..3 for (Autumn, Winter, Spring, Summer).
    """
    base_year = 2010
    base_term_id = 1112

    delta = term_id - base_term_id
    year = (delta // 10) + base_year
    season = (delta % 10) // 2
    return f"{year}-{season}"


def scraped_qtr_to_course_flow(qtr: str) -> str:
    """
    Convert scraped quarter strings to oncourse "flow".

    Some scrapers produce quarters as "YYYY-q" where YYYY is the calendar year
    *the quarter started*. oncourse flow uses the academic-year anchor:

    - "2023-0" (Autumn 2023/24) stays "2023-0"
    - "2024-1" (Winter that started in 2024) becomes "2023-1"
    """
    year_str, q_str = qtr.split("-")
    year, q = int(year_str), int(q_str)
    if q > 0:
        year -= 1
    return f"{year}-{q}"


def current_flow_year(today: Optional[date] = None) -> int:
    """
    Return the academic-year anchor used by our "flow" strings.

    Requested behavior:
    - If month is Jan-Jul (inclusive), return year-1 (next school year not started)
    - Otherwise (Aug-Dec), return year
    """
    today = today or date.today()
    return today.year - 1 if 1 <= today.month <= 7 else today.year


