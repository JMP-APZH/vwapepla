import { Caveat, FactBlock, MissingInfo } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { meur } from "@/lib/core/format";
import type { Act } from "@/lib/ctm/acts";
import type { ForecastRow, PlannedRow } from "@/lib/ctm/forecast";
import { ctm } from "@/i18n";

type Doc = { deliberation: string; pdfUrl: string | null };

/** The « Prévisionnel » label: shown on every forecast figure (block title and column header). */
function Badge() {
  return <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-xs font-semibold uppercase tracking-wide text-amber-800">{ctm.forecastBadge.fr}</span>;
}

function PageLink({ url, page }: { url: string | null; page: number | null }) {
  if (page == null) return null;
  return url ? <a href={`${url}#page=${page}`} className="underline" target="_blank" rel="noopener noreferrer">p. {page}</a> : <>p. {page}</>;
}

function Amendments({ acts }: { acts: Act[] }) {
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5">
      {acts.map((a) => (
        <li key={a.id}><a href={a.page_url} className="underline" target="_blank" rel="noopener noreferrer">{a.number}</a> — {a.title}</li>
      ))}
    </ul>
  );
}

/** The latest budget primitif as voted, each line linked to its page; the amending acts and the orientation report linked. */
export function ForecastBudget({ year, rows, bp, rob, amendments, sources }: {
  year: number; rows: ForecastRow[]; bp: Doc; rob: Doc | null; amendments: Act[]; sources: Source[];
}) {
  return (
    <FactBlock title={<>{ctm.forecastTitle.fr.replace("{year}", String(year))}<Badge /></>} sources={sources} year={year}>
      <p className="mt-1 text-sm text-slate-600">{ctm.forecastIntro.fr}</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3">
        <p className="text-sm font-semibold">{ctm.caDeliberation.fr.replace("{n}", bp.deliberation)}</p>
        <table className="mt-2 w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium" />
              <th className="py-1 pr-2 text-right font-medium">{ctm.forecastColAmount.fr} ({ctm.forecastBadge.fr.toLowerCase()})</th>
              <th className="py-1 text-right font-medium">{ctm.caColPage.fr}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-slate-100">
                <td className="py-1.5 pr-2">{r.label}</td>
                <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums font-medium">{meur(r.amount)}</td>
                <td className="py-1.5 text-right"><PageLink url={bp.pdfUrl} page={r.page} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-sm text-slate-600">
        <p>{ctm.forecastAmended.fr}</p>
        <Amendments acts={amendments} />
      </div>
      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        {rob && <li>{rob.pdfUrl
          ? <a href={rob.pdfUrl} className="underline" target="_blank" rel="noopener noreferrer">{ctm.forecastOrientation.fr.replace("{year}", String(year)).replace("{n}", rob.deliberation)}</a>
          : ctm.forecastOrientation.fr.replace("{year}", String(year)).replace("{n}", rob.deliberation)}</li>}
        <li>{ctm.forecastNoteLink.fr}</li>
      </ul>
    </FactBlock>
  );
}

/** BP (prévu) beside CA (réalisé), separate columns, one table per year; never charted as one series. */
export function PlannedVsActual({ years, missing, sources }: {
  years: { year: number; rows: PlannedRow[]; bp: Doc; ca: Doc; rob: Doc | null; amendments: Act[] }[];
  missing: string[]; sources: Source[];
}) {
  const range = years.length ? `${years.at(-1)!.year}-${years[0].year}` : "";
  return (
    <FactBlock title={<>{ctm.plannedTitle.fr} {range}</>} sources={sources} year={range}>
      <p className="mt-1 text-sm text-slate-600">{ctm.plannedIntro.fr}</p>
      <div className="mt-3"><Caveat>{ctm.plannedCaveat.fr}</Caveat></div>
      {years.map((y, i) => (
        <details key={y.year} open={i === 0} className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold">{y.year}</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1 pr-2 font-medium" />
                  <th className="py-1 pr-2 text-right font-medium">
                    {ctm.plannedColPlanned.fr}<span className="block font-semibold uppercase text-amber-800">{ctm.forecastBadge.fr}</span>
                    <span className="block whitespace-nowrap">{ctm.caDeliberation.fr.replace("{n}", y.bp.deliberation)}</span>
                  </th>
                  <th className="py-1 pr-2 text-right font-medium">
                    {ctm.plannedColActual.fr}<span className="block whitespace-nowrap">{ctm.caDeliberation.fr.replace("{n}", y.ca.deliberation)}</span>
                  </th>
                  <th className="py-1 text-right font-medium">{ctm.plannedColDiff.fr}</th>
                </tr>
              </thead>
              <tbody>
                {y.rows.map((r) => (
                  <tr key={r.key} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">{r.label}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums">
                      {meur(r.planned)}<span className="block text-xs"><PageLink url={y.bp.pdfUrl} page={r.plannedPage} /></span>
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums font-medium">
                      {meur(r.actual)}<span className="block text-xs font-normal"><PageLink url={y.ca.pdfUrl} page={r.actualPage} /></span>
                    </td>
                    <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-slate-600">
                      {r.diff == null ? "—" : `${r.diff >= 0 ? "+" : ""}${meur(r.diff)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <p>{ctm.plannedAmendments.fr.replace("{year}", String(y.year))}</p>
            <Amendments acts={y.amendments} />
            {y.rob && y.rob.pdfUrl && (
              <p className="mt-1"><a href={y.rob.pdfUrl} className="underline" target="_blank" rel="noopener noreferrer">
                {ctm.forecastOrientation.fr.replace("{year}", String(y.year)).replace("{n}", y.rob.deliberation)}</a></p>
            )}
          </div>
        </details>
      ))}
      {missing.length > 0 && <div className="mt-3"><MissingInfo items={missing} /></div>}
    </FactBlock>
  );
}
