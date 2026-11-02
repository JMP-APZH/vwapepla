"""Seed data/officeholders/history.yaml with the likely mayor of each term: head of the list that won the most seats.

Source: Ministry of the Interior results (communes of 1,000+ inhabitants; Martinique = département 'ZB').
The head of the winning list is *usually* the mayor, but the council elects the mayor and mid-term changes happen:
every seeded row is `verified: false` until JM checks it (the card only shows verified rows).
Never overwrites a row already in the file. Communes < 1,000 inhabitants and 2008-2014 are left to fill in by hand.

Run: python -I scripts/pipeline/seed_mayor_history.py
"""
import collections, csv, json, pathlib, sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT / "data" / "raw" / "manifest.json").read_text(encoding="utf-8"))
OUT = ROOT / "data" / "officeholders" / "history.yaml"
TERMS = {"2014-2020": ("2014-03-23", "2020-03-15", 2014), "2020-2026": ("2020-03-15", "2026-03-15", 2020)}


def lists(ds):
    """{commune_code: [(head_last, head_first, list_name, seats)]} for Martinique in one results file."""
    path = ROOT / MANIFEST[ds]["file"]
    text = path.read_text(encoding="latin-1")
    delim = "\t" if text.split("\n", 1)[0].count("\t") > text.split("\n", 1)[0].count(";") else ";"
    rows = list(csv.reader(text.splitlines(), delimiter=delim))
    header = [h.strip() for h in rows[0]]
    start = header.index("N.Pan.") if "N.Pan." in header else header.index("Code Nuance")
    block = header[start:header.index("% Voix/Exp") + 1]
    col = {h: i for i, h in enumerate(block)}
    dep_i, com_i = header.index("Code du département"), header.index("Code de la commune")
    out = collections.defaultdict(list)
    for r in rows[1:]:
        if len(r) <= com_i or r[dep_i].strip() != "ZB":
            continue
        code = "972" + r[com_i].strip()[-2:]
        for b in range(start, len(r) - len(block) + 1, len(block)):
            cells = r[b:b + len(block)]
            if not cells[col["Nom"]].strip():
                continue
            seats = int(cells[col["Sièges / Elu"]].strip() or 0)
            out[code].append((cells[col["Nom"]].strip(), cells[col["Prénom"]].strip(), cells[col["Liste"]].strip(), seats))
    return out


def main():
    existing = yaml.safe_load(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    have = {(h["commune"], h["term"]) for h in existing or []}
    communes = sorted({r["code"] for r in json.loads((ROOT / "data" / "build" / "communes.json").read_text("utf-8"))})
    new = []
    for term, (start, end, year) in TERMS.items():
        t1, t2 = lists(f"municipales-{year}-t1"), lists(f"municipales-{year}-t2")
        for code in communes:
            if (code, term) in have:
                continue
            decisive, ds = (t2, f"municipales-{year}-t2") if sum(s for *_, s in t2.get(code, [])) else \
                           (t1, f"municipales-{year}-t1")
            cands = decisive.get(code, [])
            row = {"commune": code, "term": term, "start": start, "end": end, "verified": False}
            if cands and max(s for *_, s in cands) > 0:
                last, first, liste, seats = max(cands, key=lambda c: c[3])
                row.update(last_name=last, first_name=first, source_id=ds,
                           source_url=MANIFEST[ds]["dataset_page"],
                           note=f"Tête de la liste « {liste} » ({seats} sièges) — à vérifier : maire élu par le conseil")
            else:
                row.update(last_name=None, first_name=None, source_id="vwapepla-historique-maires", source_url=None,
                           note="À compléter (commune de moins de 1 000 hab. ou résultats absents)")
            new.append(row)
    for code in communes:  # 2008-2014: no machine-readable results used yet
        if (code, "2008-2014") not in have:
            new.append({"commune": code, "term": "2008-2014", "start": "2008-03-09", "end": "2014-03-23",
                        "verified": False, "last_name": None, "first_name": None,
                        "source_id": "vwapepla-historique-maires", "source_url": None, "note": "À compléter"})
    rows = sorted((existing or []) + new, key=lambda h: (h["commune"], h["term"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("# Past mayors by term. Seeded from official results (head of the winning list), then checked by hand.\n"
                   "# Set verified: true only after checking (council deliberation, prefecture, press). Card shows verified rows only.\n"
                   + yaml.safe_dump(rows, allow_unicode=True, sort_keys=False, width=120), encoding="utf-8")
    filled = sum(1 for r in new if r["last_name"])
    print(f"{len(new)} rows added ({filled} seeded from results, {len(new) - filled} to fill in); {len(rows)} total")


if __name__ == "__main__":
    main()
