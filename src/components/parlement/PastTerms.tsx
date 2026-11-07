import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date, int } from "@/lib/core/format";
import { seatLabel, termPeriod, type Member } from "@/lib/parlement/members";
import { fill, upperFirst } from "@/lib/parlement/text";
import type { TermSummary } from "@/lib/parlement/terms";
import { parlement } from "@/i18n";

/** One summary per earlier mandate: same figures and limits as the current-term blocks, never compared. */
export function PastTermsBlock({ summaries, sex, slug, sources, title, amendmentsMissing = new Set() }: {
  summaries: TermSummary[]; sex: Member["sex"]; slug: string; sources: Source[]; title: string;
  /** Legislatures whose amendments are not loaded (data gap): stated, never counted as zero. */
  amendmentsMissing?: Set<string>;
}) {
  if (summaries.length === 0) return null;
  return (
    <FactBlock title={title} sources={sources} year={summaries.length === 1 ? termPeriod(summaries[0].term) : "mandats terminés"}>
      <p className="mt-1 text-sm text-slate-600">{parlement.pastTermsIntro.fr}</p>
      <ol className="mt-3 space-y-4 text-sm">
        {summaries.map(({ term: t, selected, recorded, amendments: a, questions, groups }) => (
          <li key={`${t.seatId}:${t.start}`} className="rounded-lg border border-slate-200 p-3">
            <h3 className="font-semibold">{termPeriod(t)}</h3>
            <p className="text-slate-600">{seatLabel({ chamber: t.chamber, rank: t.rank, sex })}</p>
            <p className="text-xs text-slate-500">
              {fill(parlement.termDates.fr, { from: date(t.start), to: date(t.end) })}
              {t.electionCause && ` · ${parlement.termStart.fr} : ${t.electionCause}`}
              {t.endCause && ` · ${parlement.termEnd.fr} : ${t.endCause}`}
              {t.officialUrl && <> · <a href={t.officialUrl} className="underline" target="_blank" rel="noopener noreferrer">{parlement.officialPage.fr}</a></>}
            </p>
            {groups.length > 0 && <p className="mt-1"><span className="text-slate-500">{parlement.group.fr} : </span>{groups.map(upperFirst).join(" ; ")}</p>}
            <ul className="mt-2 space-y-1">
              <li>{selected > 0 ? fill(parlement.termVotes.fr, { n: int(recorded), total: int(selected) }) : parlement.termNoSelected.fr}</li>
              <li>{t.legislature && amendmentsMissing.has(t.legislature) ? parlement.termAmendmentsMissing.fr : fill(parlement.termAmendments.fr, { n: int(a.total), adopted: int(a.adopted), rejected: int(a.rejected), other: int(a.other), pending: int(a.pending) })}</li>
              <li>{questions.length > 0
                ? `${parlement.questionsTitle.fr} : ${questions.map((q) => `${q.label.toLowerCase()} ${int(q.total)} (${fill(parlement.questionsAnswered.fr, { n: int(q.answered) })})`).join(" ; ")}`
                : parlement.termNoQuestions.fr}</li>
            </ul>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm">
        <a href={`/parlementaires/${slug}/votes.csv`} className="underline">{parlement.termDownloadVotes.fr}</a>
        {" · "}
        <a href={`/parlementaires/${slug}/cosignatures.csv`} className="underline">{parlement.amendmentsCosignedDownload.fr}</a>
      </p>
    </FactBlock>
  );
}
