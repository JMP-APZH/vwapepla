"""Open-data sources of the ctm domain (B3), downloaded by scripts/core/download_sources.py --domain ctm.

Add one job per dataset with portal_job() / file_job() from scripts/core/fetching.py. Files land in data/raw/ctm/.
"""
from fetching import file_job, portal_job  # noqa: F401  (scripts/core, put on sys.path by download_sources.py)

JOBS = []
