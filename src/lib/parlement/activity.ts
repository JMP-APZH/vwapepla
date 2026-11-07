// Parlement domain (B2): activity figures, as the neutrality charter (docs/branches/B2-DISCOVERY.md §3) allows them.
// Counts over the current term only; amendments counted as first signatory only (co-signatures are listed, never
// totalled next to them); no rate, no score, no ranking. Pure functions, unit-tested.

export type Scrutin = {
  id: string; chamber: "AN" | "SEN"; legislature: string; number: number; date: string; type_code: string;
  type_label: string; title: string; object: string | null; text_id: string | null; result_code: string | null;
  result_label: string | null; voters: number | null; pour: number; contre: number; abstentions: number | null;
  non_votants: number | null; text_signet: string | null; selected_by: string[]; url: string; source_id: string;
};

export type Vote = {
  scrutin_id: string; person_id: string; position: "pour" | "contre" | "abstention" | "nonVotant" | "nonVotantVolontaire";
  by_delegation: boolean; group_id: string | null; group_position: string | null; cause: string | null;
  mise_au_point: string | null; source_id: string;
};

export type Amendment = {
  id: string; amendment_id: string; chamber: "AN" | "SEN"; legislature: string; person_id: string;
  role: "premier_signataire" | "cosignataire"; as_rapporteur: boolean; signatories: number; number: string;
  text_ref: string | null; text_number: string | null; text_title: string | null; article: string | null;
  filed: string | null; outcome: string | null; state: string | null; url: string | null; source_id: string;
};

export type Question = {
  id: string; chamber: "AN" | "SEN"; legislature: string; person_id: string; kind: string; number: string | null;
  title: string | null;
  rubrique: string | null; ministry: string | null; asked: string | null; answered: string | null;
  status: string | null; url: string | null; source_id: string;
};

export const POSITION_FR: Record<string, string> = {
  pour: "Pour", contre: "Contre", abstention: "Abstention", nonVotant: "Non-votant",
  nonVotantVolontaire: "Non-votant volontaire",
};
export const NO_VOTE = "Pas de vote enregistré";

/** Rule V1 parts (docs/branches/B2-DISCOVERY.md §3.4), in display order. */
export const RULE_PARTS = [
  { key: "V1:a", label: "Scrutins solennels" },
  { key: "V1:b", label: "Votes sur l'ensemble d'un texte" },
  { key: "V1:c", label: "Outre-mer" },
  { key: "V1:d", label: "Motions de censure" },
] as const;

/** Parts of the rule that select at least one of these scrutins (the Sénat has no solemn flag, no censure motion). */
export function partsUsed(scrutins: Pick<Scrutin, "selected_by">[]): (typeof RULE_PARTS)[number][] {
  const used = new Set(scrutins.flatMap((s) => s.selected_by));
  return RULE_PARTS.filter((p) => used.has(p.key));
}

export type VoteLine = {
  scrutin: Scrutin; position: string; groupPosition: string | null; byDelegation: boolean; correction: string | null;
  status: string | null;
};

/** One line per scrutin (most recent first): the member's recorded position, or « pas de vote enregistré »
 *  (which is not an absence: charter §3.3). */
export function voteLines(scrutins: Scrutin[], votes: Vote[]): VoteLine[] {
  const mine = new Map(votes.map((v) => [v.scrutin_id, v]));
  return [...scrutins].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number).map((s) => {
    const v = mine.get(s.id);
    return {
      scrutin: s,
      position: v ? POSITION_FR[v.position] ?? v.position : NO_VOTE,
      groupPosition: v?.group_position ? POSITION_FR[v.group_position] ?? v.group_position : null,
      byDelegation: v?.by_delegation ?? false,
      status: s.chamber === "SEN" ? v?.cause ?? null : null, // Sénat: published status (congé, président de séance…)
      correction: v?.mise_au_point ? (POSITION_FR[v.mise_au_point.replace(/^dysfonctionnement:/, "")] ?? v.mise_au_point) : null,
    };
  });
}

/** Number of scrutins of the list where a position is recorded (never shown as a rate). */
export function recorded(lines: VoteLine[]): number {
  return lines.filter((l) => l.position !== NO_VOTE).length;
}

// --- amendments ------------------------------------------------------------------------------------------------------

export type OutcomeCounts = { total: number; adopted: number; rejected: number; other: number; pending: number };

const ADOPTED = /^adopt/i;
const REJECTED = /^rejet/i;

/** Outcomes of the amendments filed as first signatory, as published (« en attente » = no outcome published yet). */
export function outcomeCounts(rows: Amendment[]): OutcomeCounts {
  const own = rows.filter((a) => a.role === "premier_signataire");
  const c = { total: own.length, adopted: 0, rejected: 0, other: 0, pending: 0 };
  for (const a of own) {
    if (!a.outcome) c.pending++;
    else if (ADOPTED.test(a.outcome)) c.adopted++;
    else if (REJECTED.test(a.outcome)) c.rejected++;
    else c.other++;
  }
  return c;
}

/** Other outcomes (retiré, tombé, non soutenu, irrecevable…) with their count, as published. */
export function otherOutcomes(rows: Amendment[]): [string, number][] {
  const m = new Map<string, number>();
  for (const a of rows) {
    if (a.role !== "premier_signataire" || !a.outcome || ADOPTED.test(a.outcome) || REJECTED.test(a.outcome)) continue;
    m.set(a.outcome, (m.get(a.outcome) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// --- questions -------------------------------------------------------------------------------------------------------

export const QUESTION_KIND_FR: Record<string, string> = {
  QE: "Questions écrites", QOSD: "Questions orales sans débat", QG: "Questions au Gouvernement",
  QAG: "Questions au Gouvernement", QC: "Questions cribles", QOAD: "Questions orales avec débat",
};
const KIND_ORDER = ["QE", "QOSD", "QG", "QAG", "QC", "QOAD"];

/** Questions by kind: total and number with a published answer. */
export function questionCounts(rows: Question[]): { kind: string; label: string; total: number; answered: number }[] {
  const m = new Map<string, { total: number; answered: number }>();
  for (const q of rows) {
    const c = m.get(q.kind) ?? { total: 0, answered: 0 };
    c.total++;
    if (q.answered) c.answered++;
    m.set(q.kind, c);
  }
  const order = (k: string) => { const i = KIND_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  return [...m.entries()].sort((a, b) => order(a[0]) - order(b[0]))
    .map(([kind, c]) => ({ kind, label: QUESTION_KIND_FR[kind] ?? kind, ...c }));
}

// --- data gaps -------------------------------------------------------------------------------------------------------

export type DataGap = {
  id: string; chamber: "AN" | "SEN"; person_id: string | null; period: string; topic: string;
  status: "absent" | "partiel"; label_fr: string; detail_fr: string; checked_url: string | null; checked_on: string;
  source_id: string | null;
};

const TOPIC_ORDER = ["votes", "presence", "amendements", "questions", "declarations", "mandats"];

/** Gaps that concern one member: their chamber's general gaps and their own, in a fixed topic order. Gaps of one AN
 *  legislature (id « an-<n>-… ») only for members who sat in it; gaps about former members only on their cards. */
/** Legislatures whose amendments file could not be loaded (gap `an-<n>-amendements-non-charges`): never shown as zero. */
export function amendmentsNotLoaded(gaps: DataGap[]): Set<string> {
  return new Set(gaps.flatMap((g) => g.id.match(/^an-(\d+)-amendements-non-charges$/)?.[1] ?? []));
}

export function gapsFor(gaps: DataGap[], m: { chamber: "AN" | "SEN"; personId: string; legislatures?: string[]; current?: boolean }): DataGap[] {
  const order = (t: string) => { const i = TOPIC_ORDER.indexOf(t); return i < 0 ? 99 : i; };
  return gaps.filter((g) => {
    if (g.chamber !== m.chamber || (g.person_id != null && g.person_id !== m.personId)) return false;
    const leg = g.id.match(/^an-(\d+)-/)?.[1];
    if (leg && m.legislatures && !m.legislatures.includes(leg)) return false;
    if (g.id.startsWith("hatvp-anciens") && m.current !== false) return false;
    return true;
  }).sort((a, b) => order(a.topic) - order(b.topic) || a.id.localeCompare(b.id));
}
