"""Open-data sources of the communes domain (B1), downloaded by scripts/core/download_sources.py --domain communes.

JOBS: one dict per dataset (see scripts/core/fetching.py for the fields). Files land in data/raw/communes/<folder>/ and
are listed in data/raw/communes/manifest.json.
"""
import csv, datetime, gzip, io, json, pathlib, tempfile, unicodedata, urllib.parse, urllib.request, zipfile

from fetching import LICENCE, fetch, file_job, portal_job  # scripts/core (put on sys.path by download_sources.py)

OFGL = "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets"
DGFIP = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets"

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




JOBS = [portal_job(folder, ds, base, params, credit, purpose) for folder, ds, base, params, credit, purpose in SOURCES]
JOBS += [file_job(folder, ds, url, title, page, credit, purpose, encoding="latin-1" if folder == "elections" else "utf-8-sig")
         for folder, ds, url, title, page, credit, purpose in FILES]
JOBS.append({**portal_job("ofgl", "ofgl-base-communes-consolidee-archives", OFGL, {}, "OFGL, d'après DGFiP",
                          "Consolidated commune accounts 2012-2017 (yearly national archives), filtered on 972."),
             "url": ARCHIVE_URL.format(year="{2012..2017}"),
             "title": lambda: "Comptes consolidés des communes 2012-2017 (archives)",
             "page": "https://data.ofgl.fr/explore/dataset/ofgl-base-communes-consolidee/",
             "fetcher": fetch_archives})

# --- Past mayors (cards: "Trois mandats comparés") ---------------------------------------------------------------------
# The RNE files on data.gouv.fr only hold the CURRENT mayors. Every version ever published keeps its own dated address on
# static.data.gouv.fr; older ones were removed from data.gouv.fr, but the Internet Archive kept a copy of that same
# address. Each version names every mayor in office with the date their function started, so successive versions give
# the mayors of 2014-2020 (as of Jan 2020) and of 2020-2026, including changes during the term.
RNE_STATIC = "https://static.data.gouv.fr/resources/repertoire-national-des-elus-1/"
RNE_VERSIONS = [  # (path under RNE_STATIC, Internet Archive capture used when data.gouv.fr no longer serves the file)
    ("20200114-183638/9-rne-maires.txt", "20200629074355"),
    ("20201202-174954/9-rne-maires.txt", "20201217105538"),
    ("20210809-115402/rne-maires.csv", "20210812040245"),
    ("20211202-135002/maires.csv", "20211220130032"),
    ("20220504-105810/rne-maires.csv", "20220619104256"),
    ("20220913-182110/rne-maires.csv", "20220921190304"),
    ("20221216-172042/rne-maire.csv", "20230127044741"),
    ("20230606-155740/elus-maire.csv", "20230730100130"),
    ("20240730-125205/elus-maires.csv", "20240808021231"),
    ("20241031-095338/elus-maires-mai.csv", "20241203193957"),
    ("20250613-142903/elus-maires-mai.csv", "20250628135645"),
    ("20251223-104211/elus-maires-mai.csv", "20251231134534"),
]
HISTORY_FIELDS = ["version", "file_url", "fetched_from", "insee", "nom", "prenom", "sexe", "debut_mandat", "debut_fonction"]


def _norm(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def _date(s):
    """ISO date from the formats used over the years (d/m/Y, d/m/y, Y-m-d, 'Y-m-d 00:00:00+00')."""
    s = s.strip()
    s = s[:10] if s[:4].isdigit() else s
    for f in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.datetime.strptime(s, f).date().isoformat()
        except ValueError:
            pass
    return s


def _martinique_mayors(raw):
    """Martinique rows of one RNE mayors file, whatever the year's format (gzip, latin-1/utf-8, tab/semicolon)."""
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    lines = text.splitlines()
    start = next(i for i, line in enumerate(lines[:5]) if "commune" in _norm(line))
    delim = "\t" if lines[start].count("\t") > lines[start].count(";") else ";"
    reader = csv.reader(lines[start:], delimiter=delim)
    hdr = [_norm(h) for h in next(reader)]

    def col(*words):
        return next(i for i, h in enumerate(hdr) if all(w in h for w in words))
    c_dep, c_com = col("code", "depart"), col("code", "commune")
    c_nom, c_pre, c_sex = col("nom", "elu"), col("prenom"), col("sexe")
    c_man, c_fon = col("debut", "mandat"), col("debut", "fonction")
    for r in reader:
        if len(r) <= max(c_fon, c_com):
            continue
        code = r[c_com].strip()
        if r[c_dep].strip() not in ("972", "ZB") and not code.startswith("972"):
            continue
        yield {"insee": code if len(code) == 5 else "972" + code.zfill(3)[-2:], "nom": r[c_nom].strip(),
               "prenom": r[c_pre].strip(), "sexe": r[c_sex].strip(), "debut_mandat": _date(r[c_man]),
               "debut_fonction": _date(r[c_fon])}


def fetch_rne_history(dest):
    with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
        w = csv.DictWriter(out, HISTORY_FIELDS, delimiter=";")
        w.writeheader()
        for path, capture in RNE_VERSIONS:
            url = RNE_STATIC + path
            with tempfile.TemporaryDirectory() as tmp:
                f = pathlib.Path(tmp) / "rne"
                try:
                    fetch(url, f, tries=1)
                    used = url
                except Exception:  # removed from data.gouv.fr: the Internet Archive copy of the same address
                    used = f"https://web.archive.org/web/{capture}id_/{url}"
                    fetch(used, f)
                rows = list(_martinique_mayors(f.read_bytes()))
            print(f"     {path[:8]}: {len(rows)} Martinique mayors ({'data.gouv.fr' if used == url else 'Internet Archive'})")
            if len(rows) != 34:
                raise SystemExit(f"RNE version {path}: expected 34 Martinique mayors, got {len(rows)}")
            v = path[:8]
            for r in rows:
                w.writerow({"version": f"{v[:4]}-{v[4:6]}-{v[6:]}", "file_url": url, "fetched_from": used, **r})
    dest.with_suffix(".part").replace(dest)


# 2008 municipal results, communes of 3,500 inhabitants or more (Ministry of the Interior, published on data.gouv.fr in
# 2013 as .xls). Kept: Martinique lists (head of list, seats won), both rounds. Needs `xlrd` (python -m pip install xlrd).
MUNI_2008_URL = "https://static.data.gouv.fr/18/22c3d2b3c8e3abb0fb447515ce23ad4858ad8b3522749d9924acc218f7b7a9.xls"


def fetch_municipales_2008(dest):
    import xlrd  # only needed for this source
    with tempfile.TemporaryDirectory() as tmp:
        x = pathlib.Path(tmp) / "m08.xls"
        fetch(MUNI_2008_URL, x)
        book = xlrd.open_workbook(str(x))
        with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
            w = csv.writer(out, delimiter=";")
            w.writerow(["tour", "insee", "commune", "nuance", "sexe", "nom", "prenom", "liste", "sieges", "voix"])
            for name, tour in (("Tour 1", 1), ("Tour 2", 2)):
                sheet = book.sheet_by_name(name)
                hdr = [str(h).strip() for h in sheet.row_values(0)]
                first = hdr.index("Code Nuance")
                size = hdr.index("Code Nuance", first + 1) - first
                block = hdr[first:first + size]
                ix = {k: block.index(k) for k in ("Code Nuance", "Sexe", "Nom", "Prénom", "Liste", "Sieges", "Voix")}
                for r in range(1, sheet.nrows):
                    v = sheet.row_values(r)
                    if str(v[0]).strip() != "ZB":
                        continue
                    insee = "972" + str(int(float(v[2])))[-2:]
                    for b in range(first, len(v) - size + 1, size):
                        cell = v[b:b + size]
                        if not str(cell[ix["Nom"]]).strip():
                            continue
                        w.writerow([tour, insee, v[3], cell[ix["Code Nuance"]], cell[ix["Sexe"]], cell[ix["Nom"]],
                                    cell[ix["Prénom"]], cell[ix["Liste"]], int(float(cell[ix["Sieges"]] or 0)),
                                    int(float(cell[ix["Voix"]] or 0))])
    dest.with_suffix(".part").replace(dest)


JOBS += [
    {**file_job("rne", "rne-maires-historique", RNE_STATIC,
                "Répertoire national des élus — maires, versions publiées de 2020 à 2025 (Martinique)",
                "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/", "Ministère de l'Intérieur, RNE",
                "Mayors in office at each published version of the RNE (Jan 2020 to Dec 2025), Martinique rows only. "
                "Versions no longer on data.gouv.fr are read from the Internet Archive copy of the same address "
                "(column fetched_from)."),
     "url": RNE_STATIC + "{" + ",".join(p for p, _ in RNE_VERSIONS) + "}", "fetcher": fetch_rne_history,
     "encoding": "utf-8"},
    {**file_job("elections", "municipales-2008", MUNI_2008_URL,
                "Élections municipales 2008 — résultats (communes de 3 500 habitants et plus)",
                "https://www.data.gouv.fr/datasets/elections-municipales-2008-resultats-572150/", "Ministère de l'Intérieur",
                "2008 results, rounds 1 and 2, Martinique lists only (head of list, seats). Used for the 2008-2014 mayors."),
     "fetcher": fetch_municipales_2008, "encoding": "utf-8"},
    file_job("rne", "maires-sortants-2026",
             "https://static.data.gouv.fr/resources/elections-municipales-2026-maires-et-conseillers-municipaux-sortants/"
             "20260302-101708/mun2026-maires-sortants-20260227.csv",
             "Élections municipales 2026 — maires sortants au 27 février 2026",
             "https://www.data.gouv.fr/datasets/elections-municipales-2026-maires-et-conseillers-municipaux-sortants/",
             "Ministère de l'Intérieur",
             "Outgoing mayors at 27 Feb 2026 (last mayors of the 2020-2026 term). National file; filtered on 972 at import.",
             encoding="utf-8"),
]
