from __future__ import annotations

import sqlite3
from pathlib import Path


def sqlite_connect(db_path: str | Path) -> sqlite3.Connection:
    """
    Open a SQLite connection to a file path (no server required).
    """
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


def sqlite_init_pragmas(conn: sqlite3.Connection) -> None:
    """
    Pragmas tuned for local read-heavy workloads with periodic bulk ingests.
    """
    conn.executescript(
        """
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        """
    )


def sqlite_exec_schema(conn: sqlite3.Connection, schema_sql: str) -> None:
    sqlite_init_pragmas(conn)
    conn.executescript(schema_sql)
    conn.commit()


