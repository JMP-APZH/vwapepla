// Parlement domain (B2): members (deputies, senators) as the card shows them. Pure functions, unit-tested.
// Facts only: names, seats, groups and committees exactly as the chambers publish them (neutrality charter §3.1).

export const AN_BODY = "assemblee-nationale-17";
export const SEN_BODY = "senat-hemicycle";

export type Chamber = "AN" | "SEN";

export type MandateRow = {
  person_id: string; seat_id: string; start_date: string; function_start: string | null; end_date: string | null;
  source_id: string; source_url: string | null;
  persons: { last_name: string; first_name: string; sex: "F" | "M" | null };
};

export type MandateDetail = {
  person_id: string; seat_id: string; election_cause: string | null; suppleant_last_name: string | null;
  suppleant_first_name: string | null; suppleant_sex: "F" | "M" | null; suppleant_source_id: string | null;
  official_url: string; hatvp_url: string | null; source_id: string;
};

export type Member = {
  personId: string; slug: string; chamber: Chamber; lastName: string; firstName: string; sex: "F" | "M" | null;
  seatId: string; rank: number; start: string; functionStart: string | null; sourceId: string;
  officialUrl: string; hatvpUrl: string | null; electionCause: string | null;
  suppleant: { lastName: string; firstName: string; sex: "F" | "M" | null; sourceId: string } | null;
};

export function slugify(...parts: string[]): string {
  return parts.join(" ").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** "Bellay" / "BELLAY" -> "Bellay"; "jean-philippe" -> "Jean-Philippe" (display only, the stored name is kept). */
export function displayName(s: string): string {
  return s.toLowerCase().replace(/(^|[\s'\-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
}

export function ordinal(n: number): string {
  return n === 1 ? "1re" : `${n}e`;
}

/** Seat title, gendered from the official civility: « Députée de la 3e circonscription de la Martinique ». */
export function seatLabel(m: Pick<Member, "chamber" | "rank" | "sex">): string {
  const f = m.sex === "F";
  return m.chamber === "AN"
    ? `${f ? "Députée" : "Député"} de la ${ordinal(m.rank)} circonscription de la Martinique`
    : `${f ? "Sénatrice" : "Sénateur"} de la Martinique`;
}

/** Sitting members, from the core mandates of the two bodies + parl_mandate_details. Deputies by circonscription, then
 *  senators in alphabetical order (never sorted by any activity figure: charter §3.2). */
export function toMembers(rows: MandateRow[], details: MandateDetail[]): Member[] {
  const byKey = new Map(details.map((d) => [`${d.person_id}|${d.seat_id}`, d]));
  return rows.filter((r) => r.end_date == null).map((r) => {
    const d = byKey.get(`${r.person_id}|${r.seat_id}`);
    const chamber: Chamber = r.seat_id.startsWith(`${AN_BODY}:`) ? "AN" : "SEN";
    const rank = Number(r.seat_id.match(/-(\d+)$/)?.[1] ?? 0);
    const lastName = displayName(r.persons.last_name);
    const firstName = displayName(r.persons.first_name);
    return {
      personId: r.person_id, slug: slugify(firstName, lastName), chamber, lastName, firstName, sex: r.persons.sex,
      seatId: r.seat_id, rank, start: r.start_date, functionStart: r.function_start, sourceId: r.source_id,
      officialUrl: d?.official_url ?? r.source_url ?? "", hatvpUrl: d?.hatvp_url ?? null,
      electionCause: d?.election_cause ?? null,
      suppleant: d?.suppleant_last_name && d.suppleant_first_name
        ? { lastName: displayName(d.suppleant_last_name), firstName: displayName(d.suppleant_first_name),
            sex: d.suppleant_sex, sourceId: d.suppleant_source_id ?? d.source_id }
        : null,
    };
  }).sort((a, b) => (a.chamber === b.chamber
    ? (a.chamber === "AN" ? a.rank - b.rank : a.lastName.localeCompare(b.lastName, "fr"))
    : a.chamber === "AN" ? -1 : 1));
}

// --- memberships (groups, committees, delegations…) -----------------------------------------------------------------

export type Membership = {
  id: string; person_id: string; organe_id: string; function: string | null; start_date: string | null;
  end_date: string | null; source_id: string;
  parl_organes: { kind: string; label_fr: string; short: string | null; chamber: Chamber };
};

export const KIND_ORDER = ["GP", "COMPER", "COM", "DELEG", "CNPE", "MISINFO", "MISINFOCOM", "MISINFOPRE", "CMP",
  "ORGEXTPARL", "COMNL", "CNPS", "MINISTERE", "GE", "GEVI", "GA", "API"] as const;

/** Memberships current on `today` (no end date, or ending later). */
export function isCurrent(m: Pick<Membership, "end_date">, today: string): boolean {
  return m.end_date == null || m.end_date >= today;
}

/** Current political group membership (AN: kind GP; Sénat: kind GP), latest start first. */
export function currentGroup(ms: Membership[], today: string): Membership | null {
  return ms.filter((m) => m.parl_organes.kind === "GP" && isCurrent(m, today))
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))[0] ?? null;
}

/** Current standing committee (AN COMPER, Sénat COM). */
export function currentCommittee(ms: Membership[], today: string): Membership | null {
  return ms.filter((m) => ["COMPER", "COM"].includes(m.parl_organes.kind) && isCurrent(m, today))
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))[0] ?? null;
}

/** Group memberships by organe kind, in a fixed order; same organe with several functions listed once per function. */
export function groupByKind(ms: Membership[]): { kind: string; items: Membership[] }[] {
  const order = (k: string) => { const i = (KIND_ORDER as readonly string[]).indexOf(k); return i < 0 ? 99 : i; };
  const map = new Map<string, Membership[]>();
  for (const m of ms) map.set(m.parl_organes.kind, [...(map.get(m.parl_organes.kind) ?? []), m]);
  return [...map.entries()].sort((a, b) => order(a[0]) - order(b[0]))
    .map(([kind, items]) => ({ kind, items: items.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? "")
      || a.parl_organes.label_fr.localeCompare(b.parl_organes.label_fr, "fr")) }));
}
