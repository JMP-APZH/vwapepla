import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { bySection, DOC_TYPE_FR, isAssetDeclaration, itemView, sortDeclarations, type Declaration, type InterestItem } from "@/lib/parlement/interests";
import { fill } from "@/lib/parlement/text";
import { parlement } from "@/i18n";

/** HATVP: every declaration (type, dates, link); outside activities from the latest declaration of interests, copied
 *  as declared, member's own sections only. Asset declarations: link and dates only (charter §3.6). */
export function InterestsBlock({ declarations, items, sources, former = false }: {
  declarations: Declaration[]; items: InterestItem[]; sources: Source[]; former?: boolean;
}) {
  const groups = bySection(items);
  const first = items[0];
  return (
    <FactBlock title={parlement.interestsTitle.fr} sources={sources} year={former ? "mandats terminés" : "mandat en cours"}>
      <p className="mt-1 text-sm text-slate-600">{parlement.interestsIntro.fr}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {sortDeclarations(declarations).map((d) => (
          <li key={d.id}>
            <span className="font-medium">{DOC_TYPE_FR[d.doc_type] ?? d.doc_type}</span>
            {d.deposited && <> · {parlement.interestsDeposited.fr} {date(d.deposited)}</>}
            {d.published ? <> · {parlement.interestsPublished.fr} {date(d.published)}</> : d.status && <> · {d.status}</>}
            {d.url && <> · <a href={d.url} className="underline" target="_blank" rel="noopener noreferrer">{parlement.interestsRead.fr}</a></>}
          </li>
        ))}
      </ul>
      {declarations.some(isAssetDeclaration) && <p className="mt-1 text-xs text-slate-500">{parlement.interestsAssets.fr}</p>}
      {!former && <>
      <h3 className="mt-4 text-sm font-semibold">{parlement.interestsActivities.fr}</h3>
      {first ? (
        <>
          <p className="mt-1 text-xs text-slate-600">
            {fill(parlement.interestsActivitiesIntro.fr, { label: first.declaration_label ?? "", date: date(first.deposited) })}
          </p>
          <div className="mt-2 space-y-3 text-sm">
            {groups.map((g) => (
              <div key={g.section}>
                <p className="font-medium">{g.label}</p>
                <ul className="mt-1 space-y-2">
                  {g.items.map((it) => {
                    const v = itemView(it);
                    return (
                      <li key={it.id} className="rounded-lg bg-slate-50 p-2">
                        <p className="whitespace-pre-line">{v.title}</p>
                        {v.details.map((d) => <p key={d.label} className="text-xs text-slate-600">{d.label} : {d.value}</p>)}
                        {v.amounts.length > 0 && <p className="text-xs text-slate-600">{v.amounts.join(" · ")}</p>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      ) : <p className="mt-1 text-sm text-slate-600">{parlement.interestsNone.fr}</p>}
      </>}
    </FactBlock>
  );
}
