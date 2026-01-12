from __future__ import annotations

"""
Generate `backend/metrics/data/metrics.sqlite` from local CSV sources.

Sources:
- metrics/data/hours_YYYY.csv (latest year)
- metrics/data/grades.csv
- syllabi/res.json (optional, via metrics.helpers.get_syllabi_map)
"""

import argparse
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(_BACKEND_DIR))

from metrics.db import connect, default_db_path, init_schema  # noqa: E402
from metrics.helpers import build_course_metrics_lookup, get_latest_metrics_file  # noqa: E402


def write_metrics_sqlite(*, db_path: Path) -> int:
    metrics_df = get_latest_metrics_file()
    lookup = build_course_metrics_lookup(metrics=metrics_df)

    with connect(db_path) as conn:
        init_schema(conn)
        conn.execute("DELETE FROM course_metrics")
        conn.execute("BEGIN")
        n = 0
        for code, cm in lookup.items():
            conn.execute(
                """
                INSERT OR REPLACE INTO course_metrics(
                  code, mean_hours, median_hours, median_grade, percent_as, syllabus_id
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    code,
                    cm.mean_hours,
                    cm.median_hours,
                    cm.median_grade,
                    cm.percent_as,
                    cm.syllabus_id,
                ),
            )
            n += 1
        conn.commit()
    return n


def main() -> None:
    parser = argparse.ArgumentParser(description="Build metrics SQLite DB from CSV sources.")
    parser.add_argument("--db", type=str, default=str(default_db_path()))
    args = parser.parse_args()

    n = write_metrics_sqlite(db_path=Path(args.db))
    print(f"[metrics] wrote {n} rows to {args.db}")


if __name__ == "__main__":
    main()


