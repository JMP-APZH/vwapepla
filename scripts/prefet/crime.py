"""Recorded crime (SSMSI) and social context (INSEE) for the préfet card. Pure functions, used by build.py.

Crime: Martinique = the département file (972) as published. Comparisons: Guadeloupe (région 01) as published, and
France = sum of the published regional counts, divided by the sum of their populations (or dwellings for burglaries,
as the SSMSI does), x 1,000. The method is checked first: recomputing Martinique's published rate from its own count and
population must give the same value (gate, 0.001 per 1,000).
"""
GEO = {"972": "Martinique", "971": "Guadeloupe", "FR": "France (somme des régions)"}
REGION = {"01": "971"}  # régions file code -> geo key, for the published comparisons
SOURCE_DEP, SOURCE_REG = "ssmsi-delinquance-departements", "ssmsi-delinquance-regions"


def num(s):
    s = (s or "").replace(" ", "").replace(" ", "").replace(",", ".")
    return None if s in ("", "NA") else float(s)


def denominator(r):
    """SSMSI rates: per 1,000 dwellings for burglaries, per 1,000 inhabitants otherwise."""
    return num(r["insee_log"]) if r["indicateur"].startswith("Cambriolages") else num(r["insee_pop"])


def build_crime(dep_rows, region_rows):
    """-> (rows of pref_crime_stats, errors)."""
    out, errors = [], []

    def row(geo, r, count, rate, pop, computed, source):
        return {"id": f"{geo}:{r['annee']}:{r['indicateur']}", "geo": geo, "geo_label": GEO[geo], "year": int(r["annee"]),
                "indicator": r["indicateur"], "unit": r["unite_de_compte"], "count": count, "rate_per_1000": rate,
                "denominator": pop, "computed": computed, "source_id": source}

    for r in dep_rows:
        count, rate, pop = num(r["nombre"]), num(r["taux_pour_mille"]), denominator(r)
        if count is not None and pop and rate is not None and abs(count / pop * 1000 - rate) > 0.001:
            errors.append(f"crime: Martinique {r['annee']} {r['indicateur']}: rate {rate} != {count}/{pop}*1000")
        out.append(row("972", r, count, rate, pop, False, SOURCE_DEP))

    totals = {}
    for r in region_rows:
        if r["Code_region"] in REGION:
            out.append(row(REGION[r["Code_region"]], r, num(r["nombre"]), num(r["taux_pour_mille"]), denominator(r),
                           False, SOURCE_REG))
        key = (r["annee"], r["indicateur"])
        t = totals.setdefault(key, {"r": r, "count": 0.0, "pop": 0.0, "missing": 0})
        c, p = num(r["nombre"]), denominator(r)
        if c is None or not p:
            t["missing"] += 1
            continue
        t["count"] += c
        t["pop"] += p
    for (year, ind), t in sorted(totals.items()):
        if t["missing"]:
            errors.append(f"crime: France {year} {ind}: {t['missing']} regions without count")
            continue
        out.append(row("FR", t["r"], t["count"], round(t["count"] / t["pop"] * 1000, 7), t["pop"], True, SOURCE_REG))
    return out, errors


INSEE_SERIES = {  # idbank -> (geo, age group)
    "001787729": ("972", "all"), "001787732": ("972", "15-24"),
    "001787711": ("FM", "all"), "001787714": ("FM", "15-24"),
}


def build_unemployment(rows, source):
    """INSEE BDM observations -> pref_context_figures rows (as published)."""
    out = []
    for r in rows:
        geo, age = INSEE_SERIES[r["idbank"]]
        if int(r["period"]) < 2014:
            continue  # Martinique's series starts in 2014: same window for France
        out.append({"id": f"chomage:{geo}:{age}:{r['period']}", "indicator": "chomage_bit", "geo": geo,
                    "group_label": "15-24 ans" if age == "15-24" else "Ensemble", "period": r["period"],
                    "value": float(r["value"]), "unit": "%", "note": r["title_fr"], "quote": None,
                    "source_id": source, "source_url": f"https://www.insee.fr/fr/statistiques/serie/{r['idbank']}"})
    return out
