import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CardHeader, CardShell, Caveat, MissingInfo, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { CareerPath, PostingDecrees } from "@/components/prefet/PostingBlocks";
import { StateCredits } from "@/components/prefet/StateCredits";
import { StateGrants } from "@/components/prefet/StateGrants";
import { getSources } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import { totalsByYear as creditsByYear } from "@/lib/prefet/credits";
import { getCareerSteps, getCommuneNames, getDptCredits, getGrants, getMandates, getPostingEvents, getToday } from "@/lib/prefet/data";
import { byBeneficiary, totalsByYear as grantsByYear } from "@/lib/prefet/grants";
import { FULL_FROM, PARTIAL_FROM, postingYears, postLabel, toPostings } from "@/lib/prefet/postings";
import { prefet } from "@/i18n";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

async function find(slug: string) {
  return toPostings(await getMandates()).find((p) => p.slug === slug);
}

export async function generateStaticParams() {
  return toPostings(await getMandates()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/prefet/[slug]">): Promise<Metadata> {
  const p = await find((await params).slug);
  return { title: p ? `${p.firstName} ${p.lastName}, ${lowerFirst(postLabel(p.seats, p.sex))}` : "Préfecture" };
}

// One posting: facts from the appointment decrees, never a judgement of the person (B4 neutrality charter, §3).
export default async function PostingPage({ params }: PageProps<"/prefet/[slug]">) {
  const p = await find((await params).slug);
  if (!p) notFound();
  const [allEvents, steps, sources, today] = await Promise.all([
    getPostingEvents(), getCareerSteps(p.personId), getSources(), getToday()]);
  const events = allEvents.filter((e) => p.seats.some((s) => e.id.startsWith(`${p.personId}:${s}:`)) && e.event_date >= p.start)
    .filter((e, i, a) => a.findIndex((x) => x.kind === e.kind && x.event_date === e.event_date) === i);
  const src = (ids: string[]) => [...new Set(ids)].map((id) => sources.get(id)).filter((s) => s != null);
  const name = `${p.firstName} ${p.lastName}`;
  const label = postLabel(p.seats, p.sex);
  const isPrefet = p.seats.includes("prefet");
  const f = p.sex === "F";

  // State data during the posting (préfet only): shown for the calendar years of the posting, not attributed to the person.
  const years = postingYears(p, today);
  const [credits, grants, communes] = isPrefet && p.coverage !== "identity"
    ? await Promise.all([getDptCredits(), getGrants(), getCommuneNames()]) : [[], [], new Map()];
  const yCredits = creditsByYear(credits).filter((y) => years.includes(y.year));
  const yGrants = grants.filter((g) => years.includes(g.year));

  const missing = [
    prefet.missingPhoto.fr,
    ...(p.functionStart ? [] : [prefet.missingTakingOffice.fr]),
    ...(p.end && !events.some((e) => e.kind === "end") ? [prefet.endDeduced.fr] : []),
    ...(p.coverage === "identity" ? [prefet.coverageIdentity.fr.replace("{date}", date(PARTIAL_FROM))] : []),
    ...(isPrefet && p.coverage === "partial" ? [prefet.coveragePartial.fr.replace("{year}", FULL_FROM.slice(0, 4))] : []),
  ];

  return (
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name={name} removalSubject={`${name} (${label})`} />}
          title={<>{name}<span className="block text-base font-normal text-slate-400">{label}</span></>}
          facts={[
            { label: (f ? prefet.appointedOnF : prefet.appointedOn).fr, value: <a href={p.sourceUrl ?? undefined} className="underline" target="_blank" rel="noopener noreferrer">{date(p.start)}</a> },
            { label: prefet.inPost.fr, value: p.end ? `${prefet.until.fr} ${date(p.end)}` : prefet.currentlyInPost.fr },
            { label: prefet.appointedBy.fr, value: prefet.appointedByValue.fr },
            { label: prefet.status.fr, value: <>{(f ? prefet.appointedNotElectedF : prefet.appointedNotElected).fr}{prefet.appointedNotElected.kr && <> ({prefet.appointedNotElected.kr})</>}</> },
          ]}
          note={<Link href="/prefet" className="underline">{prefet.backToCard.fr}</Link>}
        />
      }
      caveats={<Caveat>{prefet.postingNote.fr}</Caveat>}
      rightOfReply={<RightOfReply text={prefet.rightOfReplyPerson.fr} subject={`Droit de réponse — ${name} (${label})`} />}
    >
      <MissingInfo items={missing} />
      <PostingDecrees events={events} sources={src(events.map((e) => e.source_id))} />
      {steps.length > 0 && <CareerPath steps={steps} sources={src(steps.map((s) => s.source_id))} />}
      {isPrefet && (yCredits.length > 0 || yGrants.length > 0) && (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{prefet.duringPosting.fr} ({years[0]}–{years.at(-1)})</h2>
            <p className="mt-1 text-sm text-slate-600">{prefet.duringPostingNote.fr}</p>
          </div>
          {yCredits.length > 0 && (
            <StateCredits years={yCredits} top={[]} topYear={null}
                          sources={src(credits.filter((c) => c.level === "total").map((c) => c.source_id))} />
          )}
          {yGrants.length > 0 && (
            <StateGrants years={grantsByYear(yGrants)} beneficiaries={byBeneficiary(yGrants, communes)}
                         sources={src(yGrants.map((g) => g.source_id))} />
          )}
        </section>
      )}
    </CardShell>
  );
}
