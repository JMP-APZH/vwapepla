// fr-FR number formatting. `null` always renders as "non calculable" — never as 0.

const NA = "non calculable";

const eur0 = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const pct0 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

export function eur(v: number | null | undefined): string {
  return v == null ? NA : eur0.format(v);
}

/** Large totals in millions: "12,3 M€". */
export function meur(v: number | null | undefined): string {
  return v == null ? NA : `${dec1.format(v / 1e6)} M€`;
}

export function perHab(v: number | null | undefined): string {
  return v == null ? NA : `${eur0.format(v)} / hab.`;
}

export function years(v: number | null | undefined): string {
  return v == null ? NA : `${dec1.format(v)} ans`;
}

export function pct(v: number | null | undefined): string {
  return v == null ? NA : pct0.format(v);
}

export function int(v: number | null | undefined): string {
  return v == null ? NA : new Intl.NumberFormat("fr-FR").format(v);
}

export function date(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : NA;
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
