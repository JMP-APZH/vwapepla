"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { getCommuneVoteCriteria, getCommunes } from "@/lib/communes/data";
import { OFFICIAL_SITES } from "@/lib/communes/sites";
import { supabaseAdmin } from "@/lib/core/supabase-admin";
import { verifyTurnstile } from "@/lib/core/turnstile";
import {
  overallCriteriaStatus, parseCriteriaAnswers, type CriteriaVoteStatus,
} from "@/lib/communes/criteria-votes";
import { clientIp, overallStatus, parseAnswers, voterHash, type VoteStatus } from "@/lib/communes/votes";

export type VoteState = { status: VoteStatus | null };

/**
 * Records a visitor's opinion on the town hall's website (1-5 per question).
 * Anti-abuse: honeypot field, Cloudflare Turnstile (shared helper), anonymous monthly voter hash, and the SQL
 * function's limits (one vote per question per commune per month, 40 votes per voter per day).
 */
export async function castSiteVote(_prev: VoteState, form: FormData): Promise<VoteState> {
  const code = String(form.get("commune") ?? "");
  if (form.get("site_web_confirm")) return { status: "ok" }; // honeypot filled: a bot; pretend success, store nothing
  const answers = parseAnswers(form);
  if (!answers || !OFFICIAL_SITES[code] || !(await getCommunes()).some((c) => c.code === code)) {
    return { status: "invalid" };
  }
  const check = await verifyTurnstile(form.get("cf-turnstile-response"), { action: "vote-site" });
  if (!check.ok) return { status: check.reason === "not_configured" || check.reason === "unavailable" ? "error" : "check_failed" };
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

export type CriteriaVoteState = { status: CriteriaVoteStatus | null };

/**
 * Records a visitor's opinion on the commune's action, per criterion (1-5 or « je ne sais pas »), current term.
 * Anti-abuse: honeypot, Cloudflare Turnstile (action "vote-commune"), anonymous monthly voter hash (no IP stored),
 * and the SQL function's limits (one vote per criterion per commune per month, 40 per day, 15 per minute).
 * Closed during pre-election periods (com_vote_closures). Written only here, with the secret key.
 */
export async function castCriteriaVote(_prev: CriteriaVoteState, form: FormData): Promise<CriteriaVoteState> {
  const code = String(form.get("commune") ?? "");
  if (form.get("avis_commune_confirm")) return { status: "ok" }; // honeypot filled: a bot; pretend success, store nothing
  const keys = (await getCommuneVoteCriteria()).map((c) => c.key);
  const answers = parseCriteriaAnswers(form, keys);
  if (!answers || !(await getCommunes()).some((c) => c.code === code)) return { status: "invalid" };
  const check = await verifyTurnstile(form.get("cf-turnstile-response"), { action: "vote-commune" });
  if (!check.ok) return { status: check.reason === "not_configured" || check.reason === "unavailable" ? "error" : "check_failed" };
  const secret = process.env.VOTE_SALT_SECRET;
  if (!secret) return { status: "error" };
  const h = await headers();
  const voter = voterHash(clientIp(h.get("x-forwarded-for"), h.get("x-real-ip")), h.get("user-agent") ?? "", secret);

  const db = supabaseAdmin();
  const statuses: CriteriaVoteStatus[] = [];
  for (const a of answers) {
    const { data, error } = await db.rpc("com_cast_criteria_vote", {
      p_commune: code, p_criterion: a.criterion, p_score: a.score, p_voter_hash: voter,
    });
    statuses.push(error ? "error" : (data as CriteriaVoteStatus));
  }
  if (statuses.includes("ok")) updateTag(`criteria-votes-${code}`);
  return { status: overallCriteriaStatus(statuses) };
}
