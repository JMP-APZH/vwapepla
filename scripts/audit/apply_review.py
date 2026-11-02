"""Apply JM's review choices (text copied from the review page) to data/audit/sites/<insee>.yaml.

Input lines:  <insee> <criterion> <yes|partial|no|na> <url|-> [// comment]   or   <insee> relu
Each choice sets status, method: manual and, if given, evidence_url and note. "relu" sets reviewed_by: JM.
Run: python -I scripts/audit/apply_review.py review.txt   (or pipe the text on stdin)
"""
import datetime, pathlib, re, sys

import yaml

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parents[2]
SITES = ROOT / "data" / "audit" / "sites"
LINE = re.compile(r"^(972\d\d) (\w+) (yes|partial|no|na) (\S+)(?: // (.*))?$")
HEADER = ("# Audit du site de la mairie — PREMIÈRE PASSE AUTOMATIQUE, relue par JM (points method: manual).\n"
          "# status: yes / partial / no / na · method: automated (règles par mots-clés) ou manual (relu à la main).\n"
          "# « no » automatique = non trouvé par la recherche, pas une preuve d'absence. Rien n'est publié avant reviewed_by.\n")


def main():
    text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8") if sys.argv[1:] else sys.stdin.read()
    today = datetime.date.today().isoformat()
    files, errors, n = {}, [], 0
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        code = line[:5]
        path = SITES / f"{code}.yaml"
        if not path.exists():
            errors.append(f"commune inconnue : {line}"); continue
        a = files.setdefault(code, yaml.safe_load(path.read_text(encoding="utf-8")))
        if line == f"{code} relu":
            a["reviewed_by"] = "JM"; n += 1; continue
        m = LINE.match(line)
        if not m or m.group(2) not in a["items"]:
            errors.append(f"ligne non comprise : {line}"); continue
        _, key, status, url, note = m.groups()
        it = a["items"][key]
        it["status"], it["method"] = status, "manual"
        if url != "-":
            if not url.startswith(("https://", "http://")):
                errors.append(f"lien non valide : {line}"); continue
            it["evidence_url"], it["archive_url"] = url, None
        it["note"] = note.strip() if note else f"Vérifié à la main le {today}."
        if status in ("yes", "partial") and not it.get("evidence_url"):
            errors.append(f"« {status} » sans lien de preuve (à ajouter avant publication) : {line}")
        n += 1
    for code, a in files.items():
        (SITES / f"{code}.yaml").write_text(HEADER + yaml.safe_dump(a, allow_unicode=True, sort_keys=False, width=120),
                                            encoding="utf-8")
    print(f"{n} choix appliqués dans {len(files)} communes")
    for e in errors:
        print("ERREUR", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
