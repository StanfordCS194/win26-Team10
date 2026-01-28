"""
Debug scraper for Stanford courses via Stanford Navigator (Algolia "classes"
index).

Goal (v0):
- Fetch **Computer Science (subject=CS)** classes via the same Algolia
  key-refresh logic used in `backend/departments/run.py`.
- Build and print the JSON payloads we *would* save (no uploading).
- Keep the shaping similar to the old ExploreCourses scraper (`run_old.py`)
  where practical.

Notes:
- Navigator uses a time-bound Algolia key ("validUntil"). We auto-refresh via:
    POST https://navigator.stanford.edu/api/generate-key
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from typing import Any

from backend.helpers.algolia import fetch_hits
from backend.helpers.dates import (
    StanfordTerm,
)
from backend.helpers.headers import ALGOLIA_INDEX
from backend.metrics.helpers import build_course_metrics_lookup
from backend.reviews import helpers as reviews_helpers
from backend.syllabi.helpers import load_syllabi_map

from dataclasses import replace

from .data import CourseMeta, CoursePayload, Section, group_hits_by_course_code


# --------------------------------------------------------------------------------------
# Fetch helpers
# --------------------------------------------------------------------------------------

def _default_navigator_term_offered(today: date | None = None) -> str:
    """
    Unlike departments generation (which defaults to prior Autumn), for course
    payloads we default to the *current* quarter shown in Navigator.
    """
    today = today or date.today()
    m = today.month
    if m in (9, 10, 11, 12):
        season = "Autumn"
        year = today.year
    elif m in (1, 2, 3):
        season = "Winter"
        year = today.year
    elif m in (4, 5, 6):
        season = "Spring"
        year = today.year
    else:
        season = "Summer"
        year = today.year
    return StanfordTerm(season, year).term_offered()


def _fetch_hits_for_subject(
    *,
    term_offered: str,
    subject: str,
    dept_name: str | None = None,
    debug: bool = False,
) -> list[dict[str, Any]]:
    # Navigator Algolia index does **not** support subject facet filtering for
    # (it works for attributesToRetrieve but not for facetFilters). We instead
    # filter by `deptName` which is facetable and maps to the department UI.
    # For CS, deptName appears as "Computer Science".
    dept_name = (
        str(dept_name).strip()
        if dept_name is not None and str(dept_name).strip()
        else (
            "Computer Science" if subject.upper() == "CS" else subject.upper()
        )
    )
    base_filters = [
        [f"termOffered:{term_offered}"],
        [f"deptName:{dept_name}"],
    ]
    return fetch_hits(
        index_name=ALGOLIA_INDEX,
        facet_filters=base_filters,
        attributes_to_retrieve=["*"],
        query="",
        hits_per_page=1000,
        split_by_facet="acadCareerDescr",
        debug=debug,
    )


def build_course_payloads(
    hits: list[dict[str, Any]],
    *,
    subject: str,
    include_reviews: bool,
    max_reviews: int,
    metrics_lookup: dict[str, Any],
    syllabi_map: dict[str, str],
) -> list[CoursePayload]:
    grouped = group_hits_by_course_code(hits, subject=subject)
    payloads: list[CoursePayload] = []

    for course_code, hs in sorted(grouped.items()):
        rep = hs[0]
        meta = CourseMeta.from_algolia_rep(
            rep,
            subject=subject,
            course_code=course_code,
        )

        cm = metrics_lookup.get(meta.id)
        if cm is not None:
            meta = replace(
                meta,
                mean_hours=getattr(cm, "mean_hours", None),
                median_hours=getattr(cm, "median_hours", None),
                median_grade=getattr(cm, "median_grade", None),
                percent_as=getattr(cm, "percent_as", None),
                syllabus_id=getattr(cm, "syllabus_id", None),
            )
        elif meta.id in syllabi_map:
            meta = replace(meta, syllabus_id=syllabi_map[meta.id])

        if include_reviews:
            try:
                reviews = reviews_helpers.get_reviews(meta.id)[:max_reviews]
                meta = replace(meta, past_reviews=reviews)
            except (OSError, ValueError, RuntimeError) as e:
                meta = replace(meta, past_reviews_error=str(e))

        sections_by_term: dict[str, list[Section]] = {}
        for h in hs:
            section = Section.from_algolia_hit(h)
            if not section.term:
                continue
            sections_by_term.setdefault(section.term, []).append(section)

        payloads.append(
            CoursePayload(
                id=meta.id,
                meta=meta,
                sections_by_term=sections_by_term,
            )
        )

    return payloads


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Debug scrape CS courses via Navigator/Algolia"
    )
    parser.add_argument("--subject", type=str, default="CS")
    parser.add_argument(
        "--dept-name",
        type=str,
        default=None,
        help=(
            'Navigator deptName facet value, e.g. "Computer Science" '
            "(optional)"
        ),
    )
    parser.add_argument(
        "--term-offered",
        action="append",
        default=None,
        help='e.g. "Autumn 2025" (repeatable)',
    )
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--include-reviews", action="store_true")
    parser.add_argument("--max-reviews", type=int, default=20)
    parser.add_argument(
        "--limit-courses",
        type=int,
        default=0,
        help="0 = no limit",
    )
    parser.add_argument("--output", type=str, default="cs_payload.json")
    args = parser.parse_args()

    subject = str(args.subject).strip().upper()
    term_offered_list = args.term_offered or [
        _default_navigator_term_offered()
    ]

    if args.debug:
        print(
            f"[run] subject={subject} deptName={args.dept_name!r} "
            f"termOffered={term_offered_list}"
        )

    # Load enrichments up front (fast, local).
    syllabi_map = load_syllabi_map()
    metrics_lookup = build_course_metrics_lookup(syllabi_map=syllabi_map)
    if args.debug:
        print(
            f"[enrich] syllabi_map={len(syllabi_map)} "
            f"metrics_lookup={len(metrics_lookup)}"
        )

    all_hits: list[dict[str, Any]] = []
    for term in term_offered_list:
        term = str(term).strip()
        if not term:
            continue
        print(f"[fetch] fetching subject={subject} termOffered={term!r}")
        hits = _fetch_hits_for_subject(
            term_offered=term,
            subject=subject,
            dept_name=args.dept_name,
            debug=args.debug,
        )
        print(f"[fetch] got hits={len(hits)} for term={term!r}")
        all_hits.extend(hits)

    # De-dupe hits by Algolia objectID when present.
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for h in all_hits:
        oid = str(h.get("objectID") or "")
        if oid and oid in seen:
            continue
        if oid:
            seen.add(oid)
        deduped.append(h)
    if args.debug:
        print(f"[fetch] total hits={len(all_hits)} deduped={len(deduped)}")
        if deduped:
            sample = deduped[0]
            keys = sorted(
                [k for k in sample.keys() if not str(k).startswith("_")]
            )
            print(f"[debug] sample hit keys ({len(keys)}): {keys[:120]}")

    payloads = build_course_payloads(
        deduped,
        subject=subject,
        include_reviews=bool(args.include_reviews),
        max_reviews=int(args.max_reviews),
        metrics_lookup=metrics_lookup,
        syllabi_map=syllabi_map,
    )
    print(f"[build] courses={len(payloads)}")

    if args.limit_courses and args.limit_courses > 0:
        payloads = payloads[: int(args.limit_courses)]
        print(f"[build] limited to {len(payloads)} courses")

    out_payload = [p.to_dict() for p in payloads]

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out_payload, f, indent=2, ensure_ascii=False)

    # Print a small preview for live monitoring
    preview_n = min(3, len(out_payload))
    if preview_n:
        print("[preview] first payload(s):")
        print(
            json.dumps(out_payload[:preview_n], indent=2, ensure_ascii=False)[
                :4000
            ]
        )
    print(
        f"[done] wrote {len(out_payload)} course payloads to {args.output!r}"
    )


if __name__ == "__main__":
    main()
