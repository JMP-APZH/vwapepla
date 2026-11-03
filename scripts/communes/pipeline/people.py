"""Commune officeholders -> core people tables (institutions, bodies, seats, persons, mandates).

Same ids as the migration 20261103120000_core_people_and_com_prefix.sql, so re-running the pipeline upserts the same rows:
  institution 'commune-<insee>' · body 'commune-<insee>-cm' · seat '<body>:maire' | ':adjoint-<rank>' | ':conseiller'
  person 'com-<insee>:<NOM>:<Prénom>' (one per name within a commune; no birth date is kept).
"""


def seat_id(code, role, rank):
    return f"commune-{code}-cm:{role}" + (f"-{rank}" if rank is not None else "")


def seat_label(role, rank):
    return {"maire": "Maire", "adjoint": f"Adjoint au maire n° {rank}"}.get(role, "Conseiller municipal")


def person_id(code, last, first):
    return f"com-{code}:{last}:{first}"


def core_people(communes, officeholders):
    """communes: [{code, name, ...}]; officeholders: rows as built by build.py (commune_code, role, rank, names, ...)."""
    errors = []
    institutions = [{"id": f"commune-{c['code']}", "kind": "commune", "name": c["name"], "code": c["code"]} for c in communes]
    bodies = [{"id": f"commune-{c['code']}-cm", "institution_id": f"commune-{c['code']}", "kind": "conseil_municipal",
               "name": "Conseil municipal"} for c in communes]
    seats, persons, mandates = {}, {}, {}
    for o in officeholders:
        code = o["commune_code"]
        sid = seat_id(code, o["role"], o["rank"])
        seats.setdefault(sid, {"id": sid, "body_id": f"commune-{code}-cm", "role": o["role"], "rank": o["rank"],
                               "label_fr": seat_label(o["role"], o["rank"]), "constituency": None})
        pid = person_id(code, o["last_name"], o["first_name"])
        p = persons.setdefault(pid, {"id": pid, "last_name": o["last_name"], "first_name": o["first_name"], "sex": None})
        if o.get("sex"):
            if p["sex"] and p["sex"] != o["sex"]:
                errors.append(f"person {pid}: conflicting sex values")
            p["sex"] = p["sex"] or o["sex"]
        key = (pid, sid, o["mandate_start"])
        if key in mandates:
            errors.append(f"duplicate mandate {key}")
        mandates[key] = {"person_id": pid, "seat_id": sid, "start_date": o["mandate_start"],
                         "function_start": o["function_start"], "end_date": o["mandate_end"],
                         "acquired": "direct_election" if o["role"] == "conseiller" else "indirect_election",
                         "term_id": o["term_id"], "verified": o["verified"], "source_id": o["source_id"],
                         "source_url": o["source_url"]}
    return {"errors": errors, "institutions": institutions, "bodies": bodies,
            "seats": sorted(seats.values(), key=lambda s: s["id"]),
            "persons": sorted(persons.values(), key=lambda p: p["id"]),
            "mandates": sorted(mandates.values(), key=lambda m: (m["seat_id"], m["start_date"], m["person_id"]))}
