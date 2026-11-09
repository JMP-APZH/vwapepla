import Link from "next/link";
import { Caveat, FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date, int } from "@/lib/core/format";
import { otherOutcomes, outcomeCounts, partsUsed, questionCounts, recorded, type Amendment, type Question, type VoteLine } from "@/lib/parlement/activity";
import type { Member } from "@/lib/parlement/members";
import { fill } from "@/lib/parlement/text";
import { parlement } from "@/i18n";
import { VoteList, type VoteItem } from "./VoteList";

/** Public votes selected by the published rule V1, with the member's position, the group's majority (AN) or the
 *  published status (Sénat), and the result. */
export function VotesBlock({ member, lines, sources, period }: { member: Member; lines: VoteLine[]; sources: Source[]; period: string }) {
  const an = member.chamber === "AN";
  const items: VoteItem[] = lines.map((l) => ({
    id: l.scrutin.id, number: l.scrutin.number, dateLabel: date(l.scrutin.date), title: l.scrutin.title, url: l.scrutin.url,
    parts: l.scrutin.selected_by, position: l.position, groupPosition: l.groupPosition,
    result: l.scrutin.result_label, byDelegation: l.byDelegation, correction: l.correction, status: l.status,
  }));
  return (
    <FactBlock title={parlement.votesTitle.fr} sources={sources} year={period}>
      <p className="mt-1 text-sm text-slate-600">
        {fill((an ? parlement.votesIntro : parlement.votesIntroSEN).fr, { rule: "V1" })}{" "}
        <Link href="/parlementaires/methode" className="underline">{parlement.votesRuleLink.fr}</Link>
      </p>
      <p className="mt-2 text-sm font-medium">{fill(parlement.votesRecorded.fr, { n: int(recorded(lines)), total: int(lines.length) })}</p>
      <p className="mt-1 text-sm">
        <a href={`/parlementaires/${member.slug}/votes.csv`} className="underline">{(an ? parlement.votesDownload : parlement.votesDownloadSEN).fr}</a>
      </p>
      <VoteList items={items} parts={partsUsed(lines.map((l) => l.scrutin)).map((p) => ({ key: p.key, label: p.label }))}
                labels={{ all: parlement.votesAll.fr, more: parlement.votesShowMore.fr, position: parlement.votesPosition.fr,
                          group: parlement.votesGroup.fr, result: parlement.votesResult.fr,
                          delegation: parlement.votesDelegation.fr, correction: parlement.votesCorrection.fr,
                          status: parlement.votesStatus.fr }} />
      <div className="mt-3"><Caveat>{(an ? parlement.votesCaveat : parlement.votesCaveatSEN).fr}</Caveat></div>
    </FactBlock>
  );
}

const LATEST = 10;

function AmendmentLine({ a }: { a: Amendment }) {
  const text = a.text_title ?? (a.text_number ? fill(parlement.amendmentsText.fr, { n: a.text_number }) : null);
  return (
    <li className="rounded-lg bg-slate-50 p-2">
      <p className="text-xs text-slate-500">{date(a.filed)} · n° {a.number}{a.state && a.chamber === "SEN" ? ` · ${a.state}` : ""}</p>
      <p>
        {a.url ? <a href={a.url} className="underline" target="_blank" rel="noopener noreferrer">{text ?? a.number}</a> : text}
        {a.article && <span className="text-slate-600"> · {a.article}</span>}
      </p>
      <p className="text-xs">{a.outcome ?? parlement.amendmentsPending.fr}{a.as_rapporteur && " · rapporteur"}</p>
    </li>
  );
}

/** Amendments filed as first signatory (counts by published outcome); co-signatures only as a download (charter §3.3). */
export function AmendmentsBlock({ member, own, sources }: { member: Member; own: Amendment[]; sources: Source[] }) {
  const c = outcomeCounts(own);
  const others = otherOutcomes(own);
  const rapporteur = own.filter((a) => a.as_rapporteur).length;
  const sorted = [...own].sort((a, b) => (b.filed ?? "").localeCompare(a.filed ?? "") || b.id.localeCompare(a.id));
  return (
    <FactBlock title={parlement.amendmentsTitle.fr} sources={sources} year="mandat en cours">
      <p className="mt-2 text-sm"><span className="text-2xl font-semibold">{int(c.total)}</span> {parlement.amendmentsFirst.fr.toLowerCase()}</p>
      <ul className="mt-1 text-sm text-slate-700">
        <li>{int(c.adopted)} {parlement.amendmentsAdopted.fr} · {int(c.rejected)} {parlement.amendmentsRejected.fr}</li>
        {c.other > 0 && <li>{int(c.other)} {parlement.amendmentsOther.fr} ({others.map(([o, n]) => `${o.toLowerCase()} : ${n}`).join(", ")})</li>}
        {c.pending > 0 && <li>{int(c.pending)} {parlement.amendmentsPending.fr}</li>}
        {rapporteur > 0 && <li>{fill(parlement.amendmentsRapporteur.fr, { n: int(rapporteur) })}</li>}
      </ul>
      {member.chamber === "SEN" && <p className="mt-1 text-xs text-slate-500">{parlement.amendmentsSenateRank.fr}</p>}
      {sorted.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">{parlement.amendmentsLatest.fr}</h3>
          <ol className="mt-2 space-y-2 text-sm">{sorted.slice(0, LATEST).map((a) => <AmendmentLine key={a.id} a={a} />)}</ol>
          {sorted.length > LATEST && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer underline">{fill(parlement.amendmentsAll.fr, { n: int(sorted.length) })}</summary>
              <ol className="mt-2 space-y-2">{sorted.slice(LATEST).map((a) => <AmendmentLine key={a.id} a={a} />)}</ol>
            </details>
          )}
        </>
      )}
      <p className="mt-4 text-sm text-slate-700">{parlement.amendmentsCosigned.fr}</p>
      <p className="mt-1 text-sm"><a href={`/parlementaires/${member.slug}/cosignatures.csv`} className="underline">{parlement.amendmentsCosignedDownload.fr}</a></p>
    </FactBlock>
  );
}

/** Questions to the Government by kind (total, with a published answer) and the list, each linked to the chamber. */
export function QuestionsBlock({ questions, sources }: { questions: Question[]; sources: Source[] }) {
  const counts = questionCounts(questions);
  const sorted = [...questions].sort((a, b) => (b.asked ?? "").localeCompare(a.asked ?? ""));
  return (
    <FactBlock title={parlement.questionsTitle.fr} sources={sources} year="mandat en cours">
      <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
        {counts.map((c) => (
          <li key={c.kind} className="rounded-lg bg-slate-50 p-2">
            <p className="text-2xl font-semibold">{int(c.total)}</p>
            <p>{c.label}</p>
            <p className="text-xs text-slate-600">{fill(parlement.questionsAnswered.fr, { n: int(c.answered) })}</p>
          </li>
        ))}
      </ul>
      {sorted.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold">{parlement.questionsList.fr} ({int(sorted.length)})</summary>
          <ol className="mt-2 space-y-2">
            {sorted.map((q) => (
              <li key={q.id} className="rounded-lg bg-slate-50 p-2">
                <p className="text-xs text-slate-500">{date(q.asked)} · {q.kind}{q.number ? ` n° ${q.number}` : ""}{q.ministry ? ` · ${q.ministry}` : ""}</p>
                <p>{q.url ? <a href={q.url} className="underline" target="_blank" rel="noopener noreferrer">{q.title ?? q.rubrique}</a> : q.title}</p>
                <p className="text-xs">{q.answered ? fill(parlement.questionsAnsweredOn.fr, { date: date(q.answered) }) : parlement.questionsNoAnswer.fr}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </FactBlock>
  );
}
