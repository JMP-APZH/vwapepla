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
FIRST_YEAR = 2012  # 2012-2017 from the OFGL yearly archives, 2018+ from the live dataset
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
# Hand-maintained files in the repo are sources too (each row also carries its own source_url).
sources.append({"id": "vwapepla-historique-maires", "title": "Historique des maires par mandat (Vwapepla)",
                "url": "https://github.com/JMP-APZH/vwapepla/blob/main/data/officeholders/history.yaml",
                "dataset_page": "https://github.com/JMP-APZH/vwapepla/blob/main/data/officeholders/history.yaml",
                "licence": "Licence Ouverte 2.0", "credit": "Source : Vwapepla, d'après les sources citées pour chaque mandat",
                "retrieved": MANIFEST["rne-maires"]["retrieved"], "sha256": None, "rows": None,
                "purpose": "Past mayors by term, seeded from official election results and checked by hand."})

# --- communes & commune_years ---------------------------------------------------------------------------------------
CONS, ARCH = "ofgl-base-communes-consolidee", "ofgl-base-communes-consolidee-archives"
cons = [dict(r, _src=CONS) for r in raw(CONS)] + [dict(r, _src=ARCH) for r in raw(ARCH)]
if {r["exer"] for r in cons if r["_src"] == CONS} & {r["exer"] for r in cons if r["_src"] == ARCH}:
    errors.append("archive and live dataset overlap on some years")
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
                            "provisional": y in PROVISIONAL_YEARS, "source_id": r["_src"]}
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

# --- derived ratios (source = the dataset of the year's aggregates) --------------------------------------------------------------------------------------------------
for (c, y) in sorted({(c, y) for c, y, _k in actuals if y >= FIRST_YEAR}):
    g = lambda k: (actuals.get((c, y, k)) or {}).get("amount")  # noqa: E731
    debt, eb, di, rf = g("encours_dette"), g("epargne_brute"), g("di_hors_remb"), g("rf_total")
    for key, val in (("capacite_desendettement", round(debt / eb, 2) if debt is not None and eb and eb > 0 else None),
                     ("taux_effort", round(di / rf, 4) if di is not None and rf else None)):
        actuals[(c, y, key)] = {"commune_code": c, "year": y, "metric_key": key, "amount": val, "amount_bp": None,
                                "amount_ba": None, "amount_flux": None, "eur_per_hab": None,
                                "provisional": y in PROVISIONAL_YEARS,
                                "source_id": actuals.get((c, y, "rf_total"), {}).get("source_id", CONS)}

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

# --- terms (mandats). Budget years "in office" exclude the election year, shared by outgoing and incoming teams. ------
# Dates are the nominal first-round dates; a commune elected in the 2nd round took office one week later.
TERMS = [
    {"id": "2008-2014", "election_year": 2008, "start_date": "2008-03-09", "end_date": "2014-03-23",
     "first_full_year": 2009, "last_full_year": 2013},
    {"id": "2014-2020", "election_year": 2014, "start_date": "2014-03-23", "end_date": "2020-03-15",
     "first_full_year": 2015, "last_full_year": 2019},
    {"id": "2020-2026", "election_year": 2020, "start_date": "2020-03-15", "end_date": "2026-03-15",
     "first_full_year": 2021, "last_full_year": 2025},
    {"id": "2026-2032", "election_year": 2026, "start_date": "2026-03-15", "end_date": None,
     "first_full_year": 2027, "last_full_year": 2031},
]

# --- officeholders: whole current council (RNE), only the fields the card needs (no birth date, occupation, nationality)
officeholders = []
ADJ = re.compile(r"^(\d+)(?:er|ème|e) adjoint au Maire$")
for r in raw("rne-conseillers-municipaux"):
    if r["Code de la collectivité à statut particulier"] != "972":
        continue
    fn = r["Libellé de la fonction"]
    m = ADJ.match(fn)
    role, rank = ("maire", None) if fn == "Maire" else ("adjoint", int(m.group(1))) if m else ("conseiller", None)
    if fn and fn != "Maire" and not m:
        errors.append(f"RNE: unknown function {fn!r}")
    officeholders.append({"commune_code": r["Code de la commune"], "role": role, "rank": rank,
                          "last_name": r["Nom de l'élu"], "first_name": r["Prénom de l'élu"],
                          "mandate_start": r["Date de début du mandat"],
                          "function_start": r["Date de début de la fonction"] or None, "mandate_end": None,
                          "term_id": "2026-2032", "verified": True, "source_url": None,
                          "source_id": "rne-conseillers-municipaux"})
mayors = {o["commune_code"]: o for o in officeholders if o["role"] == "maire"}
if sorted(mayors) != sorted(communes) or len(mayors) != sum(o["role"] == "maire" for o in officeholders):
    errors.append(f"RNE: expected exactly one mayor per commune, got {len(mayors)}")
for r in raw("rne-maires"):  # cross-check with the mayors file
    c = r["Code de la commune"]
    if r["Code de la collectivité à statut particulier"] == "972" and (mayors.get(c) or {}).get("last_name") != r["Nom de l'élu"]:
        errors.append(f"RNE: mayor of {c} differs between the mayors and councillors files")
for c in communes:
    ranks = sorted(o["rank"] for o in officeholders if o["commune_code"] == c and o["role"] == "adjoint")
    if ranks != list(range(1, len(ranks) + 1)):
        print(f"warning: RNE deputy ranks not contiguous in {c}: {ranks} (vacancy?)")

# Past mayors: hand-checked history file (seeded from election results by seed_mayor_history.py, reviewed by JM).
history_file = ROOT / "data" / "officeholders" / "history.yaml"
if history_file.exists():
    import yaml  # noqa: E402
    term_ids = {t["id"] for t in TERMS}
    for h in yaml.safe_load(history_file.read_text(encoding="utf-8")) or []:
        if h["term"] not in term_ids or h["commune"] not in communes or not h.get("source_id"):
            errors.append(f"history.yaml: bad row {h}")
            continue
        if h.get("last_name") is None:  # not yet filled in
            continue
        officeholders.append({"commune_code": h["commune"], "role": "maire", "rank": None,
                              "last_name": h["last_name"], "first_name": h["first_name"],
                              "mandate_start": str(h["start"]), "function_start": str(h["start"]),
                              "mandate_end": str(h["end"]) if h.get("end") else None, "term_id": h["term"],
                              "verified": bool(h.get("verified")), "source_url": h.get("source_url"),
                              "source_id": h["source_id"]})

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
          "metric_definitions": metric_definitions, "terms": TERMS,
          "officeholders": sorted(officeholders, key=lambda r: (r["commune_code"], r["mandate_start"], r["role"],
                                                                r["rank"] or 99, r["last_name"])),
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
