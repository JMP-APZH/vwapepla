// Shared by server and browser (no Node APIs here). Labels live in messages/fr/communes.json (q_*, votes_*).

export const QUESTIONS = ["facile_a_trouver", "a_jour", "comprehensible", "demarches"] as const;
export type Question = (typeof QUESTIONS)[number];
export const MIN_VOTES = 20; // below this, no distribution is shown (CLAUDE.md principle 4)
export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];

export type VoteStatus = "ok" | "already_voted" | "rate_limited" | "invalid" | "check_failed" | "error";
export type SiteVoteRow = { question: string; total: number | string; score: number | null; votes: number | string | null };
export type SiteDistribution = { question: Question; total: number; counts: Record<Level, number> | null };
export type SiteVoteResults = { closed: boolean; results: SiteDistribution[] };

/**
 * Rows of com_site_vote_distribution() -> one distribution per question (CLAUDE.md principle 4: a distribution, no
 * average). counts is null below MIN_VOTES or while votes are closed (pre-election period).
 */
export function siteDistributions(rows: SiteVoteRow[], closed: boolean): SiteVoteResults {
  const results = QUESTIONS.map((question) => {
    const mine = rows.filter((r) => r.question === question);
    const total = Number(mine[0]?.total ?? 0);
    if (closed || total < MIN_VOTES || !mine.some((r) => r.score != null)) return { question, total, counts: null };
    const counts = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<Level, number>;
    for (const r of mine) if (r.score != null) counts[r.score as Level] = Number(r.votes ?? 0);
    return { question, total, counts };
  });
  return { closed, results };
}
