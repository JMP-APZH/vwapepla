import { cacheLife, cacheTag } from "next/cache";
import { supabase } from "./supabase";

// Typed, cached reads. Data changes about once a year (new OFGL release / forecast entry):
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
export type Source = {
  id: string; title: string | null; url: string; dataset_page: string | null; licence: string; credit: string;
  retrieved: string;
};
export type Officeholder = {
  commune_code: string; role: string; last_name: string; first_name: string; mandate_start: string;
  function_start: string | null; source_id: string;
};

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error || res.data == null) throw new Error(`Supabase ${what}: ${res.error?.message ?? "no data"}`);
  return res.data;
}

export async function getCommunes(): Promise<Commune[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(await supabase.from("communes").select("code,slug,name,siren").order("name"), "communes");
}

export async function getCommuneBySlug(slug: string): Promise<Commune | null> {
  return (await getCommunes()).find((c) => c.slug === slug) ?? null;
}

export async function getCommuneYears(year?: number): Promise<CommuneYear[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  let q = supabase.from("commune_years").select("*");
  if (year) q = q.eq("year", year);
  return check(await q.order("commune_code").order("year").limit(5000), "commune_years");
}

export async function getMetrics(): Promise<Map<string, Metric>> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(await supabase.from("metric_definitions").select("*").order("display_order"), "metrics");
  return new Map((rows as Metric[]).map((m) => [m.key, m]));
}

/** All actuals of one commune (all years, all metrics; ~420 rows). */
export async function getCommuneActuals(code: string): Promise<Actual[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("actuals")
      .select("commune_code,year,metric_key,amount,eur_per_hab,provisional,source_id")
      .eq("commune_code", code).order("year").limit(5000),
    "actuals",
  );
}

/** Some metrics for all 34 communes in one year (for medians and comparisons). */
export async function getYearActuals(year: number, keys: string[]): Promise<Actual[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("actuals")
      .select("commune_code,year,metric_key,amount,eur_per_hab,provisional,source_id")
      .eq("year", year).in("metric_key", keys).limit(5000),
    "year actuals",
  );
}

export async function getSources(): Promise<Map<string, Source>> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(
    await supabase.from("sources").select("id,title,url,dataset_page,licence,credit,retrieved"), "sources");
  return new Map((rows as Source[]).map((s) => [s.id, s]));
}

export async function getMayor(code: string): Promise<Officeholder | null> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(
    await supabase.from("officeholders").select("*").eq("commune_code", code).eq("role", "maire")
      .is("mandate_end", null).order("mandate_start", { ascending: false }).limit(1),
    "officeholders",
  );
  return (rows as Officeholder[])[0] ?? null;
}
