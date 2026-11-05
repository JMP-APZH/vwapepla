import { cacheLife, cacheTag } from "next/cache";
import { check } from "@/lib/core/data";
import { supabase } from "@/lib/core/supabase";
import type { DptCredit } from "./credits";
import type { Grant } from "./grants";
import type { CareerStep, MandateRow, PostingEvent } from "./postings";
import type { ContextFigure, CrimeStat } from "./context";
import { distributions, type Distribution, type SummaryRow, type VoteCriterion } from "./votes";

// Préfet domain (B4): typed, cached reads of the pref_* tables. Data changes a few times a year (DGCL release, new DPT
// edition, new appointment decree): cached for days and pre-rendered; a redeploy or revalidateTag("data") refreshes it.

export async function getDptCredits(): Promise<DptCredit[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("pref_dpt_credits")
      .select("edition,page,level,mission,code,label,stage,year,ae,cp,source_id")
      .in("level", ["total", "mission"]).order("id").limit(5000),
    "pref_dpt_credits",
  ) as DptCredit[];
}

export async function getGrants(): Promise<Grant[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("pref_investment_grants")
      .select("id,year,scheme,beneficiary_name,beneficiary_key,mapping_note,project,cost_ht,grant_amount,rate,source_id")
      .order("year").order("id").limit(5000),
    "pref_investment_grants",
  ) as Grant[];
}

/** Commune names and slugs (read-only, from the communes domain) to name grant beneficiaries and link their cards. */
export async function getCommuneNames(): Promise<Map<string, { name: string; slug: string }>> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(await supabase.from("com_communes").select("code,slug,name"), "com_communes") as
    { code: string; slug: string; name: string }[];
  return new Map(rows.map((c) => [c.code, { name: c.name, slug: c.slug }]));
}

const BODY = "prefecture-972-corps";

/** Postings on the six seats of the préfecture (core mandates + persons), from the JORF appointment decrees. */
export async function getMandates(): Promise<MandateRow[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("mandates")
      .select("person_id,seat_id,start_date,function_start,end_date,source_id,source_url,persons(last_name,first_name,sex)")
      .like("seat_id", `${BODY}:%`).order("start_date").limit(1000),
    "mandates",
  ) as unknown as MandateRow[];
}

export async function getPostingEvents(): Promise<PostingEvent[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("pref_posting_events").select("id,seat_id,kind,event_date,detail,source_id,source_url")
      .order("event_date").limit(2000),
    "pref_posting_events",
  ) as PostingEvent[];
}

export async function getCareerSteps(personId: string): Promise<CareerStep[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("pref_career_steps")
      .select("id,person_id,signature_date,post,previous_post,effective_date,source_id,source_url")
      .eq("person_id", personId).order("signature_date"),
    "pref_career_steps",
  ) as CareerStep[];
}

/** Today's date, frozen with the cached data (refreshed with it): used for « en fonction » periods. */
export async function getToday(): Promise<string> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return new Date().toISOString().slice(0, 10);
}

export type PersonFact = { id: string; person_id: string; fact: "birthplace"; value: string; quote: string;
  source_id: string; source_page_url: string; retrieved: string };

/** Facts stated in an official biography (place of birth only), never inferred. */
export async function getPersonFacts(personId: string): Promise<PersonFact[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("pref_person_facts").select("id,person_id,fact,value,quote,source_id,source_page_url,retrieved")
      .eq("person_id", personId),
    "pref_person_facts",
  ) as PersonFact[];
}

/** Criteria of the visitor votes on the State's action (validated by JM). */
export async function getVoteCriteria(): Promise<VoteCriterion[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("pref_vote_criteria")
      .select("key,label_fr,description_fr,competence,others,state_role_fr,fact_blocks,display_order").order("display_order"),
    "pref_vote_criteria",
  ) as VoteCriterion[];
}

/**
 * Distribution of visitor answers per criterion (opinion layer). Counts are hidden by the SQL function below 20 votes.
 * Cached a few minutes (traffic hits the cache, not the database); a new vote calls updateTag("votes-etat").
 */
export async function getStateVoteSummary(keys: string[]): Promise<Distribution[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("votes-etat");
  const rows = check(await supabase.rpc("pref_state_vote_summary"), "pref_state_vote_summary") as SummaryRow[];
  return distributions(rows, keys);
}

/** Recorded crime (SSMSI): Martinique, Guadeloupe and France (sum of the regions). */
export async function getCrimeStats(): Promise<CrimeStat[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("pref_crime_stats")
      .select("geo,year,indicator,unit,count,rate_per_1000,computed,source_id").order("id").limit(5000),
    "pref_crime_stats",
  ) as CrimeStat[];
}

/** Social context (INSEE): unemployment series and published poverty figures. */
export async function getContextFigures(): Promise<ContextFigure[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("pref_context_figures")
      .select("id,indicator,geo,group_label,period,value,unit,note,quote,source_id,source_url").order("id"),
    "pref_context_figures",
  ) as ContextFigure[];
}
