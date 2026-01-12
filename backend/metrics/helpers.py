from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..helpers.general import parse_percent, safe_float
from ..helpers.data import normalize_code

from .course_metrics import CourseMetrics
from ..syllabi.helpers import load_syllabi_map
from .db import (
    connect as metrics_connect,
    default_db_path as metrics_default_db_path,
    init_schema as metrics_init_schema,
)

_METRICS_DIR = Path(__file__).resolve().parent
_DATA_DIR = _METRICS_DIR / "data"


def _latest_year_file(*, pattern: str) -> Path | None:
    """
    Return the newest file in metrics/data matching `name_YYYY.ext`.
    """
    candidates = list(_DATA_DIR.glob(pattern))
    if not candidates:
        return None

    def year_key(p: Path) -> int:
        m = re.search(r"(\d{4})", p.name)
        return int(m.group(1)) if m else -1

    return max(candidates, key=year_key)


def get_latest_metrics_file() -> pd.DataFrame | None:
    """
    Compatibility shim for older scripts (e.g. `backend/courses/run.py`).

    In oncourse, "metrics" here refers to the latest `hours_YYYY.csv` file.
    """
    latest = _latest_year_file(pattern="hours_*.csv")
    if latest is None:
        return None
    return pd.read_csv(latest)


def load_hours_df(
    metrics_df: pd.DataFrame | None = None,
) -> pd.DataFrame | None:
    """
    Load the per-course hours dataset.

    If `metrics_df` is provided, it is treated as the already-loaded hours df.
    """
    if metrics_df is not None:
        return metrics_df

    latest = _latest_year_file(pattern="hours_*.csv")
    if latest is None:
        return None
    return pd.read_csv(latest)


def load_grades_df() -> pd.DataFrame | None:
    path = _DATA_DIR / "grades.csv"
    if not path.exists():
        return None
    return pd.read_csv(path)


def get_hour_and_grade_map(
    metrics: pd.DataFrame | None,
) -> tuple[
    dict[str, tuple[float | None, float | None]],
    dict[str, tuple[str | None, float | None]],
]:
    """
    Compatibility shim for older scripts (e.g. `backend/courses/run.py`).

    Returns:
    - hourMap:  normalized_code -> (mean_hours, median_hours)
    - gradeMap: normalized_code -> (median_grade, percent_as)
    """
    hour_map: dict[str, tuple[float | None, float | None]] = {}
    grade_map: dict[str, tuple[str | None, float | None]] = {}

    hours_df = load_hours_df(metrics)
    if hours_df is not None and "code" in hours_df.columns:
        for _, row in hours_df.iterrows():
            code = normalize_code(str(row.get("code", "")))
            if not code:
                continue
            hour_map[code] = (
                safe_float(row.get("meanHours")),
                safe_float(row.get("medianHours")),
            )

    grades_df = load_grades_df()
    if grades_df is not None and "class" in grades_df.columns:
        for _, row in grades_df.iterrows():
            code = normalize_code(str(row.get("class", "")))
            if not code:
                continue
            grade_map[code] = (
                (str(row.get("Median")).strip() or None)
                if row.get("Median") is not None
                else None,
                parse_percent(row.get("%As")),
            )

    return hour_map, grade_map


def get_syllabi_map() -> dict[str, str]:
    """
    Compatibility shim.

    Loads `backend/syllabi/res.json` when present and returns:
        normalized_course_code -> syllabus_id
    """
    return load_syllabi_map()


def build_course_metrics_lookup(
    *,
    metrics: pd.DataFrame | None = None,
    syllabi_map: dict[str, str] | None = None,
) -> dict[str, CourseMetrics]:
    """
    Build a single lookup map:
        normalized_course_code -> CourseMetrics
    """
    # Prefer SQLite lookup if the metrics DB exists (fast, low memory).
    db_path = metrics_default_db_path()
    if db_path.exists() and db_path.stat().st_size > 0:
        out: dict[str, CourseMetrics] = {}
        with metrics_connect(db_path) as conn:
            metrics_init_schema(conn)
            rows = conn.execute(
                """
                SELECT
                    code,
                    mean_hours,
                    median_hours,
                    median_grade,
                    percent_as,
                    syllabus_id
                FROM course_metrics
                """
            ).fetchall()
        if rows:
            for r in rows:
                out[str(r["code"])] = CourseMetrics(
                    mean_hours=r["mean_hours"],
                    median_hours=r["median_hours"],
                    median_grade=r["median_grade"],
                    percent_as=r["percent_as"],
                    syllabus_id=r["syllabus_id"],
                )
            return out

    hour_map, grade_map = get_hour_and_grade_map(metrics)
    syllabi = syllabi_map or get_syllabi_map()

    keys = set(hour_map.keys()) | set(grade_map.keys()) | set(syllabi.keys())
    out: dict[str, CourseMetrics] = {}
    for code in keys:
        mean_h, median_h = hour_map.get(code, (None, None))
        median_g, pct_as = grade_map.get(code, (None, None))
        out[code] = CourseMetrics(
            mean_hours=mean_h,
            median_hours=median_h,
            median_grade=median_g,
            percent_as=pct_as,
            syllabus_id=syllabi.get(code),
        )
    return out
