import type { Metadata } from "next";
import Link from "next/link";
import { CardHeader, CardShell, FactBlock, MissingInfo, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { MemberItem } from "@/components/ctm/People";
import { getSources } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { getListMembers, getLists, getMandates, getSections } from "@/lib/ctm/data";
import { EXECUTIF, inBothBodies, members, oddDates, T2021 } from "@/lib/ctm/people";
import { ctm } from "@/i18n";

export const metadata: Metadata = { title: ctm.executifTitle.fr };

// Conseil exécutif: RNE lists only part of it; the other members come from the HATVP declarations and are marked
// "non vérifié" until the election délibération is archived (JM, 5 Nov 2026). Portfolios: not published yet.
export default async function ExecutifPage() {
  const [mandates, sections, listMembers, lists, sources] = await Promise.all([
    getMandates(), getSections(), getListMembers(), getLists(), getSources()]);
  const list = members(mandates, sections, listMembers, lists, T2021, EXECUTIF);
  const president = list.find((m) => m.role === "president");
  const fromRne = list.filter((m) => m.sourceId === "ctm:rne-membres-assemblees").length;
  const both = inBothBodies(mandates, T2021);
  const src = (ids: string[]) => [...new Set(ids)].map((id) => sources.get(id)).filter((s) => s != null);

  const missing = [
    ctm.missingExecutiveSource.fr.replace("{n}", String(fromRne)),
    ...(both.length ? [ctm.missingBoth.fr.replace("{names}", both.join(", "))] : []),
    ...oddDates(list).map((m) => `${m.name} : ${ctm.oddDate.fr} (${date(m.functionStart ?? m.start)}).`),
    ctm.missingPortfolios.fr,
  ];

  return (
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name="Conseil exécutif" removalSubject="Conseil exécutif de Martinique" />}
          title={ctm.executifTitle.fr}
          facts={[
            { label: ctm.executifPresident.fr, value: president
              ? <>{president.name}{president.functionStart && <span className="font-normal text-slate-400"> · {date(president.functionStart)}</span>}</> : "—" },
            { label: ctm.executifMembers.fr, value: String(list.length) },
          ]}
          note={<>{ctm.executifIntro.fr} <Link href="/ctm" className="underline">← {ctm.cardTitle.fr}</Link></>}
        />
      }
      rightOfReply={<RightOfReply text={ctm.rightOfReplyExecutif.fr} subject="Droit de réponse — Conseil exécutif de Martinique" />}
    >
      <MissingInfo items={missing} />
      <FactBlock title={ctm.executifCompositionTitle.fr} sources={src(list.map((m) => m.sourceId))} year="2021-2028">
        <ul className="mt-2 divide-y divide-slate-100">{list.map((m) => <MemberItem key={m.personId} m={m} />)}</ul>
      </FactBlock>
    </CardShell>
  );
}
