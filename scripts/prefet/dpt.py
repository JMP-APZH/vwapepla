"""State credits in Martinique from the DPT Outre-mer territorial table (one CSV per budget-bill edition).

Each edition gives, per mission and programme, AE and CP for three stages: executed (edition - 2), voted LFI
(edition - 1) and proposed PLF (edition). A programme line starts with its number (3 digits; 4 for the
prélèvements sur recettes, e.g. « 3101 - … dotation globale de fonctionnement »); other lines are missions, then
« Total général ».

Gate: in every edition, programmes add up to their mission and missions to « Total général », within rounding
(published figures are rounded line by line: tolerance = 1 € per line added).
"""
import re

STAGES = (("execution", -2), ("lfi", -1), ("plf", 0))
PROGRAMME = re.compile(r"^(?P<code>\d{3,4}) - (?P<label>.+)$")


def figure(v):
    v = v.strip()
    if v == "-":
        return 0
    return int(re.sub(r"\D", "", v)) * (-1 if v.startswith("-") else 1)


def slug(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def build_dpt(rows, edition, source_id):
    """rows: dicts from the CSV (edition, page, label, execution_ae ... plf_cp). Returns (credits, errors)."""
    errors, missions, total = [], [], None
    for r in rows:
        v = [figure(r[c]) for c in ("execution_ae", "execution_cp", "lfi_ae", "lfi_cp", "plf_ae", "plf_cp")]
        label, page = " ".join(r["label"].split()), int(r["page"])
        if label.lower().startswith("total g"):
            total = (page, v)
            continue
        m = PROGRAMME.match(label)
        if m:
            if not missions:
                errors.append(f"DPT {edition}: programme before any mission: {label}")
                continue
            missions[-1]["programmes"].append({"code": m["code"], "label": m["label"], "page": page, "v": v})
        else:
            missions.append({"label": label, "page": page, "v": v, "programmes": []})
    if total is None:
        return [], [f"DPT {edition}: no « Total général »"]
    for mi in missions:
        sums = [sum(p["v"][i] for p in mi["programmes"]) for i in range(6)]
        tol = max(1, len(mi["programmes"]))
        if mi["programmes"] and any(abs(a - b) > tol for a, b in zip(sums, mi["v"])):
            errors.append(f"DPT {edition} p.{mi['page']}: « {mi['label']} » ≠ sum of its programmes: {mi['v']} vs {sums}")
    sums = [sum(mi["v"][i] for mi in missions) for i in range(6)]
    if any(abs(a - b) > len(missions) for a, b in zip(sums, total[1])):
        errors.append(f"DPT {edition}: « Total général » {total[1]} ≠ sum of missions {sums}")

    out = []

    def add(level, mission, code, label, page, v):
        for k, (stage, shift) in enumerate(STAGES):
            out.append({"id": f"{edition}:{slug(mission) if mission else 'total'}:{code or '-'}:{stage}",
                        "edition": edition, "page": page, "level": level, "mission": mission, "code": code,
                        "label": label, "stage": stage, "year": edition + shift,
                        "ae": v[2 * k], "cp": v[2 * k + 1], "source_id": source_id})
    for mi in missions:
        add("mission", mi["label"], None, mi["label"], mi["page"], mi["v"])
        for p in mi["programmes"]:
            add("programme", mi["label"], p["code"], p["label"], p["page"], p["v"])
    add("total", None, None, "Total général", total[0], total[1])
    return out, errors
