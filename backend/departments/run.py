"""
Generate `departments.csv` using Stanford Navigator's Algolia API.

Schema (traditional):
    longname,name,school

Where:
- longname: subject long name (subjectDescr)
- name:     subject code (subject)
- school:   acadGroupDescr normalized to our legacy labels

This implementation follows the "simple curl" approach:
- One multi-query to get facet values (deptName list) for the selected term.
- Then small per-dept queries to extract subjects (avoids global paging; works around Algolia pagination limit).
"""

from __future__ import annotations

import sys
sys.path.append("../")

import argparse
import collections
import json
from typing import Any
from urllib.parse import quote

import pandas as pd
import requests
from save_js import save_departments_js
from helpers.dates import default_term_offered  # type: ignore
from helpers.headers import (  # type: ignore
    ALGOLIA_AGENT_QS,
    ALGOLIA_HOST,
    ALGOLIA_INDEX,
    ALGOLIA_QUERIES_URL_FALLBACK,
    NAVIGATOR_COOKIE,
    NAVIGATOR_ORIGIN,
    NAVIGATOR_USER_AGENT,
)
from helpers.parallelize import parallel_map  # type: ignore


_ALGOLIA_CACHE: dict[str, str | None] = {"queries_url": None}


def _school_label(*, acad_group_descr: str, dept_name: str) -> str:
    # Match existing departments.csv labels
    if dept_name == "Vice Provost for Undergraduate Education":
        return "Office of Vice Provost for Undergraduate Education"
    if dept_name == "Athletics, Physical Education, and Recreation":
        return "Department of Athletics, Physical Education and Recreation"
    if acad_group_descr == "Humanities & Sciences":
        return "School of Humanities & Sciences"
    return acad_group_descr or dept_name


def _algolia_headers() -> dict[str, str]:
    # Keep it minimal; query params carry the app id + key.
    return {
        "accept": "application/json",
        "content-type": "text/plain",
        "origin": "https://navigator.stanford.edu",
        "referer": "https://navigator.stanford.edu/",
    }


def _build_queries_url(app_id: str, api_key_qs: str) -> str:
    return (
        f"https://{ALGOLIA_HOST}/1/indexes/*/queries"
        f"?x-algolia-agent={ALGOLIA_AGENT_QS}"
        f"&x-algolia-api-key={api_key_qs}"
        f"&x-algolia-application-id={app_id}"
    )


def _refresh_algolia_queries_url(*, debug: bool = False) -> str:
    """
    Ask Navigator for a fresh secured Algolia key.

    Navigator exposes an internal endpoint that returns a time-bound key:
        POST /api/generate-key  -> { securedApiKey: "..." }
    """
    def ensure_qs_encoded(value: str) -> str:
        v = value.strip()
        # If it's already percent-encoded, keep it as-is.
        if "%" in v:
            return v
        return quote(v, safe="")

    url = NAVIGATOR_ORIGIN.rstrip("/") + "/api/generate-key"
    headers = {
        # Match the curl shape closely
        "accept": "*/*",
        "content-type": "application/json",
        "origin": NAVIGATOR_ORIGIN.rstrip("/"),
        "referer": NAVIGATOR_ORIGIN,
        "user-agent": NAVIGATOR_USER_AGENT,
    }
    if NAVIGATOR_COOKIE.strip():
        headers["cookie"] = NAVIGATOR_COOKIE.strip()

    # curl uses content-length: 0; requests will set it automatically for empty body
    resp = requests.post(url, headers=headers, data="", timeout=30)
    if debug:
        print(f"[algolia] /api/generate-key status={resp.status_code}")
        if not resp.ok:
            print("[algolia] /api/generate-key error body (first 2000 chars):")
            print((resp.text or "")[:2000])
    resp.raise_for_status()

    payload = resp.json()
    secured_key = payload.get("securedApiKey")
    if not isinstance(secured_key, str) or not secured_key.strip():
        raise RuntimeError("Navigator /api/generate-key did not return a securedApiKey.")

    # App id is stable in all observed keys/requests.
    app_id = "RXGHAPCKOF"
    api_key_qs = ensure_qs_encoded(secured_key)

    if debug:
        print("[algolia] refreshed Algolia key via /api/generate-key")

    return _build_queries_url(app_id, api_key_qs)


def _get_algolia_queries_url(*, debug: bool = False) -> str:
    cached = _ALGOLIA_CACHE.get("queries_url")
    if cached:
        return str(cached)
    _ALGOLIA_CACHE["queries_url"] = ALGOLIA_QUERIES_URL_FALLBACK
    if debug:
        print("[algolia] using fallback Algolia queries URL (may be expired)")
    return ALGOLIA_QUERIES_URL_FALLBACK


def algolia_multi_query(requests_list: list[dict[str, Any]], *, debug: bool = False) -> dict[str, Any]:
    def do_post(url: str) -> requests.Response:
        return requests.post(
            url,
            headers=_algolia_headers(),
            data=json.dumps({"requests": requests_list}),
            timeout=30,
        )

    url = _get_algolia_queries_url(debug=debug)
    resp = do_post(url)

    if debug:
        print(f"[algolia] status={resp.status_code}")

    if resp.ok:
        return resp.json()

    # Surface the reason for 400/403/etc
    preview = (resp.text or "")[:2000]
    print("[algolia] error response (first 2000 chars):")
    print(preview)

    # If expired, refresh and retry once
    try:
        err_json = resp.json()
    except ValueError:
        err_json = None

    if isinstance(err_json, dict) and "validUntil" in str(err_json.get("message", "")):
        if debug:
            print("[algolia] detected expired validUntil; refreshing and retrying once...")
        _ALGOLIA_CACHE["queries_url"] = _refresh_algolia_queries_url(debug=debug)
        resp2 = do_post(str(_ALGOLIA_CACHE["queries_url"]))
        if debug:
            print(f"[algolia] retry status={resp2.status_code}")
        if resp2.ok:
            return resp2.json()
        preview2 = (resp2.text or "")[:2000]
        print("[algolia] retry error response (first 2000 chars):")
        print(preview2)
        resp2.raise_for_status()

    resp.raise_for_status()
    return resp.json()


def deptnames_for_term(term_offered: str, *, debug: bool = False) -> list[str]:
    # Mirror the browser request shape (your curl) to avoid Algolia rejecting "facets-only" queries.
    req = {
        "indexName": ALGOLIA_INDEX,
        "facetFilters": [[f"termOffered:{term_offered}"]],
        "facets": [
            "acadCareerDescr",
            "acadGroupDescr",
            "campus.lvl0",
            "campus.lvl1",
            "classEnrlOptionList",
            "curatedClassList",
            "deptName",
            "family.lvl1",
            "format",
            "geRequirements",
            "langInstr",
            "meetings.daysOfWeekList",
            "meetings.instructors.displayName",
            "meetings.startTimeInMinutes",
            "termOffered",
            "units",
        ],
        "highlightPostTag": "__/ais-highlight__",
        "highlightPreTag": "__ais-highlight__",
        "hitsPerPage": 24,
        "maxValuesPerFacet": 500,
        "page": 0,
        "query": "",
    }
    payload = algolia_multi_query([req], debug=debug)
    facets = payload["results"][0].get("facets", {}) or {}
    dept_facet: dict[str, Any] = facets.get("deptName", {}) or {}
    names = sorted(dept_facet.keys())
    if debug:
        print(f"[departments] deptName facet values: {len(names)}")
    return names


def careers_for_dept(term_offered: str, dept_name: str) -> list[str]:
    req = {
        "indexName": ALGOLIA_INDEX,
        "facetFilters": [[f"termOffered:{term_offered}"], [f"deptName:{dept_name}"]],
        "facets": ["acadCareerDescr"],
        "hitsPerPage": 0,
        "maxValuesPerFacet": 100,
        "page": 0,
        "query": "",
    }
    payload = algolia_multi_query([req])
    facets = payload["results"][0].get("facets", {}) or {}
    career_facet: dict[str, Any] = facets.get("acadCareerDescr", {}) or {}
    return sorted(career_facet.keys())


def subjects_for_dept(term_offered: str, dept_name: str, *, debug: bool = False) -> tuple[dict[str, collections.Counter[str]], collections.Counter[str]]:
    """
    Return (subject -> subjectDescr counts, acadGroupDescr counts) for a deptName.

    Algolia search is capped to ~1000 hits. For departments that exceed that cap,
    we split by `acadCareerDescr` (usually enough to stay under the cap).
    """
    def run(filters: list[list[str]]) -> tuple[list[dict[str, Any]], int, int]:
        req = {
            "indexName": ALGOLIA_INDEX,
            "facetFilters": filters,
            "attributesToRetrieve": ["subject", "subjectDescr", "acadGroupDescr", "deptName"],
            "hitsPerPage": 1000,
            "page": 0,
            "query": "",
        }
        res = algolia_multi_query([req])["results"][0]
        return (res.get("hits", []) or []), int(res.get("nbHits") or 0), int(res.get("nbPages") or 0)

    base_filters = [[f"termOffered:{term_offered}"], [f"deptName:{dept_name}"]]
    hits, nb_hits, nb_pages = run(base_filters)

    # If capped (nbHits > 1000 but nbPages is 1), split by career.
    capped = nb_hits > 1000 and nb_pages <= 1
    if debug:
        print(f"[departments] dept={dept_name!r} hitsReturned={len(hits)} nbHits={nb_hits} nbPages={nb_pages}" + (" (CAPPED)" if capped else ""))

    all_hits = hits
    if capped:
        all_hits = []
        for career in careers_for_dept(term_offered, dept_name):
            career_filters = [[f"termOffered:{term_offered}"], [f"deptName:{dept_name}"], [f"acadCareerDescr:{career}"]]
            h2, _, _ = run(career_filters)
            all_hits.extend(h2)

    subj_to_descr: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)
    acad_groups: collections.Counter[str] = collections.Counter()
    for h in all_hits:
        s = (h.get("subject") or "").strip()
        sd = (h.get("subjectDescr") or "").strip()
        ag = (h.get("acadGroupDescr") or "").strip()
        if s and sd:
            subj_to_descr[s][sd] += 1
        if ag:
            acad_groups[ag] += 1
    return subj_to_descr, acad_groups


def build_departments_df(term_offered: str, *, debug: bool = False) -> pd.DataFrame:
    subject_to_longname: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)
    subject_to_school: dict[str, collections.Counter[str]] = collections.defaultdict(collections.Counter)

    # Get list of departments and query each one in parallel
    if debug:
        print("[departments] fetching department list and querying in parallel")
    
    dept_names = deptnames_for_term(term_offered, debug=debug)
    
    def process_dept(dept: str) -> tuple[str, dict[str, collections.Counter[str]], collections.Counter[str]]:
        subj_to_descr, acad_groups = subjects_for_dept(term_offered, dept, debug=False)
        return dept, subj_to_descr, acad_groups
    
    def progress_callback(completed: int, total: int) -> None:
        if debug and (completed == 1 or completed % 25 == 0 or completed == total):
            print(f"[departments] processed {completed}/{total} departments")
    
    results = parallel_map(process_dept, dept_names, max_workers=20, progress_callback=progress_callback if debug else None)
    
    # Aggregate results
    for dept, subj_to_descr, acad_groups in results:
        dominant_acad_group = acad_groups.most_common(1)[0][0] if acad_groups else ""
        school = _school_label(acad_group_descr=dominant_acad_group, dept_name=dept)
        
        for subj, ctr in subj_to_descr.items():
            subject_to_longname[subj].update(ctr)
            subject_to_school[subj][school] += 1

    rows: list[dict[str, str]] = []
    for subj, long_ctr in subject_to_longname.items():
        if not long_ctr:
            continue
        school_ctr = subject_to_school.get(subj) or collections.Counter()
        if not school_ctr:
            continue
        rows.append(
            {
                "longname": long_ctr.most_common(1)[0][0],
                "name": subj,
                "school": school_ctr.most_common(1)[0][0],
            }
        )

    df = pd.DataFrame(rows, columns=["longname", "name", "school"]).drop_duplicates(subset=["name"])
    return df.sort_values(["school", "name", "longname"], kind="stable").reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate departments.csv via Stanford Navigator Algolia")
    parser.add_argument("--term-offered", type=str, default=None, help='e.g. "Winter 2026" (defaults automatically)')
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--output-csv", type=str, default="departments.csv")
    parser.add_argument("--output-js", type=str, default="convert_output.js")
    args = parser.parse_args()

    term = args.term_offered or default_term_offered()
    if args.debug and not args.term_offered:
        print(f'[departments] --term-offered not provided; defaulting to "{term}"')

    df = build_departments_df(term, debug=args.debug)
    if args.debug:
        print(f"[departments] output rows: {len(df)}")
        if len(df):
            print(df.head(10).to_string(index=False))

    df.to_csv(args.output_csv, index=False)
    save_departments_js(df, output_path=args.output_js)


if __name__ == "__main__":
    main()
