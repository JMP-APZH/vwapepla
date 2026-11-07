// Parlement domain (B2): one summary per mandate (earlier terms: JM, 7 Nov 2026). Same figures as the current-term
// blocks, same caveats: positions recorded on the votes selected by rule V1, amendments as first signatory by published
// outcome, questions by kind with a published answer. Never a rate, never compared between terms or members.
// Pure functions, unit-tested.

import { outcomeCounts, questionCounts, voteLines, recorded, type Amendment, type OutcomeCounts, type Question, type Scrutin, type Vote } from "./activity";
import { inPeriod, inTermRow, type Member, type Membership, type Person, type Term } from "./members";

export type TermSummary = {
  term: Term; selected: number; recorded: number; amendments: OutcomeCounts;
  questions: ReturnType<typeof questionCounts>; groups: string[];
};

/** Memberships overlapping the term. */
export function membershipsIn(ms: Membership[], t: Pick<Term, "start" | "end">): Membership[] {
  return ms.filter((m) => (!t.end || (m.start_date ?? "") <= t.end) && (!m.end_date || m.end_date >= t.start));
}

export function termSummary(t: Term, selected: Scrutin[], votes: Vote[], own: Amendment[], questions: Question[],
  memberships: Membership[]): TermSummary {
  const scr = selected.filter((s) => inTermRow(s, s.date, t));
  const ids = new Set(scr.map((s) => s.id));
  const groups = [...new Set(membershipsIn(memberships, t).filter((m) => m.parl_organes.kind === "GP")
    .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "")).map((m) => m.parl_organes.label_fr))];
  return {
    term: t, selected: scr.length, recorded: recorded(voteLines(scr, votes.filter((v) => ids.has(v.scrutin_id)))),
    amendments: outcomeCounts(own.filter((a) => inTermRow(a, a.filed, t))),
    questions: questionCounts(questions.filter((q) => inTermRow(q, q.asked, t))),
    groups,
  };
}

/** The member's current term, as a Term (same shape as the earlier ones). */
export function currentTerm(p: Person): Term | null {
  return p.current ? p.terms.find((t) => t.end == null) ?? null : null;
}

/** Earlier terms of a person (ended), most recent first. */
export function pastTerms(p: Person): Term[] {
  return p.terms.filter((t) => t.end != null);
}

/** Rows of the current term only (the current-term blocks never mix in earlier legislatures). */
export function currentRows<T extends { chamber: "AN" | "SEN"; legislature: string }>(rows: T[], date: (r: T) => string | null,
  t: Term | null): T[] {
  return t ? rows.filter((r) => inTermRow(r, date(r), t)) : [];
}

/** « Ancien député de la 3e circonscription de la Martinique » for a former member's header. */
export function formerLabel(t: Term, sex: Member["sex"]): string {
  const f = sex === "F";
  return t.chamber === "AN"
    ? `${f ? "Ancienne députée" : "Ancien député"} de la ${t.rank === 1 ? "1re" : `${t.rank}e`} circonscription de la Martinique`
    : `${f ? "Ancienne sénatrice" : "Ancien sénateur"} de la Martinique`;
}

export { inPeriod };
