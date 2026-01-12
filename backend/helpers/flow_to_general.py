from __future__ import annotations

"""
Shared helpers for converting our "flow" identifiers into external formats.

Used by the syllabi pipeline (syllabus.stanford.edu).
"""


_QUARTER_MAPPINGS: dict[int, str] = {0: "F", 1: "W", 2: "Sp", 3: "Su"}


def format(flow: str) -> str:
    """
    Convert a flow string like "2024-0" (year-quarterIndex) to the Syllabus format:
        0 -> Fall  (Fyy)
        1 -> Winter (Wyy)
        2 -> Spring (Spyy)
        3 -> Summer (Suyy)

    Note: For Winter/Spring/Summer, the syllabus site uses the *next* calendar year.
    """
    year_str, quarter_str = flow.split("-")
    year, quarter = int(year_str), int(quarter_str)
    if quarter > 0:
        year += 1
    year_cropped = str(year)[2:]
    q = _QUARTER_MAPPINGS[quarter]
    return f"{q}{year_cropped}"


