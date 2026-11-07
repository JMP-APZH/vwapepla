// Visitor votes on the State's action in Martinique (OPINION layer, CLAUDE.md principle 4 as amended on 5 Nov 2026).
// Never about a named person. Results = distribution of answers per criterion, shown only from MIN_VOTES votes;
// no average, no global score, no ranking. Shared by server and browser (no Node APIs here).

export const MIN_VOTES = 20;
export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];
export type VoteStatus = "ok" | "already_voted" | "rate_limited" | "invalid" | "error";

export type VoteCriterion = {
  key: string; label_fr: string; description_fr: string; competence: "etat" | "partagee"; others: string[];
  state_role_fr: string; fact_blocks: string[]; display_order: number;
};
export type SummaryRow = { criterion: string; total: number | string; score: number | null; votes: number | string | null };
export type Distribution = { criterion: string; total: number; counts: Record<Level, number> | null };

/** Rows of pref_state_vote_summary() -> one distribution per criterion (counts null below MIN_VOTES). */
export function distributions(rows: SummaryRow[], keys: string[]): Distribution[] {
  return keys.map((key) => {
    const mine = rows.filter((r) => r.criterion === key);
    const total = Number(mine[0]?.total ?? 0);
    if (total < MIN_VOTES) return { criterion: key, total, counts: null };
    const counts = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;
    for (const r of mine) if (r.score != null) counts[r.score as Level] = Number(r.votes ?? 0);
    return { criterion: key, total, counts };
  });
}

/** Answers of the form: known criteria only, integer 1-5; « sans avis » (empty or "0") is skipped. Nothing -> null. */
export function parseStateAnswers(form: FormData, keys: string[]): { criterion: string; score: number }[] | null {
  const out: { criterion: string; score: number }[] = [];
  for (const k of keys) {
    const raw = form.get(k);
    if (raw == null || raw === "" || raw === "0") continue;
    const score = Number(raw);
    if (!Number.isInteger(score) || score < 1 || score > 5) return null;
    out.push({ criterion: k, score });
  }
  return out.length ? out : null;
}

/** One status for the whole form: ok if at least one answer was recorded. */
export function overallStatus(statuses: VoteStatus[]): VoteStatus {
  if (statuses.includes("ok")) return "ok";
  for (const s of ["rate_limited", "already_voted", "error"] as const) if (statuses.includes(s)) return s;
  return "invalid";
}
