import type { Officeholder } from "@/lib/communes/data";

/** Function title, gendered from the RNE "Code sexe": "1re adjointe", "3e adjoint". Neutral form if sex is unknown. */
export function functionTitle(o: Pick<Officeholder, "role" | "rank" | "sex">): string | null {
  if (o.role === "maire") return "Maire";
  if (o.role !== "adjoint" || o.rank == null) return null;
  const n = o.rank === 1 ? (o.sex === "F" ? "1re" : o.sex === "M" ? "1er" : "1er·e") : `${o.rank}e`;
  return `${n} ${o.sex === "F" ? "adjointe" : o.sex === "M" ? "adjoint" : "adjoint·e"}`;
}

/** Deputy ranks missing from the RNE list (e.g. [3] when it goes 1, 2, 4): vacancy or not declared. */
export function missingDeputyRanks(council: Pick<Officeholder, "role" | "rank">[]): number[] {
  const ranks = new Set(council.filter((o) => o.role === "adjoint" && o.rank != null).map((o) => o.rank!));
  const max = Math.max(0, ...ranks);
  return Array.from({ length: max }, (_, i) => i + 1).filter((r) => !ranks.has(r));
}

/** Where the name of a past mayor comes from (history.yaml `basis`, read from the source of the mandate). */
export type MayorEvidence = "rne" | "liste" | "secondaire";
export const SECONDARY_SOURCE = "vwapepla-historique-maires"; // Wikipedia rows (history_secondary.yaml)

export function mayorEvidence(o: Pick<Officeholder, "source_id">): MayorEvidence {
  if (o.source_id === SECONDARY_SOURCE) return "secondaire";
  return o.source_id.startsWith("municipales-") ? "liste" : "rne";
}

export type TermMayor = { name: string; from: number; to: number | null; evidence: MayorEvidence; sourceUrl: string | null };

/** Mayors of one term in order, with their years in office ("2008–2010"); several when the mayor changed. */
export function mayorsOfTerm(pastMayors: Officeholder[], termId: string): TermMayor[] {
  return pastMayors
    .filter((m) => m.term_id === termId)
    .sort((a, b) => a.mandate_start.localeCompare(b.mandate_start))
    .map((m) => ({
      name: `${m.first_name} ${m.last_name}`,
      from: Number(m.mandate_start.slice(0, 4)),
      to: m.mandate_end ? Number(m.mandate_end.slice(0, 4)) : null,
      evidence: mayorEvidence(m),
      sourceUrl: m.source_url,
    }));
}
