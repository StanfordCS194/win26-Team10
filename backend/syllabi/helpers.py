from __future__ import annotations

import json
from pathlib import Path
import sqlite3
from typing import Any

import sys

# Avoid collisions when called from within `backend/syllabi/` where
# `helpers.py` can shadow `backend/helpers` if using top-level imports.
_PROJECT_DIR = Path(__file__).resolve().parents[2]

try:
    from backend.helpers.data import normalize_code
    from backend.syllabi.db import connect as syllabi_connect
    from backend.syllabi.db import default_db_path as syllabi_default_db_path
    from backend.syllabi.db import init_schema as syllabi_init_schema
except ImportError:  # pragma: no cover
    sys.path.append(str(_PROJECT_DIR))
    from backend.helpers.data import normalize_code
    from backend.syllabi.db import connect as syllabi_connect
    from backend.syllabi.db import default_db_path as syllabi_default_db_path
    from backend.syllabi.db import init_schema as syllabi_init_schema

SYLLABUS_DO_WEBAUTH_PREFIX = (
    "https://syllabus.stanford.edu/syllabus/doWebAuth/"
)


def _default_res_path() -> Path:
    # backend/syllabi/res.json
    return Path(__file__).resolve().parent / "res.json"


def load_syllabi_map(
    *,
    db_path: str | Path | None = None,
    res_path: str | Path | None = None,
) -> dict[str, str]:
    """
    Load syllabi lookup:
        normalized_course_code -> syllabus_id

    Prefers SQLite (`backend/syllabi/data/syllabi.sqlite`) when present.
    Falls back to `res.json` for compatibility.

    Expected `res.json` shape (from older coyote scraper):
        {
          "CS106B": {"2024-0": "https://.../doWebAuth/<id>/<origId>", ...},
          ...
        }

    We collapse it to the latest (max) flow per course, and store only the
    suffix after `.../doWebAuth/` as `syllabus_id`.
    """
    dbp = Path(db_path) if db_path is not None else syllabi_default_db_path()
    if dbp.exists() and dbp.stat().st_size > 0:
        out: dict[str, str] = {}
        with syllabi_connect(dbp) as conn:
            syllabi_init_schema(conn)
            # Prefer the new simplified table.
            try:
                rows = conn.execute(
                    "SELECT code, syllabus_id FROM syllabi_latest"
                ).fetchall()
            except sqlite3.Error:
                rows = []

            # Fallback to legacy per-flow table if needed.
            if not rows:
                rows = conn.execute(
                    """
                    SELECT s.code, s.syllabus_id
                    FROM syllabi s
                    JOIN (
                        SELECT code, MAX(flow) AS max_flow
                        FROM syllabi
                        GROUP BY code
                    ) m
                    ON s.code = m.code AND s.flow = m.max_flow
                    """
                ).fetchall()
        for r in rows:
            out[str(r["code"])] = str(r["syllabus_id"])
        return out

    path = Path(res_path) if res_path is not None else _default_res_path()
    if not path.exists():
        return {}

    payload: Any
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, dict):
        return {}

    out: dict[str, str] = {}
    for code, flows in payload.items():
        norm_code = normalize_code(str(code))
        if not norm_code or not isinstance(flows, dict) or not flows:
            continue

        # Choose latest flow key lexicographically.
        latest_flow = max(str(k) for k in flows.keys())
        raw = flows.get(latest_flow)
        if not isinstance(raw, str) or not raw.strip():
            continue

        url = raw.strip()
        # Store the ID suffix, not the full URL.
        if url.startswith(SYLLABUS_DO_WEBAUTH_PREFIX):
            out[norm_code] = url.replace(SYLLABUS_DO_WEBAUTH_PREFIX, "", 1)
        else:
            out[norm_code] = url

    return out
