import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeadlineSet } from "@/components/HeadlineSets";
import { SourceNote } from "@/components/SourceNote";
import { CONTACT_EMAIL, HEADLINE_SETS, PROVISIONAL_YEARS, REFERENCE_YEAR, STRATA, TERM } from "@/lib/config";
import { getCommuneBySlug, getCommunes, getCommuneYears, getMayor, getSources, getYearActuals } from "@/lib/data";
import { computeHeadline, headlineKeys } from "@/lib/headline";
import { int } from "@/lib/format";
import { t } from "@/i18n/strings";

export async function generateStaticParams() {
  return (await getCommunes()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/commune/[slug]">): Promise<Metadata> {
  const commune = await getCommuneBySlug((await params).slug);
  return { title: commune ? `${commune.name} — budget de la commune` : "Commune" };
}

export default async function CommunePage({ params }: PageProps<"/commune/[slug]">) {
  const commune = await getCommuneBySlug((await params).slug);
  if (!commune) notFound();

  const year = REFERENCE_YEAR;
  const keys = [...new Set(HEADLINE_SETS.flatMap((s) => headlineKeys(s.figures)))];
  const [years, rows, mayor, sources] = await Promise.all([
    getCommuneYears(year), getYearActuals(year, keys), getMayor(commune.code), getSources(),
  ]);
  const me = years.find((y) => y.commune_code === commune.code);
  const stratumOf = new Map(years.map((y) => [y.commune_code, y.stratum]));
  const sets = HEADLINE_SETS.map((s) => ({ ...s, values: computeHeadline(s.figures, commune.code, rows, stratumOf) }));
  const usedSources = [...new Set(sets.flatMap((s) => s.values.flatMap((v) => v.sourceIds)))]
    .map((id) => sources.get(id)).filter((s) => s != null);
  const mayorSource = mayor ? sources.get(mayor.source_id) : undefined;

  return (
    <article className="space-y-6">
      {/* Player card header */}
      <header className="rounded-xl bg-slate-900 p-5 text-white">
        <p className="text-xs uppercase tracking-widest text-slate-400">Commune de</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{commune.name}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-slate-400">{t.mayor.fr}</dt>
            <dd className="font-medium">{mayor ? `${mayor.first_name} ${mayor.last_name}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">{t.term.fr}</dt>
            <dd className="font-medium">{TERM.start}–{TERM.end}</dd>
          </div>
          <div>
            <dt className="text-slate-400">{t.population.fr} ({year})</dt>
            <dd className="font-medium">{int(me?.population)} hab.</dd>
          </div>
          <div>
            <dt className="text-slate-400">{t.intercommunality.fr}</dt>
            <dd className="font-medium">{me?.epci_name?.replace(/^Communauté d'agglomération (du |de l'|de la )?/i, "") ?? "—"}</dd>
          </div>
        </dl>
        {mayorSource && (
          <p className="mt-4 text-[11px] text-slate-400">
            {t.mayor.fr} : {mayorSource.credit}, en fonction depuis le{" "}
            {new Date(mayor!.function_start ?? mayor!.mandate_start).toLocaleDateString("fr-FR")}.
          </p>
        )}
      </header>

      {/* Bidjé-a an 3 chif — three candidate sets stacked, to choose one */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">
          {t.headlineTitle.fr} <span className="font-normal text-slate-500">· {t.headlineTitle.kr}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Exercice {year}
          {PROVISIONAL_YEARS.includes(year) && ` (${t.provisional.fr})`}, en euros par habitant.{" "}
          {me?.stratum && STRATA[me.stratum] && `Strate : communes de ${STRATA[me.stratum]}`}
        </p>
        <p className="mt-1 text-xs text-slate-500">{t.headlineDraft.fr}</p>
        <div className="mt-4 space-y-3">
          {sets.map((s) => <HeadlineSet key={s.id} title={s.title} values={s.values} />)}
        </div>
        <SourceNote sources={usedSources} year={year} />
      </section>

      <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {t.caveatEpci.fr}
      </aside>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h2 className="font-semibold">{t.rightOfReply.fr}</h2>
        <p className="mt-1 text-slate-600">{t.rightOfReplyText.fr}</p>
        <a
          className="mt-2 inline-block underline"
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Droit de réponse — ${commune.name}`)}`}
        >
          {CONTACT_EMAIL}
        </a>
      </section>
    </article>
  );
}
