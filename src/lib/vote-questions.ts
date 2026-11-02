// Shared by server and browser (no Node APIs here). Labels live in src/i18n/strings.ts.

export const QUESTIONS = ["facile_a_trouver", "a_jour", "comprehensible", "demarches"] as const;
export type Question = (typeof QUESTIONS)[number];
export const MIN_VOTES = 20; // below this, no average is shown (CLAUDE.md principle 4)

export type VoteStatus = "ok" | "already_voted" | "rate_limited" | "invalid" | "error";
export type VoteSummary = { question: Question; votes: number; average: number | null };
