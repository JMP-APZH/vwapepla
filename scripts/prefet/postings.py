"""Postings in the préfecture of Martinique, from the appointment decrees published in the JORF (Légifrance API).

Pure functions, used by scripts/prefet/build.py. Input: rows of the jorf-nominations-972 and jorf-parcours CSVs
(scripts/prefet/sources.py). Output: persons, mandates, pref_posting_events, pref_career_steps rows + a report.

Rules (docs/branches/B4-DISCOVERY.md §2 and §8):
- a posting starts on the signature date of its appointment decree (mandates.start_date); « à compter du … » in Article 1,
  when stated, is the start of the function (function_start);
- it ends on the earliest of: an end-of-functions decree for that person and post, the appointment of a successor on the
  same seat, the person's next appointment decree (any post). None of these = still in post (end_date null);
- a decree is attributed to a person only if the name in its title matches exactly (accents and case ignored):
  the API's phrase search also returns « AUBERT (Marie-Hélène) » for « AUBERT (Marie) »;
- career steps: appointment-type decrees naming the person; decrees that mention no prefectoral post are left out and
  reported (possible homonyms, e.g. a magistrate of the same name), never loaded.
"""
import datetime as dt
import re
import unicodedata

TITLE = re.compile(r"^(?P<nature>Décret|Arrêté)\s+du\s+.+?\s+portant\s+(?P<act>.+?)\s+-\s+(?P<civ>M\.|Mme)\s+"
                   r"(?P<last>[^()]+?)\s+\((?P<first>[^()]+)\)\s*$")
MONTHS = {m: i for i, m in enumerate(["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
                                      "septembre", "octobre", "novembre", "décembre"], 1)}
EFFECTIVE = re.compile(r"à compter du (\d{1,2})\s*(?:er|e)?\s+(" + "|".join(MONTHS) + r")\s+(\d{4})", re.I)
PREFECTORAL = re.compile(r"préf|cabinet|administration préfectorale", re.I)


def fold(s):
    """Accents and case ignored, spaces collapsed: key for matching names."""
    s = unicodedata.normalize("NFKD", s)
    return re.sub(r"\s+", " ", "".join(c for c in s if not unicodedata.combining(c))).strip().upper()


def day(ms):
    """Légifrance dates are epoch milliseconds at 00:00 UTC."""
    return dt.datetime.fromtimestamp(int(ms) / 1000, dt.timezone.utc).date().isoformat() if ms else None


def effective_date(text):
    m = EFFECTIVE.search(text or "")
    return dt.date(int(m[3]), MONTHS[m[2].lower()], int(m[1])).isoformat() if m else None


def parse_title(title):
    """'Décret du … portant nomination du sous-préfet du Marin - M. NAUDIN (Patrick)' ->
    {act: nomination|cessation|other, post, civ, last, first}; None if the title names nobody."""
    m = TITLE.match(re.sub(r"\s+", " ", title or "").strip())
    if not m:
        return None
    act = m["act"]
    kind = ("nomination" if act.startswith("nomination") else "cessation" if act.startswith("cessation de fonctions")
            else "other")
    post = re.sub(r"^(nomination|cessation de fonctions)\s+(du |de la |de l'|d'un |d'une |des |de |au |à la |dans )?",
                  "", act) if kind != "other" else act
    return {"act": kind, "post": post.strip(), "civ": m["civ"], "last": m["last"].strip(), "first": m["first"].strip()}


def seats_for(post):
    """Seat keys of a post as written in a decree title ([] = not one of the six seats on the card)."""
    p = fold(post)
    if re.match(r"(PREFET|PREFETE) DE (LA )?REGION MARTINIQUE", p):
        return ["prefet"]
    if re.match(r"SECRETAIRE GENERALE? DE LA PREFECTURE DE LA MARTINIQUE", p):
        return ["secretaire_general"]
    if re.match(r"(DIRECTEUR|DIRECTRICE) DE CABINET DU PREFET DE (LA )?REGION MARTINIQUE", p):
        return ["directeur_cabinet"]
    m = re.match(r"SOUS-PREFETE? (DE LA TRINITE ET DE SAINT-PIERRE|DE LA TRINITE|DU MARIN|DE SAINT-PIERRE)(.*)", p)
    if not m or "REUNION" in m[2]:
        return []
    return {"DE LA TRINITE ET DE SAINT-PIERRE": ["sous_prefet-2", "sous_prefet-4"], "DE LA TRINITE": ["sous_prefet-2"],
            "DU MARIN": ["sous_prefet-3"], "DE SAINT-PIERRE": ["sous_prefet-4"]}[m[1]]


def previous_post(article_1, first, last):
    """'M. Franck ROBINE, préfet de la région Martinique, préfet de la Martinique, est nommé …' -> the text between
    the name and « est nommé(e) », as written."""
    a = re.sub(r"^Par (décret|arrêté) [^,]+, ", "", article_1 or "")
    m = re.match(r"(?:M\.|Mme)\s+(.+?),\s+(.+?),?\s+(?:est|sont)\s+(?:nommée?|désignée?)\b", a)
    if not m or fold(last) not in fold(m[1]) or fold(first.split()[0]) not in fold(m[1]):
        return None
    return m[2].strip().rstrip(",")


def build_postings(nominations, careers, body, source_nom, source_car):
    """-> (persons, mandates, events, career_steps, report, errors)."""
    report, errors = [], []
    texts = {}
    for src, rows in ((source_nom, nominations), (source_car, careers)):
        for r in rows:
            t = parse_title(r["title"])
            if t is None:
                continue
            texts.setdefault(r["cid"], {**t, "cid": r["cid"], "date": day(r["signature_date"]), "url": r["url"],
                                        "article_1": r["article_1"], "source": src, "title": r["title"]})
    people = {}  # folded (last, first) -> display names, sex
    for t in sorted(texts.values(), key=lambda t: t["date"]):
        key = (fold(t["last"]), fold(t["first"]))
        last = t["last"] if re.search(r"[A-ZÀ-Ý]{3}", t["last"]) else t["last"].upper()  # 'Mancini' -> 'MANCINI'
        people[key] = {"last_name": last, "first_name": t["first"], "sex": "F" if t["civ"] == "Mme" else "M"}
        t["person"] = key
    pid = {k: f"pref:{k[0]}:{k[1].title()}" for k in people}

    # Postings on the six seats: one start per (person, seat, appointment decree).
    nomin = [t for t in texts.values() if t["act"] == "nomination" and seats_for(t["post"])]
    ends = [t for t in texts.values() if t["act"] == "cessation" and seats_for(t["post"])]
    other_972 = sorted({t["post"] for t in texts.values() if t["source"] == source_nom and not seats_for(t["post"])
                        and t["act"] in ("nomination", "cessation") and "MARTINIQUE" in fold(t["post"])})
    report += [f"Martinique post not on the card (not loaded): {p}" for p in other_972]
    next_nomination = {}
    for t in texts.values():  # a new post (not a seat on a board or committee) ends the previous posting
        if t["act"] == "nomination" and PREFECTORAL.search(t["title"] + " " + t["article_1"])                 and not re.match(r"(au |à la )?(conseil|comité|membre)", t["post"], re.I)                 and not re.search(r"membre (titulaire |suppléant )?d", t["article_1"]):
            next_nomination.setdefault(t["person"], []).append(t["date"])

    mandates, events = [], []
    for t in sorted(nomin, key=lambda t: (t["date"], t["cid"])):
        for seat in seats_for(t["post"]):
            seat_id = f"{body}:{seat}"
            cands = []
            cands += [(e["date"], "end", e) for e in ends if e["person"] == t["person"] and seat in seats_for(e["post"])
                      and e["date"] >= t["date"]]
            cands += [(n["date"], "successor", n) for n in nomin if seat in seats_for(n["post"])
                      and n["person"] != t["person"] and n["date"] > t["date"]]
            cands += [(d, "next_post", None) for d in next_nomination.get(t["person"], []) if d > t["date"]]
            end = min(cands, key=lambda c: c[0]) if cands else None
            mandates.append({"person_id": pid[t["person"]], "seat_id": seat_id, "start_date": t["date"],
                             "function_start": effective_date(t["article_1"]), "end_date": end[0] if end else None,
                             "acquired": "appointment", "term_id": None, "verified": True, "source_id": t["source"],
                             "source_url": t["url"]})
            base = f"{pid[t['person']]}:{seat}"
            events.append({"id": f"{base}:appointment:{t['date']}", "mandate_id": None, "seat_id": seat_id,
                           "kind": "appointment", "event_date": t["date"],
                           "detail": previous_post(t["article_1"], t["first"], t["last"]),
                           "source_id": t["source"], "source_url": t["url"]})
            if mandates[-1]["function_start"]:
                events.append({"id": f"{base}:taking_office:{mandates[-1]['function_start']}", "mandate_id": None,
                               "seat_id": seat_id, "kind": "taking_office", "event_date": mandates[-1]["function_start"],
                               "detail": "« à compter du » (article 1 du décret de nomination)",
                               "source_id": t["source"], "source_url": t["url"]})
            if end and end[1] == "end":
                e = end[2]
                events.append({"id": f"{base}:end:{e['date']}", "mandate_id": None, "seat_id": seat_id, "kind": "end",
                               "event_date": e["date"], "detail": "Décret portant cessation de fonctions",
                               "source_id": e["source"], "source_url": e["url"]})
    # End decrees whose appointment is before the search window (2007): reported, not loaded (start date unknown).
    for e in ends:
        if not any(m["person_id"] == pid[e["person"]] and m["start_date"] <= e["date"] for m in mandates):
            report.append(f"end decree without appointment in range (not loaded): {e['date']} {e['title'][:120]}")

    # Career steps of the people posted on the card.
    posted = {m["person_id"] for m in mandates}
    steps = []
    for t in sorted(texts.values(), key=lambda t: (t["date"], t["cid"])):
        if pid[t["person"]] not in posted:
            continue
        if not PREFECTORAL.search(t["title"] + " " + t["article_1"]):
            report.append(f"career step left out (no prefectoral post, possible homonym): {pid[t['person']]} "
                          f"{t['date']} {t['title'][:110]}")
            continue
        steps.append({"id": f"jorf-{t['cid']}:{pid[t['person']]}", "person_id": pid[t["person"]],
                      "signature_date": t["date"], "post": re.sub(r"^(Décret|Arrêté) du .+? portant ", "",
                                                                    t["title"]).rsplit(" - ", 1)[0].strip(),
                      "previous_post": previous_post(t["article_1"], t["first"], t["last"]) if t["act"] == "nomination"
                      else None, "effective_date": effective_date(t["article_1"]), "source_id": t["source"],
                      "source_url": t["url"]})
    persons = [{"id": pid[k], **v} for k, v in sorted(people.items()) if pid[k] in posted]
    seen = set()
    for m in mandates:
        k = (m["person_id"], m["seat_id"], m["start_date"])
        if k in seen:
            errors.append(f"duplicate mandate {k}")
        seen.add(k)
    return persons, mandates, events, steps, report, errors
