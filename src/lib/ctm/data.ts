import { cacheLife, cacheTag } from "next/cache";
import { check } from "@/lib/core/data";
import { supabase } from "@/lib/core/supabase";
import type { Actual, MetricDef } from "./budget";
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
