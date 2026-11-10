"""Build the CTM tables from data/raw/ctm/ into data/build/ctm/<table>.json (one JSON array per Supabase table: core rows
of the CTM + ctm_* tables). Mapping validated by JM on 5 Nov 2026 (docs/branches/B3-MAPPING.md).

Deterministic and idempotent: same raw files -> same output. Run: python -I scripts/ctm/pipeline/build.py
Exit 1 if a check fails: row counts = manifest, OFGL sums (recettes / dépenses de fonctionnement), 51 seats per
election, every 2015 councillor on a list.
Source ids are prefixed 'ctm:' (some OFGL dataset ids are also used, with other filters, by the communes domain).
"""
import collections, csv, json, pathlib, re, sys, unicodedata

HERE = pathlib.Path(__file__).resolve().parent
for d in (HERE, HERE.parent, HERE.parents[1] / "core"):  # python -I drops the script dir; sources.py imports fetching
    sys.path.insert(0, str(d))
from metrics import CI, FUM, METRICS  # noqa: E402
from functions import FIRST_YEAR as FUNC_FROM, area_sums, labels as area_labels  # noqa: E402
from acts import build_acts  # noqa: E402
from ca import LINES as CA_LINES, read_ca  # noqa: E402
from sources import CA as CA_DOCS, FORECAST as FORECAST_DOCS  # noqa: E402
from bp import LINES as BP_LINES, read_bp  # noqa: E402
from octroi import classify as octroi_kinds, read_figures as octroi_figures_from  # noqa: E402
from sources import NATURE_FONCTION  # noqa: E402  (yearly nature-fonction dataset ids)

sys.stdout.reconfigure(encoding="utf-8")
csv.field_size_limit(1 << 30)
ROOT = pathlib.Path(__file__).resolve().parents[3]
RAW, OUT = ROOT / "data" / "raw" / "ctm", ROOT / "data" / "build" / "ctm"
MANIFEST = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
CTM, REGION, DEPARTEMENT = "200055507", "239720014", "229720016"
PROVISIONAL_YEAR = 2025
errors = []


def sid(ds):
    return f"ctm:{ds}"


def table(ds):
    """Raw records (header first) of a downloaded CSV, checked against the manifest row count."""
    m = MANIFEST[ds]
    with open(ROOT / m["file"], encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f, delimiter=";"))
    if len(rows) - 1 != m["rows"]:
        errors.append(f"{ds}: {len(rows) - 1} rows read, manifest says {m['rows']}")
    return rows


def records(ds):
    head, *rows = table(ds)
    return [dict(zip(head, r)) for r in rows]


def num(v):
    v = (v or "").strip().replace(",", ".")
    return float(v) if v not in ("", "-") else None


def fold(s):
    """Name key for matching across files: no accents, upper case, single spaces."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[\s\-']+", " ", s).strip().upper()


# --- sources -------------------------------------------------------------------------------------------------------
sources = [{"id": sid(ds), "title": m["title"], "url": m["url"], "dataset_page": m["dataset_page"],
            "licence": m["licence"], "credit": m["credit"], "retrieved": m["retrieved"], "sha256": m["sha256"],
            "rows": m["rows"], "purpose": m["purpose"], "domain": "ctm"} for ds, m in sorted(MANIFEST.items())]

# --- metric definitions --------------------------------------------------------------------------------------------
metric_defs = [{"key": k, "block": b, "parent_key": p, "label_fr": l, "label_kreyol": None, "source_rule": r,
                "unit": u, "on_card": c, "description_fr": None, "display_order": i + 1}
               for i, (k, b, p, l, r, u, c) in enumerate(METRICS)]
OFGL_KEY = {r[5:]: k for k, _, _, _, r, _, _ in METRICS if r.startswith("ofgl:") and r != "ofgl:ptot"}

# --- actuals: OFGL consolidated 2012-2025 ---------------------------------------------------------------------------
actuals = {}  # (siren, year, key) -> row


def put(siren, year, key, amount, source, scope, bp=None, ba=None, flux=None, per_hab=None):
    actuals[(siren, year, key)] = {
        "entity_siren": siren, "year": year, "metric_key": key, "amount": amount, "amount_bp": bp, "amount_ba": ba,
        "amount_flux": flux, "eur_per_hab": per_hab, "scope": scope,
        "provisional": siren == CTM and year == PROVISIONAL_YEAR, "source_id": sid(source)}


population = {}
for ds, keep in (("ofgl-base-regions-consolidee", (CTM, REGION)), ("ofgl-base-departements-consolidee", (DEPARTEMENT,))):
    for r in records(ds):
        siren, year = r["siren"], int(r["exer"][:4])
        if siren not in keep:
            continue
        if num(r["ptot"]):
            population[(siren, year)] = num(r["ptot"])
        key = OFGL_KEY.get(r["agregat"])
        if key:
            put(siren, year, key, num(r["montant"]), ds, "consolide", num(r["montant_bp"]), num(r["montant_ba"]),
                num(r["montant_flux"]), num(r["euros_par_habitant"]))
for (siren, year), pop in population.items():
    src = "ofgl-base-departements-consolidee" if siren == DEPARTEMENT else "ofgl-base-regions-consolidee"
    put(siren, year, "population", pop, src, "consolide")

# --- actuals: DGFiP comptes individuels 2008-2011 (budget principal, k€) --------------------------------------------
overlap = []  # 2012 in both sources: printed, checked by reconcile.py
for kind, siren in (("regions", REGION), ("departements", DEPARTEMENT)):
    for years in ("2008", "2009", "2010", "2011-2012"):
        ds = f"comptes-individuels-des-{kind}-fichier-global-{years}"
        for r in records(ds):
            year, pop = int(r["exer"]), num(r["mpoid_bp"])
            for key, col in CI.items():
                v = num(r[col[0]]) - num(r[col[1]]) if isinstance(col, tuple) else num(r[col])
                amount = None if v is None else v * 1000
                if year == 2012:
                    overlap.append({"siren": siren, "metric_key": key, "ci": amount,
                                    "ofgl_bp": actuals.get((siren, 2012, key), {}).get("amount_bp")})
                    continue
                put(siren, year, key, amount, ds, "budget_principal",
                    per_hab=round(amount / pop, 2) if amount is not None and pop else None)
            if year != 2012 and pop:
                put(siren, year, "population", pop, ds, "budget_principal")

# --- derived: capacité de désendettement ----------------------------------------------------------------------------
for (siren, year, key), row in list(actuals.items()):
    if key != "encours_dette":
        continue
    eb = actuals.get((siren, year, "epargne_brute"), {}).get("amount")
    value = round(row["amount"] / eb, 1) if row["amount"] is not None and eb and eb > 0 else None
    put(siren, year, "capacite_desendettement", value, row["source_id"][4:], row["scope"])

# --- fiscalité ultramarine: DGFiP balances, budget principal, net credit ---------------------------------------------
fum_sum = collections.defaultdict(float)  # (year, metric, source) -> amount


def add_fum(ds, rows, years):
    for r in rows:
        year = int(r["exer"][:4])
        if r["siren"] != CTM or r["cbudg"] != "1" or r["bal"] != "DEF" or year not in years:
            continue
        v = (num(r["obnetcre"]) or 0) - (num(r["obnetdeb"]) or 0)
        for key, prefix in FUM.items():
            if r["compte"].startswith(prefix):
                fum_sum[(year, key, ds)] += v


add_fum("balances-comptables-des-departements", records("balances-comptables-des-departements"), range(2019, 2026))
# 2016-2017 use the M57 chart before its 2018 renumbering (no 73432; octroi de mer elsewhere): not loaded, no guessed
# mapping (shown as missing on the card). 2019 is in both sources: overlap check.
for y in (2018, 2019):
    add_fum(NATURE_FONCTION[y], records(NATURE_FONCTION[y]), {y})
fum_overlap = {key: (fum_sum[(2019, key, "balances-comptables-des-departements")], fum_sum[(2019, key, NATURE_FONCTION[2019])])
               for key in FUM}
for (year, key, ds), v in sorted(fum_sum.items()):
    if year == 2019 and ds != "balances-comptables-des-departements":
        continue
    pop = population.get((CTM, year))
    put(CTM, year, key, round(v, 2), ds, "budget_principal", bp=round(v, 2), per_hab=round(v / pop, 2) if pop else None)

# --- checks on the OFGL sums (validated mapping) ---------------------------------------------------------------------
PARTS = {"rf_total": ["impots_taxes", "concours_etat", "subventions_recues", "ventes", "autres_rf"],
         "df_total": ["frais_personnel", "achats", "intervention", "charges_financieres", "autres_df"]}
for (siren, year, key), row in actuals.items():
    if key in PARTS and row["scope"] == "consolide":
        s = sum(actuals.get((siren, year, p), {}).get("amount") or 0 for p in PARTS[key])
        if abs(s - row["amount"]) > 0.005 * row["amount"]:
            errors.append(f"{siren} {year} {key}: parts {s:,.0f} vs total {row['amount']:,.0f}")

# --- core rows: institution, bodies, seats, terms -------------------------------------------------------------------
INST, ASSEMBLEE, EXECUTIF = "ctm", "ctm-assemblee", "ctm-conseil-executif"
institutions = [{"id": INST, "kind": "ctm", "name": "Collectivité Territoriale de Martinique", "code": CTM}]
bodies = [{"id": ASSEMBLEE, "institution_id": INST, "kind": "assemblee", "name": "Assemblée de Martinique"},
          {"id": EXECUTIF, "institution_id": INST, "kind": "conseil_executif", "name": "Conseil exécutif de Martinique"}]
SEATS = {  # seat id -> (body, role, label)
    f"{ASSEMBLEE}:president": (ASSEMBLEE, "president", "Président de l'Assemblée de Martinique"),
    f"{ASSEMBLEE}:vice-president": (ASSEMBLEE, "vice-president", "Vice-président de l'Assemblée de Martinique"),
    f"{ASSEMBLEE}:conseiller": (ASSEMBLEE, "conseiller", "Conseiller à l'Assemblée de Martinique"),
    f"{EXECUTIF}:president": (EXECUTIF, "president", "Président du Conseil exécutif de Martinique"),
    f"{EXECUTIF}:conseiller-executif": (EXECUTIF, "conseiller-executif", "Conseiller exécutif de Martinique"),
}
seats = [{"id": k, "body_id": b, "role": r, "rank": None, "label_fr": l, "constituency": None}
         for k, (b, r, l) in SEATS.items()]
RNE_SEAT = {"": "conseiller", "Président de l'assemblée": "president", "Vice-président de l'assemblée": "vice-president",
            "Président de l'organe exécutif": "president", "Membre de l'organe exécutif": "conseiller-executif"}
T2015, T2021 = "ctm-2015-2021", "ctm-2021-2028"
ROUND2_2015 = "2015-12-13"  # dataset description: "… assemblées de Guyane et de Martinique du 13 décembre 2015"
START_2021 = "2021-07-02"   # RNE: start of the mandates of the councillors elected in June 2021
terms = [
    {"id": T2015, "election_year": 2015, "start_date": ROUND2_2015, "end_date": START_2021, "first_full_year": 2016,
     "last_full_year": 2020, "body_kind": "assemblee"},
    {"id": T2021, "election_year": 2021, "start_date": START_2021, "end_date": None, "first_full_year": 2022,
     "last_full_year": 2027, "body_kind": "assemblee"},  # end: March 2028 (loi n° 2021-191), text not archived yet
]

# --- people: RNE (Assemblée 2021-2028 and part of the Exécutif) -----------------------------------------------------
persons, mandates, section_members = {}, [], []
SECTION = {"Martinique-Section Du Centre": "Section du Centre", "Martinique-Section Du Nord": "Section du Nord",
           "Martinique-Section Du Sud": "Section du Sud", "Martinique-Section De Fort-De-France": "Section de Fort-de-France"}


def person(last, first, sex):
    pid = f"ctm:{last}:{first}"
    persons.setdefault(pid, {"id": pid, "last_name": last, "first_name": first, "sex": sex})
    if sex and not persons[pid]["sex"]:
        persons[pid]["sex"] = sex
    return pid


rne = [r for r in records("rne-membres-assemblees") if r["Code de la collectivité à statut particulier"] == "972"]
for r in rne:
    last, first = r["Nom de l'élu"].strip(), r["Prénom de l'élu"].strip()
    pid = person(last, first, r["Code sexe"] or None)
    function = r["Libellé de la fonction"].strip()
    role = RNE_SEAT[function]
    body = EXECUTIF if "exécutif" in function else ASSEMBLEE
    start, fstart = r["Date de début du mandat"], r["Date de début de la fonction"] or None
    odd = (fstart is not None and fstart < start) or start < START_2021  # e.g. RNE gives 2021-02-07 for a 2021-term mandate
    mandates.append({"person_id": pid, "seat_id": f"{body}:{role}", "start_date": start,
                     "function_start": fstart if role != "conseiller" else None, "end_date": None,
                     "acquired": "direct_election" if role == "conseiller" else "indirect_election", "term_id": T2021,
                     "verified": not odd, "source_id": sid("rne-membres-assemblees"), "source_url": None})
    if odd:
        print(f"RNE: {last} {first}: mandate {start} / function {fstart} before the start of the term: kept, verified=false")
    section_members.append({"person_id": pid, "term_id": T2021, "section": SECTION[r["Libellé de la section - collectivité à statut particulier"]],
                            "source_id": sid("rne-membres-assemblees")})

# --- people: HATVP (Conseil exécutif members that RNE does not list in the Exécutif) ---------------------------------
hatvp = [r for r in records("hatvp-liste-declarations")
         if r["type_mandat"] == "ctsp" and r["departement"] in ("972", "Martinique") and "exécuti" in r["qualite"]]
in_rne_executive = {m["person_id"] for m in mandates if m["seat_id"].startswith(EXECUTIF)}
hatvp_only = {}
for r in sorted(hatvp, key=lambda r: (r["nom"], r["date_depot"] or "9")):
    pid = person(r["nom"].strip(), r["prenom"].strip(), {"M.": "M", "Mme": "F"}.get(r["civilite"]))
    if pid in in_rne_executive or pid in hatvp_only:
        continue
    role = "president" if r["qualite"].startswith("Président") else "conseiller-executif"
    hatvp_only[pid] = {"person_id": pid, "seat_id": f"{EXECUTIF}:{role}", "start_date": START_2021,
                       "function_start": None, "end_date": None, "acquired": "indirect_election", "term_id": T2021,
                       "verified": False, "source_id": sid("hatvp-liste-declarations"),
                       "source_url": f"https://www.hatvp.fr{r['url_dossier']}" if r["url_dossier"] else None}
mandates += hatvp_only.values()
executive = {m["person_id"] for m in mandates if m["seat_id"].startswith(EXECUTIF)}
print(f"Conseil exécutif: {len(executive)} members ({len(in_rne_executive)} from RNE, {len(hatvp_only)} from HATVP only)")
both = sorted(p for p in hatvp_only if any(m["person_id"] == p and m["seat_id"].startswith(ASSEMBLEE) for m in mandates))
for p in both:
    print(f"   disagreement: {p} is a councillor in RNE and a conseiller exécutif in HATVP (both kept, shown on the card)")

# --- elections: lists and seats (Ministère de l'Intérieur) -----------------------------------------------------------
lists, list_members = [], []


def list_blocks(row, offset, year, rnd, source):
    out = []
    for i in range(offset, len(row) - 8, 9):
        n, nuance, short, label, head, votes, _, pct, seats_ = row[i:i + 9]
        if not n.strip():
            break
        out.append({"id": f"ctm-{year}-t{rnd}-{int(n)}", "election_year": year, "round": rnd, "number": int(n),
                    "label_short": short.strip(), "label": label.strip(), "nuance": nuance.strip(),
                    "head": head.strip(), "votes": int(num(votes)), "pct_exprimes": num(pct),
                    "seats": int(num(seats_)) if num(seats_) is not None else None, "source_id": sid(source)})
    return out


R2015 = "elections-regionales-2015-et-des-assemblees-de-corse-de-guyane-et-de-martinique-resultats-tour-2-1"
rows2015 = table(R2015)
mq = [r for r in rows2015 if r[0] == "Régions" and len(r) > 3 and r[3] == "Martinique"][0]
lists += list_blocks(mq, 18, 2015, 2, R2015)
for ds, rnd in (("elections-regionales-2021-resultats-du-1er-tour-1", 1), ("elections-regionales-2021-resultats-du-2eme-tour", 2)):
    mq = [r for r in table(ds) if len(r) > 2 and r[2] == "Martinique"][0]
    lists += list_blocks(mq, 17, 2021, rnd, ds)
for year in (2015, 2021):
    s = sum(l["seats"] or 0 for l in lists if l["election_year"] == year and l["round"] == 2)
    if s != 51:
        errors.append(f"{year}: {s} seats in round 2, expected 51")

# 2015: the 51 elected councillors (sheet "Elus"), with their list: the first CTM assembly.
by_short = {l["label_short"]: l["id"] for l in lists if l["election_year"] == 2015}
head = None
for r in rows2015:
    if r[0] != "Elus":
        continue
    if r[1] == "Région":
        head = r
        continue
    if head is None or len(r) < 10 or r[2] != "Martinique":
        continue
    e = dict(zip(head, r))
    m = re.match(r"(M\.|Mme)\s+(.+?)\s+([A-ZÀ-Ý][a-zà-ÿ].*)$", e["Désignation"].strip())
    if not m:
        errors.append(f"2015: cannot read the name {e['Désignation']!r}")
        continue
    pid = person(m[2].strip(), m[3].strip(), "M" if m[1] == "M." else "F")
    mandates.append({"person_id": pid, "seat_id": f"{ASSEMBLEE}:conseiller", "start_date": ROUND2_2015,
                     "function_start": None, "end_date": START_2021, "acquired": "direct_election", "term_id": T2015,
                     "verified": True, "source_id": sid(R2015), "source_url": None})
    section_members.append({"person_id": pid, "term_id": T2015, "section": e["Libellé_section_électorale"].replace("Martinique - ", ""),
                            "source_id": sid(R2015)})
    lid = by_short.get(e["Libellé_de_la_liste"].strip())
    if lid is None:
        errors.append(f"2015: list {e['Libellé_de_la_liste']!r} not in the results")
        continue
    list_members.append({"id": f"{pid}:{lid}", "person_id": pid, "list_id": lid, "match": "publie",
                         "note": None, "source_id": sid(R2015)})
n2015 = sum(1 for m in mandates if m["term_id"] == T2015)
if n2015 != 51:
    errors.append(f"2015: {n2015} elected councillors read, expected 51")

# 2021: no list of the elected is published. Each elected person (RNE, HATVP) is matched by name to the round-1 lists.
# A round-1 list present in round 2 under the same number: elected on it (match 'deduit'). Otherwise it merged: 'a_verifier'.
C2021 = "elections-regionales-2021-candidatures-au-1er-tour"
_, cand_head, *cand_rows = table(C2021)  # converted txt: column "feuille", then the published header row
cand = [dict(zip(cand_head[1:], r[1:])) for r in cand_rows]
t2_numbers = {l["number"] for l in lists if l["election_year"] == 2021 and l["round"] == 2}
t1, t1_short = collections.defaultdict(set), collections.defaultdict(set)


def short(last, first):  # second pass: last name + first given name ("Fernand" vs "Fernand Bruno")
    return f"{fold(last)}|{fold(first).split(' ')[0]}"


for c in cand:
    if c["Libellé de la région"] == "Martinique":
        t1[fold(f"{c['Nom candidat']} {c['Prénom candidat']}")].add(int(c["N° Panneau Liste"]))
        t1_short[short(c["Nom candidat"], c["Prénom candidat"])].add(int(c["N° Panneau Liste"]))
unmatched = []
for pid in sorted({m["person_id"] for m in mandates if m["term_id"] == T2021}):
    p = persons[pid]
    found = set(t1.get(fold(f"{p['last_name']} {p['first_name']}"), set()))
    first_name_note = None
    if not found:
        found = set(t1_short.get(short(p["last_name"], p["first_name"]), set()))
        first_name_note = "prénom différent entre le RNE (ou la HATVP) et la liste de candidats" if found else None
    if len(found) != 1:
        unmatched.append(f"{pid} ({len(found)} round-1 lists)")
        continue
    n = found.pop()
    kept = n in t2_numbers
    lid = f"ctm-2021-t{2 if kept else 1}-{n}"
    list_members.append({"id": f"{pid}:{lid}", "person_id": pid, "list_id": lid,
                         "match": "deduit" if kept else "a_verifier",
                         "note": "; ".join(x for x in (first_name_note, None if kept else
                                           "liste du 1er tour fusionnée au 2nd tour : liste d'élection à vérifier") if x) or None,
                         "source_id": sid(C2021)})
print(f"2021 lists: {len(list_members) - 51} matched (2 passes), {len(unmatched)} not matched: {unmatched}")

# --- spending by area (M57 functional presentation), 2018-2025 --------------------------------------------------------
AREA_LABELS = area_labels(records("ofgl-fonctions-m57-libelles"))
if sorted(AREA_LABELS) != [str(i) for i in range(9)]:
    errors.append(f"M57 area labels: expected codes 0-8, got {sorted(AREA_LABELS)}")
functional = []
for year in range(FUNC_FROM, PROVISIONAL_YEAR + 1):
    ds = NATURE_FONCTION[year]
    pop = population.get((CTM, year))
    for (section, area), v in sorted(area_sums(records(ds), CTM).items()):
        functional.append({"year": year, "section": section, "fonction": area,
                           "label": AREA_LABELS.get(area, "Non ventilé par domaine"), "amount": round(v, 2),
                           "eur_per_hab": round(v / pop, 2) if pop else None, "provisional": year == PROVISIONAL_YEAR,
                           "source_id": sid(ds)})

# --- acts of the Assemblée and the Conseil exécutif (index of the CTM's website) -------------------------------------
acts = []
for ds in ("ctm-deliberations-assemblee", "ctm-arretes-deliberes-ce"):
    acts += build_acts(ds, records(ds), sid(ds))
if len({a["id"] for a in acts}) != len(acts):
    errors.append("ctm_acts: duplicate ids")
print(f"acts: {sum(a['body'] == 'assemblee' for a in acts)} délibérations, "
      f"{sum(a['body'] == 'conseil_executif' for a in acts)} arrêtés délibérés, {sum(a['number'] is None for a in acts)} without number")

# --- comptes administratifs of the main budget, as voted (PDF text layer, pages C1 / C2) ------------------------------
import pymupdf  # noqa: E402

pymupdf.TOOLS.mupdf_display_errors(False)
ca_lines = []
for year, delib, _wpdm, _slug in CA_DOCS:
    ds = f"ctm-ca-{year}"
    if ds not in MANIFEST:
        errors.append(f"{ds}: not downloaded")
        continue
    for key, (value, page) in read_ca(pymupdf.open(ROOT / MANIFEST[ds]["file"])).items():
        ca_lines.append({"year": year, "budget": "principal", "line_key": key, "label": CA_LINES[key],
                         "amount": round(value, 2), "page": page, "deliberation": delib, "source_id": sid(ds)})
print(f"comptes administratifs: {len(ca_lines)} lines for {sorted({c['year'] for c in ca_lines})}")

# --- forecast layer (« Prévisionnel »): budgets primitifs read from pages D1 / D2; orientation reports linked only ----
forecast_docs, forecast_figures = [], []
for year, kind, delib, _wpdm, _slug in FORECAST_DOCS:
    ds = f"ctm-{kind.lower()}-{year}"
    if ds not in MANIFEST:
        errors.append(f"{ds}: not downloaded")
        continue
    doc_id = f"ctm-{year}-{kind}"
    forecast_docs.append({"id": doc_id, "fiscal_year": year, "doc_type": kind, "deliberation": delib,
                          "title": MANIFEST[ds]["title"], "source_id": sid(ds)})
    if kind == "BP":
        for key, (value, page) in read_bp(pymupdf.open(ROOT / MANIFEST[ds]["file"])).items():
            forecast_figures.append({"document_id": doc_id, "line_key": key, "label": BP_LINES[key],
                                     "amount": round(value, 2), "page": page, "quote": None})
print(f"forecast: {len(forecast_docs)} documents, {len(forecast_figures)} figures (budgets primitifs)")

# --- octroi de mer: the Assemblée's decisions (kinds from titles) and figures transcribed from scanned deliberations --
octroi_acts = octroi_kinds(acts)
octroi_figures, octroi_errors = octroi_figures_from((ROOT / "data" / "ctm" / "octroi").glob("*.yaml"), MANIFEST)
errors += octroi_errors
octroi_figures = [{**{k: v for k, v in f.items() if k != "source_job"}, "source_id": sid(f["source_job"])}
                  for f in octroi_figures]
print(f"octroi de mer: {len(octroi_acts)} acts of the Assemblée "
      f"({dict(collections.Counter(a['kind'] for a in octroi_acts))}), {len(octroi_figures)} transcribed figures")

# --- report and write ------------------------------------------------------------------------------------------------
print("2012 overlap (DGFiP comptes individuels vs OFGL budget principal):")
for o in overlap:
    d = (o["ci"] - o["ofgl_bp"]) / o["ofgl_bp"] if o["ci"] is not None and o["ofgl_bp"] else None
    print(f"   {o['siren']} {o['metric_key']:20s} CI {o['ci'] / 1e6:9.1f}  OFGL bp {o['ofgl_bp'] / 1e6:9.1f}  "
          f"{'' if d is None else f'{d:+.1%}'}")
print("Fiscalité ultramarine 2019 (balances départements vs nature-fonction):")
for key, (a, b) in fum_overlap.items():
    print(f"   {key:20s} {a / 1e6:8.1f} {b / 1e6:8.1f}")

out = {"sources": sources, "institutions": institutions, "bodies": bodies, "seats": seats, "terms": terms,
       "persons": sorted(persons.values(), key=lambda p: p["id"]),
       "mandates": sorted(mandates, key=lambda m: (m["term_id"], m["seat_id"], m["person_id"])),
       "ctm_metric_definitions": metric_defs,
       "ctm_actuals": sorted(actuals.values(), key=lambda r: (r["entity_siren"], r["year"], r["metric_key"])),
       "ctm_electoral_lists": sorted(lists, key=lambda l: l["id"]),
       "ctm_list_members": sorted(list_members, key=lambda l: l["id"]),
       "ctm_section_members": sorted(section_members, key=lambda s: (s["term_id"], s["person_id"])),
       "ctm_functional_actuals": functional, "ctm_acts": sorted(acts, key=lambda a: a["id"]),
       "ctm_ca_lines": sorted(ca_lines, key=lambda c: (c["year"], c["line_key"])),
       "ctm_forecast_documents": sorted(forecast_docs, key=lambda d: d["id"]),
       "ctm_forecast_figures": sorted(forecast_figures, key=lambda f: (f["document_id"], f["line_key"])),
       "ctm_octroi_acts": sorted(octroi_acts, key=lambda a: a["act_id"]),
       "ctm_octroi_figures": sorted(octroi_figures, key=lambda f: (f["deliberation"], f["line_key"])),
       "ctm_overlap_2012": overlap, "ctm_fum_overlap_2019": [{"metric_key": k, "balances": a, "nature_fonction": b}
                                                             for k, (a, b) in fum_overlap.items()]}
if errors:
    print("\nFAILED:\n  " + "\n  ".join(errors))
    sys.exit(1)
OUT.mkdir(parents=True, exist_ok=True)
for name, rows in out.items():
    (OUT / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{name:24s} {len(rows):6d}")
