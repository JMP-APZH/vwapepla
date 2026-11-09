import type { Source } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import type { DataGap } from "@/lib/parlement/activity";
import { fill } from "@/lib/parlement/text";
import { parlement } from "@/i18n";

/** What the official open data does not give (absent or partial), as measured and dated by the pipeline
 *  (parl_data_gaps). Stated on every card, never hidden: knowing what is published comes before judging the work. */
export function DataGapsBlock({ gaps, sources, intro = true }: { gaps: DataGap[]; sources: Map<string, Source>; intro?: boolean }) {
  if (gaps.length === 0) return null;
  return (
    <aside className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700" aria-labelledby="gaps-title">
      <h2 id="gaps-title" className="font-semibold">{parlement.gapsTitle.fr}</h2>
      {intro && <p className="mt-1">{parlement.gapsIntro.fr}</p>}
      <ul className="mt-3 space-y-3">
        {gaps.map((g) => {
          const src = g.source_id ? sources.get(g.source_id) : undefined;
          return (
            <li key={g.id}>
              <p>
                <span className="font-medium">{g.label_fr}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${g.status === "absent" ? "bg-slate-200 text-slate-800" : "bg-amber-100 text-amber-900"}`}>
                  {g.status === "absent" ? parlement.gapAbsent.fr : parlement.gapPartial.fr}
                </span>
                <span className="ml-2 text-xs text-slate-500">{g.period}</span>
              </p>
              <p className="mt-0.5">{g.detail_fr}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {fill(parlement.gapChecked.fr, { date: date(g.checked_on) })}
                {src && <> · {src.credit}</>}
                {g.checked_url && <> · <a href={g.checked_url} className="underline" target="_blank" rel="noopener noreferrer">{parlement.gapSource.fr}</a></>}
              </p>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
