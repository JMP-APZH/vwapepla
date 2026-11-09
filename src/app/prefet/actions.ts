"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { clientIp, voterHash } from "@/lib/communes/votes"; // same anonymous monthly hash as the communes' votes
import { verifyTurnstile } from "@/lib/core/turnstile";
import { supabaseAdmin } from "@/lib/core/supabase-admin";
import { getVoteCriteria } from "@/lib/prefet/data";
import { overallStatus, parseStateAnswers, type VoteStatus } from "@/lib/prefet/votes";

export type StateVoteState = { status: VoteStatus | null };

/**
 * Records a visitor's opinion on the State's action in Martinique (1-5 per criterion, « sans avis » not recorded).
 * Anti-abuse: honeypot field, Cloudflare Turnstile (shared helper, checked before any write), anonymous voter hash
 * salted per calendar month (no IP stored), and the SQL function's limits (one vote per criterion per voter hash —
 * so one per month —, 40 votes per voter per day). Written only here, with the secret key.
 */
export async function castStateVote(_prev: StateVoteState, form: FormData): Promise<StateVoteState> {
  if (form.get("avis_confirm")) return { status: "ok" }; // honeypot filled: a bot; pretend success, store nothing
  const keys = (await getVoteCriteria()).map((c) => c.key);
  const answers = parseStateAnswers(form, keys);
  if (!answers) return { status: "invalid" };
  const check = await verifyTurnstile(form.get("cf-turnstile-response"), { action: "vote-etat" });
  if (!check.ok) return { status: check.reason === "not_configured" || check.reason === "unavailable" ? "error" : "check_failed" };
  const secret = process.env.VOTE_SALT_SECRET;
  if (!secret) return { status: "error" };
  const h = await headers();
  const voter = voterHash(clientIp(h.get("x-forwarded-for"), h.get("x-real-ip")), h.get("user-agent") ?? "", secret);

  const db = supabaseAdmin();
  const statuses: VoteStatus[] = [];
  for (const a of answers) {
    const { data, error } = await db.rpc("pref_cast_state_vote", {
      p_criterion: a.criterion, p_score: a.score, p_voter_hash: voter,
    });
    statuses.push(error ? "error" : (data as VoteStatus));
  }
  if (statuses.includes("ok")) updateTag("votes-etat");
  return { status: overallStatus(statuses) };
}
