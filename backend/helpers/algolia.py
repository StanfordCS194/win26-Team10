"""
Stanford Navigator / Algolia helper.

Navigator uses Algolia for its "classes" index but the API key is time-bound
(`validUntil`). This module provides:

- `algolia_multi_query()` that retries once after refreshing the key via
  `POST https://navigator.stanford.edu/api/generate-key`.
- `fetch_hits()` convenience wrapper for fetching hits and working around the
  common 1000-hit cap by splitting on a facet (e.g. "acadCareerDescr").
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote

import requests

from .headers import (
    ALGOLIA_AGENT_QS,
    ALGOLIA_HOST,
    ALGOLIA_QUERIES_URL_FALLBACK,
    NAVIGATOR_COOKIE,
    NAVIGATOR_ORIGIN,
    NAVIGATOR_USER_AGENT,
)

_ALGOLIA_CACHE: dict[str, str | None] = {"queries_url": None}


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

    Navigator endpoint:
        POST /api/generate-key  -> { securedApiKey: "..." }
    """

    def ensure_qs_encoded(value: str) -> str:
        v = value.strip()
        # If it's already percent-encoded, keep it as-is.
        if "%" in v:
            return v
        return quote(v, safe="")

    url = NAVIGATOR_ORIGIN.rstrip("/") + "/api/generate-key"
    headers: dict[str, str] = {
        "accept": "*/*",
        "content-type": "application/json",
        "origin": NAVIGATOR_ORIGIN.rstrip("/"),
        "referer": NAVIGATOR_ORIGIN,
        "user-agent": NAVIGATOR_USER_AGENT,
    }
    if NAVIGATOR_COOKIE.strip():
        headers["cookie"] = NAVIGATOR_COOKIE.strip()

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


def algolia_multi_query(
    requests_list: list[dict[str, Any]],
    *,
    debug: bool = False,
) -> dict[str, Any]:
    """
    POST to Algolia multi-query endpoint. If the time-bound key is expired,
    refresh via Navigator and retry once.
    """

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


def fetch_hits(
    *,
    index_name: str,
    facet_filters: list[list[str]],
    attributes_to_retrieve: list[str] | None = None,
    query: str = "",
    hits_per_page: int = 1000,
    split_by_facet: str | None = "acadCareerDescr",
    debug: bool = False,
) -> list[dict[str, Any]]:
    """
    Fetch hits from an Algolia index with best-effort handling for the 1000-hit cap.

    If the initial query looks capped (nbHits > hits_per_page and nbPages <= 1),
    we split the query by `split_by_facet` and merge results.
    """
    attrs = attributes_to_retrieve or ["*"]

    def run(filters: list[list[str]]) -> tuple[list[dict[str, Any]], int, int]:
        req = {
            "indexName": index_name,
            "facetFilters": filters,
            "attributesToRetrieve": attrs,
            "hitsPerPage": hits_per_page,
            "page": 0,
            "query": query,
        }
        res = algolia_multi_query([req], debug=debug)["results"][0]
        hits = res.get("hits", []) or []
        nb_hits = int(res.get("nbHits") or 0)
        nb_pages = int(res.get("nbPages") or 0)
        return hits, nb_hits, nb_pages

    hits, nb_hits, nb_pages = run(facet_filters)
    capped = nb_hits > hits_per_page and nb_pages <= 1
    if debug:
        print(
            f"[fetch] hitsReturned={len(hits)} nbHits={nb_hits} nbPages={nb_pages}"
            + (" (CAPPED)" if capped else "")
        )

    if not capped or not split_by_facet:
        return hits

    facet_req = {
        "indexName": index_name,
        "facetFilters": facet_filters,
        "facets": [split_by_facet],
        "hitsPerPage": 0,
        "page": 0,
        "query": query,
        "maxValuesPerFacet": 100,
    }
    payload = algolia_multi_query([facet_req], debug=debug)
    facets = payload["results"][0].get("facets", {}) or {}
    facet_values = sorted((facets.get(split_by_facet, {}) or {}).keys())
    if debug:
        print(f"[fetch] capped -> splitting by {split_by_facet}: {facet_values}")

    all_hits: list[dict[str, Any]] = []
    for v in facet_values:
        h2, _, _ = run([*facet_filters, [f"{split_by_facet}:{v}"]])
        all_hits.extend(h2)
        if debug:
            print(f"[fetch] {split_by_facet}={v!r} hits={len(h2)} total={len(all_hits)}")

    return all_hits


