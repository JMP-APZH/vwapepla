import { cacheLife, cacheTag } from "next/cache";
import { check } from "@/lib/core/data";
import { supabase } from "@/lib/core/supabase";
import type { Term } from "./terms";
import { siteDistributions, type SiteVoteResults, type SiteVoteRow } from "./vote-questions";
import { criteriaResults, type CommuneVoteCriterion, type CriteriaResults, type CriteriaSummaryRow } from "./criteria-votes";

// Commune domain (B1): typed, cached reads of the com_* tables. Data changes about once a year (new OFGL release / forecast entry):
// everything is cached for days and pre-rendered; a redeploy or revalidateTag("data") refreshes it.

export type Commune = { code: string; slug: string; name: string; siren: string };
export type CommuneYear = {
  commune_code: string; year: number; population: number; stratum: string | null;
  epci_siren: string | null; epci_name: string | null; nomenclature: string | null;
};
export type Metric = {
  key: string; block: string; parent_key: string | null; label_fr: string; label_kreyol: string | null;
  source_rule: string; unit: "eur" | "years" | "ratio"; on_card: boolean; description_fr: string | null;
  display_order: number;
};
export type Actual = {
  commune_code: string; year: number; metric_key: string; amount: number | null; eur_per_hab: number | null;
  provisional: boolean; source_id: string;
};
export type Officeholder = {
  commune_code: string; role: "maire" | "adjoint" | "conseiller"; rank: number | null; last_name: string;
  first_name: string; sex: "F" | "M" | null; mandate_start: string; mandate_end: string | null; function_start: string | null;
  term_id: string | null; verified: boolean; source_id: string; source_url: string | null;
};

export async function getCommunes(): Promise<Commune[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("com_communes").select("code,slug,name,siren").order("name"), "communes");
}

export async function getCommuneBySlug(slug: string): Promise<Commune | null> {
  return (await getCommunes()).find((c) => c.slug === slug) ?? null;
}

export async function getCommuneYears(year?: number): Promise<CommuneYear[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  let q = supabase.from("com_commune_years").select("*");
  if (year) q = q.eq("year", year);
  return check(await q.order("commune_code").order("year").limit(5000), "commune_years");
}

export async function getMetrics(): Promise<Map<string, Metric>> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(await supabase.from("com_metric_definitions").select("*").order("display_order"), "metrics");
  return new Map((rows as Metric[]).map((m) => [m.key, m]));
}

/** All actuals of one commune (all years, all metrics; ~420 rows). */
export async function getCommuneActuals(code: string): Promise<Actual[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("com_actuals")
      .select("commune_code,year,metric_key,amount,eur_per_hab,provisional,source_id")
      .eq("commune_code", code).order("year").limit(5000),
    "actuals",
  );
}

const PAGE = 1000; // PostgREST returns at most 1,000 rows per request on Supabase

/** Some metrics for all 34 communes in one year (for medians and comparisons). Paged: 34 x 35 keys > 1,000. */
export async function getYearActuals(year: number, keys: string[]): Promise<Actual[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const out: Actual[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(
      await supabase.from("com_actuals")
        .select("commune_code,year,metric_key,amount,eur_per_hab,provisional,source_id")
        .eq("year", year).in("metric_key", keys).order("commune_code").order("metric_key")
        .range(from, from + PAGE - 1),
      "year actuals",
    );
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export async function getMayor(code: string): Promise<Officeholder | null> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(
    await supabase.from("com_v_officeholders").select("*").eq("commune_code", code).eq("role", "maire")
      .is("mandate_end", null).order("mandate_start", { ascending: false }).limit(1),
    "officeholders",
  );
  return (rows as Officeholder[])[0] ?? null;
}

/** Current municipal council: mayor, deputies by rank, then councillors alphabetically. */
export async function getCouncil(code: string): Promise<Officeholder[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(
    await supabase.from("com_v_officeholders").select("*").eq("commune_code", code).is("mandate_end", null)
      .eq("term_id", "2026-2032"),
    "council",
  ) as Officeholder[];
  const order = { maire: 0, adjoint: 1, conseiller: 2 };
  return rows.sort((a, b) => order[a.role] - order[b.role] || (a.rank ?? 0) - (b.rank ?? 0)
    || a.last_name.localeCompare(b.last_name, "fr") || a.first_name.localeCompare(b.first_name, "fr"));
}

/**
 * Mayors of past terms (history.yaml, built by scripts/communes/pipeline/build_mayor_history.py): official sources
 * first; rows from Wikipedia (source "vwapepla-historique-maires") are shown with "à confirmer" (see mayorEvidence).
 */
export async function getPastMayors(code: string): Promise<Officeholder[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("com_v_officeholders").select("*").eq("commune_code", code).eq("role", "maire")
      .not("mandate_end", "is", null).in("term_id", ["2008-2014", "2014-2020", "2020-2026"]).order("mandate_start"),
    "past mayors",
  ) as Officeholder[];
}

export async function getTerms(): Promise<Term[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("terms").select("*").eq("body_kind", "conseil_municipal").order("election_year"), "terms") as Term[];
}

/**
 * Visitor votes on one commune's website (opinion layer), as a distribution per question (no average). The SQL
 * function hides the counts below 20 votes and during pre-election closures. Cached a few minutes (radio traffic hits
 * the cache, not the database); a new vote calls updateTag(`votes-${code}`).
 */
export async function getVoteSummary(code: string): Promise<SiteVoteResults> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`votes-${code}`);
  const [rows, closed] = await Promise.all([
    supabase.rpc("com_site_vote_distribution", { p_commune: code }),
    supabase.rpc("com_votes_closed", { p_commune: code }),
  ]);
  return siteDistributions(check(rows, "com_site_vote_distribution") as SiteVoteRow[], check(closed, "com_votes_closed") === true);
}

/** Criteria of the visitor votes on the commune's action (validated by JM, 7 Nov 2026). */
export async function getCommuneVoteCriteria(): Promise<CommuneVoteCriterion[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("com_vote_criteria")
      .select("key,label_fr,competence,others,commune_role_fr,ref_status,display_order").order("display_order"),
    "com_vote_criteria",
  ) as CommuneVoteCriterion[];
}

/**
 * Results of the votes on the commune's action, current term (opinion layer). The SQL function hides the counts
 * below 20 rated votes and during pre-election closures. Cached a few minutes; a new vote calls
 * updateTag(`criteria-votes-${code}`).
 */
export async function getCriteriaVoteResults(code: string, keys: string[]): Promise<CriteriaResults> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`criteria-votes-${code}`);
  const rows = check(await supabase.rpc("com_criteria_vote_summary", { p_commune: code }), "com_criteria_vote_summary") as
    CriteriaSummaryRow[];
  return criteriaResults(rows, keys);
}

export type AuditCriterion = {
  key: string; family: "legal" | "quality" | "civic"; theme: string; label_fr: string; description_fr: string | null;
  legal_ref: string | null; display_order: number;
};
export type AuditItem = {
  criterion_key: string; status: "yes" | "partial" | "no" | "na"; evidence_url: string | null; archive_url: string | null;
  note: string | null; method: "automated" | "manual";
};
export type SiteAudit = { id: string; audited_on: string; site_url: string | null; reviewed_by: string; items: AuditItem[] };

export async function getAuditCriteria(): Promise<AuditCriterion[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("com_audit_criteria").select("*").order("display_order"), "audit criteria") as AuditCriterion[];
}

/** Latest REVIEWED website audit of a commune (only reviewed audits are ever loaded), or null. */
export async function getSiteAudit(code: string): Promise<SiteAudit | null> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const audits = check(
    await supabase.from("com_site_audits").select("id,audited_on,site_url,reviewed_by").eq("commune_code", code)
      .not("reviewed_by", "is", null).order("audited_on", { ascending: false }).limit(1),
    "site audits",
  ) as Omit<SiteAudit, "items">[];
  if (!audits[0]) return null;
  const items = check(
    await supabase.from("com_site_audit_items").select("criterion_key,status,evidence_url,archive_url,note,method")
      .eq("audit_id", audits[0].id),
    "site audit items",
  ) as AuditItem[];
  return { ...audits[0], items };
}

export type ChannelObservation = {
  id: string; platform: "facebook" | "instagram" | "tiktok" | "youtube" | "whatsapp_channel"; observed_on: string;
  account_url: string | null; account_name: string | null; official: "yes" | "no" | "doubtful" | null;
  official_basis: "linked_from_site" | "platform_verified" | "town_hall_confirmed" | "none" | null;
  official_evidence_url: string | null; last_post_date: string | null; posts_last_90_days: number | null;
  council_meetings_streamed: "yes" | "no" | "unknown" | null; council_stream_evidence_url: string | null;
  followers: number | null; followers_display: string | null; screenshot_sha256: string | null;
  searched_on: string | null; search_note: string | null; observer: string;
};

/**
 * Reviewed observations of the town hall's social-network accounts (only reviewed rows are ever loaded), with the
 * date they were read (`asOf`, reference for « relevé ancien »: a cached function may read the clock, a page may not).
 */
export async function getChannels(code: string): Promise<{ observations: ChannelObservation[]; asOf: string }> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const observations = check(
    await supabase.from("com_channel_observations")
      .select("id,platform,observed_on,account_url,account_name,official,official_basis,official_evidence_url,last_post_date," +
        "posts_last_90_days,council_meetings_streamed,council_stream_evidence_url,followers,followers_display," +
        "screenshot_sha256,searched_on,search_note,observer")
      .eq("commune_code", code).order("observed_on", { ascending: false }),
    "channels",
  ) as unknown as ChannelObservation[];
  return { observations, asOf: new Date().toISOString() };
}
