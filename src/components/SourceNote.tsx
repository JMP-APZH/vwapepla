import type { Source } from "@/lib/data";
import { date } from "@/lib/format";
import { t } from "@/i18n/strings";

/** Footnote required under every block of figures: dataset, fiscal year, retrieval date, link. */
export function SourceNote({ sources, year }: { sources: Source[]; year: number | string }) {
  const unique = [...new Map(sources.map((s) => [s.id, s])).values()];
  return (
    <p className="mt-3 text-xs leading-relaxed text-slate-500">
      {unique.map((s, i) => (
        <span key={s.id}>
          {i > 0 && " · "}
          {s.credit} —{" "}
          <a href={s.dataset_page ?? s.url} className="underline" target="_blank" rel="noopener noreferrer">
            {s.title ?? s.id}
          </a>
          , {typeof year === "string" ? "exercices" : "exercice"} {year}, {t.retrieved.fr} {date(s.retrieved)} ({s.licence}).
        </span>
      ))}
    </p>
  );
}
