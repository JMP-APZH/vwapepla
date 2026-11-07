"""Natural disaster recognitions (« arrêtés CatNat ») in Martinique, from the GASPAR database. Pure function, used by
build.py. One row per decree, risk and commune, as published; text that the source double-encoded (UTF-8 read as
Latin-1, e.g. « MÃ©canique ») is repaired, nothing else is changed.
"""


def repair(s):
    if s and ("Ã" in s or "Â" in s):
        try:
            return s.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return s
    return s


def day(s):
    return (s or "")[:10] or None


def build_disasters(rows, source_id):
    """-> (pref_disaster_recognitions rows, errors)."""
    out, errors, seen = [], [], set()
    for r in rows:
        key = f"{r['id_gaspar']}:{r['num_risque_jo']}:{r['code_commune']}:{day(r['date_debut'])}"
        if key in seen:
            continue
        seen.add(key)
        if not r["code_commune"].startswith("972") or len(r["code_commune"]) != 5:
            errors.append(f"catnat: {key}: not a commune of Martinique")
            continue
        out.append({"id": key, "nor": r["id_gaspar"], "commune_code": r["code_commune"], "risk_code": r["num_risque_jo"],
                    "risk": repair(r["lib_risque_jo"]), "event_start": day(r["date_debut"]), "event_end": day(r["date_fin"]),
                    "decree_date": day(r["date_signature_arrete"]), "jo_date": day(r["date_publication_jo"]),
                    "source_id": source_id})
    return out, errors
