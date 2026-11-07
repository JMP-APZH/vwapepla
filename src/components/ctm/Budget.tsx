import type { ReactNode } from "react";
import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { meur, perHab, pct, years } from "@/lib/core/format";
import type { BeforeRow, Line, Point } from "@/lib/ctm/budget";
import { ctm } from "@/i18n";
import { TrendChart } from "./TrendChart";

/** A total and its parts for one year: amount, per inhabitant, share of the total. */
export function BreakdownBlock({ title, year, total, parts, extra, sources }: {
  title: ReactNode; year: number; total: Line; parts: Line[]; extra?: Line[]; sources: Source[];
}) {
  return (
    <FactBlock title={<>{title} {year}</>} sources={sources} year={year}>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium" />
              <th className="py-1 pr-2 text-right font-medium">{ctm.colAmount.fr}</th>
              <th className="py-1 pr-2 text-right font-medium">{ctm.colPerHab.fr}</th>
              <th className="py-1 text-right font-medium">{ctm.colShare.fr}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 font-semibold">
              <td className="py-1.5 pr-2">{total.label}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{meur(total.amount)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">{perHab(total.perHab)}</td>
              <td className="py-1.5 text-right" />
            </tr>
            {parts.map((p) => (
              <tr key={p.key} className="border-b border-slate-100">
                <td className="py-1.5 pr-2">
                  {p.label}
                  <div className="mt-0.5 h-1.5 rounded bg-slate-100">
                    <div className="h-1.5 rounded bg-slate-600" style={{ width: `${Math.max(0.5, (p.share ?? 0) * 100)}%` }} />
                  </div>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{meur(p.amount)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">{perHab(p.perHab)}</td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{pct(p.share)}</td>
              </tr>
            ))}
            {extra?.map((p) => (
              <tr key={p.key} className="border-b border-slate-100 text-slate-700">
                <td className="py-1.5 pr-2 italic">{p.label}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{meur(p.amount)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">{perHab(p.perHab)}</td>
                <td className="py-1.5 text-right" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FactBlock>
  );
}

/** Savings, debt and repayment capacity per year since 2016, with the CRC caveat on the debt figures. */
export function SavingsDebt({ savings, debt, capacity, range, provisionalYear, crcUrl, sources }: {
  savings: Point[]; debt: Point[]; capacity: Point[]; range: string; provisionalYear: number | null; crcUrl: string | null;
  sources: Source[];
}) {
  return (
    <FactBlock title={<>{ctm.savingsTitle.fr} {range}</>} sources={sources} year={range}>
      <p className="mt-1 text-sm text-slate-600">{ctm.savingsIntro.fr}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <TrendChart title={ctm.chartSavings.fr} points={savings} />
        <TrendChart title={ctm.chartDebt.fr} points={debt} />
        <TrendChart title={ctm.chartCapacity.fr} points={capacity} unit="years" />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        {[{ label: ctm.chartSavings.fr, p: savings, f: meur }, { label: ctm.chartDebt.fr, p: debt, f: meur },
          { label: ctm.chartCapacity.fr, p: capacity, f: years }].map(({ label, p, f }) => {
          const ref = [...p].reverse().find((x) => !x.provisional);
          return (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label} {ref?.year}</dt>
              <dd className="font-semibold tabular-nums">{f(ref?.value)}</dd>
            </div>
          );
        })}
      </dl>
      {provisionalYear && <p className="mt-2 text-xs text-slate-500">{ctm.provisionalNote.fr.replace("{year}", String(provisionalYear))}</p>}
      <div className="mt-3">
        <Caveat>
          {ctm.debtCaveat.fr}
          {crcUrl && <> <a href={crcUrl} className="underline" target="_blank" rel="noopener noreferrer">{ctm.debtCaveatLink.fr}</a>.</>}
        </Caveat>
      </div>
    </FactBlock>
  );
}

/** Account 734 per year: total and split; "octroi de mer" means 73432 only. */
export function FiscaliteUltramarine({ rows, labels, range, sources }: {
  rows: { year: number; provisional: boolean; values: Record<string, number | null> }[]; labels: { key: string; label: string }[];
  range: string; sources: Source[];
}) {
  return (
    <FactBlock title={<>{ctm.fumTitle.fr} {range}</>} sources={sources} year={range}>
      <p className="mt-1 text-sm text-slate-600">{ctm.fumIntro.fr}</p>
      <p className="mt-1 text-xs text-slate-500">{ctm.fumOldAccounts.fr}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium">{ctm.colYear.fr}</th>
              {labels.map((l, i) => <th key={l.key} className={`py-1 pr-2 text-right font-medium ${i === 0 ? "text-slate-700" : ""}`}>{l.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-medium">{r.year}{r.provisional && <span className="font-normal text-slate-500"> (provisoire)</span>}</td>
                {labels.map((l, i) => (
                  <td key={l.key} className={`py-1.5 pr-2 text-right tabular-nums ${i === 0 ? "font-semibold" : ""}`}>{meur(r.values[l.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FactBlock>
  );
}

/** Région and Département side by side, one table per indicator, never summed. */
export function BeforeCtm({ tables, sources }: {
  tables: { label: string; rows: BeforeRow[] }[]; sources: Source[];
}) {
  return (
    <FactBlock title={<>{ctm.beforeTitle.fr}{ctm.beforeShort.kr && <span className="font-normal text-slate-500"> · {ctm.beforeShort.kr}</span>}</>}
               sources={sources} year="2008-2015">
      <p className="mt-1 text-sm text-slate-600">{ctm.beforeIntro.fr}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {tables.map((t) => (
          <div key={t.label} className="overflow-x-auto">
            <h3 className="text-sm font-semibold">{t.label}</h3>
            <table className="mt-1 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1 pr-2 font-medium">{ctm.colYear.fr}</th>
                  <th className="py-1 pr-2 text-right font-medium">{ctm.beforeRegion.fr}</th>
                  <th className="py-1 text-right font-medium">{ctm.beforeDepartement.fr}</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.year} className="border-b border-slate-100">
                    <td className="py-1 pr-2">{r.year}{r.scope === "budget_principal" && <sup className="text-slate-500"> bp</sup>}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{meur(r.region)}</td>
                    <td className="py-1 text-right tabular-nums">{meur(r.departement)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500"><sup>bp</sup> {ctm.beforeScopeNote.fr}</p>
    </FactBlock>
  );
}
