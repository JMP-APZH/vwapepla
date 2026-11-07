"""Spending by area of responsibility (M57 functional presentation), CTM main budget, definitive balances.

DGFiP nature-fonction files: `fonction` = functional chapter + area code, e.g. '93221' = operating chapter 93, area 2,
sub-area 221; '90…' = investment by area; '92…' / '94…' = not broken down by area ('943' = interest).
- Operating spending: real accounts of class 6 (without 68 depreciation/provisions, 675/676 order entries), net debit.
- Investment: OFGL's definition (« Dépenses d'équipement » + « Subventions d'équipement versées »):
  debits on 20, 21, 23 minus credits on 236, 237, 238 (matches OFGL to the euro, 2018-2025).
Areas 0-8 (official labels: OFGL, M57 functional nomenclature); 'nv' = not broken down by area.
From 2018 (M57 renumbered that year; 2016-2017 not comparable).
"""

FIRST_YEAR = 2018
SECTIONS = {"93": "fonctionnement", "90": "investissement"}
NOT_BROKEN_DOWN = {"94": "fonctionnement", "92": "investissement"}


def is_real_operating(account):
    return account.startswith("6") and not account.startswith(("68", "675", "676"))


def is_investment(account):
    return account.startswith(("20", "21", "23"))


def area_sums(rows, siren, budget="1"):
    """{(section, area): amount} for one year's rows of a nature-fonction file."""
    out = {}
    for r in rows:
        if r["siren"] != siren or r["cbudg"] != budget or r["bal"] != "DEF":
            continue
        f, acc = r["fonction"], r["compte"]
        chap = f[:2]
        section = SECTIONS.get(chap) or NOT_BROKEN_DOWN.get(chap)
        if section is None:
            continue
        if (section == "fonctionnement" and not is_real_operating(acc)) or (section == "investissement" and not is_investment(acc)):
            continue
        area = f[2] if chap in SECTIONS and len(f) > 2 and f[2].isdigit() else "nv"
        debit, credit = float(r["obnetdeb"] or 0), float(r["obnetcre"] or 0)
        if section == "fonctionnement":
            v = debit - credit
        else:
            v = debit - (credit if acc.startswith(("236", "237", "238")) else 0.0)
        out[(section, area)] = out.get((section, area), 0.0) + v
    return out


def labels(rows):
    """Area code (one digit) -> official label, from the OFGL M57 functional nomenclature file."""
    out = {}
    for r in rows:
        code = r["fonction"].strip()
        if len(code) == 1 and code.isdigit() and code != "9":
            out[code] = r["nom_fonction"].strip()
    return out
