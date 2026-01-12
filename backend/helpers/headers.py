
EXPLORE_COURSE_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Pragma': 'no-cache',
  'Referer': 'https://explorecourses.stanford.edu/',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Cookie': 'JSESSIONID=1tecjpt2g7ewd12e6bodi8l5w6; _opensaml_req_ss%3Amem%3A4d1f72757790cff1e6dbf14611bcc34fb3e32aad2ae55cdfc85aa027dc44b35d=_6c85548f105cef15a1fd1145d817892d; _opensaml_req_ss%3Amem%3A9828acdad9c6988e8d7ed72bb6956a15ec377eaa5863cb193ef6bc3a58eef575=_7a292f1633013eb1070341b221c86abe; _opensaml_req_ss%3Amem%3Add650e2867b5266f6dd32f33a3985c3dd2d603e899d265d811a103ab740cf4f7=_c2d8462c14c63ce45d8e85eb46fb2b4a; _opensaml_req_ss%3Amem%3Ae669e6654fab128ace7dc0ab9e2285b3fc604028862b3e1252eb211ffe6ea92a=_3b3ee36b582a6a54ed961b4eb86d50a7'
}

MIN_EXPLORE_COURSE_HEADERS = { 'Cookie': 'JSESSIONID=u6hjdy5rtzke149qnxvfsez6t' }

BULLETIN_HEADERS = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'content-type': 'application/json',
    'origin': 'https://bulletin.stanford.edu',
    'priority': 'u=1, i',
    'referer': 'https://bulletin.stanford.edu/',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

# ---------------------------------------------------------------------------
# Syllabus (syllabus.stanford.edu)
# ---------------------------------------------------------------------------

# Keep this minimal. Avoid hardcoding cookies.
SYLLABUS_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "referer": "https://syllabus.stanford.edu/syllabus/",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
}

# ---------------------------------------------------------------------------
# Navigator / Algolia (Stanford Navigator)
# ---------------------------------------------------------------------------
#
# Algolia endpoint is public but the key is time-bound ("validUntil").
# `backend/departments/run.py` keeps a fallback URL but can auto-refresh a new one
# from navigator.stanford.edu when it expires.

NAVIGATOR_ORIGIN = "https://navigator.stanford.edu/"
ALGOLIA_HOST = "rxghapckof-2.algolianet.com"
ALGOLIA_AGENT_QS = (
    "Algolia%20for%20JavaScript%20(5.37.0)%3B%20Lite%20(5.37.0)%3B%20Browser%3B%20instantsearch.js%20(4.81.0)%3B%20react%20(18.3.0-canary-178c267a4e-20241218)%3B%20react-instantsearch%20(7.17.0)%3B%20react-instantsearch-core%20(7.17.0)%3B%20next.js%20(14.2.35)%3B%20JS%20Helper%20(3.26.0)"
)
ALGOLIA_QUERIES_URL_FALLBACK = (
    f"https://{ALGOLIA_HOST}/1/indexes/*/queries"
    f"?x-algolia-agent={ALGOLIA_AGENT_QS}"
    "&x-algolia-api-key=NDY2ZTg2NDZmMDRiNTJlZjQwODM3NGNjMDgwZjJlZDE5MmJkMzA4MDhkYjE4NDU5ZjZiNmUwYzdiNjEzMGZjZHJlc3RyaWN0SW5kaWNlcz1jbGFzc2VzJnZhbGlkVW50aWw9MTc2Nzc2Nzc3OQ%3D%3D"
    "&x-algolia-application-id=RXGHAPCKOF"
)

ALGOLIA_INDEX = "classes"

# Optional: paste the Cookie header value used by your browser for navigator.stanford.edu
# (the value passed to curl via `-b '...'`).
# If blank, departments/run.py calls /api/generate-key without cookies.
NAVIGATOR_COOKIE = ""

# Used only to satisfy stricter CSRF / bot checks; doesn't need to match exactly.
NAVIGATOR_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
)
