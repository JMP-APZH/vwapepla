"""Shared download helpers for every domain's sources.py (scripts/<domain>/sources.py).

A job is a dict: folder, id, url, title (callable -> official title), page (dataset page), credit, purpose,
scope (file-name suffix, e.g. '_972'), encoding (for counting rows), fetcher (optional callable(dest) replacing fetch).
"""
import json, time, urllib.parse, urllib.request

LICENCE = "Licence Ouverte 2.0"


def portal_job(folder, ds, base, params, credit, purpose, scope="_972"):
    """Opendatasoft portal export (OFGL, data.economie.gouv.fr...), filtered server-side with `params`."""
    return {"folder": folder, "id": ds,
            "url": f"{base}/{ds}/exports/csv?" + urllib.parse.urlencode({**params, "delimiter": ";"}),
            "title": lambda: portal_title(base, ds),
            "page": f"{base.replace('/api/explore/v2.1/catalog/datasets', '')}/explore/dataset/{ds}/",
            "credit": credit, "purpose": purpose, "scope": scope, "encoding": "utf-8-sig", "fetcher": None}


def file_job(folder, ds, url, title, page, credit, purpose, encoding="utf-8-sig"):
    """A file published as a whole (national files, filtered at import)."""
    return {"folder": folder, "id": ds, "url": url, "title": lambda: title, "page": page, "credit": credit,
            "purpose": purpose, "scope": "", "encoding": encoding, "fetcher": None}


def fetch(url, dest, tries=3):
    for i in range(tries):
        try:
            tmp = dest.with_suffix(".part")
            with urllib.request.urlopen(url, timeout=900) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            tmp.replace(dest)
            return
        except Exception as e:  # network hiccups: retry with backoff
            if i == tries - 1:
                raise
            print(f"   retry {i + 1} after error: {e}")
            time.sleep(5 * (i + 1))


def portal_title(base, ds):
    """Official dataset title from the portal catalogue (French, as published)."""
    with urllib.request.urlopen(f"{base}/{ds}", timeout=60) as r:
        return json.load(r)["metas"]["default"]["title"]


