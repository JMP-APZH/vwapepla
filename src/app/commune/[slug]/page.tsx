import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CouncilList } from "@/components/CouncilList";
import { HeadlineSet } from "@/components/HeadlineSets";
import { MayorPhoto } from "@/components/MayorPhoto";
import { SourceNote } from "@/components/SourceNote";
import { TermsChart, type ChartPoint } from "@/components/TermsChart";
import { TermsComparison } from "@/components/TermsComparison";
import { CONTACT_EMAIL, DATA_NOTES, HEADLINE_SETS, PROVISIONAL_YEARS, REFERENCE_YEAR, STRATA, TERM } from "@/lib/config";
import {
  getCommuneActuals, getCommuneBySlug, getCommunes, getCommuneYears, getCouncil, getMayor, getMedia, getPastMayors,
  getSources, getTerms, getYearActuals,
} from "@/lib/data";
import { summarizeTerms } from "@/lib/terms";
import { functionTitle, missingDeputyRanks } from "@/lib/council";
import { computeHeadline, headlineKeys } from "@/lib/headline";
import { int } from "@/lib/format";
import { deCommune } from "@/lib/grammar";
import { t } from "@/i18n/strings";

export async function generateStaticParams() {
  return (await getCommunes()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/commune/[slug]">): Promise<Metadata> {
  const commune = await getCommuneBySlug((await params).slug);
  return { title: commune ? `Budget de la commune ${deCommune(commune.name)}` : "Commune" };
}

export default async function CommunePage({ params }: PageProps<"/commune/[slug]">) {
  const commune = await getCommuneBySlug((await params).slug);
  if (!commune) notFound();

  const year = REFERENCE_YEAR;
  const keys = [...new Set(HEADLINE_SETS.flatMap((s) => headlineKeys(s.figures)))];
  const [years, rows, mayor, sources, council, media, terms, pastMayors, history] = await Promise.all([
    getCommuneYears(year), getYearActuals(year, keys), getMayor(commune.code), getSources(), getCouncil(commune.code),
    getMedia(commune.code), getTerms(), getPastMayors(commune.code), getCommuneActuals(commune.code),
  ]);
  const portrait = media.find((m) => m.kind === "mayor_portrait");
  const councilPhoto = media.find((m) => m.kind === "council_photo");
  const summaries = summarizeTerms(terms, history);
  const historyYears = [...new Set(history.map((a) => a.year))].sort((a, b) => a - b);
  const pointsOf = (key: string): ChartPoint[] => historyYears.map((y) => {
    const a = history.find((h) => h.year === y && h.metric_key === key);
    return { year: y, value: a?.eur_per_hab ?? null, provisional: a?.provisional ?? false };
  });
  const bands = terms.filter((t) => t.election_year >= historyYears[0] && t.election_year <= historyYears.at(-1)!)
    .map((t) => ({ id: t.id, from: t.first_full_year, to: t.last_full_year, electionYear: t.election_year }));
  const charted = new Set(["rf_total", "df_total", "di_hors_remb", "epargne_brute", "encours_dette", "capacite_desendettement"]);
  const historySources = [...new Set(history.filter((a) => charted.has(a.metric_key)).map((a) => a.source_id))]
    .map((id) => sources.get(id)).filter((s) => s != null);
  const me = years.find((y) => y.commune_code === commune.code);
  const stratumOf = new Map(years.map((y) => [y.commune_code, y.stratum]));
  const sets = HEADLINE_SETS.map((s) => ({ ...s, values: computeHeadline(s.figures, commune.code, rows, stratumOf) }));
  const usedSources = [...new Set(sets.flatMap((s) => s.values.flatMap((v) => v.sourceIds)))]
    .map((id) => sources.get(id)).filter((s) => s != null);
  const mayorSource = mayor ? sources.get(mayor.source_id) : undefined;

  // Missing or doubtful information is said, never hidden (JM, 31 Oct 2026).
  const missing: string[] = [
    ...missingDeputyRanks(council).map((rank) =>
      `Conseil municipal : le Répertoire national des élus ne mentionne pas de ${functionTitle({ role: "adjoint", rank, sex: null })} (poste vacant ou non déclaré).`),
    ...(() => {
      const ids = summaries.filter((s) => s.term.id !== `${TERM.start}-${TERM.end}`)
        .filter((s) => !pastMayors.some((m) => m.term_id === s.term.id)).map((s) => s.term.id.replace("-", "–"));
      return ids.length ? [`Maire ${ids.length > 1 ? "des mandats" : "du mandat"} ${ids.join(", ")} : nom en cours de vérification.`] : [];
    })(),
    ...(() => {
      const have = new Set(history.filter((a) => a.metric_key === "rf_total").map((a) => a.year));
      const all = Array.from({ length: historyYears.at(-1)! - historyYears[0] + 1 }, (_, i) => historyYears[0] + i);
      const gaps = all.filter((y) => !have.has(y));
      return gaps.length ? [`Comptes : aucune donnée publiée pour ${gaps.join(", ")}.`] : [];
    })(),
    ...(DATA_NOTES[commune.code] ?? []),
  ];

  return (
    <article className="space-y-6">
      {/* Player card header */}
      <header className="rounded-xl bg-slate-900 p-5 text-white">
        <div className="flex items-start gap-4">
          <MayorPhoto name={mayor ? `${mayor.first_name} ${mayor.last_name}` : commune.name} photo={portrait}
                      communeName={commune.name} />
          {/* "Commune du Lamentin", "des Anses-d'Arlet", "de La Trinité": contraction via deCommune() */}
          <h1 className="pt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="font-normal text-slate-400">Commune</span> {deCommune(commune.name)}
          </h1>
        </div>
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

      {missing.length > 0 && (
        <aside className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
          <h2 className="font-semibold">Informations manquantes ou à vérifier</h2>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </aside>
      )}

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

      <CouncilList council={council} photo={councilPhoto} source={sources.get("rne-conseillers-municipaux")} />

      {/* Trois mandats: full budget years in office only; election years shaded (shared between two teams) */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight">Trois mandats comparés</h2>
        <p className="mt-1 text-sm text-slate-600">
          Moyennes par habitant sur les années pleines de chaque mandat ; l&apos;année d&apos;élection, partagée entre
          l&apos;équipe sortante et la nouvelle, est exclue des moyennes et grisée sur les graphiques.
        </p>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <TermsComparison summaries={summaries} pastMayors={pastMayors} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TermsChart title="Recettes de fonctionnement" points={pointsOf("rf_total")} bands={bands} />
          <TermsChart title="Dépenses de fonctionnement" points={pointsOf("df_total")} bands={bands} />
          <TermsChart title="Investissement" points={pointsOf("di_hors_remb")} bands={bands} />
          <TermsChart title="Dette" points={pointsOf("encours_dette")} bands={bands} />
        </div>
        <SourceNote sources={historySources} year={`${historyYears[0]}–${historyYears.at(-1)}`} />
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
