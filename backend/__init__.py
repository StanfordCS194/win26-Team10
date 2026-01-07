"""
Backend package initializer.

This file exists so scripts under `backend/` can reliably import sibling modules
when run as modules (e.g. `python -m backend.courses.run`) as well as via the
existing `sys.path.append('../')` approach used by some scripts.
"""


