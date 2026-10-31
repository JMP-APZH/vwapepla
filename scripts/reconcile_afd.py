"""Reconciliation gate: Martinique totals we publish (data/build/actuals.json) vs AFD Observatoire des communes 2024 (FY2023).

Run after scripts/pipeline/build.py:  python -I scripts/reconcile_afd.py   -> exit 1 if any indicator is off by > 2%.
Benchmark: AFD, web_observatoire_martinique_2024.pdf — p.6-7 headline figures, Annexe 3 (EUR/hab x population 365 734).
"""
import collections, json, pathlib, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parent.parent
YEAR, TOLERANCE, AFD_POP = 2023, 0.02, 365734

# (label, metric key, AFD value in M EUR, or None, AFD EUR/hab from Annexe 3, or None)
AFD = [
    ("Encours de dette fin 2023", "encours_dette", 330, None),
    ("Investissement hors remb. (« 119 M€ »)", "di_hors_remb", 119, 326),
    ("Dépenses d'équipement", "depenses_equipement", None, 306),
    ("Épargne brute", "epargne_brute", None, 154),
    ("Dépenses de fonctionnement", "df_total", None, 1614),
    ("Frais de personnel", "frais_personnel", None, 1043),
    ("Recettes de fonctionnement", "rf_total", None, 1768),
    ("Impôts et taxes", "impots_taxes", None, 1353),
    ("Octroi de mer", "octroi_de_mer", None, 667),
    ("Concours de l'État", "concours_etat", None, 285),
    ("Subventions reçues", "subventions_recues", None, 70),
]

rows = json.loads((ROOT / "data" / "build" / "actuals.json").read_text(encoding="utf-8"))
tot, prev, communes = collections.defaultdict(float), collections.defaultdict(float), collections.defaultdict(set)
for r in rows:
    if r["amount"] is None:
        continue
    if r["year"] == YEAR:
        tot[r["metric_key"]] += r["amount"]
        communes[r["metric_key"]].add(r["commune_code"])
    elif r["year"] == YEAR - 1:
        prev[r["metric_key"]] += r["amount"]

failed = 0
print(f"FY{YEAR} — OFGL consolidated + DGFiP vs AFD Observatoire 2024 (tolerance {TOLERANCE:.0%})\n")
print(f"{'Indicator':42s} {'AFD M€':>8s} {'ours M€':>8s} {'Δ%':>7s}  communes")
for label, key, head, hab in AFD:
    afd = head if head is not None else hab * AFD_POP / 1e6
    ours = tot[key] / 1e6
    d = (ours - afd) / afd
    ok = abs(d) <= TOLERANCE and len(communes[key]) == 34
    failed += not ok
    print(f"{label:42s} {afd:8.1f} {ours:8.1f} {d:+6.1%}  {len(communes[key]):2d}  {'OK' if ok else 'FAIL'}")
checks = [("Capacité de désendettement (ans)", tot["encours_dette"] / tot["epargne_brute"], 6, 0.5),
          ("Variation de la dette vs N-1 (M€)", (tot["encours_dette"] - prev["encours_dette"]) / 1e6, -12, 1),
          ("Taux d'effort", tot["di_hors_remb"] / tot["rf_total"], 0.18, 0.01)]
for label, ours, afd, tol in checks:
    ok = abs(ours - afd) <= tol
    failed += not ok
    print(f"{label:42s} {afd:8.2f} {ours:8.2f} {'':7s}      {'OK' if ok else 'FAIL'}")
print(f"\n{'ALL OK' if not failed else f'{failed} FAILED'}")
sys.exit(1 if failed else 0)
