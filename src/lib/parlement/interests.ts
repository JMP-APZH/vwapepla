// Parlement domain (B2): HATVP declarations. Outside activities are copied as declared from the latest declaration of
// interests (the member's own sections only: JM, 5 Nov 2026); no summary, no rewording, no total of amounts.
// Asset declarations: link and dates only. Pure functions, unit-tested.

export type Declaration = {
  id: string; person_id: string; doc_type: string; deposited: string | null; published: string | null;
  status: string | null; url: string | null; source_id: string;
};

export type InterestItem = {
  id: string; person_id: string; declaration_uuid: string; declaration_label: string | null; deposited: string | null;
  section: string; position: number; fields: Record<string, string>; amounts: { annee?: string; montant?: string }[];
  source_id: string;
};

export const DOC_TYPE_FR: Record<string, string> = {
  DIA: "Déclaration d'intérêts et d'activités", DIAM: "Déclaration d'intérêts et d'activités (modificative)",
  DSP: "Déclaration de situation patrimoniale", DSPM: "Déclaration de situation patrimoniale (modificative)",
  DI: "Déclaration d'intérêts", DIM: "Déclaration d'intérêts (modificative)",
};

/** HATVP section names (official wording of the declaration form). */
export const SECTION_FR: Record<string, string> = {
  activProfCinqDerniereDto: "Activités professionnelles des cinq dernières années",
  activConsultantDto: "Activités de consultant",
  participationDirigeantDto: "Participations aux organes dirigeants d'organismes",
  participationFinanciereDto: "Participations financières dans des sociétés",
  fonctionBenevoleDto: "Fonctions bénévoles",
  mandatElectifDto: "Mandats électifs",
  observationInteretDto: "Observations",
};
export const SECTION_ORDER = Object.keys(SECTION_FR);

const TITLE_FIELDS = ["description", "descriptionMandat", "nomSociete", "nomStructure", "contenu", "descriptionActivite"];
const FIELD_FR: Record<string, string> = {
  employeur: "Employeur", activite: "Activité", descriptionActivite: "Activité", dateDebut: "Début", dateFin: "Fin",
  commentaire: "Commentaire", capitalDetenu: "Capital détenu", nombreParts: "Nombre de parts", evaluation: "Évaluation",
  remuneration: "Rémunération", actiConseil: "Activité de conseil", "remuneration/brutNet": "Montants",
};

export type ItemView = { title: string; details: { label: string; value: string }[]; amounts: string[] };

/** One declared item as shown: title + labelled fields + amounts per year, exactly as declared (« brut » / « net »). */
export function itemView(it: InterestItem): ItemView {
  const f = it.fields;
  const titleKey = TITLE_FIELDS.find((k) => f[k]);
  const basis = f["remuneration/brutNet"];
  return {
    title: titleKey ? f[titleKey] : SECTION_FR[it.section] ?? it.section,
    details: Object.entries(f).filter(([k]) => k !== titleKey && k !== "remuneration/brutNet" && FIELD_FR[k])
      .map(([k, v]) => ({ label: FIELD_FR[k], value: v })),
    amounts: it.amounts.filter((a) => a.annee != null && a.montant != null)
      .map((a) => `${a.annee} : ${a.montant} €${basis ? ` (${basis.toLowerCase()})` : ""}`),
  };
}

/** Items grouped by section, in the form's order. */
export function bySection(items: InterestItem[]): { section: string; label: string; items: InterestItem[] }[] {
  return SECTION_ORDER.map((s) => ({ section: s, label: SECTION_FR[s], items: items.filter((i) => i.section === s)
    .sort((a, b) => a.position - b.position) })).filter((g) => g.items.length > 0);
}

/** Declarations newest first (by deposit date; not yet published ones keep their published status text). */
export function sortDeclarations(ds: Declaration[]): Declaration[] {
  return [...ds].sort((a, b) => (b.deposited ?? "").localeCompare(a.deposited ?? "") || a.doc_type.localeCompare(b.doc_type));
}

/** Asset declarations: never their contents (charter §3.6). */
export function isAssetDeclaration(d: Pick<Declaration, "doc_type">): boolean {
  return d.doc_type.startsWith("DSP");
}
