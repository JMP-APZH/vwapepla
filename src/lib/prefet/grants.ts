// State investment grants (DETR, DSIL, DSID, DPV…) to local authorities in Martinique, decided by the préfet.
// beneficiary_key is normalised by scripts/prefet/grants.py; mapping_note says how when it had to be deduced.

export type Grant = {
  id: string; year: number; scheme: string; beneficiary_name: string; beneficiary_key: string; mapping_note: string | null;
  project: string; cost_ht: number | null; grant_amount: number; rate: number | null; source_id: string;
};
export type YearTotal = { year: number; total: number; count: number };
export type Beneficiary = {
  key: string; label: string; slug: string | null; total: number; count: number; grants: Grant[];
};

const OTHER_LABELS: Record<string, string> = {
  "epci-cacem": "CACEM (Centre)",
  "epci-caesm": "CAESM (Espace Sud)",
  "epci-capnord": "CAP Nord",
  ctm: "Collectivité territoriale de Martinique",
  inconnu: "Bénéficiaire non renseigné dans la source",
};

export function beneficiaryLabel(key: string, communes: Map<string, { name: string; slug: string }>): string {
  if (key.startsWith("commune-")) return communes.get(key.slice(8))?.name ?? `Commune ${key.slice(8)}`;
  return OTHER_LABELS[key] ?? key;
}

export function totalsByYear(grants: Grant[]): YearTotal[] {
  const m = new Map<number, YearTotal>();
  for (const g of grants) {
    const t = m.get(g.year) ?? { year: g.year, total: 0, count: 0 };
    t.total += g.grant_amount;
    t.count += 1;
    m.set(g.year, t);
  }
  return [...m.values()].sort((a, b) => a.year - b.year);
}

/** Beneficiaries by total received, largest first; each with its projects, latest year first. */
export function byBeneficiary(grants: Grant[], communes: Map<string, { name: string; slug: string }>): Beneficiary[] {
  const m = new Map<string, Beneficiary>();
  for (const g of grants) {
    const key = g.beneficiary_key;
    const b = m.get(key) ?? {
      key, label: beneficiaryLabel(key, communes), total: 0, count: 0, grants: [],
      slug: key.startsWith("commune-") ? communes.get(key.slice(8))?.slug ?? null : null,
    };
    b.total += g.grant_amount;
    b.count += 1;
    b.grants.push(g);
    m.set(key, b);
  }
  for (const b of m.values()) b.grants.sort((x, y) => y.year - x.year || y.grant_amount - x.grant_amount);
  return [...m.values()].sort((a, b) => b.total - a.total);
}
