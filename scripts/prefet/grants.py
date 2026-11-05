"""State investment grants to local authorities in Martinique (DGCL open data: DETR, DSIL, DSID, DPV...).

Published values are kept as they are (beneficiary name, SIREN, INSEE code). Each row also gets a normalised
`beneficiary_key` and, when the key had to be deduced, a `mapping_note` saying how — shown on the card, never hidden:
  commune-972xx  commune (from its SIREN 21972 2 xx c, else from its name)
  epci-cacem / epci-caesm / epci-capnord   intercommunalities (from SIREN, else from the name)
  ctm            beneficiary type « departement » (the CTM since 2016)
  inconnu        not published (« Non renseigné »)
Rows whose beneficiary is outside Martinique (published with département 972 by mistake) are excluded and reported.
"""
import difflib, hashlib, re, unicodedata

EPCI = {"249720061": "epci-cacem", "249720053": "epci-caesm", "200041788": "epci-capnord"}
EPCI_NAMES = {"cacem": "epci-cacem", "odyssi": "epci-cacem", "centre de la martinique": "epci-cacem",
              "caesm": "epci-caesm", "espace sud": "epci-caesm", "cap nord": "epci-capnord", "pays nord": "epci-capnord"}


def norm(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[’'`\-]", " ", s)
    s = re.sub(r"^(commune|ville)\s+(de la|de l|des|du|de|d)\s+", "", s.strip())
    s = re.sub(r"^(le|la|les|l)\s+", "", s)
    return re.sub(r"\s+", " ", s).strip()


def amount(v):
    v = (v or "").strip().replace(" ", "").replace(" ", "").replace(",", ".")
    return float(v) if v else None


def commune_insee_from_siren(siren):
    """Commune SIREN = 21 + 972 + 2 + 2-digit commune number + check digit (e.g. 219722097 -> 97209)."""
    if re.fullmatch(r"219722\d{3}", siren or ""):
        return "972" + siren[6:8]
    return None


def build_grants(files, source_of_year):
    """files: {year: [csv rows as dicts]}. Returns (rows, report lines, errors)."""
    # Names seen with a valid SIREN give the name -> INSEE table used for rows published without a SIREN.
    name_to_insee = {}
    for rows in files.values():
        for r in rows:
            insee = commune_insee_from_siren(r["beneficiaire_siren"])
            if r["beneficiaire_type"] == "commune" and insee:
                name_to_insee.setdefault(norm(r["beneficiaire_nom"]), insee)
    out, report, errors, seen = [], [], [], {}
    for year, rows in sorted(files.items()):
        for r in rows:
            btype, siren, name = r["beneficiaire_type"], r["beneficiaire_siren"].strip(), r["beneficiaire_nom"].strip()
            key, note = None, None
            epci_by_name = next((v for k, v in EPCI_NAMES.items() if k in norm(name)), None)
            if btype == "commune" and not siren and epci_by_name:
                key, note = epci_by_name, f"publié comme commune ; intercommunalité déduite du nom « {name} »"
            elif btype == "commune":
                if siren and not siren.startswith("21972"):
                    report.append(f"{year}: excluded, beneficiary outside Martinique: {name} (SIREN {siren})")
                    continue
                key = commune_insee_from_siren(siren)
                if key:
                    if r["beneficiaire_code_insee"] and r["beneficiaire_code_insee"] != key:
                        note = f"code INSEE publié {r['beneficiaire_code_insee']} ≠ SIREN"
                    published = norm(name)
                    if published in name_to_insee and name_to_insee[published] != key:
                        note = f"nom publié « {name} » ≠ commune du SIREN {siren} ; SIREN retenu"
                else:
                    match = difflib.get_close_matches(norm(name), list(name_to_insee), n=1, cutoff=0.85)
                    if match:
                        key, note = name_to_insee[match[0]], f"commune déduite du nom publié « {name} » (SIREN absent)"
                    else:
                        errors.append(f"{year}: commune not identified: {name!r} (SIREN {siren!r})")
                        continue
                key = f"commune-{key}"
            elif btype == "epci" or (not btype and r["beneficiaire_code_insee"] == "02972"):
                key = EPCI.get(siren)
                if not key:
                    key = next((v for k, v in EPCI_NAMES.items() if k in norm(name)), None)
                    note = f"intercommunalité déduite du nom publié « {name} »" + (f" (SIREN publié {siren})" if siren else "")
                if not key:
                    errors.append(f"{year}: EPCI not identified: {name!r} (SIREN {siren!r})")
                    continue
            elif btype == "departement":
                key = "ctm"
            elif not btype and name.lower().startswith("non renseign"):
                key, note = "inconnu", "bénéficiaire non renseigné dans la source"
            else:
                errors.append(f"{year}: unknown beneficiary type {btype!r} for {name!r}")
                continue
            if note:
                report.append(f"{year}: {note}")
            # Stable id from the published content (the file order may change between DGCL releases).
            base = "|".join([str(year), r["dispositif"], siren, name, r["intitule"].strip(), r["subvention"]])
            h = hashlib.sha1(base.encode("utf-8")).hexdigest()[:12]
            n = seen[h] = seen.get(h, 0) + 1
            out.append({
                "id": f"{year}-{h}" + (f"-{n}" if n > 1 else ""), "year": year, "scheme": r["dispositif"].strip(),
                "budget_programme": r["programme"].strip() or None, "beneficiary_type": btype or None,
                "beneficiary_siren": siren or None, "beneficiary_name": name,
                "beneficiary_insee": r["beneficiaire_code_insee"].strip() or None, "beneficiary_key": key,
                "mapping_note": note, "project": " ".join(r["intitule"].split()), "cost_ht": amount(r["cout_ht"]),
                "grant_amount": amount(r["subvention"]), "rate": amount(r["taux"]), "source_id": source_of_year[year]})
            if out[-1]["grant_amount"] is None:
                errors.append(f"{year}: grant without amount: {name!r} {r['intitule'][:60]!r}")
    return out, report, errors
