import { cacheLife, cacheTag } from "next/cache";
import { check } from "@/lib/core/data";
import { supabase } from "@/lib/core/supabase";
import type { Term } from "./terms";
import { QUESTIONS, type Question, type VoteSummary } from "./vote-questions";

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

/** Mayors of past terms — only rows checked by the team (verified). */
export async function getPastMayors(code: string): Promise<Officeholder[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("com_v_officeholders").select("*").eq("commune_code", code).eq("role", "maire")
      .eq("verified", true).not("mandate_end", "is", null).order("mandate_start"),
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
 * Visitor-vote summary for one commune's website (opinion layer). Averages are hidden by the SQL function below
 * 20 votes. Cached a few minutes (radio traffic hits the cache, not the database); a new vote calls updateTag.
 */
export async function getVoteSummary(code: string): Promise<VoteSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`votes-${code}`);
  const rows = check(await supabase.rpc("com_site_vote_summary", { p_commune: code }), "vote summary") as
    { question: Question; votes: number | string; average: number | string | null }[];
  return QUESTIONS.map((q) => {
    const r = rows.find((x) => x.question === q);
    return { question: q, votes: Number(r?.votes ?? 0), average: r?.average == null ? null : Number(r.average) };
  });
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
