import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardHeader, CardShell, Caveat, MissingInfo, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { AmendmentsBlock, QuestionsBlock, VotesBlock } from "@/components/parlement/ActivityBlocks";
import { DataGapsBlock } from "@/components/parlement/DataGaps";
import { InterestsBlock } from "@/components/parlement/InterestsBlock";
import { MandateBlock } from "@/components/parlement/MandateBlock";
import { PastTermsBlock } from "@/components/parlement/PastTerms";
import { getMedia, getSources } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { amendmentsNotLoaded, gapsFor, voteLines } from "@/lib/parlement/activity";
import { getAmendments, getDataGaps, getDeclarations, getInterestItems, getMemberships, getPeople, getPerson, getQuestions, getSelectedScrutins, getToday, getVotes } from "@/lib/parlement/data";
import { currentCommittee, currentGroup, seatLabel, termPeriod } from "@/lib/parlement/members";
import { currentRows, currentTerm, formerLabel, membershipsIn, pastTerms, termSummary } from "@/lib/parlement/terms";
import { fill, upperFirst } from "@/lib/parlement/text";
import { parlement } from "@/i18n";

export async function generateStaticParams() {
  return (await getPeople()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/parlementaires/[slug]">): Promise<Metadata> {
  const p = await getPerson((await params).slug);
  if (!p) return { title: parlement.sectionTitle.fr };
  const label = p.current ? seatLabel(p.current) : formerLabel(p.terms[0], p.sex);
  return { title: `${p.firstName} ${p.lastName}, ${label.charAt(0).toLowerCase()}${label.slice(1)}` };
}

// One member's card: official facts of the current term, then one summary per earlier term (AN since 2012, Sénat since
// 2011). Former members get the same card without the current-term blocks. No score, no ranking, no comparison between
// members or terms (neutrality charter §3).
export default async function MemberPage({ params }: PageProps<"/parlementaires/[slug]">) {
  const p = await getPerson((await params).slug);
  if (!p) notFound();
  const m = p.current;
  const cur = currentTerm(p);
  const past = pastTerms(p);
  const latest = p.terms[0];
  const chamber = latest.chamber;
  const an = chamber === "AN";
  const [sources, media, memberships, own, questions, declarations, items, today, votes, allGaps, ...selected] = await Promise.all([
    getSources(), getMedia(an ? "assemblee-nationale" : "senat"), getMemberships(p.personId),
    getAmendments(p.personId, "premier_signataire"), getQuestions(p.personId), getDeclarations(p.personId),
    getInterestItems(p.personId), getToday(), getVotes(p.personId), getDataGaps(),
    ...p.terms.map((t) => getSelectedScrutins(t)),
  ]);
  const src = (ids: (string | null | undefined)[]) =>
    [...new Set(ids.filter((x): x is string => !!x))].map((id) => sources.get(id)).filter((s) => s != null);
  const photo = media.find((x) => x.person_id === p.personId);
  const name = `${p.firstName} ${p.lastName}`;
  const label = m ? seatLabel(m) : formerLabel(latest, p.sex);
  const f = p.sex === "F";
  const curIndex = cur ? p.terms.indexOf(cur) : -1;
  const curScrutins = curIndex >= 0 ? selected[curIndex] : [];
  const lines = voteLines(curScrutins, votes);
  const curOwn = currentRows(own, (a) => a.filed, cur);
  const curQuestions = currentRows(questions, (q) => q.asked, cur);
  const curMemberships = cur ? membershipsIn(memberships, cur) : [];
  const group = currentGroup(curMemberships, today);
  const committee = currentCommittee(curMemberships, today);
  const summaries = past.map((t) => termSummary(t, selected[p.terms.indexOf(t)], votes, own, questions, memberships));
  const dataDate = sources.get(an ? "an-deputes" : "senat-senateurs")?.retrieved;
  const gaps = gapsFor(allGaps, { chamber, personId: p.personId, current: !!m,
    legislatures: p.terms.flatMap((t) => (t.legislature ? [t.legislature] : [])) });
  const activitySources = an
    ? [...new Set(p.terms.map((t) => t.legislature))].flatMap((l) => [`an-scrutins-${l}`, `an-scrutins-${l}-liste`, `an-amendements-${l}`,
        `an-questions-ecrites-${l}`, `an-questions-orales-${l}`, `an-questions-gouvernement-${l}`])
    : ["senat-votes-972", "senat-scrutins", "senat-amendements-972", "senat-questions-972"];
  const missing = [
    ...(photo ? [] : [parlement.missingPhoto.fr]),
    ...(m && !an ? [parlement.missingSuppleant.fr] : []),
    ...(an && curOwn.length > 0 ? [parlement.missingAmendmentTitle.fr] : []),
  ];

  return (
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name={name} photo={photo} removalSubject={`${name} (${label})`} />}
          title={<>{name}<span className="block text-base font-normal text-slate-400">{label}</span></>}
          facts={m ? [
            { label: parlement.mandateSince.fr, value: <a href={m.officialUrl} className="underline" target="_blank" rel="noopener noreferrer">{date(m.start)}</a> },
            { label: an ? parlement.chamberAN.fr : parlement.chamberSEN.fr,
              value: (an ? (f ? parlement.electedDirectF : parlement.electedDirect) : (f ? parlement.electedIndirectF : parlement.electedIndirect)).fr },
            ...(group ? [{ label: parlement.group.fr, value: <>{upperFirst(group.parl_organes.label_fr)}{group.function && <span className="block text-xs font-normal text-slate-400">{group.function}</span>}</> }] : []),
            ...(committee ? [{ label: parlement.committee.fr, value: upperFirst(committee.parl_organes.label_fr) }] : []),
            ...(m.suppleant ? [{ label: (m.suppleant.sex === "F" ? parlement.suppleantF : parlement.suppleant).fr, value: `${m.suppleant.firstName} ${m.suppleant.lastName}` }] : []),
            ...(past.length ? [{ label: parlement.pastTermsTitle.fr, value: past.map(termPeriod).join(" ; ") }] : []),
          ] : [
            { label: parlement.lastMandate.fr, value: <a href={latest.officialUrl} className="underline" target="_blank" rel="noopener noreferrer">{termPeriod(latest)}</a> },
            { label: an ? parlement.chamberAN.fr : parlement.chamberSEN.fr,
              value: (an ? (f ? parlement.electedDirectF : parlement.electedDirect) : (f ? parlement.electedIndirectF : parlement.electedIndirect)).fr },
            ...(latest.endCause ? [{ label: parlement.termEnd.fr, value: `${date(latest.end)} (${latest.endCause})` }] : []),
          ]}
          note={<>{fill((m ? parlement.headerNote : parlement.formerNote).fr, { date: date(dataDate) })} · <a href={(m?.officialUrl ?? latest.officialUrl)} className="underline" target="_blank" rel="noopener noreferrer">{parlement.officialPage.fr}</a> · <Link href="/parlementaires" className="underline">{parlement.backToList.fr}</Link></>}
        />
      }
      caveats={<Caveat>{m ? fill(parlement.activityCaveat.fr, { date: date(m.start) }) : parlement.pastTermsIntro.fr} {parlement.chambersCaveat.fr}</Caveat>}
      rightOfReply={<RightOfReply text={fill(parlement.rightOfReply.fr, { name })} subject={`Droit de réponse — ${name} (${label})`} />}
    >
      <DataGapsBlock gaps={gaps} sources={sources} />
      <MissingInfo items={missing} />
      {m && cur && <>
        <MandateBlock member={m} memberships={curMemberships} today={today}
                      sources={src([m.sourceId, ...curMemberships.map((x) => x.source_id), m.suppleant?.sourceId, an ? "an-organes" : null])} />
        <VotesBlock member={m} lines={lines} period={an ? "XVIIe législature" : `depuis le ${date(m.start)}`}
                    sources={src(an ? ["an-scrutins-17", "an-scrutins-17-liste", "an-dossiers-17"] : ["senat-votes-972", "senat-scrutins"])} />
        <AmendmentsBlock member={m} own={curOwn} sources={src([an ? "an-amendements-17" : "senat-amendements-972"])} />
        <QuestionsBlock questions={curQuestions} sources={src(curQuestions.length ? curQuestions.map((q) => q.source_id) : [an ? "an-questions-ecrites-17" : "senat-questions-972"])} />
      </>}
      <PastTermsBlock summaries={summaries} sex={p.sex} slug={p.slug} amendmentsMissing={amendmentsNotLoaded(allGaps)} title={(m ? parlement.pastTermsTitle : parlement.termsTitle).fr}
                      sources={src([an ? "an-deputes" : "senat-mandats-senat", ...activitySources.filter((id) => !id.includes("-17"))])} />
      <InterestsBlock declarations={declarations} items={m ? items : []} former={!m}
                      sources={src(["hatvp-liste", ...(m && items.length ? ["hatvp-declarations-972"] : [])])} />
    </CardShell>
  );
}
