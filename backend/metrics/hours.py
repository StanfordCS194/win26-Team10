
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

import pandas as pd

# Allow running this file directly.
_PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

from backend.helpers.data import normalize_code, parse_literal  # noqa: E402
from backend.metrics.db import connect as metrics_connect  # noqa: E402
from backend.metrics.db import default_db_path as metrics_default_db_path  # noqa: E402
from backend.metrics.db import init_schema as metrics_init_schema  # noqa: E402

def _sum_hours_cell(cell: Any) -> list[int]:
    """
    Each yearly `hours` value is expected to be either:
    - a list[int] (length 8), or
    - a list[list[int]] (multiple distributions to aggregate)
    """
    if cell is None or (isinstance(cell, float) and pd.isna(cell)):
        return [0] * 8

    parsed = parse_literal(cell)
    if parsed == []:
        return [0] * 8

    # list[int]
    if isinstance(parsed, list) and len(parsed) == 8 and all(
        isinstance(x, (int, float)) for x in parsed
    ):
        return [int(x) for x in parsed]

    # list[list[int]]
    summed = [0] * 8
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, list) and len(item) == 8:
                summed = [a + int(b) for a, b in zip(summed, item)]
    return summed


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract year from command line")
    parser.add_argument("year", type=int, help="Year to be processed")
    parser.add_argument(
        "--db",
        type=str,
        default=str(metrics_default_db_path()),
        help="Path to metrics.sqlite (defaults to backend/metrics/data/metrics.sqlite)",
    )
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    end_year = args.year

    backend_dir = Path(__file__).resolve().parents[1]
    out_dir = backend_dir / "evals" / "out"

    db_path = Path(args.db)
    with metrics_connect(db_path) as conn:
        metrics_init_schema(conn)
        if args.overwrite:
            conn.execute("DELETE FROM hours_year")
            conn.commit()

        conn.execute("BEGIN")
        inserted = 0

        # Include the next calendar year (historically, hours data seems to be stored this way).
        for yr in range(2021, end_year + 2):
            metadata_path = str(out_dir / f"metaData-{yr}.csv")
            if not os.path.exists(metadata_path):
                print(
                    f"⚠️  Warning: {metadata_path} not found – skipping this year."
                )
                continue

            df = pd.read_csv(metadata_path)
            df.set_index(df.columns[0], inplace=True)
            if "hours" not in df.columns:
                print(
                    f"⚠️  Warning: {metadata_path} missing 'hours' column – skipping this year."
                )
                continue

            # Insert one row per (code, year) with bucket columns.
            for code_raw, row in df.iterrows():
                code = normalize_code(str(code_raw))
                dist = _sum_hours_cell(row.get("hours"))
                if sum(dist) <= 0:
                    continue
                conn.execute(
                    """
                    INSERT OR REPLACE INTO hours_year(
                      code, year,
                      b0_5, b5_10, b10_15, b15_20, b20_25, b25_30, b30_35, b35_40
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (code, yr, *dist),
                )
                inserted += 1

        conn.commit()

    print(f"✅ Wrote {inserted} (code,year) rows to {db_path}")


if __name__ == "__main__":
    main()