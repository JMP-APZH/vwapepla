import { cacheLife, cacheTag } from "next/cache";
import { check } from "@/lib/core/data";
import { supabase } from "@/lib/core/supabase";
import type { Amendment, DataGap, Question, Scrutin, Vote } from "./activity";
import type { Declaration, InterestItem } from "./interests";
import { otherOffices, type LinkRow, type OtherOffice } from "./links";
import { AN_BODY, SEN_BODY, toMembers, toPeople, type MandateDetail, type MandateRow, type Member, type Membership, type Person, type Term } from "./members";

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

const MANDATE_COLS = "person_id,seat_id,start_date,function_start,end_date,source_id,source_url,persons(last_name,first_name,sex)";
const DETAIL_COLS = "person_id,seat_id,start_date,election_cause,end_cause,suppleant_last_name,suppleant_first_name,suppleant_sex,suppleant_source_id,official_url,hatvp_url,source_id";

async function mandatesAndDetails(currentOnly: boolean) {
  let q = supabase.from("mandates").select(MANDATE_COLS)
    .or(`seat_id.like.assemblee-nationale-*,seat_id.like.${SEN_BODY}:*`);
  if (currentOnly) q = q.is("end_date", null);
  const [rows, details] = await Promise.all([
    q.order("seat_id").order("start_date"),
    all<MandateDetail>("parl_mandate_details", (a, b) => supabase.from("parl_mandate_details").select(DETAIL_COLS).order("id").range(a, b)),
  ]);
  return { rows: check(rows, "mandates") as unknown as MandateRow[], details };
}

/** Sitting members: the current mandates of the XVIIth legislature and of the Sénat. */
export async function getMembers(): Promise<Member[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const { rows, details } = await mandatesAndDetails(true);
  return toMembers(rows.filter((r) => r.seat_id.startsWith(`${AN_BODY}:`) || r.seat_id.startsWith(`${SEN_BODY}:`)), details);
}

export async function getMember(slug: string): Promise<Member | undefined> {
  return (await getMembers()).find((m) => m.slug === slug);
}

/** Every person with a loaded mandate (AN since 2012, Sénat since 2011), current and former. */
export async function getPeople(): Promise<Person[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const [{ rows, details }, current] = await Promise.all([mandatesAndDetails(false), getMembers()]);
  return toPeople(rows, details, current);
}

export async function getPerson(slug: string): Promise<Person | undefined> {
  return (await getPeople()).find((p) => p.slug === slug);
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

const SCRUTIN_COLS = "id,chamber,legislature,number,date,type_code,type_label,title,object,text_id,result_code,result_label,voters,pour,contre,abstentions,non_votants,text_signet,selected_by,url,source_id";

/** Public votes of one term: AN by legislature, Sénat by date (the term's start and end). */
function termScrutins(t: Pick<Term, "chamber" | "legislature" | "start" | "end">, selectedOnly: boolean) {
  return all<Scrutin>("parl_scrutins", (a, b) => {
    let q = supabase.from("parl_scrutins").select(SCRUTIN_COLS).eq("chamber", t.chamber);
    // AN: the legislature, and the mandate's own dates too (a deputy who resigned, or a replacement who took office
    // later, sat only part of it: votes held outside the mandate are not "no recorded vote").
    if (t.chamber === "AN") q = q.eq("legislature", t.legislature ?? "");
    q = q.gte("date", t.start);
    if (t.end) q = q.lte("date", t.end);
    if (selectedOnly) q = q.neq("selected_by", "{}");
    return q.order("id").range(a, b);
  });
}

/** Scrutins selected by the published rule (V1) during one term, for the card. */
export async function getSelectedScrutins(t: Pick<Term, "chamber" | "legislature" | "start" | "end">): Promise<Scrutin[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return termScrutins({ chamber: t.chamber, legislature: t.legislature, start: t.start, end: t.end }, true);
}

/** Every public vote of one term (download only: complete, not curated). */
export async function getAllScrutins(t: Pick<Term, "chamber" | "legislature" | "start" | "end">): Promise<Scrutin[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return termScrutins({ chamber: t.chamber, legislature: t.legislature, start: t.start, end: t.end }, false);
}

/** What the official open data does not give (absent or partial), measured and dated by the pipeline. */
export async function getDataGaps(): Promise<DataGap[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("parl_data_gaps")
    .select("id,chamber,person_id,period,topic,status,label_fr,detail_fr,checked_url,checked_on,source_id").order("id"),
  "parl_data_gaps") as DataGap[];
}

export async function getVotes(personId: string): Promise<Vote[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return all<Vote>("parl_votes", (a, b) => supabase.from("parl_votes")
    .select("scrutin_id,person_id,position,by_delegation,group_id,group_position,cause,mise_au_point,source_id")
    .eq("person_id", personId).order("scrutin_id").range(a, b));
}

const AMENDMENT_COLS = "id,amendment_id,chamber,legislature,person_id,role,as_rapporteur,signatories,number,text_ref,text_number,text_title,article,filed,outcome,state,url,source_id";

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
    .select("id,chamber,legislature,person_id,kind,number,title,rubrique,ministry,asked,answered,status,url,source_id")
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

/** Offices of the same person in other domains (core person_links, reviewed by JM), with the link to their card. */
export async function getOtherOffices(personId: string): Promise<OtherOffice[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const [rows, communes] = await Promise.all([
    supabase.from("person_links").select("same_as,evidence_url,evidence_label,verified_by,verified_at,"
      + "other:persons!person_links_same_as_fkey(mandates(start_date,end_date,source_id,seats(label_fr,body_id,bodies(name,institution_id,institutions(name)))))")
      .eq("person_id", personId).order("same_as"),
    supabase.from("com_communes").select("code,slug"),
  ]);
  const slugs = new Map((check(communes, "com_communes") as { code: string; slug: string }[]).map((c) => [c.code, c.slug]));
  return otherOffices(check(rows, "person_links") as unknown as LinkRow[], slugs);
}
