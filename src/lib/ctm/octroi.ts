// Octroi de mer page (/ctm/octroi-de-mer), pure and tested. The communes' amounts come from team B1's com_actuals
// (metric octroi_de_mer: DGFiP M14 7373 / M57 73431), read-only; the CTM's own octroi de mer régional from
// ctm_actuals (fum_octroi_de_mer, account 73432). Shown side by side, never summed (docs/branches/B3-MAPPING.md §I).
import { CTM, type Actual } from "./budget";
import type { Act } from "./acts";

export type CommuneOctroi = {
  commune_code: string; year: number; amount: number; eur_per_hab: number | null; provisional: boolean; source_id: string;
};
export type Commune = { code: string; slug: string; name: string };
export type OctroiKind = "repartition" | "tarifs" | "vie_chere" | "exonerations" | "reforme" | "autre";
export type OctroiAct = { act_id: string; kind: OctroiKind };
export type OctroiFigure = {
  deliberation: string; line_key: string; label: string; value: number; unit: string; page: number; quote: string;
  source_id: string;
};

export const KIND_ORDER: OctroiKind[] = ["repartition", "tarifs", "vie_chere", "exonerations", "reforme", "autre"];
export const FROM_YEAR = 2018; // CTM account 73432 exists from the 2018 M57 renumbering (§B)

/** Per year: the 34 communes' total and the CTM's octroi de mer régional, in separate fields (never added). */
export function totalsByYear(rows: CommuneOctroi[], actuals: Actual[], from = FROM_YEAR) {
  const years = [...new Set(rows.map((r) => r.year))].filter((y) => y >= from).sort((a, b) => a - b);
  return years.map((year) => {
    const com = rows.filter((r) => r.year === year);
    const ctm = actuals.find((a) => a.entity_siren === CTM && a.year === year && a.metric_key === "fum_octroi_de_mer");
    return { year, communes: com.reduce((s, r) => s + r.amount, 0), communesCount: new Set(com.map((r) => r.commune_code)).size,
             ctm: ctm?.amount ?? null, provisional: com.some((r) => r.provisional) || (ctm?.provisional ?? false) };
  });
}

/** One row per commune for a year, in alphabetical order of the name (never sorted by amount). */
export function communeRows(rows: CommuneOctroi[], communes: Commune[], year: number) {
  return communes
    .map((c) => {
      const r = rows.find((x) => x.year === year && x.commune_code === c.code);
      return { code: c.code, name: c.name, slug: c.slug, amount: r?.amount ?? null, perHab: r?.eur_per_hab ?? null };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** "25-260-4" → [25, 260, 4], for most-recent-first ordering. */
function numberKey(n: string | null): number[] {
  return (n ?? "").split("-").map((x) => Number.parseInt(x, 10) || 0);
}

/** The Assemblée's octroi de mer acts grouped by kind (display order), most recent first within a kind. */
export function actsByKind(kinds: OctroiAct[], acts: Act[]) {
  const byId = new Map(acts.map((a) => [a.id, a]));
  return KIND_ORDER.map((kind) => ({
    kind,
    acts: kinds.filter((k) => k.kind === kind).map((k) => byId.get(k.act_id)).filter((a) => a != null)
      .sort((a, b) => {
        const x = numberKey(a.number), y = numberKey(b.number);
        for (let i = 0; i < 3; i++) if ((y[i] ?? 0) !== (x[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
        return 0;
      }),
  })).filter((g) => g.acts.length);
}

/** Figures of one deliberation by key. */
export function figuresOf(figures: OctroiFigure[], deliberation: string): Map<string, OctroiFigure> {
  return new Map(figures.filter((f) => f.deliberation === deliberation).map((f) => [f.line_key, f]));
}
