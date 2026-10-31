import type { Officeholder } from "@/lib/data";

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
