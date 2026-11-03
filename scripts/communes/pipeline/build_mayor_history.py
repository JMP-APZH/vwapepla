"""Build data/communes/officeholders/history.yaml: who was mayor during each past term, from official sources first.

Evidence, strongest first (each row says which one it rests on, in `basis`):
  rne      Répertoire national des élus, every version published Jan 2020 - Dec 2025 (`rne-maires-historique`) and the
           outgoing mayors at 27 Feb 2026 (`maires-sortants-2026`): the mayor in office and the date the function began.
           Gives 2014-2020 (as of Jan 2020) and the whole of 2020-2026, including changes during the term.
  liste    Official results (`municipales-2008`, `municipales-2014-t1/t2`): head of the list that won the most seats.
           The council elects the mayor; in Martinique the head of the winning list became mayor in every case we can
           check against the RNE (2014 and 2020: checked again below at every run). Used for 2008-2014 (communes of
           3,500+ inhabitants) and for the first mayor of 2014-2020 where the RNE shows a later start.
  secondaire  data/communes/officeholders/history_secondary.yaml (Wikipedia, dated permalinks) where no official list
           exists: 2008-2014 in communes under 3,500 inhabitants, and a few changes before January 2020.

Deterministic: same inputs -> same file. Run: python -I scripts/communes/pipeline/build_mayor_history.py
"""
import collections, csv, datetime, json, pathlib, re, sys, unicodedata

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
RAW = ROOT / "data" / "raw" / "communes"
MANIFEST = json.loads((RAW / "manifest.json").read_text(encoding="utf-8"))
OUT = ROOT / "data" / "communes" / "officeholders" / "history.yaml"
SECONDARY = ROOT / "data" / "communes" / "officeholders" / "history_secondary.yaml"

TERMS = {"2008-2014": ("2008-03-09", "2014-03-23"), "2014-2020": ("2014-03-23", "2020-03-15"),
         "2020-2026": ("2020-03-15", "2026-03-15")}
ROUND_DATES = {2008: ("2008-03-09", "2008-03-16"), 2014: ("2014-03-23", "2014-03-30"), 2020: ("2020-03-15", "2020-06-28")}
LATE_START_DAYS = 60  # an RNE function start this long after the election = the mayor changed during the term


def norm(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper().strip()


def tokens(s):
    return set(re.split(r"[\s\-']+", norm(s))) - {""}


def same_person(a, b):
    """Same commune assumed. Last names share their first word (DULYS / DULYS-PETIT), first names share a word
    (Alban Maurice / Maurice, Bruno Jean-Claude / Jean-Claude)."""
    la, lb = re.split(r"[\s\-]+", norm(a["last_name"]))[0], re.split(r"[\s\-]+", norm(b["last_name"]))[0]
    return la == lb and bool(not a.get("first_name") or not b.get("first_name") or tokens(a["first_name"]) & tokens(b["first_name"]))


def raw_file(ds):
    return ROOT / MANIFEST[ds]["file"]


def term_of(day):
    for t, (s, e) in TERMS.items():
        if s <= day < e:
            return t
    return None


def heads(year):
    """{insee: head of the list with the most seats in the decisive round} for one election year."""
    out = {}
    if year == 2008:
        rows = list(csv.DictReader(open(raw_file("municipales-2008"), encoding="utf-8"), delimiter=";"))
        by = collections.defaultdict(lambda: collections.defaultdict(list))
        for r in rows:
            by[r["insee"]][int(r["tour"])].append(r)
        for code, rounds in by.items():
            tour = 2 if sum(int(r["sieges"]) for r in rounds.get(2, [])) else 1
            win = max(rounds[tour], key=lambda r: int(r["sieges"]))
            out[code] = {"last_name": win["nom"], "first_name": win["prenom"], "sex": win["sexe"] or None,
                         "start": ROUND_DATES[year][tour - 1], "source_id": "municipales-2008",
                         "source_url": MANIFEST["municipales-2008"]["dataset_page"],
                         "note": f"Tête de la liste « {win['liste']} » ({win['sieges']} sièges)."}
        return out
    for tour in (2, 1):  # a second round, when held, decides
        ds = f"municipales-{year}-t{tour}"
        text = raw_file(ds).read_text(encoding="latin-1")
        delim = "\t" if text.split("\n", 1)[0].count("\t") > text.split("\n", 1)[0].count(";") else ";"
        rows = list(csv.reader(text.splitlines(), delimiter=delim))
        hdr = [h.strip() for h in rows[0]]
        start = hdr.index("N.Pan.") if "N.Pan." in hdr else hdr.index("Code Nuance")
        block = hdr[start:hdr.index("% Voix/Exp") + 1]
        col = {h: i for i, h in enumerate(block)}
        dep, com = hdr.index("Code du département"), hdr.index("Code de la commune")
        for r in rows[1:]:
            if len(r) <= com or r[dep].strip() != "ZB":
                continue
            code = "972" + r[com].strip()[-2:]
            if code in out:
                continue
            lists = []
            for b in range(start, len(r) - len(block) + 1, len(block)):
                cells = r[b:b + len(block)]
                if cells[col["Nom"]].strip():
                    lists.append((int(cells[col["Sièges / Elu"]].strip() or 0), cells))
            if not lists or max(s for s, _ in lists) == 0:
                continue
            seats, cells = max(lists, key=lambda x: x[0])
            out[code] = {"last_name": cells[col["Nom"]].strip(), "first_name": cells[col["Prénom"]].strip(),
                         "sex": (cells[col["Sexe"]].strip() or None) if "Sexe" in col else None,
                         "start": ROUND_DATES[year][tour - 1], "source_id": ds,
                         "source_url": MANIFEST[ds]["dataset_page"],
                         "note": f"Tête de la liste « {cells[col['Liste']].strip()} » ({seats} sièges)."}
    return out


def rne_stints():
    """{insee: [rne row]} one row per (person, term), in order; the start is the function start of the latest version
    that shows it (later versions correct earlier ones), the source the first version that shows it."""
    rows = list(csv.DictReader(open(raw_file("rne-maires-historique"), encoding="utf-8"), delimiter=";"))
    sortants = [r for r in csv.DictReader(open(raw_file("maires-sortants-2026"), encoding="utf-8"), delimiter=";")
                if r["Code de la commune"].startswith("972")]
    d = lambda s: datetime.datetime.strptime(s, "%d/%m/%y").date().isoformat()  # noqa: E731
    rows += [{"version": "2026-02-27", "fetched_from": MANIFEST["maires-sortants-2026"]["url"],
              "insee": r["Code de la commune"], "nom": r["Nom de l'élu"], "prenom": r["Prénom de l'élu"],
              "sexe": r["Code sexe"], "debut_fonction": d(r["Date de début de la fonction"])} for r in sortants]
    out = collections.defaultdict(list)
    for r in sorted(rows, key=lambda r: (r["insee"], r["version"])):
        p = {"last_name": r["nom"], "first_name": r["prenom"], "sex": r["sexe"] or None}
        term = term_of(r["debut_fonction"])
        prev = out[r["insee"]][-1] if out[r["insee"]] else None
        if prev and prev["term"] == term and same_person(prev, p):
            prev.update(p, start=r["debut_fonction"], last_seen=r["version"])  # latest spelling and start date
            continue
        src = "maires-sortants-2026" if r["version"] == "2026-02-27" else "rne-maires-historique"
        out[r["insee"]].append({**p, "term": term, "start": r["debut_fonction"], "first_seen": r["version"],
                                "last_seen": r["version"], "source_id": src, "source_url": r["fetched_from"]})
    return out


def main():
    errors, rows = [], []
    rne = rne_stints()
    h08, h14, h20 = heads(2008), heads(2014), heads(2020)
    communes = sorted(rne)
    if len(communes) != 34:
        errors.append(f"RNE history: {len(communes)} communes, expected 34")

    # 1. Check the head-of-list rule where the RNE gives the answer (first mayor of 2014-2020 and of 2020-2026).
    checked = agree = 0
    for code in communes:
        first14 = next((s for s in rne[code] if s["term"] == "2014-2020"), None)
        first20 = next((s for s in rne[code] if s["term"] == "2020-2026"), None)
        # 2014-2020: the earliest RNE version is Jan 2020, so its mayor tests the rule only if in office since 2014.
        # 2020-2026: the first RNE mayor is the one installed after the election (May-July 2020, delayed by Covid).
        for head, first, may_be_later in ((h14.get(code), first14, True), (h20.get(code), first20, False)):
            if head and first:
                late = (datetime.date.fromisoformat(first["start"]) - datetime.date.fromisoformat(head["start"])).days
                if may_be_later and late > LATE_START_DAYS:
                    continue  # mayor changed during the term: not a test of the rule
                checked += 1
                agree += same_person(head, first)
                if not same_person(head, first):
                    errors.append(f"{code}: head of list {head['last_name']} but RNE mayor {first['last_name']}")
    print(f"head of the winning list = mayor (RNE): {agree} / {checked}")

    # 2. Rows per commune and term.
    for code in communes:
        stints = rne[code]
        jan2020 = next(s for s in stints if s["term"] == "2014-2020")
        start14 = h14.get(code, {}).get("start", TERMS["2014-2020"][0])
        late = (datetime.date.fromisoformat(jan2020["start"]) - datetime.date.fromisoformat(start14)).days
        if code in h08:
            rows.append({"commune": code, "term": "2008-2014", "basis": "liste", **h08[code]})
        if late > LATE_START_DAYS:  # changed during 2014-2020: the first mayor is the head of the 2014 winning list
            if code not in h14:
                errors.append(f"{code}: mayor changed during 2014-2020 and no 2014 list result")
            else:
                rows.append({"commune": code, "term": "2014-2020", "basis": "liste", **h14[code]})
        for s in stints:
            note = None
            if s["source_id"] == "rne-maires-historique":
                note = f"Répertoire national des élus, versions du {fr_date(s['first_seen'])} au {fr_date(s['last_seen'])}."
            rows.append({"commune": code, "term": s["term"], "basis": "rne", "last_name": s["last_name"],
                         "first_name": s["first_name"], "sex": s["sex"], "start": s["start"],
                         "source_id": s["source_id"], "source_url": s["source_url"], "note": note})
    rows = [r for r in rows if r["term"] in TERMS]  # 2026-2032 mayors come from the current RNE in build.py

    # 3. Secondary rows (Wikipedia): extra mayors, and end dates of official rows that ended before the next one.
    ends = []
    for s in yaml.safe_load(SECONDARY.read_text(encoding="utf-8")) or []:
        s = {k: (v.isoformat() if isinstance(v, datetime.date) else v) for k, v in s.items()}
        if s["kind"] == "mayor":
            rows.append({"commune": s["commune"], "term": s["term"], "basis": "secondaire", "last_name": s["last_name"],
                         "first_name": s["first_name"], "sex": s.get("sex"), "start": s["start"], "end": s["end"],
                         "source_id": "vwapepla-historique-maires", "source_url": s["source_url"],
                         "note": s.get("note"), "date_note": s.get("date_note")})
        elif s["kind"] == "end":
            ends.append(s)
        else:
            errors.append(f"history_secondary.yaml: unknown kind {s['kind']!r}")
    for e in ends:
        hit = [r for r in rows if r["commune"] == e["commune"] and r["term"] == e["term"]
               and same_person(r, {"last_name": e["last_name"]}) and r["basis"] != "secondaire" and r["start"] < e["end"]]
        hit = sorted(hit, key=lambda r: r["start"])[-1:]  # same mayor twice in a term (left, then re-elected)
        if len(hit) != 1:
            errors.append(f"history_secondary.yaml: end row {e['commune']} {e['last_name']} matches {len(hit)} rows")
            continue
        hit[0].update(end=e["end"], end_source_url=e["source_url"],
                      note=" ".join(x for x in (hit[0].get("note"), e.get("note")) if x))

    # 4. Order, end dates (the next mayor's start, or the next term's first start), one spelling per person.
    by = collections.defaultdict(list)
    for r in rows:
        by[r["commune"]].append(r)
    out = []
    for code in communes:
        seq = sorted(by[code], key=lambda r: (r["start"], r["basis"] != "rne"))
        for i, r in enumerate(seq):
            nxt = seq[i + 1]["start"] if i + 1 < len(seq) else TERMS[r["term"]][1]
            r["end"] = min(r.get("end") or nxt, nxt)
            if r["end"] < r["start"]:
                errors.append(f"{code}: {r['last_name']} ends before it starts")
        for t, (ts, te) in TERMS.items():
            mine = [r for r in seq if r["term"] == t]
            if not mine:
                errors.append(f"{code}: no mayor for {t}")
                continue
            for a, b in zip(mine, mine[1:] + [None]):
                gap_end = b["start"] if b else None
                if gap_end and (datetime.date.fromisoformat(gap_end) - datetime.date.fromisoformat(a["end"])).days > 7:
                    print(f"note: {code} {t}: no mayor between {a['end']} and {gap_end} (vacancy or special delegation)")
        canonical(seq)
        out += seq

    if errors:
        sys.exit("errors:\n  " + "\n  ".join(errors))
    keys = ["commune", "term", "start", "end", "last_name", "first_name", "sex", "basis", "verified", "source_id",
            "source_url", "end_source_url", "date_note", "note"]
    for r in out:
        r["verified"] = r["basis"] in ("rne", "liste")
    header = ("# Mayors of each past term. GENERATED by scripts/communes/pipeline/build_mayor_history.py: do not edit.\n"
              "# Official sources first (basis: rne, liste); basis: secondaire comes from history_secondary.yaml.\n")
    OUT.write_text(header + yaml.safe_dump([{k: r[k] for k in keys if r.get(k) is not None} for r in out],
                                           allow_unicode=True, sort_keys=False, width=200), encoding="utf-8")
    counts = collections.Counter((r["term"], r["basis"]) for r in out)
    for t in TERMS:
        print(t, {b: counts[(t, b)] for b in ("rne", "liste", "secondaire")})
    print(f"wrote {OUT.relative_to(ROOT)} ({len(out)} rows)")


def canonical(seq):
    """One spelling per person within a commune: the most recent official one (RNE first, then the latest list)."""
    rank = {"rne": 0, "liste": 1, "secondaire": 2}
    for r in seq:
        same = [x for x in seq if same_person(x, r)]
        best = min(same, key=lambda x: (rank[x["basis"]], -int(x["start"][:4])))
        r["last_name"], r["first_name"] = best["last_name"], best["first_name"]
        r["sex"] = next((x["sex"] for x in same if x.get("sex")), None)


def fr_date(iso):
    y, m, d = iso.split("-")
    return f"{int(d)}/{int(m)}/{y}"


if __name__ == "__main__":
    main()
