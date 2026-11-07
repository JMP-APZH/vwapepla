"""Votes on the commune's action: data/communes/audit/vote_criteria.yaml + vote_closures.yaml
-> data/build/communes/{com_vote_criteria,com_vote_closures}.json

Validates the criteria (validated by JM on 7 Nov 2026: wording and competence must not change without his decision)
and the pre-election closures (dates decided by JM after the legal review, each with a source URL).
Run: python -I scripts/communes/pipeline/build_votes.py
then python -I scripts/core/load_supabase.py --domain communes com_vote_criteria com_vote_closures
"""
import datetime, json, pathlib, re, sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
AUDIT, BUILD = ROOT / "data" / "communes" / "audit", ROOT / "data" / "build" / "communes"
COMPETENCES = {"commune", "partagee"}
OTHERS = {"EPCI", "CTM", "État"}
REF_STATUSES = {"to_confirm", "confirmed"}
KEY = re.compile(r"^[a-z][a-z_]{2,40}$")
# Words that would make a question about a person or about the budget (CLAUDE.md principles 2 and 4).
FORBIDDEN = re.compile(r"\b(maire|adjoint|élu|budget|argent|dette|impôt)s?\b", re.I)


def criteria(errors):
    doc = yaml.safe_load((AUDIT / "vote_criteria.yaml").read_text(encoding="utf-8"))
    if doc.get("min_votes") != 20:
        errors.append("vote_criteria.yaml: min_votes must stay 20 (CLAUDE.md principle 4)")
    rows, seen = [], set()
    for i, c in enumerate(doc["criteria"], 1):
        k = c.get("key", "")
        where = f"criterion {k or i}"
        if not KEY.match(k) or k in seen:
            errors.append(f"{where}: bad or duplicate key")
        seen.add(k)
        if c.get("competence") not in COMPETENCES:
            errors.append(f"{where}: competence must be one of {sorted(COMPETENCES)}")
        others = c.get("others") or []
        if not set(others) <= OTHERS:
            errors.append(f"{where}: others must be among {sorted(OTHERS)}")
        if (c.get("competence") == "partagee") != bool(others):
            errors.append(f"{where}: 'partagee' needs others, 'commune' must have none")
        if c.get("ref_status") not in REF_STATUSES:
            errors.append(f"{where}: ref_status must be one of {sorted(REF_STATUSES)}")
        for f in ("label_fr", "commune_role_fr"):
            if not str(c.get(f) or "").strip():
                errors.append(f"{where}: {f} is empty")
        if FORBIDDEN.search(c.get("label_fr", "")):
            errors.append(f"{where}: the question names a person or the budget")
        rows.append({"key": k, "label_fr": c["label_fr"].strip(), "competence": c["competence"], "others": others,
                     "commune_role_fr": c["commune_role_fr"].strip(), "ref_status": c["ref_status"],
                     "display_order": i * 10})
    return rows


def closures(errors, communes):
    f = AUDIT / "vote_closures.yaml"
    items = (yaml.safe_load(f.read_text(encoding="utf-8")) or {}).get("closures") or []
    rows = []
    for c in items:
        cid = c.get("id", "")
        try:
            start, end = datetime.date.fromisoformat(str(c["starts_on"])), datetime.date.fromisoformat(str(c["ends_on"]))
        except (KeyError, ValueError):
            errors.append(f"closure {cid}: starts_on / ends_on must be dates (YYYY-MM-DD)")
            continue
        if end < start:
            errors.append(f"closure {cid}: ends before it starts")
        code = c.get("commune_code")
        if code is not None and str(code) not in communes:
            errors.append(f"closure {cid}: unknown commune {code}")
        if not str(c.get("source_url", "")).startswith("https://") or not str(c.get("reason_fr") or "").strip():
            errors.append(f"closure {cid}: reason_fr and an https source_url are required")
        rows.append({"id": cid, "commune_code": None if code is None else str(code), "starts_on": start.isoformat(),
                     "ends_on": end.isoformat(), "reason_fr": c.get("reason_fr"), "source_url": c.get("source_url")})
    if len({r["id"] for r in rows}) != len(rows):
        errors.append("vote_closures.yaml: duplicate ids")
    return rows


def main():
    errors = []
    communes = {f"972{n:02d}" for n in range(1, 35)}
    crit, clos = criteria(errors), closures(errors, communes)
    if errors:
        sys.exit("\n".join(["build_votes: errors"] + errors))
    BUILD.mkdir(parents=True, exist_ok=True)
    for name, rows in (("com_vote_criteria", crit), ("com_vote_closures", clos)):
        (BUILD / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"com_vote_criteria {len(crit)} rows, com_vote_closures {len(clos)} rows -> {BUILD}")


if __name__ == "__main__":
    main()
