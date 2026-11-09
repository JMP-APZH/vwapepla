"""Reconciliation gate of the CTM card: our figures (data/build/ctm/) vs the CRC report and the DGFiP accounts.

Run after scripts/ctm/pipeline/build.py:  python -I scripts/ctm/reconcile.py   -> exit 1 if a check fails.
Tolerance: 1 %, or EUR 50,000 for small aggregates (rounding of the published figures).

Benchmark: Chambre régionale des comptes, rapport d'observations définitives, CTM, exercices 2021 et suivants
(délibéré le 10 juin 2026), archived as `crc-ctm-2026-rapport-observations-definitives` (83 pages). Page numbers below
are those of the PDF.
Known inconsistency, reported and not failing: the report's text (p. 56) gives the 2021 debt as EUR 744,427,970, while
its own annex table (p. 80) gives EUR 849,427,970 (= OFGL); the text's 2025 figure (EUR 977,094,322) is compared with our
provisional 2025.
"""
import csv, json, pathlib, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILD, RAW = ROOT / "data" / "build" / "ctm", ROOT / "data" / "raw" / "ctm"
MANIFEST = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
CTM, TOL, ABS_TOL = "200055507", 0.01, 50_000
PROVISIONAL_YEAR = 2025  # OFGL / DGFiP balances not final yet

# CRC figures (euros unless stated), with their place in the report.
CRC_CAF_BRUTE_BP = {2021: 83_382_291, 2022: 128_172_823, 2023: 93_274_038, 2024: 48_568_574}   # p. 49, tableau n° 17
CRC_ENCOURS_BP = {2021: 849_427_970, 2022: 881_668_007, 2023: 920_363_128, 2024: 954_845_896}   # p. 80, annexe
CRC_CAPACITE_BP = {2021: 10, 2022: 7, 2023: 10, 2024: 20}                                         # p. 80, années
CRC_TEXT_ENCOURS = {2021: 744_427_970, 2025: 977_094_322}                                         # p. 56, texte
CRC_PRODUITS_OCTROI = {2021: 197e6, 2024: 224e6}  # p. 43 « produits liés à l'octroi de mer » (en M€) = compte 734
CRC_RECETTES_FISCALES = {2021: 661e6, 2024: 727e6}  # p. 42 « recettes fiscales » (en M€)

rows = json.loads((BUILD / "ctm_actuals.json").read_text(encoding="utf-8"))
A = {(r["entity_siren"], r["year"], r["metric_key"]): r for r in rows}
failed, lines = 0, []


def check(label, ours, ref, unit="€", tol=TOL, abs_tol=ABS_TOL, fail=True):
    global failed
    if ours is None or ref is None:
        ok, d = False, None
    else:
        d = (ours - ref) / ref if ref else 0.0
        ok = abs(d) <= tol or abs(ours - ref) <= abs_tol
    status = "OK" if ok else ("FAIL" if fail else "écart connu, affiché avec avertissement")
    failed += (not ok) and fail
    fmt = (lambda v: "—" if v is None else f"{v / 1e6:10.1f}") if unit == "€" else (lambda v: "—" if v is None else f"{v:10.1f}")
    lines.append(f"{label:72s} {fmt(ours)} {fmt(ref)} {'' if d is None else f'{d:+7.2%}':>8s}  {status}")


def v(year, key, part="amount", siren=CTM):
    return A.get((siren, year, key), {}).get(part)


head = f"{'Check':72s} {'ours':>10s} {'ref':>10s} {'Δ':>8s}"
print(f"CTM reconciliation (tolerance {TOL:.0%} or €{ABS_TOL:,}; amounts in M€, capacity in years)\n\n{head}")
for y, ref in CRC_CAF_BRUTE_BP.items():
    check(f"R1 Épargne brute budget principal {y} (CRC p. 49)", v(y, "epargne_brute", "amount_bp"), ref)
for y, ref in CRC_ENCOURS_BP.items():
    check(f"R2 Encours de dette budget principal {y} (CRC p. 80)", v(y, "encours_dette", "amount_bp"), ref)
for y, ref in CRC_TEXT_ENCOURS.items():
    check(f"R2 Encours {y} vs texte du rapport (CRC p. 56)", v(y, "encours_dette", "amount_bp"), ref, fail=False)
for y, ref in CRC_CAPACITE_BP.items():
    eb, enc = v(y, "epargne_brute", "amount_bp"), v(y, "encours_dette", "amount_bp")
    check(f"R3 Capacité de désendettement BP {y} (CRC p. 80, arrondi)", enc / eb if eb else None, ref, unit="years",
          tol=0, abs_tol=0.5)
for y, ref in CRC_PRODUITS_OCTROI.items():
    check(f"R4 Fiscalité ultramarine (734) {y} (CRC p. 43, en M€)", v(y, "fum_total"), ref, abs_tol=0.5e6)
for y, ref in CRC_RECETTES_FISCALES.items():
    check(f"R7 Impôts et taxes {y} (CRC p. 42, en M€)", v(y, "impots_taxes", "amount_bp"), ref, abs_tol=0.5e6)

# 2012 in both sources: DGFiP comptes individuels (2008-2011 series) vs OFGL budget principal.
for o in json.loads((BUILD / "ctm_overlap_2012.json").read_text(encoding="utf-8")):
    name = {"239720014": "Région", "229720016": "Département"}[o["siren"]]
    check(f"Raccord 2012 {name} {o['metric_key']} (comptes individuels / OFGL bp)", o["ci"], o["ofgl_bp"])
for o in json.loads((BUILD / "ctm_fum_overlap_2019.json").read_text(encoding="utf-8")):
    check(f"Raccord 2019 {o['metric_key']} (balances / nature-fonction)", o["balances"], o["nature_fonction"])
print("\n".join(lines))

# --- R5: every OFGL aggregate of the CTM budget principal vs DGFiP balance accounts, with OFGL's formula file ---------
# Codes: C / D credit / debit, CN / DN net credit / debit (budget operations, net of cancellations), SC / SD credit /
# debit balance, SCN / SDN net balances. Formulas may use other aggregates and minimum(a ; b).


def raw(ds):
    with open(ROOT / MANIFEST[ds]["file"], encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


formulas = raw("methodologie-ofgl-formules-des-agregats-financiers")
balances = [r for r in raw("balances-comptables-des-departements") if r["siren"] == CTM and r["cbudg"] == "1" and r["bal"] == "DEF"]
ofgl = [r for r in raw("ofgl-base-regions-consolidee") if r["siren"] == CTM]


def n(x):
    return float(x or 0)


COL = {"C": lambda r: n(r["obnetcre"]), "D": lambda r: n(r["obnetdeb"]),
       "CN": lambda r: n(r["obnetcre"]) - n(r["obnetdeb"]), "DN": lambda r: n(r["obnetdeb"]) - n(r["obnetcre"]),
       "SC": lambda r: n(r["sc"]), "SD": lambda r: n(r["sd"]),
       "SCN": lambda r: n(r["sc"]) - n(r["sd"]), "SDN": lambda r: n(r["sd"]) - n(r["sc"])}
TOKEN = re.compile(r"\b(SCN|SDN|CN|DN|SC|SD|C|D)(\d+)\b")
COMMENT = re.compile(r"\((?![^()]*\d)[^()]*\)")  # explanatory text, e.g. "(gestion active de la dette)"


def evaluate(form, year_rows):
    names, cache = sorted(form, key=len, reverse=True), {}

    def account(kind, prefix):
        return sum(COL[kind](r) for r in year_rows if r["compte"].startswith(prefix))

    def ev(name):
        if name not in cache:
            expr = form[name]
            for i, other in enumerate(names):
                if other != name and other in expr:
                    expr = expr.replace(other, f" AGG({i}) ")
            expr = COMMENT.sub("", expr)
            expr = TOKEN.sub(lambda m: f"ACC({m[1]!r},{m[2]!r})", expr).replace("minimum", "min").replace(";", ",")
            if re.search(r"[^\sA-Z0-9(),'+\-*/._a-z]", expr):
                raise ValueError(f"unexpected text in {expr!r}")
            cache[name] = eval(expr, {"__builtins__": {}}, {"AGG": lambda i: ev(names[i]), "ACC": account, "min": min})
        return cache[name]
    return ev


print("\nR5 OFGL aggregates of the budget principal vs DGFiP balance accounts (OFGL formula file)")
r5_fail = 0
for year in range(2019, 2026):
    form = {f["agregat"]: f["formule"] for f in formulas
            if f["type_collectivite"] == "Régions" and f["type_calcul"] == "Agrégat brut" and f["annee"] == str(year)
            and "Budgets principaux" in f["type_budget"] and "M57" in f["nomenclatures"]}
    ev = evaluate(form, [r for r in balances if r["exer"][:4] == str(year)])
    published = {r["agregat"]: n(r["montant_bp"]) for r in ofgl if r["exer"][:4] == str(year)}
    ok = diff = 0
    for agg in sorted(form):
        if agg not in published:
            continue  # intermediate aggregates not published for the CTM (e.g. "Emprunts yc GAD")
        ours, ref = ev(agg), published[agg]
        good = abs(ours - ref) <= ABS_TOL or (ref and abs((ours - ref) / ref) <= TOL)
        ok += good
        diff += not good
        if not good:
            print(f"   {year} {agg:45s} ours {ours / 1e6:10.2f}  OFGL {ref / 1e6:10.2f}  FAIL")
    r5_fail += diff
    print(f"   {year}: {ok} aggregates match, {diff} differ")
failed += r5_fail

# --- R9 / R10: spending by area (DGFiP nature-fonction) vs OFGL budget principal ---------------------------------------
functional = json.loads((BUILD / "ctm_functional_actuals.json").read_text(encoding="utf-8"))
by_year = {}
for f in functional:
    by_year[(f["year"], f["section"])] = by_year.get((f["year"], f["section"]), 0.0) + f["amount"]
lines = []
for year in sorted({f["year"] for f in functional}):
    check(f"R9 Fonctionnement par domaine {year} (= dépenses de fonctionnement bp)", by_year.get((year, "fonctionnement")),
          v(year, "df_total", "amount_bp"))
    equipment = (v(year, "depenses_equipement", "amount_bp") or 0) + (v(year, "subv_equipement", "amount_bp") or 0)
    check(f"R10 Investissement par domaine {year} (= équipement + subventions d'équipement bp)",
          by_year.get((year, "investissement")), equipment)
print("\nR9 / R10 Spending by area (areas + not broken down) vs OFGL budget principal")
print("\n".join(lines))

# --- R6: comptes administratifs voted by the Assemblée (pages C1 / C2) vs DGFiP and OFGL (B3-MAPPING.md §G) -------------
# The CA counts gross amounts: real operating spending = debits on real class-6 accounts + debits on class 7 (atténuations
# de produits, 739); real operating income = credits on real class-7 accounts + credits on class 6 (atténuations de
# charges). OFGL nets both, so the CA's totals are higher by the same amount on each side and the balance is the same.
# 2022-2023: the CA's chapter 923 income also includes account 1068 (capitalised surplus), shown apart from 2024.
# OFGL 2025 is provisional (final DGFiP balances at year end): 2025 is reported, never failing.
ca = {(c["year"], c["line_key"]): c for c in json.loads((BUILD / "ctm_ca_lines.json").read_text(encoding="utf-8"))}
gross = {}
for r in balances:
    year, acc = int(r["exer"][:4]), r["compte"]
    d, c = n(r["obnetdeb"]), n(r["obnetcre"])
    real6 = acc.startswith("6") and not acc.startswith(("68", "675", "676"))
    real7 = acc.startswith("7") and not acc.startswith(("775", "776", "777", "78"))
    g = gross.setdefault(year, {"dep": 0.0, "rec": 0.0, "c1068": 0.0})
    g["dep"] += (d if real6 else 0) + (d if real7 else 0)
    g["rec"] += (c if real7 else 0) + (c if real6 else 0)
    g["c1068"] += c if acc.startswith("1068") else 0
lines = []
for year in sorted({k[0] for k in ca}):
    final = year != PROVISIONAL_YEAR
    page = lambda key: ca[(year, key)]["page"]  # noqa: E731
    a = lambda key: ca[(year, key)]["amount"]  # noqa: E731
    g = gross.get(year, {})
    check(f"R6 {year} CA fonct. dépenses réelles (p. {page('fonc_depenses_reelles')}) = DGFiP brut", a("fonc_depenses_reelles"), g.get("dep"), fail=final)
    check(f"R6 {year} CA fonct. recettes réelles (p. {page('fonc_recettes_reelles')}) = DGFiP brut", a("fonc_recettes_reelles"), g.get("rec"), fail=final)
    check(f"R6 {year} CA solde réel de fonct. (p. {page('fonc_solde_reel')}) = OFGL épargne brute bp", a("fonc_solde_reel"), v(year, "epargne_brute", "amount_bp"), fail=final)
    check(f"R6 {year} CA invest. réel hors chap. 923 (p. {page('inv_depenses_reelles')}) = OFGL invest. hors remb. bp",
          a("inv_depenses_reelles") - a("inv_dette_depenses"), v(year, "di_hors_remb", "amount_bp"), fail=final)
    check(f"R6 {year} CA chap. 923 mandats (p. {page('inv_dette_depenses')}) = OFGL remboursements bp", a("inv_dette_depenses"), v(year, "remboursements", "amount_bp"), fail=final)
    loans = (v(year, "emprunts", "amount_bp") or 0) + (g.get("c1068", 0) if year in (2022, 2023) else 0)
    check(f"R6 {year} CA chap. 923 titres (p. {page('inv_dette_recettes')}) = OFGL emprunts bp{' + 1068' if year in (2022, 2023) else ''}",
          a("inv_dette_recettes"), loans, fail=final)
print("\nR6 Comptes administratifs (budget principal, as voted) vs DGFiP gross amounts and OFGL budget principal")
print("\n".join(lines))

# --- F1: forecast layer, consistency only (never compared with actuals as a check) ------------------------------------
docs = json.loads((BUILD / "ctm_forecast_documents.json").read_text(encoding="utf-8"))
figs = json.loads((BUILD / "ctm_forecast_figures.json").read_text(encoding="utf-8"))
lines = []
for d in (d for d in docs if d["doc_type"] == "BP"):
    f = {x["line_key"]: x["amount"] for x in figs if x["document_id"] == d["id"]}
    check(f"F1 {d['id']}: 9 lignes lues", len(f), 9, unit="n", tol=0, abs_tol=0)
    check(f"F1 {d['id']}: investissement total ≈ chap. 90 + chap. 923 (dépenses)", f.get("inv_depenses_reelles"),
          (f.get("inv_ventile") or 0) + (f.get("inv_dette_depenses") or 0))
print("\nF1 Forecast layer (budgets primitifs): consistency")
print("\n".join(lines))

print(f"\n{'All checks passed.' if not failed else f'{failed} check(s) FAILED.'}")
sys.exit(1 if failed else 0)
