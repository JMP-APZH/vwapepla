"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { getCommunes } from "@/lib/communes/data";
import { OFFICIAL_SITES } from "@/lib/communes/sites";
import { supabaseAdmin } from "@/lib/core/supabase-admin";
import { clientIp, overallStatus, parseAnswers, voterHash, type VoteStatus } from "@/lib/communes/votes";

export type VoteState = { status: VoteStatus | null };

/**
 * Records a visitor's opinion on the town hall's website (1-5 per question).
 * Anti-abuse: honeypot field, anonymous daily voter hash, and the SQL function's limits
 * (one vote per question per commune per 30 days, 40 votes per voter per day).
 */
export async function castSiteVote(_prev: VoteState, form: FormData): Promise<VoteState> {
  const code = String(form.get("commune") ?? "");
  if (form.get("site_web_confirm")) return { status: "ok" }; // honeypot filled: a bot; pretend success, store nothing
  const answers = parseAnswers(form);
  if (!answers || !OFFICIAL_SITES[code] || !(await getCommunes()).some((c) => c.code === code)) {
    return { status: "invalid" };
  }
  const secret = process.env.VOTE_SALT_SECRET;
  if (!secret) return { status: "error" };
  const h = await headers();
  const voter = voterHash(clientIp(h.get("x-forwarded-for"), h.get("x-real-ip")), h.get("user-agent") ?? "", secret);

  const db = supabaseAdmin();
  const statuses: VoteStatus[] = [];
  for (const a of answers) {
    const { data, error } = await db.rpc("com_cast_site_vote", {
      p_commune: code, p_question: a.question, p_score: a.score, p_voter_hash: voter,
    });
    statuses.push(error ? "error" : (data as VoteStatus));
  }
  if (statuses.includes("ok")) updateTag(`votes-${code}`);
  return { status: overallStatus(statuses) };
}
