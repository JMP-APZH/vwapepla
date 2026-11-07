"""Comptes administratifs of the CTM main budget, as voted by the Assemblée (PDF with a text layer, M57 layout).

Read from the two standard summary pages, real and mixed operations (« opérations réelles et mixtes »):
- C1 « ÉQUILIBRE FINANCIER – INVESTISSEMENT »: chapter 90 (spending by area), 923 (debt: repayments / new loans),
  totals I (spending) and II (income);
- C2 « ÉQUILIBRE FINANCIER – FONCTIONNEMENT »: totals I (spending) and II (income), their balance II - I, chapter 943
  (financial operations: interest).
Every figure keeps the PDF page it was read on. Run through build.py; checked by reconcile.py (R6).
"""
import re

AMOUNT = re.compile(r"^-?\d{1,3}(?:[   ]\d{3})*,\d{2}$")

LINES = {  # line_key: (label as printed in the CA, page)
    "inv_ventile": "Chapitre 90 – opérations d'investissement ventilées (mandats)",
    "inv_dette_depenses": "Chapitre 923 – dettes et autres opérations financières (mandats)",
    "inv_dette_recettes": "Chapitre 923 – dettes et autres opérations financières (titres)",
    "inv_depenses_reelles": "Investissement – total des opérations réelles et mixtes (mandats)",
    "inv_recettes_reelles": "Investissement – total des opérations réelles et mixtes (titres)",
    "fonc_depenses_reelles": "Fonctionnement – total des opérations réelles et mixtes (mandats)",
    "fonc_recettes_reelles": "Fonctionnement – total des opérations réelles et mixtes (titres)",
    "fonc_solde_reel": "Fonctionnement – solde des opérations réelles et mixtes (II - I)",
    "fonc_operations_financieres": "Chapitre 943 – opérations financières (mandats)",
}


def amount(token):
    return float(re.sub(r"[   ]", "", token).replace(",", "."))


def tokens(text):
    return [t.strip() for t in text.splitlines() if t.strip()]


def after(toks, label, n, start=0):
    """The n amounts that follow the first token starting with `label` (from index `start`)."""
    for i in range(start, len(toks)):
        if toks[i].startswith(label):
            vals = []
            for t in toks[i + 1:]:
                if AMOUNT.match(t):
                    vals.append(amount(t))
                    if len(vals) == n:
                        return vals, i
                elif vals or t in ("I", "II", "II - I", "I - II"):
                    continue
            break
    raise ValueError(f"label not found or incomplete: {label!r}")


def find_page(doc, *markers):
    for i, page in enumerate(doc):
        head = page.get_text()[:700].upper().replace("’", "'")
        if "SOMMAIRE" not in head and "OPERATIONS REELLES ET MIXTES" in head and all(m in head for m in markers):
            return i
    raise ValueError(f"page not found: {markers}")


def read_ca(doc):
    """{line_key: (amount, pdf page)} from an opened pymupdf document."""
    out = {}
    i = find_page(doc, "EQUILIBRE FINANCIER", "INVESTISSEMENT", "C1")
    t = tokens(doc[i].get_text())
    (m90, _), _ = after(t, "90 Opérations ventilées", 2)
    (m923, t923), _ = after(t, "923 Dettes et autres opérations financières", 2)
    _, k = after(t, "92 Opérations non ventilées", 2)
    (tot_dep, tot_rec), _ = after(t, "TOTAL", 2, start=k)
    page = i + 1
    out.update(inv_ventile=(m90, page), inv_dette_depenses=(m923, page), inv_dette_recettes=(t923, page),
               inv_depenses_reelles=(tot_dep, page), inv_recettes_reelles=(tot_rec, page))
    i = find_page(doc, "EQUILIBRE FINANCIER", "FONCTIONNEMENT", "C2")
    t = tokens(doc[i].get_text())
    (dep, rec), _ = after(t, "TOTAL des opérations réelles et mixtes", 2)
    (solde,), _ = after(t, "SOLDE des opérations réelles et mixtes", 1)
    (m943, _), _ = after(t, "943 Opérations financières", 2)
    page = i + 1
    out.update(fonc_depenses_reelles=(dep, page), fonc_recettes_reelles=(rec, page), fonc_solde_reel=(solde, page),
               fonc_operations_financieres=(m943, page))
    if abs((rec - dep) - solde) > 0.01:
        raise ValueError(f"C2: income - spending = {rec - dep:,.2f}, printed balance {solde:,.2f}")
    return out
