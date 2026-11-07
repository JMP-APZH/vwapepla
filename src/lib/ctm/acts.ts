// Acts of the Assemblée (délibérations) and of the Conseil exécutif (arrêtés délibérés), as indexed from the CTM's
// website (pure, tested). No session date, no vote, no topic: not in the index. Private individuals' names are masked.

export type Body = "assemblee" | "conseil_executif";
export type Act = { id: string; body: Body; number: string | null; year: number | null; title: string; page_url: string; source_id: string };

/** Accents removed, lower case: "Délib" and "delib" match the same query. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Sort key of an act number 'YY-NNN-K' (numeric, so 26-90-1 comes before 26-276-1). */
function key(a: Act): [number, number, number] {
  const m = a.number?.match(/^(\d{2})-(\d{1,4})-(\d+)$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [a.year ?? 0, -1, -1];
}

/** Most recent first, by act number (the index has no session date). */
export function byNumberDesc(a: Act, b: Act): number {
  const x = key(a), y = key(b);
  return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || a.id.localeCompare(b.id);
}

export function countsByYear(acts: Act[]): { year: number | null; n: number }[] {
  const m = new Map<number | null, number>();
  for (const a of acts) m.set(a.year, (m.get(a.year) ?? 0) + 1);
  return [...m.entries()].map(([year, n]) => ({ year, n }))
    .sort((a, b) => (a.year == null ? 1 : b.year == null ? -1 : a.year - b.year));
}

export type ActQuery = { q: string; body: Body | null; year: number | null };

export function parseQuery(sp: { q?: string | string[]; organe?: string | string[]; annee?: string | string[] }): ActQuery {
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v) ?? "";
  const body = one(sp.organe);
  const year = Number(one(sp.annee));
  return { q: one(sp.q).trim().slice(0, 100), body: body === "assemblee" || body === "conseil_executif" ? body : null,
           year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null };
}

/** Every word of the query must appear in the title or the number (accents and case ignored). */
export function search(acts: Act[], query: ActQuery): Act[] {
  const words = fold(query.q).split(/\s+/).filter(Boolean);
  return acts
    .filter((a) => (query.body == null || a.body === query.body) && (query.year == null || a.year === query.year))
    .filter((a) => { const t = fold(`${a.number ?? ""} ${a.title}`); return words.every((w) => t.includes(w)); })
    .sort(byNumberDesc);
}
