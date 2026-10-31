"""Download every open-data source used by Vwapepla for Martinique into data/raw/ (gitignored).

Re-runnable and idempotent: files are named <dataset>_972_<retrieval date>.csv; an existing file for the
same day is skipped unless --force. Writes data/raw/manifest.json with URL, licence, retrieval date,
row count and sha256 for each file, so every figure can be traced back to its source.

Usage: python -I scripts/download_sources.py [--force] [--only <dataset_id> ...]
"""
import csv, datetime, hashlib, json, pathlib, sys, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OFGL = "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets"
DGFIP = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets"
LICENCE = "Licence Ouverte 2.0"

# (folder, dataset_id, portal base, export params, credit, purpose)
SOURCES = [
    # --- Commune accounts (aggregates) ---
    ("ofgl", "ofgl-base-communes-consolidee", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après DGFiP",
     "Commune accounts, main + annex budgets consolidated (cross flows neutralised). Primary card source."),
    ("ofgl", "ofgl-base-communes", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après DGFiP",
     "Commune accounts per budget (principal / annexes), for drill-down."),
    # --- Account-level detail: octroi de mer, nature of spending, etc. ---
    *[("dgfip", f"balances-comptables-des-communes-en-{y}", DGFIP, {"where": 'startswith(siren,"21972")'},
       "DGFiP", f"Account-level balances {y}, communes of Martinique (all budgets).")
      for y in range(2012, 2026)],
    # --- Bodies that spend/invest for the communes' population ---
    ("ofgl", "ofgl-base-gfp-consolidee", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après DGFiP",
     "Intercommunalities CACEM / CAESM / CAP Nord accounts (water, waste, transport, economic development)."),
    ("ofgl", "ofgl-base-ei", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après DGFiP",
     "Ensembles intercommunaux: EPCI + member communes consolidated."),
    ("ofgl", "ofgl-base-syndicats-consolidee", OFGL, {"refine": "dep_current_code:972"}, "OFGL, d'après DGFiP",
     "Syndicats (water, electricity, school transport...) accounts."),
    ("ofgl", "ofgl-base-ccas-cias", OFGL, {"refine": "code_dep:972"}, "OFGL, d'après DGFiP",
     "CCAS (communal social action centres): social spending outside the commune budget."),
    ("ofgl", "ofgl-base-epl-consolidee", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après DGFiP",
     "EPA, régies personnalisées, GIP (e.g. caisses des écoles, régies)."),
    ("ofgl", "base-communale-flux-financiers", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après DGFiP",
     "Financial flows commune <-> EPCI (attribution de compensation, DSC)."),
    ("ofgl", "base-intercommunale-flux-financiers", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après DGFiP",
     "Financial flows seen from the EPCI side."),
    # --- Revenue detail ---
    ("ofgl", "dotations-communes", OFGL, {"refine": "code_departement:972"}, "OFGL, d'après DGCL",
     "State grants (DGF components...) amounts and criteria."),
    ("ofgl", "base-fiscale-simplifiee", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après DGFiP (REI)",
     "Local direct taxes 2012-2025: bases, voted rates, proceeds."),
    ("ofgl", "rei", OFGL, {"refine": "dep:972"}, "OFGL, d'après DGFiP (REI)",
     "Detailed local direct tax file (REI) 2024-2025."),
    ("ofgl", "actifs_communes", OFGL, {"refine": "insee_dep_geo:972"}, "OFGL, d'après DGFiP",
     "Revalued assets of communes."),
    # --- Reference / context ---
    ("ofgl", "populations-ofgl-communes", OFGL, {"refine": "dep_code:972"}, "OFGL, d'après INSEE",
     "Population by commune 2012-2025."),
    ("ofgl", "disponibilite-des-comptes-des-communes", OFGL, {"where": 'startswith(insee,"972")'}, "OFGL",
     "Availability of commune accounts per year."),
    ("ofgl", "detail_compositions_intercommunales_2012_2025", OFGL, {"where": 'startswith(insee,"972")'}, "OFGL",
     "Which EPCI each commune belonged to, per year."),
    ("ofgl", "methodologie-ofgl-formules-des-agregats-financiers", OFGL, {"refine": "type_collectivite:Communes"},
     "OFGL", "Account-level formula of every aggregate (maps aggregates to DGFiP accounts)."),
    ("ofgl", "methodologie-ofgl-definitions-agregats-financiers", OFGL, {}, "OFGL", "Aggregate definitions."),
    ("ofgl", "nomenclatures-budgetaires", OFGL, {"where": "annee>=2012"}, "OFGL",
     "Chart of accounts (M14, M57, M4...) labels per year."),
    ("ofgl", "dates-cles-finances-locales", OFGL, {}, "OFGL", "Key dates / reforms of local finance."),
]

# Files published as a whole (national, not filterable server-side): (folder, id, stable url, dataset page, credit, purpose).
# data.gouv.fr /datasets/r/<resource id> always redirects to the latest version of the resource.
FILES = [
    ("rne", "rne-maires", "https://www.data.gouv.fr/datasets/r/2876a346-d50c-4911-934e-19ee07b0e503",
     "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/", "Ministère de l'Intérieur, RNE",
     "Répertoire national des élus — mayors (name, start of term). National file; filtered on 972 at import."),
    ("rne", "rne-conseillers-municipaux", "https://www.data.gouv.fr/datasets/r/d5f400de-ae3f-4966-8cb6-a85c70c6c24a",
     "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/", "Ministère de l'Intérieur, RNE",
     "Répertoire national des élus — municipal councillors. National file; filtered on 972 at import."),
]


def fetch(url, dest, tries=3):
    for i in range(tries):
        try:
            tmp = dest.with_suffix(".part")
            with urllib.request.urlopen(url, timeout=900) as r, open(tmp, "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            tmp.replace(dest)
            return
        except Exception as e:  # network hiccups: retry with backoff
            if i == tries - 1:
                raise
            print(f"   retry {i + 1} after error: {e}")
            time.sleep(5 * (i + 1))


def main():
    force = "--force" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1:] if "--only" in sys.argv else None
    today = datetime.date.today().isoformat()
    manifest_path = RAW / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    jobs = [(folder, ds, f"{base}/{ds}/exports/csv?" + urllib.parse.urlencode({**params, "delimiter": ";"}),
             f"{base.replace('/api/explore/v2.1/catalog/datasets', '')}/explore/dataset/{ds}/", credit, purpose, "_972")
            for folder, ds, base, params, credit, purpose in SOURCES]
    jobs += [(folder, ds, url, page, credit, purpose, "") for folder, ds, url, page, credit, purpose in FILES]
    for folder, ds, url, page, credit, purpose, scope in jobs:
        if only and ds not in only:
            continue
        (RAW / folder).mkdir(parents=True, exist_ok=True)
        dest = RAW / folder / f"{ds}{scope}_{today}.csv"
        if dest.exists() and not force:
            print(f"skip {dest.name} (exists)")
        else:
            print(f"get  {ds} ...", flush=True)
            fetch(url, dest)
        data = dest.read_bytes()
        with open(dest, encoding="utf-8-sig", newline="") as f:  # count records, not lines (fields may hold newlines)
            rows = sum(1 for _ in csv.reader(f, delimiter=";")) - 1
        manifest[ds] = {
            "file": str(dest.relative_to(ROOT)).replace("\\", "/"), "url": url,
            "dataset_page": page,
            "retrieved": today, "rows": rows, "sha256": hashlib.sha256(data).hexdigest(),
            "licence": LICENCE, "credit": f"Source : {credit}", "purpose": purpose,
        }
        print(f"     {rows} rows")
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
