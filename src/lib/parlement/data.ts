import { cacheLife, cacheTag } from "next/cache";
import { check } from "@/lib/core/data";
import { supabase } from "@/lib/core/supabase";
import type { Amendment, Question, Scrutin, Vote } from "./activity";
import type { Declaration, InterestItem } from "./interests";
import { AN_BODY, SEN_BODY, toMembers, type MandateDetail, type MandateRow, type Member, type Membership } from "./members";

// Parlement domain (B2): typed, cached reads of the core mandates (two bodies) and the parl_* tables. Data is rebuilt
// weekly (JM, Q10): cached for days and pre-rendered; a redeploy or revalidateTag("data") refreshes it.

const PAGE = 1000; // PostgREST returns at most this many rows per request

/** Every row of a query, page by page (ordered by a unique key so pages never overlap). */
async function all<T>(what: string, page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(await page(from, from + PAGE - 1), what) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export async function getMembers(): Promise<Member[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const [rows, details] = await Promise.all([
    supabase.from("mandates")
      .select("person_id,seat_id,start_date,function_start,end_date,source_id,source_url,persons(last_name,first_name,sex)")
      .or(`seat_id.like.${AN_BODY}:*,seat_id.like.${SEN_BODY}:*`).is("end_date", null).order("seat_id"),
    supabase.from("parl_mandate_details")
      .select("person_id,seat_id,election_cause,suppleant_last_name,suppleant_first_name,suppleant_sex,suppleant_source_id,official_url,hatvp_url,source_id"),
  ]);
  return toMembers(check(rows, "mandates") as unknown as MandateRow[], check(details, "parl_mandate_details") as MandateDetail[]);
}

export async function getMember(slug: string): Promise<Member | undefined> {
  return (await getMembers()).find((m) => m.slug === slug);
}

export async function getMemberships(personId: string): Promise<Membership[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return all<Membership>("parl_memberships", (a, b) => supabase.from("parl_memberships")
    .select("id,person_id,organe_id,function,start_date,end_date,source_id,parl_organes(kind,label_fr,short,chamber)")
    .eq("person_id", personId).order("id").range(a, b));
}

/** Short labels of the political groups referenced by votes (group majority position). */
export async function getGroupLabels(): Promise<Map<string, string>> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(await supabase.from("parl_organes").select("id,label_fr,short").eq("kind", "GP"), "parl_organes") as
    { id: string; label_fr: string; short: string | null }[];
  return new Map(rows.map((r) => [r.id, r.label_fr]));
}

const SCRUTIN_COLS = "id,number,date,type_code,type_label,title,object,text_id,result_code,result_label,pour,contre,abstentions,non_votants,selected_by,url,source_id";

/** Scrutins selected by the published rule (V1), for the card. */
export async function getSelectedScrutins(): Promise<Scrutin[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return all<Scrutin>("parl_scrutins", (a, b) => supabase.from("parl_scrutins").select(SCRUTIN_COLS)
    .neq("selected_by", "{}").order("number").range(a, b));
}

/** Every public vote of the legislature (download only: complete, not curated). */
export async function getAllScrutins(): Promise<Scrutin[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return all<Scrutin>("parl_scrutins", (a, b) => supabase.from("parl_scrutins").select(SCRUTIN_COLS)
    .order("number").range(a, b));
}

export async function getVotes(personId: string): Promise<Vote[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return all<Vote>("parl_votes", (a, b) => supabase.from("parl_votes")
    .select("scrutin_id,person_id,position,by_delegation,group_id,group_position,mise_au_point,source_id")
    .eq("person_id", personId).order("scrutin_id").range(a, b));
}

const AMENDMENT_COLS = "id,amendment_id,chamber,person_id,role,as_rapporteur,signatories,number,text_ref,text_number,text_title,article,filed,outcome,state,url,source_id";

export async function getAmendments(personId: string, role: Amendment["role"]): Promise<Amendment[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return all<Amendment>("parl_amendments", (a, b) => supabase.from("parl_amendments").select(AMENDMENT_COLS)
    .eq("person_id", personId).eq("role", role).order("id").range(a, b));
}

export async function getQuestions(personId: string): Promise<Question[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return all<Question>("parl_questions", (a, b) => supabase.from("parl_questions")
    .select("id,chamber,person_id,kind,number,title,rubrique,ministry,asked,answered,status,url,source_id")
    .eq("person_id", personId).order("id").range(a, b));
}

export async function getDeclarations(personId: string): Promise<Declaration[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("parl_interest_declarations")
    .select("id,person_id,doc_type,deposited,published,status,url,source_id").eq("person_id", personId),
  "parl_interest_declarations") as Declaration[];
}

export async function getInterestItems(personId: string): Promise<InterestItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("parl_interest_items")
    .select("id,person_id,declaration_uuid,declaration_label,deposited,section,position,fields,amounts,source_id")
    .eq("person_id", personId).order("id"), "parl_interest_items") as InterestItem[];
}

/** Today's date, frozen with the cached data (refreshed with it): used for « current » memberships. */
export async function getToday(): Promise<string> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return new Date().toISOString().slice(0, 10);
}
