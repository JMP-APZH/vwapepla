"""Build normalised tables from data/raw/ into data/build/*.json (one JSON array per Supabase table).

Deterministic and idempotent: same raw files -> same output. Run: python -I scripts/pipeline/build.py
Checks (exit 1 on failure): 34 communes every year, accounting hierarchy (children sum to parent), CCAS<->commune mapping.
"""
import collections, csv, glob, json, pathlib, re, sys, unicodedata

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # our own code dir (python -I drops it)
from metrics import BY_AGGREGATE, METRICS, OCTROI_ACCOUNTS, UNITS  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW, OUT = ROOT / "data" / "raw", ROOT / "data" / "build"
PROVISIONAL_YEARS = {2025}  # until DGFiP final balances (~end of December of the following year)
FIRST_YEAR = 2018
MANIFEST = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
errors = []


def raw(ds):
    """Rows of the file the manifest points to for dataset `ds`."""
    with open(ROOT / MANIFEST[ds]["file"], encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def num(v):
    return float(v) if v not in (None, "") else None


def slugify(name):
    s = unicodedata.normalize("NFKD", name.replace("œ", "oe").replace("Œ", "Oe"))
    s = s.encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def per_hab(amount, pop):
    return round(amount / pop, 2) if amount is not None and pop else None


# --- sources -------------------------------------------------------------------------------------------------------
sources = [{"id": ds, "title": m["title"], "url": m["url"], "dataset_page": m["dataset_page"],
            "licence": m["licence"], "credit": m["credit"], "retrieved": m["retrieved"], "sha256": m["sha256"],
            "rows": m["rows"], "purpose": m["purpose"]} for ds, m in sorted(MANIFEST.items())]

# --- communes & commune_years ---------------------------------------------------------------------------------------
CONS = "ofgl-base-communes-consolidee"
cons = raw(CONS)
latest = max(int(r["exer"]) for r in cons)
communes = {}
for r in cons:
    if int(r["exer"]) == latest:
        communes[r["com_code"]] = {"code": r["com_code"], "slug": slugify(r["com_name"]), "name": r["com_name"],
                                   "siren": r["siren"]}
if len(communes) != 34:
    errors.append(f"expected 34 communes, got {len(communes)}")

nomen = {}
for r in raw("ofgl-base-communes"):
    if r["type_de_budget"] == "Budget principal":
        nomen[(r["com_code"], int(r["exer"]))] = r["nomen"]
stratum = {(r["com_code"], int(r["exer"])): r["tranche_population"] for r in cons}
years = {}
for r in raw("populations-ofgl-communes"):
    if r["com_code"] in communes:
        y = int(r["annee"])
        years[(r["com_code"], y)] = {"commune_code": r["com_code"], "year": y, "population": int(r["ptot"]),
                                     "stratum": stratum.get((r["com_code"], y), r["tranche_population"]),
                                     "epci_siren": r["epci_code"] or None, "epci_name": r["epci_name"] or None,
                                     "nomenclature": nomen.get((r["com_code"], y))}
pop = {k: v["population"] for k, v in years.items()}

# --- actuals: OFGL consolidated --------------------------------------------------------------------------------------
actuals = {}
unknown = collections.Counter()
for r in cons:
    key = BY_AGGREGATE.get(r["agregat"])
    if not key:
        unknown[r["agregat"]] += 1
        continue
    c, y = r["com_code"], int(r["exer"])
    if int(r["ptot"]) != pop.get((c, y)):
        errors.append(f"population mismatch {c} {y}: {r['ptot']} vs {pop.get((c, y))}")
    actuals[(c, y, key)] = {"commune_code": c, "year": y, "metric_key": key, "amount": num(r["montant"]),
                            "amount_bp": num(r["montant_bp"]), "amount_ba": num(r["montant_ba"]),
                            "amount_flux": num(r["montant_flux"]),
                            "eur_per_hab": per_hab(num(r["montant"]), int(r["ptot"])),
                            "provisional": y in PROVISIONAL_YEARS, "source_id": CONS}
if unknown:
    errors.append(f"aggregates without metric key: {dict(unknown)}")

# --- actuals: octroi de mer from DGFiP balances (all budgets of the commune, net credit) -----------------------------
siren2code = {v["siren"]: k for k, v in communes.items()}
for ds in sorted(d for d in MANIFEST if d.startswith("balances-comptables-des-communes-en-")):
    y = int(ds[-4:])
    tot = collections.defaultdict(float)
    for r in raw(ds):
        if r["compte"] in OCTROI_ACCOUNTS and r["siren"] in siren2code:
            tot[siren2code[r["siren"]]] += (num(r["obnetcre"]) or 0) - (num(r["obnetdeb"]) or 0)
    if len(tot) != 34:
        errors.append(f"octroi de mer {y}: {len(tot)} communes")
    for c, amount in tot.items():
        amount = round(amount, 2)
        actuals[(c, y, "octroi_de_mer")] = {"commune_code": c, "year": y, "metric_key": "octroi_de_mer",
                                            "amount": amount, "amount_bp": None, "amount_ba": None, "amount_flux": None,
                                            "eur_per_hab": per_hab(amount, pop.get((c, y))),
                                            "provisional": y in PROVISIONAL_YEARS, "source_id": ds}

# --- derived ratios --------------------------------------------------------------------------------------------------
for (c, y) in sorted({(c, y) for c, y, _k in actuals if y >= FIRST_YEAR}):
    g = lambda k: (actuals.get((c, y, k)) or {}).get("amount")  # noqa: E731
    debt, eb, di, rf = g("encours_dette"), g("epargne_brute"), g("di_hors_remb"), g("rf_total")
    for key, val in (("capacite_desendettement", round(debt / eb, 2) if debt is not None and eb and eb > 0 else None),
                     ("taux_effort", round(di / rf, 4) if di is not None and rf else None)):
        actuals[(c, y, key)] = {"commune_code": c, "year": y, "metric_key": key, "amount": val, "amount_bp": None,
                                "amount_ba": None, "amount_flux": None, "eur_per_hab": None,
                                "provisional": y in PROVISIONAL_YEARS, "source_id": CONS}

# --- checks: coverage and hierarchy ----------------------------------------------------------------------------------
for y in range(FIRST_YEAR, latest + 1):
    n = len({c for c, yy, k in actuals if yy == y and k == "rf_total"})
    if n != 34:
        errors.append(f"{y}: {n}/34 communes with rf_total")
children = collections.defaultdict(list)
for key, _b, parent, *_ in METRICS:
    if parent:
        children[parent].append(key)
bad = 0
for (c, y, k), row in actuals.items():
    if k in children and row["amount"] is not None:
        s = sum((actuals.get((c, y, ch)) or {}).get("amount") or 0 for ch in children[k])
        if abs(s - row["amount"]) > 1:  # euro tolerance (rounding)
            bad += 1
            if bad <= 5:
                errors.append(f"hierarchy {c} {y} {k}: {row['amount']:.2f} != sum children {s:.2f}")
print(f"hierarchy check: {bad} mismatches")

# --- metric_definitions ----------------------------------------------------------------------------------------------
metric_definitions = [{"key": key, "block": block, "parent_key": parent, "label_fr": label, "label_kreyol": None,
                       "source_rule": src, "unit": UNITS.get(key, "eur"), "on_card": on_card,
                       "description_fr": desc, "display_order": i}
                      for i, (key, block, parent, label, src, on_card, desc) in enumerate(METRICS)]

# --- officeholders (RNE): only the fields the card needs (no birth date, no occupation) -----------------------------
officeholders = []
for r in raw("rne-maires"):
    if r["Code de la collectivité à statut particulier"] == "972":
        officeholders.append({"commune_code": r["Code de la commune"], "role": "maire",
                              "last_name": r["Nom de l'élu"], "first_name": r["Prénom de l'élu"],
                              "mandate_start": r["Date de début du mandat"],
                              "function_start": r["Date de début de la fonction"] or None,
                              "mandate_end": None, "source_id": "rne-maires"})
if sorted(o["commune_code"] for o in officeholders) != sorted(communes):
    errors.append(f"RNE: {len(officeholders)} mayors, expected one per commune")

# --- entities & entity_actuals (EPCI, syndicats, CCAS, EPL) ----------------------------------------------------------
entities, entity_actuals = {}, {}


def add_entity_rows(ds, rows, kind, name_f, cat_f=lambda r: None, commune_f=lambda r: None, pop_f=lambda r: None):
    for r in rows:
        s = r["siren"]
        entities.setdefault(s, {"siren": s, "kind": kind, "name": name_f(r), "commune_code": commune_f(r),
                                "category": cat_f(r)})
        y = int(r["exer"])
        entity_actuals[(s, y, r["agregat"])] = {"siren": s, "year": y, "agregat": r["agregat"],
                                                "metric_key": BY_AGGREGATE.get(r["agregat"]),
                                                "amount": num(r["montant"]), "population": pop_f(r),
                                                "provisional": y in PROVISIONAL_YEARS, "source_id": ds}


add_entity_rows("ofgl-base-gfp-consolidee", raw("ofgl-base-gfp-consolidee"), "epci", lambda r: r["epci_name"],
                lambda r: r["nat_juridique"], pop_f=lambda r: int(r["ptot"]) if r["ptot"] else None)
add_entity_rows("ofgl-base-syndicats-consolidee", raw("ofgl-base-syndicats-consolidee"), "syndicat",
                lambda r: r["synd_name"], lambda r: r["categorie_synd"])
# CCAS: per-budget dataset (no consolidated version) -> main budget only, to avoid double counting.
ccas = [r for r in raw("ofgl-base-ccas-cias") if r["type_de_budget"] == "Budget principal"]
add_entity_rows("ofgl-base-ccas-cias", ccas, "ccas", lambda r: r["nom_ccas"], commune_f=lambda r: "972" + r["siren"][6:8])
add_entity_rows("ofgl-base-epl-consolidee", raw("ofgl-base-epl-consolidee"), "epl", lambda r: r["nom_epl"],
                lambda r: r["categorie_epl_abr"])
for e in entities.values():
    if e["kind"] == "ccas":
        words = set(re.findall(r"[a-z]{4,}", slugify(communes.get(e["commune_code"], {}).get("name", "")).replace("-", " ")))
        if e["commune_code"] not in communes or not words & set(re.findall(r"[a-z]{4,}", slugify(e["name"]).replace("-", " "))):
            errors.append(f"CCAS mapping doubtful: {e['name']} -> {e['commune_code']}")
unmapped = collections.Counter(v["agregat"] for v in entity_actuals.values() if not v["metric_key"])
if unmapped:
    errors.append(f"entity aggregates without metric key: {dict(unmapped)}")

# --- write -----------------------------------------------------------------------------------------------------------
OUT.mkdir(parents=True, exist_ok=True)
tables = {"sources": sources, "communes": sorted(communes.values(), key=lambda r: r["code"]),
          "commune_years": sorted(years.values(), key=lambda r: (r["commune_code"], r["year"])),
          "metric_definitions": metric_definitions, "officeholders": sorted(officeholders, key=lambda r: r["commune_code"]),
          "actuals": sorted(actuals.values(), key=lambda r: (r["commune_code"], r["year"], r["metric_key"])),
          "entities": sorted(entities.values(), key=lambda r: r["siren"]),
          "entity_actuals": sorted(entity_actuals.values(), key=lambda r: (r["siren"], r["year"], r["agregat"]))}
for name, rows in tables.items():
    (OUT / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{name:20s} {len(rows):6d} rows")
if errors:
    print("\nERRORS:\n  " + "\n  ".join(errors))
    sys.exit(1)
print("\nall checks passed")
