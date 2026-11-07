import Link from "next/link";
import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { eur, int, meur } from "@/lib/core/format";
import type { Beneficiary, YearTotal } from "@/lib/prefet/grants";
import { prefet } from "@/i18n";

/** DETR / DSIL / DSID / DPV granted in Martinique: totals per year, then each beneficiary with its projects. */
export function StateGrants({ years, beneficiaries, sources }: {
  years: YearTotal[]; beneficiaries: Beneficiary[]; sources: Source[];
}) {
  const max = Math.max(...years.map((y) => y.total), 1);
  const range = years.length ? `${years[0].year}–${years.at(-1)!.year}` : "";
  return (
    <FactBlock title={prefet.grantsTitle.fr} sources={sources} year={range}>
      <p className="mt-1 text-sm text-slate-600">{prefet.grantsIntro.fr}</p>

      <h3 className="mt-4 text-sm font-semibold">{prefet.grantsByYear.fr}</h3>
      <ul className="mt-2 space-y-1.5">
        {years.map((y) => (
          <li key={y.year} className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 text-sm">
            <span className="font-medium">{y.year}</span>
            <div className="h-3 rounded bg-slate-100">
              <div className="h-3 rounded bg-emerald-700" style={{ width: `${(y.total / max) * 100}%` }} />
            </div>
            <span className="tabular-nums text-slate-600">{meur(y.total)} · {int(y.count)} {prefet.grantsProjects.fr}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-sm font-semibold">{prefet.grantsByBeneficiary.fr}</h3>
      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {beneficiaries.map((b) => (
          <details key={b.key} className="group px-3 py-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm">
              <span className="font-medium">{b.label}</span>
              <span className="shrink-0 tabular-nums text-slate-600">{meur(b.total)} · {int(b.count)}</span>
            </summary>
            {b.slug && (
              <p className="mb-2 text-xs"><Link href={`/communes/${b.slug}`} className="underline">{prefet.grantsCommuneCard.fr}</Link></p>
            )}
            <ul className="space-y-2 pb-2 text-sm">
              {b.grants.map((g) => (
                <li key={g.id} className="rounded-lg bg-slate-50 p-2">
                  <p>{/^\d*$/.test(g.project.trim())
                    ? <span className="italic text-slate-600">Intitulé non renseigné dans la source (publié : « {g.project} »)</span>
                    : g.project}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {g.year} · {g.scheme} · {eur(g.grant_amount)}
                    {g.cost_ht != null && <> sur {eur(g.cost_ht)} HT</>}
                    {g.beneficiary_name && <> · publié : « {g.beneficiary_name} »</>}
                  </p>
                  {g.mapping_note && <p className="mt-0.5 text-xs text-amber-800">{g.mapping_note}</p>}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <div className="mt-4"><Caveat>{prefet.grantsCaveat.fr}</Caveat></div>
    </FactBlock>
  );
}
