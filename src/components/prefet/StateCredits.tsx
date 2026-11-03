import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { meur, pct } from "@/lib/core/format";
import type { YearRow } from "@/lib/prefet/credits";
import { prefet } from "@/i18n";

/** DPT totals per year (executed / voted / proposed kept in separate columns) and the mission split of one executed year. */
export function StateCredits({ years, top, topYear, sources }: {
  years: YearRow[]; top: { label: string; cp: number; share: number }[]; topYear: number | null; sources: Source[];
}) {
  const range = years.length ? `${years[0].year}–${years.at(-1)!.year}` : "";
  const page = (v?: { edition: number; page: number }) => v && `PLF ${v.edition}, p. ${v.page}`; // cell tooltip
  return (
    <FactBlock
      title={<>{prefet.creditsTitle.fr} {prefet.creditsTitle.kr && <span className="font-normal text-slate-500">· {prefet.creditsTitle.kr}</span>}</>}
      sources={sources} year={range}
    >
      <p className="mt-1 text-sm text-slate-600">{prefet.creditsIntro.fr}</p>
      <p className="mt-3 text-xs font-medium text-slate-500">{prefet.creditsCp.fr}</p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium">Année</th>
              <th className="py-1 pr-2 text-right font-medium">{prefet.creditsExecuted.fr}</th>
              <th className="py-1 pr-2 text-right font-medium">{prefet.creditsVoted.fr}</th>
              <th className="py-1 text-right font-medium">{prefet.creditsProposed.fr}</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-medium">{y.year}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums" title={page(y.execution)}>{y.execution ? meur(y.execution.cp) : "—"}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums" title={page(y.lfi)}>{y.lfi ? meur(y.lfi.cp) : "—"}</td>
                <td className="py-1.5 text-right tabular-nums italic text-slate-600" title={page(y.plf)}>{y.plf ? meur(y.plf.cp) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        « — » : non publié dans les éditions disponibles. Proposé = prévisionnel. Pages :{" "}
        {[...new Map(years.flatMap((y) => [y.execution, y.lfi, y.plf]).filter((v) => v != null)
          .map((v) => [v!.edition, `PLF ${v!.edition} p. ${v!.page}`])).values()].join(" · ")}.
      </p>

      {topYear && top.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-semibold">{prefet.creditsTopMissions.fr} {topYear}</h3>
          <ul className="mt-2 space-y-1.5">
            {top.map((m) => (
              <li key={m.label} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span>{m.label}</span>
                  <span className="shrink-0 tabular-nums text-slate-600">{meur(m.cp)} · {pct(m.share)}</span>
                </div>
                <div className="mt-0.5 h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-slate-600" style={{ width: `${Math.max(1, m.share * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4"><Caveat>{prefet.creditsCaveat.fr}</Caveat></div>
    </FactBlock>
  );
}
