// Natural disaster recognitions (« arrêtés CatNat », GASPAR): one event = one decree (NOR), one risk, one start date,
// covering one or more communes. Pure functions, tested in prefet.test.ts.

export type Recognition = {
  id: string; nor: string; commune_code: string; risk: string; event_start: string | null; event_end: string | null;
  decree_date: string | null; jo_date: string | null; source_id: string;
};
export type DisasterEvent = {
  key: string; nor: string; risk: string; start: string | null; end: string | null; decree: string | null;
  jo: string | null; communes: string[];
};

/** Rows -> events (newest first), communes sorted by INSEE code. */
export function toEvents(rows: Recognition[]): DisasterEvent[] {
  const m = new Map<string, DisasterEvent>();
  for (const r of rows) {
    const key = `${r.nor}|${r.risk}|${r.event_start}`;
    const e = m.get(key) ?? { key, nor: r.nor, risk: r.risk, start: r.event_start, end: r.event_end,
      decree: r.decree_date, jo: r.jo_date, communes: [] };
    if (!e.communes.includes(r.commune_code)) e.communes.push(r.commune_code);
    m.set(key, e);
  }
  return [...m.values()].map((e) => ({ ...e, communes: e.communes.sort() }))
    .sort((a, b) => (b.start ?? "").localeCompare(a.start ?? "") || a.nor.localeCompare(b.nor));
}

/** Number of events per year of the event, from `from` (inclusive). */
export function eventsPerYear(events: DisasterEvent[], from: number): { year: number; events: number }[] {
  const c = new Map<number, number>();
  for (const e of events) {
    const y = Number(e.start?.slice(0, 4));
    if (y >= from) c.set(y, (c.get(y) ?? 0) + 1);
  }
  return [...c.entries()].sort((a, b) => a[0] - b[0]).map(([year, events]) => ({ year, events }));
}
