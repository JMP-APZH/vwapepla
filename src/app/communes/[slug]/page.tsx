import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BudgetBreakdown, type BudgetYear } from "@/components/communes/BudgetBreakdown";
import { CouncilList } from "@/components/communes/CouncilList";
import { HeadlineSet } from "@/components/communes/HeadlineSets";
import { Caveat, CardHeader, CardShell, FactBlock, MissingInfo, OpinionBlock, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { SiteChecklist } from "@/components/communes/SiteChecklist";
import { SiteVotes } from "@/components/communes/SiteVotes";
import { TermsChart, type ChartPoint } from "@/components/communes/TermsChart";
import { TermsComparison } from "@/components/communes/TermsComparison";
import { DATA_NOTES, FIRST_YEAR, HEADLINE_SETS, PROVISIONAL_YEARS, REFERENCE_YEAR, STRATA, TERM } from "@/lib/communes/config";
import {
  getCommuneActuals, getCommuneBySlug, getCommunes, getCommuneYears, getCouncil, getMayor, getMetrics, getPastMayors,
  getAuditCriteria, getSiteAudit, getTerms, getVoteSummary, getYearActuals,
} from "@/lib/communes/data";
import { getMedia, getSources } from "@/lib/core/data";
import { OFFICIAL_SITES, SITES_SOURCE } from "@/lib/communes/sites";
import { summarizeTerms } from "@/lib/communes/terms";
import { BLOCKS, blockLines, blockValues } from "@/lib/communes/breakdown";
import { functionTitle, mayorsOfTerm, missingDeputyRanks } from "@/lib/communes/council";
import { computeHeadline, headlineKeys } from "@/lib/communes/headline";
import { int } from "@/lib/core/format";
import { deCommune } from "@/lib/communes/grammar";
import { common, communes } from "@/i18n";

export async function generateStaticParams() {
  return (await getCommunes()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/communes/[slug]">): Promise<Metadata> {
  const commune = await getCommuneBySlug((await params).slug);
  return { title: commune ? `Budget de la commune ${deCommune(commune.name)}` : "Commune" };
}

export default async function CommunePage({ params }: PageProps<"/communes/[slug]">) {
  const commune = await getCommuneBySlug((await params).slug);
  if (!commune) notFound();

  const year = REFERENCE_YEAR;
  const keys = [...new Set(HEADLINE_SETS.flatMap((s) => headlineKeys(s.figures)))];
  const [years, rows, mayor, sources, council, media, terms, pastMayors, history, metrics, allYears] = await Promise.all([
    getCommuneYears(year), getYearActuals(year, keys), getMayor(commune.code), getSources(), getCouncil(commune.code),
    getMedia(`commune-${commune.code}`), getTerms(), getPastMayors(commune.code), getCommuneActuals(commune.code), getMetrics(),
    getCommuneYears(),
  ]);
  const [siteAudit, auditCriteria] = await Promise.all([getSiteAudit(commune.code), getAuditCriteria()]);
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
  // Sources of the block: the accounts charted, and where each past mayor's name comes from (RNE, results, Wikipedia).
  const historySources = [...new Set([
    ...history.filter((a) => charted.has(a.metric_key)).map((a) => a.source_id),
    ...pastMayors.map((m) => m.source_id),
  ])].map((id) => sources.get(id)).filter((s) => s != null);
  const me = years.find((y) => y.commune_code === commune.code);
  const stratumOf = new Map(years.map((y) => [y.commune_code, y.stratum]));
  const sets = HEADLINE_SETS.map((s) => ({ ...s, values: computeHeadline(s.figures, commune.code, rows, stratumOf) }));
  const usedSources = [...new Set(sets.flatMap((s) => s.values.flatMap((v) => v.sourceIds)))]
    .map((id) => sources.get(id)).filter((s) => s != null);
  const mayorSource = mayor ? sources.get(mayor.source_id) : undefined;

  // Budget blocks: every year from FIRST_YEAR, pre-rendered (the year switcher is client-side, no fetch).
  const lines = BLOCKS.map((b) => ({ ...b, lines: blockLines(metrics, b.id) }));
  const blockKeys = [...new Set(lines.flatMap((b) => b.lines.map((l) => l.key)))];
  const budgetYears = historyYears.filter((y) => y >= FIRST_YEAR);
  const yearRows = await Promise.all(budgetYears.map((y) => getYearActuals(y, blockKeys)));
  const budget: BudgetYear[] = budgetYears.map((y, i) => {
    const strata = new Map(allYears.filter((r) => r.year === y).map((r) => [r.commune_code, r.stratum]));
    return {
      year: y,
      provisional: history.some((a) => a.year === y && a.provisional),
      blocks: lines.map((b) => {
        const { values, reference } = blockValues(b.lines, commune.code, yearRows[i], strata);
        const ids = [...new Set(values.map((v) => v.sourceId).filter((s): s is string => !!s))];
        return { id: b.id, title: b.title, values, reference, sources: ids.map((id) => sources.get(id)).filter((s) => s != null) };
      }),
    };
  });

  // Missing or doubtful information is said, never hidden (JM, 31 Oct 2026).
  const missing: string[] = [
    ...missingDeputyRanks(council).map((rank) =>
      `Conseil municipal : le Répertoire national des élus ne mentionne pas de ${functionTitle({ role: "adjoint", rank, sex: null })} (poste vacant ou non déclaré).`),
    ...(() => {
      const past = summaries.filter((s) => s.term.id !== `${TERM.start}-${TERM.end}`);
      const none = past.filter((s) => mayorsOfTerm(pastMayors, s.term.id).length === 0).map((s) => s.term.id.replace("-", "–"));
      const secondary = past.filter((s) => mayorsOfTerm(pastMayors, s.term.id).some((m) => m.evidence === "secondaire"))
        .map((s) => s.term.id.replace("-", "–"));
      return [
        ...(none.length ? [`Maire ${none.length > 1 ? "des mandats" : "du mandat"} ${none.join(", ")} : non trouvé dans les sources officielles.`] : []),
        ...(secondary.length
          ? [`Maire ${secondary.length > 1 ? "des mandats" : "du mandat"} ${secondary.join(", ")} : aucune liste officielle des maires n'est publiée pour cette période ; nom relevé sur Wikipédia, à confirmer.`]
          : []),
      ];
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
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name={mayor ? `${mayor.first_name} ${mayor.last_name}` : commune.name} photo={portrait}
                              removalSubject={commune.name} />}
          /* "Commune du Lamentin", "des Anses-d'Arlet", "de La Trinité": contraction via deCommune() */
          title={<><span className="font-normal text-slate-400">Commune</span> {deCommune(commune.name)}</>}
          facts={[
            { label: communes.mayor.fr, value: mayor ? `${mayor.first_name} ${mayor.last_name}` : "—" },
            { label: communes.term.fr, value: <>{TERM.start}–{TERM.end}</> },
            { label: <>{communes.population.fr} ({year})</>, value: <>{int(me?.population)} hab.</> },
            {
              label: communes.intercommunality.fr,
              value: me?.epci_name?.replace(/^Communauté d'agglomération (du |de l'|de la )?/i, "") ?? "—",
            },
          ]}
          note={mayorSource && (
            <>
              {communes.mayor.fr} : {mayorSource.credit}, en fonction depuis le{" "}
              {new Date(mayor!.function_start ?? mayor!.mandate_start).toLocaleDateString("fr-FR")}.
            </>
          )}
        />
      }
      caveats={<Caveat>{communes.caveatEpci.fr}</Caveat>}
      rightOfReply={<RightOfReply text={communes.rightOfReplyText.fr} subject={`Droit de réponse — ${commune.name}`} />}
    >
      {OFFICIAL_SITES[commune.code] && (
        <a href="#site-mairie"
           className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-2 text-sm text-violet-950">
          <span>{communes.votesShortcut.fr}</span>
          <span aria-hidden className="text-lg">↓</span>
        </a>
      )}

      <MissingInfo items={missing} />

      {/* Bidjé-a an 3 chif — three candidate sets stacked, to choose one */}
      <FactBlock
        title={<>{communes.headlineTitle.fr} <span className="font-normal text-slate-500">· {communes.headlineTitle.kr}</span></>}
        sources={usedSources} year={year}
      >
        <p className="mt-1 text-sm text-slate-600">
          Exercice {year}
          {PROVISIONAL_YEARS.includes(year) && ` (${common.provisional.fr})`}, en euros par habitant.{" "}
          {me?.stratum && STRATA[me.stratum] && `Strate : communes de ${STRATA[me.stratum]}`}
        </p>
        <p className="mt-1 text-xs text-slate-500">{communes.headlineDraft.fr}</p>
        <div className="mt-4 space-y-3">
          {sets.map((s) => <HeadlineSet key={s.id} title={s.title} values={s.values} />)}
        </div>
      </FactBlock>

      <BudgetBreakdown data={budget} defaultYear={budgetYears.includes(year) ? year : budgetYears.at(-1)!} />
      <p className="-mt-3 text-sm">
        <Link href={`/communes/comparer?c=${commune.code}`} className="underline">{communes.compareWith.fr}</Link>
      </p>

      <CouncilList council={council} photo={councilPhoto} source={sources.get("rne-conseillers-municipaux")} />

      {/* Trois mandats: full budget years in office only; election years shaded (shared between two teams) */}
      <FactBlock title="Trois mandats comparés" sources={historySources} year={`${historyYears[0]}–${historyYears.at(-1)}`}>
        <p className="mt-1 text-sm text-slate-600">
          Moyennes par habitant sur les années pleines de chaque mandat ; l&apos;année d&apos;élection, partagée entre
          l&apos;équipe sortante et la nouvelle, est exclue des moyennes et surlignée en orange sur les graphiques.
        </p>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <TermsComparison summaries={summaries} pastMayors={pastMayors} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TermsChart title="Recettes de fonctionnement" points={pointsOf("rf_total")} bands={bands} />
          <TermsChart title="Dépenses de fonctionnement" points={pointsOf("df_total")} bands={bands} />
          <TermsChart title="Investissement" points={pointsOf("di_hors_remb")} bands={bands} />
          <TermsChart title="Dette" points={pointsOf("encours_dette")} bands={bands} />
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <span aria-hidden className="inline-block h-3 w-4 rounded-sm border border-dashed border-amber-700 bg-amber-200/60" />
          Année d&apos;élection municipale : budget partagé entre l&apos;équipe sortante et la nouvelle équipe.
        </p>
      </FactBlock>

      {/* Town-hall website: the fact (listed site, official directory) then the opinion layer, kept apart. */}
      <section id="site-mairie" className="scroll-mt-4 space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">{communes.siteTitle.fr}</h2>
        {OFFICIAL_SITES[commune.code] ? (
          <p className="text-sm">
            <a href={OFFICIAL_SITES[commune.code]!} className="break-all underline" target="_blank" rel="noopener noreferrer">
              {OFFICIAL_SITES[commune.code]!.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </p>
        ) : (
          <p className="text-sm text-slate-600">{communes.siteNone.fr}</p>
        )}
        <p className="text-xs text-slate-500">
          Source :{" "}
          <a href={SITES_SOURCE.url} className="underline" target="_blank" rel="noopener noreferrer">{SITES_SOURCE.label}</a>,
          consulté le {new Date(SITES_SOURCE.retrieved).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
        <SiteChecklist audit={siteAudit} criteria={auditCriteria} />
        {OFFICIAL_SITES[commune.code] && (
          <OpinionBlock>
            <Votes code={commune.code} />
          </OpinionBlock>
        )}
      </section>
    </CardShell>
  );
}

async function Votes({ code }: { code: string }) {
  return <SiteVotes code={code} summary={await getVoteSummary(code)} />;
}
