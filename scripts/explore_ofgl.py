"""Exploration of OFGL 'Comptes des communes' for Martinique (dep 972). Read-only, prints a report."""
import csv, sys, collections
path = sys.argv[1]
rows = list(csv.DictReader(open(path, encoding="utf-8-sig"), delimiter=";"))
print("rows", len(rows))
for k in ["exer", "type_de_budget", "categ", "nomen", "cbudg"]:
    print(k, collections.Counter(r[k] for r in rows).most_common())
# coverage: communes with budget principal per year
cov = collections.defaultdict(set)
names = {}
for r in rows:
    names[r["com_code"]] = r["com_name"]
    if r["type_de_budget"] == "Budget principal":
        cov[r["exer"]].add(r["com_code"])
allc = sorted(names)
print("distinct communes", len(allc))
for y in sorted(cov):
    miss = [f"{c} {names[c]}" for c in allc if c not in cov[y]]
    print(y, len(cov[y]), "missing:", miss)
print("presence_budget by year", collections.Counter((r["exer"], r["presence_budget"]) for r in rows if r["type_de_budget"]=="Budget principal"))
ag = collections.Counter(r["agregat"] for r in rows if r["type_de_budget"] == "Budget principal")
print("\nAGREGATS (budget principal):", len(ag))
for a, n in sorted(ag.items()): print(f"  {n:5d}  {a}")
print("\nsample order fields for each agregat:")
seen=set()
for r in rows:
    if r["type_de_budget"]=="Budget principal" and r["agregat"] not in seen:
        seen.add(r["agregat"])
        print("  ", r["agregat"], [r[f"ordre_analyse{i}_section{j}"] for i in range(1,4) for j in range(1,4)], r["ordre_analyse4_section1"])
print("\nbudgets annexes:", collections.Counter((r["com_name"], r["lbudg"]) for r in rows if r["type_de_budget"]!="Budget principal" and r["exer"]=="2023").keys())
