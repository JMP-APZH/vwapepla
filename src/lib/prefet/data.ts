import { cacheLife, cacheTag } from "next/cache";
import { check } from "@/lib/core/data";
import { supabase } from "@/lib/core/supabase";
import type { DptCredit } from "./credits";
import type { Grant } from "./grants";

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
