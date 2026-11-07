// Visitor votes on the commune's action, by criterion (OPINION layer, CLAUDE.md principle 4, amendment of 5 Nov 2026).
// Never about a named person or the budget. Results = distribution per criterion for the current term, shown only
// from MIN_RATED votes with a score; « je ne sais pas » counted beside it; no average, no global score, no ranking.
// Shared by server and browser (no Node APIs here). Criteria: data/communes/audit/vote_criteria.yaml (validated by JM).

export const MIN_RATED = 20;
export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];
export const DONT_KNOW = "nsp"; // form value of « Je ne sais pas » (recorded as score null)

export type CriteriaVoteStatus =
  | "ok" | "already_voted" | "rate_limited" | "closed" | "invalid" | "check_failed" | "error";

export type CommuneVoteCriterion = {
  key: string; label_fr: string; competence: "commune" | "partagee"; others: string[]; commune_role_fr: string;
  ref_status: "to_confirm" | "confirmed"; display_order: number;
};
export type CriteriaSummaryRow = {
  criterion: string; rated: number | string; dont_know: number | string; closed: boolean;
  score: number | null; votes: number | string | null;
};
export type CriterionResult = {
  criterion: string; rated: number; dontKnow: number; counts: Record<Level, number> | null;
};
export type CriteriaResults = { closed: boolean; results: CriterionResult[] };

/** Rows of com_criteria_vote_summary() -> one result per criterion (counts null below MIN_RATED or while closed). */
export function criteriaResults(rows: CriteriaSummaryRow[], keys: string[]): CriteriaResults {
  const closed = rows.some((r) => r.closed);
  const results = keys.map((key) => {
    const mine = rows.filter((r) => r.criterion === key);
    const rated = Number(mine[0]?.rated ?? 0), dontKnow = Number(mine[0]?.dont_know ?? 0);
    if (closed || rated < MIN_RATED || !mine.some((r) => r.score != null)) return { criterion: key, rated, dontKnow, counts: null };
    const counts = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;
    for (const r of mine) if (r.score != null) counts[r.score as Level] = Number(r.votes ?? 0);
    return { criterion: key, rated, dontKnow, counts };
  });
  return { closed, results };
}

/**
 * Answers of the form: known criteria only; 1-5, or « je ne sais pas » (score null). Unanswered criteria are skipped.
 * Any malformed value -> null (whole form invalid); nothing answered -> null.
 */
export function parseCriteriaAnswers(form: FormData, keys: string[]): { criterion: string; score: number | null }[] | null {
  const out: { criterion: string; score: number | null }[] = [];
  for (const k of keys) {
    const raw = form.get(k);
    if (raw == null || raw === "") continue;
    if (raw === DONT_KNOW) { out.push({ criterion: k, score: null }); continue; }
    const score = Number(raw);
    if (!Number.isInteger(score) || score < 1 || score > 5) return null;
    out.push({ criterion: k, score });
  }
  return out.length ? out : null;
}

/** One status for the whole form: ok if at least one answer was recorded. */
export function overallCriteriaStatus(statuses: CriteriaVoteStatus[]): CriteriaVoteStatus {
  if (statuses.includes("ok")) return "ok";
  for (const s of ["closed", "rate_limited", "already_voted", "error"] as const) if (statuses.includes(s)) return s;
  return "invalid";
}
