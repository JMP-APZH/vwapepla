"""Download every open-data source used by Vwapepla for Martinique into data/raw/ (gitignored).

Re-runnable and idempotent: files are named <dataset>_972_<retrieval date>.csv; an existing file for the
same day is skipped unless --force. Writes data/raw/manifest.json with URL, licence, retrieval date,
row count and sha256 for each file, so every figure can be traced back to its source.

Usage: python -I scripts/download_sources.py [--force] [--only <dataset_id> ...]
"""
import csv, datetime, hashlib, io, json, pathlib, sys, tempfile, time, urllib.parse, urllib.request, zipfile

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

# Files published as a whole (national, not filterable server-side): (folder, id, stable url, title, dataset page, credit,
# purpose).
# data.gouv.fr /datasets/r/<resource id> always redirects to the latest version of the resource.
FILES = [
    ("rne", "rne-maires", "https://www.data.gouv.fr/datasets/r/2876a346-d50c-4911-934e-19ee07b0e503",
     "Répertoire national des élus — maires",
     "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/", "Ministère de l'Intérieur, RNE",
     "Répertoire national des élus — mayors (name, start of term). National file; filtered on 972 at import."),
    ("rne", "rne-conseillers-municipaux", "https://www.data.gouv.fr/datasets/r/d5f400de-ae3f-4966-8cb6-a85c70c6c24a",
     "Répertoire national des élus — conseillers municipaux",
     "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/", "Ministère de l'Intérieur, RNE",
     "Répertoire national des élus — municipal councillors. National file; filtered on 972 at import."),
    # Ministry of the Interior municipal election results (lists, heads of list, seats) — used to seed past mayors.
    ("elections", "municipales-2014-t1", "https://www.data.gouv.fr/datasets/r/936f6d38-5969-46e5-8b9d-c7646d6390ec",
     "Élections municipales 2014 — résultats 1er tour (communes de 1 000 hab. et plus)",
     "https://www.data.gouv.fr/datasets/elections-municipales-2014-resultats-1er-tour/", "Ministère de l'Intérieur",
     "2014 results, round 1. National, latin-1; Martinique = département code ZB."),
    ("elections", "municipales-2014-t2", "https://www.data.gouv.fr/datasets/r/28ed59fd-d285-42f1-9eb6-d82ff2eaa4b3",
     "Élections municipales 2014 — résultats 2nd tour (communes de 1 000 hab. et plus)",
     "https://www.data.gouv.fr/datasets/elections-municipales-2014-resultats-2eme-tour/", "Ministère de l'Intérieur",
     "2014 results, round 2."),
    ("elections", "municipales-2020-t1", "https://www.data.gouv.fr/datasets/r/5129e7cf-2999-4eaf-8dd7-3bcda37bd0a3",
     "Élections municipales 2020 — résultats 1er tour (communes de 1 000 hab. et plus)",
     "https://www.data.gouv.fr/datasets/elections-municipales-2020-resultats-1er-tour/", "Ministère de l'Intérieur",
     "2020 results, round 1."),
    ("elections", "municipales-2020-t2", "https://www.data.gouv.fr/datasets/r/e7cae0aa-5e36-4370-b724-6f233014d0d6",
     "Élections municipales 2020 — résultats 2nd tour (communes de 1 000 hab. et plus)",
     "https://www.data.gouv.fr/datasets/municipales-2020-resultats-2nd-tour/", "Ministère de l'Intérieur",
     "2020 results, round 2."),
]

# OFGL yearly archives (national zip per year, 2012-2017): streamed, filtered on département 972, written with the same
# field names and number format as the live API export so build.py reads every year the same way.
ARCHIVE_YEARS = range(2012, 2018)
ARCHIVE_URL = ("https://data.ofgl.fr/api/v2/catalog/datasets/ofgl-base-communes-consolidee/attachments/"
               "ofgl_base_communes_{year}_consolidee_pj_zip")
NUMERIC = {"montant", "montant_bp", "montant_ba", "montant_flux", "montant_en_millions", "euros_par_habitant"}


def fetch_archives(dest):
    with urllib.request.urlopen(f"{OFGL}/ofgl-base-communes-consolidee", timeout=60) as r:
        label2name = {f["label"]: f["name"] for f in json.load(r)["fields"]}
    out_fields, written = None, 0
    with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
        writer = None
        for year in ARCHIVE_YEARS:
            with tempfile.TemporaryDirectory() as tmp:
                z = pathlib.Path(tmp) / "a.zip"
                print(f"     archive {year} ...", flush=True)
                fetch(ARCHIVE_URL.format(year=year), z)
                with zipfile.ZipFile(z) as zf:
                    with io.TextIOWrapper(zf.open(zf.namelist()[0]), encoding="utf-8-sig", newline="") as f:
                        reader = csv.reader(f, delimiter=";")
                        header = [label2name.get(h, h) for h in next(reader)]
                        if writer is None:
                            out_fields = header
                            writer = csv.writer(out, delimiter=";")
                            writer.writerow(out_fields)
                        elif header != out_fields:
                            raise SystemExit(f"archive {year}: columns differ from {ARCHIVE_YEARS[0]}")
                        dep = header.index("dep_code")
                        num = [i for i, h in enumerate(header) if h in NUMERIC]
                        for row in reader:
                            if row[dep] == "972":
                                for i in num:
                                    row[i] = row[i].replace(",", ".")
                                writer.writerow(row)
                                written += 1
    dest.with_suffix(".part").replace(dest)
    print(f"     {written} Martinique rows kept")


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


def portal_title(base, ds):
    """Official dataset title from the portal catalogue (French, as published)."""
    with urllib.request.urlopen(f"{base}/{ds}", timeout=60) as r:
        return json.load(r)["metas"]["default"]["title"]


def main():
    force = "--force" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1:] if "--only" in sys.argv else None
    today = datetime.date.today().isoformat()
    manifest_path = RAW / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    jobs = [(folder, ds, f"{base}/{ds}/exports/csv?" + urllib.parse.urlencode({**params, "delimiter": ";"}),
             lambda base=base, ds=ds: portal_title(base, ds),
             f"{base.replace('/api/explore/v2.1/catalog/datasets', '')}/explore/dataset/{ds}/", credit, purpose, "_972")
            for folder, ds, base, params, credit, purpose in SOURCES]
    jobs += [(folder, ds, url, lambda title=title: title, page, credit, purpose, "")
             for folder, ds, url, title, page, credit, purpose in FILES]
    jobs.append(("ofgl", "ofgl-base-communes-consolidee-archives", ARCHIVE_URL.format(year="{2012..2017}"),
                 lambda: "Comptes consolidés des communes 2012-2017 (archives)",
                 "https://data.ofgl.fr/explore/dataset/ofgl-base-communes-consolidee/", "OFGL, d'après DGFiP",
                 "Consolidated commune accounts 2012-2017 (yearly national archives), filtered on 972.", "_972"))
    for folder, ds, url, title, page, credit, purpose, scope in jobs:
        if only and ds not in only:
            continue
        (RAW / folder).mkdir(parents=True, exist_ok=True)
        dest = RAW / folder / f"{ds}{scope}_{today}.csv"
        if dest.exists() and not force:
            print(f"skip {dest.name} (exists)")
        else:
            print(f"get  {ds} ...", flush=True)
            fetch_archives(dest) if ds.endswith("-archives") else fetch(url, dest)
        data = dest.read_bytes()
        enc = "latin-1" if folder == "elections" else "utf-8-sig"
        with open(dest, encoding=enc, newline="") as f:  # count records, not lines (fields may hold newlines)
            rows = sum(1 for _ in csv.reader(f, delimiter=";")) - 1
        manifest[ds] = {
            "file": str(dest.relative_to(ROOT)).replace("\\", "/"), "url": url, "title": title(),
            "dataset_page": page,
            "retrieved": today, "rows": rows, "sha256": hashlib.sha256(data).hexdigest(),
            "licence": LICENCE, "credit": f"Source : {credit}", "purpose": purpose,
        }
        print(f"     {rows} rows")
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
