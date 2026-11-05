// CTM people helpers (pure, tested in ctm.test.ts). Sources (JM, 5 Nov 2026): RNE for the Assemblée; RNE, then HATVP
// (verified = false) for the Conseil exécutif; the Ministry's 2015 "Elus" sheet for the first assembly. Every
// disagreement between sources is returned, never resolved silently.

export const ASSEMBLEE = "ctm-assemblee";
export const EXECUTIF = "ctm-conseil-executif";
export const T2015 = "ctm-2015-2021";
export const T2021 = "ctm-2021-2028";
export const SECTIONS = ["Section du Centre", "Section du Nord", "Section du Sud", "Section de Fort-de-France"];

export type MandateRow = {
  person_id: string; seat_id: string; start_date: string; function_start: string | null; end_date: string | null;
  verified: boolean; source_id: string; source_url: string | null; term_id: string;
  persons: { last_name: string; first_name: string; sex: "F" | "M" | null };
};
export type SectionRow = { person_id: string; term_id: string; section: string; source_id: string };
export type ListMember = { person_id: string; list_id: string; match: "publie" | "deduit" | "a_verifier"; note: string | null; source_id: string };
export type ElectoralList = {
  id: string; election_year: number; round: number; number: number; label_short: string; label: string;
  nuance: string | null; head: string; votes: number; pct_exprimes: number | null; seats: number | null; source_id: string;
};

export type Member = {
  personId: string; name: string; sex: "F" | "M" | null; role: string; roleLabel: string; section: string | null;
  start: string; functionStart: string | null; odd: boolean; verified: boolean; sourceId: string; sourceUrl: string | null;
  list: { label: string; year: number; match: ListMember["match"]; note: string | null } | null;
};

const ROLE_ORDER = ["president", "vice-president", "conseiller-executif", "conseiller"];

export function roleLabel(seatId: string, sex: "F" | "M" | null): string {
  const f = sex === "F";
  const [body, role] = seatId.split(":");
  if (body === EXECUTIF) {
    return role === "president" ? (f ? "Présidente du Conseil exécutif" : "Président du Conseil exécutif")
      : f ? "Conseillère exécutive" : "Conseiller exécutif";
  }
  return role === "president" ? (f ? "Présidente de l'Assemblée" : "Président de l'Assemblée")
    : role === "vice-president" ? (f ? "Vice-présidente" : "Vice-président")
      : f ? "Conseillère" : "Conseiller";
}

/** First name then family name, as on the other cards ("Lucien SALIBER"). */
export function displayName(p: MandateRow["persons"]): string {
  return `${p.first_name} ${p.last_name}`;
}

export function members(mandates: MandateRow[], sections: SectionRow[], listMembers: ListMember[], lists: ElectoralList[],
                        term: string, body: string): Member[] {
  const section = new Map(sections.filter((s) => s.term_id === term).map((s) => [s.person_id, s.section]));
  const listById = new Map(lists.map((l) => [l.id, l]));
  const year = term === T2015 ? 2015 : 2021;
  const listOf = new Map(listMembers.filter((m) => listById.get(m.list_id)?.election_year === year).map((m) => [m.person_id, m]));
  return mandates
    .filter((m) => m.term_id === term && m.seat_id.startsWith(`${body}:`))
    .map((m) => {
      const lm = listOf.get(m.person_id), l = lm && listById.get(lm.list_id);
      const role = m.seat_id.split(":")[1];
      return {
        personId: m.person_id, name: displayName(m.persons), sex: m.persons.sex, role, roleLabel: roleLabel(m.seat_id, m.persons.sex),
        section: section.get(m.person_id) ?? null, start: m.start_date, functionStart: m.function_start,
        odd: isOdd({ start: m.start_date, functionStart: m.function_start }, term), verified: m.verified,
        sourceId: m.source_id, sourceUrl: m.source_url,
        list: l ? { label: l.label, year: l.election_year, match: lm!.match, note: lm!.note } : null,
      };
    })
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
      || (a.functionStart ?? "").localeCompare(b.functionStart ?? "") || a.name.localeCompare(b.name, "fr"));
}

export function bySection(list: Member[]): { section: string; members: Member[] }[] {
  const known = SECTIONS.map((section) => ({ section, members: list.filter((m) => m.section === section) }));
  const other = list.filter((m) => !m.section || !SECTIONS.includes(m.section));
  return other.length ? [...known, { section: "Section non renseignée", members: other }] : known;
}

/** People listed in both bodies for the same term (e.g. a councillor in RNE, a conseiller exécutif in HATVP). */
export function inBothBodies(mandates: MandateRow[], term: string): string[] {
  const exec = new Set(mandates.filter((m) => m.term_id === term && m.seat_id.startsWith(`${EXECUTIF}:`)).map((m) => m.person_id));
  return [...new Set(mandates.filter((m) => m.term_id === term && m.seat_id.startsWith(`${ASSEMBLEE}:`) && exec.has(m.person_id))
    .map((m) => displayName(m.persons)))].sort();
}

export const TERM_START: Record<string, string> = { [T2015]: "2015-12-13", [T2021]: "2021-07-02" };

/** A date before the start of the term, or a function start before the mandate start, cannot be right: shown as
 *  "to verify", value kept as published (e.g. RNE gives 7 Feb 2021 for a mandate of the term elected in June 2021). */
export function isOdd(m: Pick<Member, "start" | "functionStart">, term: string): boolean {
  return (m.functionStart != null && m.functionStart < m.start) || m.start < (TERM_START[term] ?? "");
}

export function oddDates(list: Member[]): Member[] {
  return list.filter((m) => m.odd);
}

export function roundTwo(lists: ElectoralList[], year: number): ElectoralList[] {
  return lists.filter((l) => l.election_year === year && l.round === 2).sort((a, b) => a.number - b.number);
}
