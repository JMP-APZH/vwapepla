import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date, int } from "@/lib/core/format";
import { actUrl, countTable, THEMES, type Act, type ActCount } from "@/lib/prefet/acts";
import { prefet } from "@/i18n";

/** Acts of the préfecture (RAA): counts per year and theme, then the latest acts of each theme, linked to the bulletin. */
export function ActsBlock({ counts, latest, sources }: { counts: ActCount[]; latest: Act[]; sources: Source[] }) {
  const t = countTable(counts);
  const shown = THEMES.filter((th) => th.key !== "autre");
  return (
    <FactBlock title={prefet.actsTitle.fr} sources={sources} year={t.years.length ? `${t.years[0]}–${t.years.at(-1)}` : ""}>
      <p className="mt-1 text-sm text-slate-600">{prefet.actsIntro.fr}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium">{prefet.actsYear.fr}</th>
              {shown.map((th) => <th key={th.key} className="py-1 pr-2 text-right font-medium">{th.label}</th>)}
              <th className="py-1 text-right font-medium">{prefet.actsTotal.fr}</th>
            </tr>
          </thead>
          <tbody>
            {[...t.years].reverse().map((y) => (
              <tr key={y} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-medium">{y}</td>
                {shown.map((th) => <td key={th.key} className="py-1.5 pr-2 text-right tabular-nums">{int(t.get(y, th.key))}</td>)}
                <td className="py-1.5 text-right tabular-nums text-slate-600">{int(t.total(y))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-5 text-sm font-semibold">{prefet.actsLatest.fr}</h3>
      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {shown.map((th) => {
          const mine = latest.filter((a) => a.theme === th.key);
          if (!mine.length) return null;
          return (
            <details key={th.key} className="px-3 py-2">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm">
                <span className="font-medium">{th.label}</span>
                <span className="shrink-0 text-xs text-slate-500">{date(mine[0].act_date)}</span>
              </summary>
              <ul className="space-y-2 pb-2 text-sm">
                {mine.map((a) => (
                  <li key={a.id} className="rounded-lg bg-slate-50 p-2">
                    <a href={actUrl(a)} className="underline" target="_blank" rel="noopener noreferrer">{a.title}</a>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {date(a.act_date)} · {a.act_id}{a.service && <> · {a.service}</>} · {prefet.actsBulletin.fr} {a.bulletin}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer">{prefet.actsRules.fr}</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {THEMES.map((th) => <li key={th.key}><span className="font-medium">{th.label}</span> : {th.rule}</li>)}
        </ul>
      </details>
      <div className="mt-3"><Caveat>{prefet.actsCaveat.fr}</Caveat></div>
    </FactBlock>
  );
}
