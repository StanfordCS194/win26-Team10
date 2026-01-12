"""
Ingest `backend/evals/out/reviews*.csv` into
`backend/reviews/data/reviews.sqlite`.

The CSV contains columns:
  code, quarters, reviews

Where `quarters` and `reviews` are stringified Python lists.
Reviews are stored in SQLite as one row per (code, flow, review_idx).
"""

from __future__ import annotations

import argparse
import ast
import sys
from pathlib import Path
from typing import Any

import pandas as pd

# Prefer absolute package imports (`backend.*`) to avoid name collisions when
# running from within `backend/reviews/`.
_PROJECT_DIR = Path(__file__).resolve().parents[2]

try:
    from backend.helpers.data import normalize_code
    from backend.helpers.dates import scraped_qtr_to_course_flow
    from backend.reviews.db import connect, default_db_path, init_schema
except ImportError:  # pragma: no cover
    sys.path.append(str(_PROJECT_DIR))
    from backend.helpers.data import normalize_code
    from backend.helpers.dates import scraped_qtr_to_course_flow
    from backend.reviews.db import connect, default_db_path, init_schema


def _parse_list(value: Any) -> list[Any]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    if isinstance(value, list):
        return value
    s = str(value).strip()
    if not s:
        return []
    try:
        parsed = ast.literal_eval(s)
    except (ValueError, SyntaxError):
        return []
    return parsed if isinstance(parsed, list) else []


def _flatten_reviews(value: Any) -> list[str]:
    """
    Some exports encode reviews as a list-of-lists (e.g. [[...]]). Flatten so
    we always return a simple list[str] where each item is one review string.
    """
    parsed = _parse_list(value)
    out: list[str] = []
    for item in parsed:
        if isinstance(item, list):
            for sub in item:
                s = str(sub).strip()
                if s:
                    out.append(s)
        else:
            s = str(item).strip()
            if s:
                out.append(s)
    return out


def _iter_input_files(out_dir: Path) -> list[Path]:
    """
    Prefer the consolidated file if it exists; otherwise fall back to yearly
    files.
    """
    consolidated = out_dir / "reviews.csv"
    if consolidated.exists() and consolidated.stat().st_size > 0:
        return [consolidated]

    files = sorted(out_dir.glob("reviews-*.csv"))
    return [p for p in files if p.exists() and p.stat().st_size > 0]


def ingest(*, out_dir: Path, db_path: Path, overwrite: bool) -> None:
    files = _iter_input_files(out_dir)
    if not files:
        raise RuntimeError(f"No review CSVs found in {str(out_dir)!r}")

    with connect(db_path) as conn:
        init_schema(conn)
        if overwrite:
            conn.execute("DELETE FROM reviews")
            conn.commit()

        conn.execute("BEGIN")
        inserted = 0

        for path in files:
            df = pd.read_csv(path)

            # Support both the proper CSV (code,quarters,reviews) and older
            # shapes.
            if "code" not in df.columns:
                raise RuntimeError(f"{path.name} missing 'code' column")
            if "quarters" not in df.columns or "reviews" not in df.columns:
                # Sometimes the file is a single giant row without header
                # parsing; skip.
                raise RuntimeError(
                    f"{path.name} missing 'quarters'/'reviews' columns; "
                    f"got {list(df.columns)}"
                )

            for _, row in df.iterrows():
                code = normalize_code(str(row.get("code", "")).strip())
                if not code:
                    continue

                flows = [
                    scraped_qtr_to_course_flow(str(x))
                    for x in _parse_list(row.get("quarters"))
                ]
                reviews = _flatten_reviews(row.get("reviews"))
                if not flows or not reviews:
                    continue

                # Map flow -> list of review strings (if lengths mismatch,
                # best-effort).
                # Most rows represent one flow; some represent multiple flows.
                if len(flows) == 1:
                    flow = flows[0]
                    for i, text in enumerate(reviews):
                        if not text:
                            continue
                        conn.execute(
                            """
                            INSERT OR REPLACE INTO reviews(
                                code, flow, review_idx, text
                            )
                            VALUES(?, ?, ?, ?)
                            """,
                            (code, flow, i, text),
                        )
                        inserted += 1
                else:
                    # If multiple flows exist but reviews is not nested, store
                    # under newest flow.
                    # If you later want full fidelity, adjust upstream export
                    # to
                    # store nested lists.
                    flow = max(flows)
                    for i, text in enumerate(reviews):
                        if not text:
                            continue
                        conn.execute(
                            """
                            INSERT OR REPLACE INTO reviews(
                                code, flow, review_idx, text
                            )
                            VALUES(?, ?, ?, ?)
                            """,
                            (code, flow, i, text),
                        )
                        inserted += 1

        conn.commit()

    print(f"[reviews] wrote {inserted} review rows to {db_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest reviews CSV into SQLite."
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default=str(_PROJECT_DIR / "backend" / "evals" / "out"),
        help="Directory containing reviews CSV exports",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=str(default_db_path()),
        help="Path to output SQLite database",
    )
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    ingest(
        out_dir=Path(args.out_dir),
        db_path=Path(args.db),
        overwrite=bool(args.overwrite),
    )


if __name__ == "__main__":
    main()
