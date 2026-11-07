import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActRow } from "@/components/ctm/Acts";
import { SourceNote } from "@/components/card/SourceNote";
import { getSources } from "@/lib/core/data";
import { int } from "@/lib/core/format";
import { countsByYear, parseQuery, search } from "@/lib/ctm/acts";
import { getActs } from "@/lib/ctm/data";
import { ctm } from "@/i18n";

export const metadata: Metadata = { title: ctm.actsPageTitle.fr };

const MAX = 200; // rows rendered; the search is done on the server over the cached index (about 6,100 acts)

// Search in the acts the CTM publishes online: a plain GET form (works without JavaScript), filtered on the server.
// No session date, no vote, no topic in the index; private individuals' names are masked.
export default function ActsPage({ searchParams }: PageProps<"/ctm/actes">) {
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{ctm.actsPageTitle.fr}</h1>
      <p className="text-slate-600">{ctm.actsIntro.fr} {ctm.actsMasked.fr}</p>
      <p className="text-sm"><Link href="/ctm" className="underline">← {ctm.cardTitle.fr}</Link></p>
      <Suspense fallback={<p className="text-sm text-slate-500">Chargement…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </article>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/ctm/actes">, "searchParams">) {
  const [acts, sources, sp] = await Promise.all([getActs(), getSources(), searchParams]);
  const query = parseQuery(sp);
  const found = search(acts, query);
  const years = countsByYear(acts).map((c) => c.year).filter((y): y is number => y != null).reverse();
  const src = [...new Set(acts.map((a) => a.source_id))].map((id) => sources.get(id)).filter((s) => s != null);
  return (
    <>
      <form method="get" action="/ctm/actes" className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,auto)_auto]">
        <label className="sr-only" htmlFor="q">{ctm.actsSearch.fr}</label>
        <input id="q" name="q" defaultValue={query.q} placeholder={ctm.actsSearchPlaceholder.fr}
               className="min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select name="organe" defaultValue={query.body ?? ""} aria-label="Organe" className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-sm">
          <option value="">{ctm.actsBodyAll.fr}</option>
          <option value="assemblee">{ctm.actsBodyAssemblee.fr}</option>
          <option value="conseil_executif">{ctm.actsBodyExecutif.fr}</option>
        </select>
        <select name="annee" defaultValue={query.year ?? ""} aria-label="Année" className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-sm">
          <option value="">{ctm.actsYearAll.fr}</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">{ctm.actsSearch.fr}</button>
      </form>
      <p className="text-sm text-slate-600">
        {found.length === 0 ? ctm.actsNone.fr
          : found.length > MAX ? ctm.actsResultsCapped.fr.replace("{n}", int(found.length)).replace("{max}", String(MAX))
            : ctm.actsResults.fr.replace("{n}", int(found.length))}
      </p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white px-3">
        {found.slice(0, MAX).map((a) => <ActRow key={a.id} a={a} showBody={query.body == null} />)}
      </ul>
      <SourceNote sources={src} year="2022-2026" />
    </>
  );
}
