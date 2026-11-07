import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ComparePicker } from "@/components/communes/ComparePicker";
import { SourceNote } from "@/components/card/SourceNote";
import { BLOCKS, blockLines } from "@/lib/communes/breakdown";
import { compareRows, parseCompare } from "@/lib/communes/compare";
import { FIRST_YEAR, HERO, HERO_METRICS, PROVISIONAL_YEARS, REFERENCE_YEAR, STRATA } from "@/lib/communes/config";
import { computeHero, heroKeys } from "@/lib/communes/headline";
import { debtYears, pctDec } from "@/lib/communes/format";
import { getCommunes, getCommuneYears, getMetrics, getYearActuals } from "@/lib/communes/data";
import { getSources } from "@/lib/core/data";
import { eur, int, pct, years as yrs } from "@/lib/core/format";
import { common, communes } from "@/i18n";

export const metadata: Metadata = { title: "Comparer des communes" };

export default function ComparePage({ searchParams }: PageProps<"/communes/comparer">) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Comparer des communes</h1>
      <p className="mt-2 text-slate-600">
        Choisissez de 2 à 4 communes. Les chiffres sont en euros par habitant, présentés côte à côte dans l&apos;ordre
        choisi, avec la médiane des 34 communes comme repère. {common.noRanking.fr}
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Chargement…</p>}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const fmt = (unit: string, v: number | null | undefined, perHabValue: number | null | undefined) =>
  unit === "eur" ? eur(perHabValue) : unit === "years" ? yrs(v) : pct(v);

async function Comparison({ searchParams }: Pick<PageProps<"/communes/comparer">, "searchParams">) {
  const sp = await searchParams;
  const [list, allYears, metrics, sources] = await Promise.all([
    getCommunes(), getCommuneYears(), getMetrics(), getSources(),
  ]);
  const years = [...new Set(allYears.map((y) => y.year))].filter((y) => y >= FIRST_YEAR).sort((a, b) => a - b);
  const { codes, year } = parseCompare(sp.c, sp.annee, new Set(list.map((c) => c.code)), years, REFERENCE_YEAR);
  const picker = <ComparePicker communes={list.map((c) => ({ code: c.code, name: c.name }))} codes={codes} year={year} years={years} />;
  if (codes.length < 2) {
    return (
      <div className="mt-6 space-y-4">
        {picker}
        <p className="text-sm text-slate-600">Choisissez au moins deux communes pour afficher la comparaison.</p>
      </div>
    );
  }

  const blocks = BLOCKS.map((b) => ({ ...b, lines: blockLines(metrics, b.id) }));
  const rows = await getYearActuals(year, [...new Set([...blocks.flatMap((b) => b.lines.map((l) => l.key)), ...heroKeys(HERO)])]);
  // Key figures first (same definitions as the card's hero); median of the 34 communes, since the communes picked
  // can belong to different population strata.
  const hero = codes.map((code) => computeHero(HERO, code, rows, new Map()));
  const showHero = (kind: string, v: number | null) =>
    kind === "ratio" ? pctDec(v) : kind === "years" ? debtYears(v) : eur(v);
  const picked = codes.map((code) => ({
    commune: list.find((c) => c.code === code)!,
    profile: allYears.find((y) => y.commune_code === code && y.year === year),
  }));
  const usedSources = [...new Set(rows.filter((r) => codes.includes(r.commune_code)).map((r) => r.source_id))]
    .map((id) => sources.get(id)).filter((s) => s != null);
  const provisional = PROVISIONAL_YEARS.includes(year);
  const cell = "whitespace-nowrap px-3 py-2 text-right tabular-nums align-top";
  const label = "sticky left-0 z-10 bg-white px-3 py-2 text-left align-top font-normal";

  return (
    <div className="mt-6 space-y-4">
      {picker}
      {provisional && <p className="text-xs text-amber-800">{common.provisionalNote.fr}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Comparaison {year}, euros par habitant</caption>
          <thead className="border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th className={`${label} w-40 min-w-36`}>
                Exercice {year}{provisional && ` (${common.provisional.fr})`}
                <span className="block">en € par habitant, sauf taux et années</span>
              </th>
              {picked.map((p) => (
                <th key={p.commune.code} className={`${cell} min-w-28 font-semibold text-slate-900`}>
                  <Link href={`/communes/${p.commune.slug}`} className="underline">{p.commune.name}</Link>
                </th>
              ))}
              <th className={`${cell} min-w-28 font-normal`}>{communes.medianMartinique.fr}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <th className={label}>{communes.population.fr}</th>
              {picked.map((p) => <td key={p.commune.code} className={cell}>{int(p.profile?.population)} hab.</td>)}
              <td className={cell} />
            </tr>
            <tr className="border-b border-slate-100">
              <th className={label}>{communes.stratum.fr}</th>
              {picked.map((p) => (
                <td key={p.commune.code} className={`${cell} whitespace-normal text-xs`}>{(p.profile?.stratum && STRATA[p.profile.stratum]) ?? "—"}</td>
              ))}
              <td className={cell} />
            </tr>
            <tr className="border-b border-slate-200">
              <th className={label}>{communes.intercommunality.fr}</th>
              {picked.map((p) => (
                <td key={p.commune.code} className={`${cell} whitespace-normal text-xs`}>
                  {p.profile?.epci_name?.replace(/^Communauté d'agglomération (du |de l'|de la )?/i, "") ?? "—"}
                </td>
              ))}
              <td className={cell} />
            </tr>
            <tr className="bg-slate-50">
              <th colSpan={picked.length + 2} className="px-0 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <span className="sticky left-0 inline-block px-3">{communes.keyFigures.fr}</span>
              </th>
            </tr>
            {HERO.map((f, i) => (
              <tr key={f.key} className="border-b border-slate-100">
                <th className={`${label} font-medium`}>{f.label}</th>
                {hero.map((h, j) => (
                  <td key={codes[j]} className={`${cell} font-medium`}>{showHero(f.kind, h[i].value)}</td>
                ))}
                <td className={`${cell} text-slate-500`}>{showHero(f.kind, hero[0][i].median)}</td>
              </tr>
            ))}
            {blocks.map((b) => [
              <tr key={b.id} className="bg-slate-50">
                <th colSpan={picked.length + 2} className="px-0 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <span className="sticky left-0 inline-block px-3">{b.title}</span>
                </th>
              </tr>,
              ...compareRows(b.lines, codes, rows).map((r) => (
                <tr key={r.line.key} className="border-b border-slate-100">
                  <th className={`${label} ${r.line.depth === 0 ? "font-medium" : ""} ${r.line.subset ? "italic text-slate-600" : ""}`}
                      style={{ paddingLeft: `${0.75 + r.line.depth * 0.75}rem` }}>
                    {r.line.label}
                  </th>
                  {r.values.map((v, i) => (
                    <td key={codes[i]} className={`${cell} ${r.line.depth === 0 ? "font-medium" : ""}`}>
                      {fmt(r.line.unit, v?.amount, v?.perHab)}
                    </td>
                  ))}
                  <td className={`${cell} text-slate-500`}>
                    {HERO_METRICS.has(r.line.key) ? communes.keyFigureMark.fr : fmt(r.line.unit, r.medianMartinique, r.medianMartinique)}
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <SourceNote sources={usedSources} year={year} />
      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{communes.caveatEpci.fr}</aside>
    </div>
  );
}
