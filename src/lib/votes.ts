import { createHash, createHmac } from "node:crypto";
import { QUESTIONS, type Question, type VoteStatus } from "./vote-questions";

export * from "./vote-questions";

// Visitor votes on the town hall's WEBSITE quality (opinion layer, CLAUDE.md principle 4).
// Never about the mayor or the budget. Shown only from MIN_VOTES votes, labelled "non représentatif".

/**
 * Anonymous voter id: sha256(ip | user agent | daily salt), where the daily salt = HMAC(secret, YYYY-MM-DD UTC).
 * Neither the IP nor the user agent is stored; the hash changes every day and cannot be reversed without the secret.
 */
export function voterHash(ip: string, userAgent: string, secret: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  const salt = createHmac("sha256", secret).update(day).digest("hex");
  return createHash("sha256").update(`${ip}|${userAgent}|${salt}`).digest("hex");
}

/** First address of X-Forwarded-For (set by Vercel), else X-Real-IP. */
export function clientIp(forwardedFor: string | null, realIp: string | null): string {
  return forwardedFor?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
}

/** Validated answers from the form: only known questions, integer scores 1-5. Empty -> invalid. */
export function parseAnswers(form: FormData): { question: Question; score: number }[] | null {
  const out: { question: Question; score: number }[] = [];
  for (const q of QUESTIONS) {
    const raw = form.get(q);
    if (raw == null || raw === "") continue;
    const score = Number(raw);
    if (!Number.isInteger(score) || score < 1 || score > 5) return null;
    out.push({ question: q, score });
  }
  return out.length ? out : null;
}

/** One status for the whole form: ok if at least one answer was recorded. */
export function overallStatus(statuses: VoteStatus[]): VoteStatus {
  if (statuses.includes("ok")) return "ok";
  for (const s of ["rate_limited", "already_voted", "error"] as const) if (statuses.includes(s)) return s;
  return "invalid";
}
