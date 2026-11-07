// Comptes administratifs voted by the Assemblée (main budget) beside OFGL's main-budget figures (pure, tested).
// CA lines: ctm_ca_lines, read from pages C1 / C2 of the published PDFs (scripts/ctm/pipeline/ca.py); the comparison
// and its explanations are checked by scripts/ctm/reconcile.py (R6) and documented in docs/branches/B3-MAPPING.md §G.
import { CTM, get, type Actual } from "./budget";

export type CaLine = {
  year: number; budget: string; line_key: string; label: string; amount: number; page: number; deliberation: string;
  source_id: string;
};
export type CaRow = {
  key: string; label: string; ca: number | null; ofgl: number | null; diff: number | null; pct: number | null;
  page: number | null; note: "brut" | "1068" | null;
};

/** Each row: the CA figure (with its page), OFGL's main-budget figure, the difference. */
const ROWS: { key: string; label: string; ca: (l: (k: string) => CaLine | undefined) => [number | null, number | null];
  ofgl: string; note?: CaRow["note"] }[] = [
  { key: "fonc_depenses", label: "Dépenses réelles de fonctionnement", ofgl: "df_total", note: "brut",
    ca: (l) => [l("fonc_depenses_reelles")?.amount ?? null, l("fonc_depenses_reelles")?.page ?? null] },
  { key: "fonc_recettes", label: "Recettes réelles de fonctionnement", ofgl: "rf_total", note: "brut",
    ca: (l) => [l("fonc_recettes_reelles")?.amount ?? null, l("fonc_recettes_reelles")?.page ?? null] },
  { key: "epargne_brute", label: "Épargne brute (solde réel de fonctionnement)", ofgl: "epargne_brute",
    ca: (l) => [l("fonc_solde_reel")?.amount ?? null, l("fonc_solde_reel")?.page ?? null] },
  { key: "investissement", label: "Investissement hors remboursements d'emprunts", ofgl: "di_hors_remb",
    ca: (l) => {
      const t = l("inv_depenses_reelles"), d = l("inv_dette_depenses");
      return [t && d ? t.amount - d.amount : null, t?.page ?? null];
    } },
  { key: "remboursements", label: "Remboursements d'emprunts", ofgl: "remboursements",
    ca: (l) => [l("inv_dette_depenses")?.amount ?? null, l("inv_dette_depenses")?.page ?? null] },
  { key: "emprunts", label: "Emprunts (chapitre 923, recettes)", ofgl: "emprunts",
    ca: (l) => [l("inv_dette_recettes")?.amount ?? null, l("inv_dette_recettes")?.page ?? null] },
];

/** Years whose CA shows the capitalised surplus (account 1068) inside chapter 923 (CA 2022 and 2023, pages C1). */
export const SURPLUS_IN_923 = new Set([2022, 2023]);

export function caYears(lines: CaLine[]): number[] {
  return [...new Set(lines.map((l) => l.year))].sort((a, b) => b - a);
}

export function caComparison(lines: CaLine[], actuals: Map<string, Actual>, year: number): CaRow[] {
  const l = (k: string) => lines.find((x) => x.year === year && x.line_key === k);
  return ROWS.map((r) => {
    const [ca, page] = r.ca(l);
    const ofgl = get(actuals, CTM, year, r.ofgl)?.amount_bp ?? null;
    const diff = ca != null && ofgl != null ? ca - ofgl : null;
    const note = r.key === "emprunts" && SURPLUS_IN_923.has(year) ? "1068" : (r.note ?? null);
    return { key: r.key, label: r.label, ca, ofgl, diff, pct: diff != null && ofgl ? diff / ofgl : null, page, note };
  });
}
