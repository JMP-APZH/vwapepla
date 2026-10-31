"""Upsert data/build/*.json into Supabase via the REST API (idempotent: merge on primary/natural keys).

Needs in .env.local (never committed): SUPABASE_URL, SUPABASE_SECRET_KEY (Dashboard > Project Settings > API Keys > Secret).
Run: python -I scripts/pipeline/load_supabase.py [table ...]
"""
import json, pathlib, sys, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / "data" / "build"
# Load order respects foreign keys. Value = conflict target for the upsert.
TABLES = {
    "sources": "id",
    "communes": "code",
    "commune_years": "commune_code,year",
    "metric_definitions": "key",
    "terms": "id",
    "officeholders": "commune_code,role,last_name,first_name,mandate_start",
    "actuals": "commune_code,year,metric_key",
    "entities": "siren",
    "entity_actuals": "siren,year,agregat",
    "forecast_documents": "id",
    "forecast_figures": "document_id,metric_key",
}
BATCH = 1000


def env():
    vals = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"')
    return vals


def upsert(base, key, table, rows, conflict):
    headers = {"apikey": key, "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates,return=minimal"}
    if not key.startswith("sb_secret_"):  # legacy service_role JWT
        headers["Authorization"] = f"Bearer {key}"
    for i in range(0, len(rows), BATCH):
        req = urllib.request.Request(f"{base}/rest/v1/{table}?on_conflict={conflict}", method="POST", headers=headers,
                                     data=json.dumps(rows[i:i + BATCH], ensure_ascii=False).encode("utf-8"))
        try:
            urllib.request.urlopen(req, timeout=120).read()
        except urllib.error.HTTPError as e:
            sys.exit(f"{table} batch {i}: HTTP {e.code} {e.read().decode('utf-8', 'replace')[:500]}")


def main():
    e = env()
    base, key = e["SUPABASE_URL"].rstrip("/"), e["SUPABASE_SECRET_KEY"]
    wanted = sys.argv[1:] or list(TABLES)
    for table, conflict in TABLES.items():
        f = BUILD / f"{table}.json"
        if table not in wanted or not f.exists():
            continue
        rows = json.loads(f.read_text(encoding="utf-8"))
        upsert(base, key, table, rows, conflict)
        print(f"{table:20s} {len(rows):6d} rows upserted")


if __name__ == "__main__":
    main()
