"""Open-data sources of the prefet domain (B4), downloaded by scripts/core/download_sources.py --domain prefet.

JOBS: one dict per dataset (see scripts/core/fetching.py for the fields). Files land in data/raw/prefet/<folder>/ and
are listed in data/raw/prefet/manifest.json.

The shared engine writes CSV files under one licence (Licence Ouverte 2.0), so every job here produces a CSV: tabular
open data filtered on Martinique, and the Martinique table extracted from each DPT Outre-mer PDF (the PDF URL is kept
in the manifest). Other document sources (recueils des actes administratifs, CCT, BQP...) are inventoried in
docs/branches/B4-DISCOVERY.md and wait for the proposed engine change (non-CSV files, per-job licence).

National files are streamed and filtered on Martinique (département 972, région 02) so that data/raw/prefet/ only holds
Martinique rows, written with the same columns and ';' separator as published.
"""
import csv, gzip, io, pathlib, sys, tempfile

from fetching import fetch, file_job  # scripts/core, on sys.path via download_sources.py; fetch checks completeness

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # legifrance.py (python -I drops the script dir)

# data.gouv.fr /datasets/r/<resource id> redirects to the file of that resource.
DATAGOUV_R = "https://www.data.gouv.fr/datasets/r/"

SSMSI_PAGE = ("https://www.data.gouv.fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-"
              "delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales/")
DGCL_PAGE = ("https://www.data.gouv.fr/datasets/projets-finances-par-les-dotations-de-soutien-a-linvestissement-des-"
             "collectivites-territoriales/")
SSMSI_CREDIT = "SSMSI, ministère de l'Intérieur (police et gendarmerie nationales)"
DGCL_CREDIT = "DGCL, ministère de l'Intérieur"

# DGCL: one CSV resource per financial year (DETR, DSIL, DSID, DPV... granted by the préfet).
DGCL_YEARS = {
    2018: "04980dee-40ba-4a8e-8d96-28a905cfd5b6",
    2019: "f17ae4d4-a9a4-4a6f-9c90-e55f40ecbc2d",
    2020: "64de3c69-2ec4-41ab-9a29-c0a5dab05e27",
    2021: "e117e1a6-487d-4172-aab3-483d9e1ea39a",
    2022: "2432d03a-d0bd-4796-b7b6-f248b2262417",
    2023: "d9e762ae-2f9d-433f-a4de-919785803db8",
    2024: "ba15fc37-9096-4a09-88c4-93215f91848d",
    2025: "e621419d-cef9-4460-b148-16a9be8b9149",
}


def filtered(url, keep, gz=False):
    """Fetcher: download `url` to a temporary file, keep the rows where keep(header, row) is true, write `dest`."""
    def fetcher(dest):
        with tempfile.TemporaryDirectory() as tmp:
            src = pathlib.Path(tmp) / "src"
            fetch(url, src)
            raw = gzip.open(src, "rb") if gz else open(src, "rb")
            kept = 0
            with raw, io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as f, \
                    open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
                reader = csv.reader(f, delimiter=";")
                header = next(reader)
                writer = csv.writer(out, delimiter=";")
                writer.writerow(header)
                for row in reader:
                    if keep(header, row):
                        writer.writerow(row)
                        kept += 1
            dest.with_suffix(".part").replace(dest)
            print(f"     {kept} rows kept")
    return fetcher


INSEE_BDM = "https://bdm.insee.fr/series/sdmx/data/SERIES_BDM/"
INSEE_SERIES = ["001787729", "001787732", "001787711", "001787714"]  # Martinique all / 15-24, France métro all / 15-24


def insee_fetcher(idbanks):
    """INSEE BDM (SDMX, no key needed) -> one CSV row per observation, values as published."""
    def fetcher(dest):
        import xml.etree.ElementTree as ET
        with tempfile.TemporaryDirectory() as tmp:
            src = pathlib.Path(tmp) / "bdm.xml"
            fetch(INSEE_BDM + "+".join(idbanks), src)
            root = ET.parse(src).getroot()
        n = 0
        with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
            w = csv.writer(out, delimiter=";")
            w.writerow(["idbank", "title_fr", "ref_area", "age", "period", "value", "obs_status", "last_update"])
            for series in root.iter():
                if not series.tag.endswith("Series"):
                    continue
                a = series.attrib
                for obs in series:
                    o = obs.attrib
                    if "OBS_VALUE" in o:
                        w.writerow([a["IDBANK"], a["TITLE_FR"], a["REF_AREA"], a.get("AGE", ""), o["TIME_PERIOD"],
                                    o["OBS_VALUE"], o.get("OBS_STATUS", ""), a.get("LAST_UPDATE", "")])
                        n += 1
        if n == 0:
            raise SystemExit("INSEE BDM: no observation returned")
        dest.with_suffix(".part").replace(dest)
        print(f"     {n} observations")
    return fetcher


def col(header, prefix):
    """Index of the first column whose name starts with `prefix` (SSMSI renames CODGEO_<geography year> every year)."""
    return next(i for i, h in enumerate(header) if h.startswith(prefix))


def is_972_commune(header, row):
    return row[col(header, "CODGEO")].startswith("972")


def is_972_dep(header, row):
    return row[col(header, "Code_departement")] == "972"


def every_region(header, row):
    """All regions: Martinique (02) and the comparisons (other overseas regions, France = sum of the regions)."""
    return True


def is_972_beneficiary(header, row):
    return row[col(header, "beneficiaire_dep")].lstrip("0") == "972"


def job(folder, ds, resource, keep, title, page, credit, purpose, gz=False, scope="_972"):
    url = DATAGOUV_R + resource
    return {**file_job(folder, ds, url, title, page, credit, purpose),
            "scope": scope, "encoding": "utf-8", "fetcher": filtered(url, keep, gz)}


JOBS = [
    # --- Recorded crime (context for State competences: police, gendarmerie) ---
    job("ssmsi", "ssmsi-delinquance-communes", "44ef4323-1097-48d5-8719-3c544b55d294", is_972_commune,
        "Base statistique communale de la délinquance enregistrée par la police et la gendarmerie nationales",
        SSMSI_PAGE, SSMSI_CREDIT,
        "Recorded crime by commune and year since 2016 (counts, rate per 1,000; small counts not released). "
        "National csv.gz, filtered on INSEE 972xx.", gz=True),
    job("ssmsi", "ssmsi-delinquance-departements", "2b27a675-e3bf-41ef-a852-5fb9ab483967", is_972_dep,
        "Base statistique départementale de la délinquance enregistrée par la police et la gendarmerie nationales",
        SSMSI_PAGE, SSMSI_CREDIT, "Recorded crime, département 972, by year since 2016 (incl. homicides, fraud)."),
    job("ssmsi", "ssmsi-delinquance-regions", "75753852-aca0-4c53-bfd4-a29513358d2f", every_region,
        "Base statistique régionale de la délinquance enregistrée par la police et la gendarmerie nationales",
        SSMSI_PAGE, SSMSI_CREDIT, "Recorded crime, every region, by year since 2016: Martinique (02) and comparisons "
        "(Guadeloupe; France = sum of the regions, computed in scripts/prefet/crime.py).", scope=""),
    # --- Unemployment (INSEE, ILO definition, annual average): Martinique and France métropolitaine ---
    {**file_job("insee", "insee-chomage-bit-annuel", INSEE_BDM + "+".join(INSEE_SERIES),
                "Taux de chômage au sens du BIT (moyenne annuelle) — Martinique et France métropolitaine",
                "https://www.insee.fr/fr/statistiques/series/102760732", "Insee, enquête Emploi",
                "Annual ILO unemployment rate, all ages and 15-24, Martinique and France métropolitaine "
                "(INSEE BDM series " + ", ".join(INSEE_SERIES) + ")."),
     "encoding": "utf-8", "fetcher": insee_fetcher(INSEE_SERIES)},
    # --- State investment grants to local authorities (decided by the préfet: DETR, DSIL, DSID, DPV...) ---
    *[job("dgcl", f"dgcl-dotations-investissement-{y}", res, is_972_beneficiary,
          f"Projets financés par les dotations de soutien à l'investissement des collectivités territoriales — {y}",
          DGCL_PAGE, DGCL_CREDIT,
          f"Projects funded in {y} by State investment grants (DETR, DSIL, DSID, DPV...): beneficiary, project, cost, "
          "grant. National CSV, filtered on beneficiaire_dep 972.")
      for y, res in DGCL_YEARS.items()],
]


# --- State credits in Martinique: DPT Outre-mer (annex to each budget bill), table « MARTINIQUE » ---
# budget.gouv.fr serves the DPTs behind a bot-protection page (no scripted access), so the copies deposited at the
# Assemblée nationale are used. Editions before PLF 2025 are not published there (checked 3 Nov 2026).
DPT_EDITIONS = {
    2025: "https://www2.assemblee-nationale.fr/static/17/Annexes-DL/PLF2025-Oranges/04-Orange_Outre-mer.pdf",
    2026: "https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1090079/file/4-DPT2026_OutreMer.pdf",
    2027: "https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1129675/file/4-DPT%202027%20-%20Outre-Mer.pdf",
}
DPT_TERRITORY = "MARTINIQUE"
DPT_COLUMNS = ["execution_ae", "execution_cp", "lfi_ae", "lfi_cp", "plf_ae", "plf_cp"]
# A figure: digits grouped by 3 with a (narrow) space, or a dash for "no credit".
_NUM = r"(?:-?\d{1,3}(?:[   ]\d{3})*|-)"


def dpt_lines(pdf_path):
    """(page number, line) for every line of the PDF, in layout mode (columns kept apart by runs of spaces)."""
    import pypdf  # only needed by the DPT jobs
    for i, page in enumerate(pypdf.PdfReader(str(pdf_path)).pages):
        try:
            text = page.extract_text(extraction_mode="layout")
        except KeyError:  # blank page without a content stream
            continue
        for line in text.splitlines():
            yield i + 1, line.rstrip()


def dpt_rows(lines, edition, territory=DPT_TERRITORY):
    """Rows (page, label, 6 raw figures) of one territory's table.

    The table starts at the line that is exactly the territory name (it can start mid-page, right after the previous
    territory's « Total général ») and ends at its own « Total général ». Rows are blocks of lines separated by blank
    lines: a label can wrap over several lines, with the six figures on any one of them.
    """
    import re
    nums_re = re.compile(rf"(?P<nums>{_NUM}(?:\s{{2,}}{_NUM}){{5}})\s*$")
    lines = list(lines)
    try:
        k = next(j for j, (_, ln) in enumerate(lines) if ln.strip() == territory
                 and any("MISSION / PROGRAMME" in x for _, x in lines[j:j + 15]))
    except StopIteration:
        raise SystemExit(f"DPT {edition}: table « {territory} » not found")
    header = " ".join(x for _, x in lines[k:k + 15])
    for y in (edition - 2, edition - 1, edition):
        if str(y) not in header:
            raise SystemExit(f"DPT {edition}: year {y} missing from the header of table « {territory} »")
    blocks, cur = [], []
    for page, ln in lines[k + 1:]:
        if ln.strip():
            cur.append((page, ln))
            continue
        if cur:
            blocks.append(cur)
            cur = []
        if blocks and blocks[-1][-1][1].strip().lower().startswith("total g"):
            break
    rows = []
    for block in blocks:
        text = " ".join(ln for _, ln in block)
        if "MISSION / PROGRAMME" in text or "EXÉCUTION" in text or "Annexe au projet" in text \
                or "politique transversale" in text:
            continue  # table header (repeated on each page) or page header/footer
        label, nums, page = [], None, block[0][0]
        for pg, ln in block:
            m = nums_re.search(ln)
            if m and nums is None:
                nums, page = re.split(r"\s{2,}", m["nums"].strip()), pg
                ln = ln[:m.start()]
            if ln.strip():
                label.append(ln.strip())
        if nums is None:
            raise SystemExit(f"DPT {edition} p.{page}: row without six figures: {text.strip()[:120]}")
        rows.append([page, " ".join(label), *nums])
        if rows[-1][1].lower().startswith("total g"):
            return rows
    raise SystemExit(f"DPT {edition}: no « Total général » line for « {territory} »")


def dpt_fetcher(edition, url):
    def fetcher(dest):
        with tempfile.TemporaryDirectory() as tmp:
            pdf = pathlib.Path(tmp) / "dpt.pdf"
            fetch(url, pdf)
            rows = dpt_rows(dpt_lines(pdf), edition)
        with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
            w = csv.writer(out, delimiter=";")
            w.writerow(["edition", "page", "label", *DPT_COLUMNS])
            for r in rows:
                w.writerow([edition, *r])
        dest.with_suffix(".part").replace(dest)
        print(f"     {len(rows)} rows (table {DPT_TERRITORY})")
    return fetcher


JOBS += [
    {**file_job("dpt", f"dpt-outre-mer-{e}", url,
                f"Document de politique transversale Outre-mer — annexe au projet de loi de finances pour {e}",
                url, "Ministère des outre-mer (DGOM), annexe au PLF — copie Assemblée nationale",
                f"State credits in Martinique by mission and programme (AE/CP): executed {e - 2}, LFI {e - 1}, PLF {e}. "
                "Table extracted from the PDF (pypdf layout mode); the PDF itself is not kept."),
     "scope": "_972", "encoding": "utf-8", "fetcher": dpt_fetcher(e, url)}
    for e, url in DPT_EDITIONS.items()
]


# --- Appointment decrees (JORF, through the Légifrance API) ----------------------------------------------------------
# Only when the PISTE keys are in .env.local (see scripts/prefet/README.md); otherwise these jobs are skipped.
JORF_POSTS = [  # exact phrases searched in decree titles
    "préfet de la région Martinique", "préfet de région Martinique",
    "secrétaire général de la préfecture de la Martinique", "secrétaire générale de la préfecture de la Martinique",
    "directeur de cabinet du préfet de la région Martinique", "directrice de cabinet du préfet de la région Martinique",
    "sous-préfet de Saint-Pierre", "sous-préfète de Saint-Pierre", "sous-préfet de La Trinité",
    "sous-préfète de La Trinité", "sous-préfet du Marin", "sous-préfète du Marin",
]
JORF_SINCE = "2007-01-01"      # identity-only depth (docs/branches/B4-DISCOVERY.md §8.2)
CAREER_SINCE = "1990-01-01"    # electronic JORF
JORF_FIELDS = ["cid", "query", "title", "nor", "signature_date", "jorf_date", "url", "article_1", "raw_json"]
_NAME = r" - (?P<civ>M\.|Mme) (?P<last>[^()]+?) \((?P<first>[^()]+)\)\s*$"


def piste_keys():
    try:
        from load_supabase import env  # scripts/core, on sys.path
        vals = env()
    except FileNotFoundError:
        return None
    return (vals["PISTE_CLIENT_ID"], vals["PISTE_CLIENT_SECRET"]) if all(vals.get(k) for k in
                                                                      ("PISTE_CLIENT_ID", "PISTE_CLIENT_SECRET")) else None


def jorf_row(client, cid, query):
    import json
    from legifrance import TEXT_URL, plain
    body = client.text(cid)
    articles = body.get("articles") or []
    first = next((a for a in articles if str(a.get("num", "")).strip() in ("1", "1er")), articles[0] if articles else {})
    return {"cid": cid, "query": query, "title": body.get("title") or "", "nor": body.get("nor") or "",
            "signature_date": body.get("dateTexte") or body.get("dateSignature") or "",
            "jorf_date": body.get("dateParution") or body.get("jorfDate") or "", "url": TEXT_URL.format(cid=cid),
            "article_1": plain(first.get("content") or first.get("texte") or ""),
            "raw_json": json.dumps(body, ensure_ascii=False, separators=(",", ":"))}


def write_jorf(dest, rows):
    with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
        w = csv.DictWriter(out, fieldnames=JORF_FIELDS, delimiter=";")
        w.writeheader()
        w.writerows(rows)
    dest.with_suffix(".part").replace(dest)


def fetch_nominations(dest):
    from legifrance import Client, text_cid
    client = Client(*piste_keys())
    found = {}
    for phrase in JORF_POSTS:
        for res in client.search_titles(phrase, start=JORF_SINCE):
            cid = text_cid(res)
            if cid and cid not in found:
                found[cid] = phrase
        print(f"     « {phrase} »: {len(found)} texts so far")
    write_jorf(dest, [jorf_row(client, cid, q) for cid, q in sorted(found.items())])


def fetch_careers(dest):
    """Every appointment decree naming a person found by jorf-nominations-972 (their career path)."""
    import json, re
    from legifrance import Client, text_cid
    root = pathlib.Path(__file__).resolve().parents[2]
    manifest = json.loads((root / "data" / "raw" / "prefet" / "manifest.json").read_text(encoding="utf-8"))
    with open(root / manifest["jorf-nominations-972"]["file"], encoding="utf-8", newline="") as f:
        names = {(m["last"].strip(), m["first"].strip()) for r in csv.DictReader(f, delimiter=";")
                 if (m := re.search(_NAME, r["title"]))}
    client, found = Client(*piste_keys()), {}
    for last, first in sorted(names):
        phrase = f"{last} ({first})"
        for res in client.search_titles(phrase, start=CAREER_SINCE):
            cid = text_cid(res)
            if cid and cid not in found:
                found[cid] = phrase
    print(f"     {len(names)} people, {len(found)} texts")
    write_jorf(dest, [jorf_row(client, cid, q) for cid, q in sorted(found.items())])


def jorf_job(ds, fetcher, title, purpose):
    page = "https://www.legifrance.gouv.fr/jorf/"
    return {**file_job("jorf", ds, "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app", title, page,
                       "Journal officiel de la République française (Légifrance, DILA)", purpose),
            "encoding": "utf-8", "fetcher": fetcher}


if piste_keys():
    JOBS += [
        jorf_job("jorf-nominations-972", fetch_nominations,
                 "Décrets de nomination aux postes de la préfecture de la Martinique (JORF)",
                 f"Appointment decrees for préfet, secrétaire général, directeur de cabinet and sous-préfets in "
                 f"Martinique since {JORF_SINCE[:4]} (Légifrance API search on titles + text)."),
        jorf_job("jorf-parcours", fetch_careers, "Décrets de nomination des personnes concernées (JORF)",
                 "Career path of the people above: every appointment decree naming them since 1990."),
    ]
else:
    print("prefet: PISTE_CLIENT_ID / PISTE_CLIENT_SECRET not in .env.local: JORF jobs skipped "
          "(see scripts/prefet/README.md)")


# --- Recueils des actes administratifs (RAA) of the préfecture: list of acts, from each bulletin's Sommaire -----------
RAA_FROM = 2016  # cut-off validated with JM: postings covered from Dec 2015, acts from 2016


def raa_fetcher(year):
    def fetcher(dest):
        import raa  # scripts/prefet/raa.py
        root = pathlib.Path(__file__).resolve().parents[2]
        folders = raa.year_folders()
        if year not in folders:
            raise SystemExit(f"RAA {year}: no folder on {raa.SITE}{raa.ROOT_PATH}")
        acts, bulletins, problems = raa.index_year(year, folders[year], root / "data" / "raw" / "prefet" / "raa" / "cache",
                                                   fetch)
        fields = ["act_id", "act_date", "service", "title", "pages", "page", "bulletin", "published", "pdf_url",
                  "listing_page"]
        with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
            w = csv.DictWriter(out, fieldnames=fields, delimiter=";")
            w.writeheader()
            w.writerows(acts)
        dest.with_suffix(".part").replace(dest)
        print(f"     {len(bulletins)} bulletins, {len(acts)} acts" + (f", {len(problems)} problems:" if problems else ""))
        for p in problems:
            print(f"       {p}")
    return fetcher


JOBS += [
    {**file_job("raa", f"raa-{y}", f"https://www.martinique.gouv.fr/Publications/Recueils-des-actes-administratifs-publies",
                f"Recueils des actes administratifs de la préfecture de la Martinique — {y}",
                "https://www.martinique.gouv.fr/Publications/Recueils-des-actes-administratifs-publies",
                "Préfecture de la Martinique, recueils des actes administratifs",
                f"Acts published in {y} (number, date, service, title, page), read from the Sommaire of each bulletin. "
                "The bulletins stay on the préfecture's site; each act links to its PDF.",
                licence="Actes administratifs publiés (documents administratifs, réutilisation libre — art. L321-1 CRPA)"),
     "encoding": "utf-8", "fetcher": raa_fetcher(y)}
    for y in range(RAA_FROM, __import__("datetime").date.today().year + 1)
]


# --- Natural disaster recognitions (« arrêtés CatNat »), GASPAR database (Géorisques, ministère de la Transition
# écologique): one zip of national CSVs; only the CatNat table is kept, filtered on the 34 communes of Martinique.
GASPAR_URL = "https://files.georisques.fr/GASPAR/gaspar.zip"


def gaspar_fetcher(dest):
    import zipfile
    with tempfile.TemporaryDirectory() as tmp:
        z = pathlib.Path(tmp) / "gaspar.zip"
        fetch(GASPAR_URL, z)
        with zipfile.ZipFile(z) as zf:
            names = zf.namelist()
            print(f"     zip: {', '.join(names)}")
            name = next(n for n in names if "catnat" in n.lower() and n.lower().endswith(".csv"))
            with zf.open(name) as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
                sample = text.readline()
                delim = ";" if sample.count(";") >= sample.count(",") else ","
                header = next(csv.reader([sample], delimiter=delim))
                code = next(i for i, h in enumerate(header) if h.lower() in ("code_commune", "cod_commune"))
                kept = 0
                with open(dest.with_suffix(".part"), "w", encoding="utf-8", newline="") as out:
                    w = csv.writer(out, delimiter=";")
                    w.writerow(header)
                    for row in csv.reader(text, delimiter=delim):
                        if row and row[code].startswith("972"):
                            w.writerow(row)
                            kept += 1
    dest.with_suffix(".part").replace(dest)
    print(f"     {name}: {kept} Martinique rows kept")


JOBS += [{**file_job("gaspar", "gaspar-catnat", GASPAR_URL,
                     "Base GASPAR — arrêtés de reconnaissance de l'état de catastrophe naturelle (CatNat)",
                     "https://www.data.gouv.fr/datasets/536995eea3a729239d20486b/",
                     "Géorisques, ministère de la Transition écologique (base GASPAR)",
                     "Natural disaster recognitions in the 34 communes of Martinique: event type, dates, decree and "
                     "JO dates. National zip, CatNat table filtered on INSEE 972xx."),
          "scope": "_972", "encoding": "utf-8", "fetcher": gaspar_fetcher}]
