import { FactBlock } from "@/components/card/Card";
import type { Source } from "@/lib/core/data";
import { date } from "@/lib/core/format";
import type { CareerStep, PostingEvent } from "@/lib/prefet/postings";
import { prefet } from "@/i18n";

const KIND: Record<PostingEvent["kind"], string> = {
  appointment: "Décret de nomination", taking_office: "Prise de fonctions", end: "Fin de fonctions",
  interim_start: "Début d'intérim", interim_end: "Fin d'intérim",
};

/** The decrees of one posting (appointment, taking office when stated, end of functions), each linked to the JORF. */
export function PostingDecrees({ events, sources }: { events: PostingEvent[]; sources: Source[] }) {
  return (
    <FactBlock title={prefet.postingDecrees.fr} sources={sources} year="JORF">
      <ol className="mt-2 space-y-2 text-sm">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg bg-slate-50 p-2">
            <p><span className="font-medium">{date(e.event_date)}</span> · {KIND[e.kind]}</p>
            {e.kind === "appointment" && e.detail && (
              <p className="mt-0.5 text-xs text-slate-600">{prefet.previousPost.fr} : « {e.detail} »</p>
            )}
            <a href={e.source_url} className="text-xs underline" target="_blank" rel="noopener noreferrer">{prefet.readDecree.fr}</a>
          </li>
        ))}
      </ol>
    </FactBlock>
  );
}

/** Career path as published in the Journal officiel: every decree concerning the person since 1990, as written. */
export function CareerPath({ steps, sources }: { steps: CareerStep[]; sources: Source[] }) {
  return (
    <FactBlock title={prefet.careerTitle.fr} sources={sources} year="1990–">
      <p className="mt-1 text-sm text-slate-600">{prefet.careerIntro.fr}</p>
      <ol className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3 text-sm">
        {steps.map((s) => (
          <li key={s.id}>
            <p className="text-xs text-slate-500">
              {date(s.signature_date)}
              {s.effective_date && s.effective_date !== s.signature_date && <> · {prefet.effective.fr} {date(s.effective_date)}</>}
            </p>
            <p>{s.post.charAt(0).toUpperCase() + s.post.slice(1)}</p>
            <a href={s.source_url} className="text-xs underline" target="_blank" rel="noopener noreferrer">{prefet.readDecree.fr}</a>
          </li>
        ))}
      </ol>
    </FactBlock>
  );
}
