"""Metric catalogue: our keys <-> OFGL aggregates (or DGFiP accounts / formulas). Single source of truth.

Loaded into the `metric_definitions` table; the app reads labels and order from there.
`parent` expresses the accounting hierarchy, checked by build_actuals.py (sum of children == parent).
`on_card` = shown on the MVP2 commune card; everything else is imported but only available for drill-down.
Kréyòl labels are added only once agreed with JM (None until then).
"""

# (key, block, parent, label_fr, source, on_card, description_fr)
# source: "ofgl:<aggregate>" | "dgfip:<accounts>" | "derived:<formula>"
METRICS = [
    # --- Recettes de fonctionnement ---
    ("rf_total", "income_operating", None, "Recettes de fonctionnement", "ofgl:Recettes de fonctionnement", True,
     "Ressources courantes de la commune sur l'année."),
    ("impots_taxes", "income_operating", "rf_total", "Impôts et taxes", "ofgl:Impôts et taxes", False,
     "Impôts locaux + autres impôts et taxes."),
    ("impots_locaux", "income_operating", "impots_taxes", "Impôts locaux", "ofgl:Impôts locaux", True,
     "Taxes foncières, taxe d'habitation sur les résidences secondaires, et fiscalité reversée par l'intercommunalité."),
    ("fiscalite_reversee", "income_operating", None, "dont reversements de l'intercommunalité",
     "ofgl:Fiscalité reversée", True, "Attribution de compensation et dotation de solidarité versées par l'EPCI (inclus dans les impôts locaux)."),
    ("autres_impots_taxes", "income_operating", "impots_taxes", "Octroi de mer et autres taxes",
     "ofgl:Autres impôts et taxes", True, "Octroi de mer, taxe sur l'électricité, droits de mutation, taxe de séjour…"),
    ("octroi_de_mer", "income_operating", None, "dont octroi de mer", "dgfip:7373 (M14) / 73431 (M57)", True,
     "Part de l'octroi de mer reversée aux communes (comptes DGFiP)."),
    ("concours_etat", "income_operating", "rf_total", "Dotations de l'État", "ofgl:Concours de l'Etat", True,
     "DGF + autres dotations de fonctionnement + péréquations et compensations fiscales."),
    ("dgf", "income_operating", "concours_etat", "Dotation globale de fonctionnement (DGF)",
     "ofgl:Dotation globale de fonctionnement", False, None),
    ("autres_dotations_fonct", "income_operating", "concours_etat", "Autres dotations de fonctionnement",
     "ofgl:Autres dotations de fonctionnement", False, None),
    ("perequations_compensations", "income_operating", "concours_etat", "Péréquations et compensations fiscales",
     "ofgl:Péréquations et compensations fiscales", False, None),
    ("subventions_recues", "income_operating", "rf_total", "Subventions et participations reçues",
     "ofgl:Subventions reçues et participations", True, "Subventions de la CTM, de l'Europe, de la CAF, etc."),
    ("ventes_services", "income_operating", "rf_total", "Recettes des services", "ofgl:Ventes de biens et services",
     True, "Cantine, crèches, concessions, locations…"),
    ("autres_recettes_fonct", "income_operating", "rf_total", "Autres recettes de fonctionnement",
     "ofgl:Autres recettes de fonctionnement", True, None),
    # --- Dépenses de fonctionnement ---
    ("df_total", "spending_operating", None, "Dépenses de fonctionnement", "ofgl:Dépenses de fonctionnement", True,
     "Dépenses courantes de la commune sur l'année."),
    ("frais_personnel", "spending_operating", "df_total", "Personnel", "ofgl:Frais de personnel", True,
     "Rémunérations et charges des agents municipaux."),
    ("achats_charges_ext", "spending_operating", "df_total", "Achats et charges externes",
     "ofgl:Achats et charges externes", True, "Fournitures, énergie, entretien, prestations…"),
    ("depenses_intervention", "spending_operating", "df_total", "Subventions et contingents versés",
     "ofgl:Dépenses d'intervention", True, "Subventions aux associations, au CCAS, contingents (SDIS…)."),
    ("subv_droit_prive", "spending_operating", None, "dont subventions aux associations et personnes privées",
     "ofgl:Subventions aux personnes de droit privé", False, None),
    ("charges_financieres", "spending_operating", "df_total", "Intérêts de la dette", "ofgl:Charges financières",
     True, None),
    ("autres_depenses_fonct", "spending_operating", "df_total", "Autres dépenses de fonctionnement",
     "ofgl:Autres dépenses de fonctionnement", True, None),
    # --- Recettes d'investissement ---
    ("ri_total", "income_investment", None, "Recettes d'investissement", "ofgl:Recettes d'investissement", False, None),
    ("ri_hors_emprunts", "income_investment", None, "Recettes d'investissement hors emprunts",
     "ofgl:Recettes d'investissement hors emprunts", True, None),
    ("fctva", "income_investment", "ri_hors_emprunts", "FCTVA (remboursement de TVA)", "ofgl:FCTVA", True, None),
    ("dotations_subv_invest", "income_investment", "ri_hors_emprunts", "Subventions d'équipement reçues",
     "ofgl:Autres dotations et subventions", True, "Subventions de l'État, de la CTM, de l'Europe pour les projets."),
    ("autres_recettes_invest", "income_investment", "ri_hors_emprunts", "Autres recettes d'investissement",
     "ofgl:Autres recettes d'investissement", True, None),
    ("cessions", "income_investment", None, "Ventes de biens (cessions)", "ofgl:Produit des cessions d'immobilisations",
     False, None),
    ("emprunts", "income_investment", None, "Emprunts nouveaux", "ofgl:Emprunts hors GAD", True,
     "Montant emprunté dans l'année."),
    # --- Dépenses d'investissement ---
    ("di_total", "spending_investment", None, "Dépenses d'investissement", "ofgl:Dépenses d'investissement", False, None),
    ("di_hors_remb", "spending_investment", None, "Investissements (hors remboursement de la dette)",
     "ofgl:Dépenses d'investissement hors remb", True, "Équipements + subventions d'équipement + autres."),
    ("depenses_equipement", "spending_investment", "di_hors_remb", "Équipements et travaux",
     "ofgl:Dépenses d'équipement", True, "Écoles, voirie, bâtiments, matériel durable…"),
    ("subv_equipement_versees", "spending_investment", "di_hors_remb", "Subventions d'équipement versées",
     "ofgl:Subventions d'équipement versées", True, None),
    ("autres_depenses_invest", "spending_investment", "di_hors_remb", "Autres dépenses d'investissement",
     "ofgl:Autres dépenses d'investissement", True, None),
    ("remboursements_emprunts", "spending_investment", None, "Remboursement du capital de la dette",
     "ofgl:Remboursements d'emprunts hors GAD", True, None),
    ("annuite_dette", "spending_investment", None, "Annuité de la dette (capital + intérêts)",
     "ofgl:Annuité de la dette", False, None),
    # --- Épargne, dette, équilibre ---
    ("epargne_gestion", "savings_debt", None, "Épargne de gestion", "ofgl:Epargne de gestion", False, None),
    ("epargne_brute", "savings_debt", None, "Épargne brute", "ofgl:Epargne brute", True,
     "Recettes de fonctionnement − dépenses de fonctionnement : ce qui reste pour investir et rembourser."),
    ("epargne_nette", "savings_debt", None, "Épargne nette", "ofgl:Epargne nette", True,
     "Épargne brute − remboursement du capital de la dette."),
    ("encours_dette", "savings_debt", None, "Dette (encours au 31/12)", "ofgl:Encours de dette", True,
     "Capital restant dû sur tous les emprunts."),
    ("encours_dette_bancaire", "savings_debt", None, "dont dettes bancaires",
     "ofgl:Encours de dette - Dettes bancaires et assimilées", False, None),
    ("encours_dette_depots", "savings_debt", None, "dont dépôts et cautionnements",
     "ofgl:Encours de dette - Dépôts et cautionnements reçus", False, None),
    ("capacite_desendettement", "savings_debt", None, "Capacité de désendettement",
     "derived:encours_dette / epargne_brute", True,
     "Années nécessaires pour rembourser toute la dette avec l'épargne brute. Non calculable si l'épargne brute est négative ou nulle."),
    ("taux_effort", "savings_debt", None, "Taux d'effort d'investissement", "derived:di_hors_remb / rf_total", False,
     "Investissements rapportés aux recettes de fonctionnement (indicateur AFD)."),
    ("flux_net_dette", "savings_debt", None, "Flux net de dette", "ofgl:Flux net de dette", False, None),
    ("capacite_financement", "savings_debt", None, "Capacité ou besoin de financement",
     "ofgl:Capacité ou besoin de financement", False, None),
    ("fonds_roulement", "savings_debt", None, "Fonds de roulement", "ofgl:Fonds de roulement", False, None),
    ("variation_fonds_roulement", "savings_debt", None, "Variation du fonds de roulement",
     "ofgl:Variation du fonds de roulement", False, None),
    ("depots_tresor", "savings_debt", None, "Trésorerie déposée au Trésor", "ofgl:Dépôts au Trésor", False, None),
    ("credits_tresorerie", "savings_debt", None, "Crédits de trésorerie", "ofgl:Crédits de trésorerie", False, None),
    # --- Totaux ---
    ("recettes_totales", "totals", None, "Recettes totales", "ofgl:Recettes totales", False, None),
    ("recettes_totales_hors_emprunts", "totals", None, "Recettes totales hors emprunts",
     "ofgl:Recettes totales hors emprunts", False, None),
    ("depenses_totales", "totals", None, "Dépenses totales", "ofgl:Dépenses totales", False, None),
    ("depenses_totales_hors_remb", "totals", None, "Dépenses totales hors remboursements",
     "ofgl:Dépenses totales hors remb", False, None),
    # --- Marginal (kept for completeness) ---
    ("tva", "other", None, "TVA", "ofgl:TVA", False, None),
    ("teom", "other", None, "Taxe d'enlèvement des ordures ménagères", "ofgl:Taxe d'enlévement des ordures ménagères",
     False, "Perçue par les intercommunalités en Martinique."),
    # --- Only in context datasets (CCAS, EPL) ---
    ("participations_communes", "other", None, "Participations des communes", "ofgl:Participations des communes",
     False, "Versement de la commune à son CCAS (comptes CCAS)."),
    ("versement_transport", "other", None, "Versement mobilité", "ofgl:Versement transport", False, None),
    ("taxe_sejour_reversee", "other", None, "Reversements de taxe de séjour", "ofgl:Reversements de taxe de séjour",
     False, None),
]

OCTROI_ACCOUNTS = {"7373", "73431"}  # M14 / M57 (M57A uses 73431 too)

BLOCKS = {
    "income_operating": "Recettes de fonctionnement",
    "income_investment": "Recettes d'investissement",
    "spending_operating": "Dépenses de fonctionnement",
    "spending_investment": "Dépenses d'investissement",
    "savings_debt": "Épargne et dette",
    "totals": "Totaux",
    "other": "Autres",
}

UNITS = {"capacite_desendettement": "years", "taux_effort": "ratio"}  # everything else: eur

BY_AGGREGATE = {src[5:]: key for key, _b, _p, _l, src, _c, _d in METRICS if src.startswith("ofgl:")}
KEYS = [m[0] for m in METRICS]
