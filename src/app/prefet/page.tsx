import type { Metadata } from "next";
import Link from "next/link";
import { CardHeader, CardShell, Caveat, MissingInfo, OpinionBlock, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { CompetencePanel } from "@/components/prefet/CompetencePanel";
import { PostingsOverview } from "@/components/prefet/PostingsOverview";
import { StateCredits } from "@/components/prefet/StateCredits";
import { StateGrants } from "@/components/prefet/StateGrants";
import { StateVotes } from "@/components/prefet/StateVotes";
import { CrimeBlock, SocialContext, StateSplit } from "@/components/prefet/SecurityContext";
import { getSources } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { lastExecutedYear, topMissions, totalsByYear as creditsByYear } from "@/lib/prefet/credits";
import { getCommuneNames, getContextFigures, getCrimeStats, getDptCredits, getGrants, getMandates, getStateVoteSummary, getToday, getVoteCriteria } from "@/lib/prefet/data";
import { byBeneficiary, totalsByYear as grantsByYear } from "@/lib/prefet/grants";
import { crimeLines, stateSplit, unemploymentRows } from "@/lib/prefet/context";
import { currentHolder, gaps, postLabel, SEAT_ORDER, toPostings } from "@/lib/prefet/postings";
import { prefet } from "@/i18n";

export const metadata: Metadata = { title: prefet.cardTitle.fr };

// The State in Martinique: facts about State action and funding, not a judgement of any person (B4 neutrality charter,
// docs/branches/B4-DISCOVERY.md §3). Postings come from the appointment decrees of the Journal officiel.
/** Opinion layer, streamed apart from the facts (its cache is refreshed when a vote is recorded). */
async function Votes() {
  const criteria = await getVoteCriteria();
  const summary = await getStateVoteSummary(criteria.map((c) => c.key));
  return <StateVotes criteria={criteria} summary={summary} />;
}

export default async function PrefetPage() {
  const [credits, grants, communes, sources, mandates, today] = await Promise.all([
    getDptCredits(), getGrants(), getCommuneNames(), getSources(), getMandates(), getToday()]);
  const [crimeStats, contextFigures] = await Promise.all([getCrimeStats(), getContextFigures()]);
  const crime = crimeLines(crimeStats);
  const unemployment = unemploymentRows(contextFigures);
  const poverty = contextFigures.filter((f) => f.indicator === "pauvrete_menages");
  const postings = toPostings(mandates);
  const prefetNow = currentHolder(postings, "prefet");
  const years = creditsByYear(credits);
  const topYear = lastExecutedYear(credits);
  const split = topYear ? stateSplit(credits, topYear) : null;
  const firstExecuted = years.find((y) => y.execution)?.year;
  const src = (ids: string[]) => [...new Set(ids)].map((id) => sources.get(id)).filter((s) => s != null);
  const deduced = grants.filter((g) => g.mapping_note).length;

  const seatGaps = SEAT_ORDER.flatMap((seat) => gaps(postings, seat).map((g) =>
    prefet.missingPostingGap.fr.replace("{post}", postLabel([seat], null)).replace("{from}", date(g.from)).replace("{to}", date(g.to))));
  const missing = [
    ...seatGaps,
    prefet.missingChargeMission.fr,
    ...(firstExecuted ? [prefet.missingDptYears.fr.replace("{year}", String(firstExecuted))] : []),
    ...(deduced ? [prefet.missingGrantNotes.fr.replace("{n}", String(deduced))] : []),
  ];

  return (
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name="État" removalSubject="Préfecture de la Martinique" />}
          title={<>{prefet.cardTitle.fr}{prefet.cardTitle.kr && <span className="block text-base font-normal text-slate-400">{prefet.cardTitle.kr}</span>}</>}
          facts={[
            { label: prefet.representative.fr, value: prefetNow
              ? <Link href={`/prefet/${prefetNow.slug}`} className="underline">{prefetNow.firstName} {prefetNow.lastName}</Link>
              : prefet.representativeValue.fr },
            { label: prefet.appointedBy.fr, value: <>{prefet.appointedByValue.fr} · {prefet.appointedNotElected.fr}{prefet.appointedNotElected.kr && <> ({prefet.appointedNotElected.kr})</>}</> },
          ]}
        />
      }
      caveats={<Caveat>{prefet.headerNote.fr}</Caveat>}
      rightOfReply={<RightOfReply text={prefet.rightOfReplyText.fr} subject="Droit de réponse — Préfecture de la Martinique" />}
    >
      <MissingInfo items={missing} />
      <PostingsOverview postings={postings} today={today}
                        sources={src(["jorf-nominations-972", ...mandates.map((m) => m.source_id)])} />
      <CompetencePanel />
      <StateCredits years={years} top={topYear ? topMissions(credits, topYear) : []} topYear={topYear}
                    sources={src(credits.filter((c) => c.level === "total").map((c) => c.source_id))} />
      <StateGrants years={grantsByYear(grants)} beneficiaries={byBeneficiary(grants, communes)}
                   sources={src(grants.map((g) => g.source_id))} />
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{prefet.contextTitle.fr}</h2>
          <p className="mt-1 text-sm text-slate-600">{prefet.contextIntro.fr}</p>
        </div>
        {topYear && split && (
          <StateSplit year={topYear} total={split.total} lines={split.lines}
                      sources={src(credits.filter((c) => c.level === "mission" && c.year === topYear).map((c) => c.source_id))} />
        )}
        {crime.years && <CrimeBlock years={crime.years} groups={crime.groups} sources={src(crimeStats.map((c) => c.source_id))} />}
        {unemployment.length > 0 && <SocialContext rows={unemployment} poverty={poverty} sources={src(contextFigures.map((f) => f.source_id))} />}
      </section>
      <OpinionBlock><Votes /></OpinionBlock>
    </CardShell>
  );
}
