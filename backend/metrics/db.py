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

-- One row per (code, year) with bucket counts for hours distribution.
CREATE TABLE IF NOT EXISTS hours_year (
  code TEXT NOT NULL,
  year INTEGER NOT NULL,
  b0_5   INTEGER NOT NULL,
  b5_10  INTEGER NOT NULL,
  b10_15 INTEGER NOT NULL,
  b15_20 INTEGER NOT NULL,
  b20_25 INTEGER NOT NULL,
  b25_30 INTEGER NOT NULL,
  b30_35 INTEGER NOT NULL,
  b35_40 INTEGER NOT NULL,
  PRIMARY KEY (code, year)
);

CREATE INDEX IF NOT EXISTS idx_hours_year_code ON hours_year(code);

-- Human-friendly view exposing bucket columns as "0-5", "5-10", etc.
CREATE VIEW IF NOT EXISTS hours_year_readable AS
SELECT
  code,
  year,
  b0_5   AS "0-5",
  b5_10  AS "5-10",
  b10_15 AS "10-15",
  b15_20 AS "15-20",
  b20_25 AS "20-25",
  b25_30 AS "25-30",
  b30_35 AS "30-35",
  b35_40 AS "35-40"
FROM hours_year;

-- Compute mean/median per (code, year) using grouping ops in SQLite.
CREATE VIEW IF NOT EXISTS hours_year_stats AS
WITH bins AS (
  SELECT code, year, 0 AS bucket, b0_5   AS cnt,  2.5 AS avg FROM hours_year
  UNION ALL SELECT code, year, 1, b5_10,  7.5 FROM hours_year
  UNION ALL SELECT code, year, 2, b10_15, 12.5 FROM hours_year
  UNION ALL SELECT code, year, 3, b15_20, 17.5 FROM hours_year
  UNION ALL SELECT code, year, 4, b20_25, 22.5 FROM hours_year
  UNION ALL SELECT code, year, 5, b25_30, 27.5 FROM hours_year
  UNION ALL SELECT code, year, 6, b30_35, 32.5 FROM hours_year
  UNION ALL SELECT code, year, 7, b35_40, 37.5 FROM hours_year
),
tot AS (
  SELECT code, year,
         SUM(cnt) AS total_responses,
         SUM(cnt * avg) AS weighted_sum
  FROM bins
  GROUP BY code, year
),
cum AS (
  SELECT
    b.code,
    b.year,
    b.bucket,
    b.cnt,
    b.avg,
    t.total_responses,
    t.weighted_sum,
    SUM(b.cnt) OVER (PARTITION BY b.code, b.year ORDER BY b.bucket) AS running
  FROM bins b
  JOIN tot t USING (code, year)
),
med AS (
  SELECT code, year, MIN(avg) AS median_hours
  FROM cum
  WHERE running >= (total_responses / 2.0)
  GROUP BY code, year
)
SELECT
  t.code,
  t.year,
  t.total_responses,
  CASE WHEN t.total_responses > 0 THEN (t.weighted_sum * 1.0 / t.total_responses) END AS mean_hours,
  m.median_hours
FROM tot t
JOIN med m USING (code, year)
WHERE t.total_responses > 0;

-- Aggregate buckets across years per code and compute mean/median.
CREATE VIEW IF NOT EXISTS hours_code_stats AS
WITH agg AS (
  SELECT
    code,
    SUM(b0_5)   AS b0_5,
    SUM(b5_10)  AS b5_10,
    SUM(b10_15) AS b10_15,
    SUM(b15_20) AS b15_20,
    SUM(b20_25) AS b20_25,
    SUM(b25_30) AS b25_30,
    SUM(b30_35) AS b30_35,
    SUM(b35_40) AS b35_40
  FROM hours_year
  GROUP BY code
),
bins AS (
  SELECT code, 0 AS bucket, b0_5   AS cnt,  2.5 AS avg FROM agg
  UNION ALL SELECT code, 1, b5_10,  7.5 FROM agg
  UNION ALL SELECT code, 2, b10_15, 12.5 FROM agg
  UNION ALL SELECT code, 3, b15_20, 17.5 FROM agg
  UNION ALL SELECT code, 4, b20_25, 22.5 FROM agg
  UNION ALL SELECT code, 5, b25_30, 27.5 FROM agg
  UNION ALL SELECT code, 6, b30_35, 32.5 FROM agg
  UNION ALL SELECT code, 7, b35_40, 37.5 FROM agg
),
tot AS (
  SELECT code,
         SUM(cnt) AS total_responses,
         SUM(cnt * avg) AS weighted_sum
  FROM bins
  GROUP BY code
),
cum AS (
  SELECT
    b.code,
    b.bucket,
    b.cnt,
    b.avg,
    t.total_responses,
    t.weighted_sum,
    SUM(b.cnt) OVER (PARTITION BY b.code ORDER BY b.bucket) AS running
  FROM bins b
  JOIN tot t USING (code)
),
med AS (
  SELECT code, MIN(avg) AS median_hours
  FROM cum
  WHERE running >= (total_responses / 2.0)
  GROUP BY code
)
SELECT
  t.code,
  t.total_responses,
  CASE WHEN t.total_responses > 0 THEN (t.weighted_sum * 1.0 / t.total_responses) END AS mean_hours,
  m.median_hours
FROM tot t
JOIN med m USING (code)
WHERE t.total_responses > 0;
"""


def connect(db_path: str | Path | None = None):
    path = Path(db_path) if db_path is not None else default_db_path()
    return sqlite_connect(path)


def init_schema(conn) -> None:
    sqlite_exec_schema(conn, METRICS_SCHEMA_SQL)


