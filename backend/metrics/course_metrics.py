from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CourseMetrics:
    """
    Normalized, per-course metrics aggregated from local data sources.

    All fields are optional because not every course has every metric.
    """

    # Hours (Carta)
    mean_hours: float | None = None
    median_hours: float | None = None

    # Grades
    median_grade: str | None = None
    percent_as: float | None = None  # 0..100

    # Syllabi
    syllabus_id: str | None = None


