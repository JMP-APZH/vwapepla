"""Budgets primitifs of the CTM main budget, as voted by the Assemblée (forecast layer, « Prévisionnel »).

Read from the standard M57 pages of the BP, real operations (« RAR N-1 + Vote de l'exercice »):
- D1 « ÉQUILIBRE FINANCIER DU BUDGET – INVESTISSEMENT »: chapter 90, chapter 923 (planned repayments / borrowing),
  totals I (spending) and II (income);
- D2 « ÉQUILIBRE FINANCIER DU BUDGET – FONCTIONNEMENT »: totals I and II, chapter 943.
The BP prints no balance of real operations: the planned operating balance is computed as II - I (same definition as
the CA's printed balance). Same line keys as ca.py, so BP and CA can be shown side by side.
"""
from ca import after, tokens

LINES = {
    "inv_ventile": "Chapitre 90 – opérations d'investissement ventilées (dépenses prévues)",
    "inv_dette_depenses": "Chapitre 923 – remboursements d'emprunts prévus",
    "inv_dette_recettes": "Chapitre 923 – emprunts prévus",
    "inv_depenses_reelles": "Investissement – total des opérations réelles (dépenses prévues)",
    "inv_recettes_reelles": "Investissement – total des opérations réelles (recettes prévues)",
    "fonc_depenses_reelles": "Fonctionnement – total des opérations réelles (dépenses prévues)",
    "fonc_recettes_reelles": "Fonctionnement – total des opérations réelles (recettes prévues)",
    "fonc_solde_reel": "Fonctionnement – solde des opérations réelles prévu (recettes – dépenses)",
    "fonc_operations_financieres": "Chapitre 943 – opérations financières (dépenses prévues)",
}


def find_page(doc, section):
    for i, page in enumerate(doc):
        head = page.get_text()[:700].upper().replace("’", "'")
        if ("SOMMAIRE" not in head and "EQUILIBRE FINANCIER DU BUDGET" in head and section in head
                and "OPERATIONS REELLES" in head):
            return i
    raise ValueError(f"BP page not found: {section}")


def read_bp(doc):
    """{line_key: (amount, pdf page)} from an opened pymupdf document of a budget primitif."""
    out = {}
    i = find_page(doc, "INVESTISSEMENT")
    t = tokens(doc[i].get_text())
    (d90, _), _ = after(t, "90 Opérations ventilées", 2)
    (d923, r923), _ = after(t, "923 Dettes et autres opérations financières", 2)
    _, k = after(t, "92 Opérations non ventilées", 2)
    (tot_dep, tot_rec), _ = after(t, "TOTAL", 2, start=k)
    page = i + 1
    out.update(inv_ventile=(d90, page), inv_dette_depenses=(d923, page), inv_dette_recettes=(r923, page),
               inv_depenses_reelles=(tot_dep, page), inv_recettes_reelles=(tot_rec, page))
    i = find_page(doc, "FONCTIONNEMENT")
    t = tokens(doc[i].get_text())
    (dep, rec), _ = after(t, "TOTAL", 2)
    (d943, _), _ = after(t, "943 Opérations financières", 2)
    page = i + 1
    out.update(fonc_depenses_reelles=(dep, page), fonc_recettes_reelles=(rec, page),
               fonc_solde_reel=(round(rec - dep, 2), page), fonc_operations_financieres=(d943, page))
    return out
