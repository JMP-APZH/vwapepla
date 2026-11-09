import type { Metadata } from "next";
import Link from "next/link";
import { CardHeader, CardShell, Caveat, MissingInfo, RightOfReply } from "@/components/card/Card";
import { Portrait } from "@/components/card/Portrait";
import { AreaSpending } from "@/components/ctm/Areas";
import { CompteAdministratif } from "@/components/ctm/Ca";
import { ForecastBudget, PlannedVsActual } from "@/components/ctm/Forecast";
import { BeforeCtm, BreakdownBlock, FiscaliteUltramarine, SavingsDebt } from "@/components/ctm/Budget";
import { getSources } from "@/lib/core/data";
import { date, int } from "@/lib/core/format";
import { beforeCtm, breakdown, CTM, get, index, referenceYear, series, sourceIds } from "@/lib/ctm/budget";
import { caComparison, caYears } from "@/lib/ctm/ca";
import { getActuals, getCaLines, getForecast, getFunctional, getMetricDefs } from "@/lib/ctm/data";
import { AMENDMENTS, bpDoc, bpYears, forecastRows, plannedVsActual, plannedYears } from "@/lib/ctm/forecast";
import { areasForYear } from "@/lib/ctm/functions";
import { ctm } from "@/i18n";

export const metadata: Metadata = { title: ctm.cardTitle.fr };

const TERM_START = "2021-07-02"; // RNE: start of the mandates of the councillors elected in June 2021
const CRC = "ctm:crc-ctm-2026-rapport-observations-definitives";
const FUM_FROM = 2018; // M57 renumbered in 2018: 2016-2017 not comparable (docs/branches/B3-MAPPING.md §B)
const FUM = ["fum_total", "fum_octroi_de_mer", "fum_carburants", "fum_autres", "fum_transport", "fum_rhum"];

// The Collectivité: budget facts of the institution (B3 neutrality charter, docs/branches/B3-DISCOVERY.md §4): no score,
// no ranking; every block sourced; the Région and the Département before 2016 shown side by side, never summed.
export default async function CtmPage() {
  const [rows, defs, sources, functional, caLines, forecast] = await Promise.all([
    getActuals(), getMetricDefs(), getSources(), getFunctional(), getCaLines(), getForecast()]);
  const idx = index(rows);
  const year = referenceYear(rows) ?? 2024;
  const ctmYears = [...new Set(rows.filter((r) => r.entity_siren === CTM).map((r) => r.year))].sort();
  const last = ctmYears.at(-1)!;
  const provisional = rows.some((r) => r.entity_siren === CTM && r.year === last && r.provisional) ? last : null;
  const range = `${ctmYears[0]}-${last}`;
  const src = (ids: string[]) => ids.map((id) => sources.get(id)).filter((s) => s != null);
  const label = (key: string) => defs.find((d) => d.key === key)?.label_fr ?? key;

  const income = breakdown(idx, defs, CTM, year, "rf_total");
  const spending = breakdown(idx, defs, CTM, year, "df_total");
  const line = (key: string, total?: number | null) => {
    const a = get(idx, CTM, year, key);
    const amount = a?.amount ?? null;
    return { key, label: label(key), amount, perHab: a?.eur_per_hab ?? null,
             share: total && amount != null ? amount / total : null, sourceId: a?.source_id ?? null };
  };
  const investTotal = line("di_hors_remb");
  const invest = [investTotal, ...["depenses_equipement", "subv_equipement"].map((k) => line(k, investTotal.amount)),
                  line("remboursements"), line("emprunts")];
  const savings = series(rows, CTM, "epargne_brute"), debt = series(rows, CTM, "encours_dette"),
    capacity = series(rows, CTM, "capacite_desendettement");
  const fumRows = ctmYears.map((y) => ({
    year: y, provisional: y === provisional,
    values: Object.fromEntries(FUM.map((k) => [k, get(idx, CTM, y, k)?.amount ?? null])),
  })).filter((r) => r.year >= FUM_FROM && r.values.fum_total != null);
  const fumSources = sourceIds(rows.filter((r) => r.entity_siren === CTM && r.year >= FUM_FROM && FUM.includes(r.metric_key)));
  const before = ["rf_total", "df_total", "epargne_brute", "encours_dette", "depenses_equipement", "frais_personnel"]
    .map((key) => ({ label: label(key), rows: beforeCtm(rows, key) }));
  const beforeSources = sourceIds(rows.filter((r) => r.year < 2016));
  const population = get(idx, CTM, year, "population")?.amount;

  // Forecast layer (« Prévisionnel »): latest BP alone, then BP beside CA for the years with both; separate columns.
  const fdoc = (y: number, type: "BP" | "ROB") => {
    const d = type === "BP" ? bpDoc(forecast.docs, y) : forecast.docs.find((x) => x.doc_type === "ROB" && x.fiscal_year === y);
    return d ? { deliberation: d.deliberation, pdfUrl: sources.get(d.source_id)?.url ?? null } : null;
  };
  const amendments = (y: number) => (AMENDMENTS[y] ?? [])
    .map((n) => forecast.amendments.find((a) => a.id === `assemblee:${n}`)).filter((a) => a != null);
  const bpLast = bpYears(forecast.docs)[0];
  const planned = plannedYears(forecast.docs, caLines).map((y) => {
    const first = caLines.find((l) => l.year === y)!;
    return { year: y, rows: plannedVsActual(forecast.docs, forecast.figures, caLines, y), bp: fdoc(y, "BP")!,
             ca: { deliberation: first.deliberation, pdfUrl: sources.get(first.source_id)?.url ?? null },
             rob: fdoc(y, "ROB"), amendments: amendments(y) };
  });
  const forecastSources = (ys: number[]) => src([...forecast.docs.filter((d) => ys.includes(d.fiscal_year)).map((d) => d.source_id),
    ...(forecast.amendments.length ? ["ctm:ctm-deliberations-assemblee"] : [])]);

  return (
    <CardShell
      header={
        <CardHeader
          portrait={<Portrait name="CTM" removalSubject="Collectivité Territoriale de Martinique" />}
          title={<>{ctm.cardTitle.fr}{ctm.cardTitle.kr && <span className="block text-base font-normal text-slate-400">{ctm.cardTitle.kr}</span>}</>}
          facts={[
            { label: <>{ctm.headerPopulation.fr} {year}</>, value: int(population) },
            { label: ctm.headerTerm.fr, value: ctm.headerTermValue.fr.replace("{date}", date(TERM_START)) },
            { label: <>{ctm.headerAssemblee.fr}{ctm.headerAssemblee.kr && <> · {ctm.headerAssemblee.kr}</>}</>, value: <Link href="/ctm/assemblee" className="underline">{ctm.headerAssembleeValue.fr}</Link> },
            { label: <>{ctm.headerExecutif.fr}{ctm.headerExecutif.kr && <> · {ctm.headerExecutif.kr}</>}</>, value: <Link href="/ctm/conseil-executif" className="underline">{ctm.headerExecutifValue.fr}</Link> },
          ]}
          note={ctm.headerNote.fr}
        />
      }
      caveats={<div className="space-y-3"><Caveat>{ctm.caveatCompetences.fr}</Caveat><Caveat>{ctm.caveatM57.fr}</Caveat></div>}
      rightOfReply={<RightOfReply text={ctm.rightOfReplyCtm.fr} subject="Droit de réponse — Collectivité Territoriale de Martinique" />}
    >
      <nav className="grid gap-3 sm:grid-cols-2">
        <Link href="/ctm/assemblee" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium hover:border-slate-400">{ctm.tileAssemblee.fr} →</Link>
        <Link href="/ctm/conseil-executif" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium hover:border-slate-400">{ctm.tileExecutif.fr} →</Link>
      </nav>
      <MissingInfo items={[ctm.missingEndOfTerm.fr, ctm.missingCompetences.fr]} />
      <h2 className="border-t border-slate-200 pt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {ctm.budgetTitle.fr}{ctm.budgetTitle.kr && <span className="font-normal normal-case"> · {ctm.budgetTitle.kr}</span>}
      </h2>
      <BreakdownBlock title={ctm.incomeTitle.fr} year={year} total={income.total} parts={income.parts}
                      sources={src(sourceIds([income.total, ...income.parts]))} />
      <BreakdownBlock title={ctm.spendingTitle.fr} year={year} total={spending.total} parts={spending.parts}
                      sources={src(sourceIds([spending.total, ...spending.parts]))} />
      <BreakdownBlock title={ctm.investTitle.fr} year={year} total={invest[0]} parts={invest.slice(1, 3)} extra={invest.slice(3)}
                      sources={src(sourceIds(invest))} />
      <AreaSpending year={year} lines={areasForYear(functional, year)} rows={functional}
                    sources={src([...new Set(functional.map((f) => f.source_id)), "ctm:ofgl-fonctions-m57-libelles"])} />
      <SavingsDebt savings={savings} debt={debt} capacity={capacity} range={range} provisionalYear={provisional}
                   crcUrl={sources.get(CRC)?.url ?? null}
                   sources={src([...sourceIds(rows.filter((r) => r.entity_siren === CTM && ["epargne_brute", "encours_dette"].includes(r.metric_key)))])} />
      <CompteAdministratif
        years={caYears(caLines).map((y) => {
          const first = caLines.find((l) => l.year === y)!;
          return { year: y, rows: caComparison(caLines, idx, y), deliberation: first.deliberation,
                   pdfUrl: sources.get(first.source_id)?.url ?? null,
                   provisional: rows.some((r) => r.entity_siren === CTM && r.year === y && r.provisional) };
        })}
        sources={src([...new Set(caLines.map((l) => l.source_id)), "ctm:ofgl-base-regions-consolidee"])} />
      {bpLast != null && (
        <ForecastBudget year={bpLast} rows={forecastRows(forecast.docs, forecast.figures, bpLast)} bp={fdoc(bpLast, "BP")!}
                        rob={fdoc(bpLast, "ROB")} amendments={amendments(bpLast)} sources={forecastSources([bpLast])} />
      )}
      {planned.length > 0 && (
        <PlannedVsActual years={planned} missing={planned.some((p) => p.year === 2024) ? [ctm.missingDm1_2024.fr] : []}
                         sources={[...forecastSources(planned.map((p) => p.year)),
                                   ...src([...new Set(caLines.filter((l) => planned.some((p) => p.year === l.year)).map((l) => l.source_id))])]} />
      )}
      <FiscaliteUltramarine rows={fumRows} labels={FUM.map((key) => ({ key, label: label(key) }))}
                            range={`${fumRows[0]?.year}-${fumRows.at(-1)?.year}`} sources={src(fumSources)} />
      <BeforeCtm tables={before} sources={src(beforeSources)} />
    </CardShell>
  );
}
