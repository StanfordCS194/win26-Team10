from __future__ import annotations

from pathlib import Path

from ..helpers.db import sqlite_connect, sqlite_exec_schema


def default_db_path() -> Path:
    """
    Default metrics DB path.

    Prefer `backend/metrics/data/metrics.sqlite`. If an older DB exists at the
    legacy location (`backend/metrics/metrics.sqlite`) and the new one doesn't,
    keep using the legacy DB for backward compatibility.
    """
    base = Path(__file__).resolve().parent
    preferred = base / "data" / "metrics.sqlite"
    legacy = base / "metrics.sqlite"
    if legacy.exists() and not preferred.exists():
        return legacy
    return preferred


METRICS_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS course_metrics (
  code TEXT PRIMARY KEY,
  mean_hours  REAL,
  median_hours REAL,
  median_grade TEXT,
  percent_as REAL,
  syllabus_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_course_metrics_code ON course_metrics(code);
"""


def connect(db_path: str | Path | None = None):
    path = Path(db_path) if db_path is not None else default_db_path()
    return sqlite_connect(path)


def init_schema(conn) -> None:
    sqlite_exec_schema(conn, METRICS_SCHEMA_SQL)


