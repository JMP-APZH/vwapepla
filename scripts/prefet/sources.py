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
import csv, gzip, io, pathlib, tempfile, time, urllib.request

from fetching import file_job  # scripts/core (put on sys.path by download_sources.py)

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


def fetch_complete(url, dest, tries=10):
    """Like fetching.fetch, but checks the byte count against Content-Length: a dropped connection can end the stream
    early without an error (seen on the 40 MB SSMSI file on 3 Nov 2026), which would silently truncate the data.
    A short read is resumed with an HTTP Range request from the last byte received."""
    with urllib.request.urlopen(url, timeout=900) as r, open(dest, "wb") as f:
        final_url, expected = r.geturl(), r.headers.get("Content-Length")
        while chunk := r.read(1 << 20):
            f.write(chunk)
    if expected is None:
        return
    expected = int(expected)
    for i in range(tries):
        got = dest.stat().st_size
        if got == expected:
            return
        print(f"   resume {i + 1}: got {got} of {expected} bytes")
        time.sleep(2 * (i + 1))
        req = urllib.request.Request(final_url, headers={"Range": f"bytes={got}-"})
        with urllib.request.urlopen(req, timeout=900) as r, open(dest, "ab") as f:
            if r.status != 206:
                raise SystemExit(f"{url}: server does not resume (HTTP {r.status})")
            while chunk := r.read(1 << 20):
                f.write(chunk)
    if dest.stat().st_size != expected:
        raise SystemExit(f"{url}: incomplete download after {tries} resumes")


def filtered(url, keep, gz=False):
    """Fetcher: download `url` to a temporary file, keep the rows where keep(header, row) is true, write `dest`."""
    def fetcher(dest):
        with tempfile.TemporaryDirectory() as tmp:
            src = pathlib.Path(tmp) / "src"
            fetch_complete(url, src)
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
            print(f"     {kept} Martinique rows kept")
    return fetcher


def col(header, prefix):
    """Index of the first column whose name starts with `prefix` (SSMSI renames CODGEO_<geography year> every year)."""
    return next(i for i, h in enumerate(header) if h.startswith(prefix))


def is_972_commune(header, row):
    return row[col(header, "CODGEO")].startswith("972")


def is_972_dep(header, row):
    return row[col(header, "Code_departement")] == "972"


def is_02_region(header, row):
    return row[col(header, "Code_region")] == "02"


def is_972_beneficiary(header, row):
    return row[col(header, "beneficiaire_dep")].lstrip("0") == "972"


def job(folder, ds, resource, keep, title, page, credit, purpose, gz=False):
    url = DATAGOUV_R + resource
    return {**file_job(folder, ds, url, title, page, credit, purpose),
            "scope": "_972", "encoding": "utf-8", "fetcher": filtered(url, keep, gz)}


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
    job("ssmsi", "ssmsi-delinquance-regions", "75753852-aca0-4c53-bfd4-a29513358d2f", is_02_region,
        "Base statistique régionale de la délinquance enregistrée par la police et la gendarmerie nationales",
        SSMSI_PAGE, SSMSI_CREDIT, "Recorded crime, région 02 (Martinique), by year since 2016."),
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
            fetch_complete(url, pdf)
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
