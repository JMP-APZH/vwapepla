"""Remove past-mayor mandates (and persons left without any mandate) that are no longer in the build.

The shared loader (scripts/core/load_supabase.py) only upserts. When history.yaml changes a start date or a spelling,
the old row would stay next to the new one. Scope is narrow on purpose: seats 'commune-<insee>-cm:maire', terms
2008-2014 / 2014-2020 / 2020-2026, and persons 'com-972..' that no mandate uses any more.

Dry run by default (lists what would go). Run after load_supabase.py:
  python -I scripts/communes/pipeline/prune_mayor_history.py [--apply]
"""
import json, pathlib, sys, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[3]
BUILD = ROOT / "data" / "build" / "communes"
PAST = ("2008-2014", "2014-2020", "2020-2026")


def env():
    vals = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"')
    return vals


def call(method, path, key, base):
    headers = {"apikey": key, "Prefer": "return=minimal"}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    req = urllib.request.Request(f"{base}/rest/v1/{path}", method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()
    return json.loads(body) if body else None


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    apply = "--apply" in sys.argv
    e = env()
    base, key = e.get("SUPABASE_URL") or e["NEXT_PUBLIC_SUPABASE_URL"], e["SUPABASE_SECRET_KEY"]
    built = json.loads((BUILD / "mandates.json").read_text(encoding="utf-8"))
    keep = {(m["person_id"], m["seat_id"], m["start_date"]) for m in built}
    terms = ",".join(PAST)
    rows = call("GET", "mandates?select=person_id,seat_id,start_date,term_id&seat_id=like.commune-972*-cm:maire"
                       f"&term_id=in.({terms})&limit=10000", key, base)
    stale = [m for m in rows if (m["person_id"], m["seat_id"], m["start_date"]) not in keep]
    print(f"past-mayor mandates in the database: {len(rows)}; not in the build: {len(stale)}")
    for m in stale:
        print(f"  - {m['term_id']} {m['person_id']} from {m['start_date']}")
        if apply:
            q = urllib.parse.urlencode({"person_id": f"eq.{m['person_id']}", "seat_id": f"eq.{m['seat_id']}",
                                        "start_date": f"eq.{m['start_date']}"})
            call("DELETE", f"mandates?{q}", key, base)
    persons = call("GET", "persons?select=id&id=like.com-972*&limit=20000", key, base)
    used = {m["person_id"] for m in call("GET", "mandates?select=person_id&person_id=like.com-972*&limit=20000", key, base)}
    used |= {m["person_id"] for m in built}
    if not apply:
        used -= {m["person_id"] for m in stale} - {m["person_id"] for m in built}
    orphans = [p["id"] for p in persons if p["id"] not in used]
    print(f"persons without any mandate: {len(orphans)}")
    for pid in orphans:
        print(f"  - {pid}")
        if apply:
            call("DELETE", f"persons?{urllib.parse.urlencode({'id': f'eq.{pid}'})}", key, base)
    print("applied" if apply else "dry run: nothing changed (add --apply)")


if __name__ == "__main__":
    main()
