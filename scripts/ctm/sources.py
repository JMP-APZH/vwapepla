"""Open-data sources of the ctm domain (B3), downloaded by scripts/core/download_sources.py --domain ctm.

JOBS: one dict per dataset (see scripts/core/fetching.py for the fields). Files land in data/raw/ctm/<folder>/ and are
listed in data/raw/ctm/manifest.json.

Who is who (checked on the portals, 3 Nov 2026):
- CTM (Collectivité Territoriale de Martinique), SIREN 200055507, since 1 Jan 2016. OFGL files it with the regions
  (reg_code 02, categ CTU); DGFiP files it with the départements (ndept 103).
- Before 2016: Région Martinique (SIREN 239720014) and Département de la Martinique (SIREN 229720016).
"""
import csv, html, pathlib, re, time, urllib.parse, urllib.request

from fetching import LICENCE, fetch, file_job, portal_job, portal_title  # scripts/core (put on sys.path by download_sources.py)

NO_LICENCE = "aucune licence indiquée"  # what the source states; never assume Licence Ouverte

OFGL = "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets"
DGFIP = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets"

CTM, REGION, DEPARTEMENT = "200055507", "239720014", "229720016"
SIRENS = f'siren in ("{CTM}","{REGION}","{DEPARTEMENT}")'

# DGFiP balances with the nature x function presentation: one dataset per year, ids as published.
NATURE_FONCTION = {
    2012: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec5",
    2013: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec4",
    2014: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec3",
    2015: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec2",
    2016: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec1",
    2017: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec-",
    2018: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec0",
    2019: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec6",
    2020: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec7",
    2021: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec8",
    2022: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-2022",
    2023: "balances-comptables-des-collectivites-et-des-epl-avec-fonction-2023",
    2024: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec-la-presentation-croisee-nature-fonction-2024",
    2025: "balances-comptables-des-collectivites-et-des-etablissements-publics-locaux-avec-la-presentation-croisee-nature-fonction-2025",
}

# (folder, dataset_id, portal base, export params, credit, purpose)
SOURCES = [
    # --- CTM accounts (aggregates) ---
    ("ofgl", "ofgl-base-regions-consolidee", OFGL, {"where": 'reg_code="02"'}, "OFGL, d'après DGFiP",
     "Regions and CTU accounts, main + annex budgets consolidated. CTM 2016-2025 (CTU) + Région Martinique 2012-2015. "
     "Primary card source."),
    ("ofgl", "ofgl-base-regions", OFGL, {"where": 'reg_code="02"'}, "OFGL, d'après DGFiP",
     "Same, per budget (principal, Laboratoire, Irrigation UGPISE, NTIC Très haut débit), for drill-down."),
    ("ofgl", "ofgl-base-departements-consolidee", OFGL, {"where": 'dep_code="972"'}, "OFGL, d'après DGFiP",
     "Département de la Martinique accounts 2012-2015 (merged into the CTM in 2016)."),
    ("ofgl", "populations-ofgl-regions", OFGL, {"where": 'reg_code="02"'}, "OFGL, d'après INSEE",
     "Population used by OFGL for per-inhabitant values."),
    ("ofgl", "dotations-regions", OFGL, {"where": 'code_region="02"'}, "OFGL, d'après DGCL",
     "Equalisation and DILICO of regions (CTM)."),
    # --- CTM satellites (own accounts) ---
    ("ofgl", "ofgl-base-epl-consolidee", OFGL, {"where": 'dep_code="972"'}, "OFGL, d'après DGFiP",
     "Public bodies of Martinique (EPA, EPIC, GIP): Martinique Transport, Office de l'eau, IMFPA, Abattoirs... "
     "Link to the CTM to be checked body by body."),
    ("ofgl", "ofgl-base-syndicats-consolidee", OFGL, {"where": 'dep_current_code="972"'}, "OFGL, d'après DGFiP",
     "Syndicats of Martinique (PNR, SMTVD, Syndicat mixte de transport, SMEM), CTM membership to be checked."),
    # --- Method ---
    ("ofgl", "methodologie-ofgl-formules-des-agregats-financiers", OFGL,
     {"where": 'type_collectivite in ("Régions","Départements")'}, "OFGL",
     "Account-level formula of every aggregate (regions and départements)."),
    ("ofgl", "methodologie-ofgl-definitions-agregats-financiers", OFGL, {}, "OFGL", "Aggregate definitions."),
    ("ofgl", "nomenclatures-budgetaires", OFGL, {"where": 'nomenclature like "M57%" and annee>=date\'2016\''}, "OFGL",
     "M57 chart of accounts labels per year (e.g. 73432 = Octroi de mer régional)."),
    # --- Account-level detail ---
    ("dgfip", "balances-comptables-des-departements", DGFIP, {"where": f'siren="{CTM}"'}, "DGFiP",
     "CTM account-level balances 2019-2025, all budgets (principal + annexes)."),
    *[("dgfip", ds, DGFIP, {"where": SIRENS}, "DGFiP",
       f"Account-level balances {y} with nature x function (CTM, or Région + Département before 2016).")
      for y, ds in NATURE_FONCTION.items()],
]

# Files published as a whole (national, filtered at import): (folder, id, stable url, title, page, credit, purpose).
FILES = [
    ("rne", "rne-membres-assemblees", "https://www.data.gouv.fr/datasets/r/a595be27-cfab-4810-b9d4-22e193bffe35",
     "Répertoire national des élus — membres des assemblées des collectivités à statut particulier",
     "https://www.data.gouv.fr/datasets/repertoire-national-des-elus-1/", "Ministère de l'Intérieur, RNE",
     "Members of the Assemblée de Martinique (section, start of mandate, function). National file; 972 at import. "
     "Holds only part of the Conseil exécutif."),
]

# --- Index of the acts published on collectivitedemartinique.mq (WordPress Download Manager listings) -----------------
# One CSV row per act: number, title, download page. The PDFs themselves are not fetched in this sprint.
SITE = "https://www.collectivitedemartinique.mq"
LISTINGS = {
    "ctm-deliberations-assemblee": ("/downloads/deliberations-de-lassemblee-de-martinique/",
                                    "Délibérations de l'Assemblée de Martinique",
                                    "Index of the Assemblée's délibérations (number, title, PDF page)."),
    "ctm-arretes-deliberes-ce": ("/downloads/arretes-deliberes-du-president-du-conseil-executif/",
                                 "Arrêtés délibérés du Président du Conseil exécutif",
                                 "Index of the Conseil exécutif's deliberated orders (number, title, PDF page)."),
}
UA = "vwapepla.org open-data indexer (civic transparency, Martinique)"
ITEM = re.compile(r'<h3[^>]*><a[^>]*href="(?P<page>[^"]+)"[^>]*>(?P<title>.*?)</a></h3>\s*'
                  r'<div class="text-muted text-small"><i class="fas fa-hdd"></i>\s*(?P<size>[^<]*?)\s*<i', re.S)
WPDM_ID = re.compile(r"wpdmdl=(\d+)")
NUMBER = re.compile(r"(?<![0-9])([0-9]{2}-[0-9]{1,4}-[0-9]+)")  # first "YY-NNN-K" in the title ("n°26-1-1", "délib 26-1-1", "Delib-23-2-1")


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001  (network hiccups: retry with backoff)
            if i == 2:
                raise
            print(f"   retry {i + 1} after error: {e}")
            time.sleep(5 * (i + 1))


def listing_fetcher(path):
    def fetch_index(dest):
        rows, seen, page = [], set(), 1
        while True:
            body = _get(f"{SITE}{path}" + (f"?cp={page}" if page > 1 else ""))
            items = list(ITEM.finditer(body))
            new = [m for m in items if m["page"] not in seen]
            if not new:
                break
            for m in new:
                seen.add(m["page"])
                title = html.unescape(re.sub(r"<[^>]+>", "", m["title"])).strip()
                block = body[m.end():m.end() + 2000]
                wpdm = WPDM_ID.search(block)
                num = NUMBER.search(title)
                rows.append([num[1] if num else "", title, m["page"], wpdm[1] if wpdm else "", m["size"].strip(), page])
            if page % 20 == 0:
                print(f"     page {page}: {len(rows)} acts", flush=True)
            page += 1
            time.sleep(1)  # polite: one request per second
        with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["numero", "titre", "page_url", "wpdm_id", "taille", "page_liste"])
            w.writerows(rows)
        dest.with_suffix(".part").replace(dest)
        print(f"     {len(rows)} acts on {page - 1} pages")
    return fetch_index


# --- Before the CTM: DGFiP "comptes individuels" 2008-2011 (main budget only; OFGL starts in 2012) -----------------
# One dataset per year (2011 and 2012 share one), filtered on the budget label ("REG MARTINIQUE" / "DEP MARTINIQUE").
for kind, label in (("regions", "Région"), ("departements", "Département")):
    for years in ("2008", "2009", "2010", "2011-2012"):
        SOURCES.append(("dgfip", f"comptes-individuels-des-{kind}-fichier-global-{years}", DGFIP,
                        {"where": 'lbudg like "MARTINIQUE"'}, "DGFiP",
                        f"{label} Martinique {years}, main budget only (summary lines and ratios). Pre-2012 history; "
                        "2012 overlaps OFGL and is used to check the join."))

# --- Elections (Ministère de l'Intérieur, data.gouv.fr). National files, kept whole; Martinique selected at import ----
# (folder, id, url, title, page, purpose). The xls/xlsx files are converted to a ';' CSV (one "feuille" column + the
# cells) by ministry_fetcher; the original file is kept next to it with its sha256 in <file>.source.json.
DG = "https://www.data.gouv.fr/datasets"
ELECTIONS = [
    ("elections", "elections-regionales-2004-resultats-572139",
     "https://static.data.gouv.fr/97/4fb8c291dfaa82ebc74ee253c28ea1c937dbe7d63bda03fd4a16f2a6b99890.xls",
     "Elections régionales 2004 – Résultats (par régions… et liste des élus)",
     "Conseil régional 2004-2010: list results and elected councillors."),
    ("elections", "elections-regionales-2010-resultats-572146",
     "https://static.data.gouv.fr/2a/c08b6cecd4d266b84e0b0d57ac3aaf06e06a89d0f034dbc297bb5d0c81df14.xls",
     "Elections régionales 2010 – Résultats (par régions… et liste des élus)",
     "Conseil régional 2010-2015: list results and elected councillors."),
    ("elections", "elections-cantonales-2004-resultats-572045",
     "https://static.data.gouv.fr/24/3e463e02def1d6b581092bf8c02783222832b4c2c2094cb2c23136ca10b350.xls",
     "Elections cantonales 2004 – Résultats (par régions… et liste des élus)",
     "Conseil général, half renewed in 2004: results by canton and elected councillors."),
    ("elections", "elections-cantonales-2008-resultats-572049",
     "https://static.data.gouv.fr/b9/a40c29e78c4d2f7720665671e6a5c972094dc492b13e6d2de740dce2fcc937.xls",
     "Elections cantonales 2008 – Résultats (par régions… et liste des élus)",
     "Conseil général, half renewed in 2008: results by canton and elected councillors."),
    ("elections", "elections-cantonales-2011-resultats-572053",
     "https://static.data.gouv.fr/34/2a57a8195976f4406c9d73ebab3cc506084617616da83b033edfd6d2ecfad9.xls",
     "Elections cantonales 2011 – Résultats (par régions… et liste des élus)",
     "Conseil général, half renewed in 2011 (last before the CTM): results by canton and elected councillors."),
    ("elections", "elections-regionales-2015-et-des-assemblees-de-corse-de-guyane-et-de-martinique-candidatures-1er-tour",
     "https://static.data.gouv.fr/resources/elections-regionales-2015-et-des-assemblees-de-corse-de-guyane-et-de-martinique-candidatures-1er-tour/20151110-192107/Reg_15_Candidatures_T1.xlsx",
     "Elections régionales 2015 et des assemblées de Corse, de Guyane et de Martinique – Candidatures 1er tour",
     "First CTM assembly (Dec 2015): candidate lists, round 1."),
    ("elections", "elections-regionales-2015-et-des-assemblees-de-corse-de-guyane-et-de-martinique-candidatures-2eme-tour",
     "https://static.data.gouv.fr/resources/elections-regionales-2015-et-des-assemblees-de-corse-de-guyane-et-de-martinique-candidatures-2eme-tour/20151209-160248/Reg_15_Candidatures_T2.xlsx",
     "Elections régionales 2015 et des assemblées de Corse, de Guyane et de Martinique – Candidatures 2ème tour",
     "First CTM assembly: candidate lists, round 2 (after mergers). With the results, gives the list of each councillor."),
    ("elections", "elections-regionales-2015-et-des-assemblees-de-corse-de-guyane-et-de-martinique-resultats-tour-1-1",
     None, "Elections régionales 2015 et des assemblées de Corse, de Guyane et de Martinique – Résultats tour 1",
     "First CTM assembly: results round 1."),
    ("elections", "elections-regionales-2015-et-des-assemblees-de-corse-de-guyane-et-de-martinique-resultats-tour-2-1",
     None, "Elections régionales 2015 et des assemblées de Corse, de Guyane et de Martinique – Résultats tour 2",
     "First CTM assembly: results round 2 (seats per list)."),
    ("elections", "elections-regionales-2021-candidatures-au-1er-tour",
     "https://static.data.gouv.fr/resources/elections-regionales-2021-candidatures-au-1er-tour/20210519-120334/livre-des-listes-et-candidats-reg-t1-france-entiere-2021-05-18-clean.txt",
     "Elections régionales 2021 – Candidatures au 1er tour",
     "Current CTM assembly (Jun 2021): candidate lists, round 1. Round-2 lists (after mergers) are not on data.gouv.fr. "
     "Licence not specified on data.gouv.fr."),
    ("elections", "elections-regionales-2021-resultats-du-1er-tour-1", None,
     "Elections régionales 2021 – Résultats du 1er tour",
     "Current CTM assembly: results round 1, territory level (Martinique = code 02). Licence not specified."),
    ("elections", "elections-regionales-2021-resultats-du-2eme-tour", None,
     "Elections Régionales 2021 – résultats du 2ème tour",
     "Current CTM assembly: results round 2, territory level, seats per list (source of 'élu(e) sur la liste X'). "
     "Licence not specified."),
]
# Resources picked by file name when the dataset holds several (None above = resolved from the data.gouv.fr API).
RESOURCE = {"elections-regionales-2021-resultats-du-1er-tour-1": "resultats-par-niveau-reg-t1-france-entiere.txt",
            "elections-regionales-2021-resultats-du-2eme-tour": "resultats-par-niveau-reg-t2-france-entiere.txt"}


def resource_url(ds):
    """Stable URL of the dataset's resource (the only one, or the one named in RESOURCE)."""
    import json
    with urllib.request.urlopen(f"https://www.data.gouv.fr/api/1/datasets/{ds}/", timeout=60) as r:
        res = json.load(r)["resources"]
    if ds in RESOURCE:
        res = [x for x in res if x["title"] == RESOURCE[ds] or x["url"].endswith(RESOURCE[ds])]
    if len(res) != 1:
        raise RuntimeError(f"{ds}: expected 1 resource, found {len(res)}")
    return res[0]["url"]


def _cell(v):
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return "" if v is None else str(v)


def _table(path):
    """(sheet, row) pairs from a txt (';'), xls or xlsx file."""
    ext = path.suffix.lower()
    if ext == ".txt":
        data = path.read_bytes()
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("cp1252")
        lines = text.splitlines()
        head = lines[0] if lines else ""
        sep = "\t" if head.count("\t") > head.count(";") else ";"  # 2021 candidatures: tab; 2021 results: ';'
        for row in csv.reader(lines, delimiter=sep):
            yield "", row
    elif ext == ".xls":
        import xlrd
        book = xlrd.open_workbook(str(path), on_demand=True)
        for name in book.sheet_names():
            sh = book.sheet_by_name(name)
            for i in range(sh.nrows):
                yield name, [_cell(v) for v in sh.row_values(i)]
            book.unload_sheet(name)
    else:
        import openpyxl
        book = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
        for ws in book.worksheets:
            for row in ws.iter_rows(values_only=True):
                yield ws.title, [_cell(v) for v in row]
        book.close()


def ministry_fetcher(ds, url):
    def fetch_file(dest):
        import hashlib, json
        src = url or resource_url(ds)
        ext = pathlib.PurePosixPath(urllib.parse.urlparse(src).path).suffix.lower()
        orig = dest.with_name(dest.stem + "_source" + ext)
        fetch(src, orig)
        tmp = dest.with_suffix(".part")
        with open(tmp, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["feuille", "cellules..."])
            for sheet, row in _table(orig):
                w.writerow([sheet, *row])
        tmp.replace(dest)
        meta = {"source_url": src, "source_file": orig.name, "bytes": orig.stat().st_size,
                "sha256": hashlib.sha256(orig.read_bytes()).hexdigest()}
        dest.with_suffix(".source.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        print(f"     original kept: {orig.name} ({meta['bytes']} bytes)")
    return fetch_file


# HATVP open list of declarations (Licence Ouverte 2.0, stated on hatvp.fr/open-data). National, CTM rows at import
# (type_mandat "ctsp", departement 972).
FILES.append(("hatvp", "hatvp-liste-declarations", "https://www.hatvp.fr/livraison/opendata/liste.csv",
              "HATVP — liste des déclarations publiées (open data)", "https://www.hatvp.fr/open-data/",
              "Haute Autorité pour la transparence de la vie publique",
              "Current CTM officeholders who filed declarations (Président and conseillers exécutifs, Président and "
              "VPs of the Assemblée), with filing dates. Corroborates the Exécutif from the délibérations."))

JOBS = [portal_job(folder, ds, base, params, credit, purpose) for folder, ds, base, params, credit, purpose in SOURCES]
JOBS += [file_job(folder, ds, url, title, page, credit, purpose) for folder, ds, url, title, page, credit, purpose in FILES]
JOBS += [{"folder": "actes", "id": ds, "url": f"{SITE}{path}", "title": (lambda t=title: t), "page": f"{SITE}{path}",
          "credit": "Collectivité Territoriale de Martinique", "purpose": purpose, "scope": "", "encoding": "utf-8",
          "fetcher": listing_fetcher(path), "licence": NO_LICENCE}
         for ds, (path, title, purpose) in LISTINGS.items()]
JOBS += [{"folder": folder, "id": ds, "url": url or f"{DG}/{ds}/", "title": (lambda t=title: t), "page": f"{DG}/{ds}/",
          "credit": "Ministère de l'Intérieur", "purpose": purpose, "scope": "", "encoding": "utf-8",
          "fetcher": ministry_fetcher(ds, url),
          "licence": NO_LICENCE if "2021" in ds else LICENCE}  # 2021 datasets: licence "non spécifiée" on data.gouv.fr
         for folder, ds, url, title, purpose in ELECTIONS]

# M57 functional nomenclature (area codes and official labels), as published by OFGL in its functional base of the
# départements (the CTM is not in that base; only the labels are taken). Used for spending by area.
_FONC = "ofgl-base-departements-fonctionnelle"
JOBS += [{"folder": "ofgl", "id": "ofgl-fonctions-m57-libelles",
          "url": f"{OFGL}/{_FONC}/exports/csv?" + urllib.parse.urlencode(
              {"select": "fonction,nom_fonction", "group_by": "fonction,nom_fonction", "where": 'nomen like "M57"',
               "delimiter": ";"}),
          "title": lambda: portal_title(OFGL, _FONC), "page": "https://data.ofgl.fr/explore/dataset/" + _FONC + "/",
          "credit": "OFGL", "purpose": "Codes and labels of the M57 functional nomenclature (spending by area).",
          "scope": "", "encoding": "utf-8-sig", "fetcher": None}]

# --- Documents archived as published (PDF) ---------------------------------------------------------------------------
JOBS += [file_job("crc", "crc-ctm-2026-rapport-observations-definitives",
                  "https://www.ccomptes.fr/sites/default/files/2026-09/RAN2026-0326A.pdf",
                  "Chambre régionale des comptes Martinique — Collectivité territoriale de Martinique, rapport "
                  "d'observations définitives, exercices 2021 et suivants (délibéré le 10 juin 2026)",
                  "https://www.ccomptes.fr/", "Chambre régionale des comptes",
                  "Benchmark for the reconciliation (CAF brute, debt, fiscalité ultramarine 734, satellites).",
                  licence=NO_LICENCE, ext="pdf")]

# Comptes administratifs of the main budget, as voted by the Assemblée (PDF as published on the CTM's website).
# (year, délibération, WordPress Download Manager id, download page). Used for check R6 (CA vs OFGL).
CA = [(2022, "23-418-1", 26834, "delib-n23-418-1-adoption-du-compte-administratif-exercice-2022"),
      (2023, "24-97-1", 15152, "delib-n24-97-1-compte-administratif-2023-budget-principal-2"),
      (2024, "25-148-1", 24021, "delib-n25-148-1-compte-administratif-de-la-ctm-annee-2024"),
      (2025, "26-147-1", 31906, "delib-n26-147-1-compte-administratif-2025-budget-principal")]
JOBS += [file_job("ca", f"ctm-ca-{year}", f"{SITE}/?wpdmdl={wpdm}",
                  f"Délibération n° {delib} — compte administratif {year}, budget principal de la CTM",
                  f"{SITE}/download/{slug}/", "Collectivité Territoriale de Martinique",
                  f"Compte administratif {year} (budget principal) voted by the Assemblée: check R6 against OFGL.",
                  licence=NO_LICENCE, ext="pdf") for year, delib, wpdm, slug in CA]

# Not archived (5 Nov 2026): the convocation decrees 2015-939 and 2021-483 and the loi 2021-191 (end of the 2021 term,
# March 2028). Their copies on prefecture sites answer HTTP 401 to scripted downloads; to add from Légifrance.
# Election dates come from the Ministry datasets (description of the 2015 round-2 file: "… du 13 décembre 2015").
