"""Metric definitions of the CTM card (validated by JM, 5 Nov 2026: docs/branches/B3-MAPPING.md).

METRICS: (key, block, parent, label_fr, source_rule, unit, on_card). Order = display order.
source_rule: 'ofgl:<agrégat>' (OFGL consolidated bases) | 'dgfip:<accounts>' (balances, budget principal, net credit) |
'derived:<formula>'. CI: the same metric for 2008-2011 from DGFiP comptes individuels (k€, budget principal only).
"""

METRICS = [
    # Recettes
    ("rf_total", "recettes", None, "Recettes de fonctionnement", "ofgl:Recettes de fonctionnement", "eur", True),
    ("impots_taxes", "recettes", "rf_total", "Impôts et taxes", "ofgl:Impôts et taxes", "eur", True),
    ("tva", "recettes", "impots_taxes", "Fraction de TVA", "ofgl:TVA", "eur", True),
    ("ticpe", "recettes", "impots_taxes", "TICPE", "ofgl:TICPE", "eur", True),
    ("impots_locaux", "recettes", "impots_taxes", "Impôts locaux", "ofgl:Impôts locaux", "eur", True),
    ("concours_etat", "recettes", "rf_total", "Concours de l'État", "ofgl:Concours de l'Etat", "eur", True),
    ("dgf", "recettes", "concours_etat", "Dotation globale de fonctionnement", "ofgl:Dotation globale de fonctionnement", "eur", True),
    ("subventions_recues", "recettes", "rf_total", "Subventions reçues et participations",
     "ofgl:Subventions reçues et participations", "eur", True),
    ("ventes", "recettes", "rf_total", "Ventes de biens et services", "ofgl:Ventes de biens et services", "eur", True),
    ("autres_rf", "recettes", "rf_total", "Autres recettes de fonctionnement", "ofgl:Autres recettes de fonctionnement", "eur", True),
    ("emprunts", "recettes", None, "Emprunts", "ofgl:Emprunts hors GAD", "eur", True),
    # Dépenses
    ("df_total", "depenses", None, "Dépenses de fonctionnement", "ofgl:Dépenses de fonctionnement", "eur", True),
    ("frais_personnel", "depenses", "df_total", "Frais de personnel", "ofgl:Frais de personnel", "eur", True),
    ("achats", "depenses", "df_total", "Achats et charges externes", "ofgl:Achats et charges externes", "eur", True),
    ("intervention", "depenses", "df_total", "Dépenses d'intervention", "ofgl:Dépenses d'intervention", "eur", True),
    ("rsa", "depenses", "intervention", "Allocations RSA", "ofgl:Allocations RSA", "eur", True),
    ("apa", "depenses", "intervention", "Allocations APA", "ofgl:Allocations APA", "eur", True),
    ("pch", "depenses", "intervention", "Allocations PCH", "ofgl:Allocations PCH", "eur", True),
    ("charges_financieres", "depenses", "df_total", "Charges financières", "ofgl:Charges financières", "eur", True),
    ("autres_df", "depenses", "df_total", "Autres dépenses de fonctionnement", "ofgl:Autres dépenses de fonctionnement", "eur", True),
    ("depenses_equipement", "depenses", None, "Dépenses d'équipement", "ofgl:Dépenses d'équipement", "eur", True),
    ("subv_equipement", "depenses", None, "Subventions d'équipement versées", "ofgl:Subventions d'équipement versées", "eur", True),
    ("di_hors_remb", "depenses", None, "Dépenses d'investissement hors remboursements",
     "ofgl:Dépenses d'investissement hors remb", "eur", True),
    ("remboursements", "depenses", None, "Remboursements d'emprunts", "ofgl:Remboursements d'emprunts hors GAD", "eur", True),
    # Épargne, dette
    ("epargne_gestion", "epargne_dette", None, "Épargne de gestion", "ofgl:Epargne de gestion", "eur", True),
    ("epargne_brute", "epargne_dette", None, "Épargne brute", "ofgl:Epargne brute", "eur", True),
    ("epargne_nette", "epargne_dette", None, "Épargne nette", "ofgl:Epargne nette", "eur", True),
    ("encours_dette", "epargne_dette", None, "Encours de dette au 31 décembre", "ofgl:Encours de dette", "eur", True),
    ("capacite_desendettement", "epargne_dette", None, "Capacité de désendettement",
     "derived:encours_dette / epargne_brute (non calculable si épargne brute ≤ 0)", "years", True),
    # Fiscalité ultramarine (M57 734, budget principal)
    ("fum_total", "fiscalite_ultramarine", None, "Fiscalité spécifique ultramarine (compte 734)", "dgfip:734*", "eur", True),
    ("fum_octroi_de_mer", "fiscalite_ultramarine", "fum_total", "Octroi de mer régional", "dgfip:73432", "eur", True),
    ("fum_carburants", "fiscalite_ultramarine", "fum_total", "Taxe sur les carburants", "dgfip:7342", "eur", True),
    ("fum_autres", "fiscalite_ultramarine", "fum_total", "Autres impôts et taxes d'outre-mer", "dgfip:7348", "eur", True),
    ("fum_transport", "fiscalite_ultramarine", "fum_total", "Taxe sur le transport public aérien et maritime", "dgfip:73433", "eur", True),
    ("fum_rhum", "fiscalite_ultramarine", "fum_total", "Taxe sur les rhums", "dgfip:73411", "eur", True),
    # Context
    ("population", "contexte", None, "Population (OFGL)", "ofgl:ptot", "inhabitants", True),
]

# Fiscalité ultramarine: metric -> account prefix (net credit, budget principal, definitive balance).
FUM = {"fum_total": "734", "fum_octroi_de_mer": "73432", "fum_carburants": "7342", "fum_autres": "7348",
       "fum_transport": "73433", "fum_rhum": "73411"}

# DGFiP comptes individuels 2008-2011 (budget principal, k€): metric -> column, or a difference of two columns.
CI = {"rf_total": "pfr", "df_total": "cfr", "epargne_brute": ("pfr", "cfr"), "encours_dette": "dba",
      "depenses_equipement": "ded", "frais_personnel": "chp"}
