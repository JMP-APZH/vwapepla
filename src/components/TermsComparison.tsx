import type { Officeholder } from "@/lib/data";
import { perHab, years as fmtYears } from "@/lib/format";
import { TERM_ROWS, type TermSummary } from "@/lib/terms";

/** Side-by-side table of terms (also the accessible table view of the trend charts). */
export function TermsComparison({ summaries, pastMayors }: { summaries: TermSummary[]; pastMayors: Officeholder[] }) {
  const mayorsOf = (termId: string) => pastMayors.filter((m) => m.term_id === termId);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-left align-bottom">
            <th className="py-2 pr-3 font-normal text-slate-500">Par habitant</th>
            {summaries.map((s) => (
              <th key={s.term.id} scope="col" className="py-2 pr-3 font-semibold">
                Mandat {s.term.id.replace("-", "–")}
                <span className="block text-xs font-normal text-slate-500">
                  {mayorsOf(s.term.id).map((m) => `${m.first_name} ${m.last_name}`).join(", ") || "maire : à vérifier"}
                </span>
                <span className="block text-xs font-normal text-slate-500">
                  {s.partial ? `données partielles (${s.years.join(", ")})` : `années ${s.years[0]}–${s.years.at(-1)}`}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {TERM_ROWS.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-slate-700">{r.label}</th>
              {summaries.map((s) => (
                <td key={s.term.id} className="py-1.5 pr-3 tabular-nums">
                  {r.unit === "years" ? fmtYears(s.values[r.key]) : perHab(s.values[r.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
