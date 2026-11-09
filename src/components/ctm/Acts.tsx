import Link from "next/link";
import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { int } from "@/lib/core/format";
import { byNumberDesc, countsByYear, type Act, type Body } from "@/lib/ctm/acts";
import { ctm } from "@/i18n";

export function ActRow({ a, showBody = false }: { a: Act; showBody?: boolean }) {
  return (
    <li className="py-1.5 text-sm">
      <a href={a.page_url} className="underline decoration-slate-300 hover:decoration-slate-700" target="_blank" rel="noopener noreferrer">
        {a.number && <span className="mr-1.5 font-mono text-xs text-slate-500">{a.number}</span>}
        {a.title}
      </a>
      {showBody && (
        <span className="ml-1.5 text-xs text-slate-500">
          · {a.body === "assemblee" ? ctm.actsBodyAssemblee.fr : ctm.actsBodyExecutif.fr}
        </span>
      )}
    </li>
  );
}

/** One body's acts: count per year (from the act number), the latest acts, a link to the search page. */
export function ActsSummary({ title, body, acts, sources, latest = 20 }: {
  title: string; body: Body; acts: Act[]; sources: Source[]; latest?: number;
}) {
  const own = acts.filter((a) => a.body === body);
  const counts = countsByYear(own);
  const missing = own.filter((a) => a.number == null).length;
  const years = counts.filter((c) => c.year != null).map((c) => c.year!);
  const range = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : "";
  return (
    <FactBlock title={title} sources={sources} year={range}>
      <p className="mt-1 text-sm text-slate-600">{ctm.actsIntro.fr}</p>
      <h3 className="mt-3 text-sm font-semibold">{ctm.actsPerYear.fr}</h3>
      <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {counts.map((c) => (
          <div key={c.year ?? "none"}>
            <dt className="inline text-slate-500">{c.year ?? ctm.actsNoNumber.fr} : </dt>
            <dd className="inline font-semibold tabular-nums">{int(c.n)}</dd>
          </div>
        ))}
      </dl>
      {missing > 0 && <p className="mt-1 text-xs text-slate-500">{ctm.actsMissingNumber.fr.replace("{n}", int(missing))}</p>}
      <h3 className="mt-3 text-sm font-semibold">{ctm.actsLatest.fr}</h3>
      <ul className="mt-1 divide-y divide-slate-100">{[...own].sort(byNumberDesc).slice(0, latest).map((a) => <ActRow key={a.id} a={a} />)}</ul>
      <p className="mt-2 text-sm">
        <Link href={`/ctm/actes?organe=${body}`} className="font-medium underline">{ctm.actsAll.fr} →</Link>
      </p>
      <p className="mt-1 text-xs text-slate-500">{ctm.actsMasked.fr}</p>
    </FactBlock>
  );
}
