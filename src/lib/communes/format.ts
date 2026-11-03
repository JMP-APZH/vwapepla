// Commune-card formats on top of the shared ones (src/lib/core/format.ts). `null` renders as "non calculable".

const NA = "non calculable";
const dec1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const int0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Capacité de désendettement: "5,7 ans"; from 10 years on, no decimal ("81 ans", "993 ans"). */
export function debtYears(v: number | null | undefined): string {
  return v == null ? NA : `${(Math.abs(v) >= 10 ? int0 : dec1).format(v)} ans`;
}

/** Rates where the first decimal matters (taux d'épargne brute): "7,2 %". */
export function pctDec(v: number | null | undefined): string {
  return v == null ? NA : pct1.format(v);
}
