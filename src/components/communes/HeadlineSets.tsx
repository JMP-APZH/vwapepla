import type { HeadlineValue } from "@/lib/headline";
import { eur, pct, perHab, years } from "@/lib/format";
import { t } from "@/i18n/strings";

function show(h: HeadlineValue, v: number | null) {
  return h.figure.kind === "share" ? pct(v) : perHab(v);
}

/** One "3 chif" set: three stat tiles with the commune's value, then the comparison medians in muted text. */
export function HeadlineSet({ title, values }: { title: string; values: HeadlineValue[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {values.map((h) => (
          <div key={h.figure.label} className="min-w-0">
            <p className="text-xs text-slate-500">{h.figure.label}</p>
            <p className="mt-1 text-lg font-semibold leading-tight sm:text-2xl">
              {h.figure.kind === "share" ? pct(h.value) : eur(h.value)}
            </p>
            {h.figure.kind === "per_hab" && h.value != null && <p className="text-xs text-slate-500">par habitant</p>}
            {h.figure.kind === "per_hab" && h.figure.extra && (
              <p className="text-xs text-slate-600">
                {h.extra == null ? "délai non calculable" : `${years(h.extra)} ${h.figure.extra.label}`}
              </p>
            )}
            <dl className="mt-2 space-y-0.5 text-[11px] leading-snug text-slate-500">
              <div>
                <dt className="inline">{t.medianMartinique.fr} : </dt>
                <dd className="inline">{show(h, h.medianMartinique)}</dd>
              </div>
              {h.medianStratum != null && (
                <div>
                  <dt className="inline">{t.medianStratum.fr} ({h.stratumSize}) : </dt>
                  <dd className="inline">{show(h, h.medianStratum)}</dd>
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
