"""Download the open-data sources of one domain into data/raw/<domain>/ (gitignored).

The list of sources lives in scripts/<domain>/sources.py (JOBS); this engine is shared by every domain.
Re-runnable and idempotent: files are named <dataset><scope>_<retrieval date>.<ext> (csv unless the job says
otherwise); an existing file for the same day is skipped unless --force. Downloads are checked for completeness
(fetching.fetch). Writes data/raw/<domain>/manifest.json with URL, licence (per job), retrieval date, size in bytes,
row count (csv only) and sha256 for each file, so every figure can be traced back to its source.

Usage: python -I scripts/core/download_sources.py --domain communes [--force] [--only <dataset_id> ...]
"""
import csv, datetime, hashlib, importlib.util, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # python -I drops the script dir
from fetching import LICENCE, fetch  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOMAINS = ("communes", "parlement", "ctm", "prefet")


def load_jobs(domain):
    spec = importlib.util.spec_from_file_location(f"{domain}_sources", ROOT / "scripts" / domain / "sources.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.JOBS


def arg(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None


def main():
    domain = arg("--domain")
    if domain not in DOMAINS:
        sys.exit(f"--domain is required, one of: {', '.join(DOMAINS)}")
    force = "--force" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1:] if "--only" in sys.argv else None
    if only and "--domain" in only:
        sys.exit("put --only last")
    raw = ROOT / "data" / "raw" / domain
    today = datetime.date.today().isoformat()
    manifest_path = raw / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    for job in load_jobs(domain):
        ds = job["id"]
        if only and ds not in only:
            continue
        (raw / job["folder"]).mkdir(parents=True, exist_ok=True)
        ext = job.get("ext", "csv")
        dest = raw / job["folder"] / f"{ds}{job['scope']}_{today}.{ext}"
        if dest.exists() and not force:
            print(f"skip {dest.name} (exists)")
        else:
            print(f"get  {ds} ...", flush=True)
            (job["fetcher"] or (lambda d: fetch(job["url"], d)))(dest)
        data = dest.read_bytes()
        rows = None
        if ext == "csv":
            with open(dest, encoding=job["encoding"], newline="") as f:  # count records, not lines (fields may hold newlines)
                rows = sum(1 for _ in csv.reader(f, delimiter=";")) - 1
        manifest[ds] = {
            "file": str(dest.relative_to(ROOT)).replace("\\", "/"), "url": job["url"], "title": job["title"](),
            "dataset_page": job["page"], "retrieved": today, "rows": rows, "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(), "licence": job.get("licence", LICENCE), "credit": f"Source : {job['credit']}", "purpose": job["purpose"], "domain": domain,
        }
        print(f"     {rows} rows" if rows is not None else f"     {len(data):,} bytes")
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
