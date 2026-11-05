// Postings in the préfecture of Martinique (préfet, secrétaire général, directeur de cabinet, sous-préfets), from the
// appointment decrees of the Journal officiel. Pure functions, unit-tested in prefet.test.ts.
//
// One posting = one person appointed by one decree. A sous-préfet appointed « de La Trinité et de Saint-Pierre » holds
// two seats with the same decree: one posting, two seats.

export type SeatKey = "prefet" | "secretaire_general" | "directeur_cabinet" | "sous_prefet-2" | "sous_prefet-3" | "sous_prefet-4";

export type MandateRow = {
  person_id: string; seat_id: string; start_date: string; function_start: string | null; end_date: string | null;
  source_id: string; source_url: string | null;
  persons: { last_name: string; first_name: string; sex: "F" | "M" | null } | null;
};
export type PostingEvent = {
  id: string; seat_id: string; kind: "appointment" | "taking_office" | "end" | "interim_start" | "interim_end";
  event_date: string; detail: string | null; source_id: string; source_url: string;
};
export type CareerStep = {
  id: string; person_id: string; signature_date: string; post: string; previous_post: string | null;
  effective_date: string | null; source_id: string; source_url: string;
};

/** Cut-off (docs/branches/B4-DISCOVERY.md §8, proposal awaiting JM's validation). */
export const FULL_FROM = "2018-01-01"; // State data (grants) complete from 2018
export const PARTIAL_FROM = "2015-12-01"; // postings covered from Dec 2015
export const SEARCH_FROM = "2007-01-01"; // decrees searched from 2007

export type Coverage = "full" | "partial" | "identity";

export type Posting = {
  slug: string; personId: string; lastName: string; firstName: string; sex: "F" | "M" | null;
  seats: SeatKey[]; start: string; functionStart: string | null; end: string | null;
  sourceId: string; sourceUrl: string | null; coverage: Coverage;
};

export const SEAT_ORDER: SeatKey[] = ["prefet", "secretaire_general", "directeur_cabinet", "sous_prefet-2", "sous_prefet-4", "sous_prefet-3"];

export function seatKey(seatId: string): SeatKey {
  return seatId.split(":").at(-1) as SeatKey;
}

/** Post title, feminine when the decree says « Mme » (as written in the decrees). */
export function postLabel(seats: SeatKey[], sex: "F" | "M" | null): string {
  const f = sex === "F";
  const sp = f ? "Sous-préfète" : "Sous-préfet";
  if (seats.includes("sous_prefet-2") && seats.includes("sous_prefet-4")) return `${sp} de La Trinité et de Saint-Pierre`;
  switch (seats[0]) {
    case "prefet": return f ? "Préfète de la région Martinique" : "Préfet de la région Martinique";
    case "secretaire_general": return f ? "Secrétaire générale de la préfecture" : "Secrétaire général de la préfecture";
    case "directeur_cabinet": return f ? "Directrice de cabinet du préfet" : "Directeur de cabinet du préfet";
    case "sous_prefet-2": return `${sp} de La Trinité`;
    case "sous_prefet-3": return `${sp} du Marin`;
    case "sous_prefet-4": return `${sp} de Saint-Pierre`;
    default: return "Poste";
  }
}

const ROLE_SLUG: Record<SeatKey, string> = {
  prefet: "prefet", secretaire_general: "secretaire-general", directeur_cabinet: "directeur-cabinet",
  "sous_prefet-2": "sous-prefet", "sous_prefet-3": "sous-prefet", "sous_prefet-4": "sous-prefet",
};

function ascii(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function coverage(start: string, end: string | null): Coverage {
  if (end && end < PARTIAL_FROM) return "identity";
  return start >= FULL_FROM ? "full" : "partial";
}

/** Mandate rows -> postings (joint seats merged), each with a stable slug '<year>-<role>-<name>'. */
export function toPostings(rows: MandateRow[]): Posting[] {
  const byKey = new Map<string, Posting>();
  for (const m of [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.seat_id.localeCompare(b.seat_id))) {
    const key = `${m.person_id}|${m.start_date}`;
    const seat = seatKey(m.seat_id);
    const p = byKey.get(key);
    if (p) {
      p.seats.push(seat);
      continue;
    }
    const last = m.persons?.last_name ?? m.person_id.split(":")[1];
    byKey.set(key, {
      slug: `${m.start_date.slice(0, 4)}-${ROLE_SLUG[seat]}-${ascii(last)}`, personId: m.person_id, lastName: last,
      firstName: m.persons?.first_name ?? "", sex: m.persons?.sex ?? null, seats: [seat], start: m.start_date,
      functionStart: m.function_start, end: m.end_date, sourceId: m.source_id, sourceUrl: m.source_url,
      coverage: coverage(m.start_date, m.end_date),
    });
  }
  const out = [...byKey.values()];
  for (const p of out) p.seats.sort((a, b) => SEAT_ORDER.indexOf(a) - SEAT_ORDER.indexOf(b));
  return out;
}

/** Postings of one seat, most recent first. */
export function seatTimeline(postings: Posting[], seat: SeatKey): Posting[] {
  return postings.filter((p) => p.seats.includes(seat)).sort((a, b) => b.start.localeCompare(a.start));
}

/** Holder of a seat today (no end date). */
export function currentHolder(postings: Posting[], seat: SeatKey): Posting | undefined {
  return seatTimeline(postings, seat).find((p) => p.end == null);
}

/** Periods of a seat with no decree found between two postings (more than 90 days). Before the first posting found,
 *  nothing is said: the holder in post when the search starts (2007) was appointed earlier. */
export function gaps(postings: Posting[], seat: SeatKey): { from: string; to: string }[] {
  const t = [...seatTimeline(postings, seat)].reverse();
  const out: { from: string; to: string }[] = [];
  let cursor: string | null = null;
  for (const p of t) {
    if (cursor && days(cursor, p.start) > 90) out.push({ from: cursor, to: p.start });
    if (p.end == null) return out;
    if (!cursor || p.end > cursor) cursor = p.end;
  }
  return out;
}

function days(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

/** Calendar years a posting covers (for the State data shown "during the posting"). */
export function postingYears(p: Posting, today: string): number[] {
  const from = Number(p.start.slice(0, 4));
  const to = Number((p.end ?? today).slice(0, 4));
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
