"""Build normalised tables from data/raw/prefet/ into data/build/prefet/<table>.json (one JSON array per Supabase table:
core rows of the préfecture + pref_* tables).

Deterministic and idempotent: same raw files -> same output. Run: python -I scripts/prefet/build.py
Checks (exit 1 on failure): DPT gate (programmes = mission, missions = total, every edition); every grant mapped to a
beneficiary; row counts equal to the manifest.
"""
import csv, json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # our own code dir (python -I drops it)
from dpt import build_dpt  # noqa: E402
from grants import build_grants  # noqa: E402
from postings import build_postings  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW, OUT = ROOT / "data" / "raw" / "prefet", ROOT / "data" / "build" / "prefet"
MANIFEST = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
errors = []


def raw(ds):
    with open(ROOT / MANIFEST[ds]["file"], encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f, delimiter=";"))
    if len(rows) != MANIFEST[ds]["rows"]:
        errors.append(f"{ds}: {len(rows)} rows read, manifest says {MANIFEST[ds]['rows']}")
    return rows


# --- sources -------------------------------------------------------------------------------------------------------
sources = [{"id": ds, "title": m["title"], "url": m["url"], "dataset_page": m["dataset_page"],
            "licence": m["licence"], "credit": m["credit"], "retrieved": m["retrieved"], "sha256": m["sha256"],
            "rows": m["rows"], "purpose": m["purpose"], "domain": "prefet"} for ds, m in sorted(MANIFEST.items())]

# --- core rows: the préfecture and its seats (postings come from the JORF decrees, scripts/prefet/legifrance.py) -------
INSTITUTION = "prefecture-972"
BODY = f"{INSTITUTION}-corps"
# Arrondissements of Martinique (INSEE: 9721 Fort-de-France, 9722 La Trinité, 9723 Le Marin, 9724 Saint-Pierre).
# rank = arrondissement number. The secrétaire général is sous-préfet of the chef-lieu arrondissement (Fort-de-France).
SEATS = [
    ("prefet", None, "Préfet de la région Martinique, préfet de la Martinique", None),
    ("secretaire_general", None, "Secrétaire général de la préfecture de la Martinique", "Fort-de-France"),
    ("directeur_cabinet", None, "Directeur de cabinet du préfet de la région Martinique", None),
    ("sous_prefet", 2, "Sous-préfet de La Trinité", "La Trinité"),
    ("sous_prefet", 3, "Sous-préfet du Marin", "Le Marin"),
    ("sous_prefet", 4, "Sous-préfet de Saint-Pierre", "Saint-Pierre"),
]
institutions = [{"id": INSTITUTION, "kind": "prefecture", "name": "Préfecture de la Martinique", "code": None}]
bodies = [{"id": BODY, "institution_id": INSTITUTION, "kind": "corps_prefectoral", "name": "Corps préfectoral"}]
seats = [{"id": f"{BODY}:{role}" + (f"-{rank}" if rank else ""), "body_id": BODY, "role": role, "rank": rank,
          "label_fr": label, "constituency": constituency} for role, rank, label, constituency in SEATS]

# --- postings (JORF appointment decrees, scripts/prefet/postings.py) --------------------------------------------------
persons, mandates, events, steps = [], [], [], []
if "jorf-nominations-972" in MANIFEST and "jorf-parcours" in MANIFEST:
    csv.field_size_limit(1 << 30)  # raw_json column
    persons, mandates, events, steps, report, errs = build_postings(
        raw("jorf-nominations-972"), raw("jorf-parcours"), BODY, "jorf-nominations-972", "jorf-parcours")
    errors += errs
    for line in report:
        print("postings:", line)
    for seat in seats:
        rows = sorted((m for m in mandates if m["seat_id"] == seat["id"]), key=lambda m: m["start_date"])
        print(f"postings {seat['label_fr']}:")
        for m in rows:
            print(f"   {m['start_date']} -> {m['end_date'] or 'en fonction'}  {m['person_id']}")
    # the six current holders: at most one open posting per seat
    for seat in seats:
        open_ = [m for m in mandates if m["seat_id"] == seat["id"] and m["end_date"] is None]
        if len(open_) > 1:
            errors.append(f"{seat['id']}: {len(open_)} postings without end date")
else:
    print("postings: JORF files not downloaded (PISTE keys missing), postings skipped")

# --- State investment grants (DGCL) --------------------------------------------------------------------------------
grant_files = {int(ds.rsplit("-", 1)[1]): raw(ds) for ds in MANIFEST if ds.startswith("dgcl-dotations-investissement-")}
grants, report, errs = build_grants(grant_files, {y: f"dgcl-dotations-investissement-{y}" for y in grant_files})
errors += errs
for line in report:
    print("grants:", line)
for y in sorted(grant_files):
    rows = [g for g in grants if g["year"] == y]
    print(f"grants {y}: {len(rows):3d} projects, {sum(g['grant_amount'] for g in rows):>14,.0f} €".replace(",", " "))

# --- State credits in Martinique (DPT Outre-mer) ---------------------------------------------------------------------
dpt = []
for ds in sorted(d for d in MANIFEST if d.startswith("dpt-outre-mer-")):
    edition = int(ds.rsplit("-", 1)[1])
    rows, errs = build_dpt(raw(ds), edition, ds)
    errors += errs
    dpt += rows
    t = [r for r in rows if r["level"] == "total"]
    print(f"DPT {edition}: " + ", ".join(f"{r['stage']} {r['year']} CP {r['cp']:,} €".replace(",", " ") for r in t))

# --- write -----------------------------------------------------------------------------------------------------------
tables = {"sources": sources, "institutions": institutions, "bodies": bodies, "seats": seats, "persons": persons,
          "mandates": mandates, "pref_posting_events": events, "pref_career_steps": steps,
          "pref_investment_grants": sorted(grants, key=lambda g: (g["year"], g["id"])),
          "pref_dpt_credits": sorted(dpt, key=lambda r: r["id"])}
ids = {}
for name, rows in tables.items():
    if name == "mandates":
        continue  # identity id; unique (person_id, seat_id, start_date) checked in postings.py
    dup = len(rows) - len({r["id"] for r in rows})
    if dup:
        errors.append(f"{name}: {dup} duplicate ids")
OUT.mkdir(parents=True, exist_ok=True)
for name, rows in tables.items():
    (OUT / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{name:24s} {len(rows):6d} rows")
if errors:
    print("\nERRORS:\n  " + "\n  ".join(errors))
    sys.exit(1)
