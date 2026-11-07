import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { meur, perHab, pct } from "@/lib/core/format";
import { areaTrend, NOT_BROKEN_DOWN, type AreaLine, type FunctionalRow } from "@/lib/ctm/functions";
import { ctm } from "@/i18n";

/** Spending by area for the reference year (areas in code order, never ranked) and the trend since 2018. */
export function AreaSpending({ year, lines, rows, sources }: {
  year: number; lines: AreaLine[]; rows: FunctionalRow[]; sources: Source[];
}) {
  const trend = areaTrend(rows);
  const range = `${trend.years[0]}-${trend.years.at(-1)}`;
  const total = lines.reduce((s, l) => s + l.total, 0);
  return (
    <FactBlock title={<>{ctm.areasTitle.fr} {year}</>} sources={sources} year={range}>
      <p className="mt-1 text-sm text-slate-600">{ctm.areasIntro.fr}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium" />
              <th className="py-1 pr-2 text-right font-medium">{ctm.areasOperating.fr}</th>
              <th className="py-1 pr-2 text-right font-medium">{ctm.areasInvestment.fr}</th>
              <th className="py-1 pr-2 text-right font-medium">{ctm.colPerHab.fr}</th>
              <th className="py-1 text-right font-medium">{ctm.colShare.fr}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.fonction} className={`border-b border-slate-100 ${l.fonction === NOT_BROKEN_DOWN ? "italic text-slate-600" : ""}`}>
                <td className="py-1.5 pr-2">
                  {l.fonction === NOT_BROKEN_DOWN ? ctm.areasNotBrokenDown.fr : l.label.replace(/\s*\(hors APA, RSA[^)]*\)/, "")}
                  <div className="mt-0.5 h-1.5 rounded bg-slate-100">
                    <div className="h-1.5 rounded bg-slate-600" style={{ width: `${Math.max(0.5, l.share * 100)}%` }} />
                  </div>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{meur(l.operating)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{meur(l.investment)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">{perHab(l.perHab)}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{pct(l.share)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5 pr-2">{ctm.areasTotal.fr}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{meur(lines.reduce((s, l) => s + (l.operating ?? 0), 0))}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{meur(lines.reduce((s, l) => s + (l.investment ?? 0), 0))}</td>
              <td className="py-1.5 pr-2" />
              <td className="py-1.5 text-right tabular-nums">{meur(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">{ctm.areasArea4.fr} {ctm.areasFrom2018.fr}</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">{ctm.areasTrendTitle.fr.replace("{range}", range)}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1 pr-2 font-medium" />
                {trend.years.map((y) => <th key={y} className="py-1 pr-2 text-right font-medium">{y}{trend.provisional.has(y) && "*"}</th>)}
              </tr>
            </thead>
            <tbody>
              {trend.areas.map((a) => (
                <tr key={a.fonction} className="border-b border-slate-100">
                  <td className="py-1 pr-2">{a.label.replace(/\s*\(hors APA, RSA[^)]*\)/, "")}</td>
                  {trend.years.map((y) => <td key={y} className="py-1 pr-2 text-right tabular-nums">{meur(a.values.get(y) ?? null)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {trend.provisional.size > 0 && <p className="mt-1 text-xs text-slate-500">* {ctm.provisionalNote.fr.replace("{year}", [...trend.provisional].join(", "))}</p>}
      </details>
      <div className="mt-3"><Caveat>{ctm.areasCaveat.fr}</Caveat></div>
    </FactBlock>
  );
}
