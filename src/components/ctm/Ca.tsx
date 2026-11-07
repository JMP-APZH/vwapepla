import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { meur } from "@/lib/core/format";
import type { CaRow } from "@/lib/ctm/ca";
import { ctm } from "@/i18n";

const pct1 = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });

/** CA as voted beside OFGL's main-budget figures, one table per year (latest open), each CA figure linked to its page. */
export function CompteAdministratif({ years, sources }: {
  years: { year: number; rows: CaRow[]; deliberation: string; pdfUrl: string | null; provisional: boolean }[];
  sources: Source[];
}) {
  const range = years.length ? `${years.at(-1)!.year}-${years[0].year}` : "";
  const notes = new Set(years.flatMap((y) => y.rows.map((r) => r.note).filter((n) => n != null)));
  return (
    <FactBlock title={<>{ctm.caTitle.fr} {range}</>} sources={sources} year={range}>
      <p className="mt-1 text-sm text-slate-600">{ctm.caIntro.fr}</p>
      {years.map((y, i) => (
        <details key={y.year} open={i === 0} className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            {y.year} · {ctm.caDeliberation.fr.replace("{n}", y.deliberation)}
            {y.provisional && <span className="font-normal text-slate-500"> (OFGL provisoire)</span>}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1 pr-2 font-medium" />
                  <th className="py-1 pr-2 text-right font-medium">{ctm.caColCa.fr}</th>
                  <th className="py-1 pr-2 text-right font-medium">{ctm.caColOfgl.fr}</th>
                  <th className="py-1 pr-2 text-right font-medium">{ctm.caColDiff.fr}</th>
                  <th className="py-1 text-right font-medium">{ctm.caColPage.fr}</th>
                </tr>
              </thead>
              <tbody>
                {y.rows.map((r) => (
                  <tr key={r.key} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">{r.label}{r.note && <sup className="text-slate-500"> {r.note === "brut" ? "1" : "2"}</sup>}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums font-medium">{meur(r.ca)}</td>
                    <td className={`whitespace-nowrap py-1.5 pr-2 text-right tabular-nums ${y.provisional ? "italic text-slate-500" : ""}`}>{meur(r.ofgl)}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums text-slate-600">
                      {r.diff == null ? "—" : `${r.diff >= 0 ? "+" : ""}${meur(r.diff)}`}
                      {r.pct != null && <span className="block text-xs">{pct1.format(r.pct)}</span>}
                    </td>
                    <td className="py-1.5 text-right">
                      {r.page != null && (y.pdfUrl
                        ? <a href={`${y.pdfUrl}#page=${r.page}`} className="underline" target="_blank" rel="noopener noreferrer">p. {r.page}</a>
                        : `p. ${r.page}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {y.provisional && <p className="mt-2 text-xs text-slate-500">{ctm.caNoteProvisional.fr.replace("{year}", String(y.year))}</p>}
        </details>
      ))}
      <ul className="mt-3 space-y-1 text-xs text-slate-500">
        {notes.has("brut") && <li><sup>1</sup> {ctm.caNoteGross.fr}</li>}
        {notes.has("1068") && <li><sup>2</sup> {ctm.caNote1068.fr}</li>}
        <li>{ctm.caNoteLink.fr}</li>
      </ul>
    </FactBlock>
  );
}
