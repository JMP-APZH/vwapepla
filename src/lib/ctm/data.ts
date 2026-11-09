import { cacheLife, cacheTag } from "next/cache";
import { check } from "@/lib/core/data";
import { supabase } from "@/lib/core/supabase";
import type { Act } from "./acts";
import type { Actual, MetricDef } from "./budget";
import type { CaLine } from "./ca";
import { AMENDMENTS, type ForecastDoc, type ForecastFigure } from "./forecast";
import type { FunctionalRow } from "./functions";
import type { ElectoralList, ListMember, MandateRow, SectionRow } from "./people";

// CTM domain (B3): typed, cached reads of the ctm_* tables and the CTM's core rows. Data changes a few times a year
// (DGFiP balances, RNE updates): cached for days and pre-rendered; a redeploy or revalidateTag("data") refreshes it.

export async function getActuals(): Promise<Actual[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("ctm_actuals")
      .select("entity_siren,year,metric_key,amount,amount_bp,eur_per_hab,scope,provisional,source_id")
      .order("year").limit(5000),
    "ctm_actuals",
  ) as Actual[];
}

export async function getMetricDefs(): Promise<MetricDef[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("ctm_metric_definitions").select("key,block,parent_key,label_fr,unit,display_order").order("display_order"),
    "ctm_metric_definitions",
  ) as MetricDef[];
}

/** Mandates on the CTM seats (core mandates + persons). */
export async function getMandates(): Promise<MandateRow[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("mandates")
      .select("person_id,seat_id,start_date,function_start,end_date,verified,source_id,source_url,term_id,persons(last_name,first_name,sex)")
      .like("seat_id", "ctm-%").order("start_date").limit(1000),
    "mandates",
  ) as unknown as MandateRow[];
}

export async function getSections(): Promise<SectionRow[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("ctm_section_members").select("person_id,term_id,section,source_id").limit(1000),
    "ctm_section_members") as SectionRow[];
}

export async function getListMembers(): Promise<ListMember[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("ctm_list_members").select("person_id,list_id,match,note,source_id").limit(1000),
    "ctm_list_members") as ListMember[];
}

export async function getLists(): Promise<ElectoralList[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("ctm_electoral_lists")
      .select("id,election_year,round,number,label_short,label,nuance,head,votes,pct_exprimes,seats,source_id").limit(200),
    "ctm_electoral_lists",
  ) as ElectoralList[];
}

const PAGE = 1000; // PostgREST returns at most 1,000 rows per request

/** Spending by area of responsibility, CTM main budget, 2018 onwards (160 rows). */
export async function getFunctional(): Promise<FunctionalRow[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("ctm_functional_actuals")
      .select("year,section,fonction,label,amount,eur_per_hab,provisional,source_id").order("year").limit(PAGE),
    "ctm_functional_actuals",
  ) as FunctionalRow[];
}

/** Acts of both bodies as indexed from the CTM's website (about 6,100 rows: paged). */
export async function getActs(): Promise<Act[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const out: Act[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(
      await supabase.from("ctm_acts").select("id,body,number,year,title,page_url,source_id").order("id")
        .range(from, from + PAGE - 1),
      "ctm_acts",
    ) as Act[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Headline figures of the comptes administratifs voted by the Assemblée (main budget, 9 lines per year). */
export async function getCaLines(): Promise<CaLine[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("ctm_ca_lines").select("year,budget,line_key,label,amount,page,deliberation,source_id").order("year").limit(PAGE),
    "ctm_ca_lines",
  ) as CaLine[];
}

/** Forecast layer: budgets primitifs and orientation reports (documents), BP lines (figures), and the Assemblée's acts that
 *  amend each BP during the year (budget supplémentaire, decisions modificatives), for their links. */
export async function getForecast(): Promise<{ docs: ForecastDoc[]; figures: ForecastFigure[]; amendments: Act[] }> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const ids = Object.values(AMENDMENTS).flat().map((n) => `assemblee:${n}`);
  const [docs, figures, amendments] = await Promise.all([
    supabase.from("ctm_forecast_documents").select("id,fiscal_year,doc_type,deliberation,title,source_id").order("id"),
    supabase.from("ctm_forecast_figures").select("document_id,line_key,label,amount,page,quote").order("document_id"),
    supabase.from("ctm_acts").select("id,body,number,year,title,page_url,source_id").in("id", ids).order("id"),
  ]);
  return {
    docs: check(docs, "ctm_forecast_documents") as ForecastDoc[],
    figures: check(figures, "ctm_forecast_figures") as ForecastFigure[],
    amendments: check(amendments, "ctm_acts") as Act[],
  };
}
