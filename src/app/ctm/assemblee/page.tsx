import type { Metadata } from "next";
import Link from "next/link";
import { CardHeader, CardShell, Caveat, MissingInfo, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { Results, SectionLists } from "@/components/ctm/People";
import { getSources } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { getActs, getListMembers, getLists, getMandates, getSections } from "@/lib/ctm/data";
import { ActsSummary } from "@/components/ctm/Acts";
import { ASSEMBLEE, bySection, inBothBodies, members, roundTwo, T2015, T2021 } from "@/lib/ctm/people";
import { ctm } from "@/i18n";

export const metadata: Metadata = { title: ctm.assembleeTitle.fr };

// Assemblée de Martinique: who sits where (RNE), the list each member was elected on (Ministry results), the 2021 and
// 2015 results in list-number order. Group membership is not shown: no official group declaration is published.
export default async function AssembleePage() {
  const [mandates, sections, listMembers, lists, sources, acts] = await Promise.all([
    getMandates(), getSections(), getListMembers(), getLists(), getSources(), getActs()]);
  const now = members(mandates, sections, listMembers, lists, T2021, ASSEMBLEE);
  const first = members(mandates, sections, listMembers, lists, T2015, ASSEMBLEE);
  const president = now.find((m) => m.role === "president");
  const vps = now.filter((m) => m.role === "vice-president");
  const both = inBothBodies(mandates, T2021);
  const src = (ids: string[]) => [...new Set(ids)].map((id) => sources.get(id)).filter((s) => s != null);
  const deduced = listMembers.some((l) => l.list_id.startsWith("ctm-2021"));

  const missing = [
    ...(now.length !== 51 ? [ctm.missingSeatsCount.fr.replace("{n}", String(now.length))] : []),
    ...(both.length ? [ctm.missingBoth.fr.replace("{names}", both.join(", "))] : []),
    ctm.missingGroups.fr,
    ...(deduced ? [ctm.missingListsDeduced.fr] : []),
    ctm.missingPresidents2015.fr,
  ];
  const r2021 = roundTwo(lists, 2021), r2015 = roundTwo(lists, 2015);

  return (
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name="Assemblée" removalSubject="Assemblée de Martinique" />}
          title={<>{ctm.assembleeTitle.fr}{ctm.assembleeTitle.kr && <span className="block text-base font-normal text-slate-400">{ctm.assembleeTitle.kr}</span>}</>}
          facts={[
            { label: ctm.assembleePresident.fr, value: president
              ? <>{president.name}{president.functionStart && <span className="font-normal text-slate-400"> · {date(president.functionStart)}</span>}</> : "—" },
            { label: ctm.assembleeVps.fr, value: vps.map((v) => v.name).join(", ") || "—" },
            { label: ctm.assembleeMembers.fr, value: `${now.length} (RNE)` },
            { label: ctm.headerTerm.fr, value: "2021-2028" },
          ]}
          note={<>{ctm.assembleeIntro.fr} <Link href="/ctm" className="underline">← {ctm.cardTitle.fr}</Link></>}
        />
      }
      caveats={<Caveat>{ctm.resultsNote.fr}</Caveat>}
      rightOfReply={<RightOfReply text={ctm.rightOfReplyAssemblee.fr} subject="Droit de réponse — Assemblée de Martinique" />}
    >
      <MissingInfo items={missing} />
      <SectionLists title={ctm.compositionTitle.fr} groups={bySection(now)} year="2021-2028"
                    sources={src([...now.map((m) => m.sourceId), ...listMembers.filter((l) => l.list_id.startsWith("ctm-2021")).map((l) => l.source_id)])} />
      {r2021.length > 0 && <Results title={ctm.resultsTitle.fr} lists={r2021} year={2021} sources={src(r2021.map((l) => l.source_id))} />}
      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-lg font-semibold tracking-tight">{ctm.firstAssemblyTitle.fr}</summary>
        <p className="mt-2 text-sm text-slate-600">{ctm.firstAssemblyIntro.fr}</p>
        <SectionLists title="" groups={bySection(first)} year="2015-2021" sources={src(first.map((m) => m.sourceId))} />
        {r2015.length > 0 && <Results title={ctm.results2015Title.fr} lists={r2015} year={2015} sources={src(r2015.map((l) => l.source_id))} />}
      </details>
      <ActsSummary title={ctm.actsAssembleeTitle.fr} body="assemblee" acts={acts}
                   sources={src(acts.filter((a) => a.body === "assemblee").map((a) => a.source_id))} />
    </CardShell>
  );
}
