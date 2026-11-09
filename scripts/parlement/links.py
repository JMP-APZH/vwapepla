"""Candidate person_links for review (core table person_links, migration 20261109180000_core_person_links.sql).

Reads the other domains' people and mandates from the shared project (public read, publishable key from .env) and
lists, for each parliamentarian of the build, the persons with the same normalised last and first name and the same
sex. Prints them with the evidence to check: the Sénat's own list of the senator's local offices
(senat-mandats-locaux), or the member's official page. Writes nothing: a link becomes a fact only once JM has checked
it and it is added to data/parlement/person_links.yaml.

Run after build.py: python -I scripts/parlement/links.py
"""
import collections, csv, json, pathlib, re, sys, unicodedata, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD = ROOT / "data" / "build" / "parlement"
MANIFEST = json.loads((ROOT / "data" / "raw" / "parlement" / "manifest.json").read_text(encoding="utf-8"))


def public_env():
    vals = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"')
    return vals["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"), vals["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]


def rest(base, key, path):
    rows, start = [], 0
    while True:
        req = urllib.request.Request(f"{base}/rest/v1/{path}", headers={"apikey": key, "Range": f"{start}-{start + 999}"})
        with urllib.request.urlopen(req, timeout=120) as r:
            page = json.loads(r.read())
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]+", " ", s.lower()).strip()


def main():
    base, key = public_env()
    people = rest(base, key, "persons?select=id,last_name,first_name,sex&order=id")
    others = collections.defaultdict(list)
    for p in people:
        if not p["id"].startswith("parl-"):
            others[(norm(p["last_name"]), norm(p["first_name"]))].append(p)
    seats = {s["id"]: s["label_fr"] for s in rest(base, key, "seats?select=id,label_fr")}
    bodies = {b["id"]: b["name"] for b in rest(base, key, "bodies?select=id,name")}
    mandates = collections.defaultdict(list)
    for m in rest(base, key, "mandates?select=person_id,seat_id,start_date,end_date&person_id=not.like.parl-*"):
        mandates[m["person_id"]].append(m)
    seat_body = {s["id"]: s["body_id"] for s in rest(base, key, "seats?select=id,body_id")}
    local = collections.defaultdict(list)  # Sénat: the senator's local offices, as the Sénat publishes them
    with open(ROOT / MANIFEST["senat-mandats-locaux"]["file"], encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            local[r["Matricule"]].append(f"{r['Fonction']} {r['Article organisme']}{r['Organisme']}".replace("  ", " ")
                                         + (" (en cours)" if r["Mandat en cours"] == "OUI" else ""))
    details = {d["person_id"]: d for d in json.loads((BUILD / "parl_mandate_details.json").read_text(encoding="utf-8"))}
    n = 0
    for p in sorted(json.loads((BUILD / "persons.json").read_text(encoding="utf-8")), key=lambda p: p["last_name"]):
        cands = [o for o in others.get((norm(p["last_name"]), norm(p["first_name"])), []) if o["sex"] in (None, p["sex"])]
        if not cands:
            continue
        print(f"\n## {p['first_name']} {p['last_name']} ({p['id']})")
        if p["id"].startswith("parl-sen:"):
            mat = p["id"].split(":", 1)[1]
            print(f"   evidence: Sénat, mandats locaux ({MANIFEST['senat-mandats-locaux']['dataset_page']}):")
            for x in local.get(mat, []) or ["(aucun mandat local publié)"]:
                print(f"     - {x}")
        print(f"   official page: {details.get(p['id'], {}).get('official_url')}")
        for o in cands:
            n += 1
            print(f"   candidate {o['id']}")
            for m in sorted(mandates[o["id"]], key=lambda m: m["start_date"]):
                print(f"     {m['start_date']} → {m['end_date'] or 'en cours'}  {seats.get(m['seat_id'], m['seat_id'])}"
                      f" — {bodies.get(seat_body.get(m['seat_id']), '')}")
    print(f"\n{n} candidate pairs. Nothing written: validated pairs go to data/parlement/person_links.yaml.")


if __name__ == "__main__":
    main()
