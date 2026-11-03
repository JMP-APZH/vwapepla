"""Open-data sources of the ctm domain (B3), downloaded by scripts/core/download_sources.py --domain ctm.

JOBS: one dict per dataset (see scripts/core/fetching.py for the fields). Files land in data/raw/ctm/<folder>/ and are
listed in data/raw/ctm/manifest.json.

Who is who (checked on the portals, 3 Nov 2026):
- CTM (Collectivité Territoriale de Martinique), SIREN 200055507, since 1 Jan 2016. OFGL files it with the regions
  (reg_code 02, categ CTU); DGFiP files it with the départements (ndept 103).
- Before 2016: Région Martinique (SIREN 239720014) and Département de la Martinique (SIREN 229720016).
"""
import csv, html, re, time, urllib.request

from fetching import file_job, portal_job  # scripts/core (put on sys.path by download_sources.py)

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


JOBS = [portal_job(folder, ds, base, params, credit, purpose) for folder, ds, base, params, credit, purpose in SOURCES]
JOBS += [file_job(folder, ds, url, title, page, credit, purpose) for folder, ds, url, title, page, credit, purpose in FILES]
JOBS += [{"folder": "actes", "id": ds, "url": f"{SITE}{path}", "title": (lambda t=title: t), "page": f"{SITE}{path}",
          "credit": "Collectivité Territoriale de Martinique", "purpose": purpose, "scope": "", "encoding": "utf-8",
          "fetcher": listing_fetcher(path)}
         for ds, (path, title, purpose) in LISTINGS.items()]
