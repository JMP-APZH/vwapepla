"""Reconcile Martinique communes totals (OFGL) with AFD 'Observatoire des communes de Martinique 2024' (FY2023).

Usage: python -I scripts/reconcile_afd.py <ofgl-base-communes_972.csv> <ofgl-base-communes-consolidee_972.csv> [year]
Benchmark: AFD, web_observatoire_martinique_2024.pdf, p.6-7 (headline figures) and Annexe 3 (EUR/hab).
"""
import csv, sys, collections
sys.stdout.reconfigure(encoding="utf-8")

AFD_POP = 365734
# label -> (headline M EUR or None, EUR/hab from Annexe 3 or None, OFGL aggregate)
AFD = [
    ("Encours de dette fin 2023", 330, None, "Encours de dette"),
    ("Dépenses d'investissement (hors remb.) — « 119 M€ »", 119, 326, "Dépenses d'investissement hors remb"),
    ("Dépenses d'équipement", None, 306, "Dépenses d'équipement"),
    ("Épargne brute", None, 154, "Epargne brute"),
    ("Dépenses de fonctionnement", None, 1614, "Dépenses de fonctionnement"),
    ("Frais de personnel", None, 1043, "Frais de personnel"),
    ("Recettes de fonctionnement", None, 1768, "Recettes de fonctionnement"),
    ("Impôts et taxes", None, 1353, "Impôts et taxes"),
    ("Concours de l'État", None, 285, "Concours de l'Etat"),
    ("Subventions reçues", None, 70, "Subventions reçues et participations"),
]

def totals(path, year, budget_filter=None):
    t = collections.defaultdict(float); pop = {}
    for r in csv.DictReader(open(path, encoding="utf-8-sig"), delimiter=";"):
        if r["exer"] != year or (budget_filter and r.get("type_de_budget") != budget_filter):
            continue
        t[r["agregat"]] += float(r["montant"] or 0); pop[r["com_code"]] = int(r["ptot"])
    return t, sum(pop.values()), len(pop)

base, cons = sys.argv[1], sys.argv[2]
year = sys.argv[3] if len(sys.argv) > 3 else "2023"
bp, pop, n = totals(base, year, "Budget principal")
co, popc, nc = totals(cons, year)
print(f"Year {year} — communes BP {n}, consolidated {nc}; OFGL population {pop} (AFD {AFD_POP})\n")
print(f"{'Indicator':52s} {'AFD M€':>8s} {'OFGL BP':>8s} {'OFGL cons':>9s} {'Δ cons':>8s} {'Δ%':>6s}")
for label, head, hab, ag in AFD:
    afd = head if head is not None else hab * AFD_POP / 1e6
    src = "" if head is not None else f"  (≈{hab} €/hab × pop)"
    c = co[ag] / 1e6
    print(f"{label:52s} {afd:8.1f} {bp[ag]/1e6:8.1f} {c:9.1f} {c-afd:+8.1f} {100*(c-afd)/afd:+5.1f}%{src}")
eb = co["Epargne brute"]
print(f"\nCapacité de désendettement (encours/EB) consolidated: {co['Encours de dette']/eb:.1f} years (AFD: 6 ans)")
prev, _, _ = totals(cons, str(int(year) - 1))
print(f"Variation encours vs {int(year)-1}: {(co['Encours de dette']-prev['Encours de dette'])/1e6:+.1f} M€ (AFD: -12 M€)")
print(f"Taux d'effort (DI hors remb / RF): {co["Dépenses d'investissement hors remb"]/co['Recettes de fonctionnement']:.1%} (AFD: 18%)")
