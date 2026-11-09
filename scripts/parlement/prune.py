"""Delete B2's own rows that the latest build no longer produces (the loader only upserts, it never deletes).

Only parl_* tables, children before parents; never core tables, never other domains. A row is deleted when its key is
online but not in data/build/parlement/<table>.json. Safety: refuses (exit 1) when a table would lose more than 5 % of
its rows (at least 10 rows always allowed, for small tables), so a broken or partial build can never empty the site. Prints every deleted key.

Run after build.py and load_supabase.py --domain parlement:
    python -I scripts/parlement/prune.py [--dry-run]
Needs .env.local: SUPABASE_URL, SUPABASE_SECRET_KEY (as load_supabase.py).
"""
import json, pathlib, sys, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "core"))
from load_supabase import env  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
BUILD = ROOT / "data" / "build" / "parlement"
MAX_SHARE, MAX_SMALL = 0.05, 10
PAGE = 1000
# children first (foreign keys); key columns as in scripts/parlement/tables.py
TABLES = [
    ("parl_data_gaps", ("id",)),
    ("parl_interest_items", ("id",)),
    ("parl_interest_declarations", ("id",)),
    ("parl_questions", ("id",)),
    ("parl_amendments", ("id",)),
    ("parl_votes", ("scrutin_id", "person_id")),
    ("parl_scrutins", ("id",)),
    ("parl_texts", ("id",)),
    ("parl_memberships", ("id",)),
    ("parl_mandate_details", ("id",)),
    ("parl_organes", ("id",)),
]


def request(base, key, path, method="GET", headers=None):
    h = {"apikey": key, **(headers or {})}
    if not key.startswith("sb_secret_"):  # legacy service_role JWT
        h["Authorization"] = f"Bearer {key}"
    with urllib.request.urlopen(urllib.request.Request(f"{base}/rest/v1/{path}", method=method, headers=h), timeout=120) as r:
        return json.loads(r.read() or b"null")


def online_keys(base, key, table, cols):
    keys, start = set(), 0
    while True:
        rows = request(base, key, f"{table}?select={','.join(cols)}&order={','.join(cols)}",
                       headers={"Range": f"{start}-{start + PAGE - 1}"})
        keys.update(tuple(r[c] for c in cols) for r in rows)
        if len(rows) < PAGE:
            return keys
        start += PAGE


def quoted(v):
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'


def main():
    dry = "--dry-run" in sys.argv
    e = env()
    base, key = e["SUPABASE_URL"].rstrip("/"), e["SUPABASE_SECRET_KEY"]
    plan = []
    for table, cols in TABLES:
        built = {tuple(r[c] for c in cols) for r in json.loads((BUILD / f"{table}.json").read_text(encoding="utf-8"))}
        online = online_keys(base, key, table, cols)
        stale = sorted(online - built)
        print(f"{table:28} online {len(online):>7}  build {len(built):>7}  to delete {len(stale)}")
        if len(stale) > max(MAX_SMALL, MAX_SHARE * len(online)):
            sys.exit(f"{table}: {len(stale)} of {len(online)} rows would be deleted (> {MAX_SHARE:.0%} and > {MAX_SMALL}): "
                     "stopped, nothing deleted")
        plan.append((table, cols, stale))
    for table, cols, stale in plan:
        for k in stale:
            print(f"  {'would delete' if dry else 'delete'} {table} {' / '.join(map(str, k))}")
        if dry:
            continue
        if len(cols) == 1:
            for i in range(0, len(stale), 100):
                ids = ",".join(quoted(k[0]) for k in stale[i:i + 100])
                request(base, key, f"{table}?{cols[0]}=in.({urllib.parse.quote(ids, safe=',')})", method="DELETE")
        else:
            for k in stale:
                q = "&".join(f"{c}=eq.{urllib.parse.quote(str(v), safe='')}" for c, v in zip(cols, k))
                request(base, key, f"{table}?{q}", method="DELETE")


if __name__ == "__main__":
    main()
