"""Upsert data/build/<domain>/<table>.json into Supabase via the REST API (idempotent: merge on primary/natural keys).

The tables of a domain, in load order, are listed in scripts/<domain>/tables.py (TABLES = {table: conflict target}).
A domain may load core tables (no prefix) and its own prefixed tables only (communes: com_, parlement: parl_, ctm: ctm_,
prefet: pref_).
person_links: a domain writes only the links whose person_id is one of its own people (reviewed facts, see
the migration *_core_person_links.sql).

Needs in .env.local (never committed): SUPABASE_URL, SUPABASE_SECRET_KEY (Dashboard > Project Settings > API Keys > Secret).
Run: python -I scripts/core/load_supabase.py --domain communes [table ...]
"""
import importlib.util, json, pathlib, sys, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
PREFIX = {"communes": "com_", "parlement": "parl_", "ctm": "ctm_", "prefet": "pref_"}
CORE = {"sources", "institutions", "bodies", "seats", "persons", "mandates", "terms", "media", "person_links"}
BATCH = 1000


def env():
    vals = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"')
    return vals


def domain_tables(domain):
    spec = importlib.util.spec_from_file_location(f"{domain}_tables", ROOT / "scripts" / domain / "tables.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    bad = [t for t in mod.TABLES if t not in CORE and not t.startswith(PREFIX[domain])]
    if bad:
        sys.exit(f"scripts/{domain}/tables.py: tables outside the core and the {PREFIX[domain]} prefix: {bad}")
    return mod.TABLES


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
    args = sys.argv[1:]
    if "--domain" not in args or args.index("--domain") + 1 >= len(args) or args[args.index("--domain") + 1] not in PREFIX:
        sys.exit(f"--domain is required, one of: {', '.join(PREFIX)}")
    i = args.index("--domain")
    domain, wanted = args[i + 1], args[:i] + args[i + 2:]
    tables = domain_tables(domain)
    unknown = [t for t in wanted if t not in tables]
    if unknown:
        sys.exit(f"not in scripts/{domain}/tables.py: {unknown}")
    e = env()
    base, key = e["SUPABASE_URL"].rstrip("/"), e["SUPABASE_SECRET_KEY"]
    build = ROOT / "data" / "build" / domain
    for table, conflict in tables.items():
        f = build / f"{table}.json"
        if (wanted and table not in wanted) or not f.exists():
            continue
        rows = json.loads(f.read_text(encoding="utf-8"))
        upsert(base, key, table, rows, conflict)
        print(f"{table:24s} {len(rows):6d} rows upserted")


if __name__ == "__main__":
    main()
