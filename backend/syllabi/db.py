from __future__ import annotations

from pathlib import Path

from ..helpers.db import sqlite_connect, sqlite_exec_schema


def default_db_path() -> Path:
    """
    Default syllabi DB path.

    Prefer `backend/syllabi/data/syllabi.sqlite`. If an older DB exists at the
    legacy location (`backend/syllabi/syllabi.sqlite`) and the new one doesn't,
    keep using the legacy DB for backward compatibility.
    """
    base = Path(__file__).resolve().parent
    preferred = base / "data" / "syllabi.sqlite"
    legacy = base / "syllabi.sqlite"
    if legacy.exists() and not preferred.exists():
        return legacy
    return preferred


SYLLABI_SCHEMA_SQL = """
-- New simplified shape: only keep the latest successful syllabus per code.
CREATE TABLE IF NOT EXISTS syllabi_latest (
  code TEXT PRIMARY KEY,
  syllabus_id TEXT NOT NULL,
  flow_found TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_syllabi_latest_code ON syllabi_latest(code);

-- Backward-compat: if an older DB had the per-flow table, keep it and allow
-- one-time migration into syllabi_latest.
CREATE TABLE IF NOT EXISTS syllabi (
  code TEXT NOT NULL,
  flow TEXT NOT NULL,
  syllabus_id TEXT NOT NULL,
  PRIMARY KEY (code, flow)
);

CREATE INDEX IF NOT EXISTS idx_syllabi_code ON syllabi(code);
CREATE INDEX IF NOT EXISTS idx_syllabi_code_flow ON syllabi(code, flow);
"""


def connect(db_path: str | Path | None = None):
    path = Path(db_path) if db_path is not None else default_db_path()
    return sqlite_connect(path)


def init_schema(conn) -> None:
    sqlite_exec_schema(conn, SYLLABI_SCHEMA_SQL)
