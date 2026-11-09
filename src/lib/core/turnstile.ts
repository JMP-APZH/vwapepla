import "server-only"; // the secret key must never reach browser code

// Cloudflare Turnstile check, shared by every visitor vote (website quality, État's action, commune's action).
// Decision JM, 5 Nov 2026: one shared helper for all the votes. Keys (Vercel env vars, set by JM):
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY  public, used by <Turnstile> in the browser
//   TURNSTILE_SECRET_KEY            secret (Sensitive), server only — never NEXT_PUBLIC_
// Privacy: the visitor's IP is NOT sent to Cloudflare by us (no `remoteip`); the widget script is loaded only
// where a vote form is shown, never site-wide.

export const TURNSTILE_FIELD = "cf-turnstile-response"; // form field the widget fills with its one-time token
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true; skipped?: true } // skipped: no secret key outside production (local dev and tests only)
  | { ok: false; reason: "missing_token" | "not_configured" | "failed" | "unavailable"; codes?: string[] };

type VerifyOptions = {
  /** Expected `action` given to the widget (e.g. "vote-site"); a token made for another form is refused. */
  action?: string;
  secret?: string;
  production?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Verifies the token from the form with Cloudflare (siteverify). Fails closed: in production a missing secret,
 * a network error or a timeout refuses the vote. Without a secret outside production the check is skipped so the
 * forms work in local dev. Each token is single-use; the widget must be reset after every submission.
 */
export async function verifyTurnstile(token: FormDataEntryValue | null, opts: VerifyOptions = {}): Promise<TurnstileResult> {
  const secret = opts.secret ?? process.env.TURNSTILE_SECRET_KEY;
  const production = opts.production ?? process.env.NODE_ENV === "production";
  if (!secret) return production ? { ok: false, reason: "not_configured" } : { ok: true, skipped: true };
  if (typeof token !== "string" || token === "" || token.length > 2048) return { ok: false, reason: "missing_token" };

  let data: { success?: boolean; action?: string; "error-codes"?: string[] };
  try {
    const res = await (opts.fetchImpl ?? fetch)(VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    data = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (data.success !== true) return { ok: false, reason: "failed", codes: data["error-codes"] ?? [] };
  if (opts.action && data.action !== opts.action) return { ok: false, reason: "failed", codes: ["action-mismatch"] };
  return { ok: true };
}
