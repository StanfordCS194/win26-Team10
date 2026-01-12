from __future__ import annotations

from pathlib import Path
from typing import Iterable

from ..helpers.data import normalize_code
from .db import connect, default_db_path, init_schema


def ensure_db(db_path: str | Path | None = None) -> Path:
    """
    Ensure the DB exists and has the right schema.
    """
    path = Path(db_path) if db_path is not None else default_db_path()
    with connect(path) as conn:
        init_schema(conn)
    return path


def get_review_flows(code: str, *, db_path: str | Path | None = None) -> list[str]:
    """
    Return all flows that have at least 1 review for `code`, sorted desc.
    """
    c = normalize_code(code)
    with connect(db_path) as conn:
        rows = conn.execute(
            "SELECT DISTINCT flow FROM reviews WHERE code = ? ORDER BY flow DESC",
            (c,),
        ).fetchall()
    return [str(r["flow"]) for r in rows]


def get_reviews(
    code: str,
    *,
    flow: str | None = None,
    db_path: str | Path | None = None,
) -> list[str]:
    """
    Return review text for a course.

    - If `flow` is provided, returns reviews for that flow only.
    - Otherwise returns reviews across all flows (newest flows first).
    """
    c = normalize_code(code)
    with connect(db_path) as conn:
        if flow is not None:
            rows = conn.execute(
                """
                SELECT text
                FROM reviews
                WHERE code = ? AND flow = ?
                ORDER BY review_idx ASC
                """,
                (c, flow),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT text
                FROM reviews
                WHERE code = ?
                ORDER BY flow DESC, review_idx ASC
                """,
                (c,),
            ).fetchall()
    return [str(r["text"]) for r in rows]


def iter_reviews(
    code: str,
    *,
    flow: str | None = None,
    db_path: str | Path | None = None,
) -> Iterable[str]:
    """
    Streaming variant of `get_reviews()` for very large result sets.
    """
    c = normalize_code(code)
    conn = connect(db_path)
    try:
        if flow is not None:
            cur = conn.execute(
                """
                SELECT text
                FROM reviews
                WHERE code = ? AND flow = ?
                ORDER BY review_idx ASC
                """,
                (c, flow),
            )
        else:
            cur = conn.execute(
                """
                SELECT text
                FROM reviews
                WHERE code = ?
                ORDER BY flow DESC, review_idx ASC
                """,
                (c,),
            )
        for row in cur:
            yield str(row["text"])
    finally:
        conn.close()


