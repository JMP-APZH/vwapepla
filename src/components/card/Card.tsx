import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Source } from "@/lib/core/data";
import { CONTACT_EMAIL } from "@/lib/core/config";
import { common } from "@/i18n";
import { SourceNote } from "./SourceNote";

// Card shell shared by every domain (communes, parlementaires, CTM, préfet). It carries the project's principles:
//   facts are sourced (FactBlock requires its sources), missing information is said (MissingInfo), caveats are shown,
//   the officeholder has a right of reply, and opinions sit in a separate block (OpinionBlock), never mixed with facts.
// Domain cards compose these pieces; domain content (budget, votes...) lives in src/components/<domain>/.

/** The card: header first, then the domain blocks, then caveats and the right of reply. */
export function CardShell({ header, children, caveats, rightOfReply }: {
  header: ReactNode; children: ReactNode; caveats?: ReactNode; rightOfReply: ReactNode;
}) {
  return (
    <article className="space-y-6">
      {header}
      {children}
      {caveats}
      {rightOfReply}
    </article>
  );
}

/** Dark "player card" header: portrait, title, key facts (label/value pairs) and the source of those facts. */
export function CardHeader({ portrait, title, facts, note }: {
  portrait: ReactNode; title: ReactNode; facts: { label: ReactNode; value: ReactNode }[]; note?: ReactNode;
}) {
  return (
    <header className="rounded-xl bg-slate-900 p-5 text-white">
      <div className="flex items-start gap-4">
        {portrait}
        <h1 className="pt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {facts.map((f, i) => (
          <div key={i}>
            <dt className="text-slate-400">{f.label}</dt>
            <dd className="font-medium">{f.value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-4 text-[11px] text-slate-400">{note}</p>}
    </header>
  );
}

/** A block of figures. `sources` is required: no figure reaches the UI without its source note. */
export function FactBlock({ title, sources, year, periodLabel, children }: {
  title: ReactNode; sources: Source[]; year: number | string; periodLabel?: string; children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
      <SourceNote sources={sources} year={year} periodLabel={periodLabel} />
    </section>
  );
}

/** Missing or doubtful information is always stated, never hidden. Renders nothing when the list is empty. */
export function MissingInfo({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
      <h2 className="font-semibold">Informations manquantes ou à vérifier</h2>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {items.map((m) => <li key={m}>{m}</li>)}
      </ul>
    </aside>
  );
}

/** Comparability caveats (e.g. services run by the intercommunality). */
export function Caveat({ children }: { children: ReactNode }) {
  return <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{children}</aside>;
}

/** "Droit de réponse": a visible contact path for the officeholder (MVP2: mailto, no workflow). */
export function RightOfReply({ text, subject }: { text: string; subject: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <h2 className="font-semibold">{common.rightOfReply.fr}</h2>
      <p className="mt-1 text-slate-600">{text}</p>
      <a className="mt-2 inline-block underline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`}>
        {CONTACT_EMAIL}
      </a>
    </section>
  );
}

/**
 * Opinion layer (visitor votes, later comments): streamed separately so a traffic spike hits the cache, and always
 * rendered in its own clearly labelled block by the domain component (e.g. "Avis des visiteurs, non représentatif").
 */
export function OpinionBlock({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-40 rounded-xl border border-violet-200 bg-violet-50/60" />}>
      {children}
    </Suspense>
  );
}
