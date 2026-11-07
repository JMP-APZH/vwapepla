import type { Officeholder } from "@/lib/communes/data";
import { perHab } from "@/lib/core/format";
import { debtYears, pctDec } from "@/lib/communes/format";
import { TERM_ROWS, termChange, type TermSummary } from "@/lib/communes/terms";
import { mayorsOfTerm } from "@/lib/communes/council";
import { communes } from "@/i18n";

/** Side-by-side table of terms (also the accessible table view of the trend charts). */
export function TermsComparison({ summaries, pastMayors }: { summaries: TermSummary[]; pastMayors: Officeholder[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-left align-bottom">
            <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-normal text-slate-500">Indicateur</th>
            {summaries.map((s) => {
              const mayors = mayorsOfTerm(pastMayors, s.term.id);
              return (
                <th key={s.term.id} scope="col" className="py-2 pr-3 font-semibold">
                  Mandat {s.term.id.replace("-", "–")}
                  {mayors.length === 0 && <span className="block text-xs font-normal text-slate-500">maire : non trouvé</span>}
                  {mayors.map((m) => (
                    <span key={`${m.name}-${m.from}`} className="block text-xs font-normal text-slate-600">
                      {m.name}
                      {mayors.length > 1 && <span className="text-slate-500"> ({m.from}–{m.to ?? ""})</span>}
                      {m.evidence === "secondaire" && (
                        <>
                          {" "}
                          {m.sourceUrl
                            ? <a href={m.sourceUrl} className="text-amber-800 underline" target="_blank" rel="noopener noreferrer">à confirmer</a>
                            : <span className="text-amber-800">à confirmer</span>}
                        </>
                      )}
                    </span>
                  ))}
                  <span className="block text-xs font-normal text-slate-500">
                    {s.partial ? `données partielles (${s.years.join(", ")})` : `années ${s.years[0]}–${s.years.at(-1)}`}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {TERM_ROWS.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="sticky left-0 z-10 bg-white py-1.5 pr-3 text-left font-normal text-slate-700">{r.label}</th>
              {summaries.map((s, i) => {
                const change = i > 0 ? termChange(r.unit, s.values[r.key], summaries[i - 1].values[r.key]) : null;
                return (
                  <td key={s.term.id} className="py-1.5 pr-3 tabular-nums">
                    {r.unit === "years" ? debtYears(s.values[r.key]) : r.unit === "pct" ? pctDec(s.values[r.key]) : perHab(s.values[r.key])}
                    {change && (
                      <span className="block text-[11px] text-slate-500">
                        <span className="sr-only">{communes.evolution.fr} : </span>{change}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
