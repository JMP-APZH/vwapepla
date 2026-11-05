"""Open-data sources of the prefet domain (B4), downloaded by scripts/core/download_sources.py --domain prefet.

JOBS: one dict per dataset (see scripts/core/fetching.py for the fields). Files land in data/raw/prefet/<folder>/ and
are listed in data/raw/prefet/manifest.json.

Only tabular open data (Licence Ouverte 2.0) is downloaded for now: the shared engine writes CSV files and a fixed
licence. Document sources (JORF decrees, recueils des actes administratifs, DPT Outre-mer, CCT, BQP, Cour des comptes,
IEDOM) are inventoried in docs/branches/B4-DISCOVERY.md and wait for the proposed engine change (non-CSV files, per-job
licence).

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
