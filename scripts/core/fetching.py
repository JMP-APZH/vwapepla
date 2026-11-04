"""Shared download helpers for every domain's sources.py (scripts/<domain>/sources.py).

A job is a dict: folder, id, url, title (callable -> official title), page (dataset page), credit, purpose,
scope (file-name suffix, e.g. '_972'), encoding (for counting rows), fetcher (optional callable(dest) replacing fetch),
licence (default Licence Ouverte 2.0: set it when a source states another licence, or none) and ext (file extension,
default "csv"; rows are counted for csv only, e.g. ext="pdf" for a report archived as published).
"""
import http.client, json, pathlib, shutil, subprocess, time, urllib.error, urllib.parse, urllib.request

LICENCE = "Licence Ouverte 2.0"


class IncompleteDownload(Exception):
    """The server never delivered the whole file. Nothing is kept under the destination name."""


def portal_job(folder, ds, base, params, credit, purpose, scope="_972", licence=LICENCE):
    """Opendatasoft portal export (OFGL, data.economie.gouv.fr...), filtered server-side with `params`."""
    return {"folder": folder, "id": ds,
            "url": f"{base}/{ds}/exports/csv?" + urllib.parse.urlencode({**params, "delimiter": ";"}),
            "title": lambda: portal_title(base, ds),
            "page": f"{base.replace('/api/explore/v2.1/catalog/datasets', '')}/explore/dataset/{ds}/",
            "credit": credit, "purpose": purpose, "scope": scope, "encoding": "utf-8-sig", "fetcher": None,
            "licence": licence, "ext": "csv"}


def file_job(folder, ds, url, title, page, credit, purpose, encoding="utf-8-sig", licence=LICENCE, ext="csv"):
    """A file published as a whole (national files filtered at import, or a document such as a PDF with ext="pdf")."""
    return {"folder": folder, "id": ds, "url": url, "title": lambda: title, "page": page, "credit": credit,
            "purpose": purpose, "scope": "", "encoding": encoding, "fetcher": None, "licence": licence, "ext": ext}


def fetch(url, dest, tries=3, resumes=10):
    """Download `url` to `dest`, checked for completeness.

    Some servers end a long transfer early without any error (3 Nov 2026: data.assemblee-nationale.fr, hatvp.fr, the
    SSMSI file on data.gouv.fr). The previous version then kept a truncated file. Now:
    - when the server announces a Content-Length, the size is checked; a short read is resumed with an HTTP Range
      request from the last byte, as long as bytes keep arriving (at most `tries` requests in a row without progress);
    - if the server will not resume or stops sending, the system curl downloads it again (hatvp.fr refuses Python's
      client after a few requests but serves curl), and its size is checked too;
    - still short: IncompleteDownload. A truncated file is never kept under `dest`.
    No Content-Length (chunked exports, e.g. Opendatasoft portals): nothing to check against, the file is accepted as
    sent; a broken connection restarts from zero (at most `tries` times).
    HTTP 4xx (except 408 and 429) is raised at once: retrying will not help (callers rely on this for a fast 404).
    """
    dest = pathlib.Path(dest)
    part = dest.with_name(dest.name + ".part")
    part.unlink(missing_ok=True)
    size, final, errors, stalled = None, url, 0, 0
    for _ in range(tries + resumes):
        have = part.stat().st_size if part.exists() else 0
        req = urllib.request.Request(final, headers={"Range": f"bytes={have}-"} if have else {})
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                final = r.geturl()  # resume on the address the redirects led to
                if have and r.status != 206:
                    print("     server does not resume (no HTTP 206)")
                    break
                if not have:
                    n = r.headers.get("Content-Length")
                    size = int(n) if n and n.isdigit() else None
                with open(part, "ab" if have else "wb") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
        except urllib.error.HTTPError as e:
            if e.code < 500 and e.code not in (408, 429):
                part.unlink(missing_ok=True)
                raise
            errors += 1
            print(f"     HTTP {e.code}, retrying")
        except (OSError, http.client.HTTPException) as e:  # network hiccup or connection dropped mid-transfer
            errors += 1
            print(f"     interrupted ({e})")
        else:
            if size is None:  # nothing announced, nothing to check against
                part.replace(dest)
                return
        now = part.stat().st_size if part.exists() else 0
        if size is not None and now == size:
            part.replace(dest)
            return
        if size is not None and now > size:
            break
        if size is None:  # broken transfer of unknown length: cannot resume safely, start again
            part.unlink(missing_ok=True)
            if errors >= tries:
                break
            time.sleep(5 * errors)
            continue
        stalled = 0 if now > have else stalled + 1
        if stalled >= tries:
            break
        print(f"     resuming at {now:,} of {size:,} bytes")
        time.sleep(2 if not stalled else 5 * stalled)
    got = part.stat().st_size if part.exists() else 0
    if size is not None and got != size and (curl := shutil.which("curl")):
        print("     falling back to curl")
        part.unlink(missing_ok=True)
        done = subprocess.run([curl, "-sSfL", "--retry", "5", "-o", str(part), url]).returncode == 0
        got = part.stat().st_size if part.exists() else 0
        if done and got == size:
            part.replace(dest)
            return
    part.unlink(missing_ok=True)
    raise IncompleteDownload(f"{url}: incomplete download ({got:,} of {size:,} bytes)" if size is not None
                             else f"{url}: download failed after {errors} attempts")


def portal_title(base, ds):
    """Official dataset title from the portal catalogue (French, as published)."""
    with urllib.request.urlopen(f"{base}/{ds}", timeout=60) as r:
        return json.load(r)["metas"]["default"]["title"]


