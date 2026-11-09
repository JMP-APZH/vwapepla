// Other offices of a parliamentarian shown elsewhere on Vwapepla (core table person_links: reviewed links only).

export type LinkRow = {
  same_as: string; evidence_url: string; evidence_label: string; verified_by: string; verified_at: string;
  other: { mandates: { start_date: string; end_date: string | null; source_id: string;
    seats: { label_fr: string; body_id: string; bodies: { name: string; institution_id: string; institutions: { name: string } } } }[] } | null;
};

export type OtherOffice = {
  label: string; place: string; start: string; end: string | null; href: string | null; sourceId: string;
  evidenceUrl: string; evidenceLabel: string; verifiedBy: string; verifiedAt: string;
};

/** Where the other card is: a commune card (/communes/<slug>) or the CTM body pages. */
export function officeHref(bodyId: string, institutionId: string, communeSlugs: Map<string, string>): string | null {
  const commune = institutionId.match(/^commune-(\d{5})$/)?.[1];
  if (commune) return communeSlugs.has(commune) ? `/communes/${communeSlugs.get(commune)}` : null;
  if (bodyId === "ctm-assemblee") return "/ctm/assemblee";
  if (bodyId === "ctm-conseil-executif") return "/ctm/conseil-executif";
  return null;
}

/** One line per mandate of the linked persons, current first, then most recent; consecutive identical mandates
 *  (same seat, end of one = start of the next, e.g. re-election) are merged into one span. */
export function otherOffices(rows: LinkRow[], communeSlugs: Map<string, string>): OtherOffice[] {
  const out: OtherOffice[] = [];
  for (const r of rows) {
    const ms = [...(r.other?.mandates ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date));
    const merged: typeof ms = [];
    for (const m of ms) {
      const last = merged[merged.length - 1];
      if (last && last.seats.body_id === m.seats.body_id && last.seats.label_fr === m.seats.label_fr && last.end_date === m.start_date) {
        merged[merged.length - 1] = { ...last, end_date: m.end_date };
      } else merged.push(m);
    }
    for (const m of merged) {
      const b = m.seats.bodies; // a commune's body is « Conseil municipal »: name the commune instead
      out.push({ label: m.seats.label_fr, place: b.institution_id.startsWith("commune-") ? b.institutions.name : b.name, start: m.start_date, end: m.end_date,
        href: officeHref(m.seats.body_id, m.seats.bodies.institution_id, communeSlugs), sourceId: m.source_id,
        evidenceUrl: r.evidence_url, evidenceLabel: r.evidence_label, verifiedBy: r.verified_by, verifiedAt: r.verified_at });
    }
  }
  return out.sort((a, b) => Number(a.end !== null) - Number(b.end !== null) || b.start.localeCompare(a.start));
}
