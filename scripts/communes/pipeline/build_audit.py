"""Website audit: data/communes/audit/criteria.yaml + data/communes/audit/sites/<insee>.yaml -> data/build/communes/{com_audit_criteria,com_site_audits,com_site_audit_items}.json

Validates every file (known criteria, all criteria present, valid status, evidence for yes/partial).
Only REVIEWED audits (reviewed_by set) are exported: the tables are publicly readable, drafts must never be.
Run: python -I scripts/communes/pipeline/build_audit.py   then   python -I scripts/core/load_supabase.py --domain communes com_audit_criteria com_site_audits com_site_audit_items
"""
import json, pathlib, sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[3]
AUDIT, BUILD = ROOT / "data" / "communes" / "audit", ROOT / "data" / "build" / "communes"
STATUSES = {"yes", "partial", "no", "na"}
FAMILIES = {"legal", "quality", "civic"}
THEMES = {"site", "argent_public", "information", "suivi_usagers", "participation"}


def main():
    crit = yaml.safe_load((AUDIT / "criteria.yaml").read_text(encoding="utf-8"))["criteria"]
    errors, keys = [], [c["key"] for c in crit]
    if len(set(keys)) != len(keys):
        errors.append("criteria.yaml: duplicate keys")
    criteria = []
    for i, c in enumerate(crit, 1):
        if c["family"] not in FAMILIES or c["theme"] not in THEMES:
            errors.append(f"criterion {c['key']}: bad family/theme")
        if c["family"] == "legal" and not str(c.get("ref_status", "")).startswith("verified"):
            errors.append(f"criterion {c['key']}: legal criterion with an unverified reference")
        criteria.append({"key": c["key"], "family": c["family"], "theme": c["theme"], "label_fr": c["label_fr"],
                         "description_fr": c.get("description_fr"), "legal_ref": c.get("legal_ref"),
                         "applies_if": c.get("applies_if"), "display_order": i * 10})
    audits, items, drafts = [], [], 0
    for f in sorted((AUDIT / "sites").glob("972*.yaml")):
        a = yaml.safe_load(f.read_text(encoding="utf-8"))
        got = set(a["items"])
        if got != set(keys):
            errors.append(f"{f.name}: criteria missing {sorted(set(keys) - got)} / unknown {sorted(got - set(keys))}")
        for k, v in a["items"].items():
            if v["status"] not in STATUSES:
                errors.append(f"{f.name} {k}: bad status {v['status']}")
            if v["status"] in ("yes", "partial") and not v.get("evidence_url"):
                errors.append(f"{f.name} {k}: {v['status']} without evidence_url")
        if not a.get("reviewed_by"):
            drafts += 1
            continue
        aid = f"{a['commune_code']}-{a['audited_on']}"
        audits.append({"id": aid, "commune_code": a["commune_code"], "audited_on": str(a["audited_on"]),
                       "site_url": a.get("site_url"), "auditor": a["auditor"], "reviewed_by": a["reviewed_by"],
                       "notes": a.get("notes")})
        items += [{"audit_id": aid, "criterion_key": k, "status": v["status"], "evidence_url": v.get("evidence_url"),
                   "archive_url": v.get("archive_url"), "note": v.get("note"), "method": v.get("method", "manual")}
                  for k, v in a["items"].items()]
    if errors:
        sys.exit("\n".join(errors))
    for name, rows in (("com_audit_criteria", criteria), ("com_site_audits", audits), ("com_site_audit_items", items)):
        (BUILD / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(criteria)} criteria · {len(audits)} reviewed audits exported ({len(items)} items) · {drafts} drafts kept out")


if __name__ == "__main__":
    main()
