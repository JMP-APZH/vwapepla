import type { Source } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { common } from "@/i18n";

/** Footnote required under every block of figures: dataset, period, retrieval date, link.
 *  `periodLabel` is the word printed before `year`: default « exercice(s) » (budget years); domains whose period is not
 *  a fiscal year pass their own word, or "" to print the period alone (e.g. « XVIIe législature »). */
export function SourceNote({ sources, year, periodLabel }: { sources: Source[]; year: number | string; periodLabel?: string }) {
  const unique = [...new Map(sources.map((s) => [s.id, s])).values()];
  const label = periodLabel ?? (typeof year === "string" ? "exercices" : "exercice");
  const period = [label, year].filter((x) => x !== "").join(" ");
  return (
    <p className="mt-3 text-xs leading-relaxed text-slate-500">
      {unique.map((s, i) => (
        <span key={s.id}>
          {i > 0 && " · "}
          {s.credit} —{" "}
          <a href={s.dataset_page ?? s.url} className="underline" target="_blank" rel="noopener noreferrer">
            {s.title ?? s.id}
          </a>
          {period && `, ${period}`}, {common.retrieved.fr} {date(s.retrieved)} ({s.licence}).
        </span>
      ))}
    </p>
  );
}
