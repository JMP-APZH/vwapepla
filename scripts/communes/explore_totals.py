"""Check aggregate hierarchy identities and compute Martinique totals (budget principal, and BP+BA) for one year."""
import csv, sys, collections
path, year = sys.argv[1], sys.argv[2]
rows = [r for r in csv.DictReader(open(path, encoding="utf-8-sig"), delimiter=";") if r["exer"] == year]
tot = collections.defaultdict(float); totall = collections.defaultdict(float); pop = {}
per = collections.defaultdict(dict)
for r in rows:
    m = float(r["montant"] or 0)
    totall[r["agregat"]] += m
    if r["type_de_budget"] == "Budget principal":
        tot[r["agregat"]] += m; pop[r["com_code"]] = int(r["ptot"]); per[r["com_code"]][r["agregat"]] = m
print("population", sum(pop.values()))
for a in sorted(tot): print(f"{a:55s} BP {tot[a]/1e6:10.2f} M€   BP+BA {totall[a]/1e6:10.2f} M€")
def chk(name, parts, d=tot):
    s = sum(d[p] for p in parts); print(f"CHECK {name} = {d[name]/1e6:.2f} vs sum {s/1e6:.2f}  [{' + '.join(parts)}]")
chk("Recettes de fonctionnement", ["Impôts et taxes","Concours de l'Etat","Subventions reçues et participations","Ventes de biens et services","Autres recettes de fonctionnement"])
chk("Impôts et taxes", ["Impôts locaux","Autres impôts et taxes","Fiscalité reversée"])
chk("Concours de l'Etat", ["Dotation globale de fonctionnement","Autres dotations de fonctionnement","Péréquations et compensations fiscales"])
chk("Dépenses de fonctionnement", ["Frais de personnel","Achats et charges externes","Dépenses d'intervention","Charges financières","Autres dépenses de fonctionnement"])
chk("Dépenses d'investissement hors remb", ["Dépenses d'équipement","Subventions d'équipement versées","Autres dépenses d'investissement"])
chk("Recettes d'investissement hors emprunts", ["FCTVA","Autres dotations et subventions","Autres recettes d'investissement"])
print("EB = RF - DF ?", (tot["Recettes de fonctionnement"]-tot["Dépenses de fonctionnement"])/1e6, tot["Epargne brute"]/1e6)
print("Encours = bancaires + dépôts ?", (tot["Encours de dette - Dettes bancaires et assimilées"]+tot["Encours de dette - Dépôts et cautionnements reçus"])/1e6)
print("\nPer commune (BP): code name pop debt EB equip  debt/EB")
names = {r["com_code"]: r["com_name"] for r in rows}
for c in sorted(per):
    p = per[c]; eb = p.get("Epargne brute",0); d = p.get("Encours de dette",0)
    print(f"  {c} {names[c]:28s} {pop[c]:7d} {d/1e6:7.2f} {eb/1e6:7.2f} {p.get("Dépenses d'équipement",0)/1e6:6.2f}  {d/eb if eb>0 else float('nan'):6.1f}")
