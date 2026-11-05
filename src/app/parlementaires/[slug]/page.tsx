import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardHeader, CardShell, Caveat, MissingInfo, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { AmendmentsBlock, QuestionsBlock, VotesBlock } from "@/components/parlement/ActivityBlocks";
import { InterestsBlock } from "@/components/parlement/InterestsBlock";
import { MandateBlock } from "@/components/parlement/MandateBlock";
import { getMedia, getSources } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { voteLines } from "@/lib/parlement/activity";
import { getAmendments, getDeclarations, getInterestItems, getMember, getMembers, getMemberships, getQuestions, getSelectedScrutins, getToday, getVotes } from "@/lib/parlement/data";
import { currentCommittee, currentGroup, seatLabel } from "@/lib/parlement/members";
import { fill, upperFirst } from "@/lib/parlement/text";
import { parlement } from "@/i18n";

export async function generateStaticParams() {
  return (await getMembers()).map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/parlementaires/[slug]">): Promise<Metadata> {
  const m = await getMember((await params).slug);
  return { title: m ? `${m.firstName} ${m.lastName}, ${seatLabel(m).charAt(0).toLowerCase()}${seatLabel(m).slice(1)}` : parlement.sectionTitle.fr };
}

// One member's card: official facts of the current term only (cut-off, docs/branches/B2-DISCOVERY.md §1bis), no score,
// no ranking, no comparison between members (neutrality charter §3).
export default async function MemberPage({ params }: PageProps<"/parlementaires/[slug]">) {
  const m = await getMember((await params).slug);
  if (!m) notFound();
  const an = m.chamber === "AN";
  const [sources, media, memberships, own, questions, declarations, items, today, scrutins, votes] = await Promise.all([
    getSources(), getMedia(an ? "assemblee-nationale" : "senat"), getMemberships(m.personId),
    getAmendments(m.personId, "premier_signataire"), getQuestions(m.personId), getDeclarations(m.personId),
    getInterestItems(m.personId), getToday(), an ? getSelectedScrutins() : Promise.resolve([]),
    an ? getVotes(m.personId) : Promise.resolve([]),
  ]);
  const src = (ids: (string | null | undefined)[]) =>
    [...new Set(ids.filter((x): x is string => !!x))].map((id) => sources.get(id)).filter((s) => s != null);
  const photo = media.find((x) => x.person_id === m.personId);
  const name = `${m.firstName} ${m.lastName}`;
  const label = seatLabel(m);
  const f = m.sex === "F";
  const group = currentGroup(memberships, today);
  const committee = currentCommittee(memberships, today);
  const lines = voteLines(scrutins, votes);
  const dataDate = sources.get(an ? "an-deputes" : "senat-senateurs")?.retrieved;

  const missing = [
    ...(photo ? [] : [parlement.missingPhoto.fr]),
    ...(an ? [] : [parlement.missingSenateVotes.fr, parlement.missingSuppleant.fr]),
    parlement.missingCommitteePresence.fr,
    ...(an && own.length > 0 ? [parlement.missingAmendmentTitle.fr] : []),
    parlement.missingEarlier.fr,
  ];

  return (
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name={name} photo={photo} removalSubject={`${name} (${label})`} />}
          title={<>{name}<span className="block text-base font-normal text-slate-400">{label}</span></>}
          facts={[
            { label: parlement.mandateSince.fr, value: <a href={m.officialUrl} className="underline" target="_blank" rel="noopener noreferrer">{date(m.start)}</a> },
            { label: an ? parlement.chamberAN.fr : parlement.chamberSEN.fr,
              value: (an ? (f ? parlement.electedDirectF : parlement.electedDirect) : (f ? parlement.electedIndirectF : parlement.electedIndirect)).fr },
            ...(group ? [{ label: parlement.group.fr, value: <>{upperFirst(group.parl_organes.label_fr)}{group.function && <span className="block text-xs font-normal text-slate-400">{group.function}</span>}</> }] : []),
            ...(committee ? [{ label: parlement.committee.fr, value: upperFirst(committee.parl_organes.label_fr) }] : []),
            ...(m.suppleant ? [{ label: (m.suppleant.sex === "F" ? parlement.suppleantF : parlement.suppleant).fr, value: `${m.suppleant.firstName} ${m.suppleant.lastName}` }] : []),
          ]}
          note={<>{fill(parlement.headerNote.fr, { date: date(dataDate) })} · <a href={m.officialUrl} className="underline" target="_blank" rel="noopener noreferrer">{parlement.officialPage.fr}</a> · <Link href="/parlementaires" className="underline">{parlement.backToList.fr}</Link></>}
        />
      }
      caveats={<Caveat>{fill(parlement.activityCaveat.fr, { date: date(m.start) })} {parlement.chambersCaveat.fr}</Caveat>}
      rightOfReply={<RightOfReply text={fill(parlement.rightOfReply.fr, { name })} subject={`Droit de réponse — ${name} (${label})`} />}
    >
      <MissingInfo items={missing} />
      <MandateBlock member={m} memberships={memberships} today={today}
                    sources={src([m.sourceId, ...memberships.map((x) => x.source_id), m.suppleant?.sourceId, an ? "an-organes" : null])} />
      {an && <VotesBlock member={m} lines={lines} sources={src(["an-scrutins-17", "an-scrutins-17-liste", "an-dossiers-17"])} />}
      <AmendmentsBlock member={m} own={own} sources={src([an ? "an-amendements-17" : "senat-amendements-972"])} />
      <QuestionsBlock questions={questions} sources={src(questions.length ? questions.map((q) => q.source_id) : [an ? "an-questions-ecrites-17" : "senat-questions-972"])} />
      <InterestsBlock declarations={declarations} items={items} sources={src(["hatvp-liste", ...(items.length ? ["hatvp-declarations-972"] : [])])} />
    </CardShell>
  );
}
