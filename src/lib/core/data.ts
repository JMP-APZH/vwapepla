import { cacheLife, cacheTag } from "next/cache";
import { supabase } from "./supabase";

// Cached reads of the core tables, shared by every domain (sources, media). Domain reads live in src/lib/<domain>/data.ts.
// Core people model (institutions → bodies → seats ← mandates → persons): see
// supabase/migrations/20261103120000_core_people_and_com_prefix.sql.

export type Source = {
  id: string; title: string | null; url: string; dataset_page: string | null; licence: string; credit: string;
  retrieved: string;
};
export type Media = {
  id: string; institution_id: string | null; person_id: string | null; kind: "mayor_portrait" | "council_photo";
  storage_path: string; source_page_url: string; credit: string; retrieved: string;
};

export function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error || res.data == null) throw new Error(`Supabase ${what}: ${res.error?.message ?? "no data"}`);
  return res.data;
}

export async function getSources(): Promise<Map<string, Source>> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  const rows = check(
    await supabase.from("sources").select("id,title,url,dataset_page,licence,credit,retrieved"), "sources");
  return new Map((rows as Source[]).map((s) => [s.id, s]));
}

/** Photos of one institution still published (removed_at is filtered by RLS). */
export async function getMedia(institutionId: string): Promise<Media[]> {
  "use cache";
  cacheLife("days");
  cacheTag("data");
  return check(
    await supabase.from("media")
      .select("id,institution_id,person_id,kind,storage_path,source_page_url,credit,retrieved")
      .eq("institution_id", institutionId),
    "media",
  ) as Media[];
}

export function mediaUrl(m: Media): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${m.storage_path}`;
}
