import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date, int } from "@/lib/core/format";
import type { ElectoralList, Member } from "@/lib/ctm/people";
import { ctm } from "@/i18n";

/** One person: name, function, dates, list of election, and any doubt about the sources (stated, never hidden). */
export function MemberItem({ m, showList = true }: { m: Member; showList?: boolean }) {
  return (
    <li className="py-1.5 text-sm">
      <span className="font-medium">{m.name}</span>
      {m.role !== "conseiller" && <span className="text-slate-600"> · {m.roleLabel}</span>}
      <span className="block text-xs text-slate-500">
        {m.functionStart && ctm.functionSince.fr.replace("{date}", date(m.functionStart))}
        {!m.functionStart && (m.verified || m.odd) && ctm.mandateSince.fr.replace("{date}", date(m.start))}
        {m.odd && <span className="text-amber-800"> ({ctm.oddDate.fr})</span>}
        {m.sourceId.endsWith("hatvp-liste-declarations") && (
          <span className="text-amber-800">
            {m.sourceUrl ? <a href={m.sourceUrl} className="underline" target="_blank" rel="noopener noreferrer">{ctm.sourceHatvp.fr}</a>
              : ctm.sourceHatvp.fr} · {ctm.notVerified.fr}
          </span>
        )}
        {showList && m.list && (
          <>
            {" · "}
            {ctm.listLabel.fr} « {m.list.label} » ({m.list.year})
            {m.list.match === "deduit" && <span> · {ctm.listDeduced.fr}</span>}
            {m.list.match === "a_verifier" && <span className="text-amber-800"> · {ctm.listToVerify.fr}</span>}
            {m.list.note && <span className="text-amber-800"> · {m.list.note}</span>}
          </>
        )}
      </span>
    </li>
  );
}

export function SectionLists({ title, groups, sources, year }: {
  title: string; groups: { section: string; members: Member[] }[]; sources: Source[]; year: string;
}) {
  return (
    <FactBlock title={title} sources={sources} year={year}>
      <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
        {groups.filter((g) => g.members.length).map((g) => (
          <div key={g.section}>
            <h3 className="mt-3 text-sm font-semibold">{g.section} <span className="font-normal text-slate-500">({g.members.length})</span></h3>
            <ul className="divide-y divide-slate-100">{g.members.map((m) => <MemberItem key={m.personId} m={m} />)}</ul>
          </div>
        ))}
      </div>
    </FactBlock>
  );
}

/** Round-2 results, in list-number order (an election result is not a ranking of the elected). */
export function Results({ title, lists, sources, year }: { title: string; lists: ElectoralList[]; sources: Source[]; year: number }) {
  return (
    <FactBlock title={title} sources={sources} year={year}>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 pr-2 font-medium">{ctm.colList.fr}</th>
              <th className="py-1 pr-2 font-medium">{ctm.colHead.fr}</th>
              <th className="py-1 pr-2 text-right font-medium">{ctm.colVotes.fr}</th>
              <th className="py-1 pr-2 text-right font-medium">{ctm.colPct.fr}</th>
              <th className="py-1 text-right font-medium">{ctm.colSeats.fr}</th>
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-2">{l.label}{l.nuance && <span className="text-xs text-slate-500"> ({l.nuance})</span>}</td>
                <td className="py-1.5 pr-2">{l.head}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{int(l.votes)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{l.pct_exprimes == null ? "—" : `${l.pct_exprimes.toLocaleString("fr-FR")} %`}</td>
                <td className="py-1.5 text-right tabular-nums">{l.seats ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">{ctm.resultsNote.fr}</p>
    </FactBlock>
  );
}
