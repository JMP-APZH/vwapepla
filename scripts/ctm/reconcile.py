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

print(f"\n{'All checks passed.' if not failed else f'{failed} check(s) FAILED.'}")
sys.exit(1 if failed else 0)
