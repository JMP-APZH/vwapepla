import type { LegalText, Topic } from "@/lib/ctm/textes";
import { ctm } from "@/i18n";

const TOPIC_LABEL: Record<Topic, string> = {
  institution: ctm.legalTopicInstitution.fr, elections: ctm.legalTopicElections.fr, octroi: ctm.legalTopicOctroi.fr,
};

/** « Cadre légal »: links to the official texts on Légifrance, grouped by topic; each says what it supports. */
export function LegalFramework({ groups }: { groups: { topic: Topic; texts: LegalText[] }[] }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{ctm.legalTitle.fr}</h2>
      <p className="mt-1 text-sm text-slate-600">{ctm.legalIntro.fr}</p>
      {groups.map((g) => (
        <div key={g.topic} className="mt-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{TOPIC_LABEL[g.topic]}</h3>
          <ul className="mt-1 space-y-2 text-sm">
            {g.texts.map((t) => <LegalItem key={t.id} t={t} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function LegalItem({ t }: { t: LegalText }) {
  return (
    <li>
      <a href={t.url} className="underline" target="_blank" rel="noopener noreferrer">{t.title}</a>
      {t.article && <span className="text-slate-600">, {t.article}</span>}
      <span className="block text-slate-600">{t.supports}</span>
      {!t.checked && <span className="block text-xs text-slate-400">{ctm.legalUnchecked.fr}</span>}
    </li>
  );
}
