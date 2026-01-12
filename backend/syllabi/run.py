"""
Generate `backend/syllabi/data/syllabi.sqlite` by querying
syllabus.stanford.edu.

This recreates the generator step from
`coyote/scraping/syllabi/processSyllabi.py`
but lives in the oncourse backend and uses shared helpers:
- `helpers.flow_to_general.format()` for flow -> formatted quarter
- `helpers.headers.SYLLABUS_HEADERS` for request headers (cookie-free)

SQLite schema:
- `syllabi(code TEXT, flow TEXT, syllabus_id TEXT, PRIMARY KEY(code, flow))`
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import aiohttp
import pandas as pd

# Allow running via `python run.py` from within `backend/syllabi/`.
# (Relative imports require a package context; absolute `backend.*` does not.)
_PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(_PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(_PROJECT_DIR))

from backend.helpers.data import normalize_code  # noqa: E402
from backend.helpers.dates import current_flow_year  # noqa: E402
from backend.helpers.flow_to_general import (  # noqa: E402
    format as flow_to_format,
)
from backend.helpers.headers import SYLLABUS_HEADERS  # noqa: E402
from backend.syllabi.db import connect as syllabi_connect  # noqa: E402
from backend.syllabi.db import (  # noqa: E402
    default_db_path as syllabi_default_db_path,
)
from backend.syllabi.db import init_schema as syllabi_init_schema  # noqa: E402


SYLLABUS_DO_WEBAUTH_PREFIX = (
    "https://syllabus.stanford.edu/syllabus/doWebAuth/"
)


def _default_departments_csv() -> Path:
    # backend/departments/departments.csv
    base = Path(__file__).resolve().parents[1]
    return base / "departments" / "departments.csv"


def _default_output_path() -> Path:
    return syllabi_default_db_path()


@dataclass
class Resources:
    departments: list[str]
    output_path: Path
    stop_year: int | None
    concurrency: int
    progress_every: int
    session: aiohttp.ClientSession | None = None

    def flows_desc(self) -> list[str]:
        start_year = current_flow_year()
        stop_year = (
            self.stop_year
            if self.stop_year is not None
            else start_year
        )
        if stop_year > start_year:
            raise RuntimeError("--stop-year must be <= start year")
        flows: list[str] = []
        for y in range(start_year, stop_year - 1, -1):
            flows.extend([f"{y}-{q}" for q in (3, 2, 1, 0)])
        return flows


RES = Resources(
    departments=[],
    output_path=syllabi_default_db_path(),
    stop_year=None,
    concurrency=20,
    progress_every=25,
)


async def _fetch_department(
    session: aiohttp.ClientSession,
    *,
    dept: str,
    flow: str,
) -> dict[str, str]:
    """
    Return map: normalized_course_code -> syllabus_id for (dept, flow).
    """
    formatted = flow_to_format(flow)
    url = (
        "https://syllabus.stanford.edu/syllabus/searchCourses/"
        f"{formatted}/{dept}/"
    )

    async with session.get(url, headers=SYLLABUS_HEADERS) as response:
        if response.status != 200:
            return {}
        try:
            data: Any = await response.json()
        except (
            aiohttp.ContentTypeError,
            json.JSONDecodeError,
            ValueError,
        ):
            return {}

    if not isinstance(data, list):
        return {}

    out: dict[str, str] = {}
    for course in data:
        if not isinstance(course, dict):
            continue

        has_syllabus = bool(course.get("hasSyllabus"))
        visibility = course.get("syllabusVisibility")
        if not has_syllabus or visibility == "COURSE":
            continue

        subject = str(course.get("subject") or "").strip()
        course_num = str(course.get("courseNum") or "").strip()
        if not subject or not course_num:
            continue

        code = normalize_code(f"{subject} {course_num}")

        course_id = str(course.get("courseId") or "").strip()
        orig_course_id = str(course.get("origCourseId") or "").strip()
        if not course_id or not orig_course_id:
            continue

        out[code] = f"{course_id}/{orig_course_id}"

    return out


async def _run_flow(flow: str) -> None:
    r = RES
    if r.session is None:
        raise RuntimeError("HTTP session not initialized")

    total = len(r.departments)
    done = 0
    lock = asyncio.Lock()

    queue: asyncio.Queue[str | None] = asyncio.Queue()
    for d in r.departments:
        queue.put_nowait(d)
    for _ in range(r.concurrency):
        queue.put_nowait(None)

    async def worker() -> list[tuple[str, str, str]]:
        nonlocal done
        rows: list[tuple[str, str, str]] = []
        while True:
            dept = await queue.get()
            if dept is None:
                queue.task_done()
                return rows

            try:
                dept_result = await _fetch_department(
                    r.session,
                    dept=dept,
                    flow=flow,
                )
                if dept_result:
                    for code, syllabus_id in dept_result.items():
                        if not syllabus_id:
                            continue
                        rows.append((code, flow, syllabus_id))
            finally:
                async with lock:
                    done += 1
                    if (
                        done == 1
                        or done == total
                        or (
                            r.progress_every > 0
                            and done % r.progress_every == 0
                        )
                    ):
                        print(f"[syllabi] flow={flow} {done}/{total}")
                queue.task_done()

    workers = [
        asyncio.create_task(worker()) for _ in range(r.concurrency)
    ]
    await queue.join()
    results = await asyncio.gather(*workers)

    to_insert: list[tuple[str, str, str]] = []
    for part in results:
        to_insert.extend(part)

    if not to_insert:
        return

    with syllabi_connect(r.output_path) as conn:
        syllabi_init_schema(conn)
        conn.execute("BEGIN")
        # Only keep the *latest successful* syllabus for each code. We rely on
        # the caller to run flows newest -> oldest, and we only upsert codes
        # that aren't already present.
        for code, f, sid in to_insert:
            conn.execute(
                """
                INSERT OR IGNORE INTO syllabi_latest(
                    code, syllabus_id, flow_found
                )
                VALUES (?, ?, ?)
                """,
                (code, sid, f),
            )
        conn.commit()


async def generate_res(
) -> None:
    r = RES
    # If we already have latest syllabi, don't overwrite them when going back
    # in time. We only fill missing codes.

    flows_desc = r.flows_desc()
    if not flows_desc:
        return

    backfill = r.stop_year is not None
    any_inserted = False
    async with aiohttp.ClientSession() as session:
        r.session = session
        for flow in flows_desc:
            print(
                f"[syllabi] starting flow={flow} "
                f"(departments={len(r.departments)}, "
                f"concurrency={r.concurrency})"
            )
            await _run_flow(flow)
            with syllabi_connect(r.output_path) as conn:
                syllabi_init_schema(conn)
                count = conn.execute(
                    "SELECT COUNT(1) AS n FROM syllabi_latest"
                ).fetchone()
            if count and int(count["n"]) > 0:
                any_inserted = True
                if not backfill:
                    break
    r.session = None

    if not any_inserted:
        print("[syllabi] no syllabi found in any requested flow")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Generate backend/syllabi/syllabi.sqlite "
            "from syllabus.stanford.edu"
        )
    )
    parser.add_argument(
        "--stop-year",
        type=int,
        default=None,
        help=(
            "Oldest flow year to try (inclusive). If omitted, only attempts "
            "the current flow year (latest-only)."
        ),
    )
    parser.add_argument(
        "--departments-csv",
        type=str,
        default=str(_default_departments_csv()),
        help="Path to backend/departments/departments.csv",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=str(_default_output_path()),
        help="Path to write syllabi.sqlite",
    )
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument(
        "--progress-every",
        type=int,
        default=25,
        help="Print progress every N departments per flow",
    )
    args = parser.parse_args()

    df = pd.read_csv(args.departments_csv)
    if "name" not in df.columns:
        raise RuntimeError(
            f"departments csv {args.departments_csv!r} missing 'name' column"
        )
    departments = [
        str(x).strip() for x in df["name"].tolist() if str(x).strip()
    ]
    stop_year = int(args.stop_year) if args.stop_year is not None else None
    global RES
    RES = Resources(
        departments=departments,
        output_path=Path(args.output),
        stop_year=stop_year,
        concurrency=int(args.concurrency),
        progress_every=int(args.progress_every),
    )
    asyncio.run(
        generate_res()
    )


if __name__ == "__main__":
    main()
