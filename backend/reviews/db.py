from __future__ import annotations

from pathlib import Path

from ..helpers.db import sqlite_connect, sqlite_exec_schema


def default_db_path() -> Path:
    """
    Default reviews DB path.

    Prefer `backend/reviews/data/reviews.sqlite`. If an older DB exists at the
    legacy location (`backend/reviews/reviews.sqlite`) and the new one doesn't,
    keep using the legacy DB for backward compatibility.
    """
    base = Path(__file__).resolve().parent
    preferred = base / "data" / "reviews.sqlite"
    legacy = base / "reviews.sqlite"
    if legacy.exists() and not preferred.exists():
        return legacy
    return preferred


REVIEWS_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS reviews (
  code TEXT NOT NULL,
  flow TEXT NOT NULL,
  idx  INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (code, flow, idx)
);

CREATE INDEX IF NOT EXISTS idx_reviews_code ON reviews(code);
CREATE INDEX IF NOT EXISTS idx_reviews_code_flow ON reviews(code, flow);
"""


def connect(db_path: str | Path | None = None):
    path = Path(db_path) if db_path is not None else default_db_path()
    return sqlite_connect(path)


def init_schema(conn) -> None:
    sqlite_exec_schema(conn, REVIEWS_SCHEMA_SQL)


